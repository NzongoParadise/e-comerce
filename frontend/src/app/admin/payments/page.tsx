"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Payment = {
  id: number; orderId: number; status: string; method: string; currency: string;
  grossAmount?: number | null; stripeFee?: number | null; netAmount?: number | null;
  stripePaymentIntentId?: string | null; stripeChargeId?: string | null;
  paidAt?: string | null; createdAt: string;
  order: { orderNumber: string; totalEUR: string | number; totalKZ: string | number };
  user: { id: number; name?: string | null; email?: string | null };
};
type Detail = Payment & { refunds: Array<{ id: number; stripeRefundId: string; amount: number; currency: string; status: string; reason?: string | null }>; disputes: Array<{ stripeDisputeId: string; amount: number; currency: string; status: string; reason?: string | null }>; events: Array<{ id: number; eventType: string; status: string; createdAt: string }> };

function moneyMinor(amount: number | null | undefined, currency: string) {
  return `${currency === "EUR" ? "€" : "Kz"} ${((amount || 0) / 100).toLocaleString(currency === "EUR" ? "pt-PT" : "pt-AO", { minimumFractionDigits: 2 })}`;
}
function statusLabel(status: string) {
  return ({ PAID: "Pago", PENDING: "Pendente", REQUIRES_PAYMENT: "A aguardar pagamento", FAILED: "Falhado", CANCELLED: "Cancelado", REFUNDED: "Reembolsado", PARTIALLY_REFUNDED: "Reembolso parcial", DISPUTED: "Disputa" } as Record<string,string>)[status] || status;
}

