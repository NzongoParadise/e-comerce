import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  amount: z.number().positive().max(1_000_000_000_000),
  method: z.string().trim().min(2).max(50),
  reference: z.string().trim().max(100).optional(),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
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
  const purchaseId = getId(request);
  if (!purchaseId) return errorResponse("Invalid purchase id", 400);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid supplier payment", 400, parsed.error.flatten().fieldErrors);
  const actor = userSubject(user);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { payments: true } });
      if (!purchase) throw new Error("NOT_FOUND");
      if (purchase.status === "CANCELLED") throw new Error("CANCELLED");
      if (purchase.status === "DRAFT" || purchase.status === "SUBMITTED") throw new Error("NOT_RECEIVED");

      const paid = purchase.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const remaining = Number(purchase.total) - paid;
      if (parsed.data.amount > remaining + 0.0001) throw new Error("OVERPAYMENT");
      if (parsed.data.idempotencyKey) {
        const existing = await tx.purchasePayment.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
        if (existing) return tx.purchase.findUnique({ where: { id: purchaseId }, include: { payments: true, financeEntry: true } });
      }

      await tx.purchasePayment.create({
        data: {
          purchaseId,
          amount: parsed.data.amount,
          currency: purchase.currency,
          method: parsed.data.method,
          reference: parsed.data.reference?.trim() || null,
          paidAt: parsed.data.paidAt || new Date(),
          paidBy: actor,
          notes: parsed.data.notes?.trim() || null,
          idempotencyKey: parsed.data.idempotencyKey || `purchase-payment:${purchaseId}:${crypto.randomUUID()}`,
        },
      });

      const nextPaid = paid + parsed.data.amount;
      const paymentStatus = nextPaid >= Number(purchase.total) - 0.0001 ? "PAID" : "PARTIALLY_PAID";
      return tx.purchase.update({
        where: { id: purchaseId },
        data: {
          paymentStatus,
          status: paymentStatus === "PAID" ? "CLOSED" : "PARTIALLY_PAID",
          updatedBy: actor,
          events: {
            create: {
              actorExternalId: actor,
              eventType: "PAYMENT_RECORDED",
              payload: { amount: parsed.data.amount, currency: purchase.currency, method: parsed.data.method, paymentStatus },
            },
          },
        },
        include: { payments: true, receipts: { include: { items: true } }, financeEntry: true },
      });
    }, { isolationLevel: "Serializable" });

    return Response.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return errorResponse("Purchase not found", 404);
    if (message === "CANCELLED") return errorResponse("A compra está cancelada.", 409);
    if (message === "NOT_RECEIVED") return errorResponse("A compra ainda não foi recebida.", 409);
    if (message === "OVERPAYMENT") return errorResponse("O pagamento ultrapassa o saldo em dívida.", 409);
    console.error("Unable to record supplier payment:", error);
    return errorResponse("Unable to record supplier payment", 503);
  }
}