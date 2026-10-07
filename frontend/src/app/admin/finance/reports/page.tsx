"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, CalendarDays, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Currency = "AOA" | "EUR";
type Month = {
  month: string;
  label: string;
  gatewayIncomeAOA: number;
  gatewayIncomeEUR: number;
  otherIncomeAOA: number;
  otherIncomeEUR: number;
  incomeAOA: number;
  incomeEUR: number;
  expensesAOA: number;
  expensesEUR: number;
  balanceAOA: number;
  balanceEUR: number;
};
type ForecastMetric = { value: number | null; lower: number | null; upper: number | null; method: string | null; observations: number };
type Anomaly = { id: number; category: string; currency: Currency; amount: number; description: string; transactionDate: string; robustScore: number; peerCount: number; median: number };
type Analytics = {
  series: Month[];
  forecast: { targetMonth: string; AOA: { income: ForecastMetric; expenses: ForecastMetric; balance: ForecastMetric }; EUR: { income: ForecastMetric; expenses: ForecastMetric; balance: ForecastMetric } };
  anomalies: Anomaly[];
  methods: { forecast: string; anomalies: string };
};

const numberFormat = new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (amount: number, currency: Currency) => `${currency === "EUR" ? "€" : "Kz"} ${numberFormat.format(amount || 0)}`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

function StatCard({ title, value, currency, detail, positive }: { title: string; value: number; currency: Currency; detail: string; positive?: boolean }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
    <p className={`mt-3 text-xl font-black tracking-tight sm:text-2xl ${positive === undefined ? "text-slate-950" : positive ? "text-emerald-700" : "text-rose-700"}`}>{money(value, currency)}</p>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </article>;
}

