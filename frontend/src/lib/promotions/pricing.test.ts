import assert from "node:assert/strict";
import test from "node:test";
import { getPromotionalUnitPrice, type PromotionPriceCampaign } from "./pricing";

const product = { id: 12, categoryId: 4, brandId: 3 };

function campaign(overrides: Partial<PromotionPriceCampaign> = {}): PromotionPriceCampaign {
  return {
    id: 1,
    name: "Test offer",
    description: null,
    code: null,
    startAt: "2026-10-04T00:00:00.000Z",
    endAt: null,
    priority: 100,
    exclusive: false,
    stackable: true,
    perCustomerLimit: null,
    minOrderAOA: null,
    minOrderEUR: null,
    actions: [{ type: "PERCENTAGE", value: 10, maxDiscount: null }],
    rules: [],
    products: [{ productId: product.id }],
    categories: [],
    brands: [],
    ...overrides,
  };
}

test("calculates the promotional unit price for an eligible product", () => {
  const result = getPromotionalUnitPrice(product, "AO", 155000, [campaign()]);
  assert.equal(result?.regularPrice, 155000);
  assert.equal(result?.promotionalPrice, 139500);
});

test("does not show a discount for a product outside campaign targets", () => {
  assert.equal(getPromotionalUnitPrice({ ...product, id: 99 }, "AO", 155000, [campaign()]), null);
});

test("respects market and minimum-order campaign conditions", () => {
  assert.equal(getPromotionalUnitPrice(product, "PT", 159, [campaign({ minOrderEUR: 200 })]), null);
  assert.equal(getPromotionalUnitPrice(product, "PT", 159, [campaign({ rules: [{ kind: "MARKET", operator: "EQ", value: "AO" }] })]), null);
});

test("does not advertise coupon-only or customer-dependent offers as automatic prices", () => {
  assert.equal(getPromotionalUnitPrice(product, "AO", 155000, [campaign({ code: "PROMO10" })]), null);
  assert.equal(getPromotionalUnitPrice(product, "AO", 155000, [campaign({ rules: [{ kind: "FIRST_ORDER", operator: "EQ", value: "true" }] })]), null);
});

test("applies a fixed-price action and respects percentage discount caps", () => {
  const fixedPrice = getPromotionalUnitPrice(product, "PT", 159, [campaign({
    actions: [{ type: "FIXED_PRICE", value: 120, maxDiscount: null }],
  })]);
  const capped = getPromotionalUnitPrice(product, "PT", 159, [campaign({
    actions: [{ type: "PERCENTAGE", value: 20, maxDiscount: 10 }],
  })]);
  assert.equal(fixedPrice?.promotionalPrice, 120);
  assert.equal(capped?.promotionalPrice, 149);
});
