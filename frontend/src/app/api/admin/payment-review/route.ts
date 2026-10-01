import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const resolutionSchema = z.object({
  orderId: z.number().int().positive(),
  note: z.string().trim().min(8).max(500),
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse('Authentication required', 401) };
  if (!isAdmin(user)) return { error: errorResponse('Administrator access required', 403) };
  return { user };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const orders = await prisma.order.findMany({
      where: { status: 'PAYMENT_REVIEW_REQUIRED' },
      include: {
        user: { select: { name: true, email: true } },
        payment: { select: { provider: true, status: true, providerPaymentId: true, reference: true, currency: true, amountEUR: true, amountKZ: true, paidAt: true } },
        items: { select: { name: true, quantity: true, subtotal: true, productId: true } },
        trackingEvents: { where: { status: 'PAYMENT_REVIEW_REQUIRED' }, orderBy: { occurredAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return Response.json({ data: orders });
  } catch (error) {
    console.error('Unable to list payment review orders:', error);
    return errorResponse('Unable to load payment review queue', 503);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = resolutionSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid payment review resolution', 400);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: parsed.data.orderId },
        include: { payment: true, items: { select: { productId: true, quantity: true } } },
      });
      if (!order) return { kind: 'NOT_FOUND' as const };
      if (order.status !== 'PAYMENT_REVIEW_REQUIRED' || order.payment?.provider !== 'stripe' || order.payment.status !== 'PAID') {
        return { kind: 'NOT_REVIEWABLE' as const };
      }

      const claimed = await transaction.order.updateMany({
        where: { id: order.id, status: 'PAYMENT_REVIEW_REQUIRED' },
        data: { status: 'PAYMENT_REVIEW_IN_PROGRESS' },
      });
      if (claimed.count !== 1) return { kind: 'NOT_REVIEWABLE' as const };

      for (const item of order.items) {
        const reserved = await transaction.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (reserved.count !== 1) throw new Error(`REVIEW_STOCK_UNAVAILABLE:${item.productId}`);
      }

      await transaction.paymentEvent.create({
        data: {
          paymentId: order.payment.id,
          providerEventId: `admin-review-${randomUUID()}`,
          eventType: 'admin.payment_review_resolved',
          status: 'PAYMENT_CONFIRMED',
          amountKZ: order.payment.amountKZ,
          currency: order.payment.currency,
          payload: {
            orderId: order.id,
            reviewedBy: userSubject(auth.user),
            note: parsed.data.note,
            stripeReference: order.payment.reference,
          },
          processedAt: new Date(),
        },
      });
      await transaction.trackingEvent.create({
        data: {
          orderId: order.id,
          status: 'PAYMENT_CONFIRMED',
          location: 'Administração',
          description: `Pagamento revisto e encomenda retomada manualmente. Nota: ${parsed.data.note}`,
        },
      });
      await transaction.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_CONFIRMED' } });
      return { kind: 'RESOLVED' as const };
    });

    if (result.kind === 'NOT_FOUND') return errorResponse('Order not found', 404);
    if (result.kind === 'NOT_REVIEWABLE') return errorResponse('Order is no longer available for payment review', 409);
    return Response.json({ data: { orderId: parsed.data.orderId, status: 'PAYMENT_CONFIRMED' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('REVIEW_STOCK_UNAVAILABLE:')) {
      return errorResponse('Stock insuficiente para retomar esta encomenda. O pedido continua em revisão.', 409);
    }
    console.error('Unable to resolve payment review:', error);
    return errorResponse('Unable to resolve payment review', 503);
  }
}