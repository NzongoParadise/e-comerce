"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart, Truck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";
import { getPromotionalUnitPrice } from "@/lib/promotions/pricing";
import { usePublicPromotions } from "@/lib/promotions/usePublicPromotions";

export type CatalogProduct = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  basePrice: string | number;
  imageUrl: string | null;
  stock: number;
  category: { id: number; name: string; slug: string };
  brand: { id: number; name: string; slug: string };
  prices?: { market: string; amount: string | number }[];
};

export function ProductCard({ product }: { product: CatalogProduct }) {
  const router = useRouter();
  const { market, eurToKz } = useMarket();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const promotions = usePublicPromotions();

  const eur = Number(product.prices?.find((price) => price.market === "PT")?.amount ?? product.basePrice);
  const aoa = Number(product.prices?.find((price) => price.market === "AO")?.amount ?? eurToKz(eur));
  const pricedProduct = { id: product.id, categoryId: product.category.id, brandId: product.brand.id };
  const euroOffer = getPromotionalUnitPrice(pricedProduct, "PT", eur, promotions);
  const kwanzaOffer = getPromotionalUnitPrice(pricedProduct, "AO", aoa, promotions);
  const marketPrice = market === "AO" ? aoa : eur;
  const marketOffer = market === "AO" ? kwanzaOffer : euroOffer;
  const favorite = isFavorite(product.id);

  const formatMarketPrice = (amount: number) =>
    market === "AO"
      ? `Kz ${amount.toLocaleString("pt-AO", { maximumFractionDigits: 2 })}`
      : `€ ${amount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const discountPercent = marketOffer && marketPrice > 0
    ? Math.max(0, Math.round((1 - marketOffer.promotionalPrice / marketPrice) * 100))
    : 0;

  function addProduct() {
    addToCart({
      id: `${product.id}-default`,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      priceEUR: eur,
      priceKZ: aoa,
      quantity: 1,
      imageUrl: product.imageUrl || undefined,
    });
    router.push("/cart");
  }

  return (
    <article className="storefront-product-card group relative flex min-w-0 flex-col">
      <div className="relative">
        {marketOffer && (
          <span className="absolute left-2 top-2 z-10 storefront-discount">
            -{discountPercent}%
          </span>
        )}
        {product.stock > 0 && product.stock <= 3 && (
          <span className="absolute right-2 top-2 z-10 rounded bg-[#fff3cf] px-1.5 py-1 text-[9px] font-black text-[#8a5a00]">
            Últimas {product.stock}
          </span>
        )}
        <button
          type="button"
          aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
          onClick={() =>
            toggleFavorite({
              id: product.id,
              name: product.name,
              slug: product.slug,
              category: product.category.name,
              specs: product.description || "",
              priceEUR: eur,
              imageUrl: product.imageUrl || undefined,
            })
          }
          className={
            "absolute right-2 bottom-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 shadow-sm backdrop-blur " +
            (favorite ? "border-red-200 text-red-600" : "border-slate-200 text-slate-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100")
          }
        >
          <Heart size={15} fill={favorite ? "currentColor" : "none"} />
        </button>

        <Link
          href={`/products/${product.slug}`}
          aria-label={`Ver ${product.name}`}
          className="storefront-product-media"
        >
          <Image
            src={product.imageUrl || "/file.svg"}
            alt={product.name}
            width={240}
            height={210}
            unoptimized={Boolean(product.imageUrl && /^https?:\\/\\//i.test(product.imageUrl))}
            className="h-full w-full object-contain p-4"
          />
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <Link
          href={`/products?brand=${product.brand.slug}`}
          className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#1d6ac4] hover:text-[#155099]"
        >
          {product.brand.name}
        </Link>

        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 min-h-9 text-xs font-bold leading-[1.35] text-slate-900 hover:text-[#1d6ac4]"
        >
          {product.name}
        </Link>

        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-400">
          <span>{product.category.name}</span>
          <span aria-hidden="true">·</span>
          <span>{product.stock > 0 ? "Disponível" : "Indisponível"}</span>
        </div>

        <div className="mt-auto pt-3">
          {marketOffer ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <del className="storefront-old-price text-[10px]">
                {formatMarketPrice(marketPrice)}
              </del>
              <strong className="storefront-price text-lg font-black">
                {formatMarketPrice(marketOffer.promotionalPrice)}
              </strong>
            </div>
          ) : (
            <strong className="storefront-price text-lg font-black text-slate-950">
              {formatMarketPrice(marketPrice)}
            </strong>
          )}

          {marketOffer ? (
            <p className="mt-1 line-clamp-1 text-[9px] font-bold text-red-600">
              {marketOffer.promotion.name}
            </p>
          ) : (
            <p className="mt-1 text-[9px] text-slate-400">Preço final conforme o mercado selecionado</p>
          )}

          <div className="mt-2 flex items-center justify-between gap-2 text-[9px]">
            <span className={product.stock > 0 ? "font-bold text-emerald-600" : "font-bold text-red-600"}>
              {product.stock > 0 ? `${product.stock} em stock` : "Sem stock"}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Truck size={11} />
              AO · PT
            </span>
          </div>

          <button
            type="button"
            disabled={product.stock <= 0}
            onClick={addProduct}
            className="storefront-cta mt-3 flex w-full items-center justify-center gap-2 px-3"
          >
            <ShoppingCart size={14} strokeWidth={2.4} />
            Comprar agora
          </button>
        </div>
      </div>
    </article>
  );
}
