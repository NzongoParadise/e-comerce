"use client";

import { useEffect, useState } from "react";
import { Check, Mail, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Member = {
  id: number;
  role: "OWNER" | "BUYER" | "APPROVER";
  status: string;
  user: { id: number; name?: string | null; email?: string | null; accountType?: string | null; status?: string | null };
};

const roleLabels: Record<Member["role"], string> = {
  OWNER: "Proprietário",
  APPROVER: "Aprovador",
  BUYER: "Comprador",
};

const roleDescriptions: Record<Member["role"], string> = {
  OWNER: "Acesso completo à organização e permissões.",
  APPROVER: "Pode aprovar operações de compra.",
  BUYER: "Pode preparar e executar operações de compra.",
};

export default function B2BUsersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [currentRole, setCurrentRole] = useState<Member["role"] | "">("");
  const [draftRoles, setDraftRoles] = useState<Record<number, Member["role"]>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth("/api/b2b/company/members", { cache: "no-store" });
      const data = (response.data || []) as Member[];
      setMembers(data);
      setCurrentRole(response.currentRole || "");
      setDraftRoles(Object.fromEntries(data.map((member) => [member.user.id, member.role])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os utilizadores da empresa.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveRole(member: Member) {
    const nextRole = draftRoles[member.user.id];
    if (!nextRole || nextRole === member.role) return;
    setSavingId(member.user.id);
    setError("");
    setMessage("");
    try {
      await fetchWithAuth("/api/b2b/company/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId: member.user.id, role: nextRole }),
      });
      setMembers((current) => current.map((item) => item.user.id === member.user.id ? { ...item, role: nextRole } : item));
      setMessage("Permissão atualizada para " + (member.user.name || member.user.email || "utilizador") + ".");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível atualizar a permissão.");
    } finally {
      setSavingId(null);
    }
  }

  const owner = currentRole === "OWNER";

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="section-kicker">B2B · Organização</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Utilizadores e permissões</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Controle quem pode comprar, aprovar e administrar operações da empresa.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </header>

      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><Check size={16} className="mr-2 inline" />{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#1d6ac4]"><Users size={20} /></span>
            <div><p className="text-xs font-black text-slate-900">Equipa da empresa</p><p className="mt-1 text-[10px] text-slate-500">{members.length} membro(s) ativo(s)</p></div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black text-slate-600">O seu perfil: {currentRole ? roleLabels[currentRole] : "—"}</span>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-3">{[1, 2, 3].map((item) => <div key={item} className="card h-28 animate-pulse bg-slate-50" />)}</div>
      ) : !members.length ? (
        <div className="card p-12 text-center"><Users size={34} className="mx-auto text-slate-300" /><h2 className="mt-3 text-sm font-black text-slate-800">Nenhum membro encontrado</h2><p className="mt-1 text-xs text-slate-500">A empresa ainda não tem membros ativos disponíveis para gestão.</p></div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => {
            const name = member.user.name?.trim() || "Utilizador";
            const email = member.user.email || "E-mail não informado";
            const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
            const editable = owner && member.role !== "OWNER";
            return (
              <article key={member.id} className="card p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#132238] text-[11px] font-black text-white">{initials || "U"}</span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-black text-slate-950">{name}</h2>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><Mail size={12} />{email}</p>
                    </div>
                  </div>
                  <div className="lg:w-64">
                    <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Função</label>
                    <select disabled={!editable || savingId === member.user.id} value={draftRoles[member.user.id] || member.role} onChange={(event) => setDraftRoles((current) => ({ ...current, [member.user.id]: event.target.value as Member["role"] }))} className="settings-input mt-1.5">
                      <option value="OWNER">Proprietário</option>
                      <option value="APPROVER">Aprovador</option>
                      <option value="BUYER">Comprador</option>
                    </select>
                    <p className="mt-1 text-[9px] leading-4 text-slate-400">{roleDescriptions[draftRoles[member.user.id] || member.role]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-black text-emerald-700"><ShieldCheck size={12} /> Ativo</span>
                    {editable && draftRoles[member.user.id] !== member.role && <button type="button" onClick={() => void saveRole(member)} disabled={savingId === member.user.id} className="btn-primary px-3 py-2 text-[9px]">{savingId === member.user.id ? "A guardar..." : "Guardar"}</button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!owner && members.length > 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-semibold text-slate-500">A gestão de permissões está disponível apenas para o proprietário da empresa.</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(roleLabels) as Member["role"][]).map((role) => <div key={role} className="card p-4"><div className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#1d6ac4]" /><span className="text-xs font-black text-slate-900">{roleLabels[role]}</span></div><p className="mt-2 text-[10px] leading-4 text-slate-500">{roleDescriptions[role]}</p></div>)}
      </section>
    </div>
  );
}
