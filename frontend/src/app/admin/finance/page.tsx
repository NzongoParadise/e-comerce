"use client";

import { FormEvent, useEffect, useState } from "react";
import { Activity, AlertTriangle, FileDown, LoaderCircle, Plus, Search, TrendingUp, X } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type FinanceType = "INCOME" | "EXPENSE";
type FinanceStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
type FinanceEvent = { id: number; eventType: string; actorExternalId?: string | null; createdAt: string; payload: unknown };
type FinanceEntry = {
  id: number;
  type: FinanceType;
  description: string;
  category: string;
  amount: string | number;
  currency: "AOA" | "EUR";
  status: FinanceStatus;
  transactionDate: string;
  reference?: string | null;
  notes?: string | null;
  events?: FinanceEvent[];
};
type FinanceStats = { incomeAOA: number; incomeEUR: number; gatewayIncomeAOA: number; gatewayIncomeEUR: number; paidPaymentCount: number; expensesAOA: number; expensesEUR: number; balanceAOA: number; balanceEUR: number; pending: number; cancelled: number };
type FinanceForm = { type: FinanceType; description: string; category: string; amount: string; currency: "AOA" | "EUR"; status: "PENDING" | "CONFIRMED"; transactionDate: string; reference: string; notes: string; note: string };
type ForecastMetric = { value: number | null; lower: number | null; upper: number | null; method: "LINEAR_TREND" | "MOVING_AVERAGE" | "MIXED" | null; observations: number };
type FinanceMonth = { month: string; label: string; incomeAOA: number; incomeEUR: number; expensesAOA: number; expensesEUR: number; balanceAOA: number; balanceEUR: number };
type FinanceAnomaly = { id: number; category: string; currency: string; amount: number; description: string; transactionDate: string; robustScore: number; peerCount: number; median: number };
type FinanceAnalytics = {
  series: FinanceMonth[];
  forecast: { targetMonth: string; AOA: { income: ForecastMetric; expenses: ForecastMetric; balance: ForecastMetric }; EUR: { income: ForecastMetric; expenses: ForecastMetric; balance: ForecastMetric } };
  anomalies: FinanceAnomaly[];
  methods: { forecast: string; anomalies: string };
};

const emptyForm: FinanceForm = { type: "INCOME", description: "", category: "", amount: "", currency: "AOA", status: "CONFIRMED", transactionDate: new Date().toISOString().slice(0, 10), reference: "", notes: "", note: "" };
const statusLabels: Record<FinanceStatus, string> = { PENDING: "Pendente", CONFIRMED: "Confirmado", CANCELLED: "Cancelado" };
const statusStyles: Record<FinanceStatus, string> = { PENDING: "bg-amber-50 text-amber-800", CONFIRMED: "bg-emerald-50 text-emerald-800", CANCELLED: "bg-gray-100 text-gray-600" };

