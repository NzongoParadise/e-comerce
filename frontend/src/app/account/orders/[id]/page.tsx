"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  Download,
  Headphones,
  MapPin,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type OrderItem = {
  id: number;
  name: string;
  imageUrl?: string;
  quantity: number;
  subtotal: string;
};

type Order = {
  id?: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  shippingMethod: string;
  totalKZ: string;
  totalEUR?: string;
  address?: string;
  phone?: string;
  createdAt: string;
  items: OrderItem[];
};

const statusConfig: Record<string, { label: string; description: string }> = {
  AWAITING_PAYMENT: { label: "A aguardar pagamento", description: "Conclua o pagamento para processarmos a encomenda." },
  PAYMENT_CONFIRMED: { label: "Pagamento confirmado", description: "Pagamento recebido. A encomenda será preparada." },
  PROCESSING: { label: "Em preparação", description: "A sua encomenda está a ser preparada." },
  SHIPPED: { label: "Em trânsito", description: "A encomenda foi expedida e está a caminho." },
  DELIVERED: { label: "Entregue", description: "A encomenda foi entregue com sucesso." },
  CANCELLED: { label: "Cancelada", description: "Esta encomenda foi cancelada." },
};

function getStatus(status: string) {
  return statusConfig[status] || { label: status.replaceAll("_", " "), description: "Estado atual da encomenda." };
}

