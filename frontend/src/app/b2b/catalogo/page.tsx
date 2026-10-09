"use client";

import Link from "next/link";
import { FileText, Search, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { B2BProductCard, type B2BProductCardProduct } from "@/components/features/catalog/B2BProductCard";

type B2BProduct = B2BProductCardProduct;
type CompanyMarket = "AO" | "PT";

function priceForCompany(product: B2BProduct, market: CompanyMarket) {
  const currency = market === "PT" ? "EUR" : "AOA";
  const rules = (product.b2bPriceRules || []).filter((rule) => rule.currency === currency).sort((a, b) => a.unitPrice - b.unitPrice);
  if (rules.length) return rules[0].unitPrice;
  const price = product.prices?.find((entry) => entry.market === market && entry.currency === currency)?.amount;
  if (price !== undefined) return Number(price);
  return market === "PT" ? Number(product.basePrice) : Number.POSITIVE_INFINITY;
}

export default function B2BCatalogPage() {
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [companyMarket, setCompanyMarket] = useState<CompanyMarket>("AO");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState<"RELEVANCE" | "PRICE_ASC" | "PRICE_DESC">("RELEVANCE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithAuth("/api/b2b/catalog")
      .then((result) => {
        setProducts(result.data ?? []);
        if (result.companyMarket === "PT" || result.companyMarket === "AO") setCompanyMarket(result.companyMarket);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o catálogo empresarial."))
      .finally(() => setLoading(false));
  }, []);

  const categories = Array.from(new Map(products.map((product) => [product.category.slug, product.category.name])).entries());
  const visible = products
    .filter((product) => {
      const normalizedQuery = query.trim().toLowerCase();
      const haystack = (product.name + " " + product.brand.name + " " + product.category.name).toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesCategory = category === "ALL" || product.category.slug === category;
      return matchesQuery && matchesCategory;
    })
    .sort((a, b) => {
      if (sort === "PRICE_ASC") return priceForCompany(a, companyMarket) - priceForCompany(b, companyMarket);
      if (sort === "PRICE_DESC") return priceForCompany(b, companyMarket) - priceForCompany(a, companyMarket);
      return 0;
    });

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">B2B · Compras</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Catálogo empresarial</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Encontre produtos, compare condições por volume e adicione artigos à sua compra empresarial.</p><span className="mt-2 inline-flex w-fit rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black text-slate-600">Mercado da empresa: {companyMarket === "PT" ? "Portugal · EUR" : "Angola · AOA"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/b2b/cotacoes" className="btn-secondary"><FileText size={14} /> Pedir cotação</Link>
          <Link href="/b2b/encomendas" className="btn-primary"><ShoppingBag size={14} /> Ver encomendas</Link>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div>}

      <section className="card overflow-hidden p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por produto..." className="settings-input pl-9" />
          </label>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="settings-input">
            <option value="RELEVANCE">Mais relevantes</option>
            <option value="PRICE_ASC">Menor preço</option>
            <option value="PRICE_DESC">Maior preço</option>
          </select>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setCategory("ALL")} className={category === "ALL" ? "rounded-full bg-[#132238] px-3.5 py-2 text-[10px] font-black text-white" : "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-bold text-slate-600 hover:border-blue-200 hover:text-blue-700"}>Todos <span className="ml-1 text-slate-300">{products.length}</span></button>
          {categories.map(([slug, name]) => <button key={slug} type="button" onClick={() => setCategory(slug)} className={category === slug ? "rounded-full bg-[#132238] px-3.5 py-2 text-[10px] font-black text-white" : "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-bold text-slate-600 hover:border-blue-200 hover:text-blue-700"}>{name}</button>)}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-black text-slate-950">Produtos disponíveis</p><p className="text-[10px] text-slate-500">{visible.length} resultado(s) no catálogo empresarial</p></div>
        <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-black text-emerald-700 sm:inline-flex">Preços por volume</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <div key={i} className="card h-[360px] animate-pulse bg-slate-50" />)}</div>
      ) : visible.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {visible.map((product) => <B2BProductCard key={product.id} product={product} marketOverride={companyMarket} />)}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Search size={30} className="mx-auto text-slate-300" />
          <h2 className="mt-3 text-sm font-black text-slate-800">Nenhum produto encontrado</h2>
          <p className="mt-1 text-xs text-slate-500">Tente outro termo ou selecione outra categoria.</p>
        </div>
      )}
    </div>
  );
}
