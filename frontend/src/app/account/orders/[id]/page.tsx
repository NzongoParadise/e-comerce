"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Check, CheckCircle2, Clock3, CreditCard, Headphones,
  MapPin, Package, Printer, ShieldCheck, Truck, XCircle,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import QrCode from "@/components/ui/QrCode";

type OrderItem = { id: number; name: string; imageUrl?: string | null; quantity: number; subtotal: string };
type TrackingEvent = { id: number; status: string; location?: string | null; description?: string | null; occurredAt: string };
type Order = {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  shippingMethod: string;
  currency: string;
  country: string;
  totalEUR: string;
  totalKZ: string;
  discountTotalEUR: string;
  discountTotalKZ: string;
  taxSettings?: { vatEnabled: boolean; vatRate: string | null; vatIncluded: boolean };
  billingName?: string | null;
  billingEmail?: string | null;
  address?: string | null;
  phone?: string | null;
  deliveryRecipient?: string | null;
  deliveryCity?: string | null;
  deliveryRegion?: string | null;
  postalCode?: string | null;
  deliveryNotes?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  createdAt: string;
  items: OrderItem[];
  trackingEvents: TrackingEvent[];
  payment?: {
    status?: string | null;
    amountEUR?: string | null;
    amountKZ?: string | null;
    paidAt?: string | null;
    reference?: string | null;
    referenceNumber?: string | null;
    entity?: string | null;
  } | null;
};

const statusLabels: Record<string, string> = {
  PENDING: "A aguardar pagamento",
  PROCESSING: "Em preparação",
  SHIPPED: "Enviada",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelada",
};

const flow = [
  { status: "PROCESSING", label: "Em preparação", detail: "A encomenda foi confirmada e está a ser preparada.", Icon: Package },
  { status: "SHIPPED", label: "Enviada", detail: "A encomenda saiu para entrega.", Icon: Truck },
  { status: "DELIVERED", label: "Entregue", detail: "A encomenda foi entregue.", Icon: CheckCircle2 },
];

function money(value: string | number, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(amount);
}

function date(value: string, withTime = false) {
  return new Intl.DateTimeFormat("pt-PT", withTime
    ? { dateStyle: "long", timeStyle: "short" }
    : { dateStyle: "medium" }).format(new Date(value));
}

