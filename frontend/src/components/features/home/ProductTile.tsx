"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart, Truck } from "lucide-react";
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

export function ProductTile({ product }: { product: Product }) {
  const { market, formatPrice, eurToKz } = useMarket();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const euroPrice = Number(product.prices?.find((price) => price.market === "PT")?.amount ?? product.basePrice);
  const kwanzaPrice = Number(product.prices?.find((price) => price.market === "AO")?.amount ?? eurToKz(euroPrice));
  const favorite = isFavorite(product.id);

  return (
    <article className="storefront-product-card group relative flex min-w-0 flex-col">
      {product.stock > 0 && product.stock <= 3 && (
        <span className="absolute left-2 top-2 z-10 rounded bg-[#fff3cf] px-1.5 py-1 text-[9px] font-black text-[#8a5a00]">
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
        aria-label={favorite ? \`Remover \${product.name} dos favoritos\` : \`Adicionar \${product.name} aos favoritos\`}
        className={
          "absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 shadow-sm backdrop-blur " +
          (favorite ? "border-red-200 text-red-600" : "border-slate-200 text-slate-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100")
        }
      >
        <Heart size={15} fill={favorite ? "currentColor" : "none"} />
      </button>

      <Link href={\`/products/\${product.slug}\`} className="storefront-product-media min-h-[185px]">
        <Image
          src={product.imageUrl || "/file.svg"}
          alt={product.name}
          width={240}
          height={210}
          unoptimized={Boolean(product.imageUrl && /^https?:\\/\\//i.test(product.imageUrl))}
          className="h-full w-full object-contain p-4 transition-transform duration-200 group-hover:scale-[1.035]"
        />
      </Link>

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <Link href={\`/products?brand=\${product.brand.slug}\`} className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#1d6ac4] hover:text-[#155099]">
          {product.brand.name}
        </Link>
        <Link href={\`/products/\${product.slug}\`} className="line-clamp-2 min-h-9 text-xs font-bold leading-[1.35] text-slate-900 hover:text-[#1d6ac4]">
          {product.name}
        </Link>
        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-400">
          <span>{product.category.name}</span>
          <span aria-hidden="true">·</span>
          <span>{product.stock > 0 ? "Disponível" : "Indisponível"}</span>
        </div>

        <div className="mt-auto pt-3">
          <p className="text-lg font-black tracking-tight text-[#df1f2d]">{formatPrice(euroPrice)}</p>
          <p className="mt-0.5 text-[9px] text-slate-400">
            {market === "PT"
              ? \`Kz \${kwanzaPrice.toLocaleString("pt-AO")}\`
              : \`€ \${euroPrice.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}\`}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 text-[9px]">
            <span className={product.stock > 0 ? "font-bold text-emerald-600" : "font-bold text-red-600"}>
              {product.stock > 0 ? \`\${product.stock} em stock\` : "Sem stock"}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400"><Truck size={11} />AO · PT</span>
          </div>
          <button
            type="button"
            disabled={product.stock <= 0}
            onClick={() =>
              addToCart({
                id: \`\${product.id}-default\`,
                productId: product.id,
                name: product.name,
                slug: product.slug,
                priceEUR: euroPrice,
                priceKZ: kwanzaPrice,
                quantity: 1,
                imageUrl: product.imageUrl || undefined,
              })
            }
            className="storefront-cta mt-3 flex w-full items-center justify-center gap-2 px-3"
          >
            <ShoppingCart size={14} strokeWidth={2.4} />
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </article>
  );
}
