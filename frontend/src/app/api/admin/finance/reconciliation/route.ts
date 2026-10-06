import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Authentication required", 401);
  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { accessRole: true } });
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.accessRole)) return errorResponse("Forbidden", 403);

  const payments = await prisma.payment.findMany({
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: {
      order: { select: { id: true, orderNumber: true } },
      events: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, eventType: true, status: true, amountKZ: true } },
    },
  });

  const anomalies = payments.flatMap((payment) => {
    const issues: { paymentId: number; orderNumber: string; severity: "HIGH" | "MEDIUM"; code: string; message: string }[] = [];
    const paidEvent = payment.events.find((event) => event.status === "PAID");
    const failedEvent = payment.events.find((event) => ["FAILED", "EXPIRED", "CANCELLED"].includes(event.status));
    if (payment.status === "PAID" && !paidEvent) issues.push({ paymentId: payment.id, orderNumber: payment.order.orderNumber, severity: "HIGH", code: "PAID_WITHOUT_EVENT", message: "Pagamento marcado como PAID sem evento PAID do gateway." });
    if (paidEvent && payment.status !== "PAID") issues.push({ paymentId: payment.id, orderNumber: payment.order.orderNumber, severity: "HIGH", code: "EVENT_WITHOUT_STATE", message: "Existe evento PAID, mas o estado interno do pagamento não é PAID." });
    if (paidEvent?.amountKZ != null && Number(paidEvent.amountKZ) !== Number(payment.amountKZ)) issues.push({ paymentId: payment.id, orderNumber: payment.order.orderNumber, severity: "HIGH", code: "AMOUNT_MISMATCH", message: "O valor do evento do gateway não coincide com o valor interno." });
    if (failedEvent && payment.status === "PAID") issues.push({ paymentId: payment.id, orderNumber: payment.order.orderNumber, severity: "MEDIUM", code: "CONFLICTING_EVENTS", message: "O pagamento possui evento de falha/expiração e está marcado como PAID." });
    return issues;
  });

  return Response.json({
    data: {
      summary: {
        checked: payments.length,
        anomalies: anomalies.length,
        high: anomalies.filter((item) => item.severity === "HIGH").length,
        medium: anomalies.filter((item) => item.severity === "MEDIUM").length,
        paid: payments.filter((payment) => payment.status === "PAID").length,
        pending: payments.filter((payment) => payment.status === "PENDING").length,
        failed: payments.filter((payment) => ["FAILED", "EXPIRED", "CANCELLED"].includes(payment.status)).length,
      },
      anomalies,
      checkedAt: new Date().toISOString(),
    },
  });
}
