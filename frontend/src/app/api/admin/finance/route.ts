import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const financeTypes = ['INCOME', 'EXPENSE'] as const;
const financeStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
const querySchema = z.object({
  search: z.string().trim().max(160).default(''),
  type: z.enum(['ALL', ...financeTypes]).default('ALL'),
  status: z.enum(['ALL', ...financeStatuses]).default('ALL'),
  currency: z.enum(['ALL', 'AOA', 'EUR']).default('ALL'),
  category: z.string().trim().max(80).default(''),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => new Date(`${value}T00:00:00.000Z`)).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => new Date(`${value}T23:59:59.999Z`)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  path: ['to'],
  message: 'A data final deve ser igual ou posterior à data inicial',
});
const entrySchema = z.object({
  type: z.enum(financeTypes),
  description: z.string().trim().min(3).max(180),
  category: z.string().trim().min(2).max(80),
  amount: z.coerce.number().positive().max(1_000_000_000_000),
  currency: z.enum(['AOA', 'EUR']).default('AOA'),
  status: z.enum(['PENDING', 'CONFIRMED']).default('CONFIRMED'),
  transactionDate: z.coerce.date().optional(),
  reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
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
  if (!parsed.success) return errorResponse('Invalid finance query', 400);
  const { search, type, status, currency, category, from, to, page, pageSize } = parsed.data;
  const dateRange = from || to ? { transactionDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
  const where: Prisma.FinanceEntryWhereInput = {
    ...(type !== 'ALL' ? { type } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(currency !== 'ALL' ? { currency } : {}),
    ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
    ...dateRange,
    ...(search ? { OR: [
      { description: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ] } : {}),
  };

  try {
    const paidAtRange = from || to ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
    const [data, total, incomeAOA, incomeEUR, expensesAOA, expensesEUR, gatewayIncomeAOA, gatewayIncomeEUR, pending, cancelled] = await prisma.$transaction([
      prisma.financeEntry.findMany({
        where,
        include: { events: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.financeEntry.count({ where }),
      prisma.financeEntry.aggregate({ where: { ...dateRange, type: 'INCOME', currency: 'AOA', status: 'CONFIRMED' }, _sum: { amount: true } }),
      prisma.financeEntry.aggregate({ where: { ...dateRange, type: 'INCOME', currency: 'EUR', status: 'CONFIRMED' }, _sum: { amount: true } }),
      prisma.financeEntry.aggregate({ where: { ...dateRange, type: 'EXPENSE', currency: 'AOA', status: 'CONFIRMED' }, _sum: { amount: true } }),
      prisma.financeEntry.aggregate({ where: { ...dateRange, type: 'EXPENSE', currency: 'EUR', status: 'CONFIRMED' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { ...paidAtRange, status: 'PAID', currency: 'AOA' }, _sum: { amountKZ: true }, _count: { _all: true } }),
      prisma.payment.aggregate({ where: { ...paidAtRange, status: 'PAID', currency: 'EUR' }, _sum: { amountEUR: true }, _count: { _all: true } }),
      prisma.financeEntry.count({ where: { ...dateRange, status: 'PENDING' } }),
      prisma.financeEntry.count({ where: { ...dateRange, status: 'CANCELLED' } }),
    ]);
    const incomeAmountAOA = Number(incomeAOA._sum.amount || 0);
    const incomeAmountEUR = Number(incomeEUR._sum.amount || 0);
    const expenseAmountAOA = Number(expensesAOA._sum.amount || 0);
    const expenseAmountEUR = Number(expensesEUR._sum.amount || 0);
    const gatewayIncomeAmountAOA = Number(gatewayIncomeAOA._sum.amountKZ || 0);
    const gatewayIncomeAmountEUR = Number(gatewayIncomeEUR._sum.amountEUR || 0);
    return Response.json({
      data,
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) },
      stats: {
        incomeAOA: incomeAmountAOA,
        incomeEUR: incomeAmountEUR,
        gatewayIncomeAOA: gatewayIncomeAmountAOA,
        gatewayIncomeEUR: gatewayIncomeAmountEUR,
        paidPaymentCount: gatewayIncomeAOA._count._all + gatewayIncomeEUR._count._all,
        expensesAOA: expenseAmountAOA,
        expensesEUR: expenseAmountEUR,
        balanceAOA: incomeAmountAOA + gatewayIncomeAmountAOA - expenseAmountAOA,
        balanceEUR: incomeAmountEUR + gatewayIncomeAmountEUR - expenseAmountEUR,
        pending,
        cancelled,
      },
    });
  } catch (error) {
    console.error('Unable to load finance entries:', error);
    return errorResponse('Unable to load finance entries', 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = entrySchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid finance entry', 400, parsed.error.flatten().fieldErrors);
  const actor = userSubject(auth.user);
  const entryDate = parsed.data.transactionDate || new Date();
  const reference = parsed.data.reference || null;
  const notes = parsed.data.notes || null;

  try {
    const entry = await prisma.financeEntry.create({
      data: {
        ...parsed.data,
        amount: parsed.data.amount,
        transactionDate: entryDate,
        reference,
        notes,
        createdBy: actor,
        updatedBy: actor,
        events: { create: {
          actorExternalId: actor,
          eventType: 'CREATED',
          payload: {
            type: parsed.data.type,
            description: parsed.data.description,
            category: parsed.data.category,
            amount: String(parsed.data.amount),
            currency: parsed.data.currency,
            status: parsed.data.status,
            transactionDate: entryDate.toISOString(),
            reference,
            notes,
          },
        } },
      },
      include: { events: { orderBy: { createdAt: 'desc' } } },
    });
    return Response.json({ data: entry }, { status: 201 });
  } catch (error) {
    console.error('Unable to create finance entry:', error);
    return errorResponse('Unable to create finance entry', 503);
  }
}