export default function StripePaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState({ paid: 0, pending: 0, failed: 0, refunded: 0, stripeFeesMinor: 0, grossMinor: 0, netMinor: 0, refundCount: 0, disputeCount: 0 });
  const [detail, setDetail] = useState<Detail | null>(null);
  const [status, setStatus] = useState("ALL");
  const [currency, setCurrency] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true); setMessage("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25", status, currency, search });
      if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString());
      if (to) params.set("to", new Date(`${to}T23:59:59.999`).toISOString());
      const response = await fetchWithAuth(`/api/admin/payments?${params}`);
      setPayments(response.data);
      setStats(response.stats);
      setPageCount(response.meta.pageCount || 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os pagamentos.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [page, status, currency, from, to]);

  async function openDetail(id: number) {
    try {
      const response = await fetchWithAuth(`/api/admin/payments/${id}`);
      setDetail(response.data);
    } catch { setMessage("Não foi possível carregar o detalhe."); }
  }

  async function refund() {
    if (!detail) return;
    const available = (detail.grossAmount || 0) - detail.refunds.filter((r) => !["failed","canceled"].includes(r.status)).reduce((s, r) => s + r.amount, 0);
    const input = window.prompt(`Valor a reembolsar em cêntimos (máx. ${available}):`, String(available));
    if (input === null) return;
    const amountMinor = Number(input);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > available) { setMessage("Valor de reembolso inválido."); return; }
    setBusy(true);
    try {
      await fetchWithAuth(`/api/admin/payments/${detail.id}/refund`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ amountMinor, reason: "requested_by_customer" }),
      });
      setMessage("Reembolso enviado à Stripe.");
      await openDetail(detail.id); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível reembolsar."); }
    finally { setBusy(false); }
  }

  async function syncPayment() {
    if (!detail) return;
    setBusy(true);
    try { await fetchWithAuth(`/api/admin/payments/${detail.id}/sync`, { method: "POST" }); setMessage("Pagamento reconciliado com a Stripe."); await openDetail(detail.id); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível reconciliar."); }
    finally { setBusy(false); }
  }

  function exportCsv() {
    const params = new URLSearchParams({ status, currency, search });
    if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59.999`).toISOString());
    window.open(`/api/admin/payments/export?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  return <div className="min-h-screen bg-[#f7f9fc] text-gray-900">
    <header className="border-b border-gray-200 bg-white"><div className="flex h-16 items-center gap-4 px-4 lg:px-7"><Link href="/admin" className="font-black">Financeiro · Stripe</Link><Link href="/admin/finance" className="ml-auto text-xs font-bold text-blue-700">Financeiro geral</Link></div></header>
    <main className="mx-auto max-w-[1500px] p-4 lg:p-7">
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-700">Módulo financeiro</p><h1 className="text-2xl font-black">Pagamentos Stripe</h1><p className="mt-1 text-xs text-gray-500">Transações, taxas, reembolsos e auditoria. Stripe continua separado de MULTICAIXA.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/payments/disputes" className="border bg-white px-3 py-2 text-xs font-bold">Disputas</Link><Link href="/admin/payments/payouts" className="border bg-white px-3 py-2 text-xs font-bold">Payouts</Link><button onClick={() => void load()} className="inline-flex items-center gap-2 border bg-white px-3 py-2 text-xs font-bold"><RefreshCw size={14}/>Atualizar</button></div></div>
      {message && <div role="alert" className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{message}</div>}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[["Bruto", moneyMinor(stats.grossMinor,"EUR")],["Líquido", moneyMinor(stats.netMinor,"EUR")],["Pagos", stats.paid],["Pendentes", stats.pending],["Falhados", stats.failed],["Reembolsos", stats.refundCount],["Disputas", stats.disputeCount],["Taxas Stripe", moneyMinor(stats.stripeFeesMinor,"EUR")]].map(([label,value]) => <div key={String(label)} className="border bg-white p-4"><p className="text-[10px] font-bold uppercase text-gray-500">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>)}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div><label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">De</label><input type="date" value={from} onChange={e=>{setPage(1);setFrom(e.target.value)}} className="border bg-white px-3 py-2 text-xs"/></div>
        <div><label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Até</label><input type="date" value={to} onChange={e=>{setPage(1);setTo(e.target.value)}} className="border bg-white px-3 py-2 text-xs"/></div><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setPage(1);void load();}}} placeholder="Pedido, cliente ou PaymentIntent..." className="flex-1 border bg-white px-3 py-2 text-xs"/><select value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}} className="border bg-white px-3 py-2 text-xs"><option value="ALL">Todos os estados</option><option value="PAID">Pagos</option><option value="PENDING">Pendentes</option><option value="FAILED">Falhados</option><option value="REFUNDED">Reembolsados</option><option value="PARTIALLY_REFUNDED">Reembolso parcial</option><option value="DISPUTED">Disputas</option></select><button onClick={exportCsv} className="border bg-white px-3 py-2 text-xs font-bold">Exportar CSV</button><select value={currency} onChange={e=>{setPage(1);setCurrency(e.target.value)}} className="border bg-white px-3 py-2 text-xs"><option value="ALL">Todas moedas</option><option value="EUR">EUR</option><option value="AOA">AOA</option></select></div>
      <div className="overflow-x-auto border bg-white"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="border-b bg-gray-50 text-[10px] uppercase text-gray-500"><tr><th className="p-3">Pedido</th><th>Cliente</th><th>Valor bruto</th><th>Taxa</th><th>Líquido</th><th>Estado</th><th>PaymentIntent</th><th>Data</th><th/></tr></thead><tbody>{loading ? <tr><td colSpan={9} className="p-8 text-center text-gray-500">A carregar...</td></tr> : payments.map(p=><tr key={p.id} className="border-b last:border-0 hover:bg-gray-50"><td className="p-3 font-bold">{p.order.orderNumber}</td><td>{p.user.name || p.user.email || "—"}</td><td>{moneyMinor(p.grossAmount, p.currency)}</td><td>{moneyMinor(p.stripeFee, p.currency)}</td><td>{moneyMinor(p.netAmount, p.currency)}</td><td><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold">{statusLabel(p.status)}</span></td><td className="max-w-[190px] truncate font-mono text-[10px]">{p.stripePaymentIntentId || "—"}</td><td>{new Date(p.createdAt).toLocaleString("pt-PT")}</td><td><button onClick={()=>void openDetail(p.id)} className="font-bold text-blue-700">Detalhes</button></td></tr>)}</tbody></table></div>
      <div className="mt-4 flex items-center justify-between text-xs"><span>Página {page} / {pageCount}</span><div className="flex gap-2"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="border bg-white p-2 disabled:opacity-40"><ChevronLeft size={14}/></button><button disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)} className="border bg-white p-2 disabled:opacity-40"><ChevronRight size={14}/></button></div></div>
      {detail && <div className="fixed inset-0 z-50 bg-black/40 p-4" onClick={()=>setDetail(null)}><section className="mx-auto max-h-[92vh] max-w-4xl overflow-y-auto bg-white p-5" onClick={e=>e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase text-blue-700">Transação #{detail.id}</p><h2 className="text-xl font-black">{detail.order.orderNumber}</h2><p className="mt-1 font-mono text-[10px] text-gray-500">{detail.stripePaymentIntentId}</p></div><button onClick={()=>setDetail(null)} className="text-xs font-bold">Fechar</button></div><div className="mt-5 grid gap-3 sm:grid-cols-4">{[["Bruto",moneyMinor(detail.grossAmount,detail.currency)],["Taxa",moneyMinor(detail.stripeFee,detail.currency)],["Líquido",moneyMinor(detail.netAmount,detail.currency)],["Estado",statusLabel(detail.status)]].map(([a,b])=><div key={String(a)} className="border p-3"><p className="text-[10px] uppercase text-gray-500">{a}</p><p className="mt-1 font-black">{b}</p></div>)}</div><div className="mt-5 grid gap-5 md:grid-cols-2"><div><h3 className="mb-2 font-bold">Reembolsos</h3>{detail.refunds.length ? detail.refunds.map(r=><div key={r.id} className="border-b py-2 text-xs">{moneyMinor(r.amount,r.currency)} · {r.status} · {r.stripeRefundId}</div>) : <p className="text-xs text-gray-500">Sem reembolsos.</p>} {["PAID","PARTIALLY_REFUNDED"].includes(detail.status) && <button disabled={busy} onClick={()=>void syncPayment()} className="mt-3 mr-2 border px-3 py-2 text-xs font-bold disabled:opacity-50">Reconciliar Stripe</button>{["PAID","PARTIALLY_REFUNDED"].includes(detail.status) && <button disabled={busy} onClick={()=>void refund()} className="mt-3 inline-flex items-center gap-2 bg-black px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Reembolsar</button>}</div><div><h3 className="mb-2 font-bold">Disputas</h3>{detail.disputes.length ? detail.disputes.map(d=><div key={d.stripeDisputeId} className="border-b py-2 text-xs">{moneyMinor(d.amount,d.currency)} · {d.status} · {d.reason || "—"}</div>) : <p className="text-xs text-gray-500">Sem disputas.</p>}</div></div><div className="mt-5"><h3 className="mb-2 font-bold">Eventos</h3><div className="max-h-56 overflow-y-auto border">{detail.events.map(e=><div key={e.id} className="flex justify-between border-b px-3 py-2 text-[10px]"><span className="font-mono">{e.eventType}</span><span>{new Date(e.createdAt).toLocaleString("pt-PT")}</span></div>)}</div></div><div className="mt-5 flex flex-wrap gap-3 text-[10px]"><span>Charge: <code>{detail.stripeChargeId || "—"}</code></span><Link href={`/admin/orders`} className="inline-flex items-center gap-1 font-bold text-blue-700">Ver vendas <ExternalLink size={11}/></Link></div></section></div>}
    </main>
  </div>;
}
