"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Heart, ShoppingCart, Bell, SlidersHorizontal } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";
import { useCart } from "@/context/CartContext";
import { useMarket } from "@/context/MarketContext";

export default function FavoritesPage() {
  const { favorites, toggleFavorite } = useFavorites();
  const { addToCart } = useCart();
  const { formatPrice, market } = useMarket();
  const [category, setCategory] = useState("Todos os produtos");
  const [sort, setSort] = useState<"recent" | "price-low" | "price-high" | "name">("recent");
  const [message, setMessage] = useState("");
  const categories = ["Todos os produtos", ...Array.from(new Set(favorites.map((item) => item.category)))];
  const visible = useMemo(() => {
    const filtered = category === "Todos os produtos" ? [...favorites] : favorites.filter((item) => item.category === category);
    return filtered.sort((first, second) => {
      const priceForMarket = (product: typeof favorites[number]) =>
        market === "AO" ? (Number(product.priceKZ) > 0 ? Number(product.priceKZ) : Number.POSITIVE_INFINITY) : product.priceEUR;
      if (sort === "price-low") return priceForMarket(first) - priceForMarket(second);
      if (sort === "price-high") return priceForMarket(second) - priceForMarket(first);
      if (sort === "name") return first.name.localeCompare(second.name, "pt");
      return 0;
    });
  }, [favorites, category, sort, market]);

  async function shareFavorites() {
    if (!favorites.length) {
      setMessage("Adicione produtos aos favoritos antes de partilhar.");
      return;
    }
    const lines = favorites.map((product) => product.name + " — " + new URL("/products/" + product.slug, window.location.origin).toString());
    const text = "Produtos que recomendo da RUBRICA DILIGENTE:\n\n" + lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "Produtos recomendados", text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setMessage("Lista de produtos e respetivos links copiada.");
      } else {
        setMessage("Este navegador não suporta a partilha nem a cópia automática.");
      }
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "AbortError") setMessage("Não foi possível partilhar a lista.");
    }
  }

  function addProduct(product: typeof favorites[number]) {
    if (market === "AO" && !(Number(product.priceKZ) > 0)) {
      setMessage("O preço em kwanzas deste produto ainda não está configurado. Consulte o produto antes de o adicionar ao carrinho.");
      return;
    }
    if (product.stock === 0) {
      setMessage("Este produto está sem stock disponível.");
      return;
    }
    addToCart({
      id: `favorite-${product.id}`,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      priceEUR: product.priceEUR,
      priceKZ: Number(product.priceKZ || 0),
      quantity: 1,
      imageUrl: product.imageUrl,
    });
    setMessage(`${product.name} foi adicionado ao carrinho.`);
  }

  return <div className="container mx-auto px-4 py-8">
    <nav className="mb-6 flex gap-1 text-xs text-gray-400"><Link href="/" className="hover:text-[#1d6ac4]">Início</Link><span>›</span><span className="font-medium text-gray-700">Lista de favoritos</span></nav>
    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="flex items-center gap-2 text-2xl font-black text-gray-900"><Heart className="text-[#1d6ac4]" fill="currentColor" /> Lista de favoritos</h1><p className="mt-1 text-sm text-gray-500">Guarde os produtos de que mais gosta e compre mais tarde.</p></div><button type="button" onClick={() => void shareFavorites()} disabled={!favorites.length} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40"><span>↗</span> Partilhar lista</button></div>
    {message && <p role="status" className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</p>}
    <div className="grid gap-8 lg:grid-cols-[1fr_250px]">
      <main><div className="mb-5 flex items-center justify-between gap-3"><div className="flex gap-2 overflow-x-auto">{categories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${category === item ? "bg-[#1d6ac4] text-white" : "text-gray-600 hover:bg-gray-100"}`}>{item}</button>)}</div><label className="hidden items-center gap-1 text-xs font-semibold text-gray-500 sm:flex"><SlidersHorizontal size={14} /><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="bg-transparent outline-none"><option value="recent">Mais recente</option><option value="price-low">Preço mais baixo</option><option value="price-high">Preço mais alto</option><option value="name">Nome A-Z</option></select></label></div>
        {visible.length === 0 ? <div className="card px-6 py-20 text-center"><Heart size={48} className="mx-auto mb-4 text-gray-300" /><h2 className="text-lg font-bold text-gray-900">Ainda não tem favoritos</h2><p className="mt-2 text-sm text-gray-500">Toque no coração de um produto para o guardar aqui.</p><Link href="/products" className="btn-primary mt-6">Explorar produtos</Link></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{visible.map((product) => <article key={product.id} className="card relative flex flex-col p-3"><button type="button" onClick={() => toggleFavorite(product)} className="absolute right-3 top-3 z-10 text-red-500" aria-label={`Remover ${product.name} dos favoritos`}><Heart size={17} fill="currentColor" /></button><Link href={`/products/${product.slug}`} className="flex h-32 items-center justify-center rounded-lg bg-gray-50"><img src={product.imageUrl || "/file.svg"} alt={product.name} className="h-full w-full object-contain" /></Link><h2 className="mt-3 line-clamp-2 text-xs font-bold text-gray-900">{product.name}</h2><p className="mt-1 line-clamp-1 text-[10px] text-gray-500">{product.specs}</p><p className="mt-2 text-xs text-amber-500">{product.reviews ? <><span>{Array.from({ length: 5 }, (_, index) => index < Math.round(product.rating || 0) ? "★" : "☆").join("")}</span> <span className="text-gray-400">({product.reviews})</span></> : <span className="text-[10px] text-gray-400">Sem avaliações publicadas</span>}</p><div className="mt-auto pt-2"><p className="text-base font-black text-gray-900">{market === "AO" ? (Number(product.priceKZ) > 0 ? "Kz " + Number(product.priceKZ).toLocaleString("pt-AO", { maximumFractionDigits: 0 }) : "Preço por confirmar") : formatPrice(product.priceEUR)}</p><p className={"mb-2 text-[10px] font-semibold " + (product.stock === 0 ? "text-rose-600" : product.stock !== undefined && product.stock > 0 ? "text-green-600" : "text-slate-400")}>{product.stock === 0 ? "● Sem stock" : product.stock !== undefined ? "● " + product.stock + " em stock" : "Stock a confirmar"}</p><button type="button" disabled={product.stock === 0 || (market === "AO" && !(Number(product.priceKZ) > 0))} onClick={() => addProduct(product)} className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[#1d6ac4] px-2 py-2 text-[10px] font-bold text-[#1d6ac4] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><ShoppingCart size={13} /> Adicionar ao carrinho</button></div></article>)}</div>}
      </main>
      <aside className="space-y-4"><div className="card p-5"><div className="flex gap-3"><Heart className="text-[#1d6ac4]" fill="currentColor" /><div><h2 className="text-sm font-bold text-gray-900">Nunca perca os seus favoritos</h2><p className="mt-1 text-xs leading-5 text-gray-500">A lista fica neste dispositivo para visitantes e sincroniza entre dispositivos quando inicia sessão.</p></div></div></div><div className="card p-5"><div className="flex gap-3"><Bell className="text-[#1d6ac4]" /><div><h2 className="text-sm font-bold text-gray-900">Novidades da conta</h2><p className="mt-1 text-xs leading-5 text-gray-500">Configure as preferências de comunicação e acompanhe atualizações de encomendas na sua conta.</p></div></div><Link href="/account/settings" className="btn-secondary mt-4 flex w-full justify-center">Gerir notificações</Link><Link href="/notifications" className="mt-3 block text-center text-xs font-bold text-[#1d6ac4] hover:underline">Ver notificações</Link></div></aside>
    </div>
  </div>;
}