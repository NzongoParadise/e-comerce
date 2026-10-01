import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const querySchema = z.object({ period: z.enum(['7D', 'MONTH', 'LAST_MONTH']).default('MONTH') });
const lowStockThreshold = Number.isInteger(Number(process.env.LOW_STOCK_THRESHOLD)) && Number(process.env.LOW_STOCK_THRESHOLD) > 0
  ? Number(process.env.LOW_STOCK_THRESHOLD)
  : 5;

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('pt-PT', { month: 'short', timeZone: 'UTC' }).format(date);
}

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

function getPeriodRange(period: '7D' | 'MONTH' | 'LAST_MONTH', now: Date) {
  if (period === '7D') {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 6);
    from.setUTCHours(0, 0, 0, 0);
    const previousFrom = new Date(from);
    previousFrom.setUTCDate(previousFrom.getUTCDate() - 7);
    const previousTo = new Date(from.getTime() - 1);
    return { from, to: now, previousFrom, previousTo, label: 'Últimos 7 dias' };
  }
  if (period === 'LAST_MONTH') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    const previousFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
    const previousTo = new Date(Date.UTC(previousFrom.getUTCFullYear(), previousFrom.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { from, to, previousFrom, previousTo, label: monthLabel(from) };
  }
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const elapsedDays = Math.ceil((now.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  const previousTo = new Date(Date.UTC(previousFrom.getUTCFullYear(), previousFrom.getUTCMonth(), Math.min(elapsedDays, new Date(Date.UTC(previousFrom.getUTCFullYear(), previousFrom.getUTCMonth() + 1, 0)).getUTCDate()), 23, 59, 59, 999));
  return { from, to: now, previousFrom, previousTo, label: monthLabel(from) };
}

export async function GET(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse('Invalid dashboard query', 400);

  const now = new Date();
  const range = getPeriodRange(parsed.data.period, now);
  const currentPaidWhere = { status: 'PAID', paidAt: { gte: range.from, lte: range.to } };
  const previousPaidWhere = { status: 'PAID', paidAt: { gte: range.previousFrom, lte: range.previousTo } };
  const currentOrdersWhere: Prisma.OrderWhereInput = { status: { not: 'CANCELLED' }, createdAt: { gte: range.from, lte: range.to } };
  const previousOrdersWhere: Prisma.OrderWhereInput = { status: { not: 'CANCELLED' }, createdAt: { gte: range.previousFrom, lte: range.previousTo } };
  const monthlyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const trendMonths = Array.from({ length: 12 }, (_, index) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12 + index, 1)));
  const trendMap = new Map(trendMonths.map((date) => [monthKey(date), { month: monthKey(date), label: monthLabel(date), revenueAOA: 0, revenueEUR: 0, orders: 0 }]));

  try {
    const [
      currentRevenueAOA,
      currentRevenueEUR,
      previousRevenueAOA,
      previousRevenueEUR,
      currentOrders,
      previousOrders,
      currentCustomers,
      previousCustomers,
      totalCustomers,
      activeCustomers,
      productCount,
      lowStock,
      outOfStock,
      stockTotal,
      pendingPayments,
      paymentReview,
      otherIncomeAOA,
      otherIncomeEUR,
      recentOrders,
      bestSellers,
      trendPayments,
      trendOrders,
      expensesAOA,
      expensesEUR,
    ] = await prisma.$transaction([
      prisma.payment.aggregate({ where: { ...currentPaidWhere, currency: 'AOA' }, _sum: { amountKZ: true }, _count: { _all: true } }),
      prisma.payment.aggregate({ where: { ...currentPaidWhere, currency: 'EUR' }, _sum: { amountEUR: true }, _count: { _all: true } }),
      prisma.payment.aggregate({ where: { ...previousPaidWhere, currency: 'AOA' }, _sum: { amountKZ: true } }),
      prisma.payment.aggregate({ where: { ...previousPaidWhere, currency: 'EUR' }, _sum: { amountEUR: true } }),
      prisma.order.count({ where: currentOrdersWhere }),
      prisma.order.count({ where: previousOrdersWhere }),
      prisma.user.count({ where: { accessRole: 'CUSTOMER', createdAt: { gte: range.from, lte: range.to } } }),
      prisma.user.count({ where: { accessRole: 'CUSTOMER', createdAt: { gte: range.previousFrom, lte: range.previousTo } } }),
      prisma.user.count({ where: { accessRole: 'CUSTOMER' } }),
      prisma.user.count({ where: { accessRole: 'CUSTOMER', status: 'ACTIVE' } }),
      prisma.product.count(),
      prisma.product.count({ where: { stock: { gt: 0, lte: lowStockThreshold } } }),
      prisma.product.count({ where: { stock: 0 } }),
      prisma.product.aggregate({ _sum: { stock: true } }),
      prisma.payment.count({ where: { status: { in: ['PENDING', 'PROCESSING', 'REQUIRES_PAYMENT'] } } }),
      prisma.order.count({ where: { status: 'PAYMENT_REVIEW_REQUIRED' } }),
      prisma.financeEntry.aggregate({ where: { type: 'INCOME', currency: 'AOA', status: 'CONFIRMED', transactionDate: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
      prisma.financeEntry.aggregate({ where: { type: 'INCOME', currency: 'EUR', status: 'CONFIRMED', transactionDate: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: { user: { select: { name: true, accountName: true } }, payment: { select: { status: true } } },
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'name', 'imageUrl'],
        where: { order: { status: { not: 'CANCELLED' } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      prisma.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: monthlyStart, lt: currentMonthStart } },
        select: { currency: true, amountKZ: true, amountEUR: true, paidAt: true },
      }),
      prisma.order.findMany({
        where: { status: { not: 'CANCELLED' }, createdAt: { gte: monthlyStart, lt: currentMonthStart } },
        select: { createdAt: true },
      }),
      prisma.financeEntry.aggregate({ where: { type: 'EXPENSE', currency: 'AOA', status: 'CONFIRMED', transactionDate: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
      prisma.financeEntry.aggregate({ where: { type: 'EXPENSE', currency: 'EUR', status: 'CONFIRMED', transactionDate: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
    ]);

    for (const payment of trendPayments) {
      if (!payment.paidAt) continue;
      const month = trendMap.get(monthKey(payment.paidAt));
      if (!month) continue;
      if (payment.currency === 'AOA') month.revenueAOA += Number(payment.amountKZ);
      if (payment.currency === 'EUR') month.revenueEUR += Number(payment.amountEUR);
    }
    for (const order of trendOrders) {
      const month = trendMap.get(monthKey(order.createdAt));
      if (month) month.orders += 1;
    }

    const currentAOA = Number(currentRevenueAOA._sum.amountKZ || 0);
    const currentEUR = Number(currentRevenueEUR._sum.amountEUR || 0);
    const previousAOA = Number(previousRevenueAOA._sum.amountKZ || 0);
    const previousEUR = Number(previousRevenueEUR._sum.amountEUR || 0);
    return Response.json({
      data: {
        period: range.label,
        metrics: {
          revenueAOA: currentAOA,
          revenueEUR: currentEUR,
          revenueChangeAOA: previousAOA ? ((currentAOA - previousAOA) / previousAOA) * 100 : null,
          revenueChangeEUR: previousEUR ? ((currentEUR - previousEUR) / previousEUR) * 100 : null,
          orders: currentOrders,
          ordersChange: previousOrders ? ((currentOrders - previousOrders) / previousOrders) * 100 : null,
          newCustomers: currentCustomers,
          customersChange: previousCustomers ? ((currentCustomers - previousCustomers) / previousCustomers) * 100 : null,
          totalCustomers,
          activeCustomers,
          products: productCount,
          lowStock,
          outOfStock,
          stockUnits: stockTotal._sum.stock || 0,
          expensesAOA: Number(expensesAOA._sum.amount || 0),
          expensesEUR: Number(expensesEUR._sum.amount || 0),
          otherIncomeAOA: Number(otherIncomeAOA._sum.amount || 0),
          otherIncomeEUR: Number(otherIncomeEUR._sum.amount || 0),
          balanceAOA: currentAOA + Number(otherIncomeAOA._sum.amount || 0) - Number(expensesAOA._sum.amount || 0),
          balanceEUR: currentEUR + Number(otherIncomeEUR._sum.amount || 0) - Number(expensesEUR._sum.amount || 0),
          pendingPayments,
          paymentReview,
        },
        recentOrders,
        bestSellers: bestSellers.map((item) => ({ productId: item.productId, name: item.name, imageUrl: item.imageUrl, units: item._sum?.quantity || 0 })),
        trend: [...trendMap.values()],
      },
    });
  } catch (error) {
    console.error('Unable to load admin dashboard:', error);
    return errorResponse('Unable to load admin dashboard', 503);
  }
}