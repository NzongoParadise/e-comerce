"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  BarChart3,
  Bell,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  EllipsisVertical,
  FileDown,
  Filter,
  LoaderCircle,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
  RefreshCw,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type StockStatus = "Em stock" | "Stock baixo" | "Sem stock";
type StockFilter = "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
type InventoryItem = {
  id: number;
  name: string;
  reference: string;
  slug: string;
  categoryId: number;
  category: string;
  brandId: number;
  brand: string;
  stock: number;
  minimum: number;
  price: string | number;
  status: StockStatus;
  image: string | null;
};
type FilterOption = { id: number; name: string };
type InventoryStats = { total: number; inStock: number; lowStock: number; outOfStock: number; units: number };
type NewProductForm = { name: string; slug: string; categoryId: string; brandId: string; stock: string; priceAOA: string; priceEUR: string; imageUrl: string };
type MovementForm = { product: InventoryItem; action: "IN" | "OUT" | "SET" };

const emptyProduct: NewProductForm = { name: "", slug: "", categoryId: "", brandId: "", stock: "0", priceAOA: "", priceEUR: "", imageUrl: "" };
const pageSize = 20;
const statusStyles: Record<StockStatus, string> = {
  "Em stock": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Stock baixo": "bg-amber-50 text-amber-700 ring-amber-200",
  "Sem stock": "bg-red-50 text-red-700 ring-red-200",
};

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function StockPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats>({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0, units: 0 });
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [brands, setBrands] = useState<FilterOption[]>([]);
  const [threshold, setThreshold] = useState(5);
  const [activeTab, setActiveTab] = useState<StockFilter>("ALL");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [productForm, setProductForm] = useState<NewProductForm>(emptyProduct);
  const newProduct = productForm;
  const setNewProduct = setProductForm;
  const [movement, setMovement] = useState<MovementForm | null>(null);
  const [movementQuantity, setMovementQuantity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ search, status: activeTab, page: String(page), pageSize: String(pageSize) });
    if (categoryId) query.set("categoryId", categoryId);
    if (brandId) query.set("brandId", brandId);
    fetchWithAuth(`/api/admin/stock?${query}`)
      .then((response) => {
        if (!active) return;
        setInventory(response.data as InventoryItem[]);
        setStats(response.stats as InventoryStats);
        setCategories(response.filters.categories as FilterOption[]);
        setBrands(response.filters.brands as FilterOption[]);
        setThreshold(response.meta.lowStockThreshold as number);
        setTotal(response.meta.total as number);
        setPageCount(response.meta.pageCount as number || 1);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o inventário.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => { active = false; };
  }, [search, categoryId, brandId, activeTab, page, refreshKey]);

  const selected = inventory.find((item) => item.id === selectedId) || inventory[0];

  function refresh() {
    setRefreshing(true);
    setError("");
    setRefreshKey((current) => current + 1);
  }

  function startCreate() {
    setProductForm(emptyProduct);
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function closeProductForm() {
    setFormOpen(false);
    setProductForm(emptyProduct);
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetchWithAuth("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: productForm.name.trim(),
          slug: productForm.slug.trim(),
          categoryId: Number(productForm.categoryId),
          brandId: Number(productForm.brandId),
          stock: Number(productForm.stock),
          amountAOA: Number(productForm.priceAOA),
          amountEUR: Number(productForm.priceEUR),
          imageUrl: productForm.imageUrl.trim() || null,
        }),
      });
      setSuccess("Produto adicionado ao inventário.");
      setSelectedId(response.data.id as number);
      closeProductForm();
      setRefreshing(true);
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível criar o produto.");
    } finally {
      setSaving(false);
    }
  }

  function openMovement(item: InventoryItem, action: MovementForm["action"]) {
    setMovement({ product: item, action });
    setMovementQuantity(action === "SET" ? String(item.stock) : "");
    setError("");
    setSuccess("");
  }

  async function saveMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movement) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(`/api/admin/stock/${movement.product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: movement.action, quantity: Number(movementQuantity) }),
      });
      setSuccess(movement.action === "IN" ? "Entrada de stock registada." : movement.action === "OUT" ? "Saída de stock registada." : "Stock ajustado.");
      setMovement(null);
      setRefreshing(true);
      setRefreshKey((current) => current + 1);
    } catch (movementError) {
      setError(movementError instanceof Error ? movementError.message : "Não foi possível atualizar o stock.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(item: InventoryItem) {
    if (!window.confirm(`Excluir “${item.name}” do catálogo e inventário? Produtos associados a encomendas ou cotações não podem ser excluídos.`)) return;
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(`/api/admin/stock/${item.id}`, { method: "DELETE" });
      setSuccess("Produto excluído do inventário.");
      if (selectedId === item.id) setSelectedId(null);
      if (inventory.length === 1 && page > 1) setPage((current) => current - 1);
      else {
        setRefreshing(true);
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o produto.");
    }
  }

  function exportStock() {
    const rows = [
      ["Produto", "Referência", "Categoria", "Marca", "Stock", "Mínimo", "Preço AOA"],
      ...inventory.map((item) => [item.name, item.reference, item.category, item.brand, String(item.stock), String(item.minimum), String(item.price)]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "inventario.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const tabs: Array<[string, StockFilter]> = [["Todos os produtos", "ALL"], ["Stock baixo", "LOW_STOCK"], ["Sem stock", "OUT_OF_STOCK"]];

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-gray-900">
      <header className="border-b border-gray-200 bg-white"><div className="flex h-16 items-center gap-4 px-4 lg:px-6"><div className="flex items-center gap-2 lg:w-60"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1555d8] text-white"><Box size={19} /></div><div className="hidden leading-none sm:block"><strong className="text-base font-black">TechGlobal</strong><span className="mt-1 block text-[8px] font-bold uppercase tracking-widest text-[#1555d8]">Painel Administrativo</span></div></div><button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden" aria-label="Abrir menu"><SlidersHorizontal size={18} /></button><div className="relative hidden max-w-xl flex-1 md:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} /><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar produtos, categorias, referências..." className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:bg-white" /></div><div className="ml-auto flex items-center gap-2"><button type="button" onClick={refresh} disabled={refreshing} aria-label="Atualizar inventário" title="Atualizar inventário" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /></button><button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Notificações"><Bell size={18} /></button><button className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 sm:block" aria-label="Mensagens"><CircleHelp size={18} /></button><div className="ml-1 hidden h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white sm:flex">JS</div><div className="hidden text-left text-[10px] leading-tight sm:block"><strong className="block">João da Silva</strong><span className="text-gray-500">Administrador</span></div><ChevronDown size={14} className="text-gray-500" /></div></div></header>
      <div className="flex"><aside className="hidden min-h-[calc(100vh-64px)] w-60 shrink-0 border-r border-gray-200 bg-[#10233e] text-white lg:block"><div className="border-b border-white/10 px-5 py-5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600"><Box size={16} /></div><div><strong className="text-sm">TechGlobal</strong><span className="block text-[9px] text-blue-200">Painel Administrativo</span></div></div></div><nav className="space-y-1 p-3 text-xs font-medium">{[[BarChart3, "Visão geral", "/admin"], [ShoppingCart, "Vendas", "/admin/orders"], [PackageCheck, "Produtos", "/admin/products"], [Box, "Gestão de stock", "/admin/stock"], [Users, "Fornecedores", "/admin/suppliers"], [Users, "Clientes", "/admin/clients"], [Users, "Utilizadores", "/admin/users"]].map(([Icon, label, href]) => { const MenuIcon = Icon as typeof Box; return <a key={label as string} href={href as string} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${label === "Gestão de stock" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" : "text-blue-50/80 hover:bg-white/10 hover:text-white"}`}><MenuIcon size={15} />{label as string}</a>; })}</nav><div className="mx-4 mt-5 rounded-xl bg-blue-900/70 p-3 text-[10px]"><strong className="block text-sm text-white">TechGlobal Pro</strong><span className="mt-1 block text-blue-100">Mais ferramentas para o seu negócio.</span><button className="mt-3 w-full rounded-md bg-blue-600 py-2 font-bold text-white">Saber mais</button></div></aside>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-360">
          <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-gray-400"><span>Gestão de stock</span><span>›</span><span className="text-blue-600">Produtos</span></div><h1 className="text-2xl font-black tracking-tight text-gray-950">Gestão de Stock</h1><p className="mt-1 text-xs text-gray-500">Inventário real por produto. Stock baixo definido como {threshold} unidade(s) ou menos.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportStock} className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-50"><FileDown size={14} />Exportar stock</button><button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"><Plus size={15} />Novo produto</button></div></div>
          {success && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{success}</p>}{error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
          {formOpen && <form onSubmit={createProduct} className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black">Novo produto no inventário</h2><button type="button" onClick={() => setFormOpen(false)} aria-label="Fechar formulário" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><X size={16} /></button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Nome do produto" required value={newProduct.name} onChange={(name) => setNewProduct((current) => ({ ...current, name, slug: current.slug || slugify(name) }))} /><Field label="Referência / slug" required value={newProduct.slug} onChange={(slug) => setNewProduct((current) => ({ ...current, slug }))} /><label className="text-[11px] font-bold text-gray-600">Categoria<select required value={newProduct.categoryId} onChange={(event) => setNewProduct((current) => ({ ...current, categoryId: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-normal"><option value="">Selecionar</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-[11px] font-bold text-gray-600">Marca<select required value={newProduct.brandId} onChange={(event) => setNewProduct((current) => ({ ...current, brandId: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-normal"><option value="">Selecionar</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><NumberField label="Stock inicial" min="0" step="1" value={newProduct.stock} onChange={(stock) => setNewProduct((current) => ({ ...current, stock }))} /><NumberField label="Preço Angola (AOA)" min="0" step="0.01" value={newProduct.priceAOA} onChange={(priceAOA) => setNewProduct((current) => ({ ...current, priceAOA }))} /><NumberField label="Preço Portugal (EUR)" min="0" step="0.01" value={newProduct.priceEUR} onChange={(priceEUR) => setNewProduct((current) => ({ ...current, priceEUR }))} /><Field label="Imagem (URL)" value={newProduct.imageUrl} onChange={(imageUrl) => setNewProduct((current) => ({ ...current, imageUrl }))} /></div><div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3"><button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600">Cancelar</button><button type="submit" disabled={saving || !categories.length || !brands.length} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : null}{saving ? "A guardar..." : "Guardar produto"}</button></div></form>}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title="Total de produtos" value={stats.total.toLocaleString("pt-PT")} detail={`${stats.units.toLocaleString("pt-PT")} unidades registadas`} icon={Box} tone="bg-blue-50 text-blue-600" /><MetricCard title="Em stock" value={stats.inStock.toLocaleString("pt-PT")} detail="acima do limiar mínimo" icon={PackageCheck} tone="bg-emerald-50 text-emerald-600" progress={stats.total ? Math.round(stats.inStock / stats.total * 100) : 0} /><MetricCard title="Stock baixo" value={stats.lowStock.toLocaleString("pt-PT")} detail={`1 a ${threshold} unidades`} icon={AlertTriangle} tone="bg-amber-50 text-amber-600" progress={stats.total ? Math.round(stats.lowStock / stats.total * 100) : 0} /><MetricCard title="Sem stock" value={stats.outOfStock.toLocaleString("pt-PT")} detail="necessitam reposição" icon={Box} tone="bg-red-50 text-red-600" progress={stats.total ? Math.round(stats.outOfStock / stats.total * 100) : 0} /></div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><section className="min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm"><div className="flex overflow-x-auto border-b border-gray-200 px-3 pt-2 sm:px-4">{tabs.map(([label, status]) => <button key={status} type="button" onClick={() => { setLoading(true); setActiveTab(status); setPage(1); }} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold transition ${activeTab === status ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}>{label}</button>)}</div>
            <div className="flex flex-col gap-2 border-b border-gray-100 p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar por nome ou referência..." className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500" /></div><select aria-label="Filtrar categoria" value={categoryId} onChange={(event) => { setLoading(true); setCategoryId(event.target.value); setPage(1); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-semibold text-gray-600"><option value="">Todas as categorias</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select aria-label="Filtrar marca" value={brandId} onChange={(event) => { setLoading(true); setBrandId(event.target.value); setPage(1); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-semibold text-gray-600"><option value="">Todas as marcas</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><button type="button" onClick={refresh} className="rounded-lg border border-gray-200 p-2 text-blue-600 hover:bg-blue-50" aria-label="Atualizar inventário"><Filter size={15} /></button></div>
            <div className="overflow-x-auto"><table className="w-full min-w-190 text-left text-xs"><thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-500"><tr><th className="w-8 px-3 py-3"><input type="checkbox" aria-label="Selecionar todos" /></th><th className="px-2 py-3">Produto</th><th className="px-2 py-3">Referência</th><th className="px-2 py-3">Categoria</th><th className="px-2 py-3">Stock</th><th className="px-2 py-3">Stock mín.</th><th className="px-2 py-3">Preço (Kz)</th><th className="px-2 py-3">Estado</th><th className="w-10 px-2 py-3">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{inventory.map((item) => <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer transition hover:bg-blue-50/40 ${selected?.id === item.id ? "bg-blue-50/60" : ""}`}><td className="px-3 py-3"><input type="checkbox" aria-label={`Selecionar ${item.name}`} onClick={(event) => event.stopPropagation()} /></td><td className="px-2 py-2.5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 p-1">{item.image ? <img src={item.image} alt="" className="h-full w-full object-contain" /> : <Box size={16} className="text-gray-400" />}</div><span className="whitespace-nowrap font-bold text-gray-800">{item.name}</span></div></td><td className="px-2 font-medium text-gray-500">{item.reference}</td><td className="px-2 text-gray-600">{item.category}</td><td className="px-2 font-bold text-gray-800">{item.stock}</td><td className="px-2 text-gray-600">{item.minimum}</td><td className="px-2 font-bold text-gray-800">{Number(item.price).toLocaleString("pt-AO")}</td><td className="px-2"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyles[item.status]}`}>{item.status}</span></td><td className="px-2"><div className="flex items-center"><button type="button" onClick={(event) => { event.stopPropagation(); openMovement(item, "IN"); }} className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50" aria-label={`Entrada de stock para ${item.name}`} title="Entrada"><ArrowDownToLine size={14} /></button><button type="button" onClick={(event) => { event.stopPropagation(); openMovement(item, "OUT"); }} className="rounded-md p-1.5 text-amber-700 hover:bg-amber-50" aria-label={`Saída de stock para ${item.name}`} title="Saída"><ArrowUpToLine size={14} /></button><button type="button" onClick={(event) => { event.stopPropagation(); openMovement(item, "SET"); }} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" aria-label={`Ajustar stock de ${item.name}`} title="Ajustar"><EllipsisVertical size={15} /></button></div></td></tr>)}</tbody></table></div>
            {loading && <div role="status" className="p-8 text-center text-xs text-gray-500">A carregar inventário...</div>}{!loading && inventory.length === 0 && <div className="p-10 text-center text-sm text-gray-500">Nenhum produto encontrado.</div>}
            <div className="flex flex-col justify-between gap-3 border-t border-gray-100 px-4 py-3 text-[10px] font-semibold text-gray-500 sm:flex-row sm:items-center"><span>{total === 0 ? "Sem produtos" : `Página ${page} de ${pageCount} · ${total.toLocaleString("pt-PT")} produtos`}</span><div className="flex items-center gap-1"><button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={14} /></button><span className="rounded-md bg-blue-600 px-2.5 py-1.5 text-white">{page}</span><button type="button" disabled={page >= pageCount || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-40" aria-label="Página seguinte"><ChevronRight size={14} /></button></div></div>
          </section>
          <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-gray-900">Detalhes do produto</h2>{selected && <button type="button" onClick={() => void deleteProduct(selected)} className="inline-flex items-center gap-1 rounded-md border border-red-100 px-2 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50"><Trash2 size={12} />Excluir</button>}</div>{selected ? <><div className="flex h-28 items-center justify-center rounded-lg bg-gray-50 p-3">{selected.image ? <img src={selected.image} alt={selected.name} className="h-full max-w-42.5 object-contain" /> : <Box size={28} className="text-gray-400" />}</div><h3 className="mt-3 text-sm font-black text-gray-900">{selected.name}</h3><dl className="mt-3 space-y-2 text-[10px]"><Detail label="Referência" value={selected.reference} /><Detail label="Categoria" value={selected.category} /><Detail label="Marca" value={selected.brand} /><Detail label="Preço" value={`${Number(selected.price).toLocaleString("pt-AO")} Kz`} /><Detail label="Stock atual" value={`${selected.stock} unidades`} /><Detail label="Stock mínimo" value={`${selected.minimum} unidades (global)`} /><Detail label="Estado" value={selected.status} /></dl><div className="mt-5 space-y-2 border-t border-gray-100 pt-4"><Link href="/admin/products" className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 py-2.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50"><Settings size={13} />Editar produto</Link><button type="button" onClick={() => openMovement(selected, "IN")} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-[10px] font-bold text-white hover:bg-blue-700"><ArrowDownToLine size={13} />Registar entrada</button><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => openMovement(selected, "OUT")} className="flex items-center justify-center gap-1 rounded-lg border border-blue-200 py-2 text-[9px] font-bold text-blue-600"><ArrowUpToLine size={12} />Registar saída</button><button type="button" onClick={() => openMovement(selected, "SET")} className="flex items-center justify-center gap-1 rounded-lg border border-blue-200 py-2 text-[9px] font-bold text-blue-600"><Settings size={12} />Ajustar stock</button></div></div></> : <p className="py-10 text-center text-xs text-gray-500">Selecione um produto para ver os detalhes.</p>}</aside>
          </div>
        </div></main>
      </div>
      {movement && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4"><form onSubmit={saveMovement} className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black">{movement.action === "IN" ? "Entrada de stock" : movement.action === "OUT" ? "Saída de stock" : "Ajuste de stock"}</h2><button type="button" onClick={() => setMovement(null)} aria-label="Fechar" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><X size={16} /></button></div><p className="mb-4 text-xs text-gray-600">{movement.product.name} · stock atual {movement.product.stock}</p><label className="block text-[11px] font-bold text-gray-600">{movement.action === "SET" ? "Novo stock total" : "Quantidade"}<input required type="number" min={movement.action === "SET" ? 0 : 1} max={1_000_000} step="1" value={movementQuantity} onChange={(event) => setMovementQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500" /></label><div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-3"><button type="button" onClick={() => setMovement(null)} disabled={saving} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : null}{saving ? "A guardar..." : "Confirmar movimento"}</button></div></form></div>}
    </div>
  );
}

function MetricCard({ title, value, detail, icon: Icon, tone, progress }: { title: string; value: string; detail: string; icon: typeof Box; tone: string; progress?: number }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-gray-500">{title}</p><p className="mt-1 text-2xl font-black tracking-tight text-gray-950">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={18} /></span></div><p className="mt-2 text-[10px] font-semibold text-gray-500">{detail}</p>{progress !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div>}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-gray-500">{label}:</dt><dd className="text-right font-bold">{value}</dd></div>;
}

function Field({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="text-[11px] font-bold text-gray-600">{label}<input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500" /></label>;
}

function NumberField({ label, value, onChange, min, step }: { label: string; value: string; onChange: (value: string) => void; min: string; step: string }) {
  return <label className="text-[11px] font-bold text-gray-600">{label}<input required type="number" min={min} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500" /></label>;
}