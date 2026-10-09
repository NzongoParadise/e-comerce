export type ReturnRequestType = "RETURN" | "EXCHANGE" | "COMPLAINT";

const allowedTransitions: Record<string, string[]> = {
  RECEIVED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["WAITING_FOR_RETURN", "REFUND_PROCESSING", "EXCHANGE_PROCESSING"],
  WAITING_FOR_RETURN: ["ITEM_RECEIVED"],
  ITEM_RECEIVED: ["REFUND_PROCESSING", "EXCHANGE_PROCESSING"],
  REFUND_PROCESSING: ["COMPLETED"],
  EXCHANGE_PROCESSING: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

export type ReturnTransitionError =
  | "INVALID_TRANSITION"
  | "RETURN_TYPE_TRANSITION_MISMATCH"
  | "RETURN_ITEM_NOT_RECEIVED";

export function validateReturnTransition(
  type: ReturnRequestType,
  currentStatus: string,
  nextStatus: string,
): ReturnTransitionError | null {
  if (currentStatus === nextStatus) return null;

  const allowed = (allowedTransitions[currentStatus] || []).includes(nextStatus) ||
    (type === "COMPLAINT" && currentStatus === "APPROVED" && nextStatus === "COMPLETED");
  if (!allowed) return "INVALID_TRANSITION";

  if (
    type === "COMPLAINT" &&
    ["WAITING_FOR_RETURN", "ITEM_RECEIVED", "REFUND_PROCESSING", "EXCHANGE_PROCESSING"].includes(nextStatus)
  ) return "RETURN_TYPE_TRANSITION_MISMATCH";

  if (type === "RETURN" && nextStatus === "EXCHANGE_PROCESSING") {
    return "RETURN_TYPE_TRANSITION_MISMATCH";
  }
  if (type === "EXCHANGE" && nextStatus === "REFUND_PROCESSING") {
    return "RETURN_TYPE_TRANSITION_MISMATCH";
  }
  if (type === "RETURN" && nextStatus === "REFUND_PROCESSING" && currentStatus !== "ITEM_RECEIVED") {
    return "RETURN_ITEM_NOT_RECEIVED";
  }

  return null;
}

export function requiresConfirmedRefundForCompletion(
  type: ReturnRequestType,
  currentStatus: string,
  nextStatus: string,
): boolean {
  return type === "RETURN" &&
    currentStatus === "REFUND_PROCESSING" &&
    nextStatus === "COMPLETED";
}
