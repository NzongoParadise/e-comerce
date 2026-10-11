"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Box,
  Building2,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Eye,
  Heart,
  LayoutDashboard,
  LoaderCircle,
  MousePointerClick,
  Package,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Period = "7D" | "MONTH" | "LAST_MONTH";
type Currency = "AOA" | "EUR";
type DashboardOrder = {
  id: number;
  orderNumber: string;
  status: string;
  currency: string;
  totalEUR: string | number;
  totalKZ: string | number;
  createdAt: string;
  user: { name?: string | null; accountName: string };
  payment?: { status: string } | null;
};
type DashboardData = {
  period: string;
  metrics: {
    revenueAOA: number;
    revenueEUR: number;
    revenueChangeAOA: number | null;
    revenueChangeEUR: number | null;
    orders: number;
    ordersChange: number | null;
    newCustomers: number;
    customersChange: number | null;
    totalCustomers: number;
    activeCustomers: number;
    products: number;
    lowStock: number;
    outOfStock: number;
    stockUnits: number;
    expensesAOA: number;
    expensesEUR: number;
    otherIncomeAOA: number;
    otherIncomeEUR: number;
    balanceAOA: number;
    balanceEUR: number;
    pendingPayments: number;
    paymentReview: number;
  };
  recentOrders: DashboardOrder[];
  bestSellers: { productId: number; name: string; imageUrl?: string | null; units: number }[];
  trend: { month: string; label: string; revenueAOA: number; revenueEUR: number; orders: number }[];
  visitorAnalytics: {
    summary: {
      visitors: number;
      pageViews: number;
      productViews: number;
      productVisitors: number;
      favoriteVisitors: number;
      cartVisitors: number;
      checkoutVisitors: number;
      favoritesAdded: number;
      favoritesRemoved: number;
      cartAdds: number;
      checkoutStarts: number;
    };
    daily: {
      day: string;
      visitors: number;
      pageViews: number;
      productViews: number;
      productVisitors: number;
      favoriteVisitors: number;
      cartVisitors: number;
      checkoutVisitors: number;
      favoritesAdded: number;
      cartAdds: number;
      checkoutStarts: number;
    }[];
    popularProducts: { productId: number; name: string; imageUrl?: string | null; views: number; favorites: number }[];
  };
};

type MenuItem = { label: string; href: string; Icon: typeof Box };
const menuItems: MenuItem[] = [
  { label: "Visão geral", href: "/admin", Icon: LayoutDashboard },
  { label: "Vendas", href: "/admin/orders", Icon: ShoppingBag },
  { label: "Produtos", href: "/admin/products", Icon: Package },
  { label: "Gestão de stock", href: "/admin/stock", Icon: Box },
  { label: "Clientes", href: "/admin/clients", Icon: Users },
  { label: "Fornecedores", href: "/admin/suppliers", Icon: Truck },
  { label: "Financeiro", href: "/admin/finance", Icon: Wallet },
  { label: "Marketing", href: "/admin/marketing", Icon: BarChart3 },
  { label: "Logs do sistema", href: "/admin/logs", Icon: ClipboardList },
  { label: "Utilizadores", href: "/admin/users", Icon: Users },
  { label: "Configurações", href: "/admin/settings", Icon: Settings },
];
const statusLabels: Record<string, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  PROCESSING: "Em processamento",
  PAYMENT_CONFIRMED: "Paga",
  SHIPPED: "Enviada",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelada",
  PAYMENT_REVIEW_REQUIRED: "Revisão de pagamento",
  PAYMENT_REVIEW_IN_PROGRESS: "Revisão em curso",
};
const statusStyles: Record<string, string> = {
  AWAITING_PAYMENT: "bg-amber-50 text-amber-800",
  PROCESSING: "bg-blue-50 text-blue-800",
  PAYMENT_CONFIRMED: "bg-emerald-50 text-emerald-800",
  SHIPPED: "bg-violet-50 text-violet-800",
  DELIVERED: "bg-green-50 text-green-800",
  CANCELLED: "bg-red-50 text-red-700",
  PAYMENT_REVIEW_REQUIRED: "bg-orange-50 text-orange-800",
  PAYMENT_REVIEW_IN_PROGRESS: "bg-orange-50 text-orange-800",
};

