import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';
import { detectExpenseOutliers, forecastNextPeriod } from '@/lib/server/finance/analytics';

export const runtime = 'nodejs';

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('pt-PT', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
}

function moneySeriesForecast(incomeValues: number[], expenseValues: number[]) {
  const income = forecastNextPeriod(incomeValues);
  const expenses = forecastNextPeriod(expenseValues);
  if (income.value === null || expenses.value === null) {
    return { income, expenses, balance: { value: null, lower: null, upper: null, method: null, observations: Math.min(income.observations, expenses.observations) } };
  }
  return {
    income,
    expenses,
    balance: {
      value: income.value - expenses.value,
      lower: (income.lower || 0) - (expenses.upper || 0),
      upper: (income.upper || 0) - (expenses.lower || 0),
      method: income.method === expenses.method ? income.method : 'MIXED',
      observations: Math.min(income.observations, expenses.observations),
    },
  };
}

export async function GET(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const historyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
  const anomalyStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const months = Array.from({ length: 12 }, (_, index) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12 + index, 1)));
  const monthData = new Map(months.map((date) => [monthKey(date), {
    month: monthKey(date),
    label: monthLabel(date),
    gatewayIncomeAOA: 0,
    gatewayIncomeEUR: 0,
    otherIncomeAOA: 0,
    otherIncomeEUR: 0,
    expensesAOA: 0,
    expensesEUR: 0,
  }]));

  try {
    const [payments, entries, recentExpenses] = await prisma.$transaction([
      prisma.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: historyStart, lt: currentMonthStart } },
        select: { currency: true, amountKZ: true, amountEUR: true, paidAt: true },
      }),
      prisma.financeEntry.findMany({
        where: { status: 'CONFIRMED', transactionDate: { gte: historyStart, lt: currentMonthStart } },
        select: { type: true, category: true, amount: true, currency: true, transactionDate: true },
      }),
      prisma.financeEntry.findMany({
        where: { type: 'EXPENSE', status: 'CONFIRMED', transactionDate: { gte: anomalyStart, lte: now } },
        select: { id: true, type: true, category: true, description: true, amount: true, currency: true, transactionDate: true },
      }),
    ]);

    for (const payment of payments) {
      if (!payment.paidAt) continue;
      const month = monthData.get(monthKey(payment.paidAt));
      if (!month) continue;
      if (payment.currency === 'EUR') month.gatewayIncomeEUR += Number(payment.amountEUR);
      else if (payment.currency === 'AOA') month.gatewayIncomeAOA += Number(payment.amountKZ);
    }

    for (const entry of entries) {
      const month = monthData.get(monthKey(entry.transactionDate));
      if (!month) continue;
      const amount = Number(entry.amount);
      if (entry.type === 'EXPENSE' && entry.currency === 'AOA') month.expensesAOA += amount;
      if (entry.type === 'EXPENSE' && entry.currency === 'EUR') month.expensesEUR += amount;
      if (entry.type === 'INCOME' && entry.currency === 'AOA') month.otherIncomeAOA += amount;
      if (entry.type === 'INCOME' && entry.currency === 'EUR') month.otherIncomeEUR += amount;
    }

    const series = [...monthData.values()].map((month) => ({
      ...month,
      incomeAOA: month.gatewayIncomeAOA + month.otherIncomeAOA,
      incomeEUR: month.gatewayIncomeEUR + month.otherIncomeEUR,
      balanceAOA: month.gatewayIncomeAOA + month.otherIncomeAOA - month.expensesAOA,
      balanceEUR: month.gatewayIncomeEUR + month.otherIncomeEUR - month.expensesEUR,
    }));
    const targetDate = currentMonthStart;
    const anomalies = detectExpenseOutliers(recentExpenses.map((entry) => ({
      id: entry.id,
      category: entry.category,
      currency: entry.currency,
      amount: Number(entry.amount),
      description: entry.description,
      transactionDate: entry.transactionDate,
    }))).sort((left, right) => right.robustScore - left.robustScore).slice(0, 20);

    return Response.json({
      data: {
        series,
        forecast: {
          targetMonth: monthLabel(targetDate),
          AOA: moneySeriesForecast(series.map((month) => month.incomeAOA), series.map((month) => month.expensesAOA)),
          EUR: moneySeriesForecast(series.map((month) => month.incomeEUR), series.map((month) => month.expensesEUR)),
        },
        anomalies,
        methods: {
          forecast: 'Tendência linear nos últimos 6 meses quando há 6 ou mais meses ativos; caso contrário, média móvel de 3 meses. Exige pelo menos 3 meses ativos.',
          anomalies: 'Despesas confirmadas nos últimos 90 dias comparadas com a mediana e o desvio absoluto mediano da mesma categoria e moeda; só alerta com pelo menos 5 referências.',
        },
      },
    });
  } catch (error) {
    console.error('Unable to calculate finance analytics:', error);
    return errorResponse('Unable to calculate finance analytics', 503);
  }
}