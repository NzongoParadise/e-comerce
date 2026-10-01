"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";

export type CatalogProduct = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  basePrice: string | number;
  imageUrl: string | null;
  stock: number;
  category: { name: string; slug: string };
  brand: { name: string; slug: string };
  prices?: { market: string; amount: string | number }[];
};

export function ProductCard({ product }: { product: CatalogProduct }) {
  const router = useRouter();
  const { market, formatPrice, eurToKz } = useMarket();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const eur = Number(product.prices?.find((price) => price.market === "PT")?.amount ?? product.basePrice);
  const aoa = Number(product.prices?.find((price) => price.market === "AO")?.amount ?? eurToKz(eur));
  const favorite = isFavorite(product.id);

  return (
    <article key={product.id} className="group relative flex flex-col border border-gray-200 bg-white p-3 hover:shadow-md">
      <button
        type="button"
        aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
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
        className={`absolute right-3 top-3 z-10 bg-white p-2 shadow-sm ${
          favorite ? "text-red-500" : "text-gray-500 sm:opacity-0 sm:group-hover:opacity-100"
        }`}
      >
        <Heart size={15} fill={favorite ? "currentColor" : "none"} />
      </button>

      <Link href={`/products/${product.slug}`} className="mb-3 flex h-36 items-center justify-center bg-gray-50 p-3">
        <Image src={product.imageUrl || "/file.svg"} alt={product.name} width={150} height={130} className="h-full w-full object-contain" />
      </Link>

      <Link href={`/products?brand=${product.brand.slug}`} className="text-[9px] font-bold uppercase text-[#1d6ac4]">
        {product.brand.name}
      </Link>
      <Link href={`/products/${product.slug}`} className="mt-1 line-clamp-2 min-h-10 text-xs font-bold text-gray-900 hover:text-[#1d6ac4]">
        {product.name}
      </Link>
      <p className="mt-1 line-clamp-1 text-[10px] text-gray-500">{product.description}</p>
      <p className={`mt-2 text-[10px] font-semibold ${product.stock > 0 ? "text-green-700" : "text-red-600"}`}>
        {product.stock > 0 ? `Em stock (${product.stock})` : "Sem stock"}
      </p>

      <div className="mt-auto pt-3">
        <strong className="text-base font-black">{formatPrice(eur)}</strong>
        <p className="mb-2 text-[10px] text-gray-500">
          {market === "PT" ? `Kz ${aoa.toLocaleString("pt-AO")}` : `€ ${eur.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}
        </p>
        <button
          type="button"
          disabled={product.stock <= 0}
          onClick={() => {
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
          }}
          className="flex w-full items-center justify-center gap-1 bg-[#f6b73c] py-2 text-xs font-black text-[#132238] hover:bg-[#ffd166] disabled:bg-gray-200"
        >
          <ShoppingCart size={14} />
          Comprar
        </button>
      </div>
    </article>
  );
}
