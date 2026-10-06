const allowedTransitions: Record<string, string[]> = {
  AWAITING_PAYMENT: ['PAYMENT_CONFIRMED'],
  PROCESSING: ['PAYMENT_CONFIRMED'],
  PAYMENT_CONFIRMED: ['SHIPPED'],
  SHIPPED: ['IN_TRANSIT', 'DELIVERED'],
  IN_TRANSIT: ['DELIVERED'],
};

export function canTransitionAdminOrder(currentStatus: string, nextStatus: string) {
  return allowedTransitions[currentStatus]?.includes(nextStatus) ?? false;
}

export function canCancelAdminOrder(orderStatus: string, paymentStatus: string | null | undefined) {
  return ['AWAITING_PAYMENT', 'PROCESSING'].includes(orderStatus) && paymentStatus !== 'PAID';
}

export function canEditAdminOrderDelivery(orderStatus: string, paymentStatus: string | null | undefined) {
  return ['AWAITING_PAYMENT', 'PROCESSING'].includes(orderStatus) && paymentStatus !== 'PAID';
}