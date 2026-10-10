export type QuoteCurrency = "AOA" | "EUR";
export type QuotePriceValue = number | string | { toString(): string };

export type QuotePriceableProduct = {
  basePrice: QuotePriceValue;
  prices: Array<{ amount: QuotePriceValue; currency: string }>;
  b2bPriceRules: Array<{
    minQuantity: number;
    unitPrice: QuotePriceValue;
    currency: string;
  }>;
};

export function resolveQuoteUnitPrice(
  product: QuotePriceableProduct,
  quantity: number,
  currency: QuoteCurrency,
): number | null {
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
  if (applicableRule) return Number(applicableRule.unitPrice);

  const marketPrice = product.prices.find((price) => price.currency === currency);
  if (marketPrice) return Number(marketPrice.amount);
  return currency === "EUR" ? Number(product.basePrice) : null;
}
