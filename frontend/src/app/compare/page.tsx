"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Check, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useMarket } from "@/context/MarketContext";

type Product = { id: number; name: string; slug: string; description: string | null; basePrice: string | number; imageUrl: string | null; stock: number; category: { name: string; slug: string }; brand: { name: string; slug: string }; attributes?: { name: string; value: string }[]; prices?: { market: string; amount: string | number; currency: string }[] };
type SuggestionState = { sourceId: number; products: Product[] };
function priceFor(product: Product, market: "AO" | "PT") { return Number(product.prices?.find((price) => price.market === market)?.amount ?? product.basePrice); }

export default function ComparePage() {
  const { market, formatPrice, eurToKz } = useMarket();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [suggestionState, setSuggestionState] = useState<SuggestionState | null>(null);

  useEffect(() => {
    fetchWithAuth("/api/products?page=1&pageSize=100").then((response) => { setProducts(response.data); setSelectedIds(response.data.slice(0, 2).map((product: Product) => product.id)); }).catch(() => setMessage("Não foi possível carregar o catálogo." )).finally(() => setLoading(false));
  }, []);
  const sourceId = selectedIds[0];
  useEffect(() => {
    if (!sourceId) return;
    fetchWithAuth(`/api/recommendations?productId=${sourceId}&limit=6`).then((response) => setSuggestionState({ sourceId, products: response.data })).catch(() => setSuggestionState({ sourceId, products: [] }));
  }, [sourceId]);

  const selected = selectedIds.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
  const candidates = products.filter((product) => !selectedIds.includes(product.id) && `${product.name} ${product.brand.name}`.toLowerCase().includes(query.toLowerCase()));
  const suggestions = sourceId && suggestionState?.sourceId === sourceId ? suggestionState.products.filter((product) => !selectedIds.includes(product.id)) : [];
  const attributeNames = Array.from(new Set(selected.flatMap((product) => product.attributes?.map((attribute) => attribute.name) || [])));
  const rows = [
    { label: "Marca", value: (product: Product) => product.brand.name },
    { label: "Categoria", value: (product: Product) => product.category.name },
    { label: `Preço (${market === "AO" ? "Kz" : "€"})`, value: (product: Product) => formatPrice(priceFor(product, market)) },
    { label: "Descrição", value: (product: Product) => product.description || "Sem descrição" },
    { label: "Disponibilidade", value: (product: Product) => product.stock > 0 ? `${product.stock} em stock` : "Sem stock" },
    ...attributeNames.map((name) => ({ label: name, value: (product: Product) => product.attributes?.filter((attribute) => attribute.name === name).map((attribute) => attribute.value).join(", ") || "Não especificado" })),
  ];

  function toggleProduct(product: Product) { setSelectedIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : current.length < 4 ? [...current, product.id] : current); }
  function addToBasket(product: Product) { const euro = priceFor(product, "PT"); addToCart({ id: `${product.id}-default`, productId: product.id, name: product.name, slug: product.slug, priceEUR: euro, priceKZ: priceFor(product, "AO") || eurToKz(euro), quantity: 1, imageUrl: product.imageUrl || undefined }); setMessage(`${product.name} adicionado ao carrinho.`); window.setTimeout(() => setMessage(""), 2200); }

  return <main className="min-h-screen bg-[#f7f8f8] text-gray-900"><div className="border-b border-gray-200 bg-white"><div className="container mx-auto flex items-center justify-between px-4 py-3 text-xs"><nav className="flex gap-2 text-gray-500"><Link href="/">Início</Link><span>›</span><strong className="text-gray-800">Comparar produtos</strong></nav><Link href="/products" className="font-bold text-[#1d6ac4]">Voltar ao catálogo</Link></div></div><div className="container mx-auto px-4 py-6"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Decisão de compra</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Comparar produtos</h1><p className="mt-1 text-sm text-gray-500">Compare preços e especificações atuais do catálogo.</p></div><button type="button" onClick={() => setSelectedIds([])} className="inline-flex items-center gap-2 self-start border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600"><Trash2 size={14} />Limpar comparação</button></div>{message && <p role="status" className="mb-4 bg-gray-900 px-4 py-3 text-xs font-semibold text-white">{message}</p>}
    <section className="mb-5 border border-gray-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">Adicionar produtos</h2><span className="text-xs text-gray-500">{selected.length}/4 selecionados</span></div><div className="relative mb-3"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar produto ou marca" className="w-full border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#1d6ac4]" /></div>{loading ? <p className="py-5 text-center text-sm text-gray-500">A carregar catálogo...</p> : <div className="flex gap-2 overflow-x-auto">{candidates.slice(0, 8).map((product) => <button key={product.id} type="button" onClick={() => toggleProduct(product)} disabled={selected.length >= 4} className="flex min-w-48 items-center gap-3 border border-gray-200 p-2 text-left hover:border-[#1d6ac4] disabled:opacity-50"><Image src={product.imageUrl || "/file.svg"} alt="" width={42} height={42} className="h-10 w-10 object-contain" /><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{product.name}</strong><small className="text-[10px] text-gray-500">{product.brand.name}</small></span><Plus size={14} className="text-[#1d6ac4]" /></button>)}</div>}</section>
    {!selected.length ? <div className="border border-dashed border-gray-300 bg-white px-6 py-16 text-center"><ArrowLeftRight size={40} className="mx-auto mb-3 text-gray-300" /><h2 className="font-black">Selecione produtos para comparar</h2></div> : <section className="overflow-x-auto border border-gray-200 bg-white"><table className="w-full min-w-[700px] border-collapse"><thead><tr><th className="w-40 border-b border-gray-200 p-4 text-left text-xs uppercase text-gray-500">Característica</th>{selected.map((product) => <th key={product.id} className="relative w-56 border-b border-l border-gray-200 p-4 text-left align-top"><button type="button" onClick={() => toggleProduct(product)} aria-label={`Remover ${product.name}`} className="absolute right-2 top-2 text-gray-400 hover:text-red-600"><X size={15} /></button><Link href={`/products/${product.slug}`}><div className="mb-3 flex h-32 items-center justify-center bg-gray-50"><Image src={product.imageUrl || "/file.svg"} alt={product.name} width={140} height={120} className="h-full w-full object-contain" /></div><small className="font-bold uppercase text-[#1d6ac4]">{product.brand.name}</small><h2 className="mt-1 text-sm font-black">{product.name}</h2></Link><p className="mt-2 text-base font-black">{formatPrice(priceFor(product, market))}</p><button type="button" onClick={() => addToBasket(product)} className="mt-3 flex w-full items-center justify-center gap-2 bg-[#f6b73c] py-2 text-xs font-black text-[#132238]"><ShoppingCart size={14} />Comprar</button></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th className="border-b border-gray-100 p-4 text-left text-xs font-bold text-gray-600">{row.label}</th>{selected.map((product) => <td key={product.id} className="border-b border-l border-gray-100 p-4 text-xs text-gray-600">{row.value(product)}</td>)}</tr>)}</tbody></table></section>}
    {suggestions.length > 0 && <section className="mt-5 border border-gray-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">Sugestões para comparar</h2><span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Produtos semelhantes</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{suggestions.map((product) => <button key={product.id} type="button" onClick={() => toggleProduct(product)} disabled={selected.length >= 4} className="border border-gray-200 p-2 text-left hover:border-[#1d6ac4] disabled:opacity-50"><div className="flex h-24 items-center justify-center bg-gray-50"><Image src={product.imageUrl || "/file.svg"} alt={product.name} width={90} height={80} className="h-full w-full object-contain" /></div><p className="mt-2 line-clamp-2 text-xs font-bold">{product.name}</p><p className="text-[10px] text-gray-500">{product.brand.name}</p></button>)}</div></section>}
    {selected.length > 0 && <p className="mt-4 flex items-center gap-2 text-xs text-gray-500"><Check size={14} className="text-green-600" />Dados atuais do catálogo TechGlobal.</p>}</div></main>;
}
