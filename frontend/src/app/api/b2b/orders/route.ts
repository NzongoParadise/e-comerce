import { authenticate, errorResponse, userSubject } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Não autenticado.", 401);

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true },
  });
  if (!user || user.accountType !== "B2B") return errorResponse("Esta operação requer uma conta empresarial.", 403);

  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    select: { companyId: true },
  });
  if (!membership) return errorResponse("Conta empresarial não configurada.", 403);

  try {
    const orders = await prisma.order.findMany({
      where: { companyId: membership.companyId },
      include: {
        items: { select: { id: true, name: true, quantity: true, unitPrice: true, subtotal: true } },
        payment: { select: { status: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const totalEUR = orders.reduce((total, order) => total + Number(order.totalEUR || 0), 0);
    const totalAOA = orders.reduce((total, order) => total + Number(order.totalKZ || 0), 0);
    const completed = orders.filter((order) => ["COMPLETED", "DELIVERED"].includes(order.status)).length;
    const processing = orders.filter((order) => !["COMPLETED", "DELIVERED", "CANCELLED"].includes(order.status)).length;

    return Response.json({
      data: orders,
      summary: { count: orders.length, totalEUR, totalAOA, processing, completed },
    });
  } catch (error) {
    console.error("Unable to load B2B order history:", error);
    return errorResponse("Não foi possível carregar o histórico de encomendas.", 503);
  }
}
