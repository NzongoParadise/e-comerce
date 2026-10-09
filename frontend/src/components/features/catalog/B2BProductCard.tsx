"use client";

import Link from "next/link";
import { Heart, ShoppingCart, Truck } from "lucide-react";
import { useB2BCart } from "@/context/B2BCartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";

type PriceRule = {
  id: number;
  minQuantity: number;
  unitPrice: number;
  currency: string;
};

export type B2BProductCardProduct = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  basePrice: string | number;
  imageUrl: string | null;
  stock: number;
  category: { name: string; slug: string };
  brand: { name: string; slug: string };
  prices?: { market: string; amount: string | number; currency: string }[];
  b2bPriceRules?: PriceRule[];
};

export function B2BProductCard({ product }: { product: B2BProductCardProduct }) {
  const { market, formatPrice, eurToKz } = useMarket();
  const { addToCart } = useB2BCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const euroPrice = Number(product.prices?.find((price) => price.market === "PT")?.amount ?? product.basePrice);
  const kwanzaPrice = Number(product.prices?.find((price) => price.market === "AO")?.amount ?? eurToKz(euroPrice));
  const favorite = isFavorite(product.id);
  const currency = market === "PT" ? "EUR" : "AOA";
  const rules = [...(product.b2bPriceRules || [])]
    .filter((rule) => rule.currency === currency)
    .sort((a, b) => a.minQuantity - b.minQuantity);
  const bestRule = rules.length ? rules[rules.length - 1] : null;

  function add() {
    if (product.stock <= 0) return;
    addToCart({
      id: String(product.id) + "-default",
      productId: product.id,
      name: product.name,
      slug: product.slug,
      priceEUR: euroPrice,
      priceKZ: kwanzaPrice,
      quantity: 1,
      imageUrl: product.imageUrl || undefined,
      stock: product.stock,
      b2bPriceRules: rules,
    });
  }

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="relative">
        {rules.length > 0 && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-[#132238] px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-white">
            Preço empresarial
          </span>
        )}
        {product.stock > 0 && product.stock <= 3 && (
          <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-50 px-2 py-1 text-[8px] font-black text-amber-800">
            Últimas {product.stock}
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleFavorite({
            id: product.id,
            name: product.name,
            slug: product.slug,
            category: product.category.name,
            specs: product.description || "",
            priceEUR: euroPrice,
            imageUrl: product.imageUrl || undefined,
          })}
          aria-label={favorite ? "Remover " + product.name + " dos favoritos" : "Adicionar " + product.name + " aos favoritos"}
          className={"absolute right-2 bottom-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 shadow-sm backdrop-blur " + (favorite ? "border-red-200 text-red-600" : "border-slate-200 text-slate-500 sm:opacity-0 sm:group-hover:opacity-100")}
        >
          <Heart size={15} fill={favorite ? "currentColor" : "none"}/>
        </button>
        <Link href={"/products/" + product.slug} className="flex min-h-[190px] items-center justify-center bg-slate-50 p-4">
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-[170px] w-full object-contain transition-transform duration-200 group-hover:scale-[1.035]" /> : <ShoppingCart size={35} className="text-slate-300"/>}
        </Link>
      </div>

      <div className="flex min-h-[245px] flex-1 flex-col p-3">
        <Link href={"/products?brand=" + product.brand.slug} className="text-[8px] font-black uppercase tracking-[0.12em] text-[#1d6ac4] hover:underline">{product.brand.name}</Link>
        <Link href={"/products/" + product.slug} className="mt-1 line-clamp-2 min-h-9 text-xs font-bold leading-[1.35] text-slate-900 hover:text-[#1d6ac4]">{product.name}</Link>
        <p className="mt-1 text-[9px] text-slate-400">{product.category.name}</p>

        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#1d6ac4]">Condição empresarial</p>
          {bestRule ? (
            <>
              <p className="mt-1 text-[10px] text-slate-500">A partir de <strong className="text-slate-800">{bestRule.minQuantity} un.</strong></p>
              <p className="mt-1 text-lg font-black tracking-tight text-slate-950">
                {bestRule.currency === "EUR" ? "€ " : "Kz "}{bestRule.unitPrice.toLocaleString(bestRule.currency === "EUR" ? "pt-PT" : "pt-AO", { minimumFractionDigits: bestRule.currency === "EUR" ? 2 : 0, maximumFractionDigits: 2 })}
              </p>
              {rules.length > 1 && <p className="mt-1 text-[8px] text-slate-500">{rules.length} níveis de preço por volume</p>}
            </>
          ) : (
            <>
              <p className="mt-1 text-lg font-black tracking-tight text-slate-950">{market === "PT" ? formatPrice(euroPrice) : "Kz " + kwanzaPrice.toLocaleString("pt-AO", { maximumFractionDigits: 0 })}</p>
              <p className="mt-1 text-[8px] text-slate-500">Preço empresarial sob consulta</p>
            </>
          )}
        </div>

        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-2 text-[9px]">
            <span className={product.stock > 0 ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{product.stock > 0 ? product.stock + " em stock" : "Sem stock"}</span>
            <span className="inline-flex items-center gap-1 text-slate-400"><Truck size={11}/> {market === "PT" ? "PT" : "AO"}</span>
          </div>
          <button type="button" onClick={add} disabled={product.stock <= 0} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#132238] px-3 py-2.5 text-[10px] font-black text-white transition hover:bg-[#1d6ac4] disabled:cursor-not-allowed disabled:opacity-40">
            <ShoppingCart size={14}/> Adicionar ao pedido
          </button>
          <Link href={"/b2b/cotacoes?product=" + product.id} className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[9px] font-black text-slate-600 hover:border-blue-200 hover:text-[#1d6ac4]">Solicitar cotação</Link>
        </div>
      </div>
    </article>
  );
}
