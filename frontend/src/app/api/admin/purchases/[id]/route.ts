import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, userSubject } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse("Authentication required", 401) };
  if (!isAdmin(user)) return { error: errorResponse("Administrator access required", 403) };
  return { user };
}
function idFromUrl(request: Request) {
  const value = Number(new URL(request.url).pathname.split("/").filter(Boolean).at(-2));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = idFromUrl(request);
  if (!id) return errorResponse("Invalid purchase id", 400);
  const purchase = await prisma.purchase.findUnique({ where: { id }, include: { supplier: true, items: { include: { product: true } }, financeEntry: { include: { events: { orderBy: { createdAt: "desc" } } } }, events: { orderBy: { createdAt: "desc" } } } });
  if (!purchase) return errorResponse("Purchase not found", 404);
  return Response.json({ data: purchase });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = idFromUrl(request);
  if (!id) return errorResponse("Invalid purchase id", 400);
  const action = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
  if (action !== "confirm" && action !== "cancel") return errorResponse("Unsupported purchase action", 404);
  const actor = userSubject(auth.user);
  try {
    if (action === "cancel") {
      const result = await prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
        if (!purchase) throw new Error("NOT_FOUND");
        if (purchase.status === "CANCELLED") return purchase;
        if (purchase.status === "RECEIVED") throw new Error("ALREADY_RECEIVED");
        return tx.purchase.update({
          where: { id },
          data: { status: "CANCELLED", updatedBy: actor, events: { create: { actorExternalId: actor, eventType: "CANCELLED", payload: { reason: "admin_action" } } } },
        });
      });
      return Response.json({ data: result });
    }

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true, financeEntry: true } });
      if (!purchase) throw new Error("NOT_FOUND");
      if (purchase.status === "RECEIVED") return purchase;
      if (purchase.status === "CANCELLED") throw new Error("CANCELLED");
      if (purchase.financeEntryId) throw new Error("ALREADY_FINANCED");

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
          notes: purchase.notes || `Fornecedor: ${purchase.supplierId || "não informado"}`,
          createdBy: actor,
          updatedBy: actor,
          events: { create: { actorExternalId: actor, eventType: "CREATED_FROM_PURCHASE", payload: { purchaseId: purchase.id, purchaseNumber: purchase.purchaseNumber } } },
        },
      });

      for (const item of purchase.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }

      return tx.purchase.update({
        where: { id },
        data: {
          status: "RECEIVED",
          paymentStatus: "PENDING",
          financeEntryId: finance.id,
          updatedBy: actor,
          events: { create: { actorExternalId: actor, eventType: "CONFIRMED", payload: { financeEntryId: finance.id, stockUpdated: true, paymentStatus: "PENDING" } } },
        },
        include: { items: true, financeEntry: true },
      });
    }, { isolationLevel: "Serializable" });
    return Response.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return errorResponse("Purchase not found", 404);
    if (message === "ALREADY_RECEIVED" || message === "ALREADY_FINANCED") return errorResponse("A compra já foi processada.", 409);
    if (message === "CANCELLED") return errorResponse("A compra está cancelada.", 409);
    console.error("Unable to process purchase:", error);
    return errorResponse("Unable to process purchase transaction", 503);
  }
}
