"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileDown,
  Filter,
  Globe2,
  LoaderCircle,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type SupplierStatus = "ALL" | "ACTIVE" | "INACTIVE";
type Supplier = {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  country: string;
  province: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
type SupplierStats = { total: number; active: number; inactive: number; angola: number; portugal: number };
type SupplierForm = Omit<Supplier, "id" | "createdAt" | "updatedAt">;

const emptyForm: SupplierForm = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  taxId: "",
  country: "Angola",
  province: "",
  city: "",
  address: "",
  notes: "",
  active: true,
};
const pageSize = 20;

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<SupplierStats>({ total: 0, active: 0, inactive: 0, angola: 0, portugal: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SupplierStatus>("ALL");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ search, page: String(page), pageSize: String(pageSize), status });
    fetchWithAuth(`/api/suppliers?${query}`)
      .then((response) => {
        if (!active) return;
        setSuppliers(response.data as Supplier[]);
        setStats(response.stats as SupplierStats);
        setTotal(response.meta.total as number);
        setPageCount(response.meta.pageCount as number || 1);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os fornecedores.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => { active = false; };
  }, [search, status, page, refreshKey]);

  const selected = suppliers.find((supplier) => supplier.id === selectedId) || suppliers[0];

  function refresh() {
    setRefreshing(true);
    setError("");
    setRefreshKey((current) => current + 1);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function startEdit(supplier: Supplier) {
    setSelectedId(supplier.id);
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      contactName: supplier.contactName || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      taxId: supplier.taxId || "",
      country: supplier.country,
      province: supplier.province || "",
      city: supplier.city || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
      active: supplier.active,
    });
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const payload = {
      ...form,
      name: form.name.trim(),
      contactName: form.contactName?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      taxId: form.taxId?.trim() || null,
      country: form.country.trim(),
      province: form.province?.trim() || null,
      city: form.city?.trim() || null,
      address: form.address?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    try {
      const response = await fetchWithAuth(editingId ? `/api/suppliers/${editingId}` : "/api/suppliers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSuccess(editingId ? "Fornecedor atualizado." : "Fornecedor criado.");
      if (!editingId && response.data?.id) setSelectedId(response.data.id as number);
      closeForm();
      setRefreshing(true);
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar o fornecedor.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSupplier(supplier: Supplier) {
    if (!window.confirm(`Excluir o fornecedor “${supplier.name}”? Esta ação não pode ser desfeita.`)) return;
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(`/api/suppliers/${supplier.id}`, { method: "DELETE" });
      setSuccess("Fornecedor excluído.");
      if (selectedId === supplier.id) setSelectedId(null);
      if (suppliers.length === 1 && page > 1) setPage((current) => current - 1);
      else {
        setRefreshing(true);
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o fornecedor.");
    }
  }

  function exportSuppliers() {
    const rows = [
      ["Fornecedor", "NIF", "Contacto", "Email", "Telefone", "País", "Cidade", "Estado"],
      ...suppliers.map((supplier) => [supplier.name, supplier.taxId || "", supplier.contactName || "", supplier.email || "", supplier.phone || "", supplier.country, supplier.city || "", supplier.active ? "Ativo" : "Inativo"]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fornecedores.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const tabs: Array<[string, SupplierStatus]> = [["Todos os fornecedores", "ALL"], ["Ativos", "ACTIVE"], ["Inativos", "INACTIVE"]];
  const menuItems = [[BarChart3, "Visão geral", "/admin"], [ShoppingCart, "Vendas", "/admin/orders"], [PackageCheck, "Produtos", "/admin/products"], [Box, "Gestão de stock", "/admin/stock"], [Users, "Fornecedores", "/admin/suppliers"], [Users, "Clientes", "/admin/clients"], [Users, "Utilizadores", "/admin/users"]] as const;

  return <div className="min-h-screen bg-[#f7f9fc] text-gray-900">
    <header className="border-b border-gray-200 bg-white"><div className="flex h-16 items-center gap-4 px-4 lg:px-6"><Link href="/admin" className="flex items-center gap-2 lg:w-60"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1555d8] text-white"><Building2 size={19} /></span><span className="hidden leading-none sm:block"><strong className="text-base font-black">RUBRICA DILIGENTE (SU), LDA</strong><span className="mt-1 block text-[8px] font-bold uppercase tracking-widest text-[#1555d8]">Painel Administrativo</span></span></Link><div className="relative hidden max-w-xl flex-1 md:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} /><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar fornecedores, NIF, contacto..." className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:bg-white" /></div><div className="ml-auto flex items-center gap-2"><button type="button" onClick={refresh} disabled={refreshing} aria-label="Atualizar fornecedores" title="Atualizar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /></button><button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Notificações"><Bell size={18} /></button><button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Ajuda"><CircleHelp size={18} /></button><div className="hidden h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white sm:flex">JS</div><div className="hidden text-[10px] leading-tight sm:block"><strong className="block">João da Silva</strong><span className="text-gray-500">Administrador</span></div><ChevronDown size={14} className="text-gray-500" /></div></div></header>
    <div className="flex">
      <aside className="hidden min-h-[calc(100vh-64px)] w-60 shrink-0 border-r border-gray-200 bg-[#10233e] text-white lg:block"><div className="border-b border-white/10 px-5 py-5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600"><Building2 size={16} /></div><div><strong className="text-sm">RUBRICA DILIGENTE (SU), LDA</strong><span className="block text-[9px] text-blue-200">Painel Administrativo</span></div></div></div><nav className="space-y-1 p-3 text-xs font-medium">{menuItems.map(([Icon, label, href]) => { const MenuIcon = Icon as typeof Box; return <Link key={label} href={href} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${label === "Fornecedores" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" : "text-blue-50/80 hover:bg-white/10 hover:text-white"}`}><MenuIcon size={15} />{label}</Link>; })}</nav><div className="mx-4 mt-5 rounded-xl bg-blue-900/70 p-3 text-[10px]"><strong className="block text-sm text-white">RUBRICA DILIGENTE (SU), LDA Pro</strong><span className="mt-1 block text-blue-100">Mais ferramentas para o seu negócio.</span></div></aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-360">
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-gray-400"><span>Compras</span><span>›</span><span className="text-blue-600">Fornecedores</span></div><h1 className="text-2xl font-black tracking-tight text-gray-950">Gestão de Fornecedores</h1><p className="mt-1 text-xs text-gray-500">Contactos e dados comerciais dos fornecedores da loja.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportSuppliers} className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-50"><FileDown size={14} />Exportar fornecedores</button><button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"><Plus size={15} />Novo fornecedor</button></div></div>
        {success && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{success}</p>}{error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
        {formOpen && <form onSubmit={saveSupplier} className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black">{editingId ? "Editar fornecedor" : "Novo fornecedor"}</h2><button type="button" onClick={closeForm} aria-label="Fechar formulário" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><X size={16} /></button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Nome da empresa" required value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} /><Field label="Pessoa de contacto" value={form.contactName || ""} onChange={(contactName) => setForm((current) => ({ ...current, contactName }))} /><Field label="NIF" value={form.taxId || ""} onChange={(taxId) => setForm((current) => ({ ...current, taxId }))} /><Field label="Email" type="email" value={form.email || ""} onChange={(email) => setForm((current) => ({ ...current, email }))} /><Field label="Telefone" type="tel" value={form.phone || ""} onChange={(phone) => setForm((current) => ({ ...current, phone }))} /><Field label="País" required value={form.country} onChange={(country) => setForm((current) => ({ ...current, country }))} /><Field label="Província / região" value={form.province || ""} onChange={(province) => setForm((current) => ({ ...current, province }))} /><Field label="Cidade / município" value={form.city || ""} onChange={(city) => setForm((current) => ({ ...current, city }))} /><Field label="Morada" value={form.address || ""} onChange={(address) => setForm((current) => ({ ...current, address }))} /><label className="flex items-center gap-2 self-end pb-2 text-[11px] font-bold text-gray-600"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 accent-blue-600" />Fornecedor ativo</label><label className="text-[11px] font-bold text-gray-600 sm:col-span-2 lg:col-span-3">Notas<textarea value={form.notes || ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500" /></label></div><div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3"><button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : null}{saving ? "A guardar..." : "Guardar fornecedor"}</button></div></form>}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title="Total de fornecedores" value={stats.total.toLocaleString("pt-PT")} detail="registados" icon={Users} tone="bg-blue-50 text-blue-600" /><MetricCard title="Ativos" value={stats.active.toLocaleString("pt-PT")} detail="disponíveis para compras" icon={PackageCheck} tone="bg-emerald-50 text-emerald-600" progress={stats.total ? Math.round(stats.active / stats.total * 100) : 0} /><MetricCard title="Inativos" value={stats.inactive.toLocaleString("pt-PT")} detail="arquivados" icon={AlertTriangle} tone="bg-amber-50 text-amber-600" /><MetricCard title="Em Angola" value={stats.angola.toLocaleString("pt-PT")} detail={`${stats.portugal.toLocaleString("pt-PT")} em Portugal`} icon={Globe2} tone="bg-violet-50 text-violet-600" /></div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><section className="min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm"><div className="flex overflow-x-auto border-b border-gray-200 px-3 pt-2 sm:px-4">{tabs.map(([label, value]) => <button key={value} type="button" onClick={() => { setLoading(true); setStatus(value); setPage(1); }} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold transition ${status === value ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}>{label}</button>)}</div>
            <div className="flex flex-col gap-2 border-b border-gray-100 p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar por empresa, NIF, contacto ou email..." className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500" /></div><button type="button" onClick={refresh} className="rounded-lg border border-gray-200 p-2 text-blue-600 hover:bg-blue-50" aria-label="Atualizar fornecedores"><Filter size={15} /></button></div>
            <div className="overflow-x-auto"><table className="w-full min-w-190 text-left text-xs"><thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-500"><tr><th className="w-8 px-3 py-3"><input type="checkbox" aria-label="Selecionar todos" /></th><th className="px-2 py-3">Fornecedor</th><th className="px-2 py-3">Contacto</th><th className="px-2 py-3">NIF / ID</th><th className="px-2 py-3">País</th><th className="px-2 py-3">Localização</th><th className="px-2 py-3">Estado</th><th className="w-16 px-2 py-3">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{suppliers.map((supplier) => <tr key={supplier.id} onClick={() => setSelectedId(supplier.id)} className={`cursor-pointer transition hover:bg-blue-50/40 ${selected?.id === supplier.id ? "bg-blue-50/60" : ""}`}><td className="px-3 py-3"><input type="checkbox" aria-label={`Selecionar ${supplier.name}`} onClick={(event) => event.stopPropagation()} /></td><td className="px-2 py-2.5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-700">{supplier.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div className="min-w-0"><p className="whitespace-nowrap font-bold text-gray-800">{supplier.name}</p><p className="max-w-37.5 truncate text-[9px] text-gray-400">{supplier.email || "Sem email"}</p></div></div></td><td className="px-2 text-gray-700">{supplier.contactName || supplier.phone || "—"}</td><td className="px-2 font-medium text-gray-600">{supplier.taxId || "—"}</td><td className="px-2 text-gray-600">{supplier.country}</td><td className="px-2 text-gray-600">{[supplier.city, supplier.province].filter(Boolean).join(", ") || "—"}</td><td className="px-2"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${supplier.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-gray-50 text-gray-600 ring-gray-200"}`}>{supplier.active ? "Ativo" : "Inativo"}</span></td><td className="px-2"><div className="flex items-center"><button type="button" onClick={(event) => { event.stopPropagation(); startEdit(supplier); }} className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50" aria-label={`Editar ${supplier.name}`} title="Editar"><Pencil size={14} /></button><button type="button" onClick={(event) => { event.stopPropagation(); void deleteSupplier(supplier); }} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" aria-label={`Excluir ${supplier.name}`} title="Excluir"><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>
            {loading && <div role="status" className="p-8 text-center text-xs text-gray-500">A carregar fornecedores...</div>}{!loading && suppliers.length === 0 && <div className="p-10 text-center text-sm text-gray-500">Nenhum fornecedor encontrado.</div>}
            <div className="flex flex-col justify-between gap-3 border-t border-gray-100 px-4 py-3 text-[10px] font-semibold text-gray-500 sm:flex-row sm:items-center"><span>{total === 0 ? "Sem fornecedores" : `Página ${page} de ${pageCount} · ${total.toLocaleString("pt-PT")} fornecedores`}</span><div className="flex items-center gap-1"><button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={14} /></button><span className="rounded-md bg-blue-600 px-2.5 py-1.5 text-white">{page}</span><button type="button" disabled={page >= pageCount || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-40" aria-label="Página seguinte"><ChevronRight size={14} /></button></div></div>
          </section>
          <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-gray-900">Detalhes do fornecedor</h2>{selected && <button type="button" onClick={() => startEdit(selected)} className="inline-flex items-center gap-1 rounded-md border border-blue-100 px-2 py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50"><Settings size={12} />Editar</button>}</div>{selected ? <><div className="flex h-28 items-center justify-center rounded-lg bg-gray-50 p-3"><Building2 size={34} className="text-blue-600" /></div><h3 className="mt-3 text-sm font-black text-gray-900">{selected.name}</h3><p className="mt-1 text-[10px] text-gray-400">Fornecedor desde {new Date(selected.createdAt).toLocaleDateString("pt-PT")}</p><div className="flex border-b border-gray-100"><span className="border-b-2 border-blue-600 px-3 py-3 text-[10px] font-bold text-blue-600">Informações</span></div><dl className="mt-3 space-y-2 text-[10px]"><Detail label="NIF / ID" value={selected.taxId || "Não registado"} /><Detail label="Pessoa de contacto" value={selected.contactName || "Não indicada"} /><Detail label="Telefone" value={selected.phone || "Não registado"} /><Detail label="Email" value={selected.email || "Não registado"} /><Detail label="País" value={selected.country} /><Detail label="Cidade / província" value={[selected.city, selected.province].filter(Boolean).join(" · ") || "Não indicada"} /><Detail label="Morada" value={selected.address || "Não registada"} /><Detail label="Estado" value={selected.active ? "Ativo" : "Inativo"} />{selected.notes && <Detail label="Notas" value={selected.notes} />}</dl><div className="mt-5 space-y-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => startEdit(selected)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-[10px] font-bold text-white hover:bg-blue-700"><Settings size={13} />Editar fornecedor</button><button type="button" onClick={() => void deleteSupplier(selected)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2 text-[9px] font-bold text-red-600 hover:bg-red-50"><Trash2 size={12} />Excluir fornecedor</button></div></> : <p className="py-10 text-center text-xs text-gray-500">Selecione um fornecedor para ver os detalhes.</p>}</aside>
        </div>
      </div></main>
    </div>
  </div>;
}

function MetricCard({ title, value, detail, icon: Icon, tone, progress }: { title: string; value: string; detail: string; icon: typeof Box; tone: string; progress?: number }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-gray-500">{title}</p><p className="mt-1 text-2xl font-black tracking-tight text-gray-950">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={18} /></span></div><p className="mt-2 text-[10px] font-semibold text-gray-500">{detail}</p>{progress !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div>}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-gray-500">{label}:</dt><dd className="wrap-break-word text-right font-bold">{value}</dd></div>;
}

function Field({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label className="text-[11px] font-bold text-gray-600">{label}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} maxLength={type === "email" ? 254 : 300} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500" /></label>;
}