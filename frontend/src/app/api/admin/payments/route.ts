import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const querySchema = z.object({
  search: z.string().trim().max(160).default(''),
  status: z.string().trim().max(40).default('ALL'),
  currency: z.enum(['ALL', 'EUR', 'AOA']).default('ALL'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
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
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse('Invalid payment query', 400);
  const { search, status, currency, from, to, page, pageSize } = parsed.data;
  const baseWhere: Prisma.PaymentWhereInput = { provider: 'stripe', ...(currency !== 'ALL' ? { currency } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}) };
  const statusWhere: Prisma.PaymentWhereInput = status !== 'ALL' ? { status } : {};

  const where: Prisma.PaymentWhereInput = {
    ...baseWhere,
    ...statusWhere,
    ...(status !== 'ALL' ? { status } : {}),
    ...(currency !== 'ALL' ? { currency } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    ...(search ? {
      OR: [
        { stripePaymentIntentId: { contains: search, mode: 'insensitive' } },
        { stripeChargeId: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ],
    } : {}),
  };

  try {
    const [data, total, paid, pending, failed, refunded, fees, gross, net, refundCount, disputeCount] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, orderId: true, provider: true, method: true, status: true, currency: true,
          amountEUR: true, amountKZ: true, grossAmount: true, stripeFee: true, netAmount: true,
          stripePaymentIntentId: true, stripeChargeId: true, paidAt: true, failedAt: true, createdAt: true,
          order: { select: { orderNumber: true, totalEUR: true, totalKZ: true } },
          user: { select: { id: true, name: true, email: true } },
          refunds: { select: { amount: true, status: true } },
        },
      }),
      prisma.payment.count({ where }),
      prisma.payment.count({ where: { ...where, status: 'PAID' } }),
      prisma.payment.count({ where: { ...where, status: { in: ['PENDING', 'REQUIRES_PAYMENT', 'PROCESSING'] } } }),
      prisma.payment.count({ where: { ...where, status: 'FAILED' } }),
      prisma.payment.count({ where: { ...where, status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] } } }),
      prisma.payment.aggregate({ where, _sum: { stripeFee: true } }),
      prisma.payment.aggregate({ where: baseWhere, _sum: { grossAmount: true } }),
      prisma.payment.aggregate({ where: baseWhere, _sum: { netAmount: true } }),
      prisma.stripeRefund.count({ where: { payment: baseWhere } }),
      prisma.stripeDispute.count({ where: { payment: baseWhere } }),
    ]);

    return Response.json({
      data,
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) },
      stats: { paid, pending, failed, refunded, stripeFeesMinor: fees._sum.stripeFee || 0, grossMinor: gross._sum.grossAmount || 0, netMinor: net._sum.netAmount || 0, refundCount, disputeCount },
    });
  } catch (error) {
    console.error('Unable to load Stripe payments:', error);
    return errorResponse('Unable to load payments', 503);
  }
}
