"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bell, Building2, Check, ChevronRight, Image, KeyRound, LockKeyhole, MapPin, MonitorSmartphone, Save, ShieldCheck, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Tab = "profile" | "company" | "security" | "notifications" | "preferences";
type Profile = { name?: string; email?: string; accountName?: string; accountType?: string; provider?: string };
type CompanyDetails = {
  name: string;
  taxNumber: string;
  sector: string;
  website: string;
  description: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
};

const emptyCompany: CompanyDetails = {
  name: "", taxNumber: "", sector: "Tecnologia e Telecomunicações", website: "", description: "",
  contactName: "", contactRole: "Administrador", contactEmail: "", contactPhone: "",
  country: "Angola", province: "Luanda", city: "Luanda", address: "", postalCode: "",
};

const tabs: { id: Tab; label: string; icon: typeof UserRound }[] = [
  { id: "profile", label: "Perfil", icon: UserRound },
  { id: "company", label: "Empresa", icon: Building2 },
  { id: "security", label: "Segurança", icon: ShieldCheck },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "preferences", label: "Preferências", icon: SlidersHorizontal },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<CompanyDetails>(emptyCompany);
  const [logo, setLogo] = useState("");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [promotions, setPromotions] = useState(() => typeof window === "undefined" || localStorage.getItem("tg_promotions") !== "false");
  const [updates, setUpdates] = useState(() => typeof window === "undefined" || localStorage.getItem("tg_updates") !== "false");
  const [launches, setLaunches] = useState(() => typeof window !== "undefined" && localStorage.getItem("tg_launches") === "true");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWithAuth("/api/auth/me").then((response) => {
      setProfile(response.data);
      setName(response.data.name || "");
      setCompany((current) => ({ ...current, name: response.data.accountName || "", contactName: response.data.name || "", contactEmail: response.data.email || "" }));
    }).catch(() => setMessage("Não foi possível carregar as definições."));
  }, []);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      const saved = localStorage.getItem("tg_company_details");
      if (saved) {
        try { setCompany((current) => ({ ...current, ...JSON.parse(saved) })); } catch { /* Ignore malformed local preferences. */ }
      }
      setLogo(localStorage.getItem("tg_company_logo") || "");
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetchWithAuth("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setProfile((current) => current ? { ...current, ...response.data } : current);
      setMessage("Perfil atualizado com sucesso.");
    } catch { setMessage("Não foi possível atualizar o perfil."); } finally { setSaving(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setMessage("As palavras-passe não coincidem."); return; }
    setSaving(true);
    try {
      await fetchWithAuth("/api/auth/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setMessage("Palavra-passe alterada com sucesso.");
    } catch { setMessage("Não foi possível alterar a palavra-passe."); } finally { setSaving(false); }
  }

  function savePreferences() {
    localStorage.setItem("tg_promotions", String(promotions));
    localStorage.setItem("tg_updates", String(updates));
    localStorage.setItem("tg_launches", String(launches));
    setMessage("Preferências guardadas.");
  }

  function updateCompany(field: keyof CompanyDetails, value: string) {
    setCompany((current) => ({ ...current, [field]: value }));
  }

  function saveCompany(section: keyof CompanyDetails | "all") {
    localStorage.setItem("tg_company_details", JSON.stringify(company));
    localStorage.setItem("tg_company_logo", logo);
    setMessage(section === "all" ? "Dados da empresa guardados." : "Secção atualizada com sucesso.");
  }

  function handleLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1d6ac4]">A minha conta</p><h1 className="mt-2 text-2xl font-bold text-gray-900">Definições da conta</h1><p className="mt-1 text-sm text-gray-500">Gerir as informações da sua conta, preferências e segurança.</p></div>
      <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-5">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => { setActiveTab(id); setMessage(""); }} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-xs font-bold transition ${activeTab === id ? "border-[#1d6ac4] bg-blue-50 text-[#1d6ac4]" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}><Icon size={16} />{label}</button>)}</div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="card p-6 sm:p-8">
          {activeTab === "profile" && <form onSubmit={saveProfile} className="space-y-5"><SectionTitle icon={UserRound} title="Informações pessoais" text="Atualize os seus dados pessoais e informações de contacto." /><div className="flex items-center gap-4 rounded-lg bg-blue-50 p-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-700 text-xl font-black text-white">{(profile?.name || "TG").split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><p className="font-bold text-gray-900">{profile?.name || "João da Silva"}</p><p className="text-sm text-gray-500">{profile?.email || "joao.silva@email.com"}</p><span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-green-700"><Check size={13} /> Conta verificada</span></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome completo"><input value={name} onChange={(event) => setName(event.target.value)} required className="settings-input" /></Field><Field label="E-mail"><input value={profile?.email || ""} readOnly className="settings-input bg-gray-50 text-gray-500" /></Field><Field label="Telefone"><input defaultValue="+244 923 000 000" className="settings-input" /></Field><Field label="Cargo"><input defaultValue="Director de Compras" className="settings-input" /></Field><Field label="Idioma preferido"><select className="settings-input"><option>Português</option><option>English</option></select></Field><Field label="Fuso horário"><select className="settings-input"><option>(UTC+01:00) Luanda</option><option>(UTC+00:00) Lisboa</option></select></Field></div><SaveButton saving={saving} /></form>}
          {activeTab === "company" && <div className="space-y-5"><SectionTitle icon={Building2} title="Dados da empresa" text="Mantenha as informações da sua empresa sempre atualizadas." /><CompanySection title="Informações da empresa" icon={Building2} onSave={() => saveCompany("all")}><div className="grid gap-4 sm:grid-cols-[130px_1fr] sm:items-start"><div className="rounded-lg border border-gray-200 bg-blue-50 p-3 text-center"><div className="flex h-24 items-center justify-center overflow-hidden rounded bg-white">{logo ? <img src={logo} alt="Logótipo da empresa" className="max-h-full max-w-full object-contain" /> : <Building2 size={38} className="text-[#1d6ac4]" />}</div><label className="mt-3 flex cursor-pointer items-center justify-center gap-1 rounded border border-[#1d6ac4] bg-white px-2 py-2 text-[10px] font-bold text-[#1d6ac4]"><Image size={12} /> Alterar logótipo<input type="file" accept="image/png,image/jpeg" onChange={handleLogo} className="hidden" /></label><p className="mt-2 text-[9px] text-gray-500">PNG, JPG (máx. 2MB)</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome da empresa *"><input value={company.name} onChange={(event) => updateCompany("name", event.target.value)} className="settings-input" /></Field><Field label="NIF da empresa *"><input value={company.taxNumber} onChange={(event) => updateCompany("taxNumber", event.target.value)} className="settings-input" /></Field><Field label="Sector de atividade *"><select value={company.sector} onChange={(event) => updateCompany("sector", event.target.value)} className="settings-input"><option>Tecnologia e Telecomunicações</option><option>Comércio</option><option>Serviços</option><option>Indústria</option></select></Field><Field label="Website (opcional)"><input value={company.website} onChange={(event) => updateCompany("website", event.target.value)} placeholder="https://" className="settings-input" /></Field><div className="sm:col-span-2"><Field label="Descrição da empresa (opcional)"><textarea value={company.description} onChange={(event) => updateCompany("description", event.target.value)} rows={3} className="settings-input resize-none" /></Field></div></div></div></CompanySection><CompanySection title="Contactos principais" icon={UserRound} onSave={() => saveCompany("all")}><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome do responsável *"><input value={company.contactName} onChange={(event) => updateCompany("contactName", event.target.value)} className="settings-input" /></Field><Field label="Cargo *"><input value={company.contactRole} onChange={(event) => updateCompany("contactRole", event.target.value)} className="settings-input" /></Field><Field label="E-mail empresarial *"><input type="email" value={company.contactEmail} onChange={(event) => updateCompany("contactEmail", event.target.value)} className="settings-input" /></Field><Field label="Telefone *"><input value={company.contactPhone} onChange={(event) => updateCompany("contactPhone", event.target.value)} className="settings-input" /></Field></div></CompanySection><CompanySection title="Endereço da empresa" icon={MapPin} onSave={() => saveCompany("all")}><div className="grid gap-4 sm:grid-cols-3"><Field label="País *"><select value={company.country} onChange={(event) => updateCompany("country", event.target.value)} className="settings-input"><option>Angola</option><option>Portugal</option></select></Field><Field label="Província *"><input value={company.province} onChange={(event) => updateCompany("province", event.target.value)} className="settings-input" /></Field><Field label="Município *"><input value={company.city} onChange={(event) => updateCompany("city", event.target.value)} className="settings-input" /></Field><div className="sm:col-span-2"><Field label="Endereço *"><input value={company.address} onChange={(event) => updateCompany("address", event.target.value)} className="settings-input" /></Field></div><Field label="Código postal"><input value={company.postalCode} onChange={(event) => updateCompany("postalCode", event.target.value)} className="settings-input" /></Field></div></CompanySection></div>}
          {activeTab === "security" && <form onSubmit={changePassword} className="space-y-5"><SectionTitle icon={ShieldCheck} title="Segurança da conta" text="Mantenha a sua conta protegida." /><div className="rounded-lg border border-green-100 bg-green-50 p-4 text-sm text-green-800"><ShieldCheck size={18} className="mb-1" /> A sua sessão usa autenticação segura.</div><PasswordField label="Palavra-passe atual" value={currentPassword} onChange={setCurrentPassword} visible={showPasswords} /><PasswordField label="Nova palavra-passe" value={newPassword} onChange={setNewPassword} visible={showPasswords} /><PasswordField label="Confirmar nova palavra-passe" value={confirmPassword} onChange={setConfirmPassword} visible={showPasswords} /><button type="button" onClick={() => setShowPasswords(!showPasswords)} className="text-xs font-semibold text-[#1d6ac4]">{showPasswords ? "Ocultar palavras-passe" : "Mostrar palavras-passe"}</button><SaveButton saving={saving} label="Guardar alterações" /></form>}
          {activeTab === "notifications" && <div className="space-y-4"><SectionTitle icon={Bell} title="Preferências de comunicação" text="Escolha que comunicações deseja receber." /><Preference label="Promoções e ofertas especiais" text="Seja o primeiro a conhecer as nossas promoções." value={promotions} onChange={setPromotions} /><Preference label="Atualizações de encomendas" text="Receba notificações sobre o estado das suas encomendas." value={updates} onChange={setUpdates} /><Preference label="Novos produtos e lançamentos" text="Novidades das suas marcas preferidas." value={launches} onChange={setLaunches} /><SaveButton saving={false} label="Guardar preferências" onClick={savePreferences} /></div>}
          {activeTab === "preferences" && <div className="space-y-5"><SectionTitle icon={SlidersHorizontal} title="Preferências" text="Personalize a sua experiência TechGlobal." /><Field label="Idioma"><select className="settings-input"><option>Português</option><option>English</option></select></Field><Field label="Mercado predefinido"><select className="settings-input"><option>Angola (Kz)</option><option>Portugal (€)</option></select></Field><SaveButton saving={false} label="Guardar preferências" onClick={() => setMessage("Preferências guardadas.")} /></div>}
          {message && <p role="status" className="mt-5 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>}
        </section>
        <aside className="space-y-4"><div className="card overflow-hidden"><div className="h-24 bg-gradient-to-br from-blue-100 to-blue-50" /><div className="p-5"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600"><Check size={18} /></span><div><h2 className="font-bold text-gray-900">Empresa verificada</h2><p className="text-[11px] text-gray-500">A sua empresa está verificada e tem acesso a condições especiais.</p></div></div></div></div><div className="card p-5"><SectionTitle icon={ShieldCheck} title="Segurança da conta" text="Mantenha a sua conta segura." /><SideAction icon={KeyRound} label="Alterar palavra-passe" /><SideAction icon={ShieldCheck} label="Autenticação em dois factores" badge="Activo" /><SideAction icon={MonitorSmartphone} label="Dispositivos activos" /><SideAction icon={LockKeyhole} label="Sessões recentes" /></div><div className="card p-5"><SectionTitle icon={Bell} title="Preferências de comunicação" text="Escolha que comunicações pretende receber." /><Preference label="Promoções e ofertas" text="Receber novidades e descontos." value={promotions} onChange={setPromotions} /><Preference label="Novos produtos" text="Conhecer novos lançamentos." value={launches} onChange={setLaunches} /><Preference label="Atualizações de encomendas" text="Estado das suas compras." value={updates} onChange={setUpdates} /></div><button type="button" onClick={() => setMessage("Para eliminar a conta, contacte o suporte.")} className="flex w-full items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-4 text-left text-red-600"><span className="flex items-center gap-2"><Trash2 size={18} /><span><strong className="block text-sm">Eliminar conta</strong><small className="text-[10px]">Esta ação é irreversível.</small></span></span><ChevronRight size={16} /></button></aside>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, text }: { icon: typeof UserRound; title: string; text: string }) { return <div className="mb-5 flex items-start gap-3"><Icon className="mt-0.5 text-[#1d6ac4]" size={21} /><div><h2 className="font-bold text-gray-900">{title}</h2><p className="text-sm text-gray-500">{text}</p></div></div>; }
function CompanySection({ title, icon: Icon, onSave, children }: { title: string; icon: typeof UserRound; onSave: () => void; children: React.ReactNode }) { return <section className="rounded-lg border border-gray-200 bg-white p-5"><div className="mb-5 flex items-center justify-between gap-3 border-b border-gray-100 pb-4"><div className="flex items-center gap-2"><Icon size={18} className="text-[#1d6ac4]" /><h2 className="font-bold text-gray-900">{title}</h2></div><button type="button" onClick={onSave} className="btn-primary px-3 py-2 text-xs"><Save size={14} /> Guardar alterações</button></div>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-semibold text-gray-700">{label}</span>{children}</label>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-t border-gray-100 py-4 text-sm"><span className="font-semibold text-gray-700">{label}</span><span className="text-right text-gray-500">{value}</span></div>; }
function SideAction({ icon: Icon, label, badge }: { icon: typeof UserRound; label: string; badge?: string }) { return <button type="button" className="flex w-full items-center justify-between border-t border-gray-100 py-3 text-left text-xs font-semibold text-gray-700"><span className="flex items-center gap-2"><Icon size={15} className="text-[#1d6ac4]" />{label}</span><span className="flex items-center gap-1 text-gray-400">{badge && <small className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-700">{badge}</small>}<ChevronRight size={14} /></span></button>; }
function PasswordField({ label, value, onChange, visible }: { label: string; value: string; onChange: (value: string) => void; visible: boolean }) { return <Field label={label}><div className="relative"><LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} required minLength={8} className="settings-input pl-9 pr-3" /></div></Field>; }
function SaveButton({ saving, label = "Guardar alterações", onClick }: { saving: boolean; label?: string; onClick?: () => void }) { return <button type={onClick ? "button" : "submit"} onClick={onClick} disabled={saving} className="btn-primary disabled:opacity-60"><Save size={16} />{saving ? "A guardar..." : label}</button>; }
function Preference({ label, text, value, onChange }: { label: string; text: string; value: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center justify-between gap-4 border-t border-gray-100 py-4"><div><p className="text-sm font-semibold text-gray-800">{label}</p><p className="text-xs text-gray-500">{text}</p></div><button type="button" onClick={() => onChange(!value)} aria-pressed={value} className={`relative h-6 w-11 rounded-full transition ${value ? "bg-[#1d6ac4]" : "bg-gray-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${value ? "left-6" : "left-1"}`} /></button></div>; }