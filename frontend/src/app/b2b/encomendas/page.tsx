"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";

type PO = {
  id: number; poNumber: string; status: string; orderId?: number | null; createdAt: string;
  quote?: { quoteNumber: string; status: string; items: Array<{ quantity: number; name: string; subtotal: string | number }> } | null;
  order?: { orderNumber: string; status: string; totalEUR: string | number } | null;
};

export default function B2BOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [pos, setPos] = useState<PO[]>([]);
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [ordersResult, poResult] = await Promise.all([fetchWithAuth("/api/b2b/orders"), fetchWithAuth("/api/b2b/purchase-orders")]);
      setOrders(ordersResult.data || []);
      setSummary(ordersResult.summary || {});
      setPos(poResult.data || []);
      setRole(poResult.role || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar as encomendas."); }
  }

  useEffect(() => { void load(); }, []);

  async function convert(poId: number) {
    setBusy(poId); setError(""); setMessage("");
    try {
      const result = await fetchWithAuth(`/api/b2b/purchase-orders/convert?id=${poId}`, { method: "POST" });
      setMessage(`Compra convertida em ${result.data.order.orderNumber}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível converter o Purchase Order."); }
    finally { setBusy(null); }
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#1d6ac4]">B2B · Operação</p><h1 className="mt-1 text-3xl font-black text-[#0c1b2a]">Encomendas empresariais</h1><p className="mt-2 text-sm text-gray-500">Purchase Orders aprovados e histórico real da empresa.</p></div>
        <Link href="/b2b/catalogo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0c1b2a] px-4 py-3 text-xs font-black text-white"><ShoppingBag size={15}/> Continuar a comprar</Link>
      </div>
      {message && <div className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
      {error && <div className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {[
          ["Em processamento", summary.processing || 0],
          ["Concluídas", summary.completed || 0],
          ["Volume histórico", `€ ${Number(summary.totalEUR || 0).toFixed(2)}`],
        ].map(([label,value]) => <div key={String(label)} className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold text-gray-500">{String(label)}</p><p className="mt-2 text-2xl font-black">{String(value)}</p></div>)}
      </div>

      <section className="mb-8 rounded-2xl border border-gray-200 bg-white">
        <div className="border-b px-5 py-4"><h2 className="font-black text-[#0c1b2a]">Purchase Orders</h2><p className="mt-1 text-xs text-gray-500">Uma cotação aprovada transforma-se em encomenda quando um responsável da empresa a confirma.</p></div>
        <div className="divide-y">
          {pos.map((po) => {
            const canConvert = role === "OWNER" || role === "APPROVER";
            return <article key={po.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><span className="font-black">{po.poNumber}</span><span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black">{po.status}</span></div><p className="mt-1 text-xs text-gray-500">Cotação {po.quote?.quoteNumber || "—"} · {new Date(po.createdAt).toLocaleDateString("pt-PT")}</p></div>
                {po.orderId ? <span className="inline-flex items-center gap-2 text-xs font-black text-emerald-700"><CheckCircle2 size={16}/> Convertido em {po.order?.orderNumber || `#${po.orderId}`}</span> :
                  po.status === "APPROVED" && canConvert ? <button disabled={busy === po.id} onClick={() => void convert(po.id)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d6ac4] px-4 py-3 text-xs font-black text-white disabled:opacity-50">{busy === po.id && <Loader2 size={14} className="animate-spin" />} Converter em encomenda</button> :
                  <span className="text-xs font-bold text-gray-500">{po.status === "APPROVED" ? "Aguardando responsável da empresa" : "Aguardando aprovação comercial"}</span>}
              </div>
              {po.quote?.items?.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{po.quote.items.map((item, index) => <div key={index} className="rounded-xl bg-gray-50 px-3 py-2 text-xs"><span className="font-bold">{item.quantity} × {item.name}</span><span className="float-right font-black">€ {Number(item.subtotal).toFixed(2)}</span></div>)}</div> : null}
            </article>
          })}
          {!pos.length && <div className="p-10 text-center text-sm text-gray-500">Ainda não existem Purchase Orders.</div>}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b bg-gray-50 px-5 py-3 text-[11px] font-black uppercase text-gray-500">Histórico de encomendas</div>
        {orders.map((o:any)=><div key={o.id} className="grid gap-2 border-b px-5 py-4 text-sm md:grid-cols-4 md:items-center last:border-0"><span className="font-black">{o.orderNumber}</span><span className="text-gray-500">{new Date(o.createdAt).toLocaleDateString("pt-PT")}</span><span className="font-bold">€ {Number(o.totalEUR).toFixed(2)}</span><span className="text-gray-600 md:text-right">{o.status}</span></div>)}
        {!orders.length && <div className="p-10 text-center text-sm text-gray-500">Ainda não existem encomendas.</div>}
      </section>
    </main>
  );
}