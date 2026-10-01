import assert from 'node:assert/strict';
import test from 'node:test';

import { canCancelAdminOrder, canEditAdminOrderDelivery, canTransitionAdminOrder } from './adminOrderRules';

test('allows only forward order lifecycle transitions', () => {
  assert.equal(canTransitionAdminOrder('PROCESSING', 'PAYMENT_CONFIRMED'), true);
  assert.equal(canTransitionAdminOrder('PAYMENT_CONFIRMED', 'SHIPPED'), true);
  assert.equal(canTransitionAdminOrder('SHIPPED', 'DELIVERED'), true);
  assert.equal(canTransitionAdminOrder('DELIVERED', 'PROCESSING'), false);
  assert.equal(canTransitionAdminOrder('PAYMENT_REVIEW_REQUIRED', 'PAYMENT_CONFIRMED'), false);
});

test('allows cancellation only before payment confirmation', () => {
  assert.equal(canCancelAdminOrder('AWAITING_PAYMENT', 'PENDING'), true);
  assert.equal(canCancelAdminOrder('PROCESSING', 'FAILED'), true);
  assert.equal(canCancelAdminOrder('PROCESSING', 'PAID'), false);
  assert.equal(canCancelAdminOrder('SHIPPED', 'PAID'), false);
});

test('locks delivery edits after payment confirmation or shipping', () => {
  assert.equal(canEditAdminOrderDelivery('AWAITING_PAYMENT', 'PENDING'), true);
  assert.equal(canEditAdminOrderDelivery('PROCESSING', 'PENDING'), true);
  assert.equal(canEditAdminOrderDelivery('PROCESSING', 'PAID'), false);
  assert.equal(canEditAdminOrderDelivery('SHIPPED', 'PAID'), false);
});