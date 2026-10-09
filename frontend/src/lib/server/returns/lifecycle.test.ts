import assert from "node:assert/strict";
import test from "node:test";

import {
  requiresConfirmedRefundForCompletion,
  validateReturnTransition,
} from "./lifecycle";

test("allows only valid forward transitions for returns, exchanges and complaints", () => {
  assert.equal(validateReturnTransition("RETURN", "RECEIVED", "UNDER_REVIEW"), null);
  assert.equal(validateReturnTransition("RETURN", "UNDER_REVIEW", "APPROVED"), null);
  assert.equal(validateReturnTransition("RETURN", "WAITING_FOR_RETURN", "ITEM_RECEIVED"), null);
  assert.equal(validateReturnTransition("EXCHANGE", "ITEM_RECEIVED", "EXCHANGE_PROCESSING"), null);
  assert.equal(validateReturnTransition("COMPLAINT", "APPROVED", "COMPLETED"), null);
  assert.equal(validateReturnTransition("RETURN", "COMPLETED", "PROCESSING"), "INVALID_TRANSITION");
  assert.equal(validateReturnTransition("RETURN", "RECEIVED", "COMPLETED"), "INVALID_TRANSITION");
});

test("prevents refunding a return before the returned item has been received", () => {
  assert.equal(validateReturnTransition("RETURN", "ITEM_RECEIVED", "REFUND_PROCESSING"), null);
  assert.equal(validateReturnTransition("RETURN", "APPROVED", "REFUND_PROCESSING"), "RETURN_ITEM_NOT_RECEIVED");
  assert.equal(validateReturnTransition("RETURN", "WAITING_FOR_RETURN", "REFUND_PROCESSING"), "RETURN_ITEM_NOT_RECEIVED");
});

test("prevents lifecycle states that do not match the after-sales request type", () => {
  assert.equal(validateReturnTransition("RETURN", "ITEM_RECEIVED", "EXCHANGE_PROCESSING"), "RETURN_TYPE_TRANSITION_MISMATCH");
  assert.equal(validateReturnTransition("EXCHANGE", "ITEM_RECEIVED", "REFUND_PROCESSING"), "RETURN_TYPE_TRANSITION_MISMATCH");
  assert.equal(validateReturnTransition("COMPLAINT", "APPROVED", "REFUND_PROCESSING"), "RETURN_TYPE_TRANSITION_MISMATCH");
});

test("requires a confirmed refund only for completing a return in refund processing", () => {
  assert.equal(requiresConfirmedRefundForCompletion("RETURN", "REFUND_PROCESSING", "COMPLETED"), true);
  assert.equal(requiresConfirmedRefundForCompletion("EXCHANGE", "EXCHANGE_PROCESSING", "COMPLETED"), false);
  assert.equal(requiresConfirmedRefundForCompletion("COMPLAINT", "APPROVED", "COMPLETED"), false);
  assert.equal(requiresConfirmedRefundForCompletion("RETURN", "ITEM_RECEIVED", "REFUND_PROCESSING"), false);
});
