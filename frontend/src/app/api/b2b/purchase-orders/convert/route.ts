import { prisma } from "@/lib/server/prisma";
import { Prisma } from "@prisma/client";
import { authenticate, errorResponse, userSubject } from "@/lib/server/api";
import { canTransitionQuote } from "@/lib/b2b/quoteWorkflow";
import { B2B_STOCK_RESERVATION_DURATION_MS } from "@/lib/server/orders/inventory";
import { z } from "zod";
export const runtime = "nodejs";

function decimalFromSnapshot(value: unknown): Prisma.Decimal {
  if (value === undefined || value === null) return new Prisma.Decimal(0);
  if (typeof value !== "string" && typeof value !== "number") throw new Error("INVALID_PROPOSAL_CHARGES");
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || amount.isNegative() || amount.decimalPlaces() > 2) {
    throw new Error("INVALID_PROPOSAL_CHARGES");
  }
  return amount;
}

function marketForCountry(country: string | null | undefined): "AO" | "PT" {
  const normalized = (country ?? "").trim().toUpperCase();
  return normalized === "PT" || normalized === "PORTUGAL" ? "PT" : "AO";
}

function stringFromSnapshot(value: unknown, fallback: string | null | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback?.trim() || null;
}

const idSchema = z.coerce.number().int().positive();

