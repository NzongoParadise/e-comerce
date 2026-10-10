"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  WalletCards,
  XCircle,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Payment = {
  id: number;
  status: string;
  method: string;
  currency: string;
  amountEUR: string | number;
  amountKZ: string | number;
  paidAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  order: { orderNumber: string; status: string };
};

type FinanceData = {
  company: { tradeName?: string | null; legalName: string; nif: string };
  totalsByCurrency: Record<
    "AOA" | "EUR",
    { paid: number; pending: number; failed: number }
  >;
  payments: Payment[];
};

const paymentStatusLabels: Record<string, string> = {
  PAID: "Pago",
  AWAITING_PAYMENT: "Pendente",
  PROCESSING: "Em processamento",
  CREATED: "Criado",
  FAILED: "Falhado",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

const paymentStatusStyles: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  AWAITING_PAYMENT: "bg-amber-50 text-amber-800 ring-amber-600/20",
  PROCESSING: "bg-blue-50 text-blue-700 ring-blue-600/20",
  CREATED: "bg-slate-100 text-slate-700 ring-slate-500/20",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  EXPIRED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  REFUNDED: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

const orderStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Em processamento",
  AWAITING_PAYMENT: "A aguardar pagamento",
  PAID: "Pago",
  SHIPPED: "Expedido",
  DELIVERED: "Entregue",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

function formatMoney(value: number | string, currency: "AOA" | "EUR") {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function PaymentStatusBadge({ status }: { status: string }) {
  const Icon =
    status === "PAID"
      ? CheckCircle2
      : ["FAILED", "EXPIRED", "CANCELLED"].includes(status)
        ? XCircle
        : Clock3;

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${
        paymentStatusStyles[status] ??
        "bg-slate-100 text-slate-700 ring-slate-500/20"
      }`}
    >
      <Icon size={12} aria-hidden="true" />
      {paymentStatusLabels[status] ?? formatLabel(status)}
    </span>
  );
}

export default function B2BFinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [companyMissing, setCompanyMissing] = useState(false);

  async function load() {
    setError("");
    try {
      const result = await fetchWithAuth("/api/b2b/finance");
      setData(result.data);
      setCompanyMissing(false);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o financeiro empresarial.";
      if (message.includes("Conta empresarial não configurada")) {
        setCompanyMissing(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/b2b/finance")
      .then((result) => {
        if (!active) return;
        setData(result.data);
        setCompanyMissing(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        const message =
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar o financeiro empresarial.";
        if (message.includes("Conta empresarial não configurada")) {
          setCompanyMissing(true);
        } else {
          setError(message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <main
        className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8"
        aria-label="A carregar o financeiro empresarial"
      >
        <div className="h-36 animate-pulse rounded-2xl bg-slate-200 sm:rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
      </main>
    );
  }

  if (companyMissing) {
    return (
      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        <section className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:rounded-3xl sm:p-9">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-800">
            <Building2 size={23} />
          </span>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-800">
            B2B · Configuração empresarial
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[#0c1b2a] sm:text-3xl">
            O financeiro ainda não está associado
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            A sua conta B2B ainda não tem uma empresa ligada. Registe ou associe
            os dados oficiais para consultar aqui o histórico financeiro.
          </p>
          <Link
            href="/b2b/empresa"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0c1b2a] px-5 py-3 text-sm font-black text-white transition hover:bg-[#18334f] sm:w-auto"
          >
            Registar ou associar empresa <Building2 size={16} />
          </Link>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-3 py-8 sm:px-6 sm:py-12">
        <section
          className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm sm:p-6"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 shrink-0 text-rose-600" size={20} />
            <div>
              <h1 className="font-black text-slate-950">
                Não foi possível carregar o financeiro
              </h1>
              <p className="mt-2 text-sm leading-5 text-slate-600">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0c1b2a] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700"
              >
                <RefreshCw size={14} /> Tentar novamente
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-3xl px-3 py-8 sm:px-6 sm:py-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="font-black text-[#0c1b2a]">
            Dados financeiros indisponíveis
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            O serviço não devolveu os dados financeiros da empresa. Tente
            atualizar a página.
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  const metrics = [
    ...(["AOA", "EUR"] as const).flatMap((currency) => [
      {
        label: `Pago · ${currency}`,
        value: formatMoney(data.totalsByCurrency[currency].paid, currency),
        detail: "Pagamentos confirmados",
        Icon: CheckCircle2,
        tone: "bg-emerald-50 text-emerald-700",
      },
      {
        label: `Por pagar · ${currency}`,
        value: formatMoney(data.totalsByCurrency[currency].pending, currency),
        detail: "Pagamentos em aberto",
        Icon: Clock3,
        tone: "bg-amber-50 text-amber-800",
      },
      {
        label: `Falhado · ${currency}`,
        value: formatMoney(data.totalsByCurrency[currency].failed, currency),
        detail: "Pagamentos não concluídos",
        Icon: AlertCircle,
        tone: "bg-rose-50 text-rose-700",
      },
    ]),
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
      <header className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mb-8 sm:rounded-3xl">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-[#f6b73c]" />
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a6700]">
              Área empresarial <span className="px-1 text-slate-300">/</span>{" "}
              Compras
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Financeiro
            </h1>
            <p className="mt-2 break-words text-sm leading-6 text-slate-600">
              {data.company.tradeName || data.company.legalName}
              <span className="px-2 text-slate-300">·</span>
              NIF {data.company.nif}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            disabled={loading}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : ""}
              aria-hidden="true"
            />
            Atualizar
          </button>
        </div>
      </header>

      <section
        className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-3"
        aria-label="Resumo financeiro"
      >
        {metrics.map(({ label, value, detail, Icon, tone }) => (
          <article
            key={label}
            className={`min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5 ${
              label === "Falhado ou cancelado" ? "col-span-2 lg:col-span-1" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold leading-4 text-slate-500 sm:text-xs">
                  {label}
                </p>
                <p className="mt-2 break-words text-lg font-black tracking-tight text-slate-950 sm:text-2xl">
                  {value}
                </p>
              </div>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${tone}`}
              >
                <Icon size={16} aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500 sm:text-xs">
              {detail}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <WalletCards size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-950 sm:text-base">
              Histórico financeiro
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Pagamentos associados às encomendas da empresa.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
            {data.payments.length}
          </span>
        </div>

        {data.payments.length ? (
          <div className="divide-y divide-slate-100">
            {data.payments.map((payment) => {
              const eventDate =
                payment.status === "PAID" && payment.paidAt
                  ? payment.paidAt
                  : payment.status === "FAILED" && payment.failedAt
                    ? payment.failedAt
                    : payment.createdAt;

              return (
                <article
                  key={payment.id}
                  className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-slate-50/60 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <CreditCard size={17} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">
                        Encomenda {payment.order.orderNumber}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {formatDate(eventDate)}
                        <span className="px-1.5 text-slate-300">·</span>
                        {payment.method === "MANUAL_INVOICE"
                          ? "Instruções da equipa comercial"
                          : payment.method === "STRIPE_CHECKOUT"
                            ? "Stripe"
                            : formatLabel(payment.method)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:gap-5 md:justify-end md:border-0 md:pt-0">
                    <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                      <PaymentStatusBadge status={payment.status} />
                      <span className="text-[10px] font-semibold text-slate-500">
                        Encomenda:{" "}
                        {orderStatusLabels[payment.order.status] ??
                          formatLabel(payment.order.status)}
                      </span>
                    </div>
                    <strong className="shrink-0 text-right text-sm font-black text-slate-950">
                      {formatMoney(
                        payment.currency === "AOA"
                          ? payment.amountKZ
                          : payment.amountEUR,
                        payment.currency === "AOA" ? "AOA" : "EUR",
                      )}
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-10 text-center sm:px-6 sm:py-14">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <WalletCards size={21} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-sm font-black text-slate-900">
              Ainda não existem pagamentos empresariais
            </h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
              Quando a empresa efetuar o primeiro pagamento, o respetivo estado
              e montante serão apresentados aqui.
            </p>
            <Link
              href="/b2b/encomendas"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Consultar encomendas <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
