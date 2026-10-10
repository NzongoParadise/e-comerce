import assert from "node:assert/strict";
import test from "node:test";
import { resolveQuoteUnitPrice } from "./quotePricing";

test("uses the highest applicable price tier in the selected currency", () => {
  const product = {
    basePrice: 100,
    prices: [],
    b2bPriceRules: [
      { minQuantity: 10, unitPrice: 80, currency: "EUR" },
      { minQuantity: 1, unitPrice: 90, currency: "EUR" },
      { minQuantity: 1, unitPrice: 9000, currency: "AOA" },
    ],
  };

  assert.equal(resolveQuoteUnitPrice(product, 12, "EUR"), 80);
  assert.equal(resolveQuoteUnitPrice(product, 5, "EUR"), 90);
  assert.equal(resolveQuoteUnitPrice(product, 12, "AOA"), 9000);
});

test("uses a catalog price and only falls back to base price for EUR", () => {
  const product = {
    basePrice: "12.50",
    prices: [{ amount: "14000", currency: "AOA" }],
    b2bPriceRules: [],
  };

  assert.equal(resolveQuoteUnitPrice(product, 1, "EUR"), 12.5);
  assert.equal(resolveQuoteUnitPrice(product, 1, "AOA"), 14000);
  assert.equal(
    resolveQuoteUnitPrice(
      { ...product, prices: [] },
      1,
      "AOA",
    ),
    null,
  );
});
