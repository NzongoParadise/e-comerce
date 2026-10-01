export function stripeCheckoutIdempotencyKey(orderId: number) {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new RangeError('Invalid order id');
  return `stripe-checkout-order-${orderId}`;
}

export function isDefinitiveStripeRejection(statusCode: number) {
  return statusCode >= 400
    && statusCode < 500
    && ![408, 409, 425, 429].includes(statusCode);
}

export function isStripeSessionForOrder(session: unknown, orderId: number, orderNumber: string) {
  if (typeof session !== 'object' || session === null) return false;
  const candidate = session as { client_reference_id?: unknown; metadata?: { orderId?: unknown } };
  return candidate.client_reference_id === orderNumber
    && candidate.metadata?.orderId === String(orderId);
}