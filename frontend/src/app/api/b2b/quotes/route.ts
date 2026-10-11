import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { resolveQuoteUnitPrice } from "@/lib/b2b/quotePricing";
import {
  canTransitionQuote,
  isQuoteProposalValid,
} from "@/lib/b2b/quoteWorkflow";

export const runtime = "nodejs";

function marketForCountry(country: string | null | undefined): "AO" | "PT" {
  const normalized = (country ?? "").trim().toUpperCase();
  return normalized === "PT" || normalized === "PORTUGAL" ? "PT" : "AO";
}

const quoteSchema = z.object({
  currency: z.enum(["AOA", "EUR"]),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(100000),
      }),
    )
    .min(1)
    .max(50)
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, {
      message: "Cada produto deve aparecer apenas uma vez.",
    }),
  notes: z.string().trim().max(2000).optional(),
});

async function getContext(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return { response: errorResponse("Não autenticado.", 401) };

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true },
  });
  if (!user || user.accountType !== "B2B") {
    return { response: errorResponse("Esta operação requer uma conta empresarial.", 403) };
  }

  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: { company: true },
  });
  if (!membership) {
    return { response: errorResponse("A sua conta ainda não está associada a uma empresa.", 403) };
  }

  return { user, membership };
}

export async function GET(request: Request) {
  try {
    const context = await getContext(request);
    if ("response" in context) return context.response;

    const quotes = await prisma.quote.findMany({
      where: { companyId: context.membership.companyId },
      include: {
        items: true,
        revisions: {
          select: { id: true, version: true, snapshot: true, validUntil: true, createdAt: true },
          orderBy: { version: "desc" },
        },
        events: {
          where: { action: { startsWith: "CUSTOMER_" } },
          select: { version: true, action: true, note: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        purchaseOrders: {
          select: { id: true, poNumber: true, status: true, orderId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return Response.json({
      data: quotes.map((quote) => ({
        ...quote,
        proposal: quote.revisions.find((revision) => revision.version === quote.version)?.snapshot ?? null,
      })),
      role: context.membership.role,
      company: {
        id: context.membership.company.id,
        legalName: context.membership.company.legalName,
        tradeName: context.membership.company.tradeName,
        status: context.membership.company.status,
        country: context.membership.company.country,
      },
    });
  } catch (error) {
    console.error("Unable to load B2B quotes:", error);
    return errorResponse("Não foi possível carregar as cotações empresariais.", 503);
  }
}

const responseSchema = z.object({
  quoteId: z.number().int().positive(),
  version: z.number().int().positive(),
  action: z.enum(["ACCEPT", "REJECT", "REQUEST_REVISION"]),
  note: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (value.action === "REQUEST_REVISION" && (!value.note || value.note.length < 3)) {
    context.addIssue({
      code: "custom",
      path: ["note"],
      message: "Indique o que pretende rever na proposta.",
    });
  }
});

export async function PATCH(request: Request) {
  try {
    const context = await getContext(request);
    if ("response" in context) return context.response;

    if (context.membership.company.status !== "ACTIVE") {
      return errorResponse("A empresa precisa de estar ativa para responder a propostas.", 403);
    }
    const parsed = responseSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return errorResponse("Verifique a ação e a versão da proposta.", 400, parsed.error.flatten().fieldErrors);
    }
    const { quoteId, version, action, note } = parsed.data;
    if (action !== "REQUEST_REVISION" && !["OWNER", "APPROVER"].includes(context.membership.role)) {
      return errorResponse("Apenas um proprietário ou aprovador pode aceitar ou recusar a proposta.", 403);
    }

    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, companyId: context.membership.companyId },
        include: {
          items: true,
          revisions: { orderBy: { version: "desc" }, take: 1 },
          purchaseOrders: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      if (!quote) throw new Error("QUOTE_NOT_FOUND");

      if (
        action === "ACCEPT" &&
        ["ACCEPTED", "CONVERTED_TO_ORDER"].includes(quote.status) &&
        quote.acceptedVersion === version
      ) {
        const purchaseOrder = quote.purchaseOrders[0];
        if (!purchaseOrder) throw new Error("ACCEPTED_QUOTE_WITHOUT_PO");
        return { quote, purchaseOrder, idempotent: true, expired: false };
      }
      if (
        action === "REQUEST_REVISION" &&
        quote.status === "REVISION_REQUESTED" &&
        quote.version === version
      ) {
        return { quote, purchaseOrder: null, idempotent: true, expired: false };
      }
      if (action === "REJECT" && quote.status === "REJECTED" && quote.version === version) {
        return { quote, purchaseOrder: null, idempotent: true, expired: false };
      }
      if (quote.version !== version) throw new Error("QUOTE_VERSION_MISMATCH");

      const now = new Date();
      if (
        quote.status === "SENT" &&
        quote.validUntil &&
        !isQuoteProposalValid(quote.validUntil, now)
      ) {
        const expired = await tx.quote.updateMany({
          where: { id: quote.id, status: "SENT", version, validUntil: { lte: now } },
          data: { status: "EXPIRED" },
        });
        if (expired.count) {
          await tx.quoteEvent.create({
            data: {
              quoteId: quote.id,
              version,
              fromStatus: "SENT",
              toStatus: "EXPIRED",
              action: "PROPOSAL_EXPIRED",
            },
          });
          return {
            quote: { ...quote, status: "EXPIRED" },
            purchaseOrder: null,
            idempotent: false,
            expired: true,
          };
        }
        throw new Error("QUOTE_NOT_RESPONDABLE");
      }
      if (quote.status !== "SENT" || !canTransitionQuote("SENT", {
        ACCEPT: "ACCEPTED",
        REJECT: "REJECTED",
        REQUEST_REVISION: "REVISION_REQUESTED",
      }[action])) {
        throw new Error("QUOTE_NOT_RESPONDABLE");
      }
      const revision = quote.revisions[0];
      if (!revision || revision.version !== version || !quote.validUntil) {
        throw new Error("QUOTE_REVISION_NOT_FOUND");
      }

      const nextStatus = {
        ACCEPT: "ACCEPTED",
        REJECT: "REJECTED",
        REQUEST_REVISION: "REVISION_REQUESTED",
      }[action];
      const updatedCount = await tx.quote.updateMany({
        where: { id: quote.id, companyId: context.membership.companyId, status: "SENT", version },
        data: {
          status: nextStatus,
          ...(action === "ACCEPT" ? { acceptedAt: now, acceptedVersion: version } : {}),
        },
      });
      if (!updatedCount.count) throw new Error("QUOTE_NOT_RESPONDABLE");

      let purchaseOrder = null;
      if (action === "ACCEPT") {
        if (!quote.items.length) throw new Error("QUOTE_EMPTY");
        purchaseOrder = await tx.purchaseOrder.create({
          data: {
            companyId: context.membership.companyId,
            quoteId: quote.id,
            poNumber: `PO-${quote.id}-${version}`,
            status: "APPROVED",
            currency: quote.currency,
            approvedBy: context.user.id,
            approvedAt: now,
          },
        });
      }

      await tx.quoteEvent.create({
        data: {
          quoteId: quote.id,
          revisionId: revision.id,
          version,
          fromStatus: quote.status,
          toStatus: nextStatus,
          action: `CUSTOMER_${action}`,
          note: note || null,
          actorUserId: context.user.id,
        },
      });
      return {
        quote: { ...quote, status: nextStatus },
        purchaseOrder,
        idempotent: false,
        expired: false,
      };
    });

    if (result.expired) {
      return errorResponse("A validade da proposta terminou. Solicite uma nova revisão à equipa comercial.", 409);
    }
    return Response.json({
      data: {
        quoteId: result.quote.id,
        status: result.quote.status,
        version: result.quote.version,
        purchaseOrder: result.purchaseOrder,
        idempotent: result.idempotent,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "QUOTE_NOT_FOUND") return errorResponse("Cotação não encontrada.", 404);
    if (code === "QUOTE_VERSION_MISMATCH") return errorResponse("Esta proposta já foi substituída. Atualize a cotação antes de responder.", 409);
    if (code === "QUOTE_NOT_RESPONDABLE") return errorResponse("Esta proposta já não aceita respostas.", 409);
    if (code === "QUOTE_REVISION_NOT_FOUND") return errorResponse("Não foi possível confirmar a versão enviada. Contacte o suporte.", 409);
    if (code === "QUOTE_EMPTY") return errorResponse("Não é possível aceitar uma proposta sem artigos.", 409);
    if (code === "ACCEPTED_QUOTE_WITHOUT_PO") return errorResponse("A cotação aceite não tem Purchase Order associado. Contacte o suporte.", 409);
    console.error("Unable to record B2B quote response:", error);
    return errorResponse("Não foi possível registar a resposta à proposta.", 503);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getContext(request);
    if ("response" in context) return context.response;

    if (!["OWNER", "BUYER"].includes(context.membership.role)) {
      return errorResponse("Não tem permissão para criar cotações.", 403);
    }
    if (context.membership.company.status !== "ACTIVE") {
      return errorResponse("A empresa precisa de estar homologada para pedir cotações.", 409);
    }

    const parsed = quoteSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return errorResponse("Verifique os produtos, quantidades e moeda selecionados.", 400, parsed.error.flatten().fieldErrors);
    }

    const productIds = parsed.data.items.map((item) => item.productId);
    const market = marketForCountry(context.membership.company.country);
    const [products, priceRules, prices] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, description: true, imageUrl: true, basePrice: true },
      }),
      prisma.b2BPriceRule.findMany({
        where: {
          companyId: context.membership.companyId,
          productId: { in: productIds },
          currency: parsed.data.currency,
          active: true,
        },
        orderBy: { minQuantity: "desc" },
      }),
      prisma.price.findMany({
        where: {
          productId: { in: productIds },
          currency: parsed.data.currency,
          market,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const productById = new Map(products.map((product) => [product.id, product]));
    if (products.length !== productIds.length) {
      return errorResponse("Um ou mais produtos selecionados já não estão disponíveis.", 400);
    }

    const applicableItems = parsed.data.items.map((requestedItem) => {
      const product = productById.get(requestedItem.productId)!;
      const unitPrice = resolveQuoteUnitPrice(
        {
          basePrice: product.basePrice,
          b2bPriceRules: priceRules.filter(
            (rule) => rule.productId === product.id,
          ),
          prices: prices.filter((price) => price.productId === product.id),
        },
        requestedItem.quantity,
        parsed.data.currency,
        market,
      );

      return { requestedItem, product, unitPrice };
    });

    // An RFQ is allowed to include items with no catalog price. A zero value is
    // only a storage placeholder until the commercial team issues a priced,
    // versioned proposal; the customer UI must display it as "sob consulta".
    const quoteNumber = `COT-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const quote = await prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          quoteNumber,
          userId: context.user.id,
          companyId: context.membership.companyId,
          status: "SUBMITTED",
          currency: parsed.data.currency,
          companyName: context.membership.company.legalName,
          companyNif: context.membership.company.nif,
          phone: context.membership.company.phone || "",
          email: context.membership.company.email || "",
          address: context.membership.company.address,
          notes: parsed.data.notes || null,
          items: {
            create: applicableItems.map(({ requestedItem, product, unitPrice }) => {
              if (unitPrice === null) throw new Error(`Missing ${parsed.data.currency} price for ${product.name}`);
              return {
                productId: product.id,
                name: product.name,
                description: product.description,
                imageUrl: product.imageUrl,
                unitPrice: new Prisma.Decimal(unitPrice ?? 0),
                quantity: requestedItem.quantity,
                subtotal: new Prisma.Decimal(unitPrice ?? 0).mul(requestedItem.quantity),
              };
            }),
          },
        },
        include: { items: true },
      });
      await tx.quoteEvent.create({
        data: {
          quoteId: created.id,
          version: created.version,
          toStatus: "SUBMITTED",
          action: "CUSTOMER_SUBMITTED",
          actorUserId: context.user.id,
        },
      });
      return created;
    });

    return Response.json({ data: quote }, { status: 201 });
  } catch (error) {
    console.error("Unable to create B2B quote:", error);
    return errorResponse("Não foi possível criar o pedido de cotação.", 503);
  }
}
