export const quoteTransitions: Readonly<Record<string, readonly string[]>> = {
  SUBMITTED: ["UNDER_REVIEW", "SENT", "REJECTED"],
  UNDER_REVIEW: ["SENT", "REJECTED"],
  REVISION_REQUESTED: ["SENT", "REJECTED"],
  SENT: ["ACCEPTED", "REVISION_REQUESTED", "REJECTED", "EXPIRED"],
  ACCEPTED: ["CONVERTED_TO_ORDER"],
  APPROVED: ["CONVERTED_TO_ORDER"],
};

export function canTransitionQuote(from: string, to: string) {
  return quoteTransitions[from]?.includes(to) ?? false;
}

export function isQuoteProposalValid(validUntil: Date, now = new Date()) {
  return validUntil.getTime() > now.getTime();
}
