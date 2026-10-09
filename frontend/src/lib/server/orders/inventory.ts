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
  const order = await transaction.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      inventoryReserved: true,
      payment: { select: { id: true, status: true } },
    },
  });

  if (!order) return false;
  const releasableStatus = order.status === 'AWAITING_PAYMENT' || (order.status === 'PENDING' && order.inventoryReserved);
  if (!releasableStatus) return false;
  if (order.payment?.status === 'PAID') throw new Error('Cannot cancel an order with a paid payment');

  const cancelled = await transaction.order.updateMany({
    where: {
      id: orderId,
      status: order.status,
      inventoryReserved: order.inventoryReserved,
    },
    data: {
      status: 'CANCELLED',
      inventoryReserved: false,
      inventoryReservationExpiresAt: null,
    },
  });
  if (!cancelled.count) return false;

  if (order.payment) {
    const failedPayment = await transaction.payment.updateMany({
      where: { id: order.payment.id, status: { not: 'PAID' } },
      data: {
        status: paymentStatus,
        failedAt: new Date(),
      },
    });
    if (!failedPayment.count) throw new Error('Cannot cancel an order with a paid payment');
  }

  if (order.inventoryReserved) {
    for (const item of items) {
      await transaction.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
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
