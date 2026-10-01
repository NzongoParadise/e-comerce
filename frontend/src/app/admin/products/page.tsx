"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, BarChart3, Bell, Box, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, EllipsisVertical, FileDown, Filter, LoaderCircle, Package, PackageCheck, Pencil, Plus, RefreshCw, Search, Settings, ShoppingCart, SlidersHorizontal, Trash2, Truck, Users, X } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { MetricCard } from "@/components/features/admin/MetricCard";

type Market = "AO" | "PT";
type ProductPrice = { market: Market; currency: string; amount: string | number };
type ProductAttribute = { name: string; value: string };
type Product = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  basePrice: string | number;
  imageUrl: string | null;
  stock: number;
  categoryId: number;
  brandId: number;
  category: { id: number; name: string; slug: string };
  brand: { id: number; name: string; slug: string };
  prices: ProductPrice[];
  attributes: ProductAttribute[];
};
type Option = { id: number; name: string; slug: string };
type StockFilter = "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
type ProductStats = { total: number; inStock: number; lowStock: number; outOfStock: number };
type PriceForm = { aoa: string; eur: string };
type ProductForm = {
  name: string;
  slug: string;
  description: string;
  basePrice: string;
  imageUrl: string;
  stock: string;
  categoryId: string;
  brandId: string;
  prices: PriceForm;
  attributes: ProductAttribute[];
};

