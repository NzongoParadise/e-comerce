"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileDown,
  Filter,
  LoaderCircle,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  X,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type OrderStatus = "AWAITING_PAYMENT" | "PROCESSING" | "PAYMENT_CONFIRMED" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "PAYMENT_REVIEW_REQUIRED" | "PAYMENT_REVIEW_IN_PROGRESS";
type OrderItem = { id: number; name: string; imageUrl?: string | null; quantity: number; subtotal: string | number };
type Order = {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  country: "AO" | "PT";
  currency: string;
  totalKZ: string | number;
  totalEUR: string | number;
  createdAt: string;
  address?: string | null;
  phone?: string | null;
  deliveryRecipient?: string | null;
  deliveryCity?: string | null;
  deliveryRegion?: string | null;
  postalCode?: string | null;
  deliveryNotes?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  user: { id: number; name?: string | null; email?: string | null; accountName: string; accountType: string };
  items: OrderItem[];
  payment?: { status: string; method: string; provider: string; currency: string; paidAt?: string | null } | null;
  trackingEvents: { id: number; status: string; location?: string | null; description?: string | null; occurredAt: string }[];
};
type Customer = { id: number; name?: string | null; email?: string | null; accountName: string; accountType: string };
type Product = { id: number; name: string; stock: number; basePrice: number | string; prices: { market: "AO" | "PT"; amount: number | string }[] };
type Stats = { awaitingPayment: number; processing: number; paid: number; shipped: number; delivered: number; cancelled: number; revenueKZ: string | number };
type DraftItem = { productId: number; quantity: number };

const statusLabels: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  PROCESSING: "Em processamento",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  SHIPPED: "Enviada",
  IN_TRANSIT: "Em trânsito",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelada",
  PAYMENT_REVIEW_REQUIRED: "Revisão de pagamento",
  PAYMENT_REVIEW_IN_PROGRESS: "Revisão em curso",
};
const statusStyles: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "bg-amber-50 text-amber-800",
  PROCESSING: "bg-blue-50 text-blue-700",
  PAYMENT_CONFIRMED: "bg-emerald-50 text-emerald-700",
  SHIPPED: "bg-violet-50 text-violet-700",
  IN_TRANSIT: "bg-sky-50 text-sky-700",
  DELIVERED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  PAYMENT_REVIEW_REQUIRED: "bg-orange-50 text-orange-700",
  PAYMENT_REVIEW_IN_PROGRESS: "bg-orange-50 text-orange-700",
};
const statusFilters: { label: string; value: "ALL" | OrderStatus }[] = [
  { label: "Todas", value: "ALL" },
  { label: "Aguardando pagamento", value: "AWAITING_PAYMENT" },
  { label: "Em processamento", value: "PROCESSING" },
  { label: "Pagas", value: "PAYMENT_CONFIRMED" },
  { label: "Enviadas", value: "SHIPPED" },
  { label: "Em trânsito", value: "IN_TRANSIT" },
  { label: "Entregues", value: "DELIVERED" },
  { label: "Canceladas", value: "CANCELLED" },
];
const menuItems = [
  [BarChart3, "Visão geral", "/admin"],
  [ShoppingBag, "Vendas", "/admin/orders"],
  [Package, "Produtos", "/admin/products"],
  [Boxes, "Gestão de stock", "/admin/stock"],
  [Users, "Clientes", "/admin/clients"],
  [Building2, "Fornecedores", "/admin/suppliers"],
  [Users, "Utilizadores", "/admin/users"],
  [Settings, "Configurações", "/admin/settings"],
] as const;

function formatMoney(value: string | number, currency: string) {
  const number = Number(value || 0);
  return currency === "EUR"
    ? `€ ${number.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
    : `Kz ${number.toLocaleString("pt-AO", { minimumFractionDigits: 2 })}`;
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Package; tone: string }) {
  return <div className="border border-gray-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold text-gray-500">{label}</p><p className="mt-1 text-2xl font-black text-gray-900">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center ${tone}`}><Icon size={18} /></span></div></div>;
}

