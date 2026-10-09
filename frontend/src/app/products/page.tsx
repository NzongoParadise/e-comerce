"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMarket } from "@/context/MarketContext";
import { ProductCard, type CatalogProduct } from "@/components/features/catalog/ProductCard";
import { fetchWithAuth } from "@/lib/api";

type Sort = "relevance" | "price-low" | "price-high" | "name" | "newest";
type PageSearchParams = { [key: string]: string | string[] | undefined };
type FacetOption = { id: number; name: string; slug: string };
type Facets = {
  categories: FacetOption[];
  brands: FacetOption[];
  attributes: Record<string, string[]>;
};
type Product = CatalogProduct & {
  attributes?: { name: string; value: string }[];
  rating?: number;
  reviews?: number;
};
type CatalogResponse = {
  data: Product[];
  meta: { total: number; page: number; pageSize: number; pageCount: number };
  facets: Facets;
};

const emptyFacets: Facets = { categories: [], brands: [], attributes: {} };

export default function ProductsPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const params = use(searchParams);
  const queryParam = typeof params.q === "string" ? params.q : "";
  const categoryParam = typeof params.category === "string" ? params.category : "";
  const brandParam = typeof params.brand === "string" ? params.brand : "";
  const router = useRouter();
  const { market, setMarket } = useMarket();

  const [products, setProducts] = useState<Product[]>([]);
  const [facets, setFacets] = useState<Facets>(emptyFacets);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(queryParam);
  const [category, setCategory] = useState(categoryParam);
  const [brand, setBrand] = useState(brandParam);
  const [stockOnly, setStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<Sort>("relevance");
  const [attributes, setAttributes] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    setSearch(queryParam);
    setCategory(categoryParam);
    setBrand(brandParam);
    setPage(1);
  }, [queryParam, categoryParam, brandParam]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      const query = new URLSearchParams({
        page: String(page),
        pageSize: "24",
        market,
        sort,
      });
      if (search.trim()) query.set("search", search.trim());
      if (category) query.set("category", category);
      if (brand) query.set("brand", brand);
      if (stockOnly) query.set("inStockOnly", "true");
      if (minPrice !== "") query.set("minPrice", minPrice);
      if (maxPrice !== "") query.set("maxPrice", maxPrice);
      for (const [name, values] of Object.entries(attributes)) {
        for (const value of values) query.append("attribute", JSON.stringify([name, value]));
      }

      try {
        const response = await fetchWithAuth("/api/products?" + query.toString(), { cache: "no-store" }) as CatalogResponse;
        if (!active) return;
        setProducts(Array.isArray(response.data) ? response.data : []);
        setTotal(response.meta?.total || 0);
        setPageCount(response.meta?.pageCount || 0);
        setFacets(response.facets || emptyFacets);
      } catch (loadError) {
        if (!active) return;
        setProducts([]);
        setTotal(0);
        setPageCount(0);
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o catálogo.");
      } finally {
        if (active) setLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, category, brand, stockOnly, minPrice, maxPrice, sort, attributes, market, page]);

  const activeFilterCount = useMemo(
    () => (category ? 1 : 0) + (brand ? 1 : 0) + (stockOnly ? 1 : 0) +
      ((minPrice !== "" || maxPrice !== "") ? 1 : 0) +
      Object.values(attributes).reduce((sum, values) => sum + values.length, 0),
    [category, brand, stockOnly, minPrice, maxPrice, attributes],
  );

  function toggleAttribute(name: string, value: string) {
    setAttributes((current) => {
      const values = current[name] || [];
      const nextValues = values.includes(value)
        ? values.filter((entry) => entry !== value)
        : [...values, value];
      const next = { ...current };
      if (nextValues.length) next[name] = nextValues;
      else delete next[name];
      return next;
    });
    setPage(1);
  }

  function clearFilters() {
    setCategory("");
    setBrand("");
    setStockOnly(false);
    setMinPrice("");
    setMaxPrice("");
    setSearch("");
    setAttributes({});
    setSort("relevance");
    setPage(1);
    router.push("/products");
  }

  function changePage(nextPage: number) {
    setPage(Math.max(1, Math.min(pageCount, nextPage)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="storefront-catalog min-h-screen bg-[#f7f8f8] text-gray-900">
      <div className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-3 text-xs text-gray-500">
          <Link href="/" className="hover:text-[#1d6ac4]">Início</Link>
          <span className="mx-2">›</span>
          <span className="font-semibold text-gray-800">Produtos</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-5 sm:py-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="section-kicker">Catálogo RUBRICA DILIGENTE</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              Todos os produtos <span className="text-base font-semibold text-gray-400">{!loading && "(" + total + ")"}</span>
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Pesquise e filtre o catálogo completo. Os resultados, preços e paginação são calculados no servidor para o mercado selecionado.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/compare" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700">
              <ArrowDownUp size={14}/> Comparar
            </Link>
            <select value={sort} onChange={(event) => { setSort(event.target.value as Sort); setPage(1); }} aria-label="Ordenar produtos" className="storefront-select border border-gray-300 bg-white px-3 py-2 text-xs font-semibold">
              <option value="relevance">Relevância</option>
              <option value="price-low">Menor preço</option>
              <option value="price-high">Maior preço</option>
              <option value="name">Nome A–Z</option>
              <option value="newest">Mais recentes</option>
            </select>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="storefront-filter-panel h-fit rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-black">Filtrar por</h2>
              <button type="button" onClick={clearFilters} className="text-[10px] font-bold text-[#1d6ac4] hover:underline">Limpar</button>
            </div>

            <fieldset className="mb-5">
              <legend className="mb-2 text-[10px] font-black uppercase tracking-wide text-gray-500">Mercado e moeda</legend>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs"><input type="radio" name="market" checked={market === "AO"} onChange={() => { setMarket("AO"); setPage(1); }}/> Angola (Kz)</label>
                <label className="flex items-center gap-2 text-xs"><input type="radio" name="market" checked={market === "PT"} onChange={() => { setMarket("PT"); setPage(1); }}/> Portugal (€)</label>
              </div>
            </fieldset>

            <div className="mb-5">
              <label htmlFor="filter-category" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-gray-500">Categoria</label>
              <select id="filter-category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="w-full border border-gray-300 px-2 py-2 text-xs">
                <option value="">Todas</option>
                {facets.categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
              </select>
            </div>

            <div className="mb-5">
              <label htmlFor="filter-brand" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-gray-500">Marca</label>
              <select id="filter-brand" value={brand} onChange={(event) => { setBrand(event.target.value); setPage(1); }} className="w-full border border-gray-300 px-2 py-2 text-xs">
                <option value="">Todas</option>
                {facets.brands.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
              </select>
            </div>

            <div className="mb-5">
              <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide text-gray-500">Preço ({market === "AO" ? "Kz" : "€"})</h3>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); setPage(1); }} placeholder="Mín." aria-label="Preço mínimo" className="min-w-0 border border-gray-300 px-2 py-2 text-xs"/>
                <input type="number" min="0" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); setPage(1); }} placeholder="Máx." aria-label="Preço máximo" className="min-w-0 border border-gray-300 px-2 py-2 text-xs"/>
              </div>
            </div>

            <div className="mb-5">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={stockOnly} onChange={(event) => { setStockOnly(event.target.checked); setPage(1); }}/>
                Apenas produtos em stock
              </label>
            </div>

            {Object.entries(facets.attributes).map(([name, values]) => (
              <fieldset key={name} className="mb-4 border-t border-gray-100 pt-3">
                <legend className="mb-2 text-[10px] font-black uppercase tracking-wide text-gray-500">{name}</legend>
                <div className="space-y-2">
                  {values.map((value) => (
                    <label key={value} className="flex items-center gap-2 text-xs text-gray-700">
                      <input type="checkbox" checked={attributes[name]?.includes(value) || false} onChange={() => toggleAttribute(name, value)}/>
                      <span>{value}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </aside>

          <section className="min-w-0">
            <div className="storefront-toolbar mb-4">
              <div className="relative min-w-0 flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar por produto, marca ou categoria..." className="storefront-search pl-9" aria-label="Pesquisar no catálogo"/>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <SlidersHorizontal size={14}/> Filtros ativos: {activeFilterCount}
              </div>
              <button type="button" onClick={clearFilters} className="border border-gray-300 bg-white px-3 text-xs font-bold text-gray-600 lg:hidden">Limpar</button>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-xl bg-white"/> )}
              </div>
            ) : error ? (
              <div role="alert" className="border border-red-200 bg-white p-8 text-sm text-red-700">{error}</div>
            ) : products.length ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => <ProductCard key={product.id} product={product}/>)}
                </div>

                {pageCount > 1 && (
                  <nav aria-label="Paginação do catálogo" className="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">Página <strong className="text-slate-900">{page}</strong> de <strong className="text-slate-900">{pageCount}</strong> · {total} produto(s)</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => changePage(page - 1)} disabled={page <= 1 || loading} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14}/> Anterior</button>
                      <button type="button" onClick={() => changePage(page + 1)} disabled={page >= pageCount || loading} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Seguinte <ChevronRight size={14}/></button>
                    </div>
                  </nav>
                )}
              </>
            ) : (
              <div className="border border-gray-200 bg-white px-6 py-16 text-center">
                <h2 className="text-lg font-black">Não encontrámos produtos</h2>
                <p className="mt-2 text-sm text-gray-500">Altere os filtros ou limpe a pesquisa para ver mais resultados.</p>
                <button type="button" onClick={clearFilters} className="mt-5 bg-[#f6b73c] px-4 py-2 text-xs font-black">Limpar filtros</button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