function comparable(value?: string | null) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-PT");
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [showPrintSheet, setShowPrintSheet] = useState(false);

  useEffect(() => {
    let active = true;
    fetchWithAuth(`/api/orders/${id}`)
      .then((response) => { if (active) setOrder(response.data); })
      .catch(() => { if (active) setError("Não foi possível carregar esta encomenda."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <div className="card mx-auto my-12 max-w-xl p-8 text-center"><XCircle size={32} className="mx-auto text-red-500" /><p className="mt-3 text-sm text-gray-700">{error}</p><Link href="/account/orders" className="btn-primary mt-5">Voltar às encomendas</Link></div>;
  if (!order) return <div className="card my-8 animate-pulse p-12 text-center text-sm text-gray-500" role="status">A carregar a encomenda...</div>;

  const currency = order.currency || (Number(order.totalEUR) > 0 ? "EUR" : "AOA");
  const total = currency === "EUR" ? order.totalEUR : order.totalKZ;
  const totalAmount = Number(total) || 0;
  const itemSubtotal = order.items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const discount = Number(currency === "EUR" ? order.discountTotalEUR : order.discountTotalKZ) || 0;
  const shipping = Math.max(0, totalAmount + discount - itemSubtotal);
  const vatRate = order.taxSettings?.vatEnabled ? Number(order.taxSettings.vatRate) : null;
  const vatAmount = vatRate === null ? null : order.taxSettings?.vatIncluded
    ? totalAmount * vatRate / (100 + vatRate)
    : totalAmount * vatRate / 100;
  const invoiceTotal = totalAmount + (vatAmount !== null && order.taxSettings?.vatIncluded === false ? vatAmount : 0);
  const isPaid = order.payment?.status === "PAID";
  const paidAmount = isPaid ? Number(currency === "EUR" ? order.payment?.amountEUR : order.payment?.amountKZ) || totalAmount : 0;
  const outstandingAmount = Math.max(0, invoiceTotal - paidAmount);
  const cancelled = order.status === "CANCELLED";
  const pending = order.status === "PENDING";
  const currentStep = flow.findIndex((step) => step.status === order.status);
  const events = [...(order.trackingEvents || [])].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const addressParts = (order.address || "").split(",").map((part) => part.trim()).filter(Boolean);
  const addressDetail = addressParts.filter((part) => comparable(part) !== comparable(order.deliveryCity) && comparable(part) !== comparable(order.deliveryRegion)).join(", ");
  const sameCityAndRegion = Boolean(order.deliveryCity && order.deliveryRegion && comparable(order.deliveryCity) === comparable(order.deliveryRegion));

  return (
    <div id="order-detail-print" data-print-preview={showPrintSheet} className="space-y-5 pb-8">
      <section className="order-print-sheet" aria-label="Ficha para impressão da encomenda">
        <div className="order-preview-toolbar">
          <button type="button" onClick={() => setShowPrintSheet(false)} className="btn-secondary py-2 text-xs">← Voltar aos detalhes</button>
          <button type="button" onClick={() => window.print()} className="btn-primary py-2 text-xs"><Printer size={14} /> Imprimir ficha</button>
        </div>
        <div className="order-print-brand">
          <div className="order-print-mark">RD</div>
          <div><p className="order-print-company">RUBRICA DILIGENTE (SU), LDA</p><p className="order-print-tagline">Tecnologia sem fronteiras</p></div>
          <div className="order-print-document"><div><span>DOCUMENTO</span><strong>Ficha da encomenda</strong></div><QrCode value={order.orderNumber.length <= 17 ? order.orderNumber : `ID:${order.id}`} label={`QR da encomenda ${order.orderNumber}`} className="order-print-qr" /></div>
        </div>

        <div className="order-print-title">
          <div><p className="order-print-kicker">ENCOMENDA</p><h1>{order.orderNumber}</h1></div>
          <div className={`order-print-status ${cancelled ? "is-cancelled" : ""}`}><span>Estado</span><strong>{statusLabels[order.status] || order.status}</strong></div>
        </div>

        <div className="order-print-meta">
          <div><span>Data da encomenda</span><strong>{date(order.createdAt, true)}</strong></div>
          <div><span>Pagamento</span><strong>{order.paymentMethod}</strong></div>
          <div><span>Estado do pagamento</span><strong>{order.payment?.status || (pending ? "Pendente" : cancelled ? "Cancelada" : "Registado")}</strong></div>
        </div>

        <div className="order-print-parties">
          <section className="order-print-party"><h2>CLIENTE</h2>
            <div className="order-print-field"><span>Nome</span><strong>{order.billingName || order.deliveryRecipient || "Cliente"}</strong></div>
            {order.billingEmail && <div className="order-print-field"><span>Email</span><strong>{order.billingEmail}</strong></div>}
            {order.phone && <div className="order-print-field"><span>Telefone</span><strong>{order.phone}</strong></div>}
          </section>
          <section className="order-print-party"><h2>ENTREGA</h2>
            {order.shippingMethod === "pickup" ? <div className="order-print-field"><span>Modalidade</span><strong>Levantamento na loja</strong></div> : <>
              {addressDetail && <div className="order-print-field"><span>Morada / bairro</span><strong>{addressDetail}</strong></div>}
              {order.postalCode && <div className="order-print-field"><span>Código postal</span><strong>{order.postalCode}</strong></div>}
              {(order.deliveryCity || order.deliveryRegion) && <div className="order-print-field"><span>{sameCityAndRegion ? "Localidade / província" : "Localidade"}</span><strong>{order.deliveryCity || order.deliveryRegion}</strong></div>}
              {!sameCityAndRegion && order.deliveryRegion && <div className="order-print-field"><span>Província</span><strong>{order.deliveryRegion}</strong></div>}
            </>}
            {order.deliveryRecipient && <div className="order-print-field"><span>A/C</span><strong>{order.deliveryRecipient}</strong></div>}
            {order.deliveryNotes && <div className="order-print-field"><span>Nota de entrega</span><strong>{order.deliveryNotes}</strong></div>}
          </section>
        </div>

        <table className="order-print-table">
          <thead><tr><th>ARTIGO</th><th className="numeric">QTD.</th><th className="numeric">PREÇO UNITÁRIO</th><th className="numeric">SUBTOTAL</th></tr></thead>
          <tbody>{order.items.map((item) => <tr key={item.id}><td>{item.name}</td><td className="numeric">{item.quantity}</td><td className="numeric">{money(Number(item.subtotal) / item.quantity, currency)}</td><td className="numeric">{money(item.subtotal, currency)}</td></tr>)}</tbody>
        </table>

        <div className="order-print-summary">
          <div className="order-print-summary-lines">
            <div><span>Subtotal dos artigos</span><strong>{money(itemSubtotal, currency)}</strong></div>
            {discount > 0 && <div className="order-print-discount"><span>Desconto aplicado</span><strong>− {money(discount, currency)}</strong></div>}
            {shipping > 0 && <div><span>Portes de envio</span><strong>{money(shipping, currency)}</strong></div>}
            <div className="order-print-tax-note"><span>IVA{vatRate !== null ? ` (${vatRate}%)` : ""}</span><strong>{vatRate === null ? "Não configurado no sistema" : `${money(vatAmount || 0, currency)} ${order.taxSettings?.vatIncluded ? "incluído no total" : "acrescido à fatura"}`}</strong></div>
          </div>
          <div className="order-print-total"><span>{vatAmount !== null && order.taxSettings?.vatIncluded === false ? "TOTAL DA FATURA" : "TOTAL DA ENCOMENDA"}</span><strong>{money(invoiceTotal, currency)}</strong></div>
          <div className="order-print-paid"><span>Montante pago</span><strong>{money(paidAmount, currency)}</strong></div>
          {outstandingAmount > 0 && <div className="order-print-outstanding"><span>Por pagar</span><strong>{money(outstandingAmount, currency)}</strong></div>}
          {isPaid && order.payment?.paidAt && <p className="order-print-paid-date">Pagamento confirmado em {date(order.payment.paidAt, true)}</p>}
          {(order.payment?.reference || order.payment?.referenceNumber) && <p className="order-print-payment-reference">Referência de pagamento: {order.payment.referenceNumber || order.payment.reference}{order.payment.entity ? ` · Entidade ${order.payment.entity}` : ""}</p>}
        </div>

        {(order.carrier || order.trackingNumber) && <div className="order-print-shipping"><strong>INFORMAÇÃO DE EXPEDIÇÃO</strong><span>{order.carrier || "Transportadora por definir"}{order.trackingNumber ? ` · Código ${order.trackingNumber}` : ""}</span></div>}

        <footer className="order-print-footer"><p>Obrigado por escolher a Rubrica Diligente.</p><span>Documento de consulta da encomenda · {order.orderNumber}</span></footer>
      </section>

      <nav aria-label="Navegação" className="order-detail-navigation flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <Link href="/account/orders" className="inline-flex items-center gap-1 hover:text-[#1d6ac4]"><ArrowLeft size={13} /> As minhas encomendas</Link>
        <span aria-hidden="true">/</span><span className="font-semibold text-gray-700">{order.orderNumber}</span>
      </nav>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1d6ac4]">Detalhes da encomenda</p>
          <h1 className="mt-2 text-2xl font-black text-gray-900">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">Efetuada a {date(order.createdAt, true)}</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${cancelled ? "bg-red-50 text-red-700" : pending ? "bg-amber-50 text-amber-800" : order.status === "DELIVERED" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
          {statusLabels[order.status] || order.status}
        </span>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <main className="space-y-5">
          <section className="card p-5 sm:p-6" aria-labelledby="progress-title">
            <h2 id="progress-title" className="text-sm font-black text-gray-900">Estado da encomenda</h2>
            {cancelled ? (
              <div className="mt-4 flex items-start gap-3 rounded-lg bg-red-50 p-4 text-red-800"><XCircle size={20} className="mt-0.5 shrink-0" /><div><p className="text-sm font-bold">Esta encomenda foi cancelada</p><p className="mt-1 text-xs">Se já efetuou o pagamento, contacte o suporte para obter ajuda.</p></div></div>
            ) : pending ? (
              <div className="mt-4 flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-amber-900"><Clock3 size={20} className="mt-0.5 shrink-0" /><div><p className="text-sm font-bold">Aguardamos a confirmação do pagamento</p><p className="mt-1 text-xs">Assim que o pagamento for confirmado, começaremos a preparar a sua encomenda.</p></div></div>
            ) : (
              <ol className="mt-5 grid gap-4 sm:grid-cols-3">
                {flow.map(({ status, label, detail, Icon }, index) => {
                  const complete = currentStep >= index;
                  const active = currentStep === index;
                  return <li key={status} className="flex gap-3 sm:block sm:text-center">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:mx-auto ${complete ? "bg-[#1555d8] text-white" : "bg-gray-100 text-gray-400"}`}>
                      {complete && !active ? <Check size={17} /> : <Icon size={17} />}
                    </span>
                    <div className="sm:mt-2"><p className={`text-xs font-bold ${complete ? "text-gray-900" : "text-gray-400"}`}>{label}</p><p className="mt-1 text-[11px] leading-4 text-gray-500">{detail}</p></div>
                  </li>;
                })}
              </ol>
            )}
            {order.status === "SHIPPED" && <Link href={`/account/orders/${order.id}/tracking`} className="btn-primary mt-5"><Truck size={15} /> Acompanhar entrega</Link>}
          </section>

          <section className="card overflow-hidden" aria-labelledby="items-title">
            <div className="border-b border-gray-100 px-5 py-4"><h2 id="items-title" className="text-sm font-black text-gray-900">Produtos ({order.items.length})</h2></div>
            <div className="divide-y divide-gray-100">
              {order.items.map((item) => <div key={item.id} className="flex items-center gap-3 px-5 py-4">
                <img src={item.imageUrl || "/file.svg"} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-gray-50 object-contain p-1" />
                <div className="min-w-0 flex-1"><p className="text-sm font-bold text-gray-900">{item.name}</p><p className="mt-1 text-xs text-gray-500">{item.quantity} × {money(Number(item.subtotal) / item.quantity, currency)}</p></div>
                <strong className="whitespace-nowrap text-sm text-gray-900">{money(item.subtotal, currency)}</strong>
              </div>)}
            </div>
            <div className="order-detail-actions flex flex-wrap gap-2 border-t border-gray-100 p-4">
              <button type="button" onClick={() => setShowPrintSheet(true)} className="btn-secondary py-2 text-xs"><Printer size={14} /> Ver ficha para impressão</button>
              {!cancelled && <Link href="/account/returns" className="btn-secondary py-2 text-xs"><Package size={14} /> Pedir devolução</Link>}
              <Link href="/account/support" className="btn-secondary py-2 text-xs"><Headphones size={14} /> Pedir ajuda</Link>
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-black text-gray-900"><MapPin size={17} className="text-[#1555d8]" /> Dados de entrega</h2>
              <div className="mt-3 space-y-1 text-xs leading-5 text-gray-600">
                {order.shippingMethod === "pickup" ? <p>Levantamento na loja</p> : <>
                  {addressDetail && <p>{addressDetail}</p>}
                  {(order.postalCode || order.deliveryCity || order.deliveryRegion) && <p>{[order.postalCode, order.deliveryCity, !sameCityAndRegion ? order.deliveryRegion : null].filter(Boolean).join(" · ")}</p>}
                  {!addressDetail && !order.postalCode && !order.deliveryCity && !order.deliveryRegion && <p>Endereço não disponível</p>}
                </>}
                {order.deliveryRecipient && <p className="pt-1 font-semibold text-gray-800">Destinatário: {order.deliveryRecipient}</p>}
                {order.phone && <p>Telefone: {order.phone}</p>}
                {order.deliveryNotes && <p className="pt-2">Nota: {order.deliveryNotes}</p>}
              </div>
            </section>
            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-black text-gray-900"><Truck size={17} className="text-[#1555d8]" /> Expedição</h2>
              <p className="mt-3 text-xs text-gray-600">{order.shippingMethod === "express" ? "Entrega expresso" : order.shippingMethod === "pickup" ? "Levantamento na loja" : "Entrega standard"}</p>
              {order.carrier && <p className="mt-2 text-xs text-gray-600">Transportadora: <strong className="text-gray-800">{order.carrier}</strong></p>}
              {order.trackingNumber && <p className="mt-1 text-xs text-gray-600">Código de rastreio: <strong className="text-gray-800">{order.trackingNumber}</strong></p>}
              {events.length > 0 && <div className="mt-4 border-t border-gray-100 pt-3"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Última atualização</p><p className="mt-1 text-xs font-semibold text-gray-800">{events[0].status}</p><p className="mt-1 text-[11px] text-gray-500">{events[0].description || events[0].location || date(events[0].occurredAt, true)}</p><Link href={`/account/orders/${order.id}/tracking`} className="mt-2 inline-block text-xs font-bold text-[#1555d8]">Ver histórico de rastreio →</Link></div>}
            </section>
          </div>
        </main>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-black text-gray-900">Resumo</h2>
            <div className="mt-4 space-y-3 border-b border-gray-100 pb-4 text-xs"><div className="flex justify-between gap-3 text-gray-600"><span>Artigos</span><span>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</span></div><div className="flex justify-between gap-3 text-gray-600"><span>Pagamento</span><span className="text-right font-semibold text-gray-800">{order.paymentMethod}</span></div>{order.payment?.status && <div className="flex justify-between gap-3 text-gray-600"><span>Estado do pagamento</span><span className="text-right font-semibold text-gray-800">{order.payment.status}</span></div>}</div>
            <div className="mt-4 flex items-end justify-between gap-3"><span className="text-sm font-bold text-gray-900">Total</span><strong className="text-lg font-black text-gray-900">{money(total, currency)}</strong></div>
          </section>
          <section className="card flex items-start gap-3 bg-blue-50 p-4"><ShieldCheck className="shrink-0 text-[#1555d8]" size={22} /><div><p className="text-xs font-bold text-gray-900">Compra protegida</p><p className="mt-1 text-[11px] leading-4 text-gray-600">Precisa de ajuda com o pagamento ou a entrega? A nossa equipa está disponível para ajudar.</p><Link href="/account/support" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#1555d8]"><CreditCard size={13} /> Contactar suporte</Link></div></section>
        </aside>
      </div>
    </div>
  );
}
