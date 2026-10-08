"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import Link from "next/link";
import {
  Zap, Laptop, Smartphone, Apple, Gamepad2,
  Shirt, BookOpen, Monitor, Settings, Headphones,
  Tag, ArrowRight, PackageSearch, type LucideProps,
} from "lucide-react";

type Category = { id: number; name: string; slug: string; productCount: number };
type IconComponent = React.FC<LucideProps>;

const catIcons: Record<string, IconComponent> = {
  eletronicos: Zap,
  computadores: Laptop,
  iphone: Smartphone,
  apple: Apple,
  smartphones: Smartphone,
  gaming: Gamepad2,
  roupas: Shirt,
  livros: BookOpen,
  monitores: Monitor,
  componentes: Settings,
  acessorios: Headphones,
  default: Tag,
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth("/api/categories")
      .then((r) => setCategories(r.data))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  const totalProducts = useMemo(
    () => categories.reduce((sum, category) => sum + category.productCount, 0),
    [categories],
  );

  return (
    <main className="min-h-screen bg-[#f7f8f8]">
      <section className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Link href="/" className="hover:text-[#1d6ac4]">Início</Link>
            <span>›</span>
            <span className="font-semibold text-slate-700">Categorias</span>
          </nav>
        </div>
      </section>

      <section className="container mx-auto px-4 py-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-xl bg-[#132238] p-6 text-white sm:p-8">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#f6b73c]">Navegue por categoria</p>
            <h1 className="mt-2 max-w-2xl text-3xl font-black leading-[1.05] sm:text-4xl">
              Encontre rapidamente o que procura.
            </h1>
            <p className="mt-3 max-w-xl text-xs leading-5 text-blue-100 sm:text-sm">
              Catálogo organizado por necessidades, com preços para Angola e Portugal e compra direta na RUBRICA DILIGENTE.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/products" className="inline-flex items-center gap-2 rounded-md bg-[#f6b73c] px-4 py-2.5 text-xs font-black text-[#132238]">
                Ver catálogo <ArrowRight size={14} />
              </Link>
              <Link href="/promotions" className="inline-flex items-center gap-2 rounded-md border border-white/30 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10">
                Ver ofertas
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <PackageSearch size={20} className="text-[#1d6ac4]" />
              <p className="mt-5 text-2xl font-black text-slate-950">{categories.length}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Categorias</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <Zap size={20} className="text-[#e63946]" />
              <p className="mt-5 text-2xl font-black text-slate-950">{totalProducts}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Produtos catalogados</p>
            </div>
            <div className="col-span-2 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Experiência de compra</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Filtre por categoria, marca, preço e disponibilidade no catálogo.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="storefront-section">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="storefront-section-header">
            <div>
              <p className="section-kicker">Explorar</p>
              <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">Todas as categorias</h2>
              <p className="mt-1 text-xs text-slate-500">Escolha uma categoria para abrir o catálogo correspondente.</p>
            </div>
            {!loading && <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600">{categories.length} disponíveis</span>}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 12 }, (_, index) => (
                <div key={index} className="h-44 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
              Não foi possível carregar as categorias.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {categories.map((cat) => {
                const Icon = catIcons[cat.slug] ?? catIcons.default;
                return (
                  <Link
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    className="group relative flex min-h-44 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#1d6ac4]/40 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e8f0fc] text-[#1d6ac4] transition group-hover:bg-[#1d6ac4] group-hover:text-white">
                        <Icon size={22} strokeWidth={1.9} />
                      </span>
                      <ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#1d6ac4]" />
                    </div>
                    <div className="mt-auto">
                      <p className="text-sm font-black text-slate-900">{cat.name}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {cat.productCount} produto{cat.productCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="mt-3 text-[10px] font-black text-[#1d6ac4]">Ver seleção</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