export async function POST(request: Request) {
  const auth = await authenticate(request); const subject = userSubject(auth);
  if (!subject) return errorResponse("Não autenticado.", 401);
  const parsedId = idSchema.safeParse(new URL(request.url).searchParams.get("id"));
  if (!parsedId.success) return errorResponse("Purchase Order inválido.", 400);
  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true, accountType: true } });
  if (!user || user.accountType !== "B2B") return errorResponse("Esta operação requer uma conta empresarial.", 403);
  const membership = await prisma.companyMember.findFirst({ where: { userId: user.id, status: "ACTIVE", company: { status: "ACTIVE" } } });
  if (!membership) return errorResponse("A empresa ainda não está ativa.", 403);
  if (!["OWNER", "APPROVER"].includes(membership.role)) return errorResponse("Apenas OWNER ou APPROVER pode aprovar compras.", 403);

  const reservationExpiresAt = new Date(Date.now() + B2B_STOCK_RESERVATION_DURATION_MS);
  try {
    const result = await prisma.$transaction(async (tx) => {
      let po = await tx.purchaseOrder.findFirst({
        where: { id: parsedId.data, companyId: membership.companyId },
        include: {
          quote: {
            include: {
              items: true,
              revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true, snapshot: true } },
              company: {
                select: {
                  country: true,
                  city: true,
                  province: true,
                  address: true,
                  legalName: true,
                  tradeName: true,
                  phone: true,
                },
              },
            },
          },
          order: { include: { items: true } },
        },
      });
      if (!po) throw new Error("PO_NOT_FOUND");
      if (po.order) return { order: po.order, po };
      if (po.status !== "APPROVED") throw new Error("PO_NOT_APPROVED");

      const claimed = await tx.purchaseOrder.updateMany({
        where: { id: po.id, companyId: membership.companyId, status: "APPROVED", orderId: null },
        data: { status: "CONVERTED" },
      });
      if (!claimed.count) {
        po = await tx.purchaseOrder.findFirst({
          where: { id: parsedId.data, companyId: membership.companyId },
          include: {
            quote: {
              include: {
                items: true,
                revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true, snapshot: true } },
                company: {
                  select: {
                    country: true,
                    city: true,
                    province: true,
                    address: true,
                    legalName: true,
                    tradeName: true,
                    phone: true,
                  },
                },
              },
            },
            order: { include: { items: true } },
          },
        });
        if (po?.order) return { order: po.order, po };
        throw new Error("PO_NOT_APPROVED");
      }

      const quote = po.quote;
      if (!quote || quote.companyId !== membership.companyId || !quote.company) throw new Error("QUOTE_REQUIRED");
      if (!["AOA", "EUR"].includes(quote.currency) || po.currency !== quote.currency) {
        throw new Error("CURRENCY_MISMATCH");
      }
      if (quote.status !== "ACCEPTED") throw new Error("QUOTE_NOT_ACCEPTED");
      if (quote.acceptedVersion !== quote.version) throw new Error("QUOTE_VERSION_MISMATCH");
      if (!canTransitionQuote(quote.status, "CONVERTED_TO_ORDER")) {
        throw new Error("QUOTE_NOT_CONVERTIBLE");
      }

      const revision = quote.revisions.find((item) => item.version === quote.acceptedVersion);
      if (!revision) throw new Error("PROPOSAL_REVISION_NOT_FOUND");
      const rawSnapshot = revision.snapshot;
      if (!rawSnapshot || typeof rawSnapshot !== "object" || Array.isArray(rawSnapshot)) {
        throw new Error("INVALID_PROPOSAL_SNAPSHOT");
      }
      const proposalSnapshot = rawSnapshot as Prisma.JsonObject;
      if (
        proposalSnapshot.quoteNumber !== quote.quoteNumber ||
        proposalSnapshot.currency !== quote.currency
      ) {
        throw new Error("INVALID_PROPOSAL_SNAPSHOT");
      }
      const rawProposalItems = proposalSnapshot.items;
      if (!Array.isArray(rawProposalItems) || rawProposalItems.length === 0) {
        throw new Error("INVALID_PROPOSAL_SNAPSHOT");
      }
      const rawProposalCompany = proposalSnapshot.company;
      const proposalCompany = rawProposalCompany && typeof rawProposalCompany === "object" && !Array.isArray(rawProposalCompany)
        ? rawProposalCompany as Prisma.JsonObject
        : {};

      const requestedItemsByProductId = new Map(quote.items.map((item) => [item.productId, item]));
      const seenProductIds = new Set<number>();
      const proposalItems = rawProposalItems.map((rawLine) => {
        if (!rawLine || typeof rawLine !== "object" || Array.isArray(rawLine)) {
          throw new Error("INVALID_PROPOSAL_SNAPSHOT");
        }
        const line = rawLine as Prisma.JsonObject;
        const productId = line.productId;
        const quantity = line.quantity;
        if (
          typeof productId !== "number" || !Number.isInteger(productId) || productId < 1 ||
          typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000 ||
          seenProductIds.has(productId)
        ) {
          throw new Error("INVALID_PROPOSAL_SNAPSHOT");
        }
        const requestedItem = requestedItemsByProductId.get(productId);
        if (!requestedItem) throw new Error("INVALID_PROPOSAL_SNAPSHOT");
        seenProductIds.add(productId);

        const unitPrice = decimalFromSnapshot(line.unitPrice);
        const declaredSubtotal = decimalFromSnapshot(line.subtotal);
        const subtotal = unitPrice.mul(quantity);
        if (
          !unitPrice.gt(0) ||
          unitPrice.gt(new Prisma.Decimal("99999999.99")) ||
          subtotal.toFixed(2) !== declaredSubtotal.toFixed(2)
        ) {
          throw new Error("INVALID_PROPOSAL_SNAPSHOT");
        }
        return {
          productId,
          name: typeof line.name === "string" && line.name.trim() ? line.name.trim() : requestedItem.name,
          imageUrl: typeof line.imageUrl === "string" ? line.imageUrl : requestedItem.imageUrl,
          quantity,
          unitPrice,
          subtotal,
        };
      });
      if (proposalItems.length !== quote.items.length || seenProductIds.size !== requestedItemsByProductId.size) {
        throw new Error("INVALID_PROPOSAL_SNAPSHOT");
      }

      const itemsTotal = proposalItems.reduce(
        (sum, item) => sum.plus(item.subtotal),
        new Prisma.Decimal(0),
      );
      const declaredItemsTotal = decimalFromSnapshot(proposalSnapshot.itemsTotal);
      if (itemsTotal.toFixed(2) !== declaredItemsTotal.toFixed(2)) {
        throw new Error("INVALID_PROPOSAL_SNAPSHOT");
      }
      const shippingAmount = decimalFromSnapshot(proposalSnapshot.shippingAmount);
      const taxAmount = decimalFromSnapshot(proposalSnapshot.taxAmount);
      const total = itemsTotal.plus(shippingAmount).plus(taxAmount);
      const declaredTotal = decimalFromSnapshot(proposalSnapshot.total);
      if (total.toFixed(2) !== declaredTotal.toFixed(2)) throw new Error("INVALID_PROPOSAL_SNAPSHOT");

      const deliveryDays = typeof proposalSnapshot.deliveryDays === "number" &&
        Number.isInteger(proposalSnapshot.deliveryDays) &&
        proposalSnapshot.deliveryDays >= 1 &&
        proposalSnapshot.deliveryDays <= 365
        ? proposalSnapshot.deliveryDays
        : null;
      const paymentTerms = typeof proposalSnapshot.paymentTerms === "string"
        ? proposalSnapshot.paymentTerms.trim()
        : "";

      const orderNumber = `B2B-${new Date().getFullYear()}-${String(po.id).padStart(7, "0")}`;
      const maximumOrderTotal = quote.currency === "EUR"
        ? new Prisma.Decimal("99999999.99")
        : new Prisma.Decimal("9999999999.99");
      if (!total.gt(0) || total.gt(maximumOrderTotal)) throw new Error("INVALID_TOTAL");
      const productIds = proposalItems.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, slug: true },
      });
      const productById = new Map(products.map((product) => [product.id, product]));
      if (productById.size !== new Set(productIds).size) throw new Error("PRODUCT_UNAVAILABLE");
      for (const item of proposalItems) {
        const reserved = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (!reserved.count) throw new Error(`STOCK_UNAVAILABLE:${item.name}`);
      }
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: quote.userId,
          companyId: membership.companyId,
          status: "AWAITING_PAYMENT",
          deliveryMode: "DELIVERY",
          shippingMethod: "STANDARD",
          paymentMethod: quote.currency === "AOA" ? "MANUAL_INVOICE" : "STRIPE_CHECKOUT",
          country: marketForCountry(stringFromSnapshot(proposalCompany.country, quote.company.country)),
          currency: quote.currency,
          billingName: stringFromSnapshot(proposalCompany.legalName, quote.companyName) ?? quote.companyName,
          billingEmail: stringFromSnapshot(proposalCompany.email, quote.email) ?? quote.email,
          billingTaxId: stringFromSnapshot(proposalCompany.nif, quote.companyNif) ?? quote.companyNif,
          deliveryRecipient:
            stringFromSnapshot(proposalCompany.tradeName, quote.company.tradeName) ??
            stringFromSnapshot(proposalCompany.legalName, quote.company.legalName) ??
            quote.company.legalName,
          deliveryCity: stringFromSnapshot(proposalCompany.city, quote.company.city),
          deliveryRegion: stringFromSnapshot(proposalCompany.province, quote.company.province),
          address: quote.address?.trim() || stringFromSnapshot(proposalCompany.address, quote.company.address),
          phone: quote.phone || stringFromSnapshot(proposalCompany.phone, quote.company.phone) || "",
          totalEUR: quote.currency === "EUR" ? total : 0,
          totalKZ: quote.currency === "AOA" ? total : 0,
          shippingTotalEUR: quote.currency === "EUR" ? shippingAmount : 0,
          shippingTotalKZ: quote.currency === "AOA" ? shippingAmount : 0,
          taxTotalEUR: quote.currency === "EUR" ? taxAmount : 0,
          taxTotalKZ: quote.currency === "AOA" ? taxAmount : 0,
          deliveryNotes: [
            paymentTerms || null,
            deliveryDays ? `Prazo de entrega previsto: ${deliveryDays} dias.` : null,
          ].filter(Boolean).join(" · ") || null,
          items: { create: proposalItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            slug: productById.get(item.productId)!.slug,
            imageUrl: item.imageUrl,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })) },
          payment: {
            create: {
              userId: quote.userId,
              provider: quote.currency === "AOA" ? "MANUAL" : "stripe",
              method: quote.currency === "AOA" ? "MANUAL_INVOICE" : "STRIPE_CHECKOUT",
              status: quote.currency === "AOA" ? "AWAITING_PAYMENT" : "PENDING",
              currency: quote.currency,
              amountEUR: quote.currency === "EUR" ? total : 0,
              amountKZ: quote.currency === "AOA" ? total : 0,
              expiresAt: reservationExpiresAt,
            },
          },
        },
        include: { items: true },
      });
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { orderId: order.id, status: "CONVERTED" } });
      if (quote.status === "ACCEPTED") {
        const updatedQuote = await tx.quote.updateMany({
          where: {
            id: quote.id,
            status: "ACCEPTED",
            version: quote.version,
            acceptedVersion: quote.version,
          },
          data: { status: "CONVERTED_TO_ORDER" },
        });
        if (!updatedQuote.count) throw new Error("QUOTE_NOT_CONVERTIBLE");
        await tx.quoteEvent.create({
          data: {
            quoteId: quote.id,
            version: quote.version,
            fromStatus: "ACCEPTED",
            toStatus: "CONVERTED_TO_ORDER",
            action: "ORDER_CREATED",
            actorUserId: user.id,
          },
        });
      }
      return { order, po };
    }, { timeout: 15000 });
    return Response.json({ data: result }, { status: result.po.orderId ? 200 : 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "PO_NOT_FOUND") return errorResponse("Purchase Order não encontrado.", 404);
    if (code === "PO_NOT_APPROVED") return errorResponse("O Purchase Order ainda não está aprovado.", 409);
    if (code === "QUOTE_REQUIRED") return errorResponse("A cotação associada não é válida.", 409);
    if (code === "CURRENCY_MISMATCH") return errorResponse("A moeda do Purchase Order não corresponde à cotação.", 409);
    if (code === "QUOTE_VERSION_MISMATCH") return errorResponse("A versão aceite da cotação já não corresponde à proposta atual.", 409);
    if (code === "QUOTE_NOT_ACCEPTED" || code === "QUOTE_NOT_CONVERTIBLE") return errorResponse("A proposta precisa de ser aceite antes de criar a encomenda.", 409);
    if (code === "PRODUCT_UNAVAILABLE") return errorResponse("Um dos produtos da cotação já não está disponível.", 409);
    if (code.startsWith("STOCK_UNAVAILABLE:")) return errorResponse(`Stock insuficiente para ${code.slice("STOCK_UNAVAILABLE:".length)}.`, 409);
    if (code === "INVALID_TOTAL") return errorResponse("O total da cotação não é válido.", 422);
    if (code === "INVALID_PROPOSAL_CHARGES") return errorResponse("Os valores de transporte e impostos da proposta não são válidos.", 422);
    if (code === "PROPOSAL_REVISION_NOT_FOUND" || code === "INVALID_PROPOSAL_SNAPSHOT") return errorResponse("A versão aceite não contém uma proposta comercial íntegra. Solicite apoio à equipa comercial.", 409);
    console.error("B2B purchase order conversion failed:", error);
    return errorResponse("Não foi possível converter a compra empresarial.", 503);
  }
}
