"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  EllipsisVertical,
  FileDown,
  Filter,
  Globe2,
  Mail,
  MapPin,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  UserRound,
  Users,
  X,
  Pencil,
  Trash2,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type AccountType = "B2B" | "B2C";
type AccountFilter = "ALL" | AccountType;
type ClientCountry = "AO" | "PT" | "UNKNOWN";
type Client = {
  id: number;
  name: string | null;
  email: string | null;
  accountName: string;
  accountType: string;
  status: string;
  createdAt: string;
  lastLoginAt: string;
  addresses: Array<{ phone: string; country: string; city: string; province: string }>;
  _count: { orders: number };
};
type ClientForm = { name: string; email: string; accountType: AccountType; accountName: string; password: string };
type ClientStats = { total: number; b2b: number; b2c: number; active: number };

const emptyForm: ClientForm = { name: "", email: "", accountType: "B2C", accountName: "", password: "" };
const pageSize = 20;
const typeStyles: Record<AccountType, string> = { B2B: "bg-blue-50 text-blue-700", B2C: "bg-indigo-50 text-indigo-700" };
const flag: Record<ClientCountry, string> = { AO: "🇦🇴", PT: "🇵🇹", UNKNOWN: "—" };
function initials(client: Client) {
  return (client.name || client.accountName).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function clientCountry(client: Client): ClientCountry {
  const country = client.addresses[0]?.country.toLowerCase();
  if (country?.startsWith("portugal")) return "PT";
  if (country?.startsWith("angola")) return "AO";
  return "UNKNOWN";
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<ClientStats>({ total: 0, b2b: 0, b2c: 0, active: 0 });
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("ALL");
  const [countryFilter, setCountryFilter] = useState<"ALL" | "AO" | "PT">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [newOnly, setNewOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
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
    const query = new URLSearchParams({ search, page: String(page), pageSize: String(pageSize), newOnly: String(newOnly) });
    if (accountFilter !== "ALL") query.set("accountType", accountFilter);
    if (countryFilter !== "ALL") query.set("country", countryFilter);
    if (statusFilter !== "ALL") query.set("status", statusFilter);
    fetchWithAuth(`/api/admin/clients?${query}`)
      .then((response) => {
        if (!active) return;
        setClients(response.data as Client[]);
        setTotal(response.meta.total as number);
        setPageCount(response.meta.pageCount as number || 1);
        setStats(response.stats as ClientStats);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os clientes.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => { active = false; };
  }, [search, accountFilter, countryFilter, statusFilter, newOnly, page, refreshKey]);

  const selected = clients.find((client) => client.id === selectedId) || clients[0];
  const activeTab = newOnly ? "Novos clientes" : accountFilter === "B2B" ? "B2B (Empresas)" : accountFilter === "B2C" ? "Retalho" : "Todos";

  function changeTab(tab: string) {
    setLoading(true);
    setPage(1);
    setNewOnly(tab === "Novos clientes");
    setAccountFilter(tab === "B2B (Empresas)" ? "B2B" : tab === "Retalho" ? "B2C" : "ALL");
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function startEdit(client: Client) {
    setSelectedId(client.id);
    setEditingId(client.id);
    setForm({ name: client.name || "", email: client.email || "", accountType: client.accountType === "B2B" ? "B2B" : "B2C", accountName: client.accountName, password: "" });
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      accountType: form.accountType,
      ...(form.accountName.trim() ? { accountName: form.accountName.trim() } : {}),
      ...(!editingId ? { password: form.password } : {}),
    };
    try {
      const response = await fetchWithAuth(editingId ? `/api/admin/clients/${editingId}` : "/api/admin/clients", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSuccess(editingId ? "Cliente atualizado." : "Conta de cliente criada.");
      if (!editingId && response.data?.id) setSelectedId(response.data.id as number);
      closeForm();
      setRefreshing(true);
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar o cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient(client: Client) {
    if (!window.confirm(`Excluir a conta de ${client.name || client.email}? Contas com encomendas ou cotações não podem ser excluídas.`)) return;
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(`/api/admin/clients/${client.id}`, { method: "DELETE" });
      setSuccess("Cliente excluído.");
      if (selectedId === client.id) setSelectedId(null);
      if (clients.length === 1 && page > 1) setPage((current) => current - 1);
      else {
        setRefreshing(true);
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o cliente.");
    }
  }

  function refresh() {
    setRefreshing(true);
    setError("");
    setRefreshKey((current) => current + 1);
  }

  function exportClients() {
    const rows = [
      ["Nome", "Email", "Tipo", "Conta", "Estado", "Encomendas"],
      ...clients.map((client) => [client.name || "", client.email || "", client.accountType, client.accountName, client.status, String(client._count.orders)]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "clientes.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const menuItems = [[BarChart3, "Visão geral", "/admin"], [ShoppingBag, "Vendas", "/admin/orders"], [Package, "Produtos", "/admin/products"], [Package, "Gestão de stock", "/admin/stock"], [Users, "Clientes", "/admin/clients"], [Building2, "Fornecedores", "/admin/suppliers"], [Users, "Utilizadores", "/admin/users"]] as const;

  return <div className="min-h-screen bg-[#f7f9fc] text-gray-900">
    <header className="border-b border-gray-200 bg-white"><div className="flex h-16 items-center gap-4 px-4 lg:px-6"><Link href="/admin" className="flex items-center gap-2 lg:w-60"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1555d8] text-white"><Building2 size={18} /></span><span className="hidden leading-none sm:block"><strong className="text-base font-black">TechGlobal</strong><span className="mt-1 block text-[8px] font-bold uppercase tracking-widest text-[#1555d8]">Painel Administrativo</span></span></Link><div className="relative hidden max-w-xl flex-1 md:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} /><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar clientes, empresa ou email..." className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:bg-white" /></div><div className="ml-auto flex items-center gap-2"><button type="button" onClick={refresh} disabled={refreshing} title="Atualizar clientes" aria-label="Atualizar clientes" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /></button><button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Notificações"><Bell size={18} /></button><button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Ajuda"><CircleHelp size={18} /></button><div className="hidden h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white sm:flex">JS</div><div className="hidden text-[10px] leading-tight sm:block"><strong className="block">João da Silva</strong><span className="text-gray-500">Administrador</span></div><ChevronDown size={14} className="text-gray-500" /></div></div></header>
    <div className="flex">
      <aside className="hidden min-h-[calc(100vh-64px)] w-60 shrink-0 border-r border-gray-200 bg-[#10233e] text-white lg:block"><div className="border-b border-white/10 px-5 py-5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600"><Building2 size={16} /></div><div><strong className="text-sm">TechGlobal</strong><span className="block text-[9px] text-blue-200">Painel Administrativo</span></div></div></div><nav className="space-y-1 p-3 text-xs font-medium">{menuItems.map(([Icon, label, href]) => <Link key={label} href={href} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${label === "Clientes" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" : "text-blue-50/80 hover:bg-white/10 hover:text-white"}`}><Icon size={15} />{label}</Link>)}</nav><div className="mx-4 mt-5 rounded-xl bg-blue-900/70 p-3 text-[10px]"><strong className="block text-sm text-white">TechGlobal Pro</strong><span className="mt-1 block text-blue-100">Mais ferramentas para o seu negócio.</span></div></aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-360">
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-gray-400"><span>Clientes</span><span>›</span><span className="text-blue-600">Gestão de clientes</span></div><h1 className="text-2xl font-black tracking-tight">Gestão de Clientes</h1><p className="mt-1 text-xs text-gray-500">Gerencie as contas B2C e B2B da loja.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportClients} className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm"><FileDown size={14} />Exportar</button><button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm"><Plus size={15} />Novo cliente</button></div></div>
        {success && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{success}</p>}{error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
        {formOpen && <form onSubmit={saveClient} className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black">{editingId ? "Editar cliente" : "Novo cliente"}</h2><button type="button" onClick={closeForm} aria-label="Fechar formulário" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><X size={16} /></button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-[11px] font-bold text-gray-600">Nome<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500" /></label><label className="text-[11px] font-bold text-gray-600">Email<input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500" /></label><label className="text-[11px] font-bold text-gray-600">Tipo de conta<select value={form.accountType} onChange={(event) => setForm((current) => ({ ...current, accountType: event.target.value as AccountType }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-normal"><option value="B2C">Retalho (B2C)</option><option value="B2B">Empresa (B2B)</option></select></label><label className="text-[11px] font-bold text-gray-600">Nome da conta<input maxLength={120} value={form.accountName} onChange={(event) => setForm((current) => ({ ...current, accountName: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500" /></label>{!editingId && <label className="text-[11px] font-bold text-gray-600">Palavra-passe inicial<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500" /></label>}</div>{!editingId && <p className="mt-2 text-[10px] text-gray-400">Partilhe a palavra-passe inicial por um canal seguro; ela é guardada apenas como hash.</p>}<div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3"><button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : null}{saving ? "A guardar..." : "Guardar cliente"}</button></div></form>}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Total de clientes" value={stats.total.toLocaleString("pt-PT")} detail="contas registadas" icon={Users} tone="bg-blue-50 text-blue-600" /><Metric title="Clientes B2B" value={stats.b2b.toLocaleString("pt-PT")} detail="empresas" icon={Building2} tone="bg-emerald-50 text-emerald-600" /><Metric title="Clientes Retalho" value={stats.b2c.toLocaleString("pt-PT")} detail="contas B2C" icon={UserRound} tone="bg-violet-50 text-violet-600" /><Metric title="Clientes ativos" value={stats.active.toLocaleString("pt-PT")} detail="estado ativo" icon={ShoppingBag} tone="bg-amber-50 text-amber-600" /></div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm"><div className="flex overflow-x-auto border-b border-gray-200 px-3 pt-2">{["Todos", "B2B (Empresas)", "Retalho", "Novos clientes"].map((item) => <button key={item} type="button" onClick={() => changeTab(item)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold ${activeTab === item ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}>{item}</button>)}</div>
            <div className="flex flex-col gap-2 border-b border-gray-100 p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar por nome, conta ou email..." className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500" /></div><select aria-label="Filtrar país" value={countryFilter} onChange={(event) => { setLoading(true); setCountryFilter(event.target.value as "ALL" | "AO" | "PT"); setPage(1); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-semibold text-gray-600"><option value="ALL">Todos os países</option><option value="AO">Angola</option><option value="PT">Portugal</option></select><select aria-label="Filtrar estado" value={statusFilter} onChange={(event) => { setLoading(true); setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE"); setPage(1); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-semibold text-gray-600"><option value="ALL">Todos os estados</option><option value="ACTIVE">Ativos</option><option value="INACTIVE">Inativos</option></select><button type="button" onClick={() => { setSearch(""); setAccountFilter("ALL"); setCountryFilter("ALL"); setStatusFilter("ALL"); setNewOnly(false); setPage(1); }} className="rounded-lg border border-gray-200 p-2 text-blue-600" aria-label="Limpar filtros" title="Limpar filtros"><Filter size={15} /></button></div>
            <div className="overflow-x-auto"><table className="w-full min-w-207.5 text-left text-xs"><thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-500"><tr><th className="w-8 px-3 py-3"><input type="checkbox" aria-label="Selecionar todos" /></th><th className="px-2 py-3">Cliente</th><th className="px-2 py-3">Tipo</th><th className="px-2 py-3">País</th><th className="px-2 py-3">Encomendas</th><th className="px-2 py-3">Estado</th><th className="px-2 py-3">Criado</th><th className="w-10 px-2 py-3">Ações</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{clients.map((client) => { const country = clientCountry(client); return <tr key={client.id} onClick={() => setSelectedId(client.id)} className={`cursor-pointer transition hover:bg-blue-50/40 ${selected?.id === client.id ? "bg-blue-50/60" : ""}`}><td className="px-3 py-3"><input type="checkbox" aria-label={`Selecionar ${client.name || client.email}`} onClick={(event) => event.stopPropagation()} /></td><td className="px-2 py-2.5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-700">{initials(client)}</div><div className="min-w-0"><p className="whitespace-nowrap font-bold text-gray-800">{client.name || client.accountName}</p><p className="max-w-37.5 truncate text-[9px] text-gray-400">{client.email || "Sem email"}</p></div></div></td><td className="px-2"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${typeStyles[client.accountType === "B2B" ? "B2B" : "B2C"]}`}>{client.accountType === "B2B" ? "B2B" : "Retalho"}</span></td><td className="px-2 text-base">{flag[country]}</td><td className="px-2 font-semibold text-gray-700">{client._count.orders}</td><td className="px-2"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${client.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{client.status === "ACTIVE" ? "Ativo" : "Inativo"}</span></td><td className="px-2 text-gray-500">{new Date(client.createdAt).toLocaleDateString("pt-PT")}</td><td className="px-2"><button type="button" onClick={(event) => { event.stopPropagation(); startEdit(client); }} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100" aria-label={`Editar ${client.name || client.email}`}><Pencil size={15} /></button></td></tr>; })}</tbody></table></div>
            {loading && <div role="status" className="p-8 text-center text-xs text-gray-500">A carregar clientes...</div>}{!loading && clients.length === 0 && <div className="p-10 text-center text-sm text-gray-500">Nenhum cliente encontrado.</div>}
            <div className="flex flex-col justify-between gap-3 border-t border-gray-100 px-4 py-3 text-[10px] font-semibold text-gray-500 sm:flex-row sm:items-center"><span>{total === 0 ? "Sem clientes" : `Página ${page} de ${pageCount} · ${total.toLocaleString("pt-PT")} clientes`}</span><div className="flex items-center gap-1"><button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={14} /></button><span className="rounded-md bg-blue-600 px-2.5 py-1.5 text-white">{page}</span><button type="button" disabled={page >= pageCount || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-40" aria-label="Página seguinte"><ChevronRight size={14} /></button></div></div>
          </section>
          <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black">Detalhes do cliente</h2><button type="button" onClick={refresh} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Atualizar detalhes"><EllipsisVertical size={15} /></button></div>{selected ? <><div className="flex items-center gap-3 border-b border-gray-100 pb-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{initials(selected)}</div><div><h3 className="text-sm font-black">{selected.name || selected.accountName}</h3><p className="text-[10px] text-gray-400">Cliente desde {new Date(selected.createdAt).toLocaleDateString("pt-PT")}</p></div></div><div className="flex border-b border-gray-100"><span className="border-b-2 border-blue-600 px-3 py-3 text-[10px] font-bold text-blue-600">Informações</span><span className="px-3 py-3 text-[10px] font-bold text-gray-400">Histórico</span></div><dl className="space-y-3 py-4 text-[10px]"><Detail icon={Building2} label="Conta" value={selected.accountName} /><Detail icon={UserRound} label="Tipo" value={selected.accountType === "B2B" ? "Empresa (B2B)" : "Retalho (B2C)"} /><Detail icon={Mail} label="Email" value={selected.email || "Não registado"} /><Detail icon={MapPin} label="Telefone / localização" value={[selected.addresses[0]?.phone, selected.addresses[0]?.city, selected.addresses[0]?.province].filter(Boolean).join(" · ") || "Sem morada guardada"} /><Detail icon={Globe2} label="País" value={`${flag[clientCountry(selected)]} ${selected.addresses[0]?.country || "Não indicado"}`} /><Detail icon={ShoppingBag} label="Encomendas" value={String(selected._count.orders)} /><Detail icon={Settings} label="Último acesso" value={selected.lastLoginAt ? new Date(selected.lastLoginAt).toLocaleDateString("pt-PT") : "Sem acesso"} /></dl><div className="space-y-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => startEdit(selected)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-[10px] font-bold text-white hover:bg-blue-700"><Settings size={13} />Editar cliente</button><button type="button" onClick={() => void deleteClient(selected)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2.5 text-[10px] font-bold text-red-600 hover:bg-red-50"><Trash2 size={13} />Excluir cliente</button></div></> : <p className="py-10 text-center text-xs text-gray-500">Selecione um cliente para ver os detalhes.</p>}</aside>
        </div>
      </div></main>
    </div>
  </div>;
}

function Metric({ title, value, detail, icon: Icon, tone }: { title: string; value: string; detail: string; icon: typeof Users; tone: string }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold text-gray-500">{title}</p><p className="mt-1 text-2xl font-black tracking-tight">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={18} /></span></div><p className="mt-2 text-[10px] font-semibold text-emerald-600">{detail}</p><p className="text-[9px] text-gray-400">dados da loja</p></div>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <div className="flex gap-3"><Icon size={14} className="shrink-0 text-gray-500" /><div className="min-w-0"><dt className="text-gray-400">{label}</dt><dd className="wrap-break-word font-bold">{value}</dd></div></div>;
}