function formatMoney(value: number | string, currency: Currency) {
  const amount = Number(value || 0);
  return currency === "EUR"
    ? `€ ${amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
    : `Kz ${amount.toLocaleString("pt-AO", { minimumFractionDigits: 2 })}`;
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[9px] text-gray-400">Sem comparação</span>;
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${positive ? "text-emerald-700" : "text-red-700"}`}><Icon size={12} />{Math.abs(value).toFixed(1)}% vs. período anterior</span>;
}

function Metric({ label, value, icon: Icon, tone, change }: { label: string; value: string; icon: typeof Box; tone: string; change?: number | null }) {
  return <article className="border border-gray-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase text-gray-500">{label}</p><p className="mt-2 truncate text-xl font-black text-gray-950">{value}</p></div><span className={`flex h-9 w-9 shrink-0 items-center justify-center ${tone}`}><Icon size={18} /></span></div><div className="mt-2">{change === undefined ? <span className="text-[9px] text-gray-500">Dados atuais da loja</span> : <Change value={change} />}</div></article>;
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<Period>("MONTH");
  const [currency, setCurrency] = useState<Currency>("AOA");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchWithAuth(`/api/admin/dashboard?period=${period}`)
      .then((response) => { if (active) setDashboard(response.data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o resumo da loja."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  const chart = dashboard?.trend || [];
  const maxRevenue = Math.max(1, ...chart.map((month) => currency === "AOA" ? month.revenueAOA : month.revenueEUR));
  const metrics = dashboard?.metrics;

  return <AdminShell><div className="mx-auto max-w-[1440px]">
    <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Visão geral da operação</p><h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950">Resumo da loja</h1><p className="mt-1 text-xs text-gray-500">Indicadores reais de vendas liquidadas, encomendas, clientes e stock · {dashboard?.period || "a carregar período"}</p></div><select value={period} onChange={(event) => { setLoading(true); setError(""); setPeriod(event.target.value as Period); }} aria-label="Período do resumo" className="border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700"><option value="7D">Últimos 7 dias</option><option value="MONTH">Este mês</option><option value="LAST_MONTH">Mês passado</option></select></div>
    {error && <div role="alert" className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    {loading && !dashboard ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin" />A carregar indicadores...</div> : metrics && <>
      <div className="mb-5 flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase text-gray-500">Moeda das vendas:</span>{(["AOA", "EUR"] as const).map((market) => <button key={market} type="button" onClick={() => setCurrency(market)} aria-pressed={currency === market} className={`border px-3 py-1.5 text-[10px] font-bold ${currency === market ? "border-blue-700 bg-blue-700 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>{market === "AOA" ? "Angola · AOA" : "Portugal · EUR"}</button>)}</div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={`Vendas pagas · ${currency}`} value={formatMoney(currency === "AOA" ? metrics.revenueAOA : metrics.revenueEUR, currency)} icon={ShoppingBag} tone="bg-blue-50 text-blue-700" change={currency === "AOA" ? metrics.revenueChangeAOA : metrics.revenueChangeEUR} /><Metric label="Encomendas no período" value={metrics.orders.toLocaleString("pt-PT")} icon={Package} tone="bg-emerald-50 text-emerald-700" change={metrics.ordersChange} /><Metric label="Novos clientes" value={metrics.newCustomers.toLocaleString("pt-PT")} icon={Users} tone="bg-violet-50 text-violet-700" change={metrics.customersChange} /><Metric label={`Saldo operacional · ${currency}`} value={formatMoney(currency === "AOA" ? metrics.balanceAOA : metrics.balanceEUR, currency)} icon={Wallet} tone="bg-amber-50 text-amber-700" /> </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Clientes ativos" value={`${metrics.activeCustomers.toLocaleString("pt-PT")} / ${metrics.totalCustomers.toLocaleString("pt-PT")}`} icon={UserRound} tone="bg-cyan-50 text-cyan-700" /><Metric label="Stock baixo" value={metrics.lowStock.toLocaleString("pt-PT")} icon={AlertTriangle} tone="bg-amber-50 text-amber-700" /><Metric label="Sem stock" value={metrics.outOfStock.toLocaleString("pt-PT")} icon={Box} tone="bg-red-50 text-red-700" /></div>
      <section className="mb-5 border border-gray-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black">Visitantes e intenção de compra</h2>
            <p className="mt-1 text-[10px] text-gray-500">Dados agregados do período · só são recolhidos com consentimento de análise</p>
          </div>
          <span className="text-[10px] text-gray-500">Os visitantes são anónimos; não há nomes nem emails nesta análise.</span>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Visitantes únicos", value: dashboard.visitorAnalytics.summary.visitors, Icon: Users, tone: "bg-blue-50 text-blue-700" },
            { label: "Páginas vistas", value: dashboard.visitorAnalytics.summary.pageViews, Icon: Eye, tone: "bg-cyan-50 text-cyan-700" },
            { label: "Produtos vistos", value: dashboard.visitorAnalytics.summary.productViews, Icon: Package, tone: "bg-violet-50 text-violet-700" },
            { label: "Gostos adicionados", value: dashboard.visitorAnalytics.summary.favoritesAdded, Icon: Heart, tone: "bg-rose-50 text-rose-700" },
            { label: "Adições ao carrinho", value: dashboard.visitorAnalytics.summary.cartAdds, Icon: ShoppingCart, tone: "bg-emerald-50 text-emerald-700" },
          ].map(({ label, value, Icon, tone }) => (
            <article key={label} className="flex items-center justify-between gap-3 border border-gray-100 p-3">
              <div><p className="text-[9px] font-bold uppercase text-gray-500">{label}</p><p className="mt-1 text-lg font-black text-gray-950">{value.toLocaleString("pt-PT")}</p></div>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${tone}`}><Icon size={16} /></span>
            </article>
          ))}
        </div>
        <div className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Consultaram produtos", count: dashboard.visitorAnalytics.summary.productVisitors },
            { label: "Adicionaram favoritos", count: dashboard.visitorAnalytics.summary.favoriteVisitors },
            { label: "Adicionaram ao carrinho", count: dashboard.visitorAnalytics.summary.cartVisitors },
            { label: "Iniciaram checkout", count: dashboard.visitorAnalytics.summary.checkoutVisitors },
          ].map(({ label, count }) => {
            const visitors = dashboard.visitorAnalytics.summary.visitors;
            const rate = visitors > 0 ? `${((count / visitors) * 100).toFixed(1)}%` : "—";
            return <div key={label} className="border border-gray-100 px-3 py-2">
              <p className="text-[9px] font-bold uppercase text-gray-500">{label}</p>
              <p className="mt-1 text-sm font-black text-gray-950">{count.toLocaleString("pt-PT")} <span className="text-[10px] font-semibold text-blue-700">· {rate} dos visitantes</span></p>
            </div>;
          })}
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <div className="overflow-x-auto">
            <h3 className="mb-2 text-xs font-black">Atividade por dia</h3>
            <table className="w-full min-w-[680px] border-collapse text-left text-[10px]">
              <thead><tr className="border-y border-gray-100 bg-gray-50 text-[9px] uppercase text-gray-500"><th className="px-2 py-2">Dia (UTC)</th><th className="px-2 py-2">Visitantes</th><th className="px-2 py-2">Páginas</th><th className="px-2 py-2">Produtos</th><th className="px-2 py-2">Gostos</th><th className="px-2 py-2">Carrinho</th><th className="px-2 py-2">Checkout</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{dashboard.visitorAnalytics.daily.map((day) => (
                <tr key={day.day}><td className="px-2 py-2 font-semibold text-gray-700">{new Date(`${day.day}T00:00:00.000Z`).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", timeZone: "UTC" })}</td><td className="px-2 py-2 font-bold">{day.visitors}</td><td className="px-2 py-2">{day.pageViews}</td><td className="px-2 py-2">{day.productViews}</td><td className="px-2 py-2">{day.favoritesAdded}</td><td className="px-2 py-2">{day.cartAdds}</td><td className="px-2 py-2">{day.checkoutStarts}</td></tr>
              ))}</tbody>
            </table>
            {dashboard.visitorAnalytics.summary.visitors === 0 && <p className="mt-3 text-[10px] text-gray-500">Ainda sem dados consentidos neste período. A análise começa a contar após a migração e a aceitação de cookies de análise.</p>}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-black">Produtos que despertam interesse</h3>
            {dashboard.visitorAnalytics.popularProducts.length === 0 ? <p className="border border-gray-100 p-4 text-center text-[10px] text-gray-500">Ainda sem produtos vistos ou adicionados aos favoritos.</p> : <div className="divide-y divide-gray-100 border-y border-gray-100">
              {dashboard.visitorAnalytics.popularProducts.map((product) => (
                <div key={product.productId} className="flex items-center gap-3 py-2">
                  <Image src={product.imageUrl || "/file.svg"} alt="" width={36} height={36} unoptimized={Boolean(product.imageUrl && /^https?:\/\//i.test(product.imageUrl))} className="h-9 w-9 border border-gray-100 object-contain" />
                  <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{product.name}</p><p className="mt-0.5 text-[9px] text-gray-500">{product.views} consultas · {product.favorites} gostos</p></div>
                  <Heart size={13} className="shrink-0 text-rose-500" />
                </div>
              ))}
            </div>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="border border-gray-100 p-2"><p className="text-[9px] text-gray-500">Gostos removidos</p><p className="mt-1 text-sm font-black">{dashboard.visitorAnalytics.summary.favoritesRemoved}</p></div>
              <div className="border border-gray-100 p-2"><p className="text-[9px] text-gray-500">Checkouts iniciados</p><p className="mt-1 inline-flex items-center gap-1 text-sm font-black"><CreditCard size={13} />{dashboard.visitorAnalytics.summary.checkoutStarts}</p></div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[9px] leading-4 text-gray-500"><MousePointerClick size={12} className="shrink-0" />Produtos vistos → favoritos → carrinho → checkout ajudam a perceber a intenção de compra.</p>
          </div>
        </div>
      </section>
      {(metrics.pendingPayments > 0 || metrics.paymentReview > 0 || metrics.lowStock > 0 || metrics.outOfStock > 0) && <section className="mb-5 border border-amber-200 bg-amber-50/70 p-4"><div className="mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-800" /><h2 className="text-xs font-black text-amber-950">Ações que precisam de atenção</h2></div><div className="flex flex-wrap gap-2">{metrics.pendingPayments > 0 && <Link href="/admin/finance/payments" className="border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-900">{metrics.pendingPayments} pagamento(s) pendente(s)</Link>}{metrics.paymentReview > 0 && <Link href="/admin/finance/review" className="border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-900">{metrics.paymentReview} pagamento(s) em revisão</Link>}{metrics.lowStock > 0 && <Link href="/admin/stock" className="border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-900">{metrics.lowStock} produto(s) com stock baixo</Link>}{metrics.outOfStock > 0 && <Link href="/admin/stock" className="border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-900">{metrics.outOfStock} produto(s) sem stock</Link>}</div></section>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]"><section className="border border-gray-200 bg-white p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-black">Vendas liquidadas</h2><p className="mt-1 text-[10px] text-gray-500">Últimos 12 meses completos · {currency}</p></div><div className="flex gap-3 text-[9px] font-semibold text-gray-600"><span><i className="mr-1 inline-block h-2 w-2 bg-blue-600" />Vendas pagas</span><span><i className="mr-1 inline-block h-2 w-2 bg-gray-300" />Encomendas</span></div></div><div role="img" aria-label={`Vendas mensais liquidadas em ${currency} nos últimos 12 meses`} className="overflow-x-auto"><div className="flex h-48 min-w-[660px] items-end gap-2 border-b border-l border-gray-200 px-3 pb-5 pt-3">{chart.map((month) => { const revenue = currency === "AOA" ? month.revenueAOA : month.revenueEUR; const revenueHeight = revenue > 0 ? Math.max(3, revenue / maxRevenue * 100) : 0; const orderHeight = metrics.orders > 0 ? Math.max(3, month.orders / Math.max(1, ...chart.map((item) => item.orders)) * 100) : 0; return <div key={month.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"><div className="flex h-[calc(100%-16px)] w-full items-end justify-center gap-0.5"><span title={`${month.label}: ${formatMoney(revenue, currency)}`} className="w-3 rounded-t bg-blue-600" style={{ height: `${revenueHeight}%` }} /><span title={`${month.label}: ${month.orders} encomendas`} className="w-2 rounded-t bg-gray-300" style={{ height: `${orderHeight}%` }} /></div><span className="mt-1 whitespace-nowrap text-[8px] text-gray-500">{month.label}</span></div>; })}</div></div><div className="mt-3 flex flex-wrap gap-4 text-[10px] text-gray-500"><span>{metrics.products.toLocaleString("pt-PT")} produtos no catálogo</span><span>{metrics.stockUnits.toLocaleString("pt-PT")} unidades em stock</span><span>Despesas no período: {formatMoney(currency === "AOA" ? metrics.expensesAOA : metrics.expensesEUR, currency)}</span></div></section>
      <section className="border border-gray-200 bg-white"><div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div><h2 className="text-sm font-black">Mais vendidos</h2><p className="mt-1 text-[10px] text-gray-500">Unidades em encomendas não canceladas</p></div><Link href="/admin/products" className="text-[10px] font-bold text-blue-700">Produtos <ArrowUpRight size={12} className="inline" /></Link></div><div className="divide-y divide-gray-100">{dashboard.bestSellers.length === 0 ? <p className="p-6 text-center text-xs text-gray-500">Ainda sem vendas suficientes.</p> : dashboard.bestSellers.map((product, index) => <div key={product.productId} className="flex items-center gap-3 px-4 py-3"><span className="w-4 text-[10px] font-black text-gray-400">{index + 1}</span><Image src={product.imageUrl || "/file.svg"} alt="" width={40} height={40} unoptimized={Boolean(product.imageUrl && /^https?:\/\//i.test(product.imageUrl))} className="h-10 w-10 border border-gray-100 bg-white object-contain" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-gray-800">{product.name}</p><p className="text-[10px] text-gray-500">{product.units} unidades vendidas</p></div></div>)}</div></section></div>
      <section className="mt-5 border border-gray-200 bg-white"><div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div><h2 className="text-sm font-black">Encomendas recentes</h2><p className="mt-1 text-[10px] text-gray-500">Atividade mais recente registada no sistema</p></div><Link href="/admin/orders" className="text-[10px] font-bold text-blue-700">Ver vendas <ArrowUpRight size={12} className="inline" /></Link></div><div className="hidden grid-cols-[1.2fr_1.4fr_1fr_0.9fr_1fr] gap-3 bg-gray-50 px-4 py-2 text-[9px] font-black uppercase text-gray-500 md:grid"><span>Encomenda</span><span>Cliente</span><span>Data</span><span>Estado</span><span className="text-right">Total</span></div><div className="divide-y divide-gray-100">{dashboard.recentOrders.length === 0 ? <p className="p-8 text-center text-xs text-gray-500">Ainda não existem encomendas.</p> : dashboard.recentOrders.map((order) => <Link key={order.id} href="/admin/orders" className="grid gap-2 px-4 py-3 hover:bg-gray-50 md:grid-cols-[1.2fr_1.4fr_1fr_0.9fr_1fr] md:items-center"><strong className="text-xs text-gray-900">{order.orderNumber}</strong><span className="truncate text-xs text-gray-700">{order.user.accountName || order.user.name || "Cliente"}</span><span className="text-[10px] text-gray-500">{new Date(order.createdAt).toLocaleDateString("pt-PT")}</span><span className={`w-fit px-2 py-1 text-[9px] font-bold ${statusStyles[order.status] || "bg-gray-100 text-gray-700"}`}>{statusLabels[order.status] || order.status}</span><strong className="text-right text-xs text-gray-900">{formatMoney(order.currency === "EUR" ? order.totalEUR : order.totalKZ, order.currency === "EUR" ? "EUR" : "AOA")}</strong></Link>)}</div></section>
    </>}</div></AdminShell>;
}
