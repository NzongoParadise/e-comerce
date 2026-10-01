import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const paymentStatuses = ['PENDING', 'PROCESSING', 'REQUIRES_PAYMENT', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'] as const;
const querySchema = z.object({
  search: z.string().trim().max(160).default(''),
  status: z.enum(['ALL', ...paymentStatuses]).default('ALL'),
  currency: z.enum(['ALL', 'AOA', 'EUR']).default('ALL'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => new Date(`${value}T00:00:00.000Z`)).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => new Date(`${value}T23:59:59.999Z`)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  path: ['to'],
  message: 'A data final deve ser igual ou posterior à data inicial',
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

export async function GET(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse('Invalid payment query', 400);
  const { search, status, currency, from, to, page, pageSize } = parsed.data;
  const where: Prisma.PaymentWhereInput = {
    ...(status !== 'ALL' ? { status } : {}),
    ...(currency !== 'ALL' ? { currency } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(search ? { OR: [
      { providerPaymentId: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
      { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
    ] } : {}),
  };
  const summaryWhere: Prisma.PaymentWhereInput = {
    ...(currency !== 'ALL' ? { currency } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  try {
    const [data, total, pending, paid, failed, review] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, accountName: true } },
          order: { select: { id: true, orderNumber: true, status: true, currency: true, totalEUR: true, totalKZ: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
      prisma.payment.count({ where: { ...summaryWhere, status: { in: ['PENDING', 'PROCESSING', 'REQUIRES_PAYMENT'] } } }),
      prisma.payment.count({ where: { ...summaryWhere, status: 'PAID' } }),
      prisma.payment.count({ where: { ...summaryWhere, status: { in: ['FAILED', 'EXPIRED', 'CANCELLED'] } } }),
      prisma.order.count({ where: {
        status: 'PAYMENT_REVIEW_REQUIRED',
        ...(currency !== 'ALL' || from || to ? { payment: { is: {
          ...(currency !== 'ALL' ? { currency } : {}),
          ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        } } } : {}),
      } }),
    ]);
    return Response.json({ data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) }, stats: { pending, paid, failed, review } });
  } catch (error) {
    console.error('Unable to load finance payments:', error);
    return errorResponse('Unable to load payments', 503);
  }
}