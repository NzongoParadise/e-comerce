import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

export async function GET() {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: { active: true, status: "ACTIVE", startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gte: now } }] },
    select: {
      id: true, name: true, description: true, code: true, startAt: true, endAt: true, priority: true,
      actions: { select: { type: true, value: true, maxDiscount: true } },
      products: { select: { productId: true } },
      categories: { select: { categoryId: true } },
      brands: { select: { brandId: true } },
    },
    orderBy: [{ priority: "desc" }, { startAt: "desc" }],
  });
  return Response.json({ data: promotions });
}
