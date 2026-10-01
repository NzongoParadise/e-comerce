"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, Bell, Building2, Check, CreditCard, FileText, Heart, MapPin, Package, Pencil, Phone, Plus, ShoppingCart, TrendingUp, UserRound } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";
import { Metric, DataRow, ChevronRightIcon, HeadsetIcon } from "@/components/features/account/AccountDashboardWidgets";

type Profile = { name?: string; email?: string; accountName?: string; accountType?: string };
type AccountOrder = { id: number; number: string; date: string; products: string[]; total: string; status: string; detail: string; images: string[] };
type AccountRecommendation = { id: number; name: string; price: string; kz: string; image: string; slug: string };
type AccountQuote = { id: number; quoteNumber: string; status: string; createdAt: string; companyName: string; total?: string | number };

const translateStatus = (status?: string) => {
  const normalized = String(status || "").toUpperCase();
  const map: Record<string, string> = {
    DELIVERED: "Entregue",
    SHIPPED: "Em trânsito",
    IN_TRANSIT: "Em trânsito",
    CANCELLED: "Cancelada",
    SUBMITTED: "Em análise",
    APPROVED: "Proposta enviada",
    PENDING: "Aguardando",
    COMPLETED: "Entregue",
  };
  return map[normalized] || normalized || "Em processamento";
};

