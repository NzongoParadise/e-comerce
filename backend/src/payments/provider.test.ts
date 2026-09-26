import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { MulticaixaProvider } from './multicaixaProvider';
import { normalizePaymentStatus } from './multicaixaProvider';

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