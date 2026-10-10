"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Save, UserRound } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Profile = {
  name?: string;
  email?: string;
  provider?: string;
  accountName?: string;
  accountType?: string;
  companyDocumentPath?: string;
  personalDocumentPath?: string;
  b2bRequestStatus?: string;
  b2bReviewReason?: string | null;
  company?: {
    id: number;
    legalName: string;
    tradeName?: string | null;
    nif: string;
    email?: string | null;
    phone?: string | null;
    country?: string;
    province?: string | null;
    city?: string | null;
    address?: string | null;
    status?: string;
  } | null;
};

type CompanyForm = {
  legalName: string;
  tradeName: string;
  nif: string;
  email: string;
  phone: string;
  country: string;
  province: string;
  city: string;
  address: string;
};

const emptyCompanyForm: CompanyForm = {
  legalName: "", tradeName: "", nif: "", email: "", phone: "",
  country: "Angola", province: "", city: "", address: "",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [companyDocument, setCompanyDocument] = useState<File | null>(null);
  const [personalDocument, setPersonalDocument] = useState<File | null>(null);
  const [requestingB2B, setRequestingB2B] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);

  useEffect(() => {
    fetchWithAuth("/api/auth/me")
      .then((response) => {
        setProfile(response.data);
        setName(response.data.name || "");
        if (response.data.company) {
          setCompanyForm({
            legalName: response.data.company.legalName || "",
            tradeName: response.data.company.tradeName || "",
            nif: response.data.company.nif || "",
            email: response.data.company.email || "",
            phone: response.data.company.phone || "",
            country: response.data.company.country || "Angola",
            province: response.data.company.province || "",
            city: response.data.company.city || "",
            address: response.data.company.address || "",
          });
        }
      })
      .catch(() => setMessage("Não foi possível carregar o perfil."));
  }, []);

  useEffect(() => {
    if (profile?.b2bRequestStatus !== "PENDING") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refreshStatus = async () => {
      try {
        const response = await fetchWithAuth("/api/auth/me");
        if (active) setProfile(response.data);
      } catch {
        if (active) setMessage("Não foi possível atualizar o estado do pedido. Tente novamente mais tarde.");
      } finally {
        if (active) timer = setTimeout(refreshStatus, 15000);
      }
    };
    timer = setTimeout(refreshStatus, 15000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [profile?.b2bRequestStatus]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("name", name);
      if (companyDocument) body.append("companyDocument", companyDocument);
      if (personalDocument) body.append("personalDocument", personalDocument);
      const response = await fetchWithAuth("/api/auth/profile", {
        method: "PATCH",
        body,
      });
      setProfile((current) => current ? { ...current, ...response.data } : current);
      setMessage("Dados atualizados com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar os dados.");
    } finally {
      setSaving(false);
    }
  }

  const accountType = profile?.accountType === "B2B" ? "B2B" : "B2C";

  async function handleB2BRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!localStorage.getItem("jwt_token")) {
      setAuthRequired(true);
      setMessage("A sua sessão terminou. Inicie sessão novamente para enviar o pedido.");
      return;
    }
    if (!companyDocument || !personalDocument) {
      setMessage("Selecione os dois documentos para solicitar a conta B2B.");
      return;
    }
    setRequestingB2B(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("companyDocument", companyDocument);
      body.append("personalDocument", personalDocument);
      Object.entries(companyForm).forEach(([key, value]) => body.append(key, value));
      const response = await fetchWithAuth("/api/auth/b2b-request", { method: "POST", body });
      setProfile((current) => current ? {
        ...current,
        b2bRequestStatus: response.data.b2bRequestStatus,
        company: response.data.company || current.company,
      } : current);
      setCompanyDocument(null);
      setPersonalDocument(null);
      setMessage("Pedido B2B enviado. A sua conta será analisada.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Não foi possível enviar o pedido B2B.";
      setAuthRequired(errorMessage === "Authentication required");
      setMessage(errorMessage === "Authentication required"
        ? "A sua sessão terminou. Inicie sessão novamente para enviar o pedido."
        : errorMessage);
    } finally {
      setRequestingB2B(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1d6ac4]">Perfil</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Dados da conta</h1>
        <p className="mt-1 text-sm text-gray-500">Gerencie as suas informações pessoais e credenciais de acesso.</p>
      </div>

      <section className="card max-w-3xl p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-4 border-b border-gray-100 pb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1d6ac4] text-white">
            <UserRound size={24} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Informações pessoais</h2>
            <p className="text-sm text-gray-500">Os dados são guardados na sua conta.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-sm font-semibold text-gray-700">Nome completo</label>
            <input id="profile-name" name="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none focus:border-[#1d6ac4] focus:ring-2 focus:ring-[#1d6ac4]/15" />
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-2 block text-sm font-semibold text-gray-700">Email</label>
            <input id="profile-email" name="email" value={profile?.email || ""} readOnly className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-account-type" className="mb-2 block text-sm font-semibold text-gray-700">Tipo de cliente</label>
              {profile?.accountType === "B2B" ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">Grossista (B2B)</p>
              ) : (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">Retalhista (B2C)</p>
              )}
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold text-gray-700">Tipo de conta</span>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">{profile?.accountName} ({profile?.accountType})</p>
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold text-gray-700">Provedor</span>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">{profile?.provider || "local"}</p>
            </div>
          </div>

          {accountType === "B2B" && profile?.b2bRequestStatus !== "APPROVED" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">!</div>
                <div>
                  <h3 className="font-bold text-gray-900">Documentos obrigatórios do grossista</h3>
                  <p className="mt-1 text-sm leading-5 text-gray-600">Para validar a conta grossista, envie os dois documentos abaixo. São aceites apenas PDF, JPG ou PNG até 5 MB cada.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-700">
                  <span className="block">01. Documento da empresa</span>
                  <span className="mt-1 block text-xs font-normal text-gray-500">Certidão, alvará ou registo comercial</span>
                  <input id="b2b-company-document" name="companyDocument" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setCompanyDocument(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs font-normal" required={!profile?.companyDocumentPath} />
                  {companyDocument && <span className="mt-2 block truncate text-xs text-green-700">Selecionado: {companyDocument.name}</span>}
                </label>
                <label className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-700">
                  <span className="block">02. Documento pessoal</span>
                  <span className="mt-1 block text-xs font-normal text-gray-500">BI, cartão de cidadão ou passaporte</span>
                  <input id="b2b-personal-document" name="personalDocument" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setPersonalDocument(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs font-normal" required={!profile?.personalDocumentPath} />
                  {personalDocument && <span className="mt-2 block truncate text-xs text-green-700">Selecionado: {personalDocument.name}</span>}
                </label>
              </div>
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
            <Save size={16} aria-hidden="true" />
            {saving ? "A guardar..." : "Guardar alterações"}
          </button>
        </form>

        {accountType === "B2B" && (
          <section className="mt-8 border-t border-gray-100 pt-6" aria-labelledby="company-profile-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1d6ac4]">Conta empresarial</p>
                <h2 id="company-profile-heading" className="mt-1 text-lg font-bold text-gray-900">Dados da empresa</h2>
                <p className="mt-1 text-sm text-gray-500">Informações associadas à sua conta grossista.</p>
              </div>
              {profile?.company && (
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  profile.company.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  {profile.company.status === "ACTIVE" ? "Empresa ativa" : "Empresa em validação"}
                </span>
              )}
            </div>
            {profile?.company ? (
              <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {[
                  ["Razão social", profile.company.legalName],
                  ["Nome comercial", profile.company.tradeName],
                  ["NIF", profile.company.nif],
                  ["Email empresarial", profile.company.email],
                  ["Telefone", profile.company.phone],
                  ["País", profile.company.country],
                  ["Província / distrito", profile.company.province],
                  ["Cidade", profile.company.city],
                  ["Morada", profile.company.address],
                ].map(([label, value]) => value ? (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-gray-500">{label}</dt>
                    <dd className="mt-1 break-words text-sm text-gray-900">{value}</dd>
                  </div>
                ) : null)}
              </dl>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                <h3 className="text-sm font-bold text-amber-950">Complete o perfil da sua empresa</h3>
                <p className="mt-1 text-sm leading-5 text-amber-900">
                  A sua conta já está homologada como B2B, mas ainda não tem dados empresariais associados. Registe a empresa com a razão social e o NIF oficiais; o registo ficará pendente até à validação administrativa.
                </p>
                <Link href="/b2b/empresa" className="mt-4 inline-flex items-center justify-center rounded-lg bg-amber-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-900">
                  Preencher dados da empresa
                </Link>
              </div>
            )}
          </section>
        )}

        {accountType === "B2C" && (profile?.b2bRequestStatus !== "PENDING" || !profile.company) && (
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h3 className="font-bold text-gray-900">Precisa de uma conta grossista?</h3>
            <p className="mt-1 text-sm text-gray-600">Solicite a conversão para B2B. A equipa analisará os documentos antes de alterar o tipo da sua conta.</p>
            <form onSubmit={handleB2BRequest} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-gray-700 sm:col-span-2">Razão social
                <input value={companyForm.legalName} onChange={(event) => setCompanyForm((current) => ({ ...current, legalName: event.target.value }))} required minLength={2} maxLength={160} className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-700">Nome comercial (opcional)
                <input value={companyForm.tradeName} onChange={(event) => setCompanyForm((current) => ({ ...current, tradeName: event.target.value }))} maxLength={160} className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-700">NIF
                <input value={companyForm.nif} onChange={(event) => setCompanyForm((current) => ({ ...current, nif: event.target.value }))} required minLength={5} maxLength={40} autoComplete="off" className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-700">Email empresarial
                <input type="email" value={companyForm.email} onChange={(event) => setCompanyForm((current) => ({ ...current, email: event.target.value }))} maxLength={254} className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-700">Telefone
                <input value={companyForm.phone} onChange={(event) => setCompanyForm((current) => ({ ...current, phone: event.target.value }))} maxLength={40} className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-700">País
                <input value={companyForm.country} onChange={(event) => setCompanyForm((current) => ({ ...current, country: event.target.value }))} required maxLength={80} className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-700">Província / distrito
                <input value={companyForm.province} onChange={(event) => setCompanyForm((current) => ({ ...current, province: event.target.value }))} maxLength={80} className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-700">Cidade
                <input value={companyForm.city} onChange={(event) => setCompanyForm((current) => ({ ...current, city: event.target.value }))} maxLength={80} className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-gray-700 sm:col-span-2">Morada
                <input value={companyForm.address} onChange={(event) => setCompanyForm((current) => ({ ...current, address: event.target.value }))} maxLength={240} className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal" />
              </label>
              <label htmlFor="request-company-document" className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-700">Documento da empresa<input id="request-company-document" name="companyDocument" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setCompanyDocument(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs font-normal" required /></label>
              <label htmlFor="request-personal-document" className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-700">Documento pessoal<input id="request-personal-document" name="personalDocument" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setPersonalDocument(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs font-normal" required /></label>
              <button type="submit" disabled={requestingB2B} className="btn-primary sm:col-span-2 disabled:opacity-60">{requestingB2B ? "A enviar pedido..." : profile?.b2bRequestStatus === "REJECTED" ? "Atualizar e reenviar pedido" : "Solicitar conta B2B"}</button>
            </form>
          </div>
        )}
        {profile?.b2bRequestStatus === "PENDING" && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5" aria-live="polite">
          <h3 className="font-bold text-amber-950">Pedido B2B em análise</h3>
          <ol className="mt-3 grid gap-2 text-sm text-amber-900 sm:grid-cols-3">
            <li className="font-semibold">✓ Pedido submetido</li>
            <li className="font-semibold">● Validação dos documentos</li>
            <li className="text-amber-700">A aguardar decisão</li>
          </ol>
          <p className="mt-3 text-xs text-amber-800">Esta página atualiza automaticamente. Quando o pedido for aprovado, o tipo da conta muda para B2B.</p>
            {profile.company && <p className="mt-2 text-xs text-amber-800">Empresa em análise: <strong>{profile.company.legalName}</strong> · NIF {profile.company.nif}</p>}
        </div>
        )}
        {profile?.b2bRequestStatus === "REJECTED" && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-5" aria-live="polite">
          <h3 className="font-bold text-rose-900">Pedido B2B não aprovado</h3>
          <p className="mt-1 text-sm text-rose-800">Pode corrigir os dados e os documentos e submeter novamente nesta página.</p>
          {profile.b2bReviewReason && <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-rose-900"><strong>Motivo:</strong> {profile.b2bReviewReason}</p>}
        </div>
        )}
        {profile?.b2bRequestStatus === "APPROVED" && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5" aria-live="polite">
          <h3 className="font-bold text-emerald-900">Conta B2B aprovada</h3>
          <p className="mt-1 text-sm text-emerald-800">O seu perfil foi convertido para conta empresarial.</p>
        </div>
        )}
        {message && <p role="status" className="mt-5 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}{authRequired && <> <Link href="/login?next=%2Faccount%2Fprofile" className="font-bold underline">Iniciar sessão</Link></>}</p>}
      </section>
    </div>
  );
}