"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Search, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { B2BProductCard, type B2BProductCardProduct } from "@/components/features/catalog/B2BProductCard";

type B2BProduct = B2BProductCardProduct;
type CompanyMarket = "AO" | "PT";
type FacetOption = { id: number; name: string; slug: string };
type CatalogResponse = {
  data: B2BProduct[];
  companyMarket?: CompanyMarket | null;
  meta?: { total: number; page: number; pageSize: number; pageCount: number };
  facets?: { categories?: FacetOption[] };
  message?: string;
};

export default function B2BCatalogPage() {
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [companyMarket, setCompanyMarket] = useState<CompanyMarket>("AO");
  const [categories, setCategories] = useState<FacetOption[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState<"RELEVANCE" | "PRICE_ASC" | "PRICE_DESC">("RELEVANCE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "24",
        sort,
      });
      if (query.trim()) params.set("search", query.trim());
      if (category !== "ALL") params.set("category", category);

      try {
        const result = await fetchWithAuth("/api/b2b/catalog?" + params.toString(), { cache: "no-store" }) as CatalogResponse;
        if (!active) return;
        setProducts(Array.isArray(result.data) ? result.data : []);
        setTotal(result.meta?.total || 0);
        setPageCount(result.meta?.pageCount || 0);
        setCategories(result.facets?.categories || []);
        if (result.companyMarket === "PT" || result.companyMarket === "AO") setCompanyMarket(result.companyMarket);
        setNotice(result.message || "");
      } catch (loadError) {
        if (!active) return;
        setProducts([]);
        setTotal(0);
        setPageCount(0);
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o catálogo empresarial.");
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, category, sort, page]);

  function setPageAndScroll(next: number) {
    setPage(Math.max(1, Math.min(pageCount, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">B2B · Compras</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Catálogo empresarial</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Encontre produtos, compare condições por volume e prepare a compra empresarial. A pesquisa e a paginação são aplicadas no servidor.</p>
          <span className="mt-2 inline-flex w-fit rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black text-slate-600">Mercado da empresa: {companyMarket === "PT" ? "Portugal · EUR" : "Angola · AOA"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/b2b/cotacoes" className="btn-secondary"><FileText size={14}/> Pedir cotação</Link>
          <Link href="/b2b/carrinho" className="btn-secondary"><ShoppingBag size={14}/> Carrinho empresarial</Link>
          <Link href="/b2b/encomendas" className="btn-primary"><ShoppingBag size={14}/> Ver encomendas</Link>
        </div>
      </header>

      {notice && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">{notice}</div>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div>}

      <section className="card overflow-hidden p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Pesquisar produto, marca ou categoria..." aria-label="Pesquisar catálogo empresarial" className="settings-input pl-9"/>
          </label>
          <select value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }} aria-label="Ordenar catálogo" className="settings-input">
            <option value="RELEVANCE">Mais relevantes</option>
            <option value="PRICE_ASC">Menor preço empresarial</option>
            <option value="PRICE_DESC">Maior preço empresarial</option>
          </select>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => { setCategory("ALL"); setPage(1); }} className={category === "ALL" ? "rounded-full bg-[#132238] px-3.5 py-2 text-[10px] font-black text-white" : "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-bold text-slate-600 hover:border-blue-200 hover:text-blue-700"}>Todas as categorias</button>
          {categories.map((item) => (
            <button key={item.id} type="button" onClick={() => { setCategory(item.slug); setPage(1); }} className={category === item.slug ? "rounded-full bg-[#132238] px-3.5 py-2 text-[10px] font-black text-white" : "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-bold text-slate-600 hover:border-blue-200 hover:text-blue-700"}>{item.name}</button>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">Produtos empresariais</p>
          <p className="text-[10px] text-slate-500">{loading ? "A atualizar resultados..." : total + " produto(s) encontrado(s)"}</p>
        </div>
        <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-black text-emerald-700 sm:inline-flex">Preços por volume</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <div key={i} className="card h-[360px] animate-pulse bg-slate-50"/>)}</div>
      ) : products.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {products.map((product) => <B2BProductCard key={product.id} product={product} marketOverride={companyMarket}/>)}
          </div>
          {pageCount > 1 && (
            <nav aria-label="Paginação do catálogo empresarial" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">Página <strong className="text-slate-900">{page}</strong> de <strong className="text-slate-900">{pageCount}</strong> · {total} produto(s)</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPageAndScroll(page - 1)} disabled={page <= 1 || loading} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14}/> Anterior</button>
                <button type="button" onClick={() => setPageAndScroll(page + 1)} disabled={page >= pageCount || loading} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Seguinte <ChevronRight size={14}/></button>
              </div>
            </nav>
          )}
        </>
      ) : (
        <div className="card p-12 text-center">
          <Search size={30} className="mx-auto text-slate-300"/>
          <h2 className="mt-3 text-sm font-black text-slate-800">Nenhum produto encontrado</h2>
          <p className="mt-1 text-xs text-slate-500">Altere a pesquisa ou selecione outra categoria.</p>
          <button type="button" onClick={() => { setQuery(""); setCategory("ALL"); setSort("RELEVANCE"); setPage(1); }} className="btn-secondary mt-4">Limpar filtros</button>
        </div>
      )}
    </div>
  );
}