export default function FinanceReportsPage() {
  const [report, setReport] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState<Currency>("AOA");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth("/api/admin/finance/analytics");
      setReport(response.data as Analytics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os relatórios financeiros.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const months = report?.series ?? [];
  const filteredMonths = useMemo(() => months.filter((month) => (!fromMonth || month.month >= fromMonth) && (!toMonth || month.month <= toMonth)), [months, fromMonth, toMonth]);
  const totals = useMemo(() => filteredMonths.reduce((sum, month) => {
    const income = currency === "AOA" ? month.incomeAOA : month.incomeEUR;
    const gateway = currency === "AOA" ? month.gatewayIncomeAOA : month.gatewayIncomeEUR;
    const other = currency === "AOA" ? month.otherIncomeAOA : month.otherIncomeEUR;
    const expenses = currency === "AOA" ? month.expensesAOA : month.expensesEUR;
    const balance = currency === "AOA" ? month.balanceAOA : month.balanceEUR;
    return { income: sum.income + income, gateway: sum.gateway + gateway, other: sum.other + other, expenses: sum.expenses + expenses, balance: sum.balance + balance };
  }, { income: 0, gateway: 0, other: 0, expenses: 0, balance: 0 }), [filteredMonths, currency]);

  const exportCsv = () => {
    if (!report) return;
    const rows: (string | number)[][] = [
      ["Relatório financeiro", currency],
      ["Período", filteredMonths.length ? `${filteredMonths[0].label} - ${filteredMonths[filteredMonths.length - 1].label}` : "Sem dados"],
      [],
      ["Mês", "Receita total", "Receita de pagamentos", "Outras receitas", "Despesas", "Resultado"],
      ...filteredMonths.map((month) => [month.label,
        currency === "AOA" ? month.incomeAOA : month.incomeEUR,
        currency === "AOA" ? month.gatewayIncomeAOA : month.gatewayIncomeEUR,
        currency === "AOA" ? month.otherIncomeAOA : month.otherIncomeEUR,
        currency === "AOA" ? month.expensesAOA : month.expensesEUR,
        currency === "AOA" ? month.balanceAOA : month.balanceEUR]),
      [],
      ["Previsão", report.forecast.targetMonth],
      ["Receita prevista", report.forecast[currency].income.value ?? "Dados insuficientes"],
      ["Despesas previstas", report.forecast[currency].expenses.value ?? "Dados insuficientes"],
      ["Resultado previsto", report.forecast[currency].balance.value ?? "Dados insuficientes"],
      [],
      ["Alertas de despesas", "Categoria", "Descrição", "Data", "Valor", "Mediana da categoria", "Referências"],
      ...report.anomalies.filter((anomaly) => anomaly.currency === currency).map((anomaly) => [anomaly.category, anomaly.category, anomaly.description, dateLabel(anomaly.transactionDate), anomaly.amount, anomaly.median, anomaly.peerCount]),
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `relatorio-financeiro-${currency.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const maximum = Math.max(1, ...filteredMonths.flatMap((month) => [currency === "AOA" ? month.incomeAOA : month.incomeEUR, currency === "AOA" ? month.expensesAOA : month.expensesEUR]));
  const forecast = report?.forecast[currency];
  const currencyAnomalies = report?.anomalies.filter((item) => item.currency === currency) ?? [];

  return <section className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Financeiro</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Relatórios financeiros</h1><p className="mt-1 text-sm text-slate-500">Acompanhe receitas, despesas, resultados e previsões.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Atualizar</button>
        <button type="button" onClick={exportCsv} disabled={!report || loading} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"><ArrowDownToLine size={15} />Exportar CSV</button>
      </div>
    </header>

    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs font-bold text-slate-600">Moeda<select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="AOA">Kwanza (AOA)</option><option value="EUR">Euro (EUR)</option></select></label>
        <label className="block text-xs font-bold text-slate-600">De<input type="month" value={fromMonth} min={months[0]?.month} max={toMonth || months[months.length - 1]?.month} onChange={(event) => setFromMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-bold text-slate-600">Até<input type="month" value={toMonth} min={fromMonth || months[0]?.month} max={months[months.length - 1]?.month} onChange={(event) => setToMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
      </div>
      <p className="inline-flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} />Últimos 12 meses completos · {filteredMonths.length} meses no período</p>
    </div>

    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span>{error}</span><button type="button" onClick={() => void load()} className="font-bold underline">Tentar novamente</button></div>}
    {loading && !report && <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">A carregar relatórios…</div>}

    {report && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Receita total" value={totals.income} currency={currency} detail={`${money(totals.gateway, currency)} em pagamentos`} />
        <StatCard title="Despesas confirmadas" value={totals.expenses} currency={currency} detail={`${filteredMonths.length} meses analisados`} />
        <StatCard title="Resultado líquido" value={totals.balance} currency={currency} detail="Receitas menos despesas" positive={totals.balance >= 0} />
        <StatCard title="Outras receitas" value={totals.other} currency={currency} detail="Movimentos financeiros confirmados" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black text-slate-950">Evolução mensal</h2><p className="mt-1 text-xs text-slate-500">Receitas e despesas confirmadas por mês.</p></div><div className="flex gap-3 text-xs text-slate-600"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />Receitas</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-rose-400" />Despesas</span></div></div>
          {filteredMonths.length ? <div className="mt-6 overflow-x-auto"><div className="flex h-52 min-w-[640px] items-end gap-2 border-b border-l border-slate-200 px-3 pb-1">{filteredMonths.map((month) => {
            const income = currency === "AOA" ? month.incomeAOA : month.incomeEUR;
            const expenses = currency === "AOA" ? month.expensesAOA : month.expensesEUR;
            return <div key={month.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"><div className="flex h-[calc(100%-24px)] w-full items-end justify-center gap-1"><span title={`${month.label}: receitas ${money(income, currency)}`} className="w-3 rounded-t bg-emerald-600" style={{ height: `${income > 0 ? Math.max(2, income / maximum * 100) : 0}%` }} /><span title={`${month.label}: despesas ${money(expenses, currency)}`} className="w-3 rounded-t bg-rose-400" style={{ height: `${expenses > 0 ? Math.max(2, expenses / maximum * 100) : 0}%` }} /></div><span className="mt-2 whitespace-nowrap text-[10px] text-slate-500">{month.label}</span></div>;
          })}</div></div> : <p className="py-12 text-center text-sm text-slate-500">Não há meses no intervalo escolhido.</p>}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-950">Previsão para {report.forecast.targetMonth}</h2><p className="mt-1 text-xs text-slate-500">Estimativa baseada no histórico mensal.</p></div><TrendingUp size={18} className="text-blue-700" /></div>
          <div className="mt-5 space-y-4">{([["Receita", forecast?.income], ["Despesas", forecast?.expenses], ["Resultado", forecast?.balance]] as const).map(([label, metric]) => <div key={label} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-600">{label}</span><span className="text-sm font-black text-slate-950">{metric?.value === null || metric?.value === undefined ? "Sem dados suficientes" : money(metric.value, currency)}</span></div>{metric?.value !== null && metric?.value !== undefined && <p className="mt-1 text-right text-[11px] text-slate-500">Intervalo: {money(metric.lower ?? 0, currency)} – {money(metric.upper ?? 0, currency)}</p>}<p className="mt-1 text-[10px] text-slate-400">{metric?.observations ?? 0} meses com atividade</p></div>)}</div>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">{report.methods.forecast}</p>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5"><h2 className="font-black text-slate-950">Detalhe mensal</h2><p className="mt-1 text-xs text-slate-500">Valores em {currency}; pagamentos e lançamentos confirmados.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-bold">Mês</th><th className="px-4 py-3 text-right font-bold">Receitas</th><th className="px-4 py-3 text-right font-bold">Despesas</th><th className="px-4 py-3 text-right font-bold">Resultado</th><th className="px-4 py-3 text-right font-bold">Margem</th></tr></thead><tbody className="divide-y divide-slate-100">{[...filteredMonths].reverse().map((month) => {
          const income = currency === "AOA" ? month.incomeAOA : month.incomeEUR;
          const expenses = currency === "AOA" ? month.expensesAOA : month.expensesEUR;
          const balance = currency === "AOA" ? month.balanceAOA : month.balanceEUR;
          const margin = income ? balance / income * 100 : 0;
          return <tr key={month.month} className="hover:bg-slate-50"><td className="px-4 py-3 font-semibold text-slate-800">{month.label}</td><td className="px-4 py-3 text-right tabular-nums">{money(income, currency)}</td><td className="px-4 py-3 text-right tabular-nums text-rose-700">{money(expenses, currency)}</td><td className={`px-4 py-3 text-right font-bold tabular-nums ${balance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{money(balance, currency)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-600">{numberFormat.format(margin)}%</td></tr>;
        })}{!filteredMonths.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Sem movimentos neste intervalo.</td></tr>}</tbody></table></div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 p-4 sm:p-5"><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><AlertTriangle size={17} /></span><div><h2 className="font-black text-slate-950">Alertas de despesas</h2><p className="mt-1 text-xs text-slate-500">Despesas que se afastam dos valores habituais da categoria nos últimos 90 dias.</p></div></div>
        {currencyAnomalies.length ? <div className="divide-y divide-slate-100">{currencyAnomalies.map((item) => <article key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{item.description}</p><p className="mt-1 text-xs text-slate-500">{item.category} · {dateLabel(item.transactionDate)} · {item.peerCount} referências na categoria</p></div><div className="shrink-0 text-left sm:text-right"><p className="font-black text-amber-700">{money(item.amount, currency)}</p><p className="mt-1 text-[11px] text-slate-500">Mediana: {money(item.median, currency)}</p></div></article>)}</div> : <p className="p-5 text-sm text-slate-500">Não foram identificadas despesas fora do padrão nesta moeda.</p>}
        <p className="border-t border-slate-100 px-4 py-3 text-[11px] leading-relaxed text-slate-400">{report.methods.anomalies}</p>
      </section>
      <p className="flex items-center gap-2 text-[11px] text-slate-400"><TrendingDown size={13} />A análise usa os últimos 12 meses completos; os alertas de despesas cobrem os últimos 90 dias.</p>
    </>}
  </section>;
}
