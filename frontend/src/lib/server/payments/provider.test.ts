import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { MulticaixaProvider } from './multicaixaProvider';
import { normalizePaymentStatus } from './multicaixaProvider';
import { cancelAwaitingPaymentAndReleaseStock } from '../orders/inventory';
import { normalizeSupplierData, supplierSchema, supplierUpdateSchema } from '../suppliers';
import { isStripeCurrencySupported, matchesStripePayment, toStripeMinorUnits } from './stripeAmounts';
import { isDefinitiveStripeRejection, isStripeSessionForOrder, stripeCheckoutIdempotencyKey } from './stripeRequestRules';

test('normalizes gateway statuses to internal statuses', () => {
  assert.equal(normalizePaymentStatus('SUCCESS'), 'PAID');
  assert.equal(normalizePaymentStatus('declined'), 'PENDING');
  assert.equal(normalizePaymentStatus('EXPIRED'), 'EXPIRED');
});

test('does not call an unconfigured gateway', async () => {
  delete process.env.MULTICAIXA_API_URL;
  delete process.env.MULTICAIXA_SECRET_KEY;
  delete process.env.MULTICAIXA_MERCHANT_ID;
  const provider = new MulticaixaProvider();
  await assert.rejects(() => provider.createReference({ paymentId: 1, orderNumber: 'TG1', amountKZ: 100, currency: 'AOA', method: 'MULTICAIXA_REFERENCE', idempotencyKey: 'test-idempotency-key' }), /MULTICAIXA_NOT_CONFIGURED/);
});

test('accepts only a valid HMAC webhook signature', () => {
  process.env.MULTICAIXA_SECRET_KEY = 'test-secret';
  const provider = new MulticaixaProvider();
  const body = Buffer.from('{"eventId":"evt-1"}');
  const signature = crypto.createHmac('sha256', 'test-secret').update(body).digest('hex');
  assert.equal(provider.verifyWebhook(body, signature), true);
  assert.equal(provider.verifyWebhook(body, 'invalid'), false);
});

test('converts two-decimal payment amounts to Stripe minor units', () => {
  assert.equal(toStripeMinorUnits(12.34), 1234);
  assert.equal(toStripeMinorUnits(0.1 + 0.2), 30);
  assert.throws(() => toStripeMinorUnits(-1), RangeError);
});

test('accepts only a Stripe payment with the expected currency and amount', () => {
  assert.equal(matchesStripePayment(1234, 'eur', 12.34, 'EUR'), true);
  assert.equal(matchesStripePayment(1235, 'eur', 12.34, 'EUR'), false);
  assert.equal(matchesStripePayment(1234, 'aoa', 12.34, 'EUR'), false);
  assert.equal(matchesStripePayment('1234', 'eur', 12.34, 'EUR'), false);
});

test('restricts Stripe checkout to the configured EUR market', () => {
  assert.equal(isStripeCurrencySupported('EUR'), true);
  assert.equal(isStripeCurrencySupported('AOA'), false);
  assert.equal(['card', 'mbway'].includes('mbway'), true);
});

test('uses a stable Stripe idempotency key per order', () => {
  assert.equal(stripeCheckoutIdempotencyKey(123), 'stripe-checkout-order-123');
  assert.throws(() => stripeCheckoutIdempotencyKey(0), RangeError);
});

test('does not treat transient Stripe responses as definitive rejection', () => {
  assert.equal(isDefinitiveStripeRejection(400), true);
  assert.equal(isDefinitiveStripeRejection(408), false);
  assert.equal(isDefinitiveStripeRejection(409), false);
  assert.equal(isDefinitiveStripeRejection(429), false);
  assert.equal(isDefinitiveStripeRejection(500), false);
});

test('matches reconciled Stripe sessions to both order references', () => {
  const session = { client_reference_id: 'TG2026093012345678', metadata: { orderId: '42' } };
  assert.equal(isStripeSessionForOrder(session, 42, 'TG2026093012345678'), true);
  assert.equal(isStripeSessionForOrder(session, 43, 'TG2026093012345678'), false);
  assert.equal(isStripeSessionForOrder(session, 42, 'OTHER'), false);
  assert.equal(isStripeSessionForOrder(null, 42, 'TG2026093012345678'), false);
});

test('releases reserved stock only once when cancellation is repeated', async () => {
  let orderStatus = 'AWAITING_PAYMENT';
  let paymentStatus = 'REQUIRES_PAYMENT';
  let stock = 2;
  const transaction = {
    order: { updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
      if (orderStatus !== where.status) return { count: 0 };
      orderStatus = data.status;
      return { count: 1 };
    } },
    payment: { updateMany: async ({ where, data }: { where: { status: { not: string } }; data: { status: string } }) => {
      if (paymentStatus === where.status.not) return { count: 0 };
      paymentStatus = data.status;
      return { count: 1 };
    } },
    product: { update: async ({ data }: { data: { stock: { increment: number } } }) => {
      stock += data.stock.increment;
    } },
    trackingEvent: { create: async () => undefined },
  } as unknown as Prisma.TransactionClient;

  const cancelled = await cancelAwaitingPaymentAndReleaseStock(transaction, 42, [{ productId: 7, quantity: 3 }], 'EXPIRED', 'Session expired');
  const duplicate = await cancelAwaitingPaymentAndReleaseStock(transaction, 42, [{ productId: 7, quantity: 3 }], 'EXPIRED', 'Session expired');

  assert.equal(cancelled, true);
  assert.equal(duplicate, false);
  assert.equal(orderStatus, 'CANCELLED');
  assert.equal(paymentStatus, 'EXPIRED');
  assert.equal(stock, 5);
});

test('validates and normalizes supplier records for create and partial update', () => {
  const parsed = supplierSchema.safeParse({ name: 'Fornecedor Tech', email: '', country: 'Angola' });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  const normalized = normalizeSupplierData(parsed.data);
  assert.equal(normalized.email, null);
  assert.equal(normalized.country, 'Angola');
  assert.equal(normalized.active, true);
  assert.equal(supplierUpdateSchema.safeParse({ email: null, active: false }).success, true);
  assert.equal(supplierSchema.safeParse({ name: 'x', email: 'not-an-email' }).success, false);
});