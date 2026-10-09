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
  const paymentGroups = await prisma.payment.groupBy({
    by: ["currency", "status"],
    where: { order: { companyId: membership.companyId } },
    _sum: { amountEUR: true, amountKZ: true },
  });

  // KPIs are aggregated from the complete ledger; the table remains a recent-activity view.
  const totals = paymentGroups.reduce((acc, payment) => {
    const isEUR = payment.currency === "EUR";
    const amount = isEUR
      ? Number(payment._sum.amountEUR || 0)
      : Number(payment._sum.amountKZ || 0);
    if (payment.status === "PAID") {
      if (isEUR) acc.paidEUR += amount;
      else acc.paidAOA += amount;
    } else if (["AWAITING_PAYMENT", "PROCESSING", "CREATED", "PENDING"].includes(payment.status)) {
      if (isEUR) acc.pendingEUR += amount;
      else acc.pendingAOA += amount;
    } else if (["FAILED", "EXPIRED", "CANCELLED"].includes(payment.status)) {
      if (isEUR) acc.failedEUR += amount;
      else acc.failedAOA += amount;
    }
    return acc;
  }, {
    paidEUR: 0, paidAOA: 0,
    pendingEUR: 0, pendingAOA: 0,
    failedEUR: 0, failedAOA: 0,
  });

  const invoices = await prisma.invoice.findMany({
    where: { companyId: membership.companyId },
    select: {
      id: true,
      invoiceNumber: true,
      verificationCode: true,
      status: true,
      currency: true,
      totalEUR: true,
      totalKZ: true,
      issuedAt: true,
      creditNotes: {
        select: { id: true, creditNoteNumber: true, verificationCode: true, status: true, currency: true, amountEUR: true, amountKZ: true, issuedAt: true },
        orderBy: { issuedAt: "desc" },
      },
      order: { select: { orderNumber: true, status: true, payment: { select: { status: true, paidAt: true } } } },
    },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });

  return Response.json({ data: { company: membership.company, role: membership.role, totals, payments, invoices } });
}