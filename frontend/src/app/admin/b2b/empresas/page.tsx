"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, CheckCircle2, Clock3, Download, ExternalLink, History, RefreshCw, Search, ShieldCheck, Users, XCircle,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Company = {
  id: number;
  legalName: string;
  tradeName?: string | null;
  nif: string;
  email?: string | null;
  phone?: string | null;
  country?: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  status: string;
  createdAt: string;
  members: Array<{ id: number; role: string; status: string; user: { id: number; name?: string | null; email?: string | null } }>;
  statusHistory: Array<{ id: number; fromStatus?: string | null; toStatus: string; reason?: string | null; createdAt: string; actor?: { name?: string | null; email?: string | null } | null }>;
  _count: { quotes: number; orders: number; priceRules: number; purchaseOrders: number };
};

type AccountRequest = {
  id: number;
  name?: string | null;
  email?: string | null;
  accountType: string;
  b2bRequestStatus: string;
  hasCompanyDocument: boolean;
  hasPersonalDocument: boolean;
  updatedAt: string;
  company?: { id: number; legalName: string; tradeName?: string | null; nif: string; email?: string | null; phone?: string | null; country: string; province?: string | null; city?: string | null; address?: string | null; status: string; reviewReason?: string | null } | null;
};

type CompanyDetailsForm = Pick<Company, "legalName" | "nif"> & {
  tradeName: string;
  email: string;
  phone: string;
  country: string;
  province: string;
  city: string;
  address: string;
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
  SUSPENDED: "bg-slate-100 text-slate-700 ring-slate-200",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativa",
  REJECTED: "Rejeitada",
  SUSPENDED: "Suspensa",
};

