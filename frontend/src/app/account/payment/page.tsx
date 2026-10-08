"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, CreditCard, LockKeyhole, Pencil, Plus, Smartphone, Trash2, WalletCards } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type PaymentMethod = { id: number; type: string; label: string; lastFour?: string; phoneNumber?: string; isDefault: boolean };

const labels: Record<string, string> = {
  MULTICAIXA_REFERENCE: "Referência Multicaixa",
  MULTICAIXA_EXPRESS: "Multicaixa Express",
  CARD: "Cartão",
  MBWAY: "MB WAY",
  TRANSFER: "Transferência bancária",
};

const descriptions: Record<string, string> = {
  MULTICAIXA_REFERENCE: "Pague através de uma referência Multicaixa.",
  MULTICAIXA_EXPRESS: "Autorize o pagamento na aplicação Multicaixa Express.",
  CARD: "Guarde o método através da infraestrutura segura da Stripe.",
  MBWAY: "Associe o número utilizado no MB WAY.",
  TRANSFER: "Método utilizado para transferências bancárias.",
};

const emptyForm = {
  type: "CARD",
  label: "",
  lastFour: "",
  phoneNumber: "",
  isDefault: false,
};

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth("/api/account/payment-methods");
      setMethods(response.data || []);
    } catch {
      setError("Não foi possível carregar os seus métodos de pagamento.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cardStatus = new URLSearchParams(window.location.search).get("card");
    if (cardStatus === "added") setMessage("Cartão configurado com segurança. A lista pode demorar alguns instantes a atualizar.");
    if (cardStatus === "cancelled") setMessage("Adição do cartão cancelada.");
    void load();
  }, []);

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setOpen(false);
  }

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setMessage("");
    setError("");
    setOpen(true);
  }

  function editMethod(method: PaymentMethod) {
    setEditingId(method.id);
    setForm({
      type: method.type,
      label: method.label,
      lastFour: method.lastFour ?? "",
      phoneNumber: method.phoneNumber ?? "",
      isDefault: method.isDefault,
    });
    setMessage("");
    setError("");
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...form,
        lastFour: form.type === "CARD" ? undefined : form.lastFour || undefined,
        phoneNumber: form.type === "MBWAY" || form.type === "MULTICAIXA_EXPRESS" ? form.phoneNumber || undefined : undefined,
      };

      if (form.type === "CARD" && !editingId) {
        const response = await fetchWithAuth("/api/account/payment-methods/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: form.label.trim(), isDefault: form.isDefault }),
        });
        window.location.assign(response.data.checkoutUrl);
        return;
      }

      const route = editingId ? "/api/account/payment-methods/" + editingId : "/api/account/payment-methods";
      await fetchWithAuth(route, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      resetForm();
      setMessage(editingId ? "Método atualizado com sucesso." : "Método adicionado com sucesso.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar o método.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Remover este método de pagamento da sua conta?")) return;
    setError("");
    try {
      await fetchWithAuth("/api/account/payment-methods/" + id, { method: "DELETE" });
      setMessage("Método removido.");
      await load();
    } catch {
      setError("Não foi possível remover o método.");
    }
  }

  async function makeDefault(id: number) {
    setError("");
    try {
      await fetchWithAuth("/api/account/payment-methods/" + id + "/default", { method: "POST" });
      setMessage("Método principal atualizado.");
      await load();
    } catch {
      setError("Não foi possível definir o método principal.");
    }
  }

  const needsPhone = form.type === "MBWAY" || form.type === "MULTICAIXA_EXPRESS";

  const methodGroups = useMemo(() => ({
    cards: methods.filter((method) => method.type === "CARD"),
    mobile: methods.filter((method) => method.type === "MBWAY" || method.type === "MULTICAIXA_EXPRESS"),
    other: methods.filter((method) => !["CARD", "MBWAY", "MULTICAIXA_EXPRESS"].includes(method.type)),
  }), [methods]);

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">Conta · Pagamentos</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Métodos de pagamento</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Escolha um método para facilitar futuras compras. Os dados sensíveis de cartão são processados pelo fornecedor de pagamentos.</p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary"><Plus size={16}/> Adicionar método</button>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <InfoCard icon={LockKeyhole} title="Dados protegidos" detail="O número completo e o CVV do cartão não são apresentados nesta área." />
        <InfoCard icon={WalletCards} title="Método principal" detail="Escolha o método usado por defeito no processo de pagamento." />
        <InfoCard icon={ChevronRight} title="Mercados" detail="Os métodos disponíveis variam conforme Angola ou Portugal." />
      </section>

      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div>}

      {open && (
        <form onSubmit={submit} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><p className="section-kicker">Configuração</p><h2 className="mt-1 text-base font-black text-slate-950">{editingId ? "Editar método" : "Adicionar método"}</h2></div>
            <button type="button" onClick={resetForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar"><span className="text-lg leading-none">×</span></button>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-600">
              Tipo
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-[#1d6ac4] focus:ring-4 focus:ring-blue-50">
                <option value="CARD">Cartão</option>
                <option value="MBWAY">MB WAY</option>
                <option value="MULTICAIXA_EXPRESS">Multicaixa Express</option>
                <option value="MULTICAIXA_REFERENCE">Referência Multicaixa</option>
                <option value="TRANSFER">Transferência bancária</option>
              </select>
            </label>

            <label className="block text-xs font-bold text-slate-600">
              Nome do método
              <input required maxLength={80} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Ex.: Cartão principal" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1d6ac4] focus:ring-4 focus:ring-blue-50"/>
            </label>

            <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-xs font-black text-blue-950">{labels[form.type] || "Método de pagamento"}</p>
              <p className="mt-1 text-[11px] leading-5 text-blue-800">{descriptions[form.type] || "Configure o método para utilização futura."}</p>
            </div>

            {needsPhone && (
              <label className="block text-xs font-bold text-slate-600">
                Número de telefone
                <input required value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="+244 ..." className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1d6ac4] focus:ring-4 focus:ring-blue-50"/>
              </label>
            )}

            {editingId && form.type !== "CARD" && (
              <label className="block text-xs font-bold text-slate-600">
                Últimos 4 dígitos
                <input value={form.lastFour} onChange={(event) => setForm({ ...form, lastFour: event.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" maxLength={4} placeholder="Opcional" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1d6ac4] focus:ring-4 focus:ring-blue-50"/>
              </label>
            )}

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} className="accent-[#1d6ac4]"/>
              Definir como método principal
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={resetForm} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "A guardar..." : editingId ? "Guardar alterações" : form.type === "CARD" ? "Continuar para configuração segura" : "Guardar método"}<ChevronRight size={15}/></button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3"><div className="card h-24 animate-pulse"/><div className="card h-24 animate-pulse"/></div>
      ) : methods.length ? (
        <div className="space-y-6">
          <MethodGroup title="Cartões" items={methodGroups.cards} icon={CreditCard} onEdit={editMethod} onRemove={remove} onDefault={makeDefault} />
          <MethodGroup title="Pagamentos móveis" items={methodGroups.mobile} icon={Smartphone} onEdit={editMethod} onRemove={remove} onDefault={makeDefault} />
          <MethodGroup title="Outros métodos" items={methodGroups.other} icon={WalletCards} onEdit={editMethod} onRemove={remove} onDefault={makeDefault} />
        </div>
      ) : (
        <div className="card border-dashed p-12 text-center">
          <CreditCard size={31} className="mx-auto text-slate-300"/>
          <h3 className="mt-3 text-sm font-black text-slate-800">Ainda não existem métodos guardados</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Adicione um método para acelerar o próximo pagamento.</p>
          <button type="button" onClick={startCreate} className="btn-primary mt-4"><Plus size={15}/> Adicionar método</button>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, title, detail }: { icon: typeof LockKeyhole; title: string; detail: string }) {
  return (
    <article className="card p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon size={16}/></span>
      <h2 className="mt-3 text-xs font-black text-slate-900">{title}</h2>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p>
    </article>
  );
}

function MethodGroup({ title, items, icon: GroupIcon, onEdit, onRemove, onDefault }: {
  title: string;
  items: PaymentMethod[];
  icon: typeof CreditCard;
  onEdit: (method: PaymentMethod) => void;
  onRemove: (id: number) => Promise<void>;
  onDefault: (id: number) => Promise<void>;
}) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3"><div><p className="section-kicker">{title}</p><h2 className="mt-1 text-base font-black text-slate-950">{items.length} método(s)</h2></div></div>
      <div className="space-y-3">
        {items.map((method) => (
          <article key={method.id} className={"card p-4 sm:p-5 " + (method.isDefault ? "border-[#1d6ac4]/30 bg-blue-50/20" : "")}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl " + (method.isDefault ? "bg-blue-50 text-[#1d6ac4]" : "bg-slate-100 text-slate-500")}><GroupIcon size={19}/></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-slate-950">{method.label || labels[method.type]}</h3>{method.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700"><Check size={12}/> Principal</span>}</div>
                <p className="mt-1 text-[10px] text-slate-500">{labels[method.type] || "Método de pagamento"}{method.lastFour ? " · terminado em " + method.lastFour : method.phoneNumber ? " · " + method.phoneNumber : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!method.isDefault && <button type="button" onClick={() => void onDefault(method.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-600 hover:border-blue-200 hover:text-[#1d6ac4]">Tornar principal</button>}
                <button type="button" onClick={() => onEdit(method)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-[#1d6ac4]" aria-label="Editar método" title="Editar método"><Pencil size={15}/></button>
                <button type="button" onClick={() => void onRemove(method.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remover método" title="Remover método"><Trash2 size={15}/></button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
