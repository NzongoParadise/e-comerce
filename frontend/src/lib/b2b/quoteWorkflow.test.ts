import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionQuote,
  isQuoteProposalValid,
} from "./quoteWorkflow";

test("only allows explicitly defined quote lifecycle transitions", () => {
  assert.equal(canTransitionQuote("SUBMITTED", "SENT"), true);
  assert.equal(canTransitionQuote("SENT", "ACCEPTED"), true);
  assert.equal(canTransitionQuote("SENT", "REVISION_REQUESTED"), true);
  assert.equal(canTransitionQuote("ACCEPTED", "CONVERTED_TO_ORDER"), true);
  assert.equal(canTransitionQuote("CONVERTED_TO_ORDER", "SENT"), false);
  assert.equal(canTransitionQuote("REJECTED", "ACCEPTED"), false);
});

test("proposal validity is exclusive at its expiration instant", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  assert.equal(isQuoteProposalValid(new Date("2026-10-10T12:00:01Z"), now), true);
  assert.equal(isQuoteProposalValid(now, now), false);
  assert.equal(isQuoteProposalValid(new Date("2026-10-10T11:59:59Z"), now), false);
});
