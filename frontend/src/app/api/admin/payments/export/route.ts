import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

function csv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);

  const params = new URL(request.url).searchParams;
  const status = params.get('status') || 'ALL';
  const currency = params.get('currency') || 'ALL';
  const search = (params.get('search') || '').trim().slice(0, 160);
  const from = params.get('from');
  const to = params.get('to');

  const where: Prisma.PaymentWhereInput = {
    provider: 'stripe',
    ...(status !== 'ALL' ? { status } : {}),
    ...(currency !== 'ALL' ? { currency } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    ...(search ? { OR: [
      { stripePaymentIntentId: { contains: search, mode: 'insensitive' } },
      { stripeChargeId: { contains: search, mode: 'insensitive' } },
      { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
    ] } : {}),
  };

  const rows = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
    select: {
      id: true, status: true, method: true, currency: true, grossAmount: true, stripeFee: true, netAmount: true,
      stripePaymentIntentId: true, stripeChargeId: true, paidAt: true, createdAt: true,
      order: { select: { orderNumber: true } },
      user: { select: { name: true, email: true } },
    },
  });

  const header = ['Payment ID','Pedido','Cliente','Email','Valor bruto minor','Taxa Stripe minor','Líquido minor','Moeda','Método','Estado','PaymentIntent','Charge','Pago em','Criado em'];
  const body = rows.map((row) => [
    row.id,row.order.orderNumber,row.user.name,row.user.email,row.grossAmount,row.stripeFee,row.netAmount,row.currency,row.method,row.status,row.stripePaymentIntentId,row.stripeChargeId,row.paidAt?.toISOString(),row.createdAt.toISOString(),
  ].map(csv).join(','));
  return new Response([header.map(csv).join(','), ...body].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="stripe-payments-${new Date().toISOString().slice(0,10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
