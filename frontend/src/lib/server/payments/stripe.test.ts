import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { toMinorUnit, verifyStripeWebhookSignature, stripePaymentIdempotencyKey } from './stripe';

test('converts EUR amounts to integer minor units', () => {
  assert.equal(toMinorUnit(100), 10000);
  assert.equal(toMinorUnit(10.99), 1099);
});

test('rejects invalid monetary amounts', () => {
  assert.throws(() => toMinorUnit(-1), RangeError);
  assert.throws(() => toMinorUnit(Number.NaN), RangeError);
});

test('creates deterministic PaymentIntent idempotency key per order', () => {
  assert.equal(stripePaymentIdempotencyKey(25), 'payment-intent-order-25');
  assert.equal(stripePaymentIdempotencyKey(25), stripePaymentIdempotencyKey(25));
});

test('verifies Stripe webhook signature and rejects stale/tampered payloads', () => {
  const secret = 'whsec_test_secret';
  const payload = JSON.stringify({ id: 'evt_test', type: 'payment_intent.succeeded' });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp},v1=${signature}`, secret), true);
  assert.equal(verifyStripeWebhookSignature(payload + 'x', `t=${timestamp},v1=${signature}`, secret), false);
  assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp - 301},v1=${signature}`, secret), false);
});
