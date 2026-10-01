"use client";

import { FormEvent, useEffect, useState } from "react";
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
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [companyDocument, setCompanyDocument] = useState<File | null>(null);
  const [personalDocument, setPersonalDocument] = useState<File | null>(null);
  const [requestingB2B, setRequestingB2B] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWithAuth("/api/auth/me")
      .then((response) => {
        setProfile(response.data);
        setName(response.data.name || "");
      })
      .catch(() => setMessage("Não foi possível carregar o perfil."));
  }, []);

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
    } catch {
      setMessage("Não foi possível atualizar os dados.");
    } finally {
      setSaving(false);
    }
  }

  const accountType = profile?.accountType === "B2B" ? "B2B" : "B2C";

  async function handleB2BRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      const response = await fetchWithAuth("/api/auth/b2b-request", { method: "POST", body });
      setProfile((current) => current ? { ...current, b2bRequestStatus: response.data.b2bRequestStatus } : current);
      setMessage("Pedido B2B enviado. A sua conta será analisada.");
    } catch {
      setMessage("Não foi possível enviar o pedido B2B.");
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

      <section className="card max-w-2xl p-6 sm:p-8">
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
            <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none focus:border-[#1d6ac4] focus:ring-2 focus:ring-[#1d6ac4]/15" />
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-2 block text-sm font-semibold text-gray-700">Email</label>
            <input id="profile-email" value={profile?.email || ""} readOnly className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500" />
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

          {accountType === "B2C" && profile?.b2bRequestStatus !== "PENDING" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <h3 className="font-bold text-gray-900">Precisa de uma conta grossista?</h3>
              <p className="mt-1 text-sm text-gray-600">Solicite a conversão para B2B. A mudança só acontece depois da validação dos documentos.</p>
              <form onSubmit={handleB2BRequest} className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-700">Documento da empresa<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setCompanyDocument(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs font-normal" required /></label>
                <label className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-700">Documento pessoal<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setPersonalDocument(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs font-normal" required /></label>
                <button type="submit" disabled={requestingB2B} className="btn-primary sm:col-span-2 disabled:opacity-60">{requestingB2B ? "A enviar pedido..." : "Solicitar conta B2B"}</button>
              </form>
            </div>
          )}
          {accountType === "B2C" && profile?.b2bRequestStatus === "PENDING" && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">O pedido de conta B2B está pendente de análise.</p>
          )}

          {accountType === "B2B" && (
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
                  <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setCompanyDocument(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs font-normal" required={!profile?.companyDocumentPath} />
                  {companyDocument && <span className="mt-2 block truncate text-xs text-green-700">Selecionado: {companyDocument.name}</span>}
                </label>
                <label className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-700">
                  <span className="block">02. Documento pessoal</span>
                  <span className="mt-1 block text-xs font-normal text-gray-500">BI, cartão de cidadão ou passaporte</span>
                  <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setPersonalDocument(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs font-normal" required={!profile?.personalDocumentPath} />
                  {personalDocument && <span className="mt-2 block truncate text-xs text-green-700">Selecionado: {personalDocument.name}</span>}
                </label>
              </div>
            </div>
          )}

          {message && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>}
          <button type="submit" disabled={saving} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
            <Save size={16} aria-hidden="true" />
            {saving ? "A guardar..." : "Guardar alterações"}
          </button>
        </form>
      </section>
    </div>
  );
}