export default function AccountOverviewPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [recommendations, setRecommendations] = useState<AccountRecommendation[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [addressCount, setAddressCount] = useState(0);
  const [paymentMethodCount, setPaymentMethodCount] = useState(0);
  const [quotes, setQuotes] = useState<AccountQuote[]>([]);
  const { favorites } = useFavorites();
  const { addToCart } = useCart();
  const { eurToKz } = useMarket();

  useEffect(() => {
    fetchWithAuth("/api/auth/me")
      .then((response) => setProfile(response.data))
      .catch(() => setProfile(null));

    fetchWithAuth("/api/orders")
      .then((response) => {
        const data = response.data ?? [];
        const mapped = data.slice(0, 3).map((order: {
          id: number;
          orderNumber: string;
          createdAt: string;
          status: string;
          totalKZ: string | number;
          items: { name: string; imageUrl?: string }[];
        }) => ({
          id: order.id,
          number: order.orderNumber,
          date: new Date(order.createdAt).toLocaleDateString("pt-PT"),
          products: order.items.map((item) => item.name),
          total: `Kz ${Number(order.totalKZ ?? 0).toLocaleString("pt-AO", { minimumFractionDigits: 2 })}`,
          status: translateStatus(order.status),
          detail: "Consultar detalhes da encomenda",
          images: order.items.slice(0, 3).map((item) => item.imageUrl || "/file.svg"),
        }));
        setOrderCount(data.length);
        setOrders(mapped);
      })
      .catch(() => {
        setOrders([]);
        setOrderCount(0);
      });

    fetchWithAuth("/api/recommendations?limit=4")
      .then((response) => {
        const items = response.data ?? [];
        setRecommendations(
          items.map((item: {
            id: number;
            name: string;
            slug: string;
            basePrice: string | number;
            imageUrl?: string;
            prices?: { market: string; amount: string | number }[];
          }) => {
            const euro = Number(item.prices?.find((price) => price.market === "PT")?.amount ?? item.basePrice ?? 0);
            const kwanza = Number(item.prices?.find((price) => price.market === "AO")?.amount ?? eurToKz(euro));
            return {
              id: item.id,
              name: item.name,
              slug: item.slug,
              price: `€ ${euro.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`,
              kz: `Kz ${kwanza.toLocaleString("pt-AO", { minimumFractionDigits: 2 })}`,
              image: item.imageUrl || "/file.svg",
            };
          }),
        );
      })
      .catch(() => setRecommendations([]));

    fetchWithAuth("/api/account/addresses")
      .then((response) => setAddressCount(response.data?.length ?? 0))
      .catch(() => setAddressCount(0));

    fetchWithAuth("/api/account/payment-methods")
      .then((response) => setPaymentMethodCount(response.data?.length ?? 0))
      .catch(() => setPaymentMethodCount(0));

    fetchWithAuth("/api/quotes")
      .then((response) => {
        const data = response.data ?? [];
        setQuotes(
          data.map((quote: any) => ({
            id: quote.id,
            quoteNumber: quote.quoteNumber || `CT-${quote.id}`,
            status: translateStatus(quote.status),
            createdAt: quote.createdAt,
            companyName: quote.companyName || "Empresa",
            total: quote.total ?? quote.items?.reduce((sum: number, item: any) => sum + Number(item.subtotal ?? item.unitPrice ?? 0) * Number(item.quantity ?? 1), 0) ?? 0,
          })),
        );
      })
      .catch(() => setQuotes([]));
  }, [eurToKz]);

  const customerName = profile?.name || "João da Silva";
  const initials = customerName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  function addRecommendation(item: AccountRecommendation) {
    const priceEUR = Number(item.price.replace("€", "").replace(".", "").replace(",", "."));
    addToCart({ id: `account-${item.id}`, productId: item.id, name: item.name, slug: item.slug, priceEUR, priceKZ: eurToKz(priceEUR), quantity: 1, imageUrl: item.image });
  }

  return profile?.accountType === "B2B" ? <CorporateDashboard profile={profile} orders={orders} quotes={quotes} /> : <div className="account-shell animate-fade-in-up space-y-5 pb-8"><div className="group rounded-[28px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_38%,#f8fafc_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,23,42,0.08)] sm:p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1d6ac4] text-sm font-black text-white shadow-lg shadow-[#1d6ac4]/20 transition-transform duration-300 group-hover:scale-105">{initials}</div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1d6ac4]">Minha conta</p><h1 className="mt-1 text-2xl font-black text-gray-900">Olá, {customerName}! <span aria-hidden="true">👋</span></h1></div></div><Link href="/account/profile" className="btn-secondary px-3 py-2 text-[10px] transition-transform duration-200 hover:-translate-y-0.5"><Pencil size={13} /> Editar perfil</Link></div><p className="mt-4 max-w-2xl text-sm text-gray-600">Bem-vindo à sua conta RUBRICA DILIGENTE (SU), LDA. Aqui pode gerir as suas encomendas, dados e preferências.</p></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric icon={Package} value={String(orderCount)} label="Encomendas" href="/account/orders" /><Metric icon={Heart} value={String(favorites.length)} label="Produtos favoritos" href="/favorites" tone="pink" /><Metric icon={MapPin} value={String(addressCount)} label="Endereços" href="/account/addresses" /><Metric icon={CreditCard} value={String(paymentMethodCount)} label="Métodos de pagamento" href="/account/payment" /></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_230px]"><main className="min-w-0 space-y-5"><section className="animate-fade-in-up"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black text-gray-900">As minhas encomendas</h2><Link href="/account/orders" className="text-[10px] font-bold text-[#1555d8]">Ver todas <ArrowRight size={11} className="inline" /></Link></div><div className="card divide-y divide-gray-100">{orders.map((order) => <div key={order.number} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="text-[10px] font-black text-gray-900">{order.number}</p><p className="text-[9px] text-gray-500">{order.date}</p></div><div className="hidden items-center gap-1 sm:flex">{order.images.map((image) => <img key={image} src={image} alt="" className="h-8 w-8 rounded bg-gray-50 object-contain" />)}</div><div className="hidden text-[9px] text-gray-500 md:block">{order.products.join(" | ")}</div><div className="text-right"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${order.status === "Entregue" ? "bg-emerald-50 text-emerald-700" : order.status === "Cancelada" ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-700"}`}>{order.status}</span><p className="mt-1 text-[10px] font-black text-gray-900">{order.total}</p><p className="text-[9px] text-gray-500">{order.detail}</p></div><Link href="/account/orders" aria-label={`Ver ${order.number}`} className="text-[#1555d8]"><ChevronRightIcon /></Link></div>)}</div></section><section><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black text-gray-900">Produtos que talvez goste</h2><Link href="/products" className="text-[10px] font-bold text-[#1555d8]">Ver mais <ArrowRight size={11} className="inline" /></Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{recommendations.map((item) => <article key={item.name} className="card relative p-3"><Heart size={13} className="absolute right-2 top-2 text-gray-400" /><div className="flex h-24 items-center justify-center rounded bg-gray-50"><img src={item.image} alt={item.name} className="h-full w-full object-contain" /></div><p className="mt-2 line-clamp-1 text-[10px] font-bold text-gray-900">{item.name}</p><p className="mt-1 text-[10px] text-amber-500">★★★★★</p><p className="text-xs font-black text-gray-900">{item.price}</p><p className="text-[9px] text-gray-500">{item.kz}</p><button type="button" onClick={() => addRecommendation(item)} className="mt-2 flex w-full items-center justify-center gap-1 rounded bg-[#1555d8] px-2 py-2 text-[9px] font-bold text-white"><ShoppingCart size={12} /> Adicionar</button></article>)}</div></section></main><aside className="space-y-4"><section className="card p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-black text-gray-900">Os meus dados</h2><Link href="/account/profile" className="text-[9px] font-bold text-[#1555d8]">Editar</Link></div><div className="mt-4 space-y-3 text-[10px] text-gray-700"><DataRow icon={UserRound} label="Nome" value={customerName} /><DataRow icon={Bell} label="E-mail" value={profile?.email || "joao.silva@email.com"} /><DataRow icon={Phone} label="Telefone" value="+244 923 000 000" /><DataRow icon={MapPin} label="País" value="Angola (Kz)" /></div></section><section className="card p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-black text-gray-900">Métodos de pagamento</h2><Link href="/account/settings" className="text-[9px] font-bold text-[#1555d8]">Gerir</Link></div><div className="mt-3 space-y-3"><p className="flex items-center justify-between text-[10px] font-semibold"><span>▣ &nbsp; •••• •••• 0045</span><span className="text-xs text-orange-500">●●</span></p><p className="flex items-center justify-between text-[10px] font-semibold"><span>▣ &nbsp; •••• •••• 1234</span><b className="text-blue-600">VISA</b></p><Link href="/account/settings" className="mt-2 block rounded bg-blue-50 py-2 text-center text-[10px] font-bold text-[#1555d8]">＋ Adicionar método de pagamento</Link></div></section><section className="card bg-blue-50 p-4"><HeadsetIcon /><h2 className="mt-2 text-sm font-black text-gray-900">Precisa de ajuda?</h2><p className="mt-1 text-[10px] text-gray-600">A nossa equipa está sempre disponível para si.</p><div className="mt-3 grid grid-cols-2 gap-2"><Link href="/account/support" className="btn-primary px-2 py-2 text-[9px]"><Phone size={12} /> Ligar agora</Link><Link href="/account/support" className="btn-secondary px-2 py-2 text-[9px]">Centro de ajuda</Link></div></section><section className="card p-4"><div className="flex items-center gap-2"><Bell size={15} className="text-[#1555d8]" /><h2 className="text-xs font-black text-gray-900">Receba as nossas novidades</h2></div><p className="mt-1 text-[10px] text-gray-500">Promoções, lançamentos e ofertas exclusivas.</p><div className="mt-3 flex"><input placeholder="O seu e-mail" className="min-w-0 flex-1 rounded-l border border-gray-200 px-2 py-2 text-[9px]" /><button type="button" className="rounded-r bg-[#1555d8] px-2 text-[9px] font-bold text-white">Subscrever</button></div></section></aside></div></div>;
}

