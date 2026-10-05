"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";
import { Stars } from "@/components/features/home/Stars";

export type Product = {
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
};

export function ProductTile({ product }: { product: Product }) {
  const { market, formatPrice, eurToKz } = useMarket();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const euroPrice = Number(product.prices?.find((price) => price.market === "PT")?.amount ?? product.basePrice);
  const kwanzaPrice = Number(product.prices?.find((price) => price.market === "AO")?.amount ?? eurToKz(euroPrice));
  const favorite = isFavorite(product.id);

  return (
    <article className="group relative flex min-w-0 flex-col rounded-[24px] border border-gray-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-1 hover:border-[#1d6ac4]/35 hover:shadow-[0_20px_48px_rgba(29,106,196,0.10)] sm:p-4">
      <button
        type="button"
        onClick={() =>
          toggleFavorite({
            id: product.id,
            name: product.name,
            slug: product.slug,
            category: product.category.name,
            specs: product.description || "",
            priceEUR: euroPrice,
            imageUrl: product.imageUrl || undefined,
          })
        }
        aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
        className={`absolute right-3 top-3 z-10 rounded-full border border-gray-200 bg-white/90 p-2 shadow-sm backdrop-blur-sm ${
          favorite ? "text-red-500" : "text-gray-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        }`}
      >
        <Heart size={17} fill={favorite ? "currentColor" : "none"} />
      </button>

      {product.stock <= 3 && product.stock > 0 && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-[#f6b73c] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#132238] shadow-sm">
          Últimas unidades
        </span>
      )}

      <Link href={`/products/${product.slug}`} className="mb-3 flex h-36 items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-[#f8fafc] via-[#f3f7fb] to-[#edf3ff] p-3 sm:h-44">
        <Image
          src={product.imageUrl || "/file.svg"}
          alt={product.name}
          width={180}
          height={160}
          unoptimized={Boolean(product.imageUrl && /^https?:\/\//i.test(product.imageUrl))}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
        />
      </Link>

      <Link href={`/products?brand=${product.brand.slug}`} className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1d6ac4] hover:text-[#155099]">
        {product.brand.name}
      </Link>
      <Link href={`/products/${product.slug}`} className="mt-1 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-gray-900 hover:text-[#1d6ac4]">
        {product.name}
      </Link>
      <p className="mt-1 line-clamp-1 text-[11px] text-gray-500">{product.description || product.category.name}</p>

      <div className="mt-2 flex items-center gap-1">
        <Stars count={0} />
        <span className="text-[10px] text-gray-400">Avaliações</span>
      </div>

      <p className="mt-2 text-[10px] font-semibold text-green-700">
        {product.stock > 0 ? `Em stock (${product.stock})` : "Indisponível"}
      </p>

      <div className="mt-auto pt-3">
        <div className="flex items-end justify-between gap-2">
          <p className="text-lg font-black text-[#111827]">{formatPrice(euroPrice)}</p>
          <span className="rounded-full bg-[#e8f0fc] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#1d6ac4]">
            {market === "PT" ? "PT" : "AO"}
          </span>
        </div>
        <p className="mb-3 text-[10px] text-gray-500">
          {market === "PT" ? `Kz ${kwanzaPrice.toLocaleString("pt-AO")}` : `€ ${euroPrice.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}
        </p>

        <button
          type="button"
          disabled={product.stock <= 0}
          onClick={() =>
            addToCart({
              id: `${product.id}-default`,
              productId: product.id,
              name: product.name,
              slug: product.slug,
              priceEUR: euroPrice,
              priceKZ: kwanzaPrice,
              quantity: 1,
              imageUrl: product.imageUrl || undefined,
            })
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#f6b73c] px-3 py-2.5 text-xs font-black text-[#132238] transition hover:bg-[#ffd166] disabled:cursor-not-allowed disabled:bg-gray-200"
        >
          <ShoppingCart size={15} />
          Adicionar ao carrinho
        </button>
      </div>
    </article>
  );
}
