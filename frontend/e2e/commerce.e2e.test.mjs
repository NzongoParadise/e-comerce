import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const baseURL = process.env.E2E_BASE_URL ? new URL(process.env.E2E_BASE_URL) : null;
const state = { poId: null, companyMarket: null, returnId: null };
const enabled = (name) => ["1", "true", "yes"].includes((process.env[name] || "").toLowerCase());
const value = (name) => process.env[name]?.trim() || "";
const intEnv = (name) => {
  const number = Number(value(name));
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

function safeTarget(mutate = false) {
  assert.ok(baseURL, "Define E2E_BASE_URL.");
  assert.ok(["http:", "https:"].includes(baseURL.protocol), "E2E_BASE_URL must use HTTP or HTTPS.");
  assert.ok(!baseURL.username && !baseURL.password, "Do not embed credentials in E2E_BASE_URL.");
  if (!mutate) return;
  const host = baseURL.hostname.toLowerCase();
  const allowlist = value("E2E_MUTATION_ALLOWED_HOSTS").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  assert.ok(local || allowlist.includes(host),
    "Mutating E2E tests blocked for " + host + ". Allowlist only the staging hostname in E2E_MUTATION_ALLOWED_HOSTS.");
  assert.ok(!/e-comerce-sepia\.vercel\.app|git-master|production/i.test(host), "Production-like hostname refused: " + host);
}

function requireEnv(...names) {
  const missing = names.filter((name) => !value(name));
  assert.deepEqual(missing, [], "Missing E2E variables: " + missing.join(", "));
}

async function call(path, options = {}) {
  safeTarget();
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});
  if (options.accessToken) headers.set("Authorization", "Bearer " + options.accessToken);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(new URL(path, baseURL), {
    method,
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    redirect: "follow",
    signal: AbortSignal.timeout(options.timeoutMs || 25000),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 500) }; }
  return { status: response.status, data, url: response.url };
}

function expectStatus(result, accepted, label) {
  assert.ok(accepted.includes(result.status), label + ": expected HTTP " + accepted.join("/") +
    " but received " + result.status + "; response=" + JSON.stringify(result.data).slice(0, 900));
}

async function findProduct(productId, market, accessToken) {
  let pageCount = 1;
  for (let page = 1; page <= Math.min(pageCount, 30); page += 1) {
    const result = await call("/api/products?page=" + page + "&pageSize=48&market=" + market, { accessToken });
    expectStatus(result, [200], "Catalog " + market + " page " + page);
    assert.ok(Array.isArray(result.data?.data), "Catalog API must return data as an array.");
    pageCount = Number(result.data?.meta?.pageCount || 1);
    const product = result.data.data.find((item) => Number(item.id) === productId);
    if (product) return product;
  }
  throw new Error("E2E product " + productId + " not found for market " + market + ".");
}

async function ownOrder(orderId, accessToken) {
  const result = await call("/api/orders", { accessToken });
  expectStatus(result, [200], "List orders for test customer");
  const rows = Array.isArray(result.data?.data) ? result.data.data : Array.isArray(result.data) ? result.data : [];
  const order = rows.find((item) => Number(item.id) === Number(orderId));
  assert.ok(order, "Order " + orderId + " not found under the configured B2C token.");
  return order;
}