function CorporateDashboard({ profile, orders, quotes }: { profile: Profile; orders: AccountOrder[]; quotes: AccountQuote[] }) {
  const companyName = profile.accountName || profile.name || "RUBRICA DILIGENTE (SU), LDA";
  const businessOrders = orders.slice(0, 5).map((order) => [order.number, order.date, order.status, order.total]);
  const businessQuotes = quotes.slice(0, 3).map((quote) => [quote.quoteNumber, quote.createdAt ? new Date(quote.createdAt).toLocaleDateString("pt-PT") : "Sem data", quote.status, quote.total ? String(quote.total) : "Kz 0,00"]);
  const bars = [42, 54, 48, 70, 80, 88];
  const totalPurchase = orders.reduce((sum, order) => {
    const numeric = Number(String(order.total).replace(/[^\d,.-]/g, "").replace(".", "").replace(",", "."));
    return sum + (Number.isFinite(numeric) ? numeric : 0);
  }, 0);
  const quoteTotal = quotes.reduce((sum, quote) => {
    const numeric = Number(String(quote.total ?? 0).replace(/[^\d,.-]/g, "").replace(".", "").replace(",", "."));
    return sum + (Number.isFinite(numeric) ? numeric : 0);
  }, 0);

  return <div className="account-shell animate-fade-in-up space-y-5 pb-8"><div className="group flex flex-col justify-between gap-3 rounded-[28px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_40%,#f8fafc_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_25px_60px_rgba(15,23,42,0.08)] sm:flex-row sm:items-end sm:p-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1d6ac4]">Conta empresarial (B2B)</p><h1 className="mt-2 text-2xl font-black text-gray-900">Olá, {companyName}! <span aria-hidden="true">👋</span></h1><p className="mt-1 text-sm text-gray-600">Aqui tem um resumo da sua atividade, encomendas, cotações e oportunidades exclusivas para empresas.</p></div><div className="flex gap-2"><button className="btn-secondary px-3 py-2 text-[10px] transition-transform duration-200 hover:-translate-y-0.5"><span>01 Set 2026 - 30 Set 2026</span></button><button className="btn-primary px-3 py-2 text-[10px] transition-transform duration-200 hover:-translate-y-0.5"><FileText size={13} /> Exportar relatório</button></div></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><BusinessMetric icon={BarChart3} title="Total de compras" value={`Kz ${totalPurchase.toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} growth="32%" tone="blue" /><BusinessMetric icon={ShoppingCart} title="Encomendas" value={String(orders.length)} growth="60%" tone="green" /><BusinessMetric icon={FileText} title="Cotações solicitadas" value={String(quotes.length)} growth="50%" tone="violet" /><BusinessMetric icon={Heart} title="A poupar" value={`Kz ${quoteTotal.toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} growth="18%" tone="amber" /></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]"><section className="card p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black text-gray-900">Evolução de compras</h2><select className="rounded border border-gray-200 px-2 py-1 text-[9px] font-semibold"><option>Últimos 6 meses</option></select></div><div className="flex h-36 items-end gap-3 border-b border-l border-gray-200 px-4 pb-5 pt-3">{bars.map((height, index) => <div key={index} className="flex flex-1 items-end justify-center gap-1"><i style={{ height: `${height}%` }} className="w-3 rounded-t bg-[#0d2f70]" /><i style={{ height: `${height * 0.65}%` }} className="w-3 rounded-t bg-[#2878ec]" /></div>)}</div><div className="mt-2 flex justify-around text-[9px] text-gray-500">{["Abr", "Mai", "Jun", "Jul", "Ago", "Set"].map((month) => <span key={month}>{month}</span>)}</div><div className="mt-3 flex justify-center gap-4 text-[9px] font-semibold text-gray-500"><span><i className="mr-1 inline-block h-2 w-2 rounded bg-[#0d2f70]" />Compras (Kz)</span><span><i className="mr-1 inline-block h-2 w-2 rounded bg-[#2878ec]" />Encomendas</span></div></section><section className="relative overflow-hidden rounded-lg bg-[#06233d] p-5 text-white"><img src="/ChatGPT Image 23 de set. de 2026, 10_10_30.png" alt="Soluções empresariais" className="absolute inset-0 h-full w-full object-cover opacity-35" /><div className="relative"><h2 className="text-lg font-black leading-tight">Soluções empresariais<br />para o seu crescimento</h2><p className="mt-3 max-w-[190px] text-[10px] text-blue-100">Equipamento, implementação e suporte dedicado para o seu negócio.</p><Link href="/account/quotes" className="mt-5 inline-flex items-center gap-2 rounded bg-white px-3 py-2 text-[10px] font-bold text-[#06233d]">Solicitar cotação <ArrowRight size={12} /></Link></div></section></div><div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]"><BusinessTable title="Últimas encomendas" action="Ver todas" rows={businessOrders} order /><BusinessTable title="Cotações em aberto" action="Ver todas" rows={businessQuotes} /></div><section className="card p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-gray-900">Categorias mais adquiridas</h2><Link href="/products" className="text-[10px] font-bold text-[#1555d8]">Ver produtos <ArrowRight size={11} className="inline" /></Link></div><div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{[["Computadores", "35%", "▰"], ["Smartphones", "25%", "▯"], ["Acessórios", "18%", "◉"], ["Componentes", "12%", "▦"], ["Impressão", "8%", "▤"], ["Redes", "2%", "⌁"]].map(([label, percent, icon]) => <Link href="/products" key={label} className="text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg text-[#06233d]">{icon}</span><p className="mt-2 text-[9px] font-bold text-gray-700">{label}</p><p className="text-[9px] text-gray-500">{percent}</p></Link>)}</div></section><section className="flex items-center justify-between rounded-lg bg-blue-50 p-4"><div><h2 className="text-sm font-black text-gray-900">Precisa de algo específico?</h2><p className="text-[10px] text-gray-600">A nossa equipa comercial está pronta para ajudar com soluções personalizadas.</p></div><Link href="/account/support" className="btn-primary px-4 py-2 text-[10px]">Falar com vendas <ArrowRight size={12} /></Link></section></div>;
}

function BusinessMetric({ icon: Icon, title, value, growth, tone }: { icon: typeof Package; title: string; value: string; growth: string; tone: "blue" | "green" | "violet" | "amber" }) {
  const tones = { blue: "bg-blue-50 text-blue-600", green: "bg-emerald-50 text-emerald-600", violet: "bg-violet-50 text-violet-600", amber: "bg-amber-50 text-amber-600" };
  return <div className="animate-fade-in-up rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(15,23,42,0.08)]" style={{ animationDelay: "120ms" }}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={17} /></span><p className="mt-3 text-[10px] font-semibold text-gray-500">{title}</p><strong className="mt-1 block text-lg font-black text-gray-900">{value}</strong><p className="mt-1 text-[9px] font-bold text-emerald-600">↑ {growth} <span className="font-normal text-gray-400">vs. mês anterior</span></p></div>;
}
function BusinessTable({ title, action, rows, order = false }: { title: string; action: string; rows: string[][]; order?: boolean }) { return <section className="card animate-fade-in-up overflow-hidden" style={{ animationDelay: "180ms" }}><div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><h2 className="text-sm font-black text-gray-900">{title}</h2><Link href={order ? "/account/orders" : "/account/quotes"} className="text-[10px] font-bold text-[#1555d8]">{action} <ArrowRight size={11} className="inline" /></Link></div><div className="divide-y divide-gray-100">{rows.map((row) => <div key={row[0]} className="grid grid-cols-[1.4fr_0.8fr_1fr_1.1fr_20px] items-center gap-2 px-4 py-2.5 text-[9px]"><strong className="text-gray-800">{row[0]}</strong><span className="text-gray-500">{row[1]}</span><span className={`w-fit rounded-full px-2 py-1 font-bold ${row[2] === "Entregue" ? "bg-emerald-50 text-emerald-700" : row[2] === "Cancelada" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"}`}>{row[2]}</span><strong className="text-right text-gray-800">{row[3]}</strong><ArrowRight size={12} className="text-[#1555d8]" /></div>)}</div></section>; }
