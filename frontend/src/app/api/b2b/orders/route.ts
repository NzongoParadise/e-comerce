import { Prisma } from "@prisma/client";
import { authenticate, errorResponse, userSubject } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

const pageSizeDefault = 25;
const pageSizeMax = 50;

export async function GET(request: Request) {
  const auth = await authenticate(request);
  const subject = userSubject(auth);
  if (!subject) return errorResponse("Não autenticado.", 401);

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true },
  });
  if (!user) return errorResponse("Utilizador não encontrado.", 404);
  if (user.accountType !== "B2B") return errorResponse("Esta operação requer uma conta empresarial.", 403);

  const membership = await prisma.companyMember.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      company: { status: "ACTIVE" },
    },
    select: { companyId: true, role: true },
  });
  if (!membership) return errorResponse("Conta empresarial não configurada ou empresa inativa.", 403);

  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || 1);
  const pageSize = Number(params.get("pageSize") || pageSizeDefault);
  const search = (params.get("search") || "").trim();
  const status = params.get("status") || "ALL";
  const allowedStatuses = ["ALL", "PENDING", "AWAITING_PAYMENT", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
  if (
    !Number.isInteger(page) || page < 1 ||
    !Number.isInteger(pageSize) || pageSize < 1 || pageSize > pageSizeMax ||
    search.length > 120 ||
    !allowedStatuses.includes(status)
  ) {
    return errorResponse("Filtros ou paginação inválidos.", 400);
  }

  const where: Prisma.OrderWhereInput = {
    companyId: membership.companyId,
    ...(status === "DELIVERED"
      ? { status: { in: ["DELIVERED", "COMPLETED"] } }
      : status !== "ALL"
        ? { status }
        : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { status: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const [orders, filteredCount, allCount, totals, pendingCount, awaitingPaymentCount, confirmedCount, processingCount, shippedCount, deliveredCount, completedCount, cancelledCount] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: { items: true, payment: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
      prisma.order.count({ where: { companyId: membership.companyId } }),
      prisma.order.aggregate({
        where: { companyId: membership.companyId },
        _sum: { totalEUR: true, totalKZ: true },
      }),
      prisma.order.count({ where: { companyId: membership.companyId, status: "PENDING" } }),
      prisma.order.count({ where: { companyId: membership.companyId, status: "AWAITING_PAYMENT" } }),
      prisma.order.count({ where: { companyId: membership.companyId, status: "PAYMENT_CONFIRMED" } }),
      prisma.order.count({ where: { companyId: membership.companyId, status: "PROCESSING" } }),
      prisma.order.count({ where: { companyId: membership.companyId, status: "SHIPPED" } }),
      prisma.order.count({ where: { companyId: membership.companyId, status: "DELIVERED" } }),
      prisma.order.count({ where: { companyId: membership.companyId, status: "COMPLETED" } }),
      prisma.order.count({ where: { companyId: membership.companyId, status: "CANCELLED" } }),
    ]);

    const statusCounts = {
      PENDING: pendingCount,
      AWAITING_PAYMENT: awaitingPaymentCount,
      PAYMENT_CONFIRMED: confirmedCount,
      PROCESSING: processingCount,
      SHIPPED: shippedCount,
      DELIVERED: deliveredCount,
      COMPLETED: completedCount,
      CANCELLED: cancelledCount,
    };
    const processing = (statusCounts.PROCESSING || 0) + (statusCounts.PENDING || 0);
    const completed = (statusCounts.COMPLETED || 0) + (statusCounts.DELIVERED || 0);

    return Response.json({
      data: orders,
      meta: {
        page,
        pageSize,
        total: filteredCount,
        pageCount: Math.ceil(filteredCount / pageSize),
      },
      summary: {
        count: allCount,
        totalEUR: Number(totals._sum.totalEUR || 0),
        totalKZ: Number(totals._sum.totalKZ || 0),
        processing,
        completed,
        statusCounts,
      },
    });
  } catch (error) {
    console.error("Unable to load B2B orders", error);
    return errorResponse("Não foi possível carregar as encomendas empresariais.", 503);
  }
}
