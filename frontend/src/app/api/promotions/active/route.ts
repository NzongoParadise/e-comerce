import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

export async function GET() {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: { active: true, status: "ACTIVE", startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gte: now } }] },
    select: {
      id: true, name: true, description: true, code: true, startAt: true, endAt: true,
      priority: true, exclusive: true, stackable: true, perCustomerLimit: true,
      minOrderAOA: true, minOrderEUR: true, usageLimit: true,
      actions: { select: { type: true, value: true, maxDiscount: true } },
      rules: { select: { kind: true, operator: true, value: true } },
      products: { select: { productId: true } },
      categories: { select: { categoryId: true } },
      brands: { select: { brandId: true } },
      _count: { select: { usages: true } },
    },
    orderBy: [{ exclusive: "desc" }, { priority: "desc" }, { createdAt: "asc" }],
  });
  const availablePromotions = promotions
    .filter((promotion) => promotion.usageLimit === null || promotion._count.usages < promotion.usageLimit)
    .map((promotion) => ({
      id: promotion.id,
      name: promotion.name,
      description: promotion.description,
      code: promotion.code,
      startAt: promotion.startAt,
      endAt: promotion.endAt,
      priority: promotion.priority,
      exclusive: promotion.exclusive,
      stackable: promotion.stackable,
      perCustomerLimit: promotion.perCustomerLimit,
      minOrderAOA: promotion.minOrderAOA,
      minOrderEUR: promotion.minOrderEUR,
      actions: promotion.actions,
      rules: promotion.rules,
      products: promotion.products,
      categories: promotion.categories,
      brands: promotion.brands,
    }));
  return Response.json({ data: availablePromotions });
}