function formatMoney(value: string | number, currency: "AOA" | "EUR") {
  return new Intl.NumberFormat(currency === "AOA" ? "pt-AO" : "pt-PT", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function getProgress(status: string) {
  if (status === "CANCELLED") return -1;
  if (status === "AWAITING_PAYMENT") return 0;
  if (status === "PAYMENT_CONFIRMED") return 1;
  if (status === "PROCESSING") return 2;
  if (status === "SHIPPED") return 3;
  if (status === "DELIVERED") return 4;
  return 1;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithAuth(`/api/orders/${id}`)
      .then((response) => setOrder(response.data))
      .catch(() => setError("Não foi possível carregar esta encomenda."));
  }, [id]);

  const progress = useMemo(() => getProgress(order?.status || ""), [order?.status]);
  const status = getStatus(order?.status || "");

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="card border border-red-100 bg-red-50 p-8 text-center">
          <p className="font-semibold text-red-700">{error}</p>
          <Link href="/account/orders" className="btn-primary mt-5 inline-flex">
            Voltar às encomendas
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="card animate-pulse p-8">
          <div className="h-6 w-48 rounded bg-gray-100" />
          <div className="mt-4 h-4 w-72 rounded bg-gray-100" />
          <div className="mt-8 h-32 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  const timeline = [
    { title: "Pagamento", description: "Pagamento confirmado" },
    { title: "Preparação", description: "Encomenda em preparação" },
    { title: "Expedição", description: "Encomenda em trânsito" },
    { title: "Entrega", description: "Encomenda entregue" },
  ];

  return (
    <div className="min-h-full bg-gray-50/60 pb-12">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <Link href="/account/orders" className="inline-flex items-center gap-1 font-semibold hover:text-gray-900">
            <ArrowLeft size={14} />
            Minhas encomendas
          </Link>
          <ChevronRight size={13} className="text-gray-300" />
          <span>{order.orderNumber}</span>
        </div>

        <header className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
                  Encomenda {order.orderNumber}
                </h1>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  order.status === "DELIVERED"
                    ? "bg-emerald-50 text-emerald-700"
                    : order.status === "CANCELLED"
                      ? "bg-red-50 text-red-700"
                      : "bg-blue-50 text-blue-700"
                }`}>
                  {status.label}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Realizada em {new Date(order.createdAt).toLocaleString("pt-PT")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => window.print()} className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs">
                <Download size={15} />
                Fatura
              </button>
              <Link href={`/account/orders/${id}/tracking`} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs">
                <Truck size={15} />
                Acompanhar
              </Link>
            </div>
          </div>
        </header>

        {progress === -1 ? (
          <section className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-5">
            <p className="font-bold text-red-800">{status.label}</p>
            <p className="mt-1 text-sm text-red-700">{status.description}</p>
          </section>
        ) : (
          <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Estado da encomenda</p>
                <h2 className="mt-1 text-lg font-black text-gray-950">{status.label}</h2>
                <p className="mt-1 text-sm text-gray-500">{status.description}</p>
              </div>
              <PackageCheck className="hidden text-blue-600 sm:block" size={30} />
            </div>

            <div className="relative grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div className="absolute left-[12%] right-[12%] top-4 hidden h-0.5 bg-gray-200 sm:block" />
              {timeline.map((step, index) => {
                const completed = progress >= index + 1;
                return (
                  <div key={step.title} className="relative z-10 flex flex-col items-center text-center">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                      completed
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 bg-white text-gray-300"
                    }`}>
                      {completed ? <Check size={14} strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current" />}
                    </span>
                    <p className={`mt-2 text-xs font-bold ${completed ? "text-gray-900" : "text-gray-400"}`}>{step.title}</p>
                    <p className="mt-1 hidden max-w-32 text-[10px] leading-4 text-gray-400 sm:block">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="space-y-6">
            <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-base font-black text-gray-950">Produtos</h2>
                  <p className="mt-0.5 text-xs text-gray-500">{order.items.length} {order.items.length === 1 ? "item" : "itens"} na encomenda</p>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4 px-5 py-4 sm:px-6">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 sm:h-20 sm:w-20">
                      <img src={item.imageUrl || "/file.svg"} alt={item.name} className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-gray-900">{item.name}</h3>
                      <p className="mt-1 text-xs text-gray-500">Quantidade: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-950">{formatMoney(item.subtotal, "EUR")}</p>
                      <p className="mt-1 text-[10px] text-gray-400">Subtotal</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 border-t border-gray-100 bg-gray-50/70 p-4 sm:grid-cols-2">
                <Link href="/account/returns" className="btn-secondary inline-flex justify-center gap-2 py-2.5 text-xs">
                  <RefreshCcw size={14} />
                  Solicitar devolução
                </Link>
                <Link href="/account/support" className="btn-secondary inline-flex justify-center gap-2 py-2.5 text-xs">
                  <Headphones size={14} />
                  Contactar suporte
                </Link>
              </div>
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <MapPin size={17} />
                  </span>
                  <div>
                    <h2 className="text-sm font-black text-gray-950">Entrega</h2>
                    <p className="text-[11px] text-gray-400">Destino da encomenda</p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl bg-gray-50 p-4 text-xs leading-5 text-gray-600">
                  <p className="font-semibold text-gray-900">{order.address || "Levantamento na loja"}</p>
                  {order.phone && <p className="mt-1">{order.phone}</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Truck size={17} />
                  </span>
                  <div>
                    <h2 className="text-sm font-black text-gray-950">Envio</h2>
                    <p className="text-[11px] text-gray-400">Método selecionado</p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl bg-gray-50 p-4">
                  <p className="text-sm font-bold text-gray-900">{order.shippingMethod}</p>
                  <Link href={`/account/orders/${id}/tracking`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600">
                    Ver rastreio
                    <ChevronRight size={13} />
                  </Link>
                </div>
              </section>
            </div>
          </main>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-black text-gray-950">Resumo do pagamento</h2>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4 text-gray-500">
                  <span>Método</span>
                  <span className="text-right font-semibold text-gray-900">{order.paymentMethod}</span>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-end justify-between gap-4">
                    <span className="font-bold text-gray-700">Total</span>
                    <div className="text-right">
                      <p className="text-xl font-black text-gray-950">{formatMoney(order.totalKZ, "AOA")}</p>
                      {order.totalEUR && <p className="mt-0.5 text-[11px] text-gray-400">{formatMoney(order.totalEUR, "EUR")}</p>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-emerald-50 p-3">
                <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                <p className="text-[11px] font-semibold leading-4 text-emerald-800">Os dados desta encomenda são protegidos e o pagamento é processado de forma segura.</p>
              </div>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <CreditCard className="mt-0.5 shrink-0 text-blue-600" size={19} />
                <div>
                  <h2 className="text-sm font-black text-blue-950">Precisa de ajuda?</h2>
                  <p className="mt-1 text-xs leading-5 text-blue-800">Tem dúvidas sobre pagamento, entrega ou devolução?</p>
                  <Link href="/account/support" className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-700">
                    Falar com suporte
                    <ChevronRight size={13} />
                  </Link>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
