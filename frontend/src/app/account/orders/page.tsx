"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Package, Search, ShoppingBag } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type OrderItem = { id: number; name: string; imageUrl?: string; quantity: number };
type Order = { id: number; orderNumber: string; status: string; totalKZ: string; createdAt: string; items: OrderItem[] };
const labels: Record<string, string> = { PENDING: "Pendente", PROCESSING: "Em processamento", SHIPPED: "Em trânsito", DELIVERED: "Entregue", CANCELLED: "Cancelada" };

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithAuth("/api/orders")
      .then((response) => setOrders(response.data || []))
      .catch(() => setError("Não foi possível carregar as suas encomendas."))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    ALL: orders.length,
    PENDING: orders.filter((o) => o.status === "PENDING").length,
    PROCESSING: orders.filter((o) => o.status === "PROCESSING").length,
    SHIPPED: orders.filter((o) => o.status === "SHIPPED").length,
    DELIVERED: orders.filter((o) => o.status === "DELIVERED").length,
    CANCELLED: orders.filter((o) => o.status === "CANCELLED").length,
  }), [orders]);

  const visible = useMemo(() => orders.filter((order) => {
    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
    const haystack = `${order.orderNumber} ${order.items.map((item) => item.name).join(" ")}`.toLowerCase();
    return matchesStatus && haystack.includes(query.trim().toLowerCase());
  }), [orders, query, statusFilter]);

  const tabs: Array<{ id: typeof statusFilter; label: string }> = [
    { id: "ALL", label: "Todas" },
    { id: "PENDING", label: "Pendentes" },
    { id: "PROCESSING", label: "Em processamento" },
    { id: "SHIPPED", label: "Em trânsito" },
    { id: "DELIVERED", label: "Concluídas" },
    { id: "CANCELLED", label: "Canceladas" },
  ];

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="section-kicker">Conta · Compras</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">As minhas encomendas</h1>
          <p className="mt-2 text-sm text-slate-500">Acompanhe pedidos, pagamentos, entrega e histórico de compras.</p>
        </div>
        <Link href="/products" className="btn-primary"><ShoppingBag size={15} /> Continuar a comprar</Link>
      </header>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 pt-4 sm:px-5">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setStatusFilter(tab.id)} className={statusFilter === tab.id ? "border-b-2 border-[#1d6ac4] px-3 py-2.5 text-[10px] font-black text-[#1555d8]" : "border-b-2 border-transparent px-3 py-2.5 text-[10px] font-bold text-slate-500 hover:text-slate-900"}>
                {tab.label} <span className="ml-1 text-[9px] text-slate-400">{counts[tab.id]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por número ou produto..." className="settings-input pl-9" />
          </div>
        </div>
      </section>

      {loading && (
        <div className="grid gap-3">
          {[1, 2, 3].map((item) => <div key={item} className="card h-28 animate-pulse bg-slate-50" />)}
        </div>
      )}

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

      {!loading && !error && visible.length === 0 && (
        <div className="card p-12 text-center">
          <Package size={40} className="mx-auto mb-3 text-slate-300" />
          <h2 className="font-bold text-slate-900">{orders.length ? "Nenhuma encomenda corresponde ao filtro" : "Ainda não tem encomendas"}</h2>
          <p className="mt-1 text-xs text-slate-500">{orders.length ? "Experimente outro estado ou termo de pesquisa." : "As suas compras aparecerão aqui depois do checkout."}</p>
          {!orders.length && <Link href="/products" className="btn-primary mt-5">Explorar produtos</Link>}
        </div>
      )}

      {visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((order) => (
            <Link href={`/account/orders/${order.id}`} key={order.id} className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black text-slate-900">Encomenda {order.orderNumber}</span>
                  <span className="text-[9px] text-slate-400">·</span>
                  <span className="text-[9px] font-semibold text-slate-500">{new Date(order.createdAt).toLocaleDateString("pt-PT")}</span>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${order.status === "DELIVERED" ? "bg-emerald-50 text-emerald-700" : order.status === "CANCELLED" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>{labels[order.status] || order.status}</span>
              </div>
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex -space-x-2">
                    {order.items.slice(0, 4).map((item) => <img key={item.id} src={item.imageUrl || "/file.svg"} alt="" className="h-11 w-11 rounded-lg border-2 border-white bg-slate-50 object-contain" />)}
                  </div>
                  <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{order.items[0]?.name || "Produtos da encomenda"}</p><p className="mt-1 text-[10px] text-slate-500">{order.items.length} artigo(s) · Consulte os detalhes da encomenda</p></div>
                </div>
                <div className="sm:w-40"><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Total</p><p className="mt-1 text-base font-black text-slate-950">Kz {Number(order.totalKZ).toLocaleString("pt-AO")}</p></div>
                <div className="flex items-center justify-end text-[#1555d8]"><ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
