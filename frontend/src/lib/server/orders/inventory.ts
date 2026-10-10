import type { Prisma } from '@prisma/client';

type ReservedItem = { productId: number; quantity: number };
type FailedPaymentStatus = 'FAILED' | 'EXPIRED';

export const B2B_STOCK_RESERVATION_DURATION_MS = 24 * 60 * 60 * 1000;

export function getB2BStockReservationExpiry(createdAt: Date, paymentExpiresAt: Date | null) {
  return paymentExpiresAt ?? new Date(createdAt.getTime() + B2B_STOCK_RESERVATION_DURATION_MS);
}

export async function cancelAwaitingPaymentAndReleaseStock(
  transaction: Prisma.TransactionClient,
  orderId: number,
  items: ReservedItem[],
  paymentStatus: FailedPaymentStatus,
  description: string,
  options: { allowedOrderStatuses?: string[]; allowMissingPayment?: boolean } = {},
) {
  const cancelled = await transaction.order.updateMany({
    where: {
      id: orderId,
      status: options.allowedOrderStatuses
        ? { in: options.allowedOrderStatuses }
        : 'AWAITING_PAYMENT',
    },
    data: { status: 'CANCELLED' },
  });
  if (!cancelled.count) return false;

  const failedPayment = await transaction.payment.updateMany({
    where: { orderId, status: { not: 'PAID' } },
    data: { status: paymentStatus, failedAt: new Date() },
  });
  if (!failedPayment.count) {
    if (!options.allowMissingPayment) throw new Error('Cannot cancel an order with a paid payment or no payment');
    const payment = await transaction.payment.findUnique({ where: { orderId }, select: { status: true } });
    if (payment) throw new Error('Cannot cancel an order with a paid payment');
  }

  for (const item of items) {
    await transaction.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }

  await transaction.trackingEvent.create({
    data: {
      orderId,
      status: 'CANCELLED',
      location: 'Online',
      description,
    },
  });
  return true;
}