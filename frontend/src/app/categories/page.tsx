"use client";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import Link from "next/link";
import {
  Zap, Laptop, Smartphone, Apple, Gamepad2,
  Shirt, BookOpen, Monitor, Settings, Headphones,
  Tag, type LucideProps,
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
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1">
        <Link href="/" className="hover:text-[#1d6ac4]">Início</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">Categorias</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Todas as categorias</h1>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1d6ac4] border-t-transparent"/>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="card card-hover flex flex-col items-center gap-3 p-6 text-center group"
            >
              <div className="h-16 w-16 rounded-xl bg-[#e8f0fc] flex items-center justify-center text-[#1d6ac4] group-hover:bg-[#1d6ac4] group-hover:text-white group-hover:scale-110 transition-all duration-200">
                {(() => { const Icon = catIcons[cat.slug] ?? catIcons.default; return <Icon size={32} strokeWidth={1.6} />; })()}
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm">{cat.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {cat.productCount} produto{cat.productCount !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="text-xs text-[#1d6ac4] font-semibold group-hover:underline">Ver produtos →</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