const initialForm: ProductForm = {
  name: "",
  slug: "",
  description: "",
  basePrice: "",
  imageUrl: "",
  stock: "0",
  categoryId: "",
  brandId: "",
  prices: { aoa: "", eur: "" },
  attributes: [],
};
const pageSize = 20;

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [stats, setStats] = useState<ProductStats>({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0 });
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ search, page: String(page), pageSize: String(pageSize) });
    if (stockFilter !== "ALL") query.set("stockStatus", stockFilter);
    if (categoryFilter) query.set("category", categories.find((category) => String(category.id) === categoryFilter)?.slug || "");
    if (brandFilter) query.set("brand", brands.find((brand) => String(brand.id) === brandFilter)?.slug || "");
    Promise.all([
      fetchWithAuth(`/api/products?${query}`),
      fetchWithAuth("/api/categories"),
      fetchWithAuth("/api/brands"),
    ])
      .then(([productResponse, categoryResponse, brandResponse]) => {
        if (!active) return;
        setProducts(productResponse.data as Product[]);
        setPageCount(productResponse.meta.pageCount as number || Math.ceil((productResponse.meta.total as number) / pageSize) || 1);
        setTotal(productResponse.meta.total as number);
        setStats(productResponse.stats as ProductStats);
        setLowStockThreshold(productResponse.meta.lowStockThreshold as number);
        setCategories(categoryResponse.data as Option[]);
        setBrands(brandResponse.data as Option[]);
        setSelectedId((current) => productResponse.data.some((product: Product) => product.id === current) ? current : (productResponse.data[0]?.id ?? null));
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os produtos.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => { active = false; };
  }, [search, stockFilter, categoryFilter, brandFilter, page, refreshKey]);

  const selected = products.find((product) => product.id === selectedId) || products[0];

  function startCreate() {
    setEditingId(null);
    setSlugManuallyEdited(false);
    setForm(initialForm);
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setSlugManuallyEdited(true);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      basePrice: String(product.basePrice),
      imageUrl: product.imageUrl || "",
      stock: String(product.stock),
      categoryId: String(product.category.id),
      brandId: String(product.brand.id),
      prices: {
        aoa: String(product.prices.find((price) => price.market === "AO")?.amount ?? ""),
        eur: String(product.prices.find((price) => price.market === "PT")?.amount ?? ""),
      },
      attributes: product.attributes.map(({ name, value }) => ({ name, value })),
    });
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setSlugManuallyEdited(false);
    setForm(initialForm);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const prices = [
      form.prices.aoa !== "" ? { market: "AO", currency: "AOA", amount: Number(form.prices.aoa) } : null,
      form.prices.eur !== "" ? { market: "PT", currency: "EUR", amount: Number(form.prices.eur) } : null,
    ].filter((price): price is NonNullable<typeof price> => price !== null);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      basePrice: Number(form.basePrice),
      imageUrl: form.imageUrl.trim() || null,
      stock: Number(form.stock),
      categoryId: Number(form.categoryId),
      brandId: Number(form.brandId),
      prices,
      attributes: form.attributes.filter((attribute) => attribute.name.trim() && attribute.value.trim()).map((attribute) => ({ name: attribute.name.trim(), value: attribute.value.trim() })),
    };
    try {
      const response = await fetchWithAuth(editingId ? `/api/products/${editingId}` : "/api/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSuccess(editingId ? "Produto atualizado." : "Produto criado.");
      if (!editingId && response.data?.id) setSelectedId(response.data.id as number);
      closeForm();
      setRefreshing(true);
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar o produto.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Excluir “${product.name}”? Produtos associados a encomendas ou cotações não podem ser excluídos.`)) return;
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(`/api/products/${product.id}`, { method: "DELETE" });
      setSuccess("Produto excluído.");
      if (selectedId === product.id) setSelectedId(null);
      if (products.length === 1 && page > 1) setPage((current) => current - 1);
      else {
        setRefreshing(true);
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o produto.");
    }
  }

  function refresh() {
    setRefreshing(true);
    setError("");
    setRefreshKey((current) => current + 1);
  }

  function exportProducts() {
    const rows = [
      ["Produto", "Slug", "Categoria", "Marca", "Stock", "Preço AOA", "Preço EUR"],
      ...products.map((product) => [
        product.name,
        product.slug,
        product.category.name,
        product.brand.name,
        String(product.stock),
        String(product.prices.find((price) => price.market === "AO")?.amount ?? ""),
        String(product.prices.find((price) => price.market === "PT")?.amount ?? ""),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "produtos.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const tabs: Array<[string, StockFilter]> = [["Todos os produtos", "ALL"], ["Em stock", "IN_STOCK"], ["Stock baixo", "LOW_STOCK"], ["Sem stock", "OUT_OF_STOCK"]];
  const menuItems = [[BarChart3, "Visão geral", "/admin"], [ShoppingCart, "Vendas", "/admin/orders"], [PackageCheck, "Produtos", "/admin/products"], [Box, "Gestão de stock", "/admin/stock"], [Truck, "Fornecedores", "/admin/suppliers"], [Users, "Clientes", "/admin/clients"], [Users, "Utilizadores", "/admin/users"]] as const;

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-gray-900">
      <header className="border-b border-gray-200 bg-white"><div className="flex h-16 items-center gap-4 px-4 lg:px-6"><Link href="/admin" className="flex items-center gap-2 lg:w-60"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1555d8] text-white"><Box size={19} /></span><span className="hidden leading-none sm:block"><strong className="text-base font-black">RUBRICA DILIGENTE (SU), LDA</strong><span className="mt-1 block text-[8px] font-bold uppercase tracking-widest text-[#1555d8]">Painel Administrativo</span></span></Link><button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden" aria-label="Abrir menu"><SlidersHorizontal size={18} /></button><div className="relative hidden max-w-xl flex-1 md:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} /><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar produtos, categorias, referências..." className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:bg-white" /></div><div className="ml-auto flex items-center gap-2"><button type="button" onClick={refresh} disabled={refreshing} aria-label="Atualizar produtos" title="Atualizar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /></button><button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Notificações"><Bell size={18} /></button><button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Ajuda"><CircleHelp size={18} /></button><div className="hidden h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white sm:flex">JS</div><div className="hidden text-[10px] leading-tight sm:block"><strong className="block">João da Silva</strong><span className="text-gray-500">Administrador</span></div><ChevronDown size={14} className="text-gray-500" /></div></div></header>
      <div className="flex">
        <aside className="hidden min-h-[calc(100vh-64px)] w-60 shrink-0 border-r border-gray-200 bg-[#10233e] text-white lg:block"><div className="border-b border-white/10 px-5 py-5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600"><Box size={16} /></div><div><strong className="text-sm">RUBRICA DILIGENTE (SU), LDA</strong><span className="block text-[9px] text-blue-200">Painel Administrativo</span></div></div></div><nav className="space-y-1 p-3 text-xs font-medium">{[[BarChart3, "Visão geral", "/admin"], [ShoppingCart, "Vendas", "/admin/orders"], [PackageCheck, "Produtos", "/admin/products"], [Box, "Gestão de stock", "/admin/stock"], [Truck, "Fornecedores", "/admin/suppliers"], [Users, "Clientes", "/admin/clients"], [Users, "Utilizadores", "/admin/users"]].map(([Icon, label, href]) => { const MenuIcon = Icon as typeof Box; return <Link key={label as string} href={href as string} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${label === "Produtos" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" : "text-blue-50/80 hover:bg-white/10 hover:text-white"}`}><MenuIcon size={15} />{label as string}</Link>; })}</nav><div className="mx-4 mt-5 rounded-xl bg-blue-900/70 p-3 text-[10px]"><strong className="block text-sm text-white">RUBRICA DILIGENTE (SU), LDA Pro</strong><span className="mt-1 block text-blue-100">Mais ferramentas para o seu negócio.</span></div></aside>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-360">
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-gray-400"><span>Catálogo</span><span>›</span><span className="text-blue-600">Produtos</span></div><h1 className="text-2xl font-black tracking-tight text-gray-950">Gestão de Produtos</h1><p className="mt-1 text-xs text-gray-500">Produtos, preços por mercado, stock e atributos.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportProducts} className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-50"><FileDown size={14} />Exportar produtos</button><button type="button" onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-50 disabled:opacity-50"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Atualizar</button><button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"><Plus size={15} />Novo produto</button></div></div>

        {success && <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
        {error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title="Total de produtos" value={stats.total.toLocaleString("pt-PT")} detail={`${total.toLocaleString("pt-PT")} no filtro atual`} icon={Box} tone="bg-blue-50 text-blue-600" /><MetricCard title="Em stock" value={stats.inStock.toLocaleString("pt-PT")} detail="acima do limiar mínimo" icon={PackageCheck} tone="bg-emerald-50 text-emerald-600" progress={stats.total ? Math.round(stats.inStock / stats.total * 100) : 0} /><MetricCard title="Stock baixo" value={stats.lowStock.toLocaleString("pt-PT")} detail={`1 a ${lowStockThreshold} unidades`} icon={AlertTriangle} tone="bg-amber-50 text-amber-600" progress={stats.total ? Math.round(stats.lowStock / stats.total * 100) : 0} /><MetricCard title="Sem stock" value={stats.outOfStock.toLocaleString("pt-PT")} detail="necessitam reposição" icon={Box} tone="bg-red-50 text-red-600" progress={stats.total ? Math.round(stats.outOfStock / stats.total * 100) : 0} /></div>

        {formOpen && (
          <form onSubmit={saveProduct} className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black">{editingId ? "Editar produto" : "Novo produto"}</h2>
              <button type="button" onClick={closeForm} aria-label="Fechar formulário" title="Fechar" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nome" required value={form.name} onChange={(name) => setForm((current) => ({ ...current, name, slug: slugManuallyEdited ? current.slug : slugify(name) }))} />
              <Field label="Slug" required value={form.slug} onChange={(slug) => { setSlugManuallyEdited(true); setForm((current) => ({ ...current, slug })); }} />
              <Field label="Imagem (URL ou caminho)" value={form.imageUrl} onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))} />
              <NumberField label="Preço base" required min="0" step="0.01" value={form.basePrice} onChange={(basePrice) => setForm((current) => ({ ...current, basePrice }))} />
              <NumberField label="Stock disponível" required min="0" step="1" value={form.stock} onChange={(stock) => setForm((current) => ({ ...current, stock }))} />
              <label className="text-sm font-medium text-slate-700">Categoria *
                <select required value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
                  <option value="">Selecionar categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Marca *
                <select required value={form.brandId} onChange={(event) => setForm((current) => ({ ...current, brandId: event.target.value }))} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
                  <option value="">Selecionar marca</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
              </label>
              <NumberField label="Preço Angola (AOA)" min="0" step="0.01" value={form.prices.aoa} onChange={(aoa) => setForm((current) => ({ ...current, prices: { ...current.prices, aoa } }))} />
              <NumberField label="Preço Portugal (EUR)" min="0" step="0.01" value={form.prices.eur} onChange={(eur) => setForm((current) => ({ ...current, prices: { ...current.prices, eur } }))} />
              <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">Descrição
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={2000} rows={3} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
              </label>
              <div className="sm:col-span-2 lg:col-span-3">
                <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Atributos</h3><button type="button" onClick={() => setForm((current) => ({ ...current, attributes: [...current.attributes, { name: "", value: "" }] }))} className="text-xs font-bold text-blue-700 hover:underline">Adicionar atributo</button></div>
                {form.attributes.map((attribute, index) => <div key={index} className="mb-2 grid grid-cols-[1fr_1fr_40px] gap-2">
                  <input aria-label={`Nome do atributo ${index + 1}`} value={attribute.name} onChange={(event) => setForm((current) => ({ ...current, attributes: current.attributes.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} placeholder="Ex.: Cor" maxLength={80} className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-600" />
                  <input aria-label={`Valor do atributo ${index + 1}`} value={attribute.value} onChange={(event) => setForm((current) => ({ ...current, attributes: current.attributes.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} placeholder="Ex.: Preto" maxLength={160} className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-600" />
                  <button type="button" onClick={() => setForm((current) => ({ ...current, attributes: current.attributes.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Remover atributo ${index + 1}`} title="Remover atributo" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700"><X size={16} /></button>
                </div>)}
              </div>
            </div>
            {(!categories.length || !brands.length) && <p role="alert" className="mt-4 text-sm text-amber-800">Cadastre pelo menos uma categoria e uma marca antes de criar produtos.</p>}
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={closeForm} disabled={saving} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={saving || !categories.length || !brands.length} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
                {saving ? <LoaderCircle size={16} className="animate-spin" /> : null}{saving ? "A guardar..." : "Guardar produto"}
              </button>
            </div>
          </form>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><section aria-label="Lista de produtos" className="min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex overflow-x-auto border-b border-gray-200 px-3 pt-2 sm:px-4">{tabs.map(([label, value]) => <button key={value} type="button" onClick={() => { setLoading(true); setStockFilter(value); setPage(1); }} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold transition ${stockFilter === value ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}>{label}</button>)}</div>
          <div className="flex flex-col gap-2 border-b border-gray-100 p-3 sm:flex-row">
            <label className="relative flex-1"><Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="search" value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar nome, slug ou descrição" className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500" /></label>
            <select aria-label="Filtrar categoria" value={categoryFilter} onChange={(event) => { setLoading(true); setCategoryFilter(event.target.value); setPage(1); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-semibold text-gray-600"><option value="">Todas as categorias</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <select aria-label="Filtrar marca" value={brandFilter} onChange={(event) => { setLoading(true); setBrandFilter(event.target.value); setPage(1); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-semibold text-gray-600"><option value="">Todas as marcas</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
            <button type="button" onClick={() => { setLoading(true); setSearch(""); setStockFilter("ALL"); setCategoryFilter(""); setBrandFilter(""); setPage(1); }} className="rounded-lg border border-gray-200 p-2 text-blue-600 hover:bg-blue-50" aria-label="Limpar filtros"><Filter size={15} /></button>
          </div>
          {loading ? <p role="status" className="py-14 text-center text-sm text-slate-500">A carregar produtos...</p> : products.length === 0 ? (
            <div className="px-4 py-14 text-center sm:px-6"><Package size={26} className="mx-auto text-slate-400" /><p className="mt-3 text-sm font-semibold">{search ? "Nenhum produto corresponde à pesquisa." : "Ainda não existem produtos."}</p>{!search && <button type="button" onClick={startCreate} className="mt-3 text-sm font-bold text-blue-700 hover:underline">Adicionar o primeiro produto</button>}</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-190 text-left text-sm">
              <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-500"><tr><th className="px-2 py-3">Produto</th><th className="px-2 py-3">Referência</th><th className="px-2 py-3">Categoria</th><th className="px-2 py-3">Marca</th><th className="px-2 py-3">Preço (AOA)</th><th className="px-2 py-3">Stock</th><th className="px-2 py-3">Estado</th><th className="px-2 py-3 text-right">Ações</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{products.map((product) => {
                const aoPrice = product.prices.find((price) => price.market === "AO")?.amount;
                const statusLabel = product.stock === 0 ? "Sem stock" : product.stock <= lowStockThreshold ? "Stock baixo" : "Em stock";
                const statusClass = product.stock === 0 ? "bg-red-50 text-red-700 ring-red-200" : product.stock <= lowStockThreshold ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200";
                return <tr key={product.id} onClick={() => setSelectedId(product.id)} className={`cursor-pointer transition hover:bg-blue-50/40 ${selected?.id === product.id ? "bg-blue-50/60" : ""}`}>
                  <td className="px-2 py-2.5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 p-1"><Package size={16} className="text-gray-500" /></div><span className="whitespace-nowrap font-bold text-gray-800">{product.name}</span></div></td>
                  <td className="px-2 font-medium text-gray-500">{product.slug}</td>
                  <td className="px-2 text-gray-600">{product.category.name}</td>
                  <td className="px-2 text-gray-600">{product.brand.name}</td>
                  <td className="px-2 font-bold text-gray-800">{aoPrice === undefined ? "—" : Number(aoPrice).toLocaleString("pt-AO")}</td>
                  <td className="px-2 font-bold text-gray-800">{product.stock}</td>
                  <td className="px-2"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${statusClass}`}>{statusLabel}</span></td>
                  <td className="px-2"><div className="flex justify-end gap-1"><button type="button" onClick={(event) => { event.stopPropagation(); startEdit(product); }} title="Editar produto" aria-label={`Editar ${product.name}`} className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50"><Pencil size={14} /></button><button type="button" onClick={(event) => { event.stopPropagation(); void deleteProduct(product); }} title="Excluir produto" aria-label={`Excluir ${product.name}`} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button></div></td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-6"><p className="text-xs text-slate-500">Página {page} de {pageCount}</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} aria-label="Página anterior" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={17} /></button><button type="button" disabled={page >= pageCount || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} aria-label="Página seguinte" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={17} /></button></div></div>
        </section>
        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-gray-900">Detalhes do produto</h2>{selected && <button type="button" onClick={() => startEdit(selected)} className="inline-flex items-center gap-1 rounded-md border border-blue-100 px-2 py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50"><Settings size={12} />Editar</button>}</div>{selected ? <><div className="flex h-28 items-center justify-center rounded-lg bg-gray-50 p-3">{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} className="h-full max-w-42.5 object-contain" /> : <Package size={30} className="text-gray-400" />}</div><h3 className="mt-3 text-sm font-black text-gray-900">{selected.name}</h3><p className="text-[10px] text-gray-400">/{selected.slug}</p><dl className="mt-3 space-y-2 text-[10px]"><Detail label="Categoria" value={selected.category.name} /><Detail label="Marca" value={selected.brand.name} /><Detail label="Preço base" value={`${Number(selected.basePrice).toLocaleString("pt-AO")} Kz`} /><Detail label="Preço Angola" value={selected.prices.find((price) => price.market === "AO") ? `${Number(selected.prices.find((price) => price.market === "AO")?.amount).toLocaleString("pt-AO")} Kz` : "Não definido"} /><Detail label="Preço Portugal" value={selected.prices.find((price) => price.market === "PT") ? `€ ${Number(selected.prices.find((price) => price.market === "PT")?.amount).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}` : "Não definido"} /><Detail label="Stock atual" value={`${selected.stock} unidades`} /><Detail label="Estado" value={selected.stock === 0 ? "Sem stock" : selected.stock <= lowStockThreshold ? "Stock baixo" : "Em stock"} /></dl><div className="mt-5 space-y-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => startEdit(selected)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-[10px] font-bold text-white hover:bg-blue-700"><Settings size={13} />Editar produto</button><div className="grid grid-cols-2 gap-2"><Link href={`/products/${selected.slug}`} className="flex items-center justify-center gap-1 rounded-lg border border-blue-200 py-2 text-[9px] font-bold text-blue-600"><Package size={12} />Ver produto</Link><button type="button" onClick={() => void deleteProduct(selected)} className="flex items-center justify-center gap-1 rounded-lg border border-red-200 py-2 text-[9px] font-bold text-red-600"><Trash2 size={12} />Excluir</button></div></div><div className="mt-4 border-t border-gray-100 pt-3"><h4 className="text-[10px] font-black uppercase text-gray-500">Atributos</h4>{selected.attributes.length ? <dl className="mt-2 space-y-2 text-[10px]">{selected.attributes.map((attribute) => <Detail key={`${attribute.name}-${attribute.value}`} label={attribute.name} value={attribute.value} />)}</dl> : <p className="mt-2 text-[10px] text-gray-400">Sem atributos</p>}</div></> : <p className="py-10 text-center text-xs text-gray-500">Selecione um produto para ver os detalhes.</p>}</aside>
        </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-gray-500">{label}:</dt><dd className="text-right font-bold">{value}</dd></div>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-sm font-medium text-slate-700">{label}{required ? " *" : ""}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} maxLength={type === "number" ? undefined : 500} className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>;
}

function NumberField({ label, value, onChange, min, step, required = false }: { label: string; value: string; onChange: (value: string) => void; min: string; step: string; required?: boolean }) {
  return <label className="text-sm font-medium text-slate-700">{label}{required ? " *" : ""}<input type="number" value={value} onChange={(event) => onChange(event.target.value)} min={min} step={step} required={required} className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>;
}