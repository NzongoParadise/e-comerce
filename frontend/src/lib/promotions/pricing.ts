export type PromotionPriceMarket = "AO" | "PT";

export type PromotionPriceAction = {
  type: string;
  value: string | number | null;
  maxDiscount: string | number | null;
};

export type PromotionPriceRule = {
  kind: string;
  operator: string;
  value: string;
};

export type PromotionPriceCampaign = {
  id: number;
  name: string;
  description: string | null;
  code: string | null;
  startAt: string;
  endAt: string | null;
  priority: number;
  exclusive: boolean;
  stackable: boolean;
  perCustomerLimit: number | null;
  minOrderAOA: string | number | null;
  minOrderEUR: string | number | null;
  actions: PromotionPriceAction[];
  rules: PromotionPriceRule[];
  products: { productId: number }[];
  categories: { categoryId: number }[];
  brands: { brandId: number }[];
};

export type PublicPromotion = PromotionPriceCampaign;

export type PromotionPricedProduct = {
  id: number;
  categoryId: number;
  brandId: number;
};

function compare(value: string, operator: string, expected: string) {
  switch (operator) {
    case "GTE": return Number(value) >= Number(expected);
    case "GT": return Number(value) > Number(expected);
    case "LTE": return Number(value) <= Number(expected);
    case "LT": return Number(value) < Number(expected);
    case "IN": return expected.split(",").map((entry) => entry.trim()).includes(value);
    case "NEQ": return value !== expected;
    default: return value === expected;
  }
}

function appliesToProduct(
  promotion: PromotionPriceCampaign,
  product: PromotionPricedProduct,
  price: number,
  market: PromotionPriceMarket,
) {
  if (promotion.code) return false;
  const hasTargets = promotion.products.length + promotion.categories.length + promotion.brands.length > 0;
  const matchesTarget = promotion.products.some((entry) => entry.productId === product.id)
    || promotion.categories.some((entry) => entry.categoryId === product.categoryId)
    || promotion.brands.some((entry) => entry.brandId === product.brandId);
  if (hasTargets && !matchesTarget) return false;

  const minimum = market === "AO" ? promotion.minOrderAOA : promotion.minOrderEUR;
  if (minimum !== null && Number(minimum) > price) return false;

  return promotion.rules.every((rule) => {
    if (rule.kind === "MARKET") return compare(market, rule.operator, rule.value);
    if (rule.kind === "CHANNEL") return compare("ONLINE", rule.operator, rule.value);
    if (rule.kind === "MIN_ORDER") return compare(String(price), rule.operator, rule.value);
    return false;
  });
}

export function getPromotionalUnitPrice(
  product: PromotionPricedProduct,
  market: PromotionPriceMarket,
  regularPrice: number,
  promotions: PromotionPriceCampaign[],
) {
  let remainingPrice = regularPrice;
  let appliedPromotion: PromotionPriceCampaign | undefined;

  for (const promotion of promotions) {
    if (!appliesToProduct(promotion, product, regularPrice, market)) continue;
    let promotionApplied = false;

    for (const action of promotion.actions) {
      const value = Number(action.value ?? 0);
      const maxDiscount = action.maxDiscount === null ? Number.POSITIVE_INFINITY : Number(action.maxDiscount);
      let discount: number;
      if (action.type === "PERCENTAGE") {
        discount = Math.min(regularPrice * value / 100, remainingPrice, maxDiscount);
      } else if (action.type === "FIXED_PRICE") {
        discount = Math.min(remainingPrice, Math.max(0, regularPrice - value));
      } else {
        continue;
      }

      if (discount > 0) {
        remainingPrice = Math.round((remainingPrice - discount) * 100) / 100;
        promotionApplied = true;
      }
    }

    if (promotionApplied) {
      appliedPromotion ??= promotion;
      if (promotion.exclusive || !promotion.stackable) break;
    }
  }

  return appliedPromotion && remainingPrice < regularPrice
    ? { regularPrice, promotionalPrice: remainingPrice, promotion: appliedPromotion }
    : null;
}
