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
      quote: { select: { quoteNumber: true, status: true, items: true } },
      order: { select: { id: true, orderNumber: true, status: true, country: true, currency: true, totalEUR: true, totalKZ: true, payment: { select: { id: true, status: true, method: true, currency: true, amountEUR: true, amountKZ: true, entity: true, referenceNumber: true, expiresAt: true, paidAt: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return Response.json({ data: purchaseOrders, role: membership.role, company: membership.company });
}
