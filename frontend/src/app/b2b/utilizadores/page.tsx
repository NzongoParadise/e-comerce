"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Mail, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api";

type Role = "OWNER" | "ADMIN" | "BUYER" | "APPROVER";
type Member = {
  id: number;
  role: Role;
  createdAt: string;
  user: { id: number; name: string | null; email: string | null; accountType: string; status: string };
};

const roleLabels: Record<Role, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  BUYER: "Comprador",
  APPROVER: "Aprovador",
};

export default function B2BUsersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "OWNER">>("BUYER");
  const [showAssociationForm, setShowAssociationForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadMembers = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/b2b/company/members", { cache: "no-store" });
      setMembers(response.data ?? []);
      setCurrentRole(response.currentRole ?? null);
      setCompanyStatus(response.companyStatus ?? null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os utilizadores da empresa.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/b2b/company/members", { cache: "no-store" })
      .then((response) => {
        if (!active) return;
        setMembers(response.data ?? []);
        setCurrentRole(response.currentRole ?? null);
        setCompanyStatus(response.companyStatus ?? null);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os utilizadores da empresa.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdding(true);
    setError("");
    setNotice("");
    try {
      await fetchWithAuth("/api/b2b/company/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      setEmail("");
      setShowAssociationForm(false);
      setNotice("Conta B2B associada à empresa.");
      await loadMembers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível associar a conta.");
    } finally {
      setAdding(false);
    }
  }

  async function updateRole(member: Member, nextRole: Role) {
    if (nextRole === member.role) return;
    setBusyUserId(member.user.id);
    setError("");
    setNotice("");
    try {
      await fetchWithAuth("/api/b2b/company/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "role", memberUserId: member.user.id, role: nextRole }),
      });
      setNotice("Permissão atualizada.");
      await loadMembers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível alterar a permissão.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function removeMember(member: Member) {
    const displayName = member.user.name || member.user.email || "este utilizador";
    if (!window.confirm(`Remover ${displayName} da empresa? A conta pessoal continuará ativa.`)) return;
    setBusyUserId(member.user.id);
    setError("");
    setNotice("");
    try {
      await fetchWithAuth("/api/b2b/company/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", memberUserId: member.user.id }),
      });
      setNotice("Utilizador removido da empresa. A conta pessoal mantém-se ativa.");
      await loadMembers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover o utilizador.");
    } finally {
      setBusyUserId(null);
    }
  }

  const canManage = currentRole === "OWNER";
  const canAddMembers = canManage && companyStatus === "ACTIVE";

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1d6ac4]">B2B · Organização</p>
          <h1 className="mt-1 text-3xl font-black text-[#0c1b2a]">Utilizadores da empresa</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Consulte os membros associados e as respetivas permissões. Só é possível associar contas B2B já registadas na plataforma.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setLoading(true); void loadMembers(); }} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
          {canAddMembers && <button type="button" onClick={() => setShowAssociationForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-[#0c1b2a] px-4 py-3 text-xs font-black text-white hover:bg-[#18334f]">
            {showAssociationForm ? <X size={15} /> : <Plus size={15} />} {showAssociationForm ? "Cancelar" : "Associar conta"}
          </button>}
        </div>
      </header>

      {notice && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}

      {canManage && companyStatus !== "ACTIVE" && <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
        A gestão de membros ficará disponível depois da homologação da empresa. Estado atual: <strong>{companyStatus === "PENDING" ? "em análise" : companyStatus === "REJECTED" ? "não aprovada" : "suspensa"}.</strong>
      </p>}

      {showAssociationForm && canAddMembers && (
        <form onSubmit={addMember} className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
          <h2 className="font-black text-[#0c1b2a]">Associar um membro existente</h2>
          <p className="mt-1 text-xs leading-5 text-gray-600">Introduza o email de uma conta B2B ativa. Este formulário não cria uma conta nem envia um convite por email.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
            <label className="sr-only" htmlFor="b2b-member-email">Email da conta B2B</label>
            <input id="b2b-member-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@empresa.com" className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-500" />
            <label className="sr-only" htmlFor="b2b-member-role">Permissão do utilizador</label>
            <select id="b2b-member-role" value={role} onChange={(event) => setRole(event.target.value as Exclude<Role, "OWNER">)} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm">
              <option value="BUYER">Comprador</option><option value="APPROVER">Aprovador</option><option value="ADMIN">Administrador</option>
            </select>
            <button type="submit" disabled={adding} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{adding ? "A associar..." : "Associar membro"}</button>
          </div>
        </form>
      )}

      <section aria-label="Membros da empresa" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div><h2 className="font-black text-[#0c1b2a]">Equipa empresarial</h2><p className="mt-1 text-xs text-gray-500">Membros ativos com acesso a esta empresa.</p></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600"><Users size={14} /> {members.length}</span>
        </div>
        {loading ? <p className="px-5 py-12 text-center text-sm text-gray-500">A carregar membros...</p>
          : members.length === 0 ? <div className="px-5 py-12 text-center"><Users size={24} className="mx-auto text-gray-300" /><h3 className="mt-3 text-sm font-bold text-gray-800">Ainda não existem membros associados</h3><p className="mt-1 text-xs text-gray-500">A conta proprietária aparecerá aqui quando os dados da empresa forem registados e associados.</p></div>
            : <div className="divide-y divide-gray-100">
              {members.map((member) => (
                <article key={member.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600"><UserRound size={18} /></span>
                    <div className="min-w-0"><h3 className="truncate text-sm font-bold text-gray-900">{member.user.name || "Utilizador"}</h3><p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500"><Mail size={12} />{member.user.email || "Email indisponível"}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {canManage && member.role !== "OWNER" ? <>
                      <label className="sr-only" htmlFor={`member-role-${member.id}`}>Permissão de {member.user.name || member.user.email || "membro"}</label>
                      <select id={`member-role-${member.id}`} value={member.role} disabled={busyUserId === member.user.id} onChange={(event) => void updateRole(member, event.target.value as Role)} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold">
                        <option value="ADMIN">Administrador</option><option value="BUYER">Comprador</option><option value="APPROVER">Aprovador</option>
                      </select>
                      <button type="button" title="Remover da empresa" aria-label={`Remover ${member.user.name || member.user.email || "membro"} da empresa`} disabled={busyUserId === member.user.id} onClick={() => void removeMember(member)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 size={15} /></button>
                    </> : <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><ShieldCheck size={14} />{roleLabels[member.role]}</span>}
                  </div>
                </article>
              ))}
            </div>}
        {!loading && !currentRole && <div className="border-t border-gray-100 bg-amber-50 px-5 py-4">
          <p className="text-sm font-bold text-amber-950">Configure primeiro o perfil da empresa</p>
          <p className="mt-1 text-xs leading-5 text-amber-900">Ainda não existe uma empresa associada à sua conta. Registe a razão social e o NIF oficiais para criar a organização; depois da validação, poderá gerir os membros desta equipa.</p>
          <Link href="/b2b/empresa" className="mt-3 inline-flex items-center rounded-lg bg-amber-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-900">Registar dados da empresa</Link>
        </div>}
      </section>
      {!canManage && currentRole && <p className="mt-4 text-xs text-gray-500">A gestão de membros e permissões está disponível apenas para o proprietário da empresa.</p>}
    </main>
  );
}
