import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Authentication required", 401);
  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true, accountType: true } });
  if (!user || user.accountType !== "B2B") return errorResponse("Esta operação requer uma conta empresarial.", 403);
  const membership = await prisma.companyMember.findFirst({ where: { userId: user.id, status: "ACTIVE", company: { status: "ACTIVE" } }, include: { company: true } });
  if (!membership) return errorResponse("Empresa não encontrada.", 404);

  const payments = await prisma.payment.findMany({
    where: { order: { companyId: membership.companyId } },
    select: { id: true, status: true, method: true, currency: true, amountEUR: true, amountKZ: true, paidAt: true, failedAt: true, createdAt: true, order: { select: { id: true, orderNumber: true, status: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const totals = payments.reduce((acc, payment) => {
    const isEUR = payment.currency === "EUR";
    const amount = isEUR ? Number(payment.amountEUR) : Number(payment.amountKZ);
    const suffix = isEUR ? "EUR" : "AOA";
    if (payment.status === "PAID") acc["paid" + suffix] += amount;
    else if (["AWAITING_PAYMENT", "PROCESSING", "CREATED", "PENDING"].includes(payment.status)) acc["pending" + suffix] += amount;
    else if (["FAILED", "EXPIRED", "CANCELLED"].includes(payment.status)) acc["failed" + suffix] += amount;
    return acc;
  }, {
    paidEUR: 0, paidAOA: 0,
    pendingEUR: 0, pendingAOA: 0,
    failedEUR: 0, failedAOA: 0,
  });

  return Response.json({ data: { company: membership.company, role: membership.role, totals, payments } });
}