export default function AdminB2BCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [companyStats, setCompanyStats] = useState<Record<string, number>>({});
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyDetailsForm | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("BUYER");
  const [decisionReason, setDecisionReason] = useState<Record<number, string>>({});
  const [statusReason, setStatusReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [requestBusy, setRequestBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadCompanies = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`/api/admin/b2b/companies?status=${status}&search=${encodeURIComponent(search.trim())}&page=${page}&pageSize=25`);
      setCompanies(response.data ?? []);
      setTotalCompanies(response.meta?.total ?? 0);
      setPageCount(response.meta?.pageCount ?? 1);
      setCompanyStats(response.stats ?? {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as empresas.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  const loadRequests = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/admin/b2b/requests");
      setRequests(response.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os pedidos B2B.");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      fetchWithAuth(`/api/admin/b2b/companies?status=${status}&search=${encodeURIComponent(search.trim())}&page=${page}&pageSize=25`)
        .then((response) => {
          if (!active) return;
          setCompanies(response.data ?? []);
          setTotalCompanies(response.meta?.total ?? 0);
          setPageCount(response.meta?.pageCount ?? 1);
          setCompanyStats(response.stats ?? {});
        })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as empresas.");
        })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [page, search, status]);

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/admin/b2b/requests")
      .then((response) => { if (active) setRequests(response.data ?? []); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os pedidos B2B."); })
      .finally(() => { if (active) setRequestsLoading(false); });
    return () => { active = false; };
  }, []);

  const pendingRequests = requests.filter((request) => request.b2bRequestStatus === "PENDING");
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) || null;
  const isPendingConversion = (companyId: number) => pendingRequests.some((request) => request.company?.id === companyId);

  async function refresh() {
    setLoading(true);
    setRequestsLoading(true);
    setError("");
    await Promise.all([loadCompanies(), loadRequests()]);
  }

  async function changeCompanyStatus(companyId: number, nextStatus: string) {
    setBusy(companyId);
    setError("");
    setMessage("");
    try {
      await fetchWithAuth("/api/admin/b2b/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", companyId, status: nextStatus, ...(nextStatus === "REJECTED" ? { reason: statusReason } : {}) }),
      });
      setMessage(`Estado da empresa atualizado para ${statusLabels[nextStatus] || nextStatus.toLowerCase()}.`);
      setStatusReason("");
      await loadCompanies();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a empresa.");
    } finally {
      setBusy(null);
    }
  }

  async function decideRequest(userId: number, nextStatus: "APPROVED" | "REJECTED") {
    setRequestBusy(userId);
    setError("");
    setMessage("");
    try {
      await fetchWithAuth("/api/admin/b2b/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: nextStatus, ...(nextStatus === "REJECTED" ? { reason: decisionReason[userId]?.trim() } : {}) }),
      });
      setMessage(nextStatus === "APPROVED"
        ? "Pedido aprovado. A conta do cliente foi convertida para B2B."
        : "Pedido de conversão rejeitado.");
      setDecisionReason((current) => ({ ...current, [userId]: "" }));
      await loadRequests();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível processar o pedido.");
    } finally {
      setRequestBusy(null);
    }
  }

  function selectCompany(company: Company) {
  setSelectedCompanyId(company.id);
  setCompanyForm({
    legalName: company.legalName,
    tradeName: company.tradeName || "",
    nif: company.nif,
    email: company.email || "",
    phone: company.phone || "",
    country: company.country || "Angola",
    province: company.province || "",
    city: company.city || "",
    address: company.address || "",
  });
  setStatusReason("");
  }

  async function saveCompanyDetails(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!selectedCompany || !companyForm) return;
  setBusy(selectedCompany.id);
  setError("");
  setMessage("");
  try {
    await fetchWithAuth("/api/admin/b2b/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "details", companyId: selectedCompany.id, changes: companyForm }),
    });
    setMessage("Dados oficiais da empresa atualizados.");
    await loadCompanies();
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : "Não foi possível guardar os dados da empresa.");
  } finally {
    setBusy(null);
  }
  }

  async function updateMember(companyId: number, memberId: number, changes: { role?: string; status?: string }) {
  setBusy(companyId);
  setError("");
  try {
    await fetchWithAuth("/api/admin/b2b/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "member", companyId, memberId, ...changes }),
    });
    await loadCompanies();
    setMessage("Acesso do membro atualizado.");
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o membro.");
  } finally {
    setBusy(null);
  }
  }

  async function addMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompany) return;
    setBusy(selectedCompany.id);
    setError("");
    setMessage("");
    try {
      await fetchWithAuth("/api/admin/b2b/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addMember", companyId: selectedCompany.id, email: memberEmail, role: memberRole }),
      });
      setMemberEmail("");
      setMessage("Conta B2B associada à empresa.");
      await loadCompanies();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível associar o utilizador.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Administração · B2B</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Gestão de empresas</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Acompanhe empresas, valide pedidos de conversão e controle o estado das contas empresariais.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || requestsLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw size={14} className={loading || requestsLoading ? "animate-spin" : ""} />
          Atualizar dados
        </button>
      </header>

      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo de empresas">
        {[
          { label: "Total de empresas", value: totalCompanies, Icon: Building2, tone: "text-blue-700 bg-blue-50" },
          { label: "Aguardam validação", value: companyStats.PENDING || 0, Icon: Clock3, tone: "text-amber-700 bg-amber-50" },
          { label: "Empresas ativas", value: companyStats.ACTIVE || 0, Icon: ShieldCheck, tone: "text-emerald-700 bg-emerald-50" },
          { label: "Pedidos de conversão", value: pendingRequests.length, Icon: Users, tone: "text-violet-700 bg-violet-50" },
        ].map(({ label, value, Icon, tone }) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={17} /></span>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-black text-slate-950">Pedidos de conversão B2C → B2B</h2>
            <p className="mt-1 text-xs text-slate-500">Revise a documentação antes de aprovar a alteração da conta do cliente.</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{pendingRequests.length} pendente(s)</span>
        </div>
        <div className="divide-y divide-slate-100">
          {requestsLoading ? <p className="px-5 py-8 text-center text-sm text-slate-500">A carregar pedidos...</p>
            : pendingRequests.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">Não existem pedidos de conversão pendentes.</p>
              : pendingRequests.map((request) => (
                <article key={request.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900">{request.name || "Cliente sem nome"}</h3>
                    <p className="mt-1 text-xs text-slate-500">{request.email || "Sem email"} · Submetido em {new Date(request.updatedAt).toLocaleDateString("pt-PT")}</p>
                    {request.company
                      ? <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"><strong>{request.company.tradeName || request.company.legalName}</strong> · NIF {request.company.nif}<p className="mt-1 text-[10px] text-slate-500">{[request.company.email, request.company.phone, request.company.city, request.company.country].filter(Boolean).join(" · ")}</p></div>
                      : <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">Pedido legado sem dados de empresa. O cliente deve atualizar o pedido antes da aprovação.</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {request.hasCompanyDocument
                        ? <a className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50" href={`/api/admin/b2b/requests?userId=${request.id}&document=company`}><Download size={13} />Documento da empresa</a>
                        : <span className="text-xs text-rose-700">Documento da empresa em falta</span>}
                      {request.hasPersonalDocument
                        ? <a className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50" href={`/api/admin/b2b/requests?userId=${request.id}&document=personal`}><Download size={13} />Documento pessoal</a>
                        : <span className="text-xs text-rose-700">Documento pessoal em falta</span>}
                    </div>
                    <label className="mt-3 block max-w-xl text-[10px] font-bold text-slate-500">Motivo da rejeição (obrigatório para rejeitar)
                      <textarea value={decisionReason[request.id] || ""} onChange={(event) => setDecisionReason((current) => ({ ...current, [request.id]: event.target.value }))} maxLength={1000} rows={2} placeholder="Explique ao cliente o que deve corrigir." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-800 outline-none focus:border-blue-500" />
                    </label>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" disabled={requestBusy === request.id || !request.company || !request.hasCompanyDocument || !request.hasPersonalDocument} onClick={() => void decideRequest(request.id, "APPROVED")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><CheckCircle2 size={14} />Aprovar</button>
                    <button type="button" disabled={requestBusy === request.id || !decisionReason[request.id]?.trim()} onClick={() => void decideRequest(request.id, "REJECTED")} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><XCircle size={14} />Rejeitar</button>
                  </div>
                </article>
              ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-black text-slate-950">Registo de empresas</h2>
            <p className="mt-1 text-xs text-slate-500">Pesquise, filtre e atualize o estado das empresas registadas.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Empresa, NIF, contacto..." aria-label="Pesquisar empresas" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-blue-500 sm:w-64" />
            </label>
            <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} aria-label="Filtrar por estado" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
              <option value="ALL">Todos os estados</option>
              <option value="PENDING">Pendentes</option>
              <option value="ACTIVE">Ativas</option>
              <option value="REJECTED">Rejeitadas</option>
              <option value="SUSPENDED">Suspensas</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-3">Empresa</th><th className="px-5 py-3">Identificação</th><th className="px-5 py-3">Contacto</th><th className="px-5 py-3">Membros</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && companies.map((company) => (
                <tr key={company.id} className={`align-middle hover:bg-slate-50/70 ${selectedCompanyId === company.id ? "bg-blue-50/60" : ""}`}>
                  <td className="px-5 py-4"><p className="font-bold text-slate-900">{company.tradeName || company.legalName}</p>{company.tradeName && <p className="mt-0.5 text-[10px] text-slate-500">{company.legalName}</p>}<p className="mt-1 text-[10px] text-slate-500">{[company.city, company.province].filter(Boolean).join(" · ") || "Localização não preenchida"}</p></td>
                  <td className="px-5 py-4"><span className="font-semibold text-slate-800">NIF {company.nif}</span><p className="mt-1 text-[10px] text-slate-500">Registada em {new Date(company.createdAt).toLocaleDateString("pt-PT")}</p></td>
                  <td className="px-5 py-4"><p className="text-slate-700">{company.email || "Sem email"}</p><p className="mt-1 text-[10px] text-slate-500">{company.phone || "Sem telefone"}</p></td>
                  <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 text-slate-700"><Users size={13} />{company.members.length}</span><p className="mt-1 max-w-40 truncate text-[10px] text-slate-500">{company.members[0]?.user.name || company.members[0]?.user.email || "Sem membros"}</p></td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyles[company.status] || statusStyles.SUSPENDED}`}>{statusLabels[company.status] || company.status}</span></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2">
                    <button type="button" onClick={() => selectCompany(company)} className="rounded-md border border-slate-200 px-2.5 py-2 text-[10px] font-bold text-slate-700 hover:bg-white">Ficha</button>
                    {company.status !== "ACTIVE" && !isPendingConversion(company.id) && <button type="button" disabled={busy === company.id} onClick={() => void changeCompanyStatus(company.id, "ACTIVE")} className="rounded-md bg-emerald-700 px-2.5 py-2 text-[10px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50">{company.status === "SUSPENDED" ? "Reativar" : "Aprovar"}</button>}
                    {company.status === "ACTIVE" && <button type="button" disabled={busy === company.id} onClick={() => void changeCompanyStatus(company.id, "SUSPENDED")} className="rounded-md border border-amber-200 px-2.5 py-2 text-[10px] font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50">Suspender</button>}
                  </div></td>
                </tr>
              ))}
              {loading && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">A carregar empresas...</td></tr>}
              {!loading && companies.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">Nenhuma empresa encontrada para estes filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span>A mostrar {companies.length ? (page - 1) * 25 + 1 : 0}–{Math.min(page * 25, totalCompanies)} de {totalCompanies} empresa(s)</span>
          <div className="flex items-center gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Anterior</button><span>Página {page} de {pageCount}</span><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Seguinte</button></div>
        </div>
      </section>

      {selectedCompany && companyForm && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div><p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Ficha empresarial · #{selectedCompany.id}</p><h2 className="mt-1 text-lg font-black">{selectedCompany.tradeName || selectedCompany.legalName}</h2><p className="mt-1 text-xs text-slate-500">NIF {selectedCompany.nif} · {statusLabels[selectedCompany.status] || selectedCompany.status}</p></div>
            <button type="button" onClick={() => { setSelectedCompanyId(null); setCompanyForm(null); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Fechar ficha</button>
          </header>
          <div className="grid gap-6 p-5 xl:grid-cols-[1.2fr_.8fr]">
            <div className="space-y-6">
              <form onSubmit={saveCompanyDetails} className="space-y-4">
                <h3 className="text-sm font-black">Dados oficiais</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ["legalName", "Razão social"], ["tradeName", "Nome comercial"], ["nif", "NIF"], ["email", "Email"], ["phone", "Telefone"], ["country", "País"], ["province", "Província / distrito"], ["city", "Cidade"], ["address", "Morada"],
                  ] as const).map(([key, label]) => <label key={key} className={`text-[10px] font-bold text-slate-500 ${key === "address" || key === "legalName" ? "sm:col-span-2" : ""}`}>{label}<input required={key === "legalName" || key === "nif" || key === "country"} value={companyForm[key] || ""} onChange={(event) => setCompanyForm((current) => current ? { ...current, [key]: event.target.value } : current)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-normal text-slate-900 outline-none focus:border-blue-500" /></label>)}
                </div>
                <button type="submit" disabled={busy === selectedCompany.id} className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy === selectedCompany.id ? "A guardar..." : "Guardar dados"}</button>
              </form>
              <div className="space-y-3">
                <h3 className="text-sm font-black">Utilizadores e permissões</h3>
                {selectedCompany.status === "ACTIVE" && <form onSubmit={addMember} className="flex flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3 sm:flex-row">
                  <label className="sr-only" htmlFor="company-member-email">Email da conta B2B existente</label>
                  <input id="company-member-email" type="email" required value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="Email de uma conta B2B existente" className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-xs" />
                  <label className="sr-only" htmlFor="company-member-role">Permissão do novo membro</label>
                  <select id="company-member-role" value={memberRole} onChange={(event) => setMemberRole(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-2 text-[10px]"><option value="BUYER">Comprador</option><option value="APPROVER">Aprovador</option><option value="ADMIN">Administrador</option><option value="OWNER">Proprietário</option></select>
                  <button type="submit" disabled={busy === selectedCompany.id} className="rounded-md bg-blue-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">Associar conta</button>
                  <p className="basis-full text-[10px] text-slate-600 sm:absolute sm:mt-12">Só são aceites contas B2B existentes sem associação ativa a outra empresa.</p>
                </form>}
                {selectedCompany.members.length ? selectedCompany.members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                  <div><p className="text-xs font-bold text-slate-800">{member.user.name || "Utilizador"}</p><p className="mt-0.5 text-[10px] text-slate-500">{member.user.email || "Sem email"} · {member.status === "ACTIVE" ? "Ativo" : "Inativo"}</p></div>
                  <div className="flex gap-2">
                    <select aria-label={`Função de ${member.user.name || member.user.email || "membro"}`} value={member.role} disabled={busy === selectedCompany.id} onChange={(event) => void updateMember(selectedCompany.id, member.id, { role: event.target.value })} className="rounded-md border border-slate-200 bg-white px-2 py-2 text-[10px]"><option value="OWNER">Proprietário</option><option value="ADMIN">Administrador</option><option value="BUYER">Comprador</option><option value="APPROVER">Aprovador</option></select>
                    <button type="button" disabled={busy === selectedCompany.id} onClick={() => void updateMember(selectedCompany.id, member.id, { status: member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })} className="rounded-md border border-slate-200 px-2.5 py-2 text-[10px] font-semibold disabled:opacity-50">{member.status === "ACTIVE" ? "Desativar" : "Ativar"}</button>
                  </div>
                </div>) : <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Ainda não existem membros associados.</p>}
              </div>
            </div>
            <aside className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-black">Atividade comercial</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[["Cotações", selectedCompany._count.quotes, `/admin/b2b?companyId=${selectedCompany.id}&tab=quotes`], ["Encomendas", selectedCompany._count.orders, `/admin/orders?companyId=${selectedCompany.id}`], ["Preços", selectedCompany._count.priceRules, `/admin/b2b?companyId=${selectedCompany.id}&tab=pricing`], ["Ordens de compra", selectedCompany._count.purchaseOrders, `/admin/b2b?companyId=${selectedCompany.id}&tab=quotes`]].map(([label, count, href]) => <Link key={String(label)} href={String(href)} className="rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-200"><span className="block text-[10px] font-semibold text-slate-500">{label}</span><strong className="mt-1 block text-lg">{count}</strong><span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">Abrir <ExternalLink size={11} /></span></Link>)}
                </div>
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <h3 className="inline-flex items-center gap-2 text-sm font-black"><History size={15} />Histórico de validação</h3>
                {selectedCompany.statusHistory.length ? <ol className="space-y-3">{selectedCompany.statusHistory.map((entry) => <li key={entry.id} className="border-l-2 border-slate-200 pl-3"><p className="text-xs font-bold">{entry.fromStatus ? `${statusLabels[entry.fromStatus] || entry.fromStatus} → ` : ""}{statusLabels[entry.toStatus] || entry.toStatus}</p><p className="mt-1 text-[10px] text-slate-500">{new Date(entry.createdAt).toLocaleString("pt-PT")} · {entry.actor?.name || entry.actor?.email || "Sistema"}</p>{entry.reason && <p className="mt-1 text-xs text-slate-600">{entry.reason}</p>}</li>)}</ol> : <p className="text-xs text-slate-500">Sem alterações registadas.</p>}
              </div>
              {isPendingConversion(selectedCompany.id) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">Esta empresa está associada a um pedido B2C → B2B. Aprove ou rejeite o pedido na secção de conversões para manter o estado da conta e da empresa sincronizados.</div>}
              {selectedCompany.status !== "ACTIVE" && !isPendingConversion(selectedCompany.id) && <div className="space-y-2 rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-black">Decisão de validação</h3>
                <label className="block text-[10px] font-bold text-slate-500">Motivo (obrigatório ao rejeitar)<textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} rows={3} maxLength={1000} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal" /></label>
                <div className="flex gap-2">
                  <button type="button" disabled={busy === selectedCompany.id} onClick={() => void changeCompanyStatus(selectedCompany.id, "ACTIVE")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Aprovar empresa</button>
                  <button type="button" disabled={busy === selectedCompany.id || !statusReason.trim()} onClick={() => void changeCompanyStatus(selectedCompany.id, "REJECTED")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Rejeitar</button>
                </div>
              </div>}
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
