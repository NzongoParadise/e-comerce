"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  WalletCards,
  XCircle,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type OrderItem = { id: number; name: string; quantity: number; unitPrice: number | string; subtotal: number | string };
type Payment = { status: string; currency: string };
type Order = {
  id: number;
  orderNumber: string;
  status: string;
  totalEUR: number | string;
  totalKZ: number | string;
  currency: string;
  createdAt: string;
  payment: Payment | null;
  items: OrderItem[];
};
type QuoteItem = { id: number; quantity: number; name: string; unitPrice: number | string; subtotal: number | string };
type PurchaseOrder = {
  id: number;
  poNumber: string;
  status: string;
  currency: string;
  orderId: number | null;
  createdAt: string;
  notes: string | null;
  quote: { quoteNumber: string; status: string; currency: string; items: QuoteItem[] } | null;
  order: { id: number; orderNumber: string; status: string; totalEUR: number | string; totalKZ: number | string; currency: string; payment: Payment | null } | null;
};
type OrdersData = {
  orders: Order[];
  summary: { count: number; totalEUR: number; totalAOA: number; processing: number; completed: number };
  purchaseOrders: PurchaseOrder[];
  role: string;
};

const statusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  SUBMITTED: "Enviado",
  UNDER_REVIEW: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  CANCELLED: "Cancelado",
  CONVERTED: "Encomenda criada",
  PENDING: "Pendente",
  PROCESSING: "Em processamento",
  AWAITING_PAYMENT: "A aguardar pagamento",
  PAID: "Pago",
  SHIPPED: "Expedido",
  DELIVERED: "Entregue",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
  REFUNDED: "Reembolsado",
};

const statusStyles: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CONVERTED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  PENDING: "bg-amber-50 text-amber-800 ring-amber-600/20",
  SUBMITTED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  UNDER_REVIEW: "bg-amber-50 text-amber-800 ring-amber-600/20",
  AWAITING_PAYMENT: "bg-amber-50 text-amber-800 ring-amber-600/20",
  PROCESSING: "bg-blue-50 text-blue-700 ring-blue-600/20",
  SHIPPED: "bg-violet-50 text-violet-700 ring-violet-600/20",
  REFUNDED: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

