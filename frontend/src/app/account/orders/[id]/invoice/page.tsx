"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type InvoiceItem = {
  id: number;
  name: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

type InvoicePayment = {
  method?: string;
  status?: string;
  reference?: string | null;
  providerPaymentId?: string | null;
  paidAt?: string | null;
};

type InvoiceOrder = {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  country: "AO" | "PT";
  currency: string;
  billingName?: string | null;
  billingEmail?: string | null;
  billingTaxId?: string | null;
  deliveryRecipient?: string | null;
  deliveryCity?: string | null;
  deliveryRegion?: string | null;
  postalCode?: string | null;
  address?: string | null;
  phone?: string | null;
  shippingMethod: string;
  totalEUR: string;
  totalKZ: string;
  discountTotalEUR?: string;
  discountTotalKZ?: string;
  agtDocumentNo?: string | null;
  agtStatus?: string | null;
  agtQrUrl?: string | null;
  createdAt: string;
  items: InvoiceItem[];
  payment?: InvoicePayment | null;
};

function money(value: string | number, currency: "AOA" | "EUR") {
  return new Intl.NumberFormat(currency === "AOA" ? "pt-AO" : "pt-PT", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function labelPayment(value?: string) {
  const labels: Record<string, string> = {
    card: "Cartão",
    mbway: "MB WAY",
    multicaixa_reference: "MULTICAIXA — Referência",
    multicaixa_express: "MULTICAIXA Express",
    multicaixa: "MULTICAIXA",
    transfer: "Transferência bancária",
    cash: "Numerário",
  };
  return value ? labels[value] || value : "Não informado";
}

function labelStatus(value: string) {
  const labels: Record<string, string> = {
    AWAITING_PAYMENT: "A aguardar pagamento",
    PAYMENT_CONFIRMED: "Pagamento confirmado",
    PROCESSING: "Em preparação",
    SHIPPED: "Em trânsito",
    DELIVERED: "Entregue",
    CANCELLED: "Cancelada",
  };
  return labels[value] || value.replaceAll("_", " ");
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<InvoiceOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithAuth(`/api/orders/${id}`)
      .then((response) => setOrder(response.data))
      .catch(() => setError("Não foi possível carregar o documento da encomenda."));
  }, [id]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-semibold text-red-700">{error}</p>
        <Link href={`/account/orders/${id}`} className="btn-primary mt-5 inline-flex">
          Voltar à encomenda
        </Link>
      </main>
    );
  }

  if (!order) {
    return <main className="mx-auto max-w-4xl px-4 py-16"><div className="h-96 animate-pulse rounded-xl bg-gray-100" /></main>;
  }

  const isAO = order.country === "AO";
  const currency = isAO ? "AOA" : "EUR";
  const total = isAO ? order.totalKZ : order.totalEUR;
  const discount = isAO ? order.discountTotalKZ : order.discountTotalEUR;
  const subtotal = order.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const shippingAndDiscountAdjustment = Number(total) - subtotal + Number(discount || 0);
  const invoiceUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/account/orders/${id}/invoice`
      : `/account/orders/${id}/invoice`;
  const consultationUrl = order.agtQrUrl || invoiceUrl;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(consultationUrl)}&format=png&size=350&margin=2`;

  return (
    <>
      <div className="invoice-toolbar print:hidden">
        <Link href={`/account/orders/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <button onClick={() => window.print()} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
          <Printer size={16} /> Imprimir / Guardar PDF
        </button>
      </div>

      <main className="invoice-page">
        <header className="invoice-header">
          <div>
            <p className="invoice-kicker">Documento de venda</p>
            <h1>Fatura da encomenda</h1>
            <p className="invoice-muted">N.º {order.orderNumber}</p>
          </div>
          <div className="invoice-company">
            <strong>e-Commerce</strong>
            <span>Angola · Portugal</span>
            <img
              src={qrUrl}
              alt={`QR Code da encomenda ${order.orderNumber}`}
              width={110}
              height={110}
              className="invoice-qr"
            />
            <small>{order.agtQrUrl ? "Consulta AGT" : "Consulta digital"}</small>
          </div>
        </header>

        <section className="invoice-meta">
          <div>
            <h2>Cliente</h2>
            <p><strong>{order.billingName || order.deliveryRecipient || "Cliente"}</strong></p>
            {order.billingEmail && <p>{order.billingEmail}</p>}
            {order.billingTaxId && <p>NIF: {order.billingTaxId}</p>}
            {order.phone && <p>{order.phone}</p>}
          </div>
          <div>
            <h2>Entrega</h2>
            <p>{order.address || "Levantamento na loja"}</p>
            {(order.deliveryCity || order.deliveryRegion || order.postalCode) && (
              <p>{[order.deliveryCity, order.deliveryRegion, order.postalCode].filter(Boolean).join(" · ")}</p>
            )}
            <p>Método: {order.shippingMethod}</p>
          </div>
          <div>
            <h2>Documento</h2>
            <p>Data: {new Date(order.createdAt).toLocaleDateString("pt-PT")}</p>
            <p>Estado: {labelStatus(order.status)}</p>
            <p>Moeda: {currency}</p>
            {order.agtDocumentNo && <p>Documento AGT: {order.agtDocumentNo}</p>}
            {order.agtStatus && <p>Estado AGT: {order.agtStatus}</p>}
          </div>
        </section>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="num">Qtd.</th>
              <th className="num">Preço unit.</th>
              <th className="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{money(Number(item.unitPrice), currency)}</td>
                <td className="num">{money(Number(item.subtotal), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="invoice-bottom">
          <div className="invoice-payment">
            <h2>Pagamento</h2>
            <p>Método: <strong>{labelPayment(order.payment?.method || order.paymentMethod)}</strong></p>
            <p>Estado: <strong>{order.payment?.status || "Não informado"}</strong></p>
            {order.payment?.reference && <p>Referência: {order.payment.reference}</p>}
            {order.payment?.paidAt && <p>Pago em: {new Date(order.payment.paidAt).toLocaleString("pt-PT")}</p>}
          </div>

          <div className="invoice-totals">
            <div><span>Subtotal</span><strong>{money(subtotal, currency)}</strong></div>
            {Number(discount || 0) > 0 && (
              <div><span>Desconto</span><strong>- {money(Number(discount), currency)}</strong></div>
            )}
            {Math.abs(shippingAndDiscountAdjustment) > 0.009 && (
              <div><span>Envio / ajuste</span><strong>{money(shippingAndDiscountAdjustment, currency)}</strong></div>
            )}
            <div className="invoice-total"><span>Total</span><strong>{money(total, currency)}</strong></div>
          </div>
        </section>

        <footer className="invoice-footer">
          <p>Obrigado pela sua compra.</p>
          <p>Este documento apresenta os dados da encomenda e, quando disponível, a referência fiscal AGT.</p>
          {order.agtDocumentNo ? (
            <p>Documento AGT: {order.agtDocumentNo}. QR destinado à consulta no serviço de verificação da AGT.</p>
          ) : (
            <p>Ainda sem número de documento fiscal AGT. A emissão fiscal depende da configuração e validação do software junto da AGT.</p>
          )}
        </footer>
      </main>

      <style jsx global>{`
        .invoice-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          max-width: 210mm;
          margin: 0 auto;
          padding: 1.25rem 1rem;
        }

        .invoice-page {
          box-sizing: border-box;
          width: min(100%, 210mm);
          min-height: 297mm;
          margin: 0 auto 2rem;
          padding: 16mm;
          background: #fff;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        }

        .invoice-header,
        .invoice-meta,
        .invoice-bottom {
          display: grid;
          gap: 1.25rem;
        }

        .invoice-header {
          grid-template-columns: 1fr auto;
          align-items: start;
          border-bottom: 2px solid #111827;
          padding-bottom: 1.5rem;
        }

        .invoice-kicker {
          margin: 0 0 .4rem;
          color: #6b7280;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .invoice-header h1 {
          margin: 0;
          font-size: 26px;
          line-height: 1.1;
        }

        .invoice-muted {
          margin: .5rem 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .invoice-company {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: .25rem;
          font-size: 11px;
          color: #6b7280;
        }

.invoice-company strong {
          color: #111827;
          font-size: 15px;
        }

        .invoice-qr {
          width: 110px;
          height: 110px;
          margin-top: .35rem;
          object-fit: contain;
        }

        .invoice-company small {
          font-size: 9px;
          color: #6b7280;
        }

        .invoice-meta {
          grid-template-columns: repeat(3, 1fr);
          margin: 1.5rem 0;
        }

        .invoice-meta > div {
          min-height: 90px;
          padding: .9rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .invoice-meta h2,
        .invoice-payment h2 {
          margin: 0 0 .6rem;
          font-size: 10px;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #6b7280;
        }

        .invoice-meta p,
        .invoice-payment p {
          margin: .2rem 0;
          font-size: 11px;
          line-height: 1.5;
        }

        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        .invoice-table th {
          padding: .65rem .5rem;
          background: #f3f4f6;
          border-bottom: 1px solid #d1d5db;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .invoice-table td {
          padding: .7rem .5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .invoice-table .num {
          text-align: right;
          white-space: nowrap;
        }

        .invoice-bottom {
          grid-template-columns: 1fr 260px;
          margin-top: 1.5rem;
          align-items: start;
        }

        .invoice-payment {
          padding: .9rem;
          background: #f9fafb;
          border-radius: 8px;
        }

        .invoice-totals > div {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          padding: .4rem 0;
          font-size: 11px;
        }

        .invoice-total {
          margin-top: .4rem;
          padding-top: .7rem !important;
          border-top: 2px solid #111827;
          font-size: 15px !important;
        }

        .invoice-footer {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 9px;
          line-height: 1.5;
        }

        .invoice-footer p {
          margin: .2rem 0;
        }

        @media (max-width: 700px) {
          .invoice-page {
            min-height: auto;
            padding: 1rem;
          }

          .invoice-header,
          .invoice-meta,
          .invoice-bottom {
            grid-template-columns: 1fr;
          }

          .invoice-company {
            align-items: flex-start;
          }

          .invoice-table {
            font-size: 10px;
          }
        }

        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          html,
          body {
            background: #fff !important;
          }

          .invoice-toolbar {
            display: none !important;
          }

          .invoice-page {
            width: 100%;
            min-height: 0;
            margin: 0;
            padding: 0;
          }

          .invoice-table tr,
          .invoice-meta > div,
          .invoice-payment {
            break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}
