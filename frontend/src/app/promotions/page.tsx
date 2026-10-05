"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, Clock3, Headphones, Heart, LoaderCircle, Package, RefreshCw, Search, ShieldCheck, ShoppingCart, SlidersHorizontal, Truck, Zap } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";
import { fetchWithAuth } from "@/lib/api";
import { getPromotionalUnitPrice, type PublicPromotion } from "@/lib/promotions/pricing";

type Product = {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
  stock: number;
  basePrice: string | number;
  category: { id: number; name: string; slug: string };
  brand: { id: number };
  prices: { market: "AO" | "PT"; amount: string | number }[];
};

type Category = { name: string; slug: string };
type Sort = "relevance" | "price-low" | "price-high" | "name";

function priceFor(product: Product, market: "AO" | "PT") {
  return Number(product.prices.find((price) => price.market === market)?.amount ?? product.basePrice);
}

function promotionalPriceFor(product: Product, targetMarket: "AO" | "PT", promotions: PublicPromotion[]) {
  const regularPrice = priceFor(product, targetMarket);
  return getPromotionalUnitPrice({
    id: product.id,
    categoryId: product.category.id,
    brandId: product.brand.id,
  }, targetMarket, regularPrice, promotions)?.promotionalPrice ?? regularPrice;
}

export default function PromotionsPage() {
  const { addToCart } = useCart();
  const { market, eurToKz } = useMarket();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<PublicPromotion[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("relevance");
  const [stockOnly, setStockOnly] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  async function refreshCatalog(initial = false) {
    if (initial) setLoading(true); else setRefreshing(true);
    try {
      const [productResponse, categoryResponse] = await Promise.all([
        fetchWithAuth("/api/products?page=1&pageSize=100"),
        fetchWithAuth("/api/categories"),
      ]);
      setProducts(productResponse.data as Product[]);
      setCategories(categoryResponse.data as Category[]);
      setLastUpdated(new Date());
      setMessage("");
      try {
        const promotionResponse = await fetchWithAuth("/api/promotions/active");
        setPromotions(promotionResponse.data as PublicPromotion[]);
      } catch {
        setPromotions([]);
        setMessage("Não foi possível carregar as ofertas ativas.");
      }
    } catch { setMessage("Não foi possível sincronizar o catálogo. Tente novamente."); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void refreshCatalog(true); }, 0);
    const interval = window.setInterval(() => { void refreshCatalog(); }, 60_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = filter === "ALL" || product.category.slug === filter;
    const matchesSearch = `${product.name} ${product.category.name}`.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch && (!stockOnly || product.stock > 0);
  }).sort((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name, "pt");
    if (sort === "price-low") return promotionalPriceFor(left, market, promotions) - promotionalPriceFor(right, market, promotions);
    if (sort === "price-high") return promotionalPriceFor(right, market, promotions) - promotionalPriceFor(left, market, promotions);
    return 0;
  }), [filter, market, products, promotions, search, sort, stockOnly]);
  const filters = [{ name: "Todas as promoções", slug: "ALL" }, ...categories];

  function formatPromotionAction(action: PublicPromotion["actions"][number]) {
    if (action.type === "FREE_SHIPPING") return "Portes grátis";
    if (action.type === "PERCENTAGE") return `${Number(action.value)}% de desconto`;
    if (action.type === "FIXED") return `${formatMarketAmount(Number(action.value), market)} de desconto`;
    if (action.type === "FIXED_PRICE") return `Preço especial`;
    return "Oferta especial";
  }

  function formatMarketAmount(amount: number, targetMarket: "AO" | "PT") {
    if (targetMarket === "AO") return `Kz ${amount.toLocaleString("pt-AO", { maximumFractionDigits: 2 })}`;
    return `€ ${amount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatPromotionEndAt(endAt: string | null) {
    if (!endAt) return "Sem data de término definida";
    const date = new Date(endAt);
    const formattedDate = date.toLocaleDateString("pt-AO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Africa/Luanda",
    });
    const formattedTime = date.toLocaleTimeString("pt-AO", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Luanda",
    });
    return `Termina em ${formattedDate} às ${formattedTime} (hora de Angola)`;
  }

  function formatPromotionCountdown(endAt: string | null) {
    if (!endAt) return null;
    const remainingSeconds = Math.max(0, Math.floor((new Date(endAt).getTime() - currentTime) / 1_000));
    if (remainingSeconds === 0) return "Promoção encerrada";
    const days = Math.floor(remainingSeconds / 86_400);
    const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
    const minutes = Math.floor((remainingSeconds % 3_600) / 60);
    const seconds = remainingSeconds % 60;
    const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
    return days > 0 ? `Faltam ${days}d ${time}` : `Faltam ${time}`;
  }

  function promotionConditions(promotion: PublicPromotion) {
    const conditions: string[] = [];
    const minimum = market === "AO" ? promotion.minOrderAOA : promotion.minOrderEUR;
    if (minimum !== null) conditions.push(`Compra mínima: ${formatMarketAmount(Number(minimum), market)}`);
    if (promotion.products.length || promotion.categories.length || promotion.brands.length) conditions.push("Aplicável a produtos selecionados");
    for (const rule of promotion.rules) {
      if (rule.kind === "FIRST_ORDER" && rule.value === "true") conditions.push("Apenas na primeira compra");
      else if (rule.kind === "CUSTOMER_TIER") conditions.push("Válida para clientes elegíveis");
      else if (rule.kind === "MARKET" && rule.value !== market) conditions.push("Não disponível neste mercado");
      else if (rule.kind === "CHANNEL" && rule.value !== "ONLINE") conditions.push("Válida noutro canal de venda");
      else if (rule.kind !== "MIN_ORDER" && rule.kind !== "FIRST_ORDER" && rule.kind !== "CUSTOMER_TIER" && rule.kind !== "MARKET" && rule.kind !== "CHANNEL") conditions.push("Consulte as condições no checkout");
    }
    return conditions;
  }

  function addProduct(product: Product) {
    const priceEUR = priceFor(product, "PT");
    const priceKZ = priceFor(product, "AO") || eurToKz(priceEUR);
    addToCart({ id: `promotion-${product.id}`, productId: product.id, name: product.name, slug: product.slug, priceEUR, priceKZ, quantity: 1, imageUrl: product.imageUrl || undefined });
    setMessage(`${product.name} foi adicionado ao carrinho.`);
  }

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewsletterLoading(true);
    setMessage("");
    try {
      await fetchWithAuth("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setEmail("");
      setMessage("Subscrição realizada com sucesso.");
    } catch { setMessage("Não foi possível concluir a subscrição. Tente novamente."); }
    finally { setNewsletterLoading(false); }
  }

  return <div className="container mx-auto px-4 py-8">
    <nav className="mb-6 flex items-center gap-1 text-xs text-gray-400"><Link href="/" className="hover:text-[#1d6ac4]">Início</Link><span>›</span><span className="font-medium text-gray-700">Ofertas</span></nav>
    <div className={`mb-6 grid min-w-0 items-stretch gap-5 ${promotions.length ? "lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]" : ""}`}>
    <section aria-labelledby="offers-heading" className="relative min-w-0 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-5 shadow-sm sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="relative flex h-full min-w-0 flex-col">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1d6ac4] text-xs font-black tracking-tight text-white shadow-sm">RD</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">RUBRICA DILIGENTE (SU), LDA</p>
              <p className="mt-0.5 text-[10px] font-medium text-gray-500">Tecnologia sem fronteiras</p>
            </div>
          </div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Campanhas e oportunidades</p>
          <h1 id="offers-heading" className="max-w-2xl text-4xl font-black leading-[1.02] tracking-tight text-gray-950 sm:text-5xl xl:whitespace-nowrap xl:text-[3.25rem]">Ofertas <span className="text-[#1d6ac4]">em vigor.</span></h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-gray-600 sm:text-base">Descubra as campanhas ativas e encontre a tecnologia certa ao melhor preço.</p>
        </div>
        <div className="mt-6 flex w-fit max-w-full items-center justify-between gap-4 rounded-xl border border-blue-100 bg-white/90 px-4 py-3 text-xs text-slate-700 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-50" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1d6ac4]" /></span>
            <span className="min-w-0"><strong className="block font-black text-slate-800">Catálogo sincronizado</strong><small className="text-[10px] text-slate-500">{lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}` : "A sincronizar..."}</small></span>
          </div>
          <button type="button" onClick={() => void refreshCatalog()} disabled={refreshing} aria-label="Atualizar catálogo" title="Atualizar catálogo" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-[#1d6ac4] transition hover:bg-blue-50 disabled:opacity-50"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /></button>
        </div>
      </div>
    </section>
    {promotions.length > 0 && <section aria-label="Promoções ativas" className="min-w-0 space-y-3">
      <div className="grid min-w-0 gap-3">
        {promotions.map((promotion) => {
          const conditions = promotionConditions(promotion);
          const ended = promotion.endAt !== null && new Date(promotion.endAt).getTime() <= currentTime;
          return <article key={promotion.id} className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-blue-50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-blue-100 pb-3">
                <h2 className="text-sm font-black tracking-tight text-slate-950">Promoções ativas</h2>
                <span className="shrink-0 rounded-full border border-blue-100 bg-white px-2.5 py-1 text-[10px] font-bold text-blue-700">{promotions.length} {promotions.length === 1 ? "oferta" : "ofertas"}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Oferta especial</p>
                  <h3 className="break-words text-lg font-black leading-tight text-gray-950">{promotion.name}</h3>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#1d6ac4]"><Zap size={19} /></span>
              </div>
              {promotion.description && <p className="mt-3 text-sm leading-5 text-gray-600">{promotion.description}</p>}
              <ul className="mt-4 space-y-2">
                {promotion.actions.map((action, index) => <li key={`${promotion.id}-${index}`} className="inline-flex max-w-full items-center rounded-lg bg-[#1d6ac4] px-3 py-2 text-sm font-black text-white shadow-sm">
                  {formatPromotionAction(action)}{action.maxDiscount !== null && action.type === "PERCENTAGE" ? ` (máx. ${formatMarketAmount(Number(action.maxDiscount), market)})` : ""}
                </li>)}
              </ul>
              {promotion.code && <p className="mt-3 inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-800">Código: {promotion.code}</p>}
            </div>
            <div className="space-y-4 p-5">
              {conditions.length > 0 && <div className="rounded-lg bg-blue-50/70 px-3 py-2.5 text-xs leading-5 text-slate-600">{conditions.join(" · ")}</div>}
              <div className={`rounded-xl p-4 ${ended ? "bg-slate-100 text-slate-700" : "bg-[#07111f] text-white"}`}>
                <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${ended ? "text-slate-500" : "text-slate-300"}`}><CalendarDays size={14} />{promotion.endAt ? formatPromotionEndAt(promotion.endAt) : "Sem data de término definida"}</div>
                {promotion.endAt && <div className={`mt-2 flex items-center gap-2 font-black tabular-nums ${ended ? "text-slate-600" : "text-blue-300"}`}>
                  <Clock3 size={17} className="shrink-0" />
                  <span aria-live="off" className="text-lg leading-tight">{formatPromotionCountdown(promotion.endAt)}</span>
                </div>}
              </div>
              <p className="flex items-start gap-2 text-[11px] leading-4 text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#1d6ac4]" />Desconto confirmado no checkout conforme elegibilidade.</p>
            </div>
          </article>;
        })}
      </div>
    </section>}
    </div>
    <section className="relative mb-5 overflow-hidden rounded-xl bg-[#07111f] p-6 text-white sm:p-8"><Image src="/banner_principal2.png" alt="Seleção de tecnologia" fill sizes="(max-width: 768px) 100vw, 70vw" className="object-cover opacity-60" /><div className="relative max-w-md"><p className="text-2xl font-black leading-none sm:text-3xl">SELEÇÃO RUBRICA</p><p className="mt-1 text-xl font-black text-[#facc15]">PREÇOS ATUAIS</p><p className="mt-2 text-xs text-gray-200">Produtos originais, stock real e compra segura em Angola e Portugal.</p><Link href="#offers" className="mt-5 inline-flex rounded-lg bg-[#1d6ac4] px-4 py-2 text-xs font-bold text-white hover:bg-[#1555d8]">Explorar catálogo</Link></div><div className="absolute right-8 top-1/2 hidden -translate-y-1/2 rounded-full bg-cyan-300 px-5 py-4 text-center font-black text-[#07111f] sm:block"><span className="block text-3xl">AO</span><span className="text-[10px]">E PT</span></div></section>
    {message && <div role="status" className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_230px]">
      <main id="offers" className="min-w-0">
        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
          <label className="relative block min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Pesquisar produtos" placeholder="Pesquisar produtos..." className="w-full border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#1d6ac4]" />
          </label>
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Ordenar produtos" className="border border-gray-200 bg-white px-3 py-2.5 text-xs">
            <option value="relevance">Relevância</option><option value="price-low">Menor preço</option><option value="price-high">Maior preço</option><option value="name">Nome A-Z</option>
          </select>
          <label className="flex items-center justify-center gap-2 border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600">
            <input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} />Disponíveis
          </label>
        </div>
        <div className="mb-5 flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2">
          <SlidersHorizontal size={15} className="shrink-0 text-gray-400" />
          {filters.map((category) => <button type="button" key={category.slug} onClick={() => setFilter(category.slug)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${filter === category.slug ? "bg-[#1d6ac4] text-white" : "text-gray-600 hover:bg-gray-100"}`}>{category.name}</button>)}
        </div>
        {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin" />A carregar catálogo...</div>
          : visibleProducts.length === 0 ? <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500"><p className="font-semibold text-gray-700">Nenhum produto encontrado</p><button type="button" onClick={() => { setSearch(""); setFilter("ALL"); setStockOnly(false); }} className="mt-3 text-xs font-bold text-[#1d6ac4]">Limpar filtros</button></div>
            : <>
              <p className="mb-3 text-xs text-gray-500">{visibleProducts.length} produto(s) no catálogo</p>
              <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                {visibleProducts.map((product) => {
                  const priceEUR = priceFor(product, "PT");
                  const priceKZ = priceFor(product, "AO");
                  const promotionProduct = { id: product.id, categoryId: product.category.id, brandId: product.brand.id };
                  const euroOffer = getPromotionalUnitPrice(promotionProduct, "PT", priceEUR, promotions);
                  const kwanzaOffer = getPromotionalUnitPrice(promotionProduct, "AO", priceKZ, promotions);
                  const activeOffer = market === "AO" ? kwanzaOffer : euroOffer;
                  const regularPrice = market === "AO" ? priceKZ : priceEUR;
                  const favorite = isFavorite(product.id);
                  return <article key={product.id} className="card card-hover relative flex min-w-0 flex-col p-3">
                    <span className={`absolute left-3 top-3 z-10 px-2 py-1 text-[10px] font-black text-white ${activeOffer ? "bg-red-600" : "bg-[#1d6ac4]"}`}>{activeOffer ? "PROMOÇÃO" : "CATÁLOGO"}</span>
                    <button type="button" onClick={() => toggleFavorite({ id: product.id, name: product.name, slug: product.slug, category: product.category.name, specs: product.category.name, priceEUR, imageUrl: product.imageUrl || undefined })} className={`absolute right-3 top-3 z-10 ${favorite ? "text-red-500" : "text-gray-400 hover:text-red-500"}`} aria-label={`${favorite ? "Remover" : "Adicionar"} ${product.name} dos favoritos`}><Heart size={16} fill={favorite ? "currentColor" : "none"} /></button>
                    <Link href={`/products/${product.slug}`} className="flex h-32 min-w-0 items-center justify-center bg-gray-50"><Image src={product.imageUrl || "/file.svg"} alt={product.name} width={180} height={140} unoptimized={Boolean(product.imageUrl && /^https?:\/\//i.test(product.imageUrl))} className="h-full w-full object-contain" /></Link>
                    <h2 className="mt-3 line-clamp-2 text-xs font-bold text-gray-900">{product.name}</h2>
                    <p className="mt-1 line-clamp-1 text-[10px] text-gray-500">{product.category.name}</p>
                    <div className="mt-auto pt-3">
                      {activeOffer ? <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
                        <del className="text-xs text-gray-500">{formatMarketAmount(regularPrice, market)}</del>
                        <p className="text-base font-black text-red-700">{formatMarketAmount(activeOffer.promotionalPrice, market)}</p>
                      </div> : <p className="text-base font-black text-gray-900">{formatMarketAmount(regularPrice, market)}</p>}
                      {activeOffer && <p className="mb-1 text-[10px] font-semibold text-red-700">{activeOffer.promotion.name} · preço promocional</p>}
                      <p className={`mb-2 text-[10px] font-semibold ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}>{product.stock > 0 ? `● ${product.stock} em stock` : "● Indisponível"}</p>
                      <button type="button" disabled={product.stock === 0} onClick={() => addProduct(product)} className="flex w-full items-center justify-center gap-2 bg-[#1d6ac4] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#1555d8] disabled:cursor-not-allowed disabled:bg-gray-300"><ShoppingCart size={14} />Adicionar</button>
                    </div>
                  </article>;
                })}
              </div>
            </>}
      </main>
      <aside className="space-y-4"><div className="card space-y-4 p-5"><Benefit icon={Truck} title="Entrega rápida" text="Em Luanda e nas principais províncias." /><Benefit icon={ShieldCheck} title="Pagamentos seguros" text="Multicaixa, MB WAY, cartão e transferência." /><Benefit icon={Package} title="Produtos originais" text="Garantia oficial das melhores marcas." /><Benefit icon={Headphones} title="Apoio especializado" text="Estamos aqui para o ajudar." /></div><section className="relative isolate overflow-hidden rounded-2xl bg-[#172554] p-5 text-white shadow-sm"><div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border-[18px] border-cyan-300/20" /><div className="relative"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200"><Zap size={13} fill="currentColor" />Seleção em destaque</span><span className="rounded-full border border-cyan-200/30 px-2 py-1 text-[9px] font-bold text-cyan-100">AO · PT</span></div><h2 className="mt-6 max-w-[12rem] text-2xl font-black leading-[1.05]">Tecnologia para o seu próximo passo.</h2><p className="mt-3 max-w-[15rem] text-xs leading-5 text-blue-100">Produtos atuais, stock confirmado e preços sincronizados com o catálogo.</p><Link href="#offers" className="mt-5 inline-flex items-center gap-2 bg-white px-4 py-2.5 text-xs font-black text-[#172554] transition hover:bg-cyan-100">Explorar seleção <span aria-hidden="true">→</span></Link><div className="mt-5 flex items-center gap-2 border-t border-white/15 pt-3 text-[10px] text-blue-100"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />Catálogo atualizado em tempo real</div></div></section><form onSubmit={subscribe} className="card p-5"><Bell size={20} className="text-[#1d6ac4]" /><h2 className="mt-2 font-bold text-gray-900">Receba novidades</h2><p className="mt-1 text-xs text-gray-500">Seja o primeiro a conhecer novos produtos e campanhas.</p><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="O seu email" className="settings-input mt-4" /><button type="submit" disabled={newsletterLoading} className="btn-primary mt-3 flex w-full items-center justify-center gap-2 disabled:opacity-50">{newsletterLoading && <LoaderCircle size={14} className="animate-spin" />}Subscrever</button></form></aside>
    </div>
  </div>;
}

function Benefit({ icon: Icon, title, text }: { icon: typeof Truck; title: string; text: string }) { return <div className="flex gap-3"><Icon className="shrink-0 text-[#1d6ac4]" size={22} /><div><p className="text-xs font-bold text-gray-900">{title}</p><p className="text-[10px] leading-4 text-gray-500">{text}</p></div></div>; }