function formatMoney(value: number | string, currency: string) {
  const supportedCurrency = currency === "AOA" ? "AOA" : "EUR";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: supportedCurrency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function orderTotal(order: Pick<Order, "totalEUR" | "totalKZ" | "currency">) {
  return order.currency === "AOA" ? order.totalKZ : order.totalEUR;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" }).format(new Date(value));
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyles[status] || "bg-slate-100 text-slate-700 ring-slate-500/20"}`}>
      {statusLabels[status] || status.replaceAll("_", " ")}
    </span>
  );
}

export default function B2BOrdersPage() {
  const [data, setData] = useState<OrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPoId, setBusyPoId] = useState<number | null>(null);
  const [payingPoId, setPayingPoId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [ordersResult, purchaseOrdersResult] = await Promise.all([
        fetchWithAuth("/api/b2b/orders"),
        fetchWithAuth("/api/b2b/purchase-orders"),
      ]);
      setData({
        orders: ordersResult.data ?? [],
        summary: ordersResult.summary ?? { count: 0, totalEUR: 0, totalAOA: 0, processing: 0, completed: 0 },
        purchaseOrders: purchaseOrdersResult.data ?? [],
        role: purchaseOrdersResult.role ?? "",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as encomendas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      const params = new URLSearchParams(window.location.search);
      if (params.get("payment") === "success") {
        setMessage("O checkout foi concluído. O estado do pagamento será atualizado assim que a confirmação do Stripe chegar.");
      } else if (params.get("payment") === "cancelled") {
        setMessage("O checkout foi cancelado. Pode voltar a iniciá-lo a partir do Purchase Order.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function convert(poId: number) {
    setBusyPoId(poId);
    setError("");
    setMessage("");
    try {
      const result = await fetchWithAuth(`/api/b2b/purchase-orders/convert?id=${poId}`, { method: "POST" });
      setMessage(`Encomenda ${result.data.order.orderNumber} criada a partir do Purchase Order.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível confirmar o Purchase Order.");
    } finally {
      setBusyPoId(null);
    }
  }

  async function pay(poId: number) {
    setPayingPoId(poId);
    setError("");
    setMessage("");
    try {
      const result = await fetchWithAuth("/api/b2b/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poId, idempotencyKey: crypto.randomUUID() }),
      });
      if (result.data?.checkoutUrl) {
        window.location.assign(result.data.checkoutUrl);
        return;
      }
      throw new Error("O Stripe não devolveu um endereço de checkout. Atualize e tente novamente.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setPayingPoId(null);
    }
  }

  const canApprove = data?.role === "OWNER" || data?.role === "APPROVER";
  const pendingApprovalCount = data?.purchaseOrders.filter((po) => po.status === "APPROVED" && !po.orderId).length ?? 0;

  if (loading) {
    return (
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8" aria-label="A carregar encomendas empresariais">
        <div className="h-32 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}</div>
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm" role="alert">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 shrink-0 text-rose-600" size={20} />
            <div>
              <h1 className="font-black text-slate-950">Não foi possível carregar as encomendas</h1>
              <p className="mt-2 text-sm text-slate-600">{error}</p>
              <button type="button" onClick={() => { setLoading(true); void load(); }} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">
                <RefreshCw size={14} /> Tentar novamente
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const summary = data?.summary ?? { count: 0, totalEUR: 0, totalAOA: 0, processing: 0, completed: 0 };
  const purchaseOrders = data?.purchaseOrders ?? [];
  const orders = data?.orders ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
      <header className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mb-8 sm:rounded-3xl">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-[#f6b73c]" />
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a6700]">Área empresarial <span className="px-1 text-slate-300">/</span> Compras</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Encomendas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Confirme encomendas aprovadas, acompanhe pagamentos e consulte o histórico de compras da empresa.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:shrink-0">
            <button type="button" onClick={() => { setLoading(true); void load(); }} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:px-4">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
            </button>
            <Link href="/b2b/catalogo" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f6b73c] px-3 py-2.5 text-xs font-black text-[#0c1b2a] transition hover:bg-[#ffd166] sm:px-4">
              <ShoppingBag size={15} /><span className="sm:hidden">Comprar</span><span className="hidden sm:inline">Continuar a comprar</span>
            </Link>
          </div>
        </div>
      </header>

      {message && <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium leading-5 text-emerald-800 sm:px-4" role="status"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{message}</div>}
      {error && <div className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-medium leading-5 text-rose-800 sm:px-4" role="alert"><XCircle size={17} className="mt-0.5 shrink-0" /><span className="min-w-0 flex-1">{error}</span><button type="button" onClick={() => setError("")} className="shrink-0 text-xs font-bold underline">Fechar</button></div>}

      <section className="mb-6 grid grid-cols-2 gap-2.5 sm:mb-8 sm:gap-4 xl:grid-cols-5" aria-label="Resumo de encomendas">
        {[
          { label: "A aguardar a sua confirmação", value: pendingApprovalCount, Icon: WalletCards, tone: "bg-amber-50 text-amber-800" },
          { label: "Encomendas em curso", value: summary.processing, Icon: Clock3, tone: "bg-blue-50 text-blue-700" },
          { label: "Encomendas concluídas", value: summary.completed, Icon: PackageCheck, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Volume encomendado · EUR", value: formatMoney(summary.totalEUR, "EUR"), Icon: CreditCard, tone: "bg-violet-50 text-violet-700" },
          { label: "Volume encomendado · AOA", value: formatMoney(summary.totalAOA, "AOA"), Icon: WalletCards, tone: "bg-amber-50 text-amber-800" },
        ].map(({ label, value, Icon, tone }) => (
          <article key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
            <div className="flex min-h-8 items-start justify-between gap-2 sm:min-h-10">
              <p className="text-[10px] font-semibold leading-4 text-slate-500 sm:text-xs sm:leading-5">{label}</p>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${tone}`}><Icon size={16} /></span>
            </div>
            <p className="mt-2 break-words text-lg font-black tracking-tight text-slate-950 sm:mt-3 sm:text-2xl">{value}</p>
          </article>
        ))}
      </section>

      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mb-8 sm:rounded-3xl">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800"><FileText size={16} /></span>
              <h2 className="text-sm font-black text-slate-950 sm:text-base">Purchase Orders</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">As cotações aprovadas pela equipa comercial ficam disponíveis aqui para confirmação.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600">{purchaseOrders.length} {purchaseOrders.length === 1 ? "registo" : "registos"}</span>
        </div>

        {purchaseOrders.length ? (
          <div className="divide-y divide-slate-100">
            {purchaseOrders.map((po) => {
              const order = po.order;
              const paymentStatus = order?.payment?.status;
              const paymentIsPaid = paymentStatus === "PAID";
              const canPay = Boolean(order && po.status === "CONVERTED" && ["PENDING", "AWAITING_PAYMENT"].includes(order.status) && !paymentIsPaid && order.currency === "EUR" && canApprove);
              const canResumePayment = paymentStatus === "AWAITING_PAYMENT";

              return (
                <article key={po.id} className="p-4 transition-colors hover:bg-slate-50/60 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black tracking-tight text-slate-950">{po.poNumber}</h3>
                        <StatusBadge status={po.status} />
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">
                        Cotação <span className="font-semibold text-slate-700">{po.quote?.quoteNumber || "—"}</span>
                        <span className="px-1.5 text-slate-300">·</span>
                        {formatDate(po.createdAt)}
                      </p>
                      {order && <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-700"><span>Encomenda {order.orderNumber}</span><StatusBadge status={order.status} /></p>}
                    </div>

                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                      {!order && po.status === "APPROVED" && canApprove && (
                        <button type="button" disabled={busyPoId === po.id} onClick={() => void convert(po.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d6ac4] px-4 py-2.5 text-xs font-black text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
                          {busyPoId === po.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Confirmar encomenda
                        </button>
                      )}
                      {!order && po.status === "APPROVED" && !canApprove && <span className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-800">A aguardar confirmação de um responsável da empresa</span>}
                      {canPay && (
                        <button type="button" disabled={payingPoId === po.id} onClick={() => void pay(po.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0c1b2a] px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60">
                          {payingPoId === po.id ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                          {canResumePayment ? "Continuar pagamento" : "Pagar com Stripe"}
                        </button>
                      )}
                      {paymentIsPaid && <span className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 size={15} /> Pago</span>}
                      {order && !paymentIsPaid && !canPay && <span className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{order.currency === "AOA" ? "Pagamento em AOA: aguarde as instruções da equipa comercial." : "A aguardar um responsável autorizado."}</span>}
                      {!order && po.status !== "APPROVED" && <span className="text-xs font-medium text-slate-500">{po.status === "REJECTED" ? "Consulte a equipa comercial para mais informações." : "Aguarda análise ou aprovação comercial."}</span>}
                    </div>
                  </div>

                  {po.notes && <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs leading-5 text-blue-900"><strong>Nota comercial:</strong> {po.notes}</p>}
                  {po.quote?.items?.length ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                      <div className="hidden grid-cols-[minmax(0,1fr)_5rem_8rem] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                        <span>Artigo</span><span className="text-right">Qtd.</span><span className="text-right">Subtotal</span>
                      </div>
                      {po.quote.items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-slate-100 px-3 py-3 text-xs first:border-0 sm:grid-cols-[minmax(0,1fr)_5rem_8rem] sm:items-center sm:px-4">
                          <span className="min-w-0 truncate font-semibold text-slate-800">{item.name}</span>
                          <span className="text-right text-slate-500 sm:font-medium">{item.quantity} un.</span>
                          <span className="col-span-2 flex justify-between text-right font-black text-slate-900 sm:col-span-1 sm:block"><span className="font-medium text-slate-500 sm:hidden">Subtotal</span>{formatMoney(item.subtotal, po.currency)}</span>
                        </div>
                      ))}
                      {order && <div className="flex justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs"><span className="font-bold text-slate-600">Total da encomenda</span><strong className="font-black text-slate-950">{formatMoney(orderTotal(order), order.currency)}</strong></div>}
                    </div>
                  ) : <p className="mt-4 text-xs text-slate-500">A cotação associada não tem artigos para apresentar.</p>}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-9 text-center sm:px-6 sm:py-14">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><WalletCards size={22} /></span>
            <h3 className="mt-4 text-sm font-black text-slate-900">Ainda não há Purchase Orders</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">Quando a equipa comercial aprovar uma cotação da empresa, o Purchase Order aparecerá aqui para confirmação.</p>
            <Link href="/b2b/cotacoes" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:w-auto">
              Consultar cotações <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><PackageCheck size={16} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-950 sm:text-base">Histórico de encomendas</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Encomendas confirmadas e respetivo estado de pagamento.</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{orders.length}</span>
        </div>
        {orders.length ? (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => (
              <article key={order.id} className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><PackageCheck size={18} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(order.createdAt)} <span className="px-1">·</span> {order.items.length} artigo(s)</p>
                    <p className="mt-1 text-xs text-slate-500">Pagamento: <span className="font-semibold text-slate-700">{statusLabels[order.payment?.status || "PENDING"] || order.payment?.status || "Pendente"}</span></p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 sm:justify-end sm:border-0 sm:pt-0">
                  <StatusBadge status={order.status} />
                  <strong className="min-w-28 text-right text-sm font-black text-slate-950">{formatMoney(orderTotal(order), order.currency)}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-4 py-9 text-center sm:px-6 sm:py-14">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><ArrowDownToLine size={21} /></span>
            <h3 className="mt-4 text-sm font-black text-slate-900">Ainda não existem encomendas empresariais</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">Depois de confirmar um Purchase Order, a encomenda e a evolução do pagamento ficam registadas neste histórico.</p>
            <Link href="/b2b/catalogo" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:w-auto">
              Explorar catálogo <ShoppingBag size={14} />
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
