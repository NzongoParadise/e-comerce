import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

export type PromotionChannel = "ONLINE" | "POS" | "WHATSAPP";
export type PromotionMarket = "AO" | "PT";

export type PromotionCartItem = {
  productId: number;
  quantity: number;
  unitPrice: number;
  categoryId: number;
  brandId: number;
};

export type PromotionContext = {
  userId: number;
  market: PromotionMarket;
  currency: "AOA" | "EUR";
  channel: PromotionChannel;
  subtotal: number;
  items: PromotionCartItem[];
  shippingCost: number;
  couponCode?: string | null;
  isFirstOrder: boolean;
  customerTier: string;
};

export type AppliedPromotion = {
  promotionId: number | null;
  name: string;
  code?: string | null;
  type: string;
  amount: number;
  currency: "AOA" | "EUR";
  freeShipping: boolean;
};

export type PromotionResult = {
  subtotal: number;
  discountTotal: number;
  shippingDiscount: number;
  total: number;
  applied: AppliedPromotion[];
};

const money = (value: number) => Math.max(0, Math.round(value * 100) / 100);

function compare(value: string, operator: string, expected: string | number) {
  const left = Number(value);
  const right = Number(expected);
  switch (operator) {
    case "GTE": return Number.isFinite(left) && left >= right;
    case "GT": return Number.isFinite(left) && left > right;
    case "LTE": return Number.isFinite(left) && left <= right;
    case "LT": return Number.isFinite(left) && left < right;
    case "IN": return String(expected).split(",").map((v) => v.trim()).includes(value);
    case "NEQ": return value !== String(expected);
    default: return value === String(expected);
  }
}

function ruleMatches(rule: { kind: string; operator: string; value: string }, context: PromotionContext) {
  switch (rule.kind) {
    case "MARKET": return compare(context.market, rule.operator, rule.value);
    case "CHANNEL": return compare(context.channel, rule.operator, rule.value);
    case "CUSTOMER_TIER": return compare(context.customerTier, rule.operator, rule.value);
    case "FIRST_ORDER": return rule.value === "true" ? context.isFirstOrder : !context.isFirstOrder;
    case "MIN_ORDER": return compare(String(context.subtotal), rule.operator, rule.value);
    default: return true;
  }
}

function eligibleItems(promotion: any, context: PromotionContext) {
  const productIds = new Set((promotion.products || []).map((item: any) => item.productId));
  const categoryIds = new Set((promotion.categories || []).map((item: any) => item.categoryId));
  const brandIds = new Set((promotion.brands || []).map((item: any) => item.brandId));
  const hasTarget = productIds.size || categoryIds.size || brandIds.size;
  return context.items.filter((item) => !hasTarget || productIds.has(item.productId) || categoryIds.has(item.categoryId) || brandIds.has(item.brandId));
}

function calculateAction(action: any, items: PromotionCartItem[], subtotal: number) {
  const base = money(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const actionValue = Number(action.value || 0);
  if (action.type === "PERCENTAGE") return Math.min(base, money(base * actionValue / 100), action.maxDiscount ? Number(action.maxDiscount) : Number.POSITIVE_INFINITY);
  if (action.type === "FIXED") return Math.min(base, money(actionValue), action.maxDiscount ? Number(action.maxDiscount) : Number.POSITIVE_INFINITY);
  if (action.type === "FIXED_PRICE") return Math.max(0, money(base - actionValue * items.reduce((sum, item) => sum + item.quantity, 0)));
  if (action.type === "FREE_SHIPPING") return 0;
  return 0;
}

async function getCustomerProfile(userId: number) {
  const [user, orders] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.order.findMany({ where: { userId, status: { not: "CANCELLED" } }, select: { totalKZ: true, totalEUR: true } }),
  ]);
  const totalAOA = orders.reduce((sum, order) => sum + Number(order.totalKZ), 0);
  const totalEUR = orders.reduce((sum, order) => sum + Number(order.totalEUR), 0);
  const lifetime = totalAOA + totalEUR * 1000;
  const customerTier = lifetime >= 1000000 ? "VIP" : lifetime >= 500000 ? "GOLD" : lifetime >= 200000 ? "SILVER" : "BRONZE";
  return { user, isFirstOrder: orders.length === 0, customerTier };
}