async function createB2COrder(country, productId) {
  safeTarget(true);
  requireEnv("E2E_B2C_TOKEN");
  const product = await findProduct(productId, country, value("E2E_B2C_TOKEN"));
  const currency = country === "PT" ? "EUR" : "AOA";
  const configuredPrice = product.prices?.find((price) => price.market === country && price.currency === currency)?.amount;
  const unitPrice = configuredPrice === undefined && country === "PT" ? Number(product.basePrice) : Number(configuredPrice);
  assert.ok(Number.isFinite(unitPrice) && unitPrice > 0, "Product " + productId + " has no valid price for " + country + ".");
  const key = "e2e-order-" + country.toLowerCase() + "-" + randomUUID();
  const body = {
    items: [{
      productId: Number(product.id),
      name: product.name,
      slug: product.slug,
      ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      priceEUR: country === "PT" ? unitPrice : Number(product.basePrice) || 0,
      priceKZ: country === "AO" ? unitPrice : 0,
      quantity: 1,
    }],
    country,
    currency,
    deliveryMode: "pickup",
    shippingMethod: "pickup",
    paymentMethod: country === "PT" ? "card" : "multicaixa_reference",
    billingName: "Cliente E2E",
    billingEmail: value("E2E_B2C_EMAIL") || "e2e-customer@example.invalid",
  };
  const orderResponse = await call("/api/orders", {
    method: "POST",
    accessToken: value("E2E_B2C_TOKEN"),
    headers: { "Idempotency-Key": key },
    body,
    timeoutMs: 45000,
  });
  expectStatus(orderResponse, [201], "Create B2C order " + country);
  const order = orderResponse.data?.data;
  assert.ok(Number(order?.id) > 0, "Create-order API did not return an order ID.");

  const replay = await call("/api/orders", {
    method: "POST",
    accessToken: value("E2E_B2C_TOKEN"),
    headers: { "Idempotency-Key": key },
    body,
    timeoutMs: 45000,
  });
  expectStatus(replay, [200, 201], "Replay B2C order " + country);
  assert.equal(Number(replay.data?.data?.id), Number(order.id), "Order idempotency created a duplicate.");

  if (country === "PT") {
    assert.ok(typeof order.checkoutUrl === "string" && /stripe\.com/i.test(order.checkoutUrl), "Stripe Checkout URL missing.");
    return Number(order.id);
  }

  const paymentBody = { orderId: Number(order.id), method: "MULTICAIXA_REFERENCE", idempotencyKey: "e2e-mc-" + randomUUID() };
  const payment = await call("/api/payments", { method: "POST", accessToken: value("E2E_B2C_TOKEN"), body: paymentBody, timeoutMs: 45000 });
  expectStatus(payment, [201], "Start B2C MULTICAIXA reference payment");
  assert.ok(payment.data?.data?.id, "MULTICAIXA payment ID missing.");
  assert.ok(payment.data.data.referenceNumber || payment.data.data.entity || payment.data.data.status === "PAID",
    "MULTICAIXA reference/entity or paid status missing.");
  const repeatPayment = await call("/api/payments", { method: "POST", accessToken: value("E2E_B2C_TOKEN"), body: paymentBody, timeoutMs: 45000 });
  expectStatus(repeatPayment, [200], "Replay MULTICAIXA payment request");
  assert.equal(Number(repeatPayment.data?.data?.id), Number(payment.data.data.id), "MULTICAIXA replay created a duplicate payment.");
  return Number(order.id);
}

test("Black-box smoke: storefront pages and public catalog respond without 404/5xx", {
  skip: !baseURL ? "Set E2E_BASE_URL to run HTTP smoke tests." : false,
}, async (t) => {
  safeTarget();
  for (const path of ["/", "/products", "/cart", "/checkout", "/b2b/catalogo", "/b2b/cotacoes", "/b2b/encomendas", "/account/returns", "/admin/returns", "/admin/reviews"]) {
    await t.test("GET " + path, async () => {
      const result = await call(path);
      assert.ok(result.status < 500, path + " returned HTTP " + result.status);
      assert.notEqual(result.status, 404, path + " does not exist.");
    });
  }
  const catalog = await call("/api/products?page=1&pageSize=6&market=PT");
  expectStatus(catalog, [200], "Public product catalog");
  assert.ok(Array.isArray(catalog.data?.data), "Public product catalog data must be an array.");
});

test("Security: private APIs reject unauthenticated calls", {
  skip: !baseURL ? "Set E2E_BASE_URL to run HTTP smoke tests." : false,
}, async () => {
  for (const path of ["/api/orders", "/api/b2b/quotes", "/api/b2b/purchase-orders", "/api/notifications",
    "/api/admin/finance/invoices", "/api/admin/finance/refunds", "/api/admin/returns"]) {
    const result = await call(path);
    assert.ok([401, 403].includes(result.status), path + " accepted an anonymous request: HTTP " + result.status);
  }
});

