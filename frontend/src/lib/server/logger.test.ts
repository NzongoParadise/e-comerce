import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeForLog } from './logger';

test('redacts secret values from log payloads', () => {
  const payload = sanitizeForLog({
    stripeSecretKey: 'sk_live_123',
    nested: { stripeWebhookSecret: 'whsec_456', ok: true },
    publicValue: 'visible',
  });

  assert.deepEqual(payload, {
    stripeSecretKey: '[REDACTED]',
    nested: { stripeWebhookSecret: '[REDACTED]', ok: true },
    publicValue: 'visible',
  });
});