export async function evaluatePromotions(context: PromotionContext, client = prisma): Promise<PromotionResult> {
  const now = new Date();
  const promotions = await client.promotion.findMany({
    where: {
      active: true,
      status: "ACTIVE",
      startAt: { lte: now },
      OR: [{ endAt: null }, { endAt: { gte: now } }],
    },
    include: { rules: true, actions: true, products: true, categories: true, brands: true },
    orderBy: [{ exclusive: "desc" }, { priority: "desc" }, { createdAt: "asc" }],
  });

  let remainingSubtotal = context.subtotal;
  let discountTotal = 0;
  let shippingDiscount = 0;
  let exclusiveApplied = false;
  const applied: AppliedPromotion[] = [];

  for (const promotion of promotions) {
    if (exclusiveApplied) continue;
    if (promotion.code && promotion.code !== context.couponCode?.trim().toUpperCase()) continue;
    if (context.couponCode && promotion.code && promotion.code !== context.couponCode.trim().toUpperCase()) continue;
    if (promotion.minOrderAOA && context.currency === "AOA" && context.subtotal < Number(promotion.minOrderAOA)) continue;
    if (promotion.minOrderEUR && context.currency === "EUR" && context.subtotal < Number(promotion.minOrderEUR)) continue;
    if (!promotion.rules.every((rule: any) => ruleMatches(rule, context))) continue;

    const usageCount = promotion.usageLimit
      ? await client.promotionUsage.count({ where: { promotionId: promotion.id } })
      : 0;
    if (promotion.usageLimit !== null && usageCount >= promotion.usageLimit) continue;

    const customerUsage = promotion.perCustomerLimit
      ? await client.promotionUsage.count({ where: { promotionId: promotion.id, userId: context.userId } })
      : 0;
    if (promotion.perCustomerLimit !== null && customerUsage >= promotion.perCustomerLimit) continue;

    const items = eligibleItems(promotion, context);
    if (!items.length && promotion.actions.every((action: any) => action.type !== "FREE_SHIPPING")) continue;

    for (const action of promotion.actions) {
      if (action.type === "FREE_SHIPPING") {
        if (context.shippingCost > shippingDiscount) shippingDiscount = context.shippingCost;
        applied.push({ promotionId: promotion.id, name: promotion.name, code: promotion.code, type: action.type, amount: context.shippingCost, currency: context.currency, freeShipping: true });
        continue;
      }
      const amount = Math.min(remainingSubtotal, calculateAction(action, items, remainingSubtotal));
      if (amount <= 0) continue;
      discountTotal = money(discountTotal + amount);
      remainingSubtotal = money(remainingSubtotal - amount);
      applied.push({ promotionId: promotion.id, name: promotion.name, code: promotion.code, type: action.type, amount, currency: context.currency, freeShipping: false });
    }

    if (promotion.exclusive && applied.some((entry) => entry.promotionId === promotion.id)) exclusiveApplied = true;
    if (!promotion.stackable && applied.some((entry) => entry.promotionId === promotion.id)) {
      // Non-stackable promotions are still allowed to coexist with free shipping only.
      const latest = applied.filter((entry) => entry.promotionId === promotion.id);
      if (latest.some((entry) => !entry.freeShipping)) exclusiveApplied = true;
    }
  }

  const total = money(Math.max(0, context.subtotal - discountTotal + context.shippingCost - shippingDiscount));
  return { subtotal: context.subtotal, discountTotal, shippingDiscount, total, applied };
}

export async function evaluateOrderPromotions(input: Omit<PromotionContext, "isFirstOrder" | "customerTier">) {
  const profile = await getCustomerProfile(input.userId);
  return evaluatePromotions({ ...input, ...profile });
}

export async function legacyCouponDiscount(userId: number, couponCode: string | null | undefined, subtotal: number, currency: "AOA" | "EUR") {
  if (!couponCode) return null;
  const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
  if (!coupon || !coupon.active || (coupon.expiresAt && coupon.expiresAt <= new Date())) return null;
  if (coupon.minimumOrderKZ && currency === "AOA" && subtotal < Number(coupon.minimumOrderKZ)) return null;
  const used = await prisma.userCoupon.findUnique({ where: { userId_couponId: { userId, couponId: coupon.id } } });
  if (used?.usedAt) return null;
  const amount = coupon.discountType === "PERCENTAGE" ? money(Math.min(subtotal, subtotal * Number(coupon.discountValue) / 100)) : money(Math.min(subtotal, Number(coupon.discountValue)));
  return amount > 0 ? { couponId: coupon.id, code: coupon.code, description: coupon.description, amount } : null;
}

export async function reservePromotionUsages(tx: Prisma.TransactionClient, userId: number, orderId: number, result: PromotionResult) {
  for (const applied of result.applied.filter((entry) => entry.promotionId !== null)) {
    await tx.promotionUsage.create({
      data: {
        promotionId: applied.promotionId!,
        userId,
        orderId,
        couponCode: applied.code,
        discountAmount: applied.amount,
        currency: applied.currency,
      },
    });
    await tx.orderDiscount.create({
      data: {
        orderId,
        promotionId: applied.promotionId!,
        promotionName: applied.name,
        code: applied.code,
        type: applied.type,
        amount: applied.amount,
        currency: applied.currency,
        metadata: { freeShipping: applied.freeShipping },
      },
    });
  }
}
