"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, RefreshCw, WalletCards, XCircle } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Payment = {
  id: number;
  status: string;
  method: string;
  currency: string;
  amountEUR: string | number;
  paidAt?: string | null;
  createdAt: string;
  order: { orderNumber: string; status: string };
};

function money(amount: string | number, currency: string) {
  const value = Number(amount);
  return currency === "EUR"
    ? "€ " + value.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "Kz " + value.toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

const statusLabel: Record<string, string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  FAILED: "Falhado",
  CANCELLED: "Cancelado",
};

export default function B2BFinancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth("/api/b2b/finance");
      setData(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o financeiro empresarial.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const payments: Payment[] = data?.payments || [];
  const visible = useMemo(() => filter === "ALL" ? payments : payments.filter((payment) => payment.status === filter), [payments, filter]);

  if (loading) return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-3"><div className="card h-28 animate-pulse" /><div className="card h-28 animate-pulse" /><div className="card h-28 animate-pulse" /></div><div className="card h-80 animate-pulse" /></div>;

  if (error) return <div className="space-y-5"><div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div><button type="button" onClick={() => void load()} className="btn-primary"><RefreshCw size={14} /> Tentar novamente</button></div>;

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="section-kicker">B2B · Financeiro</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Financeiro empresarial</h1>
          <p className="mt-2 text-sm text-slate-500">{data.company.tradeName || data.company.legalName} · NIF {data.company.nif}</p>
        </div>
        <button type="button" onClick={() => void load()} className="btn-secondary"><RefreshCw size={14} /> Atualizar</button>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <FinanceCard label="Total pago" value={money(data.totals.paidEUR || 0, "EUR")} secondaryValue={money(data.totals.paidAOA || 0, "AOA")} icon={CheckCircle2} tone="success" detail="Pagamentos confirmados por moeda" />
        <FinanceCard label="Em aberto" value={money(data.totals.pendingEUR || 0, "EUR")} secondaryValue={money(data.totals.pendingAOA || 0, "AOA")} icon={Clock3} tone="warning" detail="Aguardam confirmação por moeda" />
        <FinanceCard label="Falhados / cancelados" value={money(data.totals.failedEUR || 0, "EUR")} secondaryValue={money(data.totals.failedAOA || 0, "AOA")} icon={XCircle} tone="danger" detail="Valores agrupados pela moeda original" />
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="flex items-center gap-2"><WalletCards size={17} className="text-[#1d6ac4]" /><h2 className="text-sm font-black text-slate-950">Transações da empresa</h2></div><p className="mt-1 text-[10px] text-slate-500">Pagamentos associados às encomendas empresariais.</p></div>
            <div className="flex gap-1 overflow-x-auto">
              {[["ALL", "Todas"], ["PAID", "Pagas"], ["PENDING", "Pendentes"], ["FAILED", "Falhadas"]].map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={filter === id ? "rounded-full bg-[#132238] px-3 py-1.5 text-[9px] font-black text-white" : "rounded-full border border-slate-200 px-3 py-1.5 text-[9px] font-bold text-slate-500 hover:text-slate-900"}>{label}</button>)}
            </div>
          </div>
        </div>

        {visible.length ? (
          <div className="divide-y divide-slate-100">
            {visible.map((payment) => {
              const success = payment.status === "PAID";
              const failed = payment.status === "FAILED" || payment.status === "CANCELLED";
              return <article key={payment.id} className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-5 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${success ? "bg-emerald-50 text-emerald-600" : failed ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
                    {success ? <CheckCircle2 size={18} /> : failed ? <XCircle size={18} /> : <Clock3 size={18} />}
                  </span>
                  <div className="min-w-0"><p className="truncate text-xs font-black text-slate-900">{payment.order.orderNumber}</p><p className="mt-1 text-[9px] text-slate-500">{new Date(payment.createdAt).toLocaleString("pt-PT")} · {payment.method}</p></div>
                </div>
                <strong className="text-sm font-black text-slate-950">{money(payment.currency === "EUR" ? payment.amountEUR : payment.amountKZ, payment.currency)}</strong>
                <span className={`rounded-full px-2.5 py-1.5 text-[9px] font-black ${success ? "bg-emerald-50 text-emerald-700" : failed ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{statusLabel[payment.status] || payment.status}</span>
                {success && <ArrowUpRight size={15} className="hidden text-[#1d6ac4] lg:block" />}
              </article>;
            })}
          </div>
        ) : (
          <div className="p-12 text-center"><WalletCards size={32} className="mx-auto text-slate-300" /><h2 className="mt-3 text-sm font-black text-slate-800">Nenhuma transação neste filtro</h2><p className="mt-1 text-xs text-slate-500">As transações financeiras da empresa aparecerão aqui.</p></div>
        )}
      </section>
    </div>
  );
}

function FinanceCard({ label, value, secondaryValue, detail, icon: Icon, tone }: { label: string; value: string; secondaryValue?: string; detail: string; icon: typeof WalletCards; tone: "success" | "warning" | "danger" }) {
  const tones = {
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-rose-50 text-rose-600",
  };
  return <article className="card p-4 sm:p-5"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={18} /></span><p className="mt-4 text-[10px] font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-black tracking-tight text-slate-950">{value}</p><p className="mt-1 text-[9px] text-slate-400">{detail}</p></article>;
}
