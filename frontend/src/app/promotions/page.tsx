"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bell, Headphones, Heart, LoaderCircle, Package, RefreshCw, Search, ShieldCheck, ShoppingCart, SlidersHorizontal, Truck, Zap } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";
import { fetchWithAuth } from "@/lib/api";

type Product = {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
  stock: number;
  basePrice: string | number;
  category: { name: string; slug: string };
  prices: { market: "AO" | "PT"; amount: string | number }[];
};

type Category = { name: string; slug: string };
type Sort = "relevance" | "price-low" | "price-high" | "name";

function priceFor(product: Product, market: "AO" | "PT") {
  return Number(product.prices.find((price) => price.market === market)?.amount ?? product.basePrice);
}

export default function PromotionsPage() {
  const { addToCart } = useCart();
  const { market, formatPrice, eurToKz } = useMarket();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
    } catch { setMessage("Não foi possível sincronizar o catálogo. Tente novamente."); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void refreshCatalog(true); }, 0);
    const interval = window.setInterval(() => { void refreshCatalog(); }, 60_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); };
  }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = filter === "ALL" || product.category.slug === filter;
    const matchesSearch = `${product.name} ${product.category.name}`.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch && (!stockOnly || product.stock > 0);
  }).sort((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name, "pt");
    if (sort === "price-low") return priceFor(left, market) - priceFor(right, market);
    if (sort === "price-high") return priceFor(right, market) - priceFor(left, market);
    return 0;
  }), [filter, market, products, search, sort, stockOnly]);
  const filters = [{ name: "Todas as promoções", slug: "ALL" }, ...categories];

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
    <nav className="mb-6 flex items-center gap-1 text-xs text-gray-400"><Link href="/" className="hover:text-[#1d6ac4]">Início</Link><span>›</span><span className="font-medium text-gray-700">Catálogo em destaque</span></nav>
    <div className="mb-6 grid gap-5 border-b border-gray-200 pb-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><div><div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center bg-[#1d6ac4] text-sm font-black text-white">•</span><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1d6ac4]">Seleção RUBRICA DILIGENTE (SU), LDA</p></div><h1 className="max-w-xl text-3xl font-black leading-[1.05] tracking-tight text-gray-950 sm:text-5xl">Catálogo em<br className="hidden sm:block" /> destaque.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">Explore produtos disponíveis, preços atuais e stock real do catálogo.</p></div><div className="flex items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 md:min-w-64"><div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /><span><strong className="block font-black">Catálogo sincronizado</strong><small className="text-[10px] text-emerald-700">{lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}` : "A sincronizar..."}</small></span></div><button type="button" onClick={() => void refreshCatalog()} disabled={refreshing} aria-label="Atualizar catálogo" title="Atualizar catálogo" className="flex h-8 w-8 items-center justify-center border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /></button></div></div>
    <section className="relative mb-5 overflow-hidden rounded-xl bg-[#07111f] p-6 text-white sm:p-8"><Image src="/banner_principal2.png" alt="Seleção de tecnologia" fill sizes="(max-width: 768px) 100vw, 70vw" className="object-cover opacity-60" /><div className="relative max-w-md"><p className="text-2xl font-black leading-none sm:text-3xl">SELEÇÃO RUBRICA</p><p className="mt-1 text-xl font-black text-[#facc15]">PREÇOS ATUAIS</p><p className="mt-2 text-xs text-gray-200">Produtos originais, stock real e compra segura em Angola e Portugal.</p><Link href="#offers" className="mt-5 inline-flex rounded-lg bg-[#1d6ac4] px-4 py-2 text-xs font-bold text-white hover:bg-[#1555d8]">Explorar catálogo</Link></div><div className="absolute right-8 top-1/2 hidden -translate-y-1/2 rounded-full bg-cyan-300 px-5 py-4 text-center font-black text-[#07111f] sm:block"><span className="block text-3xl">AO</span><span className="text-[10px]">E PT</span></div></section>
    {message && <div role="status" className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
    <div className="grid gap-8 lg:grid-cols-[1fr_230px]"><main id="offers"><div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]"><label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Pesquisar produtos" placeholder="Pesquisar produtos..." className="w-full border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#1d6ac4]" /></label><select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Ordenar produtos" className="border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="relevance">Relevância</option><option value="price-low">Menor preço</option><option value="price-high">Maior preço</option><option value="name">Nome A-Z</option></select><label className="flex items-center justify-center gap-2 border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600"><input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} />Disponíveis</label></div><div className="mb-5 flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2"><SlidersHorizontal size={15} className="shrink-0 text-gray-400" />{filters.map((category) => <button type="button" key={category.slug} onClick={() => setFilter(category.slug)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${filter === category.slug ? "bg-[#1d6ac4] text-white" : "text-gray-600 hover:bg-gray-100"}`}>{category.name}</button>)}</div>{loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin" />A carregar catálogo...</div> : visibleProducts.length === 0 ? <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500"><p className="font-semibold text-gray-700">Nenhum produto encontrado</p><button type="button" onClick={() => { setSearch(""); setFilter("ALL"); setStockOnly(false); }} className="mt-3 text-xs font-bold text-[#1d6ac4]">Limpar filtros</button></div> : <><p className="mb-3 text-xs text-gray-500">{visibleProducts.length} produto(s) no catálogo</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{visibleProducts.map((product) => { const priceEUR = priceFor(product, "PT"); const priceKZ = priceFor(product, "AO"); const favorite = isFavorite(product.id); return <article key={product.id} className="card card-hover relative flex flex-col p-3"><span className="absolute left-3 top-3 z-10 bg-[#1d6ac4] px-2 py-1 text-[10px] font-black text-white">CATÁLOGO</span><button type="button" onClick={() => toggleFavorite({ id: product.id, name: product.name, slug: product.slug, category: product.category.name, specs: product.category.name, priceEUR, imageUrl: product.imageUrl || undefined })} className={`absolute right-3 top-3 z-10 ${favorite ? "text-red-500" : "text-gray-400 hover:text-red-500"}`} aria-label={`${favorite ? "Remover" : "Adicionar"} ${product.name} dos favoritos`}><Heart size={16} fill={favorite ? "currentColor" : "none"} /></button><Link href={`/products/${product.slug}`} className="flex h-32 items-center justify-center bg-gray-50"><Image src={product.imageUrl || "/file.svg"} alt={product.name} width={180} height={140} className="h-full w-full object-contain" /></Link><h2 className="mt-3 line-clamp-2 text-xs font-bold text-gray-900">{product.name}</h2><p className="mt-1 line-clamp-1 text-[10px] text-gray-500">{product.category.name}</p><div className="mt-auto pt-3"><p className="text-base font-black text-gray-900">{formatPrice(market === "AO" ? priceKZ : priceEUR)}</p><p className={`mb-2 text-[10px] font-semibold ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}>{product.stock > 0 ? `● ${product.stock} em stock` : "● Indisponível"}</p><button type="button" disabled={product.stock === 0} onClick={() => addProduct(product)} className="flex w-full items-center justify-center gap-2 bg-[#1d6ac4] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#1555d8] disabled:cursor-not-allowed disabled:bg-gray-300"><ShoppingCart size={14} />Adicionar</button></div></article>; })}</div></>}</main>
      <aside className="space-y-4"><div className="card space-y-4 p-5"><Benefit icon={Truck} title="Entrega rápida" text="Em Luanda e nas principais províncias." /><Benefit icon={ShieldCheck} title="Pagamentos seguros" text="Multicaixa, MB WAY, cartão e transferência." /><Benefit icon={Package} title="Produtos originais" text="Garantia oficial das melhores marcas." /><Benefit icon={Headphones} title="Apoio especializado" text="Estamos aqui para o ajudar." /></div><section className="relative isolate overflow-hidden rounded-2xl bg-[#172554] p-5 text-white shadow-sm"><div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border-[18px] border-cyan-300/20" /><div className="relative"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200"><Zap size={13} fill="currentColor" />Seleção em destaque</span><span className="rounded-full border border-cyan-200/30 px-2 py-1 text-[9px] font-bold text-cyan-100">AO · PT</span></div><h2 className="mt-6 max-w-[12rem] text-2xl font-black leading-[1.05]">Tecnologia para o seu próximo passo.</h2><p className="mt-3 max-w-[15rem] text-xs leading-5 text-blue-100">Produtos atuais, stock confirmado e preços sincronizados com o catálogo.</p><Link href="#offers" className="mt-5 inline-flex items-center gap-2 bg-white px-4 py-2.5 text-xs font-black text-[#172554] transition hover:bg-cyan-100">Explorar seleção <span aria-hidden="true">→</span></Link><div className="mt-5 flex items-center gap-2 border-t border-white/15 pt-3 text-[10px] text-blue-100"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />Catálogo atualizado em tempo real</div></div></section><form onSubmit={subscribe} className="card p-5"><Bell size={20} className="text-[#1d6ac4]" /><h2 className="mt-2 font-bold text-gray-900">Receba novidades</h2><p className="mt-1 text-xs text-gray-500">Seja o primeiro a conhecer novos produtos e campanhas.</p><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="O seu email" className="settings-input mt-4" /><button type="submit" disabled={newsletterLoading} className="btn-primary mt-3 flex w-full items-center justify-center gap-2 disabled:opacity-50">{newsletterLoading && <LoaderCircle size={14} className="animate-spin" />}Subscrever</button></form></aside>
    </div>
  </div>;
}

function Benefit({ icon: Icon, title, text }: { icon: typeof Truck; title: string; text: string }) { return <div className="flex gap-3"><Icon className="shrink-0 text-[#1d6ac4]" size={22} /><div><p className="text-xs font-bold text-gray-900">{title}</p><p className="text-[10px] leading-4 text-gray-500">{text}</p></div></div>; }
