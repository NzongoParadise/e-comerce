"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, MoreVertical, Plus, Search, Send, ShieldCheck, Users, X } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type ManagedUser = {
  id: number;
  name?: string;
  email?: string;
  accessRole: string;
  status: string;
  lastLoginAt: string;
  accountType: string;
};

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  SALES: "Vendas",
  CUSTOMER: "Cliente",
  SUPPORT: "Suporte",
  MARKETING: "Marketing",
  HR: "Recursos Humanos",
};

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SALES");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth("/api/users")
      .then((response) => setUsers(response.data))
      .catch((error) => setMessage(error.message === "API error: 403" ? "Apenas administradores podem gerir utilizadores." : "Não foi possível carregar os utilizadores."))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const query = search.toLowerCase();
    const matchesSearch = !query || `${user.name || ""} ${user.email || ""} ${roleLabels[user.accessRole] || user.accessRole}`.toLowerCase().includes(query);
    return matchesSearch && (statusFilter === "ALL" || user.status === statusFilter) && (roleFilter === "ALL" || user.accessRole === roleFilter);
  }), [users, search, statusFilter, roleFilter]);

  const departments = new Set(users.map((user) => user.accountType).filter(Boolean)).size;

  async function inviteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      await fetchWithAuth("/api/users/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, accessRole: role }) });
      setMessage(`Convite enviado para ${email}.`);
      setEmail("");
      setShowInvite(false);
    } catch { setMessage("Não foi possível enviar o convite."); }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1d6ac4]">Conta empresarial</p><h1 className="mt-2 text-2xl font-bold text-gray-900">Equipas e permissões</h1><p className="mt-1 text-sm text-gray-500">Gira os membros da sua equipa, defina permissões e controle o acesso às funcionalidades.</p></div>
        <button type="button" onClick={() => setShowInvite(true)} className="btn-primary"><Plus size={16} /> Convidar novo membro</button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Users size={20} /></span><div><p className="text-2xl font-black text-gray-900">{users.length}</p><p className="text-xs text-gray-500">Membros da equipa</p></div></div>
        <div className="card flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Users size={20} /></span><div><p className="text-2xl font-black text-gray-900">{departments}</p><p className="text-xs text-gray-500">Departamentos</p></div></div>
        <div className="card flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><ShieldCheck size={20} /></span><div><p className="text-2xl font-black text-gray-900">{new Set(users.map((user) => user.accessRole)).size}</p><p className="text-xs text-gray-500">Níveis de permissão</p></div></div>
      </div>

      {message && <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
      {showInvite && <form onSubmit={inviteUser} className="card mb-5 grid gap-3 p-5 sm:grid-cols-[1fr_220px_auto_auto]"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail do utilizador" className="settings-input" /><select value={role} onChange={(event) => setRole(event.target.value)} className="settings-input"><option value="SALES">Vendas</option><option value="SUPPORT">Suporte</option><option value="MARKETING">Marketing</option><option value="HR">Recursos Humanos</option></select><button type="submit" className="btn-primary"><Send size={15} /> Enviar convite</button><button type="button" onClick={() => setShowInvite(false)} className="btn-secondary"><X size={15} /></button></form>}
      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto_auto]">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por nome, e-mail ou cargo..." className="settings-input pl-9" /></div>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="settings-input lg:w-44"><option value="ALL">Todos os perfis</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="settings-input lg:w-36"><option value="ALL">Estado: Todos</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select>
      </div>

      <div className="card overflow-hidden"><div className="hidden grid-cols-[2fr_1fr_1.2fr_0.8fr_1fr_32px] gap-4 border-b border-gray-200 bg-gray-50 p-4 text-[10px] font-bold uppercase tracking-wide text-gray-500 md:grid"><span>Utilizador</span><span>Cargo</span><span>Perfil de acesso</span><span>Estado</span><span>Último acesso</span><span>Ações</span></div><div className="divide-y divide-gray-100">{loading ? <div className="p-8 text-center text-sm text-gray-500">A carregar utilizadores...</div> : filteredUsers.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">{message || "Nenhum utilizador encontrado."}</div> : filteredUsers.map((user) => <div key={user.id} className="grid gap-3 p-4 md:grid-cols-[2fr_1fr_1.2fr_0.8fr_1fr_32px] md:items-center md:gap-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0fc] text-xs font-bold text-[#1d6ac4]">{(user.name || user.email || "U").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-gray-900">{user.name || "Sem nome"}</p><p className="truncate text-xs text-gray-500">{user.email}</p></div></div><span className="text-xs font-semibold text-gray-700">{roleLabels[user.accessRole] || user.accessRole}</span><span className="w-fit rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">{roleLabels[user.accessRole] || user.accessRole}</span><span className={`w-fit rounded-full px-2 py-1 text-[10px] font-bold ${user.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}><Check size={11} className="mr-1 inline" />{user.status === "ACTIVE" ? "Ativo" : "Inativo"}</span><span className="text-xs text-gray-600">{new Date(user.lastLoginAt).toLocaleDateString("pt-PT")}</span><button type="button" aria-label={`Ações de ${user.name || user.email}`} className="text-gray-400 hover:text-gray-700"><MoreVertical size={17} /></button></div>)}</div><div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">A mostrar {filteredUsers.length} de {users.length} utilizadores</div></div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="card p-5"><div className="flex items-center gap-3"><Users className="text-[#1d6ac4]" /><div><h2 className="font-bold text-gray-900">Plano Empresarial</h2><p className="text-xs text-gray-500">{users.length} utilizador{users.length === 1 ? "" : "es"} na equipa</p></div></div><div className="mt-4 h-2 rounded-full bg-gray-100"><div className="h-full w-1/3 rounded-full bg-[#1d6ac4]" /></div></div><div className="card p-5"><h2 className="font-bold text-gray-900">Perfis de acesso</h2><p className="mt-1 text-xs text-gray-500">Atribua permissões de acordo com a função de cada pessoa.</p><div className="mt-4 flex flex-wrap gap-2">{Object.entries(roleLabels).map(([value, label]) => <span key={value} className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-700">{label}</span>)}</div></div></div>
    </div>
  );
}