test("RBAC: B2C, BUYER and OWNER cannot perform another role's operations", {
  skip: !baseURL || !value("E2E_B2C_TOKEN") || !value("E2E_B2B_BUYER_TOKEN") || !value("E2E_B2B_OWNER_TOKEN")
    ? "Configure B2C, B2B BUYER and B2B OWNER tokens." : false,
}, async () => {
  expectStatus(await call("/api/b2b/quotes", { accessToken: value("E2E_B2C_TOKEN") }), [401, 403], "B2C quote access");
  const buyer = await call("/api/b2b/payments/checkout", {
    method: "POST",
    accessToken: value("E2E_B2B_BUYER_TOKEN"),
    body: { poId: intEnv("E2E_B2B_PO_ID") || 1, idempotencyKey: "e2e-rbac-" + randomUUID() },
  });
  expectStatus(buyer, [403], "BUYER payment permission");
  const owner = await call("/api/admin/b2b/quotes", {
    method: "PATCH",
    accessToken: value("E2E_B2B_OWNER_TOKEN"),
    body: { quoteId: 1, action: "APPROVE", note: "E2E RBAC attempt." },
  });
  expectStatus(owner, [401, 403], "OWNER Admin-only permission");
  const b2cRefund = await call("/api/admin/finance/refunds", {
    method: "POST",
    accessToken: value("E2E_B2C_TOKEN"),
    headers: { "Idempotency-Key": "e2e-rbac-refund-" + randomUUID() },
    body: { orderId: 1, amount: 1, reason: "E2E RBAC attempt." },
  });
  expectStatus(b2cRefund, [401, 403], "B2C administrative refund permission");
});

test("B2B: quote, Admin approval, Purchase Order and idempotent order conversion", {
  skip: !baseURL || !enabled("E2E_ENABLE_MUTATIONS") ? "Enable E2E_ENABLE_MUTATIONS only for staging." : false,
}, async () => {
  safeTarget(true);
  requireEnv("E2E_B2B_OWNER_TOKEN", "E2E_ADMIN_TOKEN", "E2E_B2B_PRODUCT_ID");
  const ownerToken = value("E2E_B2B_OWNER_TOKEN");
  const catalog = await call("/api/b2b/catalog?page=1&pageSize=48", { accessToken: ownerToken });
  expectStatus(catalog, [200], "B2B catalog");
  state.companyMarket = catalog.data?.companyMarket;
  assert.ok(["AO", "PT"].includes(state.companyMarket), "The B2B company has no valid fiscal market.");
  const productId = id("E2E_B2B_PRODUCT_ID");
  assert.ok(catalog.data?.data?.some((item) => Number(item.id) === productId), "Configured B2B test product is unavailable.");
  const quote = await call("/api/b2b/quotes", {
    method: "POST",
    accessToken: ownerToken,
    body: { items: [{ productId, quantity: Number(value("E2E_B2B_QUANTITY") || 1) }], notes: "E2E quote " + new Date().toISOString() },
  });
  expectStatus(quote, [201], "Create B2B quote");
  const quoteId = Number(quote.data?.data?.id);
  assert.ok(quoteId > 0, "Quote ID missing.");
  const approval = await call("/api/admin/b2b/quotes", {
    method: "PATCH",
    accessToken: value("E2E_ADMIN_TOKEN"),
    body: { quoteId, action: "APPROVE", note: "Approved by staging E2E." },
  });
  expectStatus(approval, [200], "Admin approval");
  const poId = Number(approval.data?.data?.purchaseOrder?.id);
  assert.ok(poId > 0, "Admin approval did not create a Purchase Order.");
  state.poId = poId;
  const converted = await call("/api/b2b/purchase-orders/convert?id=" + poId, { method: "POST", accessToken: ownerToken });
  expectStatus(converted, [201], "Convert Purchase Order");
  const orderId = Number(converted.data?.data?.order?.id);
  assert.ok(orderId > 0 && Number(converted.data.data.order.companyId) > 0, "Converted order is not associated with a company.");
  const replay = await call("/api/b2b/purchase-orders/convert?id=" + poId, { method: "POST", accessToken: ownerToken });
  expectStatus(replay, [201], "Replay Purchase Order conversion");
  assert.equal(Number(replay.data?.data?.order?.id), orderId, "PO conversion created a duplicate order.");
  const list = await call("/api/b2b/purchase-orders", { accessToken: ownerToken });
  expectStatus(list, [200], "List company Purchase Orders");
  const stored = list.data?.data?.find((item) => Number(item.id) === poId);
  assert.ok(stored, "Purchase Order missing from the company's own list.");
  assert.equal(stored.status, "CONVERTED");
  assert.equal(Number(stored.orderId), orderId);
});

