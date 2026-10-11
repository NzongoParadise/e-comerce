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
  if (!membership) return errorResponse("Empresa não encontrada.", 404);

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { companyId: membership.companyId },
    include: {
      quote: {
        select: {
          quoteNumber: true,
          status: true,
          currency: true,
          version: true,
          items: true,
          revisions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { version: true, snapshot: true },
          },
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalEUR: true,
          totalKZ: true,
          shippingTotalEUR: true,
          shippingTotalKZ: true,
          taxTotalEUR: true,
          taxTotalKZ: true,
          currency: true,
          payment: { select: { status: true, currency: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return Response.json({
    data: purchaseOrders.map((purchaseOrder) => ({
      ...purchaseOrder,
      quote: purchaseOrder.quote
        ? { ...purchaseOrder.quote, proposal: purchaseOrder.quote.revisions[0]?.snapshot ?? null }
        : null,
    })),
    role: membership.role,
    company: membership.company,
  });
}
