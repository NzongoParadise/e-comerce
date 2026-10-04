import { prisma } from '@/lib/server/prisma';
import { stripeRequest } from '@/lib/server/payments/stripe';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';

export const runtime = 'nodejs';

function idFromUrl(request: Request) {
  const id = Number(new URL(request.url).pathname.split('/').filter(Boolean).at(-2));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  const id = idFromUrl(request);
  if (id === null) return errorResponse('Invalid payment id', 400);

  const payment = await prisma.payment.findFirst({ where: { id, provider: 'stripe' } });
  if (!payment?.stripePaymentIntentId) return errorResponse('Stripe PaymentIntent not found', 404);

  try {
    const intent = await stripeRequest<Record<string, unknown>>(`payment_intents/${encodeURIComponent(payment.stripePaymentIntentId)}`);
    const status = typeof intent.status === 'string' ? intent.status : '';
    const mapped = status === 'succeeded' ? 'PAID' : status === 'processing' ? 'PROCESSING' : status === 'canceled' ? 'CANCELLED' : status === 'requires_payment_method' || status === 'requires_confirmation' || status === 'requires_action' ? 'REQUIRES_PAYMENT' : payment.status;
    const latestCharge = typeof intent.latest_charge === 'string' ? intent.latest_charge : null;
    await prisma.payment.update({
      where: { id },
      data: {
        status: mapped,
        ...(typeof intent.amount === 'number' ? { grossAmount: intent.amount } : {}),
        ...(typeof intent.currency === 'string' ? { currency: intent.currency.toUpperCase() } : {}),
        ...(mapped === 'PAID' && !payment.paidAt ? { paidAt: new Date() } : {}),
        ...(latestCharge ? { stripeChargeId: latestCharge } : {}),
      },
    });
    return Response.json({ data: { id, stripePaymentIntentId: payment.stripePaymentIntentId, stripeStatus: status, status: mapped, chargeId: latestCharge } });
  } catch (error) {
    console.error('Unable to sync Stripe payment:', error);
    return errorResponse('Unable to synchronize payment with Stripe', 502);
  }
}