test("B2B: owner initiates gateway payment for the company's fiscal market", {
  skip: !baseURL || !enabled("E2E_ENABLE_GATEWAY_TESTS") ? "Enable gateway tests only with sandbox provider credentials." : false,
}, async () => {
  safeTarget(true);
  requireEnv("E2E_B2B_OWNER_TOKEN");
  assert.ok(state.poId, "The B2B quote/PO journey must pass before testing payment.");
  const market = state.companyMarket;
  const method = value("E2E_B2B_PAYMENT_METHOD") || (market === "PT" ? "STRIPE_CHECKOUT" : "MULTICAIXA_REFERENCE");
  const result = await call("/api/b2b/payments/checkout", {
    method: "POST",
    accessToken: value("E2E_B2B_OWNER_TOKEN"),
    timeoutMs: 45000,
    body: { poId: state.poId, idempotencyKey: "e2e-b2b-payment-" + randomUUID(), method,
      ...(method === "MULTICAIXA_EXPRESS" && value("E2E_TEST_PHONE_NUMBER") ? { phoneNumber: value("E2E_TEST_PHONE_NUMBER") } : {}) },
  });
  expectStatus(result, [200, 201], "Start B2B gateway payment " + method);
  assert.ok(result.data?.data?.payment?.id, "B2B payment ID missing.");
  if (method === "STRIPE_CHECKOUT") assert.ok(/stripe\.com/i.test(result.data?.data?.checkoutUrl || ""), "Stripe Checkout URL missing.");
  else if (result.data.data.payment.status !== "PAID") assert.ok(result.data.data.payment.entity || result.data.data.payment.referenceNumber, "MULTICAIXA reference/entity missing.");
});

for (const country of ["PT", "AO"]) {
  test("B2C " + country + ": order checkout, payment initiation and idempotency", {
    skip: !baseURL || !enabled("E2E_ENABLE_GATEWAY_TESTS") || !value("E2E_B2C_TOKEN") || !id("E2E_PRODUCT_ID_" + country)
      ? "Configure gateway sandbox, E2E_B2C_TOKEN and E2E_PRODUCT_ID_" + country + "." : false,
  }, async () => {
    const orderId = await createB2COrder(country, id("E2E_PRODUCT_ID_" + country));
    assert.ok(orderId > 0);
  });
}

test("Inventory expiry: reconcile only the explicitly seeded expired order", {
  skip: !baseURL || !enabled("E2E_ENABLE_MUTATIONS") || !value("E2E_CRON_SECRET") || !id("E2E_EXPIRED_ORDER_ID")
    ? "Configure E2E_CRON_SECRET and E2E_EXPIRED_ORDER_ID for an expired staging reservation." : false,
}, async () => {
  safeTarget(true);
  const result = await call("/api/cron/release-expired-inventory?orderId=" + id("E2E_EXPIRED_ORDER_ID"), {
    method: "POST", headers: { Authorization: "Bearer " + value("E2E_CRON_SECRET") }, timeoutMs: 45000,
  });
  expectStatus(result, [200], "Targeted expired inventory reconciliation");
  assert.equal(Number(result.data?.data?.scanned), 1, "Cron must inspect exactly the target order.");
  assert.equal(Number(result.data?.data?.failed), 0, "Target reservation cleanup failed.");
});

