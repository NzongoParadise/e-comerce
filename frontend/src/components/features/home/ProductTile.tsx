"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";

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

export function ProductTile({ product, showQuickAdd = true }: { product: Product; showQuickAdd?: boolean }) {
  const { market, eurToKz } = useMarket();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const euroPrice = Number(product.prices?.find((price) => price.market === "PT")?.amount ?? product.basePrice);
  const kwanzaPrice = Number(product.prices?.find((price) => price.market === "AO")?.amount ?? eurToKz(euroPrice));
  const favorite = isFavorite(product.id);

  return (
    <article className="storefront-product-card group relative flex min-w-0 flex-col">
      {product.stock > 0 && product.stock <= 3 && (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-white/95 px-2.5 py-1.5 text-[10px] font-semibold text-[#176b64] shadow-sm">
          Últimas {product.stock}
        </span>
      )}

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
        className={
          "absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border bg-white/95 shadow-sm backdrop-blur transition " +
          (favorite ? "border-red-200 text-red-600" : "border-white text-slate-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100")
        }
      >
        <Heart size={15} fill={favorite ? "currentColor" : "none"} />
      </button>

      <Link href={`/products/${product.slug}`} className="storefront-product-media aspect-square min-h-0">
        <Image
          src={product.imageUrl || "/file.svg"}
          alt={product.name}
          width={240}
          height={210}
          unoptimized={Boolean(product.imageUrl && /^https?:\/\//i.test(product.imageUrl))}
          className="h-full w-full object-contain p-4 transition-transform duration-200 group-hover:scale-[1.035]"
        />
      </Link>

      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-3.5">
        <Link href={`/products?brand=${product.brand.slug}`} className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#71807c] hover:text-[#087e76]">
          {product.brand.name}
        </Link>
        <Link href={`/products/${product.slug}`} className="line-clamp-2 min-h-9 text-sm font-semibold leading-[1.35] text-[#263a36] hover:text-[#087e76]">
          {product.name}
        </Link>

        <div className="mt-auto pt-3">
          <p className="text-base font-bold tracking-tight text-[#263a36] sm:text-lg">
            {market === "AO"
              ? `Kz ${kwanzaPrice.toLocaleString("pt-AO")}`
              : `€ ${euroPrice.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}
          </p>
          {showQuickAdd ? <button
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
            aria-label={`Adicionar ${product.name} ao carrinho`}
            className="storefront-cta mt-3 flex w-full items-center justify-center gap-2 px-3"
          >
            <ShoppingCart size={14} strokeWidth={2} />
            Adicionar
          </button> : <Link href={`/products/${product.slug}`} className="mt-2 inline-flex items-center text-xs font-semibold text-[#087e76] hover:underline">
            {product.stock > 0 ? "Ver produto" : "Indisponível"}
          </Link>}
        </div>
      </div>
    </article>
  );
}
