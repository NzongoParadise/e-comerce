import { stripeRequest } from '@/lib/server/payments/stripe';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);

  const sync = new URL(request.url).searchParams.get('sync') === '1';
  if (sync) {
    try {
      const response = await stripeRequest<{ data?: Array<Record<string, unknown>>; has_more?: boolean }>('payouts?limit=100');
      for (const payout of response.data || []) {
        if (typeof payout.id !== 'string') continue;
        await prisma.stripePayout.upsert({
          where: { stripePayoutId: payout.id },
          create: {
            stripePayoutId: payout.id,
            amount: typeof payout.amount === 'number' ? payout.amount : 0,
            currency: typeof payout.currency === 'string' ? payout.currency : 'eur',
            status: typeof payout.status === 'string' ? payout.status : 'unknown',
            arrivalDate: typeof payout.arrival_date === 'number' ? new Date(payout.arrival_date * 1000) : null,
          },
          update: {
            amount: typeof payout.amount === 'number' ? payout.amount : undefined,
            currency: typeof payout.currency === 'string' ? payout.currency : undefined,
            status: typeof payout.status === 'string' ? payout.status : undefined,
            arrivalDate: typeof payout.arrival_date === 'number' ? new Date(payout.arrival_date * 1000) : undefined,
          },
        });
      }
    } catch (error) {
      return errorResponse(error instanceof Error && error.message === 'STRIPE_NOT_CONFIGURED' ? 'Stripe não está configurado no servidor.' : 'Não foi possível sincronizar payouts Stripe.', 503);
    }
  }

  const payouts = await prisma.stripePayout.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return Response.json({ data: payouts });
}