test("After-sales: create return and traverse auditable states", {
  skip: !baseURL || !enabled("E2E_ENABLE_MUTATIONS") || !value("E2E_B2C_TOKEN") || !value("E2E_ADMIN_TOKEN") || !id("E2E_RETURN_ORDER_ID")
    ? "Configure B2C/Admin tokens and E2E_RETURN_ORDER_ID for a paid staging order." : false,
}, async () => {
  safeTarget(true);
  const created = await call("/api/returns", {
    method: "POST",
    accessToken: value("E2E_B2C_TOKEN"),
    body: { orderId: id("E2E_RETURN_ORDER_ID"), type: "RETURN", reason: "E2E return " + new Date().toISOString(), description: "Staging E2E return." },
  });
  expectStatus(created, [201], "Create return request");
  state.returnId = Number(created.data?.data?.id);
  assert.ok(state.returnId > 0, "Return request ID missing.");
  for (const item of [
    ["UNDER_REVIEW", "E2E review started."],
    ["APPROVED", "Return eligibility confirmed."],
    ["WAITING_FOR_RETURN", "Waiting for the item."],
    ["ITEM_RECEIVED", "Test item received."],
  ]) {
    const updated = await call("/api/admin/returns", {
      method: "PATCH",
      accessToken: value("E2E_ADMIN_TOKEN"),
      body: { id: state.returnId, status: item[0], note: item[1] },
    });
    expectStatus(updated, [200], "Return transition to " + item[0]);
    assert.equal(updated.data?.data?.status, item[0]);
  }
  const history = await call("/api/returns", { accessToken: value("E2E_B2C_TOKEN") });
  expectStatus(history, [200], "Customer return history");
  const stored = history.data?.data?.find((item) => Number(item.id) === state.returnId);
  assert.ok(stored, "Return request missing from its owner's history.");
  assert.equal(stored.status, "ITEM_RECEIVED");
  assert.ok(Array.isArray(stored.events) && stored.events.length >= 5, "Audit history does not include every transition.");
});

test("Invoice: verify or issue invoice for a paid test order", {
  skip: !baseURL || !enabled("E2E_ENABLE_MUTATIONS") || !value("E2E_ADMIN_TOKEN") || !id("E2E_PAID_ORDER_ID")
    ? "Configure E2E_ENABLE_MUTATIONS, E2E_ADMIN_TOKEN and E2E_PAID_ORDER_ID." : false,
}, async () => {
  safeTarget(true);
  const orderId = id("E2E_PAID_ORDER_ID");
  const listed = await call("/api/admin/finance/invoices?orderId=" + orderId, { accessToken: value("E2E_ADMIN_TOKEN") });
  expectStatus(listed, [200], "Get order invoice");
  if (!Array.isArray(listed.data?.data) || !listed.data.data.length) {
    const issued = await call("/api/admin/finance/invoices", { method: "POST", accessToken: value("E2E_ADMIN_TOKEN"), body: { orderId } });
    expectStatus(issued, [200, 201], "Issue idempotent invoice");
    assert.ok(issued.data?.data?.invoiceNumber, "Invoice number was not returned.");
  }
  const verify = await call("/api/admin/finance/invoices?orderId=" + orderId, { accessToken: value("E2E_ADMIN_TOKEN") });
  expectStatus(verify, [200], "Verify issued invoice");
  assert.ok(verify.data?.data?.some((invoice) => Number(invoice.orderId) === orderId), "Paid order has no invoice.");
});

