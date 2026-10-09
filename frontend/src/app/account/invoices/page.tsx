"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ExternalLink, FileCheck2, Loader2, RefreshCw } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Invoice = {
  id: number;
  invoiceNumber: string;
  verificationCode: string;
  status: string;
  currency: string;
  totalEUR: string | number;
  totalKZ: string | number;
  issuedAt: string;
  order: { orderNumber: string; status: string; payment: { status: string; paidAt: string | null } | null };
};

function formatMoney(invoice: Invoice) {
  return invoice.currency === "EUR"
    ? "€ " + Number(invoice.totalEUR).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "Kz " + Number(invoice.totalKZ).toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

export default function AccountInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchWithAuth("/api/account/invoices", { cache: "no-store" });
      setInvoices((result.data || []) as Invoice[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as faturas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="section-kicker">Conta · Documentos</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">As minhas faturas</h1><p className="mt-2 text-sm leading-6 text-slate-500">Consulte documentos emitidos para as encomendas da sua conta e valide o QR de cada fatura.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar</button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div>}

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h2 className="text-sm font-black text-slate-950">Documentos emitidos</h2><p className="mt-1 text-[10px] text-slate-500">{invoices.length} fatura(s)</p></div>
        {loading ? <div className="space-y-3 p-5">{[1,2,3].map((id) => <div key={id} className="h-20 animate-pulse rounded-xl bg-slate-50"/>)}</div> : invoices.length ? <div className="divide-y divide-slate-100">
          {invoices.map((invoice) => <article key={invoice.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FileCheck2 size={18}/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-black text-slate-950">{invoice.invoiceNumber}</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">{invoice.status}</span></div><p className="mt-1 text-[10px] text-slate-500">{invoice.order.orderNumber} · {new Date(invoice.issuedAt).toLocaleDateString("pt-PT")} · Pagamento: {invoice.order.payment?.status || "Desconhecido"}</p><p className="mt-1 text-sm font-black text-slate-900">{formatMoney(invoice)}</p></div></div>
            <div className="flex flex-wrap gap-2"><Link href={"/faturas/" + invoice.id} className="btn-primary">Abrir fatura</Link><Link href={"/verificar-fatura/" + encodeURIComponent(invoice.verificationCode)} target="_blank" className="btn-secondary">Validar QR <ExternalLink size={12}/></Link></div>
          </article>)}
        </div> : <div className="p-12 text-center"><FileCheck2 size={32} className="mx-auto text-slate-300"/><h2 className="mt-3 text-sm font-black text-slate-800">Ainda não existem faturas emitidas</h2><p className="mt-1 text-xs leading-5 text-slate-500">Quando uma fatura for emitida para uma das suas encomendas pagas, aparecerá aqui.</p><Link href="/account/orders" className="btn-primary mt-4">Ver encomendas</Link></div>}
      </section>
    </div>
  );
}
