"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  Package,
  Search,
  ShoppingBag,
  WalletCards,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type PO = {
  id: number;
  poNumber: string;
  status: string;
  orderId?: number | null;
  createdAt: string;
  quote?: {
    quoteNumber: string;
    status: string;
    items: Array<{ quantity: number; name: string; subtotal: string | number }>;
  } | null;
  order?: { orderNumber: string; status: string; country: "AO" | "PT"; currency: string; totalEUR: string | number; totalKZ: string | number; payment?: { id: number; status: string; method: string; currency: string; amountEUR: string | number; amountKZ: string | number; entity: string | null; referenceNumber: string | null; expiresAt: string | null; paidAt: string | null } | null } | null;
};

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  totalEUR: string | number;
  totalKZ: string | number;
  currency: string;
  createdAt: string;
};

const orderStatus: Record<string, string> = {
  PENDING: "Pendente",
  AWAITING_PAYMENT: "A aguardar pagamento",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  PAYMENT_REVIEW_REQUIRED: "Pagamento em verificação",
  PROCESSING: "Em processamento",
  SHIPPED: "Enviada",
  DELIVERED: "Entregue",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const poStatus: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING: "A aguardar aprovação",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  CONVERTED: "Convertido",
};

export default function B2BOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Record<string, number | string>>({});
  const [pos, setPos] = useState<PO[]>([]);
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [paying, setPaying] = useState<number | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [expandedPO, setExpandedPO] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentInfo, setPaymentInfo] = useState<{ poNumber: string; payment: NonNullable<PO["order"]>["payment"] } | null>(null);
  const [copiedPaymentField, setCopiedPaymentField] = useState("");

  async function load() {
    setError("");
    try {
      const [ordersResult, poResult] = await Promise.all([
        fetchWithAuth("/api/b2b/orders"),
        fetchWithAuth("/api/b2b/purchase-orders"),
      ]);
      setOrders(ordersResult.data || []);
      setSummary(ordersResult.summary || {});
      setPos(poResult.data || []);
      setRole(poResult.role || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as operações.");
    }
  }

  useEffect(() => { void load(); }, []);

  const canConvert = role === "OWNER" || role === "APPROVER";

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const status = orderStatus[order.status] || order.status;
      return (!query || order.orderNumber.toLowerCase().includes(query) || status.toLowerCase().includes(query)) &&
        (filter === "ALL" || order.status === filter);
    });
  }, [orders, search, filter]);

  const tabs = [
    ["ALL", "Todas", orders.length],
    ["PENDING", "Pendentes", orders.filter((item) => item.status === "PENDING").length],
    ["AWAITING_PAYMENT", "Pagamento", orders.filter((item) => item.status === "AWAITING_PAYMENT").length],
    ["PROCESSING", "Processamento", orders.filter((item) => item.status === "PROCESSING").length],
    ["SHIPPED", "Enviadas", orders.filter((item) => item.status === "SHIPPED").length],
    ["DELIVERED", "Entregues", orders.filter((item) => item.status === "DELIVERED" || item.status === "COMPLETED").length],
  ];

  async function convert(poId: number) {
    setBusy(poId);
    setError("");
    setMessage("");
    try {
      const result = await fetchWithAuth("/api/b2b/purchase-orders/convert?id=" + poId, { method: "POST" });
      setMessage("Purchase Order convertido em " + result.data.order.orderNumber + ".");
      await load();
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : "Não foi possível converter o Purchase Order.");
    } finally {
      setBusy(null);
    }
  }

  async function pay(po: PO, method: "STRIPE_CHECKOUT" | "MULTICAIXA_REFERENCE" | "MULTICAIXA_EXPRESS") {
    if (!po.order) return;
    if (method === "MULTICAIXA_EXPRESS" && !/^(?:\\+244|244|0)?9\\d{8}$/.test(phoneNumber.trim())) {
      setError("Indique um número angolano válido para MULTICAIXA Express.");
      return;
    }
    setPaying(po.id);
    setError("");
    setMessage("");
    setPaymentInfo(null);
    try {
      const result = await fetchWithAuth("/api/b2b/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poId: po.id,
          method,
          idempotencyKey: crypto.randomUUID(),
          ...(method === "MULTICAIXA_EXPRESS" ? { phoneNumber: phoneNumber.trim() } : {}),
        }),
      });
      if (result.data?.checkoutUrl) {
        window.location.assign(result.data.checkoutUrl);
        return;
      }
      if (result.data?.payment) {
        setPaymentInfo({ poNumber: po.poNumber, payment: result.data.payment });
        const paymentStatus = String(result.data.payment.status || "");
        if (["FAILED", "EXPIRED", "CANCELLED"].includes(paymentStatus)) {
          setError("O gateway não concluiu o pagamento. O stock foi libertado e o Purchase Order voltou a ficar disponível para uma nova conversão.");
        } else {
          setMessage(method === "MULTICAIXA_EXPRESS" ? "Pedido enviado para MULTICAIXA Express." : "Instruções de pagamento atualizadas.");
        }
        await load();
      } else {
        throw new Error("O gateway não devolveu os dados de pagamento.");
      }
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setPaying(null);
    }
  }

  async function copyPaymentValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPaymentField(label);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione e copie o valor manualmente.");
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="section-kicker">B2B · Operações</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Encomendas empresariais</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Controle Purchase Orders, pagamentos e encomendas convertidas sem sair do centro de negócios.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/b2b/cotacoes" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-800 hover:border-blue-200 hover:text-[#1d6ac4]"><FileText size={15}/> Cotações</Link>
          <Link href="/b2b/catalogo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0c1b2a] px-4 py-3 text-xs font-black text-white hover:bg-[#132238]"><ShoppingBag size={15}/> Comprar</Link>
        </div>
      </header>

      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div>}
      {paymentInfo?.payment && <section className="card border-blue-100 p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><WalletCards size={18}/></span><div className="min-w-0 flex-1"><h2 className="text-sm font-black text-slate-950">Dados de pagamento · {paymentInfo.poNumber}</h2><p className="mt-1 text-xs text-slate-500">Estado: {paymentInfo.payment.status} · {paymentInfo.payment.method}</p><p className="mt-2 text-lg font-black text-slate-950">{paymentInfo.payment.currency === "EUR" ? "€ " + Number(paymentInfo.payment.amountEUR).toFixed(2) : "Kz " + Number(paymentInfo.payment.amountKZ).toLocaleString("pt-AO", { maximumFractionDigits: 0 })}</p>{paymentInfo.payment.entity && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="text-slate-500">Entidade:</span><strong className="font-mono text-slate-900">{paymentInfo.payment.entity}</strong><button type="button" onClick={() => void copyPaymentValue("entity", paymentInfo.payment!.entity!)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Copiar entidade"><Copy size={13}/></button>{copiedPaymentField === "entity" && <Check size={13} className="text-emerald-600"/>}</div>}{paymentInfo.payment.referenceNumber && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="text-slate-500">Referência:</span><strong className="font-mono text-slate-900">{paymentInfo.payment.referenceNumber}</strong><button type="button" onClick={() => void copyPaymentValue("reference", paymentInfo.payment!.referenceNumber!)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Copiar referência"><Copy size={13}/></button>{copiedPaymentField === "reference" && <Check size={13} className="text-emerald-600"/>}</div>}{paymentInfo.payment.expiresAt && <p className="mt-3 text-[10px] text-slate-500">Expira em {new Date(paymentInfo.payment.expiresAt).toLocaleString("pt-PT")}</p>}<p className="mt-3 text-[10px] leading-4 text-slate-500">Confirme que o valor e a referência correspondem a esta encomenda antes de concluir o pagamento.</p></div></div></section>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Em processamento" value={Number(summary.processing || 0)} tone="blue" icon={Clock3} detail="Em execução" />
        <MetricCard label="Concluídas" value={Number(summary.completed || 0)} tone="green" icon={CheckCircle2} detail="Entrega finalizada" />
        <MetricCard label="POs pendentes" value={pos.filter((item) => !item.orderId && item.status !== "REJECTED").length} tone="amber" icon={FileText} detail="Aguardam ação" />
        <MetricCard label="Encomendas históricas" value={Number(summary.count || 0)} tone="navy" icon={WalletCards} detail={"€ " + Number(summary.totalEUR || 0).toFixed(2) + " · Kz " + Number(summary.totalKZ || 0).toLocaleString("pt-AO", { maximumFractionDigits: 0 })} />
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2"><ShoppingBag size={17} className="text-[#1d6ac4]"/><h2 className="text-sm font-black text-slate-950">Histórico de encomendas</h2></div>
              <p className="mt-1 text-[10px] text-slate-500">Acompanhe o ciclo de cada compra e encontre uma encomenda pelo número ou estado.</p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400"/>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar encomenda..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-[#1d6ac4] focus:ring-4 focus:ring-blue-50"/>
            </div>
          </div>
          <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
            {tabs.map(([id, label, count]) => (
              <button key={String(id)} type="button" onClick={() => setFilter(String(id))} className={filter === id ? "shrink-0 rounded-full bg-[#132238] px-3 py-2 text-[9px] font-black text-white" : "shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-[9px] font-bold text-slate-500 hover:border-blue-200 hover:text-slate-900"}>
                {String(label)} <span className="ml-1 opacity-70">{String(count)}</span>
              </button>
            ))}
          </div>
        </div>

        {visibleOrders.length ? (
          <div className="divide-y divide-slate-100">
            {visibleOrders.map((order) => (
              <article key={order.id} className="p-4 transition hover:bg-slate-50/70 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Package size={17}/></span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-slate-950">{order.orderNumber}</p>
                      <p className="mt-1 text-[9px] text-slate-500">{new Date(order.createdAt).toLocaleString("pt-PT")}</p>
                    </div>
                  </div>
                  <div className="text-sm font-black text-slate-950">{order.currency === "EUR" ? "€ " + Number(order.totalEUR).toFixed(2) : "Kz " + Number(order.totalKZ).toLocaleString("pt-AO", { maximumFractionDigits: 0 })}</div>
                  <span className={"w-fit rounded-full px-2.5 py-1.5 text-[9px] font-black " + (order.status === "CANCELLED" ? "bg-rose-50 text-rose-700" : order.status === "DELIVERED" || order.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : order.status === "AWAITING_PAYMENT" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700")}>{orderStatus[order.status] || order.status}</span>
                </div>
                <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
                  <OrderStep current={order.status} states={["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"]} label="Processamento" />
                  <OrderStep current={order.status} states={["PENDING", "AWAITING_PAYMENT", "PROCESSING"]} label="Pagamento" />
                  <OrderStep current={order.status} states={["PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"]} label="Entrega" />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Package size={32} className="mx-auto text-slate-300"/>
            <h3 className="mt-3 text-sm font-black text-slate-800">Nenhuma encomenda encontrada</h3>
            <p className="mt-1 text-xs text-slate-500">Ajuste a pesquisa ou escolha outro estado.</p>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><FileText size={17} className="text-[#1d6ac4]"/><h2 className="text-sm font-black text-slate-950">Purchase Orders</h2></div><p className="mt-1 text-[10px] text-slate-500">Documentos que ligam cotações, aprovação, pagamento e encomenda.</p></div>
          <Link href="/b2b/cotacoes" className="inline-flex items-center gap-1 text-[10px] font-black text-[#1d6ac4] hover:underline">Gerir cotações <ArrowRight size={13}/></Link>
        </div>
        {pos.length ? (
          <div className="divide-y divide-slate-100">
            {pos.map((po) => {
              const expanded = expandedPO === po.id;
              const canPay = Boolean(po.status === "CONVERTED" && po.orderId && po.order && ["PENDING", "AWAITING_PAYMENT"].includes(po.order.status) && canConvert);
              return (
                <article key={po.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1d6ac4]"><FileText size={17}/></span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black text-slate-950">{po.poNumber}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-600">{poStatus[po.status] || po.status}</span></div>
                        <p className="mt-1 truncate text-[9px] text-slate-500">Cotação {po.quote?.quoteNumber || "—"} · {new Date(po.createdAt).toLocaleDateString("pt-PT")}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setExpandedPO(expanded ? null : po.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50">{expanded ? "Ocultar itens" : "Ver itens"} <ArrowRight size={12} className={expanded ? "-rotate-90" : ""}/></button>
                      {canPay && po.order?.currency === "EUR" ? (
                        <button type="button" disabled={paying === po.id} onClick={() => void pay(po, "STRIPE_CHECKOUT")} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d6ac4] px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">{paying === po.id && <Loader2 size={13} className="animate-spin"/>} Pagar com cartão <ExternalLink size={12}/></button>
                      ) : canPay && po.order?.currency === "AOA" ? (
                        <div className="flex w-full flex-col gap-2 xl:w-auto">
                          <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Telefone para Express (opcional)" aria-label="Telefone para MULTICAIXA Express" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[10px] outline-none focus:border-blue-500 xl:w-52"/>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={paying === po.id} onClick={() => void pay(po, "MULTICAIXA_REFERENCE")} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d6ac4] px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">{paying === po.id && <Loader2 size={13} className="animate-spin"/>} MULTICAIXA Referência</button>
                            <button type="button" disabled={paying === po.id} onClick={() => void pay(po, "MULTICAIXA_EXPRESS")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700 disabled:opacity-50">MULTICAIXA Express</button>
                          </div>
                        </div>
                      ) : po.orderId ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700"><CheckCircle2 size={13}/> {po.order?.orderNumber || "Encomenda convertida"}</span>
                      ) : po.status === "APPROVED" && canConvert ? (
                        <button type="button" disabled={busy === po.id} onClick={() => void convert(po.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d6ac4] px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">{busy === po.id && <Loader2 size={13} className="animate-spin"/>} Converter em encomenda</button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-500"><XCircle size={13}/> {po.status === "APPROVED" ? "A aguardar responsável" : "A aguardar aprovação"}</span>
                      )}
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        {po.quote?.items?.length ? (
                          <div className="space-y-2">
                            {po.quote.items.map((item, index) => (
                              <div key={index} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5 text-[10px]">
                                <span className="min-w-0 truncate font-bold text-slate-700">{item.quantity} × {item.name}</span>
                                <strong className="shrink-0 text-slate-950">{po.order?.currency === "AOA" ? "Kz " + Number(item.subtotal).toLocaleString("pt-AO", { maximumFractionDigits: 0 }) : "€ " + Number(item.subtotal).toFixed(2)}</strong>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-slate-500">Não há itens detalhados nesta cotação.</p>}
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-blue-700">Próximo passo</p>
                        <p className="mt-2 text-xs font-bold text-slate-800">{po.orderId ? (po.order?.status === "AWAITING_PAYMENT" ? "A aguardar confirmação de pagamento." : po.order?.status === "PENDING" ? "Encomenda criada; pagamento ainda não iniciado." : po.order?.status === "PAYMENT_CONFIRMED" ? "Pagamento confirmado." : "Encomenda em processamento.") : po.status === "APPROVED" ? "Converter a aprovação numa encomenda." : "Aguardar decisão comercial."}</p>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center"><FileText size={32} className="mx-auto text-slate-300"/><p className="mt-3 text-xs font-bold text-slate-700">Ainda não existem Purchase Orders.</p><Link href="/b2b/cotacoes" className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-[#1d6ac4]">Criar uma cotação <ArrowRight size={12}/></Link></div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone, icon: Icon, detail }: { label: string; value: number | string; tone: "blue" | "green" | "amber" | "navy"; icon: typeof WalletCards; detail: string }) {
  const tones = {
    blue: "bg-blue-50 text-[#1d6ac4]",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    navy: "bg-slate-100 text-slate-700",
  };
  return (
    <article className="card p-4 sm:p-5">
      <span className={"flex h-10 w-10 items-center justify-center rounded-xl " + tones[tone]}><Icon size={18}/></span>
      <p className="mt-4 text-[10px] font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight text-slate-950">{String(value)}</p>
      <p className="mt-1 text-[9px] text-slate-400">{detail}</p>
    </article>
  );
}

function OrderStep({ current, states, label }: { current: string; states: string[]; label: string }) {
  const index = states.indexOf(current);
  const progress = current === "CANCELLED" ? 0 : index >= 0 ? index + 1 : 1;
  const percent = Math.max(10, (Math.min(progress, states.length) / states.length) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-[9px] font-bold text-slate-500">{label}</span><span className="text-[9px] font-black text-slate-700">{current === "CANCELLED" ? "Interrompido" : String(Math.min(progress, states.length)) + "/" + states.length}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={"block h-full rounded-full transition-all " + (current === "CANCELLED" ? "bg-rose-400" : "bg-[#1d6ac4]")} style={{ width: percent + "%" }}/></div>
    </div>
  );
}