export default function OrdersAdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ awaitingPayment: 0, processing: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0, revenueKZ: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [newProductId, setNewProductId] = useState("");
  const [createForm, setCreateForm] = useState({
    userId: "",
    country: "AO" as "AO" | "PT",
    deliveryMode: "address" as "address" | "pickup",
    shippingMethod: "standard" as "standard" | "express" | "pickup",
    paymentMethod: "cash" as "cash" | "transfer",
    address: "",
    phone: "",
    deliveryRecipient: "",
    deliveryCity: "",
    deliveryRegion: "",
    postalCode: "",
    deliveryNotes: "",
    note: "",
  });

  const selected = orders.find((order) => order.id === selectedId) || null;
  const visibleProducts = useMemo(() => products.filter((product) => product.stock > 0), [products]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ page: String(page), pageSize: "20", status: statusFilter, search });
        const response = await fetchWithAuth(`/api/admin/orders?${query}`);
        if (!active) return;
        setOrders(response.data);
        setStats(response.stats);
        setPageCount(response.meta.pageCount || 1);
        setSelectedId((current) => response.data.some((order: Order) => order.id === current) ? current : response.data[0]?.id || null);
      } catch {
        if (active) setError("Não foi possível carregar as vendas. Verifique a ligação e tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!showCreate) return;
    Promise.all([
      fetchWithAuth("/api/admin/clients?status=ACTIVE&page=1&pageSize=100"),
      fetchWithAuth("/api/products?page=1&pageSize=100"),
    ]).then(([clientResponse, productResponse]) => {
      setCustomers(clientResponse.data);
      setProducts(productResponse.data);
    }).catch(() => setError("Não foi possível carregar clientes e produtos para a nova venda."));
  }, [showCreate]);

  async function reloadOrders() {
    const query = new URLSearchParams({ page: String(page), pageSize: "20", status: statusFilter, search });
    const response = await fetchWithAuth(`/api/admin/orders?${query}`);
    setOrders(response.data);
    setStats(response.stats);
    setPageCount(response.meta.pageCount || 1);
    setSelectedId((current) => response.data.some((order: Order) => order.id === current) ? current : response.data[0]?.id || null);
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftItems.length) { setError("Adicione pelo menos um produto à venda."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetchWithAuth("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          userId: Number(createForm.userId),
          items: draftItems,
        }),
      });
      setShowCreate(false);
      setDraftItems([]);
      setNotice(`Venda ${response.data.orderNumber} criada e stock atualizado.`);
      await reloadOrders();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar a venda.");
    } finally { setBusy(false); }
  }

  async function updateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formData = new FormData(event.currentTarget);
    const nextStatus = String(formData.get("status") || "");
    const note = String(formData.get("note") || "").trim();
    if (note.length < 8) {
      setError("Indique uma nota de auditoria com pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await fetchWithAuth(`/api/admin/orders/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(nextStatus ? { status: nextStatus } : {}),
          carrier: formData.get("carrier"),
          trackingNumber: formData.get("trackingNumber"),
          location: formData.get("location"),
          ...(note ? { note } : {}),
        }),
      });
      setNotice("Venda atualizada com sucesso.");
      await reloadOrders();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Não foi possível atualizar a venda.");
    } finally { setBusy(false); }
  }

  async function cancelOrder() {
    if (!selected || !window.confirm(`Cancelar a venda ${selected.orderNumber}? O stock reservado será reposto.`)) return;
    setBusy(true);
    setError("");
    try {
      await fetchWithAuth(`/api/admin/orders/${selected.id}`, { method: "DELETE" });
      setNotice("Venda cancelada e stock reposto.");
      await reloadOrders();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Não foi possível cancelar a venda.");
    } finally { setBusy(false); }
  }

  async function updateDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formData = new FormData(event.currentTarget);
    const note = String(formData.get("note") || "").trim();
    if (note.length < 8) { setError("A nota de auditoria deve ter pelo menos 8 caracteres."); return; }
    setBusy(true);
    setError("");
    try {
      await fetchWithAuth(`/api/admin/orders/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: formData.get("address"),
          phone: formData.get("phone"),
          deliveryRecipient: formData.get("deliveryRecipient"),
          deliveryCity: formData.get("deliveryCity"),
          deliveryRegion: formData.get("deliveryRegion"),
          postalCode: formData.get("postalCode"),
          deliveryNotes: formData.get("deliveryNotes"),
          note,
        }),
      });
      setNotice("Dados de entrega atualizados.");
      await reloadOrders();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Não foi possível atualizar a entrega.");
    } finally { setBusy(false); }
  }

  function addDraftProduct() {
    const productId = Number(newProductId);
    if (!productId) return;
    setDraftItems((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) return current.map((item) => item.productId === productId ? { ...item, quantity: Math.min(item.quantity + 1, products.find((product) => product.id === productId)?.stock || 99) } : item);
      return [...current, { productId, quantity: 1 }];
    });
    setNewProductId("");
  }

  function exportOrders() {
    const rows = [["Encomenda", "Cliente", "Data", "Estado", "Destino", "Total"], ...orders.map((order) => [
      order.orderNumber,
      order.user.accountName || order.user.name || "",
      new Date(order.createdAt).toLocaleDateString("pt-PT"),
      statusLabels[order.status],
      order.deliveryCity || order.address || "",
      formatMoney(order.country === "PT" ? order.totalEUR : order.totalKZ, order.currency),
    ])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vendas-rubrica-diligente.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const statusOptions = selected?.status === "AWAITING_PAYMENT" || selected?.status === "PROCESSING"
    ? ["PAYMENT_CONFIRMED"]
    : selected?.status === "PAYMENT_CONFIRMED"
      ? ["SHIPPED"]
      : selected?.status === "SHIPPED" ? ["IN_TRANSIT", "DELIVERED"]
      : selected?.status === "IN_TRANSIT" ? ["DELIVERED"] : [];
  const canCancel = Boolean(selected && ["AWAITING_PAYMENT", "PROCESSING"].includes(selected.status) && selected.payment?.status !== "PAID");
  const canEditDelivery = Boolean(selected && ["AWAITING_PAYMENT", "PROCESSING"].includes(selected.status) && selected.payment?.status !== "PAID");

  return <div className="min-h-screen bg-[#f7f9fc] text-gray-900">
    <header className="border-b border-gray-200 bg-white"><div className="flex h-16 items-center gap-4 px-4 lg:px-6"><Link href="/admin" className="flex items-center gap-2 lg:w-60"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1555d8] text-white"><Package size={18} /></span><span className="hidden leading-none sm:block"><strong className="text-base font-black">RUBRICA DILIGENTE (SU), LDA</strong><small className="mt-1 block text-[8px] font-bold uppercase tracking-widest text-[#1555d8]">Painel Administrativo</small></span></Link><div className="relative hidden max-w-xl flex-1 md:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar venda, cliente, produto ou tracking..." className="w-full border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:bg-white" /></div><div className="ml-auto flex items-center gap-2"><Link href="/admin/orders/payment-review" className="inline-flex items-center gap-2 border border-amber-200 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50">Revisão de pagamentos</Link><span className="hidden h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white sm:flex">TG</span><span className="hidden text-[10px] leading-tight sm:block"><strong className="block">Administração</strong><span className="text-gray-500">Vendas</span></span></div></div></header>
    <div className="flex">
      <aside className="hidden min-h-[calc(100vh-64px)] w-60 shrink-0 border-r border-gray-200 bg-[#10233e] text-white lg:block"><div className="border-b border-white/10 px-5 py-5"><div className="flex items-center gap-2"><Building2 size={17} /><div><strong className="text-sm">RUBRICA DILIGENTE (SU), LDA</strong><span className="block text-[9px] text-blue-200">Painel Administrativo</span></div></div></div><nav className="space-y-1 p-3 text-xs font-medium">{menuItems.map(([Icon, label, href]) => <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2.5 ${href === "/admin/orders" ? "bg-blue-600 text-white" : "text-blue-100 hover:bg-white/10"}`}><Icon size={15} />{label}</Link>)}</nav></aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-7">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Operações comerciais</p><h1 className="mt-1 text-2xl font-black">Vendas e encomendas</h1><p className="mt-1 text-sm text-gray-500">Registe vendas, acompanhe pagamentos e atualize expedições.</p></div><div className="flex gap-2"><button type="button" onClick={exportOrders} className="inline-flex items-center gap-2 border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><FileDown size={15} />Exportar CSV</button><button type="button" onClick={() => { setError(""); setShowCreate(true); }} className="inline-flex items-center gap-2 bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"><Plus size={15} />Nova venda</button></div></div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Aguardando pagamento" value={String(stats.awaitingPayment)} icon={CircleHelp} tone="bg-amber-50 text-amber-700" /><Metric label="Em processamento" value={String(stats.processing)} icon={Package} tone="bg-blue-50 text-blue-700" /><Metric label="Pagas" value={String(stats.paid)} icon={ShoppingBag} tone="bg-emerald-50 text-emerald-700" /><Metric label="Em expedição" value={String(stats.shipped)} icon={Truck} tone="bg-violet-50 text-violet-700" /><Metric label="Receita registada (AOA)" value={formatMoney(stats.revenueKZ, "AOA")} icon={BarChart3} tone="bg-gray-100 text-gray-700" /></div>

          {notice && <div role="status" className="mb-4 flex items-center justify-between border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={16} /></button></div>}
          {error && <div role="alert" className="mb-4 flex items-center justify-between border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}<button type="button" onClick={() => setError("")} aria-label="Fechar erro"><X size={16} /></button></div>}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
            <section className="min-w-0 border border-gray-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black">Registo de vendas</h2><p className="mt-1 text-xs text-gray-500">{loading ? "A carregar..." : `${orders.length} resultado(s) nesta página`}</p></div><label className="flex items-center gap-2 text-xs text-gray-500"><Filter size={14} /><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "ALL" | OrderStatus); setPage(1); }} className="border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700"><option value="ALL">Todos os estados</option>{statusFilters.slice(1).map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label></div>
              <div className="hidden grid-cols-[1.25fr_1.3fr_0.85fr_0.85fr_1fr] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[9px] font-black uppercase tracking-wide text-gray-500 md:grid"><span>Venda</span><span>Cliente</span><span>Data</span><span>Estado</span><span className="text-right">Total</span></div>
              <div className="divide-y divide-gray-100">
                {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500"><LoaderCircle size={17} className="animate-spin" />A carregar vendas...</div>
                  : orders.length === 0 ? <div className="p-10 text-center"><ShoppingBag size={22} className="mx-auto text-gray-300" /><p className="mt-2 text-sm font-semibold text-gray-700">Nenhuma venda encontrada</p><p className="mt-1 text-xs text-gray-500">Crie uma venda ou altere os filtros.</p></div>
                    : orders.map((order) => <button key={order.id} type="button" onClick={() => setSelectedId(order.id)} className={`grid w-full gap-2 px-4 py-3 text-left hover:bg-blue-50/40 md:grid-cols-[1.25fr_1.3fr_0.85fr_0.85fr_1fr] md:items-center ${selectedId === order.id ? "bg-blue-50/70" : ""}`}><span className="min-w-0"><strong className="block truncate text-xs text-gray-900">{order.orderNumber}</strong><span className="text-[10px] text-gray-500">{order.items.reduce((sum, item) => sum + item.quantity, 0)} artigo(s)</span></span><span className="min-w-0"><strong className="block truncate text-xs text-gray-800">{order.user.accountName || order.user.name || "Cliente"}</strong><span className="block truncate text-[10px] text-gray-500">{order.user.email || "Sem email"}</span></span><span className="text-[10px] text-gray-600">{new Date(order.createdAt).toLocaleDateString("pt-PT")}</span><span className={`w-fit px-2 py-1 text-[9px] font-bold ${statusStyles[order.status]}`}>{statusLabels[order.status]}</span><strong className="text-right text-xs text-gray-900">{formatMoney(order.country === "PT" ? order.totalEUR : order.totalKZ, order.currency)}</strong></button>)}
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500"><span>Página {page} de {pageCount}</span><div className="flex gap-1"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="border border-gray-200 p-1.5 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={15} /></button><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="border border-gray-200 p-1.5 disabled:opacity-40" aria-label="Página seguinte"><ChevronRight size={15} /></button></div></div>
            </section>

            <aside className="border border-gray-200 bg-white">
              {!selected ? <div className="p-8 text-center text-sm text-gray-500">Selecione uma venda para ver os detalhes.</div> : <>
                <div className="border-b border-gray-200 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-[9px] font-bold uppercase tracking-widest text-blue-700">Detalhes da venda</p><h2 className="mt-1 text-base font-black">{selected.orderNumber}</h2></div><span className={`px-2 py-1 text-[9px] font-bold ${statusStyles[selected.status]}`}>{statusLabels[selected.status]}</span></div><p className="mt-2 text-[10px] text-gray-500">Criada {new Date(selected.createdAt).toLocaleString("pt-PT")}</p></div>
                <div className="space-y-4 p-4">
                  <section><h3 className="mb-2 text-[10px] font-black uppercase text-gray-500">Cliente</h3><p className="text-sm font-bold text-gray-900">{selected.user.accountName || selected.user.name || "Cliente"}</p><p className="text-xs text-gray-500">{selected.user.email}</p><p className="mt-1 text-[10px] text-gray-500">{selected.user.accountType} · {selected.country}</p></section>
                  <section className="border-t border-gray-100 pt-3"><h3 className="mb-2 text-[10px] font-black uppercase text-gray-500">Artigos</h3><div className="space-y-2">{selected.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-gray-700">{item.quantity} × {item.name}</span><strong className="shrink-0 text-gray-900">{formatMoney(item.subtotal, selected.currency)}</strong></div>)}</div><div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm"><strong>Total</strong><strong>{formatMoney(selected.country === "PT" ? selected.totalEUR : selected.totalKZ, selected.currency)}</strong></div></section>
                  <section className="border-t border-gray-100 pt-3"><h3 className="mb-2 text-[10px] font-black uppercase text-gray-500">Pagamento e entrega</h3><p className="text-xs text-gray-700">Pagamento: <strong>{selected.payment?.status || "Sem registo"}</strong> · {selected.payment?.method || "—"}</p><p className="mt-1 text-xs text-gray-600">{selected.deliveryCity || selected.address || "Levantamento / destino não indicado"}</p>{selected.phone && <p className="mt-1 text-xs text-gray-500">{selected.phone}</p>}</section>
                  <form key={`${selected.id}-${selected.status}-${selected.carrier}-${selected.trackingNumber}`} onSubmit={updateOrder} className="space-y-3 border-t border-gray-100 pt-3"><h3 className="text-[10px] font-black uppercase text-gray-500">Atualizar e expedir</h3>{statusOptions.length > 0 && <label className="block text-[10px] font-semibold text-gray-600">Próximo estado<select name="status" defaultValue="" className="mt-1 w-full border border-gray-200 bg-white px-2 py-2 text-xs"><option value="">Manter estado</option>{statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status as OrderStatus]}</option>)}</select></label>}<div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-gray-600">Transportadora<input name="carrier" defaultValue={selected.carrier || ""} className="mt-1 w-full border border-gray-200 px-2 py-2 text-xs" /></label><label className="text-[10px] font-semibold text-gray-600">Tracking<input name="trackingNumber" defaultValue={selected.trackingNumber || ""} className="mt-1 w-full border border-gray-200 px-2 py-2 text-xs" /></label></div><label className="block text-[10px] font-semibold text-gray-600">Localização<input name="location" defaultValue={selected.deliveryCity || selected.deliveryRegion || ""} className="mt-1 w-full border border-gray-200 px-2 py-2 text-xs" /></label><label className="block text-[10px] font-semibold text-gray-600">Nota de auditoria<textarea name="note" rows={2} className="mt-1 w-full resize-y border border-gray-200 px-2 py-2 text-xs" placeholder="Motivo da alteração..." /></label><button type="submit" disabled={busy || selected.status === "CANCELLED"} className="w-full bg-blue-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">{busy ? "A guardar..." : "Guardar alterações"}</button>{canCancel && <button type="button" disabled={busy} onClick={cancelOrder} className="w-full border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Cancelar venda e repor stock</button>}</form>
                  <section className="border-t border-gray-100 pt-3"><h3 className="mb-2 text-[10px] font-black uppercase text-gray-500">Histórico</h3><div className="space-y-2">{selected.trackingEvents.slice(0, 4).map((event) => <div key={event.id} className="border-l-2 border-blue-200 pl-2"><p className="text-[10px] font-bold text-gray-700">{statusLabels[event.status as OrderStatus] || event.status}</p><p className="text-[9px] text-gray-500">{new Date(event.occurredAt).toLocaleString("pt-PT")} · {event.location || "—"}</p>{event.description && <p className="mt-0.5 text-[9px] text-gray-500">{event.description}</p>}</div>)}</div></section>
                </div>
                {canEditDelivery && <form key={`delivery-${selected.id}-${selected.status}-${selected.address}-${selected.deliveryCity}-${selected.phone}`} onSubmit={updateDelivery} className="space-y-3 border-t border-gray-200 p-4"><div><h3 className="text-[10px] font-black uppercase text-gray-600">Editar dados da encomenda</h3><p className="mt-1 text-[10px] text-gray-500">Os dados de entrega só podem ser alterados antes da confirmação do pagamento.</p></div><label className="block text-[10px] font-semibold text-gray-600">Destinatário<input name="deliveryRecipient" defaultValue={selected.deliveryRecipient || ""} className="mt-1 w-full border border-gray-200 px-2 py-2 text-xs" /></label><div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-gray-600">Telefone<input name="phone" defaultValue={selected.phone || ""} className="mt-1 w-full border border-gray-200 px-2 py-2 text-xs" /></label><label className="text-[10px] font-semibold text-gray-600">Código postal<input name="postalCode" defaultValue={selected.postalCode || ""} className="mt-1 w-full border border-gray-200 px-2 py-2 text-xs" /></label></div><label className="block text-[10px] font-semibold text-gray-600">Morada<input name="address" defaultValue={selected.address || ""} className="mt-1 w-full border border-gray-200 px-2 py-2 text-xs" /></label><div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-gray-600">Cidade<input name="deliveryCity" defaultValue={selected.deliveryCity || ""} className="mt-1 w-full border border-gray-200 px-2 py-2 text-xs" /></label><label className="text-[10px] font-semibold text-gray-600">Província / região<input name="deliveryRegion" defaultValue={selected.deliveryRegion || ""} className="mt-1 w-full border border-gray-200 px-2 py-2 text-xs" /></label></div><label className="block text-[10px] font-semibold text-gray-600">Instruções<textarea name="deliveryNotes" defaultValue={selected.deliveryNotes || ""} rows={2} className="mt-1 w-full resize-y border border-gray-200 px-2 py-2 text-xs" /></label><label className="block text-[10px] font-semibold text-gray-600">Justificativa (mínimo 8 caracteres)<textarea name="note" required minLength={8} maxLength={500} rows={2} className="mt-1 w-full resize-y border border-gray-200 px-2 py-2 text-xs" placeholder="Motivo da alteração dos dados..." /></label><button type="submit" disabled={busy} className="w-full border border-blue-700 px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">{busy ? "A guardar..." : "Guardar dados da encomenda"}</button></form>}
              </>}
            </aside>
          </div>
        </div>
      </main>
    </div>

    {showCreate && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"><section role="dialog" aria-modal="true" aria-labelledby="new-order-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4"><div><h2 id="new-order-title" className="text-lg font-black">Registar venda</h2><p className="mt-1 text-xs text-gray-500">O preço e a disponibilidade são confirmados no servidor.</p></div><button type="button" onClick={() => setShowCreate(false)} className="p-2 text-gray-500 hover:bg-gray-100" aria-label="Fechar"><X size={18} /></button></div><form onSubmit={createOrder} className="space-y-5 p-5">
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-gray-700">Cliente<select required value={createForm.userId} onChange={(event) => setCreateForm((current) => ({ ...current, userId: event.target.value }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="">Selecionar cliente ativo</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.accountName || customer.name || customer.email} {customer.email ? `· ${customer.email}` : ""}</option>)}</select></label><label className="text-xs font-bold text-gray-700">Mercado<select value={createForm.country} onChange={(event) => setCreateForm((current) => ({ ...current, country: event.target.value as "AO" | "PT" }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="AO">Angola · AOA</option><option value="PT">Portugal · EUR</option></select></label></div>
      <section className="border border-gray-200"><div className="flex flex-col gap-2 border-b border-gray-100 p-3 sm:flex-row"><select value={newProductId} onChange={(event) => setNewProductId(event.target.value)} className="min-w-0 flex-1 border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Selecionar produto com stock</option>{visibleProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · stock {product.stock}</option>)}</select><button type="button" onClick={addDraftProduct} disabled={!newProductId} className="inline-flex items-center justify-center gap-2 bg-gray-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Plus size={14} />Adicionar</button></div><div className="divide-y divide-gray-100">{draftItems.length === 0 ? <p className="p-4 text-center text-xs text-gray-500">Adicione produtos para formar a venda.</p> : draftItems.map((item) => { const product = products.find((entry) => entry.id === item.productId); if (!product) return null; return <div key={item.productId} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-gray-800">{product.name}</p><p className="text-[10px] text-gray-500">Stock disponível: {product.stock}</p></div><button type="button" aria-label={`Diminuir quantidade de ${product.name}`} onClick={() => setDraftItems((current) => current.map((entry) => entry.productId === item.productId ? { ...entry, quantity: Math.max(1, entry.quantity - 1) } : entry))} className="h-7 w-7 border border-gray-300">−</button><span className="w-6 text-center text-xs font-bold">{item.quantity}</span><button type="button" aria-label={`Aumentar quantidade de ${product.name}`} disabled={item.quantity >= product.stock} onClick={() => setDraftItems((current) => current.map((entry) => entry.productId === item.productId ? { ...entry, quantity: Math.min(product.stock, entry.quantity + 1) } : entry))} className="h-7 w-7 border border-gray-300 disabled:opacity-40">+</button><button type="button" onClick={() => setDraftItems((current) => current.filter((entry) => entry.productId !== item.productId))} className="p-1 text-red-600" aria-label={`Remover ${product.name}`}><X size={15} /></button></div>; })}</div></section>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold text-gray-700">Entrega<select value={createForm.deliveryMode} onChange={(event) => setCreateForm((current) => ({ ...current, deliveryMode: event.target.value as "address" | "pickup", shippingMethod: event.target.value === "pickup" ? "pickup" : current.shippingMethod === "pickup" ? "standard" : current.shippingMethod }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="address">Morada</option><option value="pickup">Levantamento</option></select></label><label className="text-xs font-bold text-gray-700">Envio<select value={createForm.shippingMethod} onChange={(event) => setCreateForm((current) => ({ ...current, shippingMethod: event.target.value as "standard" | "express" | "pickup" }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="standard">Normal</option><option value="express">Expresso</option><option value="pickup">Levantamento</option></select></label><label className="text-xs font-bold text-gray-700">Pagamento<select value={createForm.paymentMethod} onChange={(event) => setCreateForm((current) => ({ ...current, paymentMethod: event.target.value as "cash" | "transfer" }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="cash">Dinheiro</option><option value="transfer">Transferência</option></select></label></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-gray-700">Destinatário<input value={createForm.deliveryRecipient} onChange={(event) => setCreateForm((current) => ({ ...current, deliveryRecipient: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-gray-700">Telefone{createForm.deliveryMode === "address" && <span className="text-red-600"> *</span>}<input required={createForm.deliveryMode === "address"} value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-gray-700 sm:col-span-2">Morada{createForm.deliveryMode === "address" && <span className="text-red-600"> *</span>}<input required={createForm.deliveryMode === "address"} value={createForm.address} onChange={(event) => setCreateForm((current) => ({ ...current, address: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-gray-700">Cidade<input value={createForm.deliveryCity} onChange={(event) => setCreateForm((current) => ({ ...current, deliveryCity: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-gray-700">Província / região<input value={createForm.deliveryRegion} onChange={(event) => setCreateForm((current) => ({ ...current, deliveryRegion: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5 text-sm" /></label></div>
      <label className="block text-xs font-bold text-gray-700">Nota obrigatória de auditoria<textarea required minLength={8} maxLength={500} value={createForm.note} onChange={(event) => setCreateForm((current) => ({ ...current, note: event.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 px-3 py-2.5 text-sm" placeholder="Ex.: venda presencial registada pela equipa comercial" /></label>
      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => setShowCreate(false)} className="border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">Fechar</button><button type="submit" disabled={busy || draftItems.length === 0} className="inline-flex items-center gap-2 bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy && <LoaderCircle size={15} className="animate-spin" />}{busy ? "A registar..." : "Registar venda"}</button></div>
    </form></section></div>}
  </div>;
}
