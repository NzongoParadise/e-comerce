import { createStripeRefund } from '@/lib/server/payments/stripe';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  amountMinor: z.number().int().positive().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse('Authentication required', 401) };
  if (!isAdmin(user)) return { error: errorResponse('Administrator access required', 403) };
  return { user };
}

function getId(request: Request) {
  const value = Number(new URL(request.url).pathname.split('/').filter(Boolean).at(-2));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const paymentId = getId(request);
  if (paymentId === null) return errorResponse('Invalid payment id', 400);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid refund data', 400, parsed.error.flatten().fieldErrors);

  const payment = await prisma.payment.findFirst({ where: { id: paymentId, provider: 'stripe' }, select: { id: true, status: true } });
  if (!payment) return errorResponse('Stripe payment not found', 404);
  if (!['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status)) return errorResponse('Only paid Stripe payments can be refunded', 409);

  const requestIdempotencyKey = request.headers.get('idempotency-key');
  if (!requestIdempotencyKey || requestIdempotencyKey.length > 128) return errorResponse('Idempotency-Key is required', 400);

  try {
    const refund = await createStripeRefund(paymentId, parsed.data.amountMinor, parsed.data.reason, requestIdempotencyKey);
    await prisma.paymentEvent.create({
      data: {
        paymentId,
        providerEventId: `admin.refund.requested.${refund.id}`,
        eventType: 'admin.refund.requested',
        status: refund.status,
        amountKZ: null,
        currency: refund.currency,
        payload: { refundId: refund.id, amount: refund.amount, requestedBy: userSubject(auth.user), reason: parsed.data.reason || null },
        processedAt: new Date(),
      },
    });
    return Response.json({ data: refund }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'REFUND_EXCEEDS_AVAILABLE') return errorResponse('O valor do reembolso excede o valor ainda disponível.', 409);
    if (message === 'INVALID_REFUND_AMOUNT') return errorResponse('Valor de reembolso inválido.', 400);
    if (message === 'PAYMENT_NOT_FOUND' || message === 'STRIPE_PAYMENT_NOT_FOUND') return errorResponse('Pagamento Stripe não encontrado.', 404);
    if (message === 'STRIPE_NOT_CONFIGURED') return errorResponse('Stripe não está configurado no servidor.', 503);
    console.error('Stripe refund failed:', error);
    return errorResponse('Não foi possível criar o reembolso.', 502);
  }
}
