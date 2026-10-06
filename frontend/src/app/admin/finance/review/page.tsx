"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type ReviewOrder = {
  id: number;
  orderNumber: string;
  createdAt: string;
  currency: string;
  totalEUR: string | number;
  totalKZ: string | number;
  billingName?: string | null;
  billingEmail?: string | null;
  user: { name?: string | null; email?: string | null };
  payment: {
    status: string;
    provider: string;
    providerPaymentId?: string | null;
    reference?: string | null;
    currency: string;
    amountEUR: string | number;
    amountKZ: string | number;
    paidAt?: string | null;
  } | null;
  items: Array<{ productId: number; name: string; quantity: number; subtotal: string | number }>;
  trackingEvents: Array<{ description?: string | null; occurredAt: string }>;
};

export default function PaymentReviewPage() {
  const [orders, setOrders] = useState<ReviewOrder[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadQueue(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth("/api/admin/payment-review");
      setOrders(response.data as ReviewOrder[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/admin/payment-review")
      .then((response) => {
        if (active) setOrders(response.data as ReviewOrder[]);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a fila.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function resolveOrder(orderId: number) {
    setResolvingId(orderId);
    setError("");
    setMessage("");
    try {
      await fetchWithAuth("/api/admin/payment-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, note: notes[orderId] || "" }),
      });
      setMessage("Pagamento confirmado e encomenda retomada.");
      setOrders((current) => current.filter((order) => order.id !== orderId));
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Não foi possível resolver esta encomenda.");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <nav className="mb-5 text-sm text-slate-500">
          <Link href="/admin/finance" className="hover:text-blue-700">Financeiro</Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-slate-800">Revisão de pagamentos</span>
        </nav>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Pagamentos para revisão</h1>
            <p className="mt-1 text-sm text-slate-600">Confirme a transação no painel Stripe antes de retomar uma encomenda.</p>
          </div>
          <button type="button" onClick={() => void loadQueue(true)} disabled={refreshing} aria-label="Atualizar fila" title="Atualizar fila" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {message && <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        {loading ? (
          <p role="status" className="py-12 text-center text-sm text-slate-500">A carregar pagamentos...</p>
        ) : orders.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white px-5 py-12 text-center">
            <Check className="mx-auto text-emerald-600" size={26} />
            <p className="mt-3 text-sm font-semibold">Não há pagamentos pendentes de revisão.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {orders.map((order) => {
              const paidAmount = order.payment?.currency === "EUR" ? order.payment.amountEUR : order.payment?.amountKZ;
              const formattedAmount = Number(paidAmount || 0).toLocaleString(order.currency === "EUR" ? "pt-PT" : "pt-AO", {
                minimumFractionDigits: order.currency === "EUR" ? 2 : 0,
                maximumFractionDigits: 2,
              });
              return (
                <article key={order.id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold">{order.orderNumber}</h2>
                      <p className="mt-1 text-xs text-slate-500">{order.billingName || order.user.name || "Cliente"} · {order.billingEmail || order.user.email || "Sem email"}</p>
                      <p className="mt-1 text-xs text-slate-500">Criada em {new Date(order.createdAt).toLocaleString("pt-PT")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black">{order.currency === "EUR" ? "€" : "Kz"} {formattedAmount}</p>
                      <p className="text-xs font-semibold text-emerald-700">Stripe · {order.payment?.status}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-[1fr_280px]">
                    <div>
                      <ul className="space-y-1 text-sm text-slate-700">
                        {order.items.map((item) => <li key={`${order.id}-${item.productId}`}>{item.quantity} × {item.name}</li>)}
                      </ul>
                      <p className="mt-3 break-all text-xs text-slate-500">Sessão: {order.payment?.reference || order.payment?.providerPaymentId || "a reconciliar"}</p>
                      {order.payment?.paidAt && <p className="mt-1 text-xs text-slate-500">Pago em {new Date(order.payment.paidAt).toLocaleString("pt-PT")}</p>}
                      {order.trackingEvents[0]?.description && <p className="mt-2 flex gap-2 text-xs text-amber-800"><AlertTriangle size={14} className="shrink-0" />{order.trackingEvents[0].description}</p>}
                    </div>
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-slate-700" htmlFor={`review-note-${order.id}`}>Nota de verificação
                        <textarea id={`review-note-${order.id}`} value={notes[order.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [order.id]: event.target.value }))} maxLength={500} rows={3} placeholder="Ex.: transação confirmada no painel Stripe" className="mt-1 block w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                      </label>
                      <button type="button" onClick={() => void resolveOrder(order.id)} disabled={resolvingId !== null || (notes[order.id] || "").trim().length < 8} className="w-full rounded-md bg-blue-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                        {resolvingId === order.id ? "A confirmar..." : "Confirmar e retomar encomenda"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
