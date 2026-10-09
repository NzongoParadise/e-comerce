import type { Prisma } from '@prisma/client';

type ReservedItem = { productId: number; quantity: number };
type FailedPaymentStatus = 'FAILED' | 'EXPIRED' | 'CANCELLED';

export async function cancelAwaitingPaymentAndReleaseStock(
  transaction: Prisma.TransactionClient,
  orderId: number,
  items: ReservedItem[],
  paymentStatus: FailedPaymentStatus,
  description: string,
) {
  const cancelled = await transaction.order.updateMany({
    where: { id: orderId, status: 'AWAITING_PAYMENT' },
    data: { status: 'CANCELLED' },
  });
  if (!cancelled.count) return false;

  const failedPayment = await transaction.payment.updateMany({
    where: { orderId, status: { not: 'PAID' } },
    data: { status: paymentStatus, failedAt: new Date() },
  });
  if (!failedPayment.count) throw new Error('Cannot cancel an order with a paid payment');

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