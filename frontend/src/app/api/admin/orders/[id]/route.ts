import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from '@/lib/server/api';
import { canCancelAdminOrder, canEditAdminOrderDelivery, canTransitionAdminOrder } from '@/lib/server/orders/adminOrderRules';
import { z } from 'zod';

export const runtime = 'nodejs';

const updateSchema = z.object({
  status: z.enum(['PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED']).optional(),
  carrier: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  location: z.string().trim().max(160).optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
  deliveryRecipient: z.string().trim().max(200).optional(),
  deliveryCity: z.string().trim().max(100).optional(),
  deliveryRegion: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
  note: z.string().trim().min(8).max(500),
}).refine((data) => data.status
  || data.carrier !== undefined
  || data.trackingNumber !== undefined
  || data.address !== undefined
  || data.phone !== undefined
  || data.deliveryRecipient !== undefined
  || data.deliveryCity !== undefined
  || data.deliveryRegion !== undefined
  || data.postalCode !== undefined
  || data.deliveryNotes !== undefined, {
  message: 'Indique uma alteração para a encomenda',
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse('Authentication required', 401) };
  if (!isAdmin(user)) return { error: errorResponse('Administrator access required', 403) };
  return { user };
}

function orderId(request: Request) {
  const value = Number(new URL(request.url).pathname.split('/').filter(Boolean).at(-1));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = orderId(request);
  if (id === null) return errorResponse('Invalid order id', 400);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, accountName: true, accountType: true } },
      items: true,
      payment: { select: { id: true, status: true, method: true, provider: true, currency: true, paidAt: true, reference: true } },
      trackingEvents: { orderBy: { occurredAt: 'desc' } },
    },
  });
  if (!order) return errorResponse('Order not found', 404);
  return Response.json({ data: order });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = orderId(request);
  if (id === null) return errorResponse('Invalid order id', 400);
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid order update', 400, parsed.error.flatten().fieldErrors);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.order.findUnique({ where: { id }, include: { payment: true } });
      if (!current) return { kind: 'NOT_FOUND' as const };
      if (current.status === 'CANCELLED') return { kind: 'FINAL_STATE' as const };
      const hasDeliveryChanges = parsed.data.address !== undefined
        || parsed.data.phone !== undefined
        || parsed.data.deliveryRecipient !== undefined
        || parsed.data.deliveryCity !== undefined
        || parsed.data.deliveryRegion !== undefined
        || parsed.data.postalCode !== undefined
        || parsed.data.deliveryNotes !== undefined;
      if (hasDeliveryChanges && !canEditAdminOrderDelivery(current.status, current.payment?.status)) {
        return { kind: 'DELIVERY_LOCKED' as const };
      }

      if (parsed.data.status) {
        if (!canTransitionAdminOrder(current.status, parsed.data.status)) return { kind: 'INVALID_TRANSITION' as const };
        if (!current.payment) return { kind: 'PAYMENT_MISSING' as const };
        if (parsed.data.status !== 'PAYMENT_CONFIRMED' && current.payment.status !== 'PAID') return { kind: 'PAYMENT_REQUIRED' as const };

        if (parsed.data.status === 'PAYMENT_CONFIRMED' && current.payment.status !== 'PAID') {
          await transaction.payment.update({
            where: { id: current.payment.id },
            data: { status: 'PAID', paidAt: new Date(), failedAt: null },
          });
          await transaction.paymentEvent.create({
            data: {
              paymentId: current.payment.id,
              providerEventId: `admin-order-payment-${randomUUID()}`,
              eventType: 'admin.order.payment_confirmed',
              status: 'PAID',
              amountKZ: current.payment.amountKZ,
              currency: current.payment.currency,
              payload: {
                orderId: current.id,
                reviewedBy: userSubject(auth.user),
                note: parsed.data.note,
                previousProvider: current.payment.provider,
              },
              processedAt: new Date(),
            },
          });
        }
      }

      const updated = await transaction.order.update({
        where: { id },
        data: {
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          ...(parsed.data.carrier !== undefined ? { carrier: parsed.data.carrier || null } : {}),
          ...(parsed.data.trackingNumber !== undefined ? { trackingNumber: parsed.data.trackingNumber || null } : {}),
          ...(parsed.data.address !== undefined ? { address: parsed.data.address || null } : {}),
          ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
          ...(parsed.data.deliveryRecipient !== undefined ? { deliveryRecipient: parsed.data.deliveryRecipient || null } : {}),
          ...(parsed.data.deliveryCity !== undefined ? { deliveryCity: parsed.data.deliveryCity || null } : {}),
          ...(parsed.data.deliveryRegion !== undefined ? { deliveryRegion: parsed.data.deliveryRegion || null } : {}),
          ...(parsed.data.postalCode !== undefined ? { postalCode: parsed.data.postalCode || null } : {}),
          ...(parsed.data.deliveryNotes !== undefined ? { deliveryNotes: parsed.data.deliveryNotes || null } : {}),
        },
        include: {
          user: { select: { id: true, name: true, email: true, accountName: true, accountType: true } },
          items: true,
          payment: { select: { id: true, status: true, method: true, provider: true, currency: true, paidAt: true } },
          trackingEvents: { orderBy: { occurredAt: 'desc' }, take: 5 },
        },
      });
      const orderChanged = parsed.data.status
        || parsed.data.carrier !== undefined
        || parsed.data.trackingNumber !== undefined
        || parsed.data.location !== undefined
        || hasDeliveryChanges;
      if (orderChanged) {
        await transaction.trackingEvent.create({
          data: {
            orderId: id,
            status: parsed.data.status || current.status,
            location: parsed.data.location || 'Administração',
            description: parsed.data.note,
          },
        });
      }
      return { kind: 'UPDATED' as const, order: updated };
    });

    if (result.kind === 'NOT_FOUND') return errorResponse('Order not found', 404);
    if (result.kind === 'FINAL_STATE') return errorResponse('Encomendas canceladas não podem ser alteradas.', 409);
    if (result.kind === 'INVALID_TRANSITION') return errorResponse('Transição de estado inválida.', 409);
    if (result.kind === 'PAYMENT_MISSING') return errorResponse('A encomenda não tem registo de pagamento.', 409);
    if (result.kind === 'PAYMENT_REQUIRED') return errorResponse('Confirme o pagamento antes de expedir a encomenda.', 409);
    if (result.kind === 'DELIVERY_LOCKED') return errorResponse('Os dados de entrega ficam bloqueados após o pagamento ou início da expedição.', 409);
    return Response.json({ data: result.order });
  } catch (error) {
    console.error('Unable to update admin order:', error);
    return errorResponse('Unable to update order', 503);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = orderId(request);
  if (id === null) return errorResponse('Invalid order id', 400);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id },
        include: { payment: true, items: { select: { productId: true, quantity: true } } },
      });
      if (!order) return 'NOT_FOUND' as const;
      if (!canCancelAdminOrder(order.status, order.payment?.status)) return 'NOT_CANCELLABLE' as const;

      const cancelled = await transaction.order.updateMany({
        where: { id, status: order.status },
        data: { status: 'CANCELLED' },
      });
      if (!cancelled.count) return 'NOT_CANCELLABLE' as const;
      if (order.payment) {
        const paymentCancelled = await transaction.payment.updateMany({
          where: { id: order.payment.id, status: { not: 'PAID' } },
          data: { status: 'CANCELLED', failedAt: new Date() },
        });
        if (!paymentCancelled.count) throw new Error('PAYMENT_ALREADY_PAID');
      }
      for (const item of order.items) {
        await transaction.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      await transaction.trackingEvent.create({
        data: {
          orderId: id,
          status: 'CANCELLED',
          location: 'Administração',
          description: `Venda cancelada por ${userSubject(auth.user) || 'Admin'}. O stock reservado foi reposto.`,
        },
      });
      return 'CANCELLED' as const;
    });

    if (result === 'NOT_FOUND') return errorResponse('Order not found', 404);
    if (result === 'NOT_CANCELLABLE') return errorResponse('Só é possível cancelar encomendas não pagas em processamento.', 409);
    return Response.json({ data: { id, status: result } });
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYMENT_ALREADY_PAID') return errorResponse('A encomenda já foi paga e não pode ser cancelada por esta operação.', 409);
    console.error('Unable to cancel admin order:', error);
    return errorResponse('Unable to cancel order', 503);
  }
}