test("Partial refund: available balance, idempotency and conflicting key are enforced", {
  skip: !baseURL || !enabled("E2E_ENABLE_REFUND_TESTS") || !enabled("E2E_ENABLE_MUTATIONS") ||
    !value("E2E_ADMIN_TOKEN") || !id("E2E_PAID_ORDER_ID") || !value("E2E_REFUND_AMOUNT")
    ? "Configure an eligible sandbox order and enable E2E refund mutations." : false,
}, async () => {
  safeTarget(true); requireEnv("E2E_B2C_TOKEN", "E2E_ADMIN_TOKEN", "E2E_REFUND_AMOUNT");
  const orderId = id("E2E_PAID_ORDER_ID");
  const order = await ownOrder(orderId, value("E2E_B2C_TOKEN"));
  const currency = order.currency || (order.country === "PT" ? "EUR" : "AOA");
  const total = currency === "EUR" ? Number(order.totalEUR) : Number(order.totalKZ);
  const amount = Number(value("E2E_REFUND_AMOUNT"));
  assert.ok(Number.isFinite(total) && total > 0, "Original order total is invalid.");
  assert.ok(Number.isFinite(amount) && amount > 0 && amount < total, "E2E_REFUND_AMOUNT must be less than the original total.");

  const key = "e2e-refund-" + randomUUID();
  const returnRequestId = state.returnId && id("E2E_RETURN_ORDER_ID") === orderId ? state.returnId : undefined;
  const body = { orderId, amount, reason: "Partial refund E2E in staging.", ...(returnRequestId ? { returnRequestId } : {}) };
  const refund = await call("/api/admin/finance/refunds", {
    method: "POST", accessToken: value("E2E_ADMIN_TOKEN"), headers: { "Idempotency-Key": key }, body, timeoutMs: 45000,
  });
  expectStatus(refund, [200, 201], "Create partial refund");
  const refundId = Number(refund.data?.data?.id);
  assert.ok(refundId > 0, "Refund ID missing.");
  const storedAmount = currency === "EUR" ? Number(refund.data.data.amountEUR) : Number(refund.data.data.amountKZ);
  assert.ok(Math.abs(storedAmount - amount) < 0.011, "Stored refund amount differs from requested amount.");

  const replay = await call("/api/admin/finance/refunds", {
    method: "POST", accessToken: value("E2E_ADMIN_TOKEN"), headers: { "Idempotency-Key": key }, body, timeoutMs: 45000,
  });
  expectStatus(replay, [200, 201], "Replay partial refund");
  assert.equal(Number(replay.data?.data?.id), refundId, "Same idempotency key created a duplicate refund.");
  const conflict = await call("/api/admin/finance/refunds", {
    method: "POST", accessToken: value("E2E_ADMIN_TOKEN"), headers: { "Idempotency-Key": key }, body: { ...body, amount: amount + 0.01 },
  });
  expectStatus(conflict, [409], "Same idempotency key with a different amount");
  const excessive = await call("/api/admin/finance/refunds", {
    method: "POST", accessToken: value("E2E_ADMIN_TOKEN"), headers: { "Idempotency-Key": "e2e-refund-over-" + randomUUID() },
    body: { orderId, amount: total + 1, reason: body.reason },
  });
  expectStatus(excessive, [422], "Refund above remaining balance");
});

test("Full E2E configuration cannot silently pass with missing fixtures", {
  skip: !enabled("E2E_REQUIRE_FULL_RUN") ? "Enable E2E_REQUIRE_FULL_RUN in the dedicated staging workflow." : false,
}, () => {
  const required = ["E2E_BASE_URL", "E2E_MUTATION_ALLOWED_HOSTS", "E2E_B2C_TOKEN", "E2E_B2B_OWNER_TOKEN", "E2E_B2B_BUYER_TOKEN",
    "E2E_ADMIN_TOKEN", "E2E_PRODUCT_ID_PT", "E2E_PRODUCT_ID_AO", "E2E_B2B_PRODUCT_ID", "E2E_PAID_ORDER_ID",
    "E2E_RETURN_ORDER_ID", "E2E_EXPIRED_ORDER_ID", "E2E_CRON_SECRET", "E2E_REFUND_AMOUNT"];
  const missing = required.filter((name) => !value(name));
  assert.deepEqual(missing, [], "Full E2E run is missing: " + missing.join(", "));
  assert.ok(enabled("E2E_ENABLE_MUTATIONS"), "E2E_ENABLE_MUTATIONS=true required.");
  assert.ok(enabled("E2E_ENABLE_GATEWAY_TESTS"), "E2E_ENABLE_GATEWAY_TESTS=true required.");
  assert.ok(enabled("E2E_ENABLE_REFUND_TESTS"), "E2E_ENABLE_REFUND_TESTS=true required.");
  safeTarget(true);
});
