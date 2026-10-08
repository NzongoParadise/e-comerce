"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { ProductCard, type CatalogProduct } from "@/components/features/catalog/ProductCard";
import { fetchWithAuth } from "@/lib/api";

type RecommendationRailProps = {
  title: string;
  description?: string;
  sourceProductId?: number;
  limit?: number;
};

export function RecommendationRail({
  title,
  description,
  sourceProductId,
  limit = 6,
}: RecommendationRailProps) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 12)) });
    if (sourceProductId) query.set("productId", String(sourceProductId));

    let active = true;
    setLoading(true);

    fetchWithAuth(`/api/recommendations?${query.toString()}`)
      .then((response) => {
        if (active) setProducts(response.data as CatalogProduct[]);
      })
      .catch(() => {
        if (active) setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [limit, sourceProductId]);

  if (!loading && products.length === 0) return null;

  return (
    <section className="storefront-section">
      <div className="container mx-auto px-4 py-7 sm:py-9">
        <div className="storefront-section-header">
          <div>
            <p className="section-kicker">Descoberta</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
            {description && <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{description}</p>}
          </div>
          <Link href="/products" className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-[#1d6ac4] hover:underline">
            Ver catálogo <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-500">
            <LoaderCircle size={16} className="animate-spin" />
            A preparar sugestões...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </div>
    </section>
  );
}
