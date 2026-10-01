"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Payment = {
  id: number;
  status: string;
  provider: string;
  method: string;
  currency: string;
  amountEUR: string | number;
  amountKZ: string | number;
  providerPaymentId?: string | null;
  reference?: string | null;
  paidAt?: string | null;
  createdAt: string;
  user: { name?: string | null; email?: string | null; accountName?: string | null };
  order: { id: number; orderNumber: string; status: string; currency: string; totalEUR: string | number; totalKZ: string | number };
};
type Stats = { pending: number; paid: number; failed: number; review: number };

function dateInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const statusStyle: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  PROCESSING: "bg-blue-50 text-blue-800",
  REQUIRES_PAYMENT: "bg-amber-50 text-amber-800",
  PAID: "bg-emerald-50 text-emerald-800",
  FAILED: "bg-red-50 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-gray-100 text-gray-700",
  REFUNDED: "bg-violet-50 text-violet-700",
};

function formatPayment(payment: Payment) {
  const value = payment.currency === "EUR" ? Number(payment.amountEUR) : Number(payment.amountKZ);
  return payment.currency === "EUR"
    ? `€ ${value.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
    : `Kz ${value.toLocaleString("pt-AO", { minimumFractionDigits: 2 })}`;
}

export default function FinancePaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, paid: 0, failed: 0, review: 0 });
  const [selected, setSelected] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [currency, setCurrency] = useState("ALL");
  const [period, setPeriod] = useState("MONTH");
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => dateInputValue(new Date()));
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const query = new URLSearchParams({ search, status, currency, page: String(page), pageSize: "20" });
          if (dateFrom) query.set("from", dateFrom);
          if (dateTo) query.set("to", dateTo);
          const response = await fetchWithAuth(`/api/admin/finance/payments?${query}`);
          if (!active) return;
          setPayments(response.data);
          setStats(response.stats);
          setPageCount(response.meta.pageCount || 1);
          setSelected((current) => response.data.find((payment: Payment) => payment.id === current?.id) || response.data[0] || null);
        } catch (loadError) {
          if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os pagamentos.");
        } finally { if (active) setLoading(false); }
      })();
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, status, currency, dateFrom, dateTo, page]);

  function changePeriod(value: string) {
    setPeriod(value);
    setPage(1);
    if (value === "ALL") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const now = new Date();
    setDateTo(dateInputValue(now));
    if (value === "MONTH") {
      setDateFrom(dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
    } else if (value === "30D") {
      setDateFrom(dateInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)));
    }
  }

  return <main>
    <div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800">Financeiro · Gateway</p><h1 className="mt-1 text-2xl font-black">Pagamentos</h1><p className="mt-1 text-sm text-gray-500">Consulta dos pagamentos ligados às encomendas. A revisão manual permanece na subopção de revisão.</p></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Pendentes", stats.pending, "text-amber-800"], ["Pagos", stats.paid, "text-emerald-800"], ["Falhados / expirados", stats.failed, "text-red-700"], ["Em revisão", stats.review, "text-orange-800"]].map(([label, value, tone]) => <div key={String(label)} className="border border-gray-200 bg-white p-4"><p className="text-[10px] font-bold uppercase text-gray-500">{label}</p><p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p></div>)}</div>
    {error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 border border-gray-200 bg-white">
        <div className="grid gap-2 border-b border-gray-200 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.4fr)_150px_120px_150px_150px] xl:items-center"><div className="relative min-w-0"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Encomenda, cliente ou referência" className="w-full border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-emerald-700" /></div><select value={period} onChange={(event) => changePeriod(event.target.value)} aria-label="Período dos pagamentos" className="border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="MONTH">Este mês</option><option value="30D">Últimos 30 dias</option><option value="ALL">Todo o histórico</option><option value="CUSTOM">Personalizado</option></select><select value={currency} onChange={(event) => { setCurrency(event.target.value); setPage(1); }} aria-label="Filtrar moeda" className="border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="ALL">Todas moedas</option><option value="AOA">AOA</option><option value="EUR">EUR</option></select><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filtrar estado" className="border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="ALL">Todos os estados</option><option value="PENDING">Pendente</option><option value="PROCESSING">A processar</option><option value="REQUIRES_PAYMENT">Requer pagamento</option><option value="PAID">Pago</option><option value="FAILED">Falhado</option><option value="EXPIRED">Expirado</option><option value="CANCELLED">Cancelado</option><option value="REFUNDED">Reembolsado</option></select>{period === "CUSTOM" && <><input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} aria-label="Data inicial" className="border border-gray-200 px-3 py-2.5 text-xs" /><input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} aria-label="Data final" className="border border-gray-200 px-3 py-2.5 text-xs" /></>}</div>
        <div className="hidden grid-cols-[1fr_1.3fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[9px] font-black uppercase text-gray-500 md:grid"><span>Encomenda</span><span>Cliente</span><span>Método</span><span>Estado</span><span className="text-right">Valor</span></div>
        <div className="divide-y divide-gray-100">{loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500"><LoaderCircle size={16} className="animate-spin" />A carregar pagamentos...</div> : payments.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">Não existem pagamentos para estes filtros.</div> : payments.map((payment) => <button type="button" key={payment.id} onClick={() => setSelected(payment)} className={`grid w-full gap-2 px-4 py-3 text-left hover:bg-emerald-50/40 md:grid-cols-[1fr_1.3fr_0.8fr_0.8fr_0.8fr] md:items-center ${selected?.id === payment.id ? "bg-emerald-50/60" : ""}`}><span><strong className="block text-xs text-gray-900">{payment.order.orderNumber}</strong><span className="text-[9px] text-gray-500">{payment.provider}</span></span><span className="min-w-0"><strong className="block truncate text-xs text-gray-800">{payment.user.accountName || payment.user.name || "Cliente"}</strong><span className="block truncate text-[10px] text-gray-500">{payment.user.email || "Sem email"}</span></span><span className="text-xs text-gray-600">{payment.method}</span><span className={`w-fit px-2 py-1 text-[9px] font-bold ${statusStyle[payment.status] || "bg-gray-100 text-gray-700"}`}>{payment.status}</span><strong className="text-right text-xs text-gray-900">{formatPayment(payment)}</strong></button>)}</div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500"><span>Página {page} de {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="border border-gray-200 px-3 py-1.5 disabled:opacity-40">Anterior</button><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="border border-gray-200 px-3 py-1.5 disabled:opacity-40">Seguinte</button></div></div>
      </section>
      <aside className="border border-gray-200 bg-white">{selected ? <div className="space-y-3 p-4 text-xs"><div className="border-b border-gray-100 pb-3"><p className="text-[9px] font-black uppercase tracking-widest text-emerald-800">Detalhe de pagamento</p><h2 className="mt-1 text-base font-black">{selected.order.orderNumber}</h2></div><p><span className="text-gray-500">Cliente:</span> <strong>{selected.user.accountName || selected.user.name || "Cliente"}</strong></p><p><span className="text-gray-500">Email:</span> {selected.user.email || "—"}</p><p><span className="text-gray-500">Gateway:</span> <strong>{selected.provider}</strong></p><p><span className="text-gray-500">Método:</span> <strong>{selected.method}</strong></p><p><span className="text-gray-500">Estado:</span> <strong>{selected.status}</strong></p><p><span className="text-gray-500">Montante:</span> <strong>{formatPayment(selected)}</strong></p><p><span className="text-gray-500">Referência:</span> <span className="break-all">{selected.reference || selected.providerPaymentId || "—"}</span></p><p><span className="text-gray-500">Criado:</span> {new Date(selected.createdAt).toLocaleString("pt-PT")}</p>{selected.paidAt && <p><span className="text-gray-500">Pago em:</span> {new Date(selected.paidAt).toLocaleString("pt-PT")}</p>}</div> : <div className="p-8 text-center text-sm text-gray-500">Selecione um pagamento para ver detalhes.</div>}</aside>
    </div>
  </main>;
}
