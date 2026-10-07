import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticate(request);
  const subject = userSubject(auth);
  if (!subject) return errorResponse("Não autenticado.", 401);

  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true, accountType: true } });
  if (!user || user.accountType !== "B2B") return errorResponse("Esta operação requer uma conta empresarial.", 403);

  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: { company: true },
  });
  if (!membership) return Response.json({ data: null });

  const [quotes, orders, purchaseOrders, rules] = await Promise.all([
    prisma.quote.findMany({
      where: { companyId: membership.companyId },
      select: { id: true, quoteNumber: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.findMany({
      where: { companyId: membership.companyId },
      select: { id: true, orderNumber: true, status: true, totalEUR: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId: membership.companyId },
      select: { id: true, poNumber: true, status: true, orderId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.b2BPriceRule.count({ where: { companyId: membership.companyId, active: true } }),
  ]);

  const allOrders = await prisma.order.aggregate({
    where: { companyId: membership.companyId },
    _sum: { totalEUR: true },
    _count: { id: true },
  });

  return Response.json({
    data: {
      company: membership.company,
      role: membership.role,
      metrics: {
        quotesPending: quotes.filter((q) => ["SUBMITTED", "UNDER_REVIEW"].includes(q.status)).length,
        openOrders: orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status)).length,
        purchaseOrdersPending: purchaseOrders.filter((p) => ["DRAFT", "APPROVED"].includes(p.status) && !p.orderId).length,
        totalOrders: allOrders._count.id,
        totalEUR: Number(allOrders._sum.totalEUR || 0),
        priceRules,
      },
      quotes,
      orders,
      purchaseOrders,
    },
  });
}
