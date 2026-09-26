"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { Heart, Search, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMarket } from "@/context/MarketContext";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { fetchWithAuth } from "@/lib/api";

type Product = { id: number; name: string; slug: string; description: string | null; basePrice: string | number; imageUrl: string | null; stock: number; category: { name: string; slug: string }; brand: { name: string; slug: string }; prices?: { market: string; amount: string | number }[]; attributes?: { name: string; value: string }[] };
type Sort = "relevance" | "price-low" | "price-high" | "name";
type PageSearchParams = { [key: string]: string | string[] | undefined };

export default function ProductsPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const params = use(searchParams);
  const queryParam = typeof params.q === "string" ? params.q : "";
  const categoryParam = typeof params.category === "string" ? params.category : "";
  const brandParam = typeof params.brand === "string" ? params.brand : "";
  const router = useRouter();
  const { market, setMarket, formatPrice, eurToKz } = useMarket();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [stockOnly, setStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<Sort>("relevance");
  const [attributes, setAttributes] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(queryParam);
      setCategory(categoryParam);
      setBrand(brandParam);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [queryParam, categoryParam, brandParam]);
  useEffect(() => {
    fetchWithAuth("/api/products?page=1&pageSize=100")
      .then((response) => setProducts(response.data))
      .catch(() => setError("Não foi possível carregar os produtos."))
      .finally(() => setLoading(false));
  }, []);

  const categories = Array.from(new Map(products.map((product) => [product.category.slug, product.category.name])).entries());
  const brands = Array.from(new Map(products.map((product) => [product.brand.slug, product.brand.name])).entries());
  const attributeGroups = Array.from(products.reduce((groups, product) => {
    product.attributes?.forEach((attribute) => { const values = groups.get(attribute.name) || new Set<string>(); values.add(attribute.value); groups.set(attribute.name, values); });
    return groups;
  }, new Map<string, Set<string>>()).entries());
  const visible = useMemo(() => products.filter((product) => {
    const query = `${product.name} ${product.description || ""} ${product.brand.name}`.toLowerCase();
    const price = Number(product.basePrice);
    const matchesAttributes = attributeGroups.every(([name]) => !(attributes[name]?.length) || attributes[name].some((value) => product.attributes?.some((attribute) => attribute.name === name && attribute.value === value)));
    return query.includes(search.toLowerCase()) && (!category || product.category.slug === category) && (!brand || product.brand.slug === brand) && (!stockOnly || product.stock > 0) && (!minPrice || price >= Number(minPrice)) && (!maxPrice || price <= Number(maxPrice)) && matchesAttributes;
  }).sort((a, b) => sort === "price-low" ? Number(a.basePrice) - Number(b.basePrice) : sort === "price-high" ? Number(b.basePrice) - Number(a.basePrice) : sort === "name" ? a.name.localeCompare(b.name, "pt") : 0), [products, search, category, brand, stockOnly, minPrice, maxPrice, attributes, attributeGroups, sort]);

  function addProduct(product: Product) {
    const eur = Number(product.prices?.find((price) => price.market === "PT")?.amount ?? product.basePrice);
    const aoa = Number(product.prices?.find((price) => price.market === "AO")?.amount ?? eurToKz(eur));
    addToCart({ id: `${product.id}-default`, productId: product.id, name: product.name, slug: product.slug, priceEUR: eur, priceKZ: aoa, quantity: 1, imageUrl: product.imageUrl || undefined });
    router.push("/cart");
  }
  function toggleAttribute(name: string, value: string) { setAttributes((current) => { const values = current[name] || []; return { ...current, [name]: values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value] }; }); }
  function clearFilters() { setCategory(""); setBrand(""); setStockOnly(false); setMinPrice(""); setMaxPrice(""); setSearch(""); setAttributes({}); setSort("relevance"); router.push("/products"); }

  return <main className="min-h-screen bg-[#f7f8f8] text-gray-900"><div className="border-b border-gray-200 bg-white"><div className="container mx-auto px-4 py-3 text-xs text-gray-500"><Link href="/" className="hover:text-[#1d6ac4]">Início</Link><span className="mx-2">›</span><span className="font-semibold text-gray-800">Produtos</span></div></div><div className="container mx-auto px-4 py-6"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Catálogo TechGlobal</p><h1 className="mt-1 text-2xl font-black">Todos os produtos <span className="text-base font-semibold text-gray-400">{!loading && `(${visible.length})`}</span></h1></div><div className="flex flex-wrap gap-2"><Link href="/compare" className="border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700">Comparar produtos</Link><select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Ordenar produtos" className="border border-gray-300 bg-white px-3 py-2 text-xs font-semibold"><option value="relevance">Relevância</option><option value="price-low">Menor preço</option><option value="price-high">Maior preço</option><option value="name">Nome A-Z</option></select></div></div><div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]"><aside className="h-fit border border-gray-200 bg-white p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black">Filtrar por</h2><button type="button" onClick={clearFilters} className="text-[10px] font-bold text-[#1d6ac4] hover:underline">Limpar</button></div><div className="mb-5"><h3 className="mb-2 text-[10px] font-black uppercase tracking-wide text-gray-500">Mercado</h3><div className="space-y-2"><label className="flex items-center gap-2 text-xs"><input type="radio" checked={market === "AO"} onChange={() => setMarket("AO")} />Angola (Kz)</label><label className="flex items-center gap-2 text-xs"><input type="radio" checked={market === "PT"} onChange={() => setMarket("PT")} />Portugal (€)</label></div></div><div className="mb-5"><label htmlFor="filter-category" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-gray-500">Categoria</label><select id="filter-category" value={category} onChange={(event) => setCategory(event.target.value)} className="w-full border border-gray-300 px-2 py-2 text-xs"><option value="">Todas</option>{categories.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select></div><div className="mb-5"><label htmlFor="filter-brand" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-gray-500">Marca</label><select id="filter-brand" value={brand} onChange={(event) => setBrand(event.target.value)} className="w-full border border-gray-300 px-2 py-2 text-xs"><option value="">Todas</option>{brands.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select></div><div className="mb-5"><h3 className="mb-2 text-[10px] font-black uppercase tracking-wide text-gray-500">Preço base (€)</h3><div className="grid grid-cols-2 gap-2"><input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Mín." aria-label="Preço mínimo" className="min-w-0 border border-gray-300 px-2 py-2 text-xs" /><input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Máx." aria-label="Preço máximo" className="min-w-0 border border-gray-300 px-2 py-2 text-xs" /></div></div><div className="mb-5"><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} />Apenas em stock</label></div>{attributeGroups.map(([name, values]) => <fieldset key={name} className="mb-4 border-t border-gray-100 pt-3"><legend className="mb-2 text-[10px] font-black uppercase tracking-wide text-gray-500">{name}</legend><div className="space-y-2">{Array.from(values).map((value) => <label key={value} className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={attributes[name]?.includes(value) || false} onChange={() => toggleAttribute(name, value)} />{value}</label>)}</div></fieldset>)}</aside><section><div className="mb-4 flex gap-2"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que procuras?" className="w-full border border-gray-300 bg-white py-3 pl-9 pr-3 text-sm outline-none focus:border-[#1d6ac4]" /></div><button type="button" onClick={clearFilters} className="border border-gray-300 bg-white px-3 text-xs font-bold text-gray-600 lg:hidden">Limpar</button></div>{loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-72 animate-pulse bg-white" />)}</div> : error ? <div role="alert" className="border border-red-200 bg-white p-8 text-sm text-red-700">{error}</div> : visible.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{visible.map((product) => { const eur = Number(product.prices?.find((price) => price.market === "PT")?.amount ?? product.basePrice); const aoa = Number(product.prices?.find((price) => price.market === "AO")?.amount ?? eurToKz(eur)); const favorite = isFavorite(product.id); return <article key={product.id} className="group relative flex flex-col border border-gray-200 bg-white p-3 hover:shadow-md"><button type="button" aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => toggleFavorite({ id: product.id, name: product.name, slug: product.slug, category: product.category.name, specs: product.description || "", priceEUR: eur, imageUrl: product.imageUrl || undefined })} className={`absolute right-3 top-3 z-10 bg-white p-2 shadow-sm ${favorite ? "text-red-500" : "text-gray-500 sm:opacity-0 sm:group-hover:opacity-100"}`}><Heart size={15} fill={favorite ? "currentColor" : "none"} /></button><Link href={`/products/${product.slug}`} className="mb-3 flex h-36 items-center justify-center bg-gray-50 p-3"><Image src={product.imageUrl || "/file.svg"} alt={product.name} width={150} height={130} className="h-full w-full object-contain" /></Link><Link href={`/products?brand=${product.brand.slug}`} className="text-[9px] font-bold uppercase text-[#1d6ac4]">{product.brand.name}</Link><Link href={`/products/${product.slug}`} className="mt-1 line-clamp-2 min-h-10 text-xs font-bold text-gray-900 hover:text-[#1d6ac4]">{product.name}</Link><p className="mt-1 line-clamp-1 text-[10px] text-gray-500">{product.description}</p><p className={`mt-2 text-[10px] font-semibold ${product.stock > 0 ? "text-green-700" : "text-red-600"}`}>{product.stock > 0 ? `Em stock (${product.stock})` : "Sem stock"}</p><div className="mt-auto pt-3"><strong className="text-base font-black">{formatPrice(eur)}</strong><p className="mb-2 text-[10px] text-gray-500">{market === "PT" ? `Kz ${aoa.toLocaleString("pt-AO")}` : `€ ${eur.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}</p><button type="button" disabled={product.stock <= 0} onClick={() => { addToCart({ id: `${product.id}-default`, productId: product.id, name: product.name, slug: product.slug, priceEUR: eur, priceKZ: aoa, quantity: 1, imageUrl: product.imageUrl || undefined }); router.push("/cart"); }} className="flex w-full items-center justify-center gap-1 bg-[#f6b73c] py-2 text-xs font-black text-[#132238] hover:bg-[#ffd166] disabled:bg-gray-200"><ShoppingCart size={14} />Comprar</button></div></article>; })}</div> : <div className="border border-gray-200 bg-white px-6 py-16 text-center"><h2 className="text-lg font-black">Não encontrámos produtos</h2><p className="mt-2 text-sm text-gray-500">Altere os filtros ou limpe a pesquisa para ver mais resultados.</p><button type="button" onClick={clearFilters} className="mt-5 bg-[#f6b73c] px-4 py-2 text-xs font-black">Limpar filtros</button></div>}</section></div></div></main>;
}
