"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Loader2, Mail, Plus, RefreshCw, Send, ShieldCheck, Users, XCircle } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Invitation = {
  id: number;
  email: string;
  role: "BUYER" | "APPROVER";
  status: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  invitedBy?: { name: string | null; email: string | null } | null;
};

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
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Invitation["role"]>("BUYER");
  const [inviting, setInviting] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
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
      const [memberResponse, invitationResponse] = await Promise.all([
        fetchWithAuth("/api/b2b/company/members", { cache: "no-store" }),
        fetchWithAuth("/api/b2b/company/invitations", { cache: "no-store" }),
      ]);
      const data = (memberResponse.data || []) as Member[];
      setMembers(data);
      setInvitations((invitationResponse.data || []) as Invitation[]);
      setCurrentRole(memberResponse.currentRole || invitationResponse.currentRole || "");
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

  async function sendInvitation(event?: React.FormEvent<HTMLFormElement>, invitation?: Pick<Invitation, "email" | "role">) {
    event?.preventDefault();
    const email = (invitation?.email || inviteEmail).trim().toLowerCase();
    const role = invitation?.role || inviteRole;
    if (!email) {
      setError("Indique o e-mail da pessoa que pretende convidar.");
      return;
    }
    setInviting(true);
    setError("");
    setMessage("");
    try {
      await fetchWithAuth("/api/b2b/company/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      setInviteEmail("");
      setMessage("Convite enviado para " + email + ".");
      await load();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Não foi possível enviar o convite.");
    } finally {
      setInviting(false);
    }
  }

  async function cancelInvitation(invitationId: number) {
    setCancellingId(invitationId);
    setError("");
    setMessage("");
    try {
      await fetchWithAuth("/api/b2b/company/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, action: "CANCEL" }),
      });
      setMessage("Convite cancelado. O link anterior deixou de ser válido.");
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Não foi possível cancelar o convite.");
    } finally {
      setCancellingId(null);
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

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2"><Mail size={17} className="text-[#1d6ac4]"/><h2 className="text-sm font-black text-slate-950">Convites empresariais</h2></div>
            <p className="mt-1 text-[10px] text-slate-500">Convide colegas por e-mail. Os links são pessoais e expiram após sete dias.</p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black text-slate-600">{invitations.filter((invitation) => invitation.status === "PENDING").length} pendente(s)</span>
        </div>
        {owner ? (
          <form onSubmit={(event) => void sendInvitation(event)} className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-end sm:p-5">
            <label className="block text-[9px] font-black uppercase tracking-wide text-slate-500">E-mail do convidado
              <input type="email" required maxLength={320} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="colega@empresa.com" className="settings-input mt-2 normal-case" />
            </label>
            <label className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Função inicial
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Invitation["role"])} className="settings-input mt-2 normal-case">
                <option value="BUYER">Comprador</option>
                <option value="APPROVER">Aprovador</option>
              </select>
            </label>
            <button type="submit" disabled={inviting} className="btn-primary min-h-11 disabled:opacity-50">{inviting ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>} {inviting ? "A enviar..." : "Enviar convite"}</button>
          </form>
        ) : (
          <div className="border-b border-slate-100 bg-slate-50/60 p-4 text-[10px] leading-5 text-slate-500">Apenas o proprietário pode enviar, reenviar ou cancelar convites.</div>
        )}
        {invitations.length ? (
          <div className="divide-y divide-slate-100">
            {invitations.map((invitation) => {
              const labels: Record<string, string> = { PENDING: "À espera de aceitação", DELIVERY_FAILED: "Falha no envio", EXPIRED: "Expirado", CANCELLED: "Cancelado", ACCEPTED: "Aceite" };
              const tone = invitation.status === "ACCEPTED" ? "bg-emerald-50 text-emerald-700" : invitation.status === "PENDING" ? "bg-amber-50 text-amber-700" : invitation.status === "DELIVERY_FAILED" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600";
              const manageable = owner && ["PENDING", "DELIVERY_FAILED", "EXPIRED"].includes(invitation.status);
              return <article key={invitation.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Mail size={15}/></span>
                  <div className="min-w-0">
                    <p className="break-all text-xs font-black text-slate-900">{invitation.email}</p>
                    <p className="mt-1 text-[9px] text-slate-500">{roleLabels[invitation.role]} · Criado em {new Date(invitation.createdAt).toLocaleDateString("pt-PT")}</p>
                    {invitation.status === "PENDING" && <p className="mt-1 inline-flex items-center gap-1 text-[9px] text-slate-400"><Clock3 size={11}/> Expira em {new Date(invitation.expiresAt).toLocaleDateString("pt-PT")}</p>}
                    {invitation.invitedBy?.name && <p className="mt-1 text-[9px] text-slate-400">Enviado por {invitation.invitedBy.name}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={"w-fit rounded-full px-2.5 py-1.5 text-[9px] font-black " + tone}>{labels[invitation.status] || invitation.status}</span>
                  {manageable && <button type="button" onClick={() => void sendInvitation(undefined, { email: invitation.email, role: invitation.role })} disabled={inviting || cancellingId === invitation.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-black text-slate-700 hover:border-blue-200 hover:text-blue-700 disabled:opacity-50">{inviting ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>} Reenviar</button>}
                  {owner && ["PENDING", "DELIVERY_FAILED"].includes(invitation.status) && <button type="button" onClick={() => void cancelInvitation(invitation.id)} disabled={cancellingId === invitation.id} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[9px] font-black text-rose-600 hover:bg-rose-50 disabled:opacity-50">{cancellingId === invitation.id ? <Loader2 size={12} className="animate-spin"/> : <XCircle size={12}/>} Cancelar</button>}
                </div>
              </article>;
            })}
          </div>
        ) : (
          <div className="p-8 text-center"><Mail size={26} className="mx-auto text-slate-300"/><p className="mt-2 text-xs font-bold text-slate-700">Ainda não foram enviados convites.</p><p className="mt-1 text-[10px] text-slate-500">Os convites enviados aparecerão aqui, com o estado da entrega e aceitação.</p></div>
        )}
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
