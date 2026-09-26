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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { fetchWithAuth("/api/orders").then((response) => setOrders(response.data)).catch(() => setError("Não foi possível carregar as suas encomendas.")).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => orders.filter((order) => `${order.orderNumber} ${order.items.map((item) => item.name).join(" ")}`.toLowerCase().includes(query.toLowerCase())), [orders, query]);
  return <div className="space-y-5 pb-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1d6ac4]">A minha conta</p><h1 className="mt-2 text-2xl font-black text-gray-900">As minhas encomendas</h1><p className="mt-1 text-sm text-gray-500">Consulte as encomendas persistidas na sua conta.</p></div><Link href="/products" className="btn-primary"><ShoppingBag size={15} /> Nova encomenda</Link></div><div className="card p-4"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por número ou produto..." className="settings-input pl-9" /></div></div>{loading && <div className="card p-12 text-center text-sm text-gray-500">A carregar encomendas...</div>}{error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{!loading && !error && visible.length === 0 && <div className="card p-12 text-center"><Package size={40} className="mx-auto mb-3 text-gray-300" /><h2 className="font-bold text-gray-900">Ainda não tem encomendas</h2><Link href="/products" className="btn-primary mt-5">Explorar produtos</Link></div>}{visible.length > 0 && <div className="card divide-y divide-gray-100">{visible.map((order) => <Link href={`/account/orders/${order.id}`} key={order.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-blue-50/40"><div className="min-w-0 flex-1"><p className="text-xs font-black text-gray-900">{order.orderNumber}</p><p className="text-[10px] text-gray-500">{new Date(order.createdAt).toLocaleDateString("pt-PT")} · {order.items.length} item(ns)</p></div><div className="flex items-center gap-1">{order.items.slice(0, 3).map((item) => <img key={item.id} src={item.imageUrl || "/file.svg"} alt="" className="h-9 w-9 rounded bg-gray-50 object-contain" />)}</div><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{labels[order.status] || order.status}</span><strong className="text-xs text-gray-900">Kz {Number(order.totalKZ).toLocaleString("pt-AO")}</strong><ArrowRight size={15} className="text-[#1555d8]" /></Link>)}</div>}</div>;
}
