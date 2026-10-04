import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, userSubject, readJson } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  items: z.array(z.object({
    purchaseItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })).min(1),
  notes: z.string().trim().max(500).optional(),
});

function getId(request: Request) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const index = parts.indexOf("purchases");
  const id = Number(index >= 0 ? parts[index + 1] : NaN);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse("Authentication required", 401);
  if (!isAdmin(user)) return errorResponse("Administrator access required", 403);
  const id = getId(request);
  if (!id) return errorResponse("Invalid purchase id", 400);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid receipt", 400, parsed.error.flatten().fieldErrors);
  const actor = userSubject(user);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!purchase) throw new Error("NOT_FOUND");
      if (purchase.status === "CANCELLED") throw new Error("CANCELLED");

      const requested = new Map(parsed.data.items.map((item) => [item.purchaseItemId, item.quantity]));
      const ids = [...requested.keys()];
      const items = purchase.items.filter((item) => ids.includes(item.id));
      if (items.length !== ids.length) throw new Error("INVALID_ITEMS");

      const previous = await tx.purchaseReceiptItem.findMany({
        where: { purchaseItemId: { in: ids } },
        select: { purchaseItemId: true, quantity: true },
      });
      const receivedByItem = new Map<number, number>();
      for (const row of previous) receivedByItem.set(row.purchaseItemId, (receivedByItem.get(row.purchaseItemId) || 0) + row.quantity);

      for (const item of items) {
        const quantity = requested.get(item.id)!;
        const alreadyReceived = receivedByItem.get(item.id) || 0;
        if (alreadyReceived + quantity > item.quantity) throw new Error("OVER_RECEIPT");
      }

      const receipt = await tx.purchaseReceipt.create({
        data: {
          purchaseId: purchase.id,
          receiptNumber: `REC-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
          receivedBy: actor,
          notes: parsed.data.notes?.trim() || null,
          items: {
            create: parsed.data.items.map((item) => ({
              purchaseItemId: item.purchaseItemId,
              quantity: item.quantity,
            })),
          },
        },
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: requested.get(item.id)! } },
        });
      }

      const allItems = await tx.purchaseItem.findMany({ where: { purchaseId: purchase.id } });
      const receipts = await tx.purchaseReceiptItem.findMany({
        where: { purchaseItem: { purchaseId: purchase.id } },
        select: { purchaseItemId: true, quantity: true },
      });
      const receivedMap = new Map<number, number>();
      for (const row of receipts) receivedMap.set(row.purchaseItemId, (receivedMap.get(row.purchaseItemId) || 0) + row.quantity);
      const fullyReceived = allItems.every((item) => (receivedMap.get(item.id) || 0) >= item.quantity);
      const anyReceived = receipts.some((row) => row.quantity > 0);

      let financeEntryId = purchase.financeEntryId;
      if (!financeEntryId && anyReceived) {
        const finance = await tx.financeEntry.create({
          data: {
            type: "EXPENSE",
            description: `Compra de mercadoria · ${purchase.purchaseNumber}`,
            category: "Compras de mercadoria",
            amount: purchase.total,
            currency: purchase.currency,
            status: "CONFIRMED",
            transactionDate: purchase.transactionDate,
            reference: purchase.purchaseNumber,
            notes: purchase.notes || null,
            createdBy: actor,
            updatedBy: actor,
            sourceType: "PURCHASE",
            sourceId: purchase.id,
            idempotencyKey: `purchase-expense:${purchase.id}`,
            events: {
              create: {
                actorExternalId: actor,
                eventType: "CREATED_FROM_PURCHASE_RECEIPT",
                payload: { purchaseId: purchase.id, receiptId: receipt.id },
              },
            },
          },
        });
        financeEntryId = finance.id;
      }

      const status = fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
      const updated = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status,
          financeEntryId,
          updatedBy: actor,
          events: {
            create: {
              actorExternalId: actor,
              eventType: "RECEIVED",
              payload: { receiptId: receipt.id, fullyReceived: fullyReceived, stockUpdated: true },
            },
          },
        },
        include: { items: true, receipts: { include: { items: true } }, payments: true, financeEntry: true },
      });
      return updated;
    }, { isolationLevel: "Serializable" });

    return Response.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return errorResponse("Purchase not found", 404);
    if (message === "CANCELLED") return errorResponse("A compra está cancelada.", 409);
    if (message === "INVALID_ITEMS") return errorResponse("Existem itens inválidos para esta compra.", 400);
    if (message === "OVER_RECEIPT") return errorResponse("A quantidade recebida ultrapassa a quantidade comprada.", 409);
    console.error("Unable to receive purchase:", error);
    return errorResponse("Unable to receive purchase", 503);
  }
}