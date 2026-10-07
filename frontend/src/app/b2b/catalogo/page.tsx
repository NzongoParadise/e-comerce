"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { ProductTile, type Product } from "@/components/features/home/ProductTile";

export default function B2BCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth("/api/products?page=1&pageSize=24")
      .then((result) => setProducts(result.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const visible = products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1d6ac4]">B2B · Catálogo</p>
          <h1 className="mt-1 text-3xl font-black text-[#0c1b2a]">Produtos para empresas</h1>
          <p className="mt-2 max-w-xl text-sm text-gray-500">Consulte o catálogo comercial e avance para uma compra ou pedido de cotação.</p>
        </div>
        <Link href="/b2b/cotacoes" className="inline-flex items-center gap-2 rounded-xl bg-[#0c1b2a] px-4 py-3 text-xs font-black text-white">Pedir cotação <ArrowRight size={15} /></Link>
      </div>

      <div className="mb-6 flex items-center gap-3 border border-gray-200 bg-white px-4 py-3">
        <Search size={18} className="text-gray-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar no catálogo empresarial..." className="w-full bg-transparent text-sm outline-none" />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <div key={i} className="h-80 animate-pulse bg-white" />)}</div>
      ) : visible.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{visible.map((product) => <ProductTile key={product.id} product={product} />)}</div>
      ) : (
        <div className="border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Nenhum produto encontrado.</div>
      )}
    </main>
  );
}
