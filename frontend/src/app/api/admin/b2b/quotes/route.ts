import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson } from "@/lib/server/api";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createNotificationIfAllowed } from "@/lib/server/notifications";

export const runtime = "nodejs";

const proposalLineSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(100000),
  unitPrice: z.number().finite().positive().max(99999999.99),
});

const updateSchema = z.object({
  quoteId: z.coerce.number().int().positive(),
  action: z.enum(["ISSUE_PROPOSAL", "REJECT"]),
  note: z.string().trim().max(1000).optional(),
  validForDays: z.number().int().min(1).max(90).default(15),
  items: z.array(proposalLineSchema).min(1).max(50).optional(),
  shippingAmount: z.number().finite().nonnegative().max(9999999999.99).optional(),
  taxAmount: z.number().finite().nonnegative().max(9999999999.99).optional(),
  deliveryDays: z.number().int().min(1).max(365).optional(),
  paymentTerms: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.action === "ISSUE_PROPOSAL" && !value.items) {
    context.addIssue({
      code: "custom",
      path: ["items"],
      message: "Informe o preço e a quantidade de cada artigo antes de emitir a proposta.",
    });
  }
  if (value.action === "ISSUE_PROPOSAL" && (!value.paymentTerms || value.paymentTerms.length < 3)) {
    context.addIssue({
      code: "custom",
      path: ["paymentTerms"],
      message: "Indique as condições de pagamento da proposta.",
    });
  }
  for (const [field, amount] of [["shippingAmount", value.shippingAmount], ["taxAmount", value.taxAmount]] as const) {
    if (amount !== undefined && Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: "O valor deve ter no máximo duas casas decimais.",
      });
    }
  }
  if (value.items) {
    const productIds = value.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Cada produto deve aparecer apenas uma vez na proposta.",
      });
    }
    value.items.forEach((item, index) => {
      if (Math.abs(item.unitPrice * 100 - Math.round(item.unitPrice * 100)) > 0.000001) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "unitPrice"],
          message: "O preço unitário deve ter no máximo duas casas decimais.",
        });
      }
    });
  }
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse("Authentication required", 401), user: null };
  if (!isAdmin(user)) return { error: errorResponse("Administrator access required", 403), user: null };
  const profile = user.sub
    ? await prisma.user.findUnique({ where: { externalId: user.sub }, select: { id: true } })
    : null;
  if (!profile) return { error: errorResponse("Administrator profile not found", 403), user: null };
  return { error: null, user: profile };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const status = params.get("status") || "ALL";
  const companyId = params.has("companyId") ? Number(params.get("companyId")) : null;
  if (companyId !== null && (!Number.isInteger(companyId) || companyId < 1)) return errorResponse("Empresa inválida.", 400);
  const where = {
    companyId: { not: null },
    ...(status === "ALL" ? {} : { status }),
    ...(companyId === null ? {} : { companyId }),
  };

  try {
    const quotes = await prisma.quote.findMany({
      where,
      include: {
        company: { select: { id: true, legalName: true, tradeName: true, nif: true, status: true } },
        user: { select: { id: true, name: true, email: true } },
        items: { select: { productId: true, name: true, description: true, imageUrl: true, quantity: true, unitPrice: true, subtotal: true } },
        revisions: { select: { version: true, validUntil: true, createdAt: true, snapshot: true }, orderBy: { version: "desc" } },
        purchaseOrders: { select: { id: true, poNumber: true, status: true, orderId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const counts = await prisma.quote.groupBy({
      by: ["status"],
      where: { companyId: { not: null } },
      _count: { _all: true },
    });
    return Response.json({
      data: quotes,
      stats: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    });
  } catch (error) {
    console.error("Unable to load B2B quote queue:", error);
    return errorResponse("Unable to load B2B quotes", 503);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid quote action", 400, parsed.error.flatten().fieldErrors);

  const { quoteId, action, note } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        include: {
          company: true,
          items: true,
          purchaseOrders: true,
        },
      });
      if (!quote) throw new Error("QUOTE_NOT_FOUND");
      if (!quote.companyId || !quote.company) throw new Error("COMPANY_REQUIRED");
      if (!["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"].includes(quote.status)) {
        throw new Error("QUOTE_NOT_REVIEWABLE");
      }

      if (action === "REJECT") {
        const updated = await tx.quote.updateMany({
          where: { id: quote.id, status: quote.status, version: quote.version },
          data: { status: "REJECTED" },
        });
        if (!updated.count) throw new Error("QUOTE_NOT_REVIEWABLE");
        await tx.quoteEvent.create({
          data: {
            quoteId: quote.id,
            version: quote.version,
            fromStatus: quote.status,
            toStatus: "REJECTED",
            action: "ADMIN_REJECTED",
            note: note || null,
            actorUserId: auth.user!.id,
          },
        });
        return {
          quoteId: quote.id,
          status: "REJECTED",
          version: quote.version,
          validUntil: null,
          userId: quote.userId,
          quoteNumber: quote.quoteNumber,
        };
      }
      if (quote.company.status !== "ACTIVE") throw new Error("COMPANY_NOT_ACTIVE");

      const now = new Date();
      const validUntil = new Date(now.getTime() + parsed.data.validForDays * 24 * 60 * 60 * 1000);
      const version = quote.version + 1;
      const submittedLines = parsed.data.items;
      if (!submittedLines || submittedLines.length !== quote.items.length) {
        throw new Error("INVALID_PROPOSAL_ITEMS");
      }
      const proposalByProductId = new Map(submittedLines.map((item) => [item.productId, item]));
      const currentProductIds = new Set(quote.items.map((item) => item.productId));
      if (
        proposalByProductId.size !== currentProductIds.size ||
        [...proposalByProductId.keys()].some((productId) => !currentProductIds.has(productId))
      ) {
        throw new Error("INVALID_PROPOSAL_ITEMS");
      }

      const proposalItems = quote.items.map((item) => {
        const submitted = proposalByProductId.get(item.productId);
        if (!submitted) throw new Error("INVALID_PROPOSAL_ITEMS");
        const unitPrice = new Prisma.Decimal(submitted.unitPrice.toFixed(2));
        return {
          ...item,
          quantity: submitted.quantity,
          unitPrice,
          subtotal: unitPrice.mul(submitted.quantity),
        };
      });
      const shippingAmount = new Prisma.Decimal((parsed.data.shippingAmount ?? 0).toFixed(2));
      const taxAmount = new Prisma.Decimal((parsed.data.taxAmount ?? 0).toFixed(2));
      const itemsTotal = proposalItems.reduce(
        (sum, item) => sum.plus(item.subtotal),
        new Prisma.Decimal(0),
      );
      const total = itemsTotal.plus(shippingAmount).plus(taxAmount);
      const maximumTotal = quote.currency === "EUR"
        ? new Prisma.Decimal("99999999.99")
        : new Prisma.Decimal("9999999999.99");
      if (!total.gt(0) || total.gt(maximumTotal)) throw new Error("INVALID_PROPOSAL_TOTAL");

      // Keep the customer's original RFQ lines immutable. Commercial terms live
      // exclusively in the versioned QuoteRevision snapshot.

      const revision = await tx.quoteRevision.create({
        data: {
          quoteId: quote.id,
          version,
          validUntil,
          createdByUserId: auth.user!.id,
          snapshot: {
            quoteNumber: quote.quoteNumber,
            company: {
              legalName: quote.company.legalName,
              tradeName: quote.company.tradeName,
              nif: quote.company.nif,
              country: quote.company.country,
              province: quote.company.province,
              city: quote.company.city,
              address: quote.company.address,
              email: quote.company.email,
              phone: quote.company.phone,
            },
            currency: quote.currency,
            itemsTotal: itemsTotal.toFixed(2),
            shippingAmount: shippingAmount.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            total: total.toFixed(2),
            deliveryDays: parsed.data.deliveryDays ?? null,
            paymentTerms: parsed.data.paymentTerms!.trim(),
            items: proposalItems.map((item) => ({
              productId: item.productId,
              name: item.name,
              description: item.description,
              imageUrl: item.imageUrl,
              quantity: item.quantity,
              unitPrice: item.unitPrice.toString(),
              subtotal: item.subtotal.toString(),
            })),
          } satisfies Prisma.InputJsonObject,
        },
      });

      const updated = await tx.quote.updateMany({
        where: { id: quote.id, status: quote.status, version: quote.version },
        data: {
          status: "SENT",
          version,
          validUntil,
          issuedAt: now,
          acceptedAt: null,
          acceptedVersion: null,
        },
      });
      if (!updated.count) throw new Error("QUOTE_NOT_REVIEWABLE");
      await tx.quoteEvent.create({
        data: {
          quoteId: quote.id,
          revisionId: revision.id,
          version,
          fromStatus: quote.status,
          toStatus: "SENT",
          action: "PROPOSAL_ISSUED",
          note: note || null,
          actorUserId: auth.user!.id,
        },
      });

      return { quoteId: quote.id, status: "SENT", version, validUntil, userId: quote.userId, quoteNumber: quote.quoteNumber };
    });

    await createNotificationIfAllowed({
      userId: result.userId,
      channel: "orderUpdates",
      type: result.status === "REJECTED" ? "QUOTE_REJECTED" : "QUOTE_PROPOSAL_READY",
      title: result.status === "REJECTED" ? "Pedido de cotação atualizado" : "Proposta comercial disponível",
      message: result.status === "REJECTED"
        ? `O pedido de cotação ${result.quoteNumber} foi analisado. Consulte a sua área empresarial para mais informações.`
        : `A proposta para a cotação ${result.quoteNumber} está disponível para consulta.`,
      link: "/b2b/cotacoes",
      dedupeKey: `quote:${result.quoteId}:status:${result.status}:version:${result.version}`,
    }).catch((notificationError) => {
      console.error("Unable to notify customer about B2B quote update:", notificationError);
    });

    return Response.json({
      data: {
        quoteId: result.quoteId,
        status: result.status,
        version: result.version,
        validUntil: result.validUntil,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "QUOTE_NOT_FOUND") return errorResponse("Cotação não encontrada.", 404);
    if (code === "COMPANY_REQUIRED") return errorResponse("A cotação não está associada a uma empresa.", 409);
    if (code === "COMPANY_NOT_ACTIVE") return errorResponse("A empresa precisa de estar homologada antes de aprovar cotações.", 409);
    if (code === "INVALID_PROPOSAL_ITEMS") return errorResponse("Os artigos da proposta têm de corresponder exatamente aos artigos pedidos.", 400);
    if (code === "INVALID_PROPOSAL_TOTAL") return errorResponse("O total da proposta não é válido.", 422);
    if (code === "QUOTE_NOT_REVIEWABLE") return errorResponse("Esta cotação já foi processada.", 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorResponse("A proposta foi atualizada em simultâneo. Atualize a lista antes de tentar novamente.", 409);
    }
    console.error("Unable to process B2B quote:", error);
    return errorResponse("Não foi possível processar a cotação.", 503);
  }
}
