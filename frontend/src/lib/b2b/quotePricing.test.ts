import assert from "node:assert/strict";
import test from "node:test";
import { resolveQuoteUnitPrice } from "./quotePricing";

test("uses the highest applicable B2B tier in the selected currency", () => {
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

test("uses the catalog price for the selected market and currency", () => {
  const product = {
    basePrice: "12.50",
    prices: [
      { amount: "14000", currency: "AOA", market: "AO" },
      { amount: "15.00", currency: "EUR", market: "PT" },
      { amount: "16000", currency: "AOA", market: "PT" },
    ],
    b2bPriceRules: [],
  };

  assert.equal(resolveQuoteUnitPrice(product, 1, "AOA", "AO"), 14000);
  assert.equal(resolveQuoteUnitPrice(product, 1, "AOA", "PT"), 16000);
  assert.equal(resolveQuoteUnitPrice(product, 1, "EUR", "PT"), 15);
  assert.equal(resolveQuoteUnitPrice(product, 1, "EUR", "AO"), null);
});

test("uses the legacy base price only for Portugal EUR and permits unpriced RFQs", () => {
  const product = {
    basePrice: "12.50",
    prices: [],
    b2bPriceRules: [],
  };

  assert.equal(resolveQuoteUnitPrice(product, 1, "EUR", "PT"), 12.5);
  assert.equal(resolveQuoteUnitPrice(product, 1, "EUR", "AO"), null);
  assert.equal(resolveQuoteUnitPrice(product, 1, "AOA", "AO"), null);
  assert.equal(resolveQuoteUnitPrice(product, 0, "EUR", "PT"), null);
  assert.equal(resolveQuoteUnitPrice(product, 1.5, "EUR", "PT"), null);
});

test("does not treat a malformed catalog price as a valid price", () => {
  const product = {
    basePrice: "not-a-price",
    prices: [{ amount: "invalid", currency: "AOA", market: "AO" }],
    b2bPriceRules: [],
  };
  assert.equal(resolveQuoteUnitPrice(product, 1, "AOA", "AO"), null);
  assert.equal(resolveQuoteUnitPrice(product, 1, "EUR", "PT"), null);
});
