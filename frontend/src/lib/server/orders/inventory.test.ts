import assert from 'node:assert/strict';
import test from 'node:test';
import {
  B2B_STOCK_RESERVATION_DURATION_MS,
  getB2BStockReservationExpiry,
} from './inventory';

test('B2B stock reservations expire 24 hours after order creation', () => {
  const createdAt = new Date('2026-10-10T12:00:00.000Z');
  const expiresAt = getB2BStockReservationExpiry(createdAt, null);

  assert.equal(B2B_STOCK_RESERVATION_DURATION_MS, 24 * 60 * 60 * 1000);
  assert.equal(expiresAt.toISOString(), '2026-10-11T12:00:00.000Z');
});

test('B2B stock reservation uses the persisted payment expiry when present', () => {
  const createdAt = new Date('2026-10-10T12:00:00.000Z');
  const paymentExpiresAt = new Date('2026-10-11T11:55:00.000Z');

  assert.equal(getB2BStockReservationExpiry(createdAt, paymentExpiresAt), paymentExpiresAt);
});
