"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Edit3, MapPin, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Address = {
  id: number;
  label: string;
  recipient: string;
  phone: string;
  country: string;
  province: string;
  city: string;
  address: string;
  postalCode?: string;
  notes?: string;
  isDefault: boolean;
};

const emptyAddress = {
  label: "Casa",
  recipient: "",
  phone: "",
  country: "Angola",
  province: "Luanda",
  city: "Luanda",
  address: "",
  postalCode: "",
  notes: "",
  isDefault: false,
};

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState(emptyAddress);
  const [editing, setEditing] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth("/api/account/addresses");
      setAddresses(response.data || []);
    } catch {
      setError("Não foi possível carregar os seus endereços.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function update(key: keyof typeof emptyAddress, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setEditing(null);
    setForm({ ...emptyAddress });
    setMessage("");
    setError("");
    setOpen(true);
  }

  function edit(address: Address) {
    setEditing(address.id);
    setForm({ ...emptyAddress, ...address });
    setMessage("");
    setError("");
    setOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setOpen(false);
    setEditing(null);
    setForm({ ...emptyAddress });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await fetchWithAuth(
        editing ? "/api/account/addresses/" + editing : "/api/account/addresses",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      setOpen(false);
      setEditing(null);
      setForm({ ...emptyAddress });
      setMessage(editing ? "Endereço atualizado com sucesso." : "Endereço guardado com sucesso.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar o endereço.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Remover este endereço da sua conta?")) return;
    setError("");
    try {
      await fetchWithAuth("/api/account/addresses/" + id, { method: "DELETE" });
      setMessage("Endereço removido.");
      await load();
    } catch {
      setError("Não foi possível remover o endereço.");
    }
  }

  async function makeDefault(id: number) {
    setError("");
    try {
      await fetchWithAuth("/api/account/addresses/" + id + "/default", { method: "POST" });
      setMessage("Endereço principal atualizado.");
      await load();
    } catch {
      setError("Não foi possível definir o endereço principal.");
    }
  }

  const defaultAddress = useMemo(() => addresses.find((address) => address.isDefault) || addresses[0] || null, [addresses]);

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">Conta · Entrega</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Os meus endereços</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Guarde moradas de entrega e escolha rapidamente onde cada encomenda deve ser recebida.</p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary"><Plus size={16}/> Novo endereço</button>
      </header>

      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div>}

      {defaultAddress && (
        <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-slate-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#1d6ac4] shadow-sm"><MapPin size={19}/></span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#1d6ac4]">Morada predefinida</p>
                <p className="mt-1 text-sm font-black text-slate-950">{defaultAddress.label}</p>
                <p className="mt-1 text-xs text-slate-600">{defaultAddress.city}, {defaultAddress.province} · {defaultAddress.country}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500"><ShieldCheck size={14} className="text-emerald-600"/> Usada por defeito no checkout</div>
          </div>
        </section>
      )}

      {open && (
        <form onSubmit={submit} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><p className="section-kicker">Dados de entrega</p><h2 className="mt-1 text-base font-black text-slate-950">{editing ? "Editar endereço" : "Novo endereço"}</h2></div>
            <button type="button" onClick={closeForm} aria-label="Fechar formulário" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={17}/></button>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Etiqueta" value={form.label} required placeholder="Casa, trabalho..." onChange={(value) => update("label", value)} />
            <Field label="Destinatário" value={form.recipient} required autoComplete="name" placeholder="Nome completo" onChange={(value) => update("recipient", value)} />
            <Field label="Telefone" value={form.phone} required autoComplete="tel" placeholder="+244 ..." onChange={(value) => update("phone", value)} />
            <label className="block text-xs font-bold text-slate-600">País<span className="ml-1 text-rose-500">*</span>
              <select required value={form.country} onChange={(event) => update("country", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-[#1d6ac4] focus:ring-4 focus:ring-blue-50">
                <option>Angola</option>
                <option>Portugal</option>
              </select>
            </label>
            <Field label="Província / Distrito" value={form.province} placeholder="Ex.: Luanda" onChange={(value) => update("province", value)} />
            <Field label="Cidade" value={form.city} required placeholder="Ex.: Luanda" onChange={(value) => update("city", value)} />
            <div className="sm:col-span-2"><Field label="Morada" value={form.address} required placeholder="Rua, avenida, número e complemento" onChange={(value) => update("address", value)} /></div>
            <Field label="Código postal" value={form.postalCode || ""} placeholder="Opcional" onChange={(value) => update("postalCode", value)} />
            <Field label="Instruções de entrega" value={form.notes || ""} placeholder="Opcional" onChange={(value) => update("notes", value)} />
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={form.isDefault} onChange={(event) => update("isDefault", event.target.checked)} className="accent-[#1d6ac4]"/>
              Definir como morada principal
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={closeForm} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50"><Check size={15}/>{saving ? "A guardar..." : "Guardar endereço"}</button>
          </div>
        </form>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><p className="section-kicker">Moradas guardadas</p><h2 className="mt-1 text-base font-black text-slate-950">{addresses.length} endereço(s)</h2></div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2"><div className="card h-48 animate-pulse"/><div className="card h-48 animate-pulse"/></div>
        ) : addresses.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {addresses.map((address) => (
              <article key={address.id} className={"card p-5 transition " + (address.isDefault ? "border-[#1d6ac4]/30 shadow-[0_12px_30px_rgba(29,106,196,.08)]" : "hover:-translate-y-0.5")}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + (address.isDefault ? "bg-blue-50 text-[#1d6ac4]" : "bg-slate-100 text-slate-500")}><MapPin size={18}/></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-black text-slate-950">{address.label}</h3>
                        {address.isDefault && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">Principal</span>}
                      </div>
                      <p className="mt-3 text-xs font-bold text-slate-800">{address.recipient}</p>
                      <p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-500">{address.address}{address.city ? ", " + address.city : ""}{address.province ? ", " + address.province : ""}{address.country ? ", " + address.country : ""}</p>
                      <p className="mt-2 text-[11px] font-semibold text-slate-600">{address.phone}</p>
                      {address.notes && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500">Nota: {address.notes}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" aria-label="Editar endereço" title="Editar endereço" onClick={() => edit(address)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-[#1d6ac4]"><Edit3 size={15}/></button>
                    <button type="button" aria-label="Remover endereço" title="Remover endereço" onClick={() => void remove(address.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15}/></button>
                  </div>
                </div>
                {!address.isDefault && <button type="button" onClick={() => void makeDefault(address.id)} className="mt-4 border-t border-slate-100 pt-3 text-[10px] font-black text-[#1d6ac4] hover:underline">Definir como principal</button>}
              </article>
            ))}
          </div>
        ) : (
          <div className="card border-dashed p-12 text-center">
            <MapPin size={32} className="mx-auto text-slate-300"/>
            <h3 className="mt-3 text-sm font-black text-slate-800">Ainda não tem endereços guardados</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Adicione a primeira morada para acelerar o checkout das próximas compras.</p>
            <button type="button" onClick={startCreate} className="btn-primary mt-4"><Plus size={15}/> Adicionar morada</button>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required = false, autoComplete }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean; autoComplete?: string }) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      {label}{required && <span className="ml-1 text-rose-500">*</span>}
      <input required={required} value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-[#1d6ac4] focus:ring-4 focus:ring-blue-50"/>
    </label>
  );
}
