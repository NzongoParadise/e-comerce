"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, FileCheck2, Loader2, Printer, RefreshCw, Send } from "lucide-react";
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
  sellerTaxId: string | null;
  buyerName: string | null;
  buyerTaxId: string | null;
  order: {
    id: number;
    orderNumber: string;
    status: string;
    payment: { status: string; provider: string; paidAt: string | null } | null;
  };
  user: { name: string | null; email: string | null };
};

function formatMoney(invoice: Invoice) {
  return invoice.currency === "EUR"
    ? "€ " + Number(invoice.totalEUR).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "Kz " + Number(invoice.totalKZ).toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

function siteUrl() {
  return typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "")
    : (process.env.NEXT_PUBLIC_SITE_URL || "");
}

function qrSource(invoice: Invoice) {
  const verifyUrl = siteUrl() + "/verificar-fatura/" + encodeURIComponent(invoice.verificationCode);
  return "https://api.qrserver.com/v1/create-qr-code/?size=120x120&format=svg&data=" + encodeURIComponent(verifyUrl);
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchWithAuth("/api/admin/finance/invoices", { cache: "no-store" });
      setInvoices((result.data || []) as Invoice[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as faturas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function issueInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssuing(true);
    setError("");
    setNotice("");
    try {
      const result = await fetchWithAuth("/api/admin/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: Number(orderId) }),
      });
      setNotice(result.idempotent
        ? "A encomenda já tem fatura. Foi devolvido o documento existente."
        : "Fatura " + result.data.invoiceNumber + " emitida.");
      setOrderId("");
      await load();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : "Não foi possível emitir a fatura.");
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="section-kicker">Financeiro · Documentos</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Faturas comerciais</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Emita uma fatura por encomenda paga. O número é único, a emissão é idempotente e o QR abre uma página pública que confirma apenas o registo e o estado do documento.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar</button>
      </header>

      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0"/>{notice}</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div>}

      <form onSubmit={issueInvoice} className="card grid gap-3 p-5 sm:grid-cols-[minmax(160px,240px)_auto_1fr] sm:items-end">
        <label className="block text-xs font-bold text-slate-600">ID da encomenda paga<input value={orderId} onChange={(event) => setOrderId(event.target.value)} type="number" min="1" required placeholder="Ex.: 204" className="settings-input mt-2"/></label>
        <button type="submit" disabled={issuing || loading} className="btn-primary min-h-11 justify-center disabled:opacity-50">{issuing ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>} {issuing ? "A emitir..." : "Emitir fatura"}</button>
        <p className="text-[10px] leading-5 text-slate-500">O serviço recusa encomendas sem pagamento confirmado. Se a fatura já existir, devolve o mesmo documento em vez de criar uma duplicação.</p>
      </form>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4 sm:p-5"><h2 className="text-sm font-black text-slate-950">Documentos emitidos</h2><p className="mt-1 text-[10px] text-slate-500">{invoices.length} fatura(s) nas últimas entradas</p></div>
        {loading ? <div className="space-y-3 p-5">{[1,2,3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-50"/>)}</div> : invoices.length ? (
          <div className="divide-y divide-slate-100">
            {invoices.map((invoice) => {
              const verifyUrl = siteUrl() + "/verificar-fatura/" + encodeURIComponent(invoice.verificationCode);
              return <article key={invoice.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-1.5"><img src={qrSource(invoice)} alt={"QR de verificação da fatura " + invoice.invoiceNumber} width={104} height={104} className="h-full w-full object-contain"/></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-slate-950">{invoice.invoiceNumber}</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">{invoice.status}</span></div>
                  <p className="mt-1 text-xs font-bold text-slate-800">{invoice.order.orderNumber} · {formatMoney(invoice)}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{invoice.buyerName || invoice.user.name || invoice.user.email || "Cliente"} · Emitida em {new Date(invoice.issuedAt).toLocaleString("pt-PT")}</p>
                  <p className="mt-1 text-[9px] text-slate-400">Pagamento: {invoice.order.payment?.status || "Desconhecido"} · {invoice.order.payment?.provider || "Gateway não indicado"}</p>
                  {!invoice.sellerTaxId && <p className="mt-1 text-[9px] font-bold text-amber-700">NIF do emissor não configurado — validar antes de utilizar como documento fiscal.</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={"/faturas/" + invoice.id} className="inline-flex items-center gap-1.5 rounded-lg bg-[#132238] px-3 py-2 text-[10px] font-black text-white hover:bg-[#1d6ac4]"><Printer size={12}/> Abrir / imprimir</Link>
                  <Link href={verifyUrl} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 hover:border-blue-200 hover:text-blue-700">Validar <ExternalLink size={11}/></Link>
                </div>
              </article>;
            })}
          </div>
        ) : <div className="p-12 text-center"><FileCheck2 size={32} className="mx-auto text-slate-300"/><h2 className="mt-3 text-sm font-black text-slate-800">Ainda não existem faturas</h2><p className="mt-1 text-xs text-slate-500">Depois de confirmar um pagamento, indique o ID da encomenda para emitir o documento.</p></div>}
      </section>
      <p className="text-[10px] leading-5 text-slate-500">Nota de produção: o código QR serve para verificar o registo no sistema; não constitui certificação fiscal. Configure o NIF e o endereço reais do emitente e valide os requisitos legais do mercado antes de utilizar este documento como fatura fiscal.</p>
    </div>
  );
}
