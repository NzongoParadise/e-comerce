export type QuoteCurrency = "AOA" | "EUR";
export type QuoteMarket = "AO" | "PT";
export type QuotePriceValue = number | string | { toString(): string };

export type QuotePriceableProduct = {
  basePrice: QuotePriceValue;
  prices: Array<{ amount: QuotePriceValue; currency: string; market?: string }>;
  b2bPriceRules: Array<{
    minQuantity: number;
    unitPrice: QuotePriceValue;
    currency: string;
  }>;
};

/**
 * Resolve a unit price in deterministic priority order:
 * 1. the company's active B2B tier for the requested currency;
 * 2. the catalog price for the company's market and requested currency;
 * 3. the legacy EUR base price, only for Portugal where it represents the
 *    market's default price.
 *
 * A missing price is represented by null so the commercial team can quote it
 * instead of blocking a request for quotation.
 */
export function resolveQuoteUnitPrice(
  product: QuotePriceableProduct,
  quantity: number,
  currency: QuoteCurrency,
  market: QuoteMarket = currency === "EUR" ? "PT" : "AO",
): number | null {
  if (!Number.isInteger(quantity) || quantity < 1) return null;

  let applicableRule: QuotePriceableProduct["b2bPriceRules"][number] | null = null;
  for (const rule of product.b2bPriceRules) {
    if (
      rule.currency === currency &&
      rule.minQuantity <= quantity &&
      (!applicableRule || rule.minQuantity > applicableRule.minQuantity)
    ) {
      applicableRule = rule;
    }
  }
  if (applicableRule) {
    const amount = Number(applicableRule.unitPrice);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }

  const marketPrice = product.prices.find(
    (price) =>
      price.currency === currency &&
      (price.market === undefined || price.market === market),
  );
  if (marketPrice) {
    const amount = Number(marketPrice.amount);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }

  if (currency === "EUR" && market === "PT") {
    const basePrice = Number(product.basePrice);
    return Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : null;
  }
  return null;
}
