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
  LayoutDashboard,
  LoaderCircle,
  Package,
  Search,
  ShoppingBag,
  Truck,
  UserRound,
  Users,
  Wallet,
  CreditCard,
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
  { label: "Pagamentos Stripe", href: "/admin/payments", Icon: CreditCard },
  { label: "Marketing", href: "/admin/marketing", Icon: BarChart3 },
  { label: "Logs do sistema", href: "/admin/logs", Icon: ClipboardList },
  { label: "Utilizadores", href: "/admin/users", Icon: Users },
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
  return <div className="min-h-screen bg-[#f7f9fc] text-gray-900"><header className="border-b border-gray-200 bg-white"><div className="flex h-16 items-center gap-4 px-4 lg:px-6"><Link href="/admin" className="flex items-center gap-2 lg:w-60"><span className="flex h-9 w-9 items-center justify-center bg-[#1555d8] text-white"><Box size={18} /></span><span className="hidden leading-none sm:block"><strong className="text-base font-black">RUBRICA DILIGENTE (SU), LDA</strong><small className="mt-1 block text-[8px] font-bold uppercase tracking-widest text-[#1555d8]">Painel Administrativo</small></span></Link><div className="relative hidden max-w-xl flex-1 md:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} /><input placeholder="Pesquisar produtos, clientes ou encomendas" className="w-full border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:bg-white" /></div><div className="ml-auto flex items-center gap-2"><Link href="/admin/orders/payment-review" aria-label="Revisão de pagamentos" title="Revisão de pagamentos" className="relative border border-amber-200 p-2 text-amber-800 hover:bg-amber-50"><Bell size={17} /></Link><Link href="/admin/users" aria-label="Utilizadores" className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">TG</Link><span className="hidden text-[10px] leading-tight sm:block"><strong className="block">Administração</strong><small className="text-gray-500">Resumo da loja</small></span><ChevronDown size={14} className="text-gray-500" /></div></div></header><div className="flex"><aside className="hidden min-h-[calc(100vh-64px)] w-60 shrink-0 border-r border-gray-200 bg-[#10233e] text-white lg:block"><div className="border-b border-white/10 px-5 py-5"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center bg-blue-600"><Building2 size={16} /></span><div><strong className="text-sm">RUBRICA DILIGENTE (SU), LDA</strong><span className="block text-[9px] text-blue-200">Painel Administrativo</span></div></div></div><nav aria-label="Navegação administrativa" className="space-y-1 p-3 text-xs font-medium">{menuItems.map(({ label, href, Icon }) => <Link key={href} href={href} aria-current={href === "/admin" ? "page" : undefined} className={`flex items-center gap-3 px-3 py-2.5 ${href === "/admin" ? "bg-blue-600 text-white" : "text-blue-100 hover:bg-white/10"}`}><Icon size={15} />{label}</Link>)}</nav><div className="mx-4 mt-4 border border-white/10 p-3 text-[10px]"><strong className="block text-xs">Operação</strong><Link href="/admin/orders/payment-review" className="mt-2 flex items-center justify-between text-blue-100 hover:text-white">Pagamentos em revisão <ArrowUpRight size={12} /></Link></div></aside><main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main></div></div>;
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
      {(metrics.pendingPayments > 0 || metrics.paymentReview > 0 || metrics.lowStock > 0 || metrics.outOfStock > 0) && <section className="mb-5 border border-amber-200 bg-amber-50/70 p-4"><div className="mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-800" /><h2 className="text-xs font-black text-amber-950">Ações que precisam de atenção</h2></div><div className="flex flex-wrap gap-2">{metrics.pendingPayments > 0 && <Link href="/admin/finance/payments" className="border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-900">{metrics.pendingPayments} pagamento(s) pendente(s)</Link>}{metrics.paymentReview > 0 && <Link href="/admin/finance/review" className="border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-900">{metrics.paymentReview} pagamento(s) em revisão</Link>}{metrics.lowStock > 0 && <Link href="/admin/stock" className="border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-900">{metrics.lowStock} produto(s) com stock baixo</Link>}{metrics.outOfStock > 0 && <Link href="/admin/stock" className="border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-900">{metrics.outOfStock} produto(s) sem stock</Link>}</div></section>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]"><section className="border border-gray-200 bg-white p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-black">Vendas liquidadas</h2><p className="mt-1 text-[10px] text-gray-500">Últimos 12 meses completos · {currency}</p></div><div className="flex gap-3 text-[9px] font-semibold text-gray-600"><span><i className="mr-1 inline-block h-2 w-2 bg-blue-600" />Vendas pagas</span><span><i className="mr-1 inline-block h-2 w-2 bg-gray-300" />Encomendas</span></div></div><div role="img" aria-label={`Vendas mensais liquidadas em ${currency} nos últimos 12 meses`} className="overflow-x-auto"><div className="flex h-48 min-w-[660px] items-end gap-2 border-b border-l border-gray-200 px-3 pb-5 pt-3">{chart.map((month) => { const revenue = currency === "AOA" ? month.revenueAOA : month.revenueEUR; const revenueHeight = revenue > 0 ? Math.max(3, revenue / maxRevenue * 100) : 0; const orderHeight = metrics.orders > 0 ? Math.max(3, month.orders / Math.max(1, ...chart.map((item) => item.orders)) * 100) : 0; return <div key={month.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"><div className="flex h-[calc(100%-16px)] w-full items-end justify-center gap-0.5"><span title={`${month.label}: ${formatMoney(revenue, currency)}`} className="w-3 rounded-t bg-blue-600" style={{ height: `${revenueHeight}%` }} /><span title={`${month.label}: ${month.orders} encomendas`} className="w-2 rounded-t bg-gray-300" style={{ height: `${orderHeight}%` }} /></div><span className="mt-1 whitespace-nowrap text-[8px] text-gray-500">{month.label}</span></div>; })}</div></div><div className="mt-3 flex flex-wrap gap-4 text-[10px] text-gray-500"><span>{metrics.products.toLocaleString("pt-PT")} produtos no catálogo</span><span>{metrics.stockUnits.toLocaleString("pt-PT")} unidades em stock</span><span>Despesas no período: {formatMoney(currency === "AOA" ? metrics.expensesAOA : metrics.expensesEUR, currency)}</span></div></section>
      <section className="border border-gray-200 bg-white"><div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div><h2 className="text-sm font-black">Mais vendidos</h2><p className="mt-1 text-[10px] text-gray-500">Unidades em encomendas não canceladas</p></div><Link href="/admin/products" className="text-[10px] font-bold text-blue-700">Produtos <ArrowUpRight size={12} className="inline" /></Link></div><div className="divide-y divide-gray-100">{dashboard.bestSellers.length === 0 ? <p className="p-6 text-center text-xs text-gray-500">Ainda sem vendas suficientes.</p> : dashboard.bestSellers.map((product, index) => <div key={product.productId} className="flex items-center gap-3 px-4 py-3"><span className="w-4 text-[10px] font-black text-gray-400">{index + 1}</span><Image src={product.imageUrl || "/file.svg"} alt="" width={40} height={40} className="h-10 w-10 border border-gray-100 bg-white object-contain" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-gray-800">{product.name}</p><p className="text-[10px] text-gray-500">{product.units} unidades vendidas</p></div></div>)}</div></section></div>
      <section className="mt-5 border border-gray-200 bg-white"><div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div><h2 className="text-sm font-black">Encomendas recentes</h2><p className="mt-1 text-[10px] text-gray-500">Atividade mais recente registada no sistema</p></div><Link href="/admin/orders" className="text-[10px] font-bold text-blue-700">Ver vendas <ArrowUpRight size={12} className="inline" /></Link></div><div className="hidden grid-cols-[1.2fr_1.4fr_1fr_0.9fr_1fr] gap-3 bg-gray-50 px-4 py-2 text-[9px] font-black uppercase text-gray-500 md:grid"><span>Encomenda</span><span>Cliente</span><span>Data</span><span>Estado</span><span className="text-right">Total</span></div><div className="divide-y divide-gray-100">{dashboard.recentOrders.length === 0 ? <p className="p-8 text-center text-xs text-gray-500">Ainda não existem encomendas.</p> : dashboard.recentOrders.map((order) => <Link key={order.id} href="/admin/orders" className="grid gap-2 px-4 py-3 hover:bg-gray-50 md:grid-cols-[1.2fr_1.4fr_1fr_0.9fr_1fr] md:items-center"><strong className="text-xs text-gray-900">{order.orderNumber}</strong><span className="truncate text-xs text-gray-700">{order.user.accountName || order.user.name || "Cliente"}</span><span className="text-[10px] text-gray-500">{new Date(order.createdAt).toLocaleDateString("pt-PT")}</span><span className={`w-fit px-2 py-1 text-[9px] font-bold ${statusStyles[order.status] || "bg-gray-100 text-gray-700"}`}>{statusLabels[order.status] || order.status}</span><strong className="text-right text-xs text-gray-900">{formatMoney(order.currency === "EUR" ? order.totalEUR : order.totalKZ, order.currency === "EUR" ? "EUR" : "AOA")}</strong></Link>)}</div></section>
    </>}</div></AdminShell>;
}