function money(value: string | number, currency: string) {
  const amount = Number(value || 0);
  return currency === "EUR"
    ? `€ ${amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
    : `Kz ${amount.toLocaleString("pt-AO", { minimumFractionDigits: 2 })}`;
}

function toDateInputValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function startOfCurrentMonth() {
  const now = new Date();
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function todayDate() {
  return toDateInputValue(new Date());
}

function createFinanceQuery(filters: { search: string; type: string; status: string; currency: string; category: string; dateFrom: string; dateTo: string; page: number; pageSize: number }) {
  const query = new URLSearchParams({
    search: filters.search,
    type: filters.type,
    status: filters.status,
    currency: filters.currency,
    category: filters.category.trim(),
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  if (filters.dateFrom) query.set("from", filters.dateFrom);
  if (filters.dateTo) query.set("to", filters.dateTo);
  return query;
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="border border-gray-200 bg-white p-4"><p className="text-[10px] font-bold uppercase text-gray-500">{label}</p><p className="mt-2 text-xl font-black text-gray-900">{money(value, detail)}</p></div>;
}

function forecastDescription(method: ForecastMetric["method"]) {
  if (method === "LINEAR_TREND") return "Tendência linear · 6 meses";
  if (method === "MOVING_AVERAGE") return "Média móvel · 3 meses";
  if (method === "MIXED") return "Modelos combinados";
  return "Dados insuficientes";
}

function ForecastCard({ title, currency, forecast }: { title: string; currency: string; forecast: ForecastMetric }) {
  return <div className="border border-gray-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase text-gray-500">{title}</p><TrendingUp size={15} className="text-emerald-700" /></div>{forecast.value === null ? <p className="mt-3 text-sm font-bold text-gray-500">Dados insuficientes</p> : <><p className="mt-2 text-lg font-black text-gray-900">{money(forecast.value, currency)}</p><p className="mt-1 text-[9px] text-gray-500">Intervalo estimado: {money(forecast.lower || 0, currency)} a {money(forecast.upper || 0, currency)}</p></>}<p className="mt-2 text-[9px] font-semibold text-emerald-800">{forecastDescription(forecast.method)}</p><p className="text-[9px] text-gray-500">{forecast.observations} meses com atividade</p></div>;
}

function MonthlyTrend({ series, currency }: { series: FinanceMonth[]; currency: "AOA" | "EUR" }) {
  const values = series.map((month) => ({
    month,
    income: currency === "AOA" ? month.incomeAOA : month.incomeEUR,
    expenses: currency === "AOA" ? month.expensesAOA : month.expensesEUR,
  }));
  const maximum = Math.max(1, ...values.flatMap((point) => [point.income, point.expenses]));

  return <section className="border border-gray-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-black">Fluxo mensal · {currency}</h3><div className="flex gap-3 text-[9px] text-gray-500"><span><i className="mr-1 inline-block h-2 w-2 bg-emerald-600" />Receita</span><span><i className="mr-1 inline-block h-2 w-2 bg-rose-400" />Despesa</span></div></div><div role="img" aria-label={`Receitas e despesas mensais em ${currency} nos últimos 12 meses`} className="mt-4 overflow-x-auto"><div className="flex h-32 min-w-[560px] items-end gap-2 border-b border-l border-gray-200 px-2 pb-1">{values.map(({ month, income, expenses }) => <div key={month.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"><div className="flex h-[calc(100%-18px)] w-full items-end justify-center gap-0.5"><span title={`${month.label} · receitas ${money(income, currency)}`} className="min-h-0.5 w-2 rounded-t bg-emerald-600" style={{ height: `${income > 0 ? Math.max(3, income / maximum * 100) : 0}%` }} /><span title={`${month.label} · despesas ${money(expenses, currency)}`} className="min-h-0.5 w-2 rounded-t bg-rose-400" style={{ height: `${expenses > 0 ? Math.max(3, expenses / maximum * 100) : 0}%` }} /></div><span className="mt-1 whitespace-nowrap text-[8px] text-gray-500">{month.label}</span></div>)}</div></div></section>;
}

export default function FinancePage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [stats, setStats] = useState<FinanceStats>({ incomeAOA: 0, incomeEUR: 0, gatewayIncomeAOA: 0, gatewayIncomeEUR: 0, paidPaymentCount: 0, expensesAOA: 0, expensesEUR: 0, balanceAOA: 0, balanceEUR: 0, pending: 0, cancelled: 0 });
  const [analytics, setAnalytics] = useState<FinanceAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<FinanceEntry | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currencyFilter, setCurrencyFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [period, setPeriod] = useState("MONTH");
  const [dateFrom, setDateFrom] = useState(startOfCurrentMonth);
  const [dateTo, setDateTo] = useState(todayDate);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FinanceForm>(emptyForm);
  const [cancelNote, setCancelNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selected = selectedDetail?.id === selectedId ? selectedDetail : entries.find((entry) => entry.id === selectedId) || null;

  async function loadEntries() {
    setLoading(true);
    setError("");
    try {
      const query = createFinanceQuery({ search, type: typeFilter, status: statusFilter, currency: currencyFilter, category: categoryFilter, dateFrom, dateTo, page, pageSize: 20 });
      const response = await fetchWithAuth(`/api/admin/finance?${query}`);
      setEntries(response.data);
      setStats(response.stats);
      setPageCount(response.meta.pageCount || 1);
      setSelectedId((current: number | null) => response.data.some((entry: FinanceEntry) => entry.id === current) ? current : response.data[0]?.id || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os movimentos financeiros.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const query = createFinanceQuery({ search, type: typeFilter, status: statusFilter, currency: currencyFilter, category: categoryFilter, dateFrom, dateTo, page, pageSize: 20 });
          const response = await fetchWithAuth(`/api/admin/finance?${query}`);
          if (!active) return;
          setEntries(response.data);
          setStats(response.stats);
          setPageCount(response.meta.pageCount || 1);
          setSelectedId((current: number | null) => response.data.some((entry: FinanceEntry) => entry.id === current) ? current : response.data[0]?.id || null);
        } catch (loadError) {
          if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os movimentos financeiros.");
        } finally { if (active) setLoading(false); }
      })();
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, typeFilter, statusFilter, currencyFilter, categoryFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/admin/finance/analytics")
      .then((response) => { if (active) setAnalytics(response.data); })
      .catch((loadError) => { if (active) setAnalyticsError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a análise financeira."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let active = true;
    fetchWithAuth(`/api/admin/finance/${selectedId}`)
      .then((response) => { if (active) setSelectedDetail(response.data); })
      .catch(() => { if (active) setSelectedDetail(null); });
    return () => { active = false; };
  }, [selectedId]);

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const url = editingId ? `/api/admin/finance/${editingId}` : "/api/admin/finance";
      const response = await fetchWithAuth(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount), note: form.note.trim() }),
      });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setNotice(editingId ? "Movimento atualizado com registo de auditoria." : "Movimento financeiro registado.");
      await loadEntries();
      setSelectedId(response.data.id);
      setSelectedDetail(response.data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar o movimento.");
    } finally { setBusy(false); }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, transactionDate: new Date().toISOString().slice(0, 10) });
    setError("");
    setShowForm(true);
  }

  function changePeriod(value: string) {
    setPeriod(value);
    setPage(1);
    if (value === "ALL") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const today = new Date();
    setDateTo(toDateInputValue(today));
    if (value === "MONTH") {
      setDateFrom(startOfCurrentMonth());
    } else if (value === "30D" || value === "90D") {
      const days = value === "30D" ? 29 : 89;
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
      setDateFrom(toDateInputValue(from));
    }
  }

  function openEdit(entry: FinanceEntry) {
    setEditingId(entry.id);
    setForm({
      type: entry.type,
      description: entry.description,
      category: entry.category,
      amount: String(entry.amount),
      currency: entry.currency,
      status: entry.status === "PENDING" ? "PENDING" : "CONFIRMED",
      transactionDate: new Date(entry.transactionDate).toISOString().slice(0, 10),
      reference: entry.reference || "",
      notes: entry.notes || "",
      note: "",
    });
    setError("");
    setShowForm(true);
  }

  async function cancelEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await fetchWithAuth(`/api/admin/finance/${selected.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: cancelNote }),
      });
      setCancelNote("");
      setNotice("Movimento cancelado; o histórico foi preservado.");
      await loadEntries();
      setSelectedDetail(null);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Não foi possível cancelar o movimento.");
    } finally { setBusy(false); }
  }

  async function exportEntries() {
    setError("");
    try {
      const allEntries: FinanceEntry[] = [];
      let currentPage = 1;
      let pageTotal = 1;
      while (currentPage <= pageTotal) {
        const query = createFinanceQuery({ search, type: typeFilter, status: statusFilter, currency: currencyFilter, category: categoryFilter, dateFrom, dateTo, page: currentPage, pageSize: 100 });
        const response = await fetchWithAuth(`/api/admin/finance?${query}`);
        allEntries.push(...response.data);
        pageTotal = response.meta.pageCount || 1;
        currentPage += 1;
      }
      const rows = [["Tipo", "Descrição", "Categoria", "Valor", "Moeda", "Estado", "Data", "Referência"], ...allEntries.map((entry) => [entry.type, entry.description, entry.category, String(entry.amount), entry.currency, statusLabels[entry.status], new Date(entry.transactionDate).toLocaleDateString("pt-PT"), entry.reference || ""])];
      const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "movimentos-financeiros-rubrica-diligente.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Não foi possível exportar os movimentos.");
    }
  }

  return <main>
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800">Livro financeiro</p><h1 className="mt-1 text-2xl font-black">Movimentos financeiros</h1><p className="mt-1 text-sm text-gray-500">Vendas online pagas são reconciliadas automaticamente. Lance aqui outras receitas e despesas.</p></div><div className="flex gap-2"><button type="button" onClick={exportEntries} className="inline-flex items-center gap-2 border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><FileDown size={15} />Exportar relatório CSV</button><button type="button" onClick={openCreate} className="inline-flex items-center gap-2 bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800"><Plus size={15} />Novo movimento</button></div></div>
    {notice && <div role="status" className="mb-4 flex items-center justify-between border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={16} /></button></div>}
    {error && <div role="alert" className="mb-4 flex items-center justify-between border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}<button type="button" onClick={() => setError("")} aria-label="Fechar erro"><X size={16} /></button></div>}
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Vendas pagas · AOA" value={stats.gatewayIncomeAOA} detail="AOA" /><Metric label="Outras receitas · AOA" value={stats.incomeAOA} detail="AOA" /><Metric label="Despesas · AOA" value={stats.expensesAOA} detail="AOA" /><Metric label="Saldo operacional · AOA" value={stats.balanceAOA} detail="AOA" /><Metric label="Vendas pagas · EUR" value={stats.gatewayIncomeEUR} detail="EUR" /><Metric label="Outras receitas · EUR" value={stats.incomeEUR} detail="EUR" /><Metric label="Despesas · EUR" value={stats.expensesEUR} detail="EUR" /><Metric label="Saldo operacional · EUR" value={stats.balanceEUR} detail="EUR" /></div>
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs"><span className="border border-emerald-200 bg-emerald-50 px-3 py-2 font-bold text-emerald-800">{stats.paidPaymentCount} pagamentos liquidados</span><span className="border border-amber-200 bg-amber-50 px-3 py-2 font-bold text-amber-800">{stats.pending} movimento(s) pendente(s)</span><span className="border border-gray-200 bg-white px-3 py-2 font-bold text-gray-600">{stats.cancelled} cancelado(s)</span></div>
    <section className="mb-5 border border-gray-200 bg-white p-4"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xs font-black text-gray-800">Período e reconciliação</h2><p className="mt-1 text-[10px] text-gray-500">Vendas pagas vêm das encomendas; receitas manuais não incluem pagamentos do gateway.</p></div><select value={period} onChange={(event) => changePeriod(event.target.value)} aria-label="Período financeiro" className="border border-gray-300 bg-white px-3 py-2 text-xs"><option value="MONTH">Este mês</option><option value="30D">Últimos 30 dias</option><option value="90D">Últimos 90 dias</option><option value="CUSTOM">Período personalizado</option><option value="ALL">Todo o histórico</option></select></div>{period === "CUSTOM" && <div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold text-gray-600">De<input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs" /></label><label className="text-[10px] font-bold text-gray-600">Até<input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs" /></label></div>}</section>
    {analyticsError && <div role="status" className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Análise preditiva indisponível. Verifique se a migração financeira está aplicada e tente novamente.</div>}
    {analytics && <section className="mb-5 space-y-4">
      <div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800"><Activity size={14} />Ciência de dados</p><h2 className="mt-1 text-lg font-black">Tendências e controlo de risco</h2><p className="mt-1 text-xs text-gray-500">Previsão para {analytics.forecast.targetMonth}, com base nos últimos 12 meses completos.</p></div><span className="hidden border border-gray-200 bg-white px-3 py-2 text-[10px] font-semibold text-gray-600 sm:inline">Série mensal · AOA e EUR</span></div>
      <div className="grid gap-4 xl:grid-cols-2"><MonthlyTrend series={analytics.series} currency="AOA" /><MonthlyTrend series={analytics.series} currency="EUR" /></div>
      <div className="border border-gray-200 bg-white p-4"><div className="mb-3"><h3 className="text-xs font-black">Previsão do mês atual</h3><p className="mt-1 text-[10px] text-gray-500">Estimativa de receita, despesa e saldo para {analytics.forecast.targetMonth}. O intervalo mostra a variação observada no modelo.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><ForecastCard title="Receita · AOA" currency="AOA" forecast={analytics.forecast.AOA.income} /><ForecastCard title="Despesa · AOA" currency="AOA" forecast={analytics.forecast.AOA.expenses} /><ForecastCard title="Saldo · AOA" currency="AOA" forecast={analytics.forecast.AOA.balance} /><ForecastCard title="Receita · EUR" currency="EUR" forecast={analytics.forecast.EUR.income} /><ForecastCard title="Despesa · EUR" currency="EUR" forecast={analytics.forecast.EUR.expenses} /><ForecastCard title="Saldo · EUR" currency="EUR" forecast={analytics.forecast.EUR.balance} /></div></div>
      <div className="border border-gray-200 bg-white p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xs font-black"><AlertTriangle size={14} className="text-amber-700" />Despesas fora do padrão</h3><p className="mt-1 text-[10px] text-gray-500">Comparação por categoria e moeda nos últimos 90 dias.</p></div><span className="text-[10px] font-bold text-gray-500">{analytics.anomalies.length} alerta(s)</span></div>{analytics.anomalies.length === 0 ? <p className="border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs text-emerald-800">Nenhuma despesa atípica detetada com amostra estatística suficiente.</p> : <div className="divide-y divide-gray-100">{analytics.anomalies.map((anomaly) => <button key={anomaly.id} type="button" onClick={() => { setCategoryFilter(anomaly.category); setCurrencyFilter(anomaly.currency); setTypeFilter("EXPENSE"); setStatusFilter("CONFIRMED"); changePeriod("90D"); }} className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left hover:bg-amber-50/50"><span><strong className="block text-xs text-gray-800">{anomaly.description}</strong><span className="text-[10px] text-gray-500">{anomaly.category} · {new Date(anomaly.transactionDate).toLocaleDateString("pt-PT")} · {anomaly.peerCount} comparáveis</span></span><span className="text-right"><strong className="block text-xs text-amber-800">{money(anomaly.amount, anomaly.currency)}</strong><span className="text-[9px] text-gray-500">mediana {money(anomaly.median, anomaly.currency)} · score {anomaly.robustScore.toFixed(1)}</span></span></button>)}</div>}<details className="mt-3 border-t border-gray-100 pt-3"><summary className="cursor-pointer text-[10px] font-semibold text-gray-600">Metodologia</summary><p className="mt-2 text-[10px] leading-5 text-gray-500">{analytics.methods.forecast} {analytics.methods.anomalies}</p></details></div>
    </section>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 border border-gray-200 bg-white">
        <div className="grid gap-2 border-b border-gray-200 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.5fr)_minmax(130px,1fr)_120px_130px_150px] xl:items-center"><div className="relative min-w-0"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Descrição ou referência" aria-label="Pesquisar movimentos financeiros" className="w-full border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-emerald-700" /></div><input value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} placeholder="Categoria" aria-label="Filtrar por categoria" className="min-w-0 border border-gray-200 px-3 py-2.5 text-xs outline-none focus:border-emerald-700" /><select value={currencyFilter} onChange={(event) => { setCurrencyFilter(event.target.value); setPage(1); }} aria-label="Filtrar moeda" className="border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="ALL">Todas moedas</option><option value="AOA">AOA</option><option value="EUR">EUR</option></select><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} aria-label="Filtrar tipo de movimento" className="border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="ALL">Receitas e despesas</option><option value="INCOME">Receitas</option><option value="EXPENSE">Despesas</option></select><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filtrar estado" className="border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="ALL">Todos os estados</option><option value="PENDING">Pendentes</option><option value="CONFIRMED">Confirmados</option><option value="CANCELLED">Cancelados</option></select></div>
        <div className="hidden grid-cols-[1.3fr_1fr_0.8fr_0.9fr_0.9fr] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[9px] font-black uppercase text-gray-500 md:grid"><span>Movimento</span><span>Categoria</span><span>Data</span><span>Estado</span><span className="text-right">Valor</span></div>
        <div className="divide-y divide-gray-100">{loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500"><LoaderCircle size={16} className="animate-spin" />A carregar movimentos...</div> : entries.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">Não existem movimentos para estes filtros.</div> : entries.map((entry) => <button type="button" key={entry.id} onClick={() => setSelectedId(entry.id)} className={`grid w-full gap-2 px-4 py-3 text-left hover:bg-emerald-50/40 md:grid-cols-[1.3fr_1fr_0.8fr_0.9fr_0.9fr] md:items-center ${selectedId === entry.id ? "bg-emerald-50/60" : ""}`}><span className="min-w-0"><strong className="block truncate text-xs text-gray-900">{entry.description}</strong><span className={`text-[9px] font-bold ${entry.type === "INCOME" ? "text-emerald-700" : "text-red-700"}`}>{entry.type === "INCOME" ? "Receita" : "Despesa"}{entry.reference ? ` · ${entry.reference}` : ""}</span></span><span className="truncate text-xs text-gray-600">{entry.category}</span><span className="text-[10px] text-gray-600">{new Date(entry.transactionDate).toLocaleDateString("pt-PT")}</span><span className={`w-fit px-2 py-1 text-[9px] font-bold ${statusStyles[entry.status]}`}>{statusLabels[entry.status]}</span><strong className={`text-right text-xs ${entry.type === "INCOME" ? "text-emerald-700" : "text-red-700"}`}>{entry.type === "INCOME" ? "+ " : "− "}{money(entry.amount, entry.currency)}</strong></button>)}</div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500"><span>Página {page} de {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="border border-gray-200 px-3 py-1.5 disabled:opacity-40">Anterior</button><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="border border-gray-200 px-3 py-1.5 disabled:opacity-40">Seguinte</button></div></div>
      </section>
      <aside className="border border-gray-200 bg-white">{!selected ? <div className="p-8 text-center text-sm text-gray-500">Selecione um movimento para consultar os detalhes.</div> : <><div className="border-b border-gray-200 p-4"><p className="text-[9px] font-black uppercase tracking-widest text-emerald-800">Detalhe do movimento</p><h2 className="mt-1 text-base font-black">{selected.description}</h2><span className={`mt-2 inline-flex px-2 py-1 text-[9px] font-bold ${statusStyles[selected.status]}`}>{statusLabels[selected.status]}</span></div><div className="space-y-3 p-4 text-xs"><p><span className="text-gray-500">Tipo:</span> <strong>{selected.type === "INCOME" ? "Receita" : "Despesa"}</strong></p><p><span className="text-gray-500">Categoria:</span> <strong>{selected.category}</strong></p><p><span className="text-gray-500">Valor:</span> <strong>{money(selected.amount, selected.currency)}</strong></p><p><span className="text-gray-500">Data:</span> <strong>{new Date(selected.transactionDate).toLocaleString("pt-PT")}</strong></p>{selected.reference && <p><span className="text-gray-500">Referência:</span> <strong>{selected.reference}</strong></p>}{selected.notes && <p className="whitespace-pre-wrap"><span className="text-gray-500">Notas:</span> {selected.notes}</p>}{selected.status !== "CANCELLED" && <div className="border-t border-gray-100 pt-3"><button type="button" onClick={() => openEdit(selected)} className="w-full border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">Editar</button></div>}{selected.status !== "CANCELLED" && <form onSubmit={cancelEntry} className="space-y-2"><label className="block text-[10px] font-semibold text-gray-600">Justificativa para cancelar<textarea required minLength={8} maxLength={500} value={cancelNote} onChange={(event) => setCancelNote(event.target.value)} rows={2} className="mt-1 w-full border border-gray-200 px-2 py-2 text-xs" /></label><button type="submit" disabled={busy || cancelNote.trim().length < 8} className="w-full border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">{busy ? "A cancelar..." : "Confirmar cancelamento"}</button></form>}<section className="border-t border-gray-100 pt-3"><h3 className="mb-2 text-[10px] font-black uppercase text-gray-500">Histórico de auditoria</h3><div className="space-y-2">{((selectedDetail?.id === selected.id ? selectedDetail?.events : selected.events) || []).map((event) => <details key={event.id} className="border-l-2 border-emerald-200 pl-2"><summary className="cursor-pointer text-[10px] font-bold text-gray-700">{event.eventType} · {new Date(event.createdAt).toLocaleString("pt-PT")}</summary><pre className="mt-1 overflow-auto whitespace-pre-wrap text-[9px] text-gray-500">{JSON.stringify(event.payload, null, 2)}</pre></details>)}</div></section></div></>}</aside>
    </div>

    {showForm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"><section role="dialog" aria-modal="true" aria-labelledby="finance-entry-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4"><div><h2 id="finance-entry-title" className="text-lg font-black">{editingId ? "Editar movimento" : "Novo movimento"}</h2><p className="mt-1 text-xs text-gray-500">As alterações ficam guardadas no histórico de auditoria.</p></div><button type="button" onClick={() => setShowForm(false)} aria-label="Fechar" className="p-2 text-gray-500 hover:bg-gray-100"><X size={18} /></button></div><form onSubmit={submitEntry} className="space-y-4 p-5"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-gray-700">Tipo<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as FinanceType }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5"><option value="INCOME">Receita</option><option value="EXPENSE">Despesa</option></select></label><label className="text-xs font-bold text-gray-700">Estado<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "PENDING" | "CONFIRMED" }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5"><option value="CONFIRMED">Confirmado</option><option value="PENDING">Pendente</option></select></label><label className="text-xs font-bold text-gray-700 sm:col-span-2">Descrição<input required minLength={3} maxLength={180} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="text-xs font-bold text-gray-700">Categoria<input required minLength={2} maxLength={80} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ex.: Fornecedores" className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="text-xs font-bold text-gray-700">Referência<input maxLength={100} value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="text-xs font-bold text-gray-700">Valor<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="text-xs font-bold text-gray-700">Moeda<select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value as "AOA" | "EUR" }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5"><option value="AOA">AOA · Kwanza</option><option value="EUR">EUR · Euro</option></select></label><label className="text-xs font-bold text-gray-700 sm:col-span-2">Data<input required type="date" value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="text-xs font-bold text-gray-700 sm:col-span-2">Notas<textarea maxLength={1000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="mt-1 w-full resize-y border border-gray-300 px-3 py-2.5" /></label><label className="text-xs font-bold text-gray-700 sm:col-span-2">Justificativa da {editingId ? "edição" : "criação"} (mínimo 8 caracteres)<textarea required minLength={8} maxLength={500} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={2} className="mt-1 w-full resize-y border border-gray-300 px-3 py-2.5" /></label></div><div className="flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">Fechar</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy && <LoaderCircle size={15} className="animate-spin" />}{busy ? "A guardar..." : "Guardar movimento"}</button></div></form></section></div>}
  </main>;
}
