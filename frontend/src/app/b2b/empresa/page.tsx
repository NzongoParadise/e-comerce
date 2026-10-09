"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Loader2, MapPin, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type CompanyForm = {
  legalName: string;
  tradeName: string;
  nif: string;
  email: string;
  phone: string;
  province: string;
  city: string;
  address: string;
  country: "Angola" | "Portugal";
};

type Company = CompanyForm & { id: number; status: string; createdAt?: string; updatedAt?: string };
type CompanyResponse = { data: Company | null; role?: string };

const emptyForm: CompanyForm = {
  legalName: "", tradeName: "", nif: "", email: "", phone: "", province: "", city: "", address: "", country: "Angola",
};

const statusStyle: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
  SUSPENDED: "bg-slate-100 text-slate-700 ring-slate-200",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Ativa", PENDING: "Em análise", REJECTED: "Recusada", SUSPENDED: "Suspensa",
};

function toForm(company: Company): CompanyForm {
  return {
    legalName: company.legalName || "", tradeName: company.tradeName || "", nif: company.nif || "",
    email: company.email || "", phone: company.phone || "", province: company.province || "",
    city: company.city || "", address: company.address || "", country: company.country === "Portugal" ? "Portugal" : "Angola",
  };
}

function Field({ label, name, value, onChange, required = false, type = "text", disabled = false }: {
  label: string; name: keyof CompanyForm; value: string; onChange: (name: keyof CompanyForm, value: string) => void;
  required?: boolean; type?: string; disabled?: boolean;
}) {
  return <label className="block text-xs font-bold text-slate-600">{label}{required && <span className="ml-1 text-rose-500">*</span>}
    <input name={name} type={type} value={value} required={required} disabled={disabled} onChange={(event) => onChange(name, event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 disabled:text-slate-500" />
  </label>;
}

export default function B2BCompanyPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadCompany() {
    setLoading(true);
    setError("");
    try {
      const response: CompanyResponse = await fetchWithAuth("/api/b2b/company", { cache: "no-store" });
      setLoadFailed(false);
      setCompany(response.data);
      setRole(response.role || "");
      setForm(response.data ? toForm(response.data) : emptyForm);
    } catch (loadError) {
      setLoadFailed(true);
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os dados da empresa.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCompany(); }, []);

  function updateField(name: keyof CompanyForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response: CompanyResponse = await fetchWithAuth("/api/b2b/company", {
        method: company ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email: form.email.trim() || null }),
      });
      if (!response.data) throw new Error("A empresa não foi devolvida pelo serviço.");
      setCompany(response.data);
      setRole(response.role || (company ? role : "OWNER"));
      setForm(toForm(response.data));
      setNotice(company ? "Dados da empresa atualizados." : "Empresa registada. Aguardamos a validação da equipa.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar os dados da empresa.");
    } finally {
      setSaving(false);
    }
  }

  const canEdit = !loadFailed && (!company || role === "OWNER");
  const currentStatus = company?.status || "PENDING";

  if (loading) return <div className="space-y-5"><div className="h-20 animate-pulse rounded-xl bg-slate-200" /><div className="h-64 animate-pulse rounded-xl bg-slate-200" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Empresa · Perfil</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Dados da empresa</h1><p className="mt-1 text-sm text-slate-500">Identificação, contacto e morada usados nas cotações e encomendas empresariais.</p></div>
        <button type="button" onClick={() => void loadCompany()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Atualizar</button>
      </div>

      {notice && <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{notice}</div>}
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Building2 size={20} /></span><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{company ? `Empresa #${company.id}` : "Novo registo"}</p><h2 className="mt-0.5 text-base font-black text-slate-950">{company?.tradeName || company?.legalName || "Registar empresa"}</h2></div></div>
          {company && <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black ring-1 ${statusStyle[company.status] || statusStyle.SUSPENDED}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel[company.status] || company.status}</span>}
        </div>

        {company?.status === "PENDING" && <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">O registo está em análise. Pode rever os dados, mas as compras empresariais ficam disponíveis após aprovação.</div>}
        {company?.status === "REJECTED" && <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-800">O registo da empresa não foi aprovado. Confirme os dados ou fale com o suporte para obter ajuda.</div>}
        {company?.status === "SUSPENDED" && <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-700">O acesso empresarial está suspenso. Contacte o suporte para mais informações.</div>}

        {!company && <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">Preencha os dados oficiais da empresa. O registo ficará pendente até à validação da equipa comercial.</div>}

        <form onSubmit={saveCompany} className="mt-6 space-y-6">
          <fieldset disabled={!canEdit || saving} className="space-y-6 disabled:opacity-90">
            <section>
              <div className="mb-4"><h3 className="text-sm font-black text-slate-900">Identificação e contacto</h3><p className="mt-1 text-xs text-slate-500">Use os dados fiscais e comerciais oficiais.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Razão social" name="legalName" value={form.legalName} onChange={updateField} required disabled={!canEdit} />
                <Field label="Nome comercial" name="tradeName" value={form.tradeName} onChange={updateField} disabled={!canEdit} />
                <Field label="NIF" name="nif" value={form.nif} onChange={updateField} required disabled={!canEdit || Boolean(company)} />
                <label className="block text-xs font-bold text-slate-600">País de operação<span className="ml-1 text-rose-500">*</span><select value={form.country} required disabled={!canEdit} onChange={(event) => updateField("country", event.target.value as "Angola" | "Portugal")} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 disabled:text-slate-500"><option value="Angola">Angola · AOA / MULTICAIXA</option><option value="Portugal">Portugal · EUR / Stripe</option></select></label>
                <Field label="Email comercial" name="email" value={form.email} onChange={updateField} type="email" disabled={!canEdit} />
                <Field label="Telefone" name="phone" value={form.phone} onChange={updateField} type="tel" disabled={!canEdit} />
              </div>
            </section>

            <section className="border-t border-slate-100 pt-6">
              <div className="mb-4 flex items-center gap-2"><MapPin size={16} className="text-blue-700" /><div><h3 className="text-sm font-black text-slate-900">Morada da empresa</h3><p className="mt-1 text-xs text-slate-500">Endereço principal para documentos e contacto.</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Província" name="province" value={form.province} onChange={updateField} disabled={!canEdit} />
                <Field label="Cidade" name="city" value={form.city} onChange={updateField} disabled={!canEdit} />
                <div className="sm:col-span-2"><Field label="Morada" name="address" value={form.address} onChange={updateField} disabled={!canEdit} /></div>
              </div>
            </section>
          </fieldset>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-[10px] leading-4 text-slate-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-slate-400" /><span>{company ? `O seu perfil na empresa: ${role || "Membro"}.` : "Os dados serão usados para validar o perfil empresarial."}{company && role !== "OWNER" && " Apenas o responsável da empresa pode editar estes dados."}</span></div>
            {canEdit && <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? "A guardar..." : company ? "Guardar alterações" : "Registar empresa"}</button>}
          </div>
        </form>
      </section>
    </div>
  );
}
