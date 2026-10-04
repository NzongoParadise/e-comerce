"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, CreditCard, Pencil, Plus, Smartphone, Trash2 } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type PaymentMethod = { id: number; type: string; label: string; lastFour?: string; phoneNumber?: string; isDefault: boolean };

const labels: Record<string, string> = {
  MULTICAIXA_REFERENCE: "Referência Multicaixa",
  MULTICAIXA_EXPRESS: "Multicaixa Express",
  CARD: "Cartão Stripe",
  MBWAY: "MB WAY",
  TRANSFER: "Transferência bancária",
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
  const [form, setForm] = useState(emptyForm);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
  }

  function load(successMessage?: string) {
    fetchWithAuth("/api/account/payment-methods")
      .then((response) => {
        setMethods(response.data);
        if (successMessage) setMessage(successMessage);
      })
      .catch(() => setMessage("Não foi possível carregar os métodos de pagamento."));
  }

  useEffect(() => {
    const cardStatus = new URLSearchParams(window.location.search).get("card");
    const successMessage = cardStatus === "added"
      ? "Cartão configurado com segurança. A lista pode demorar alguns instantes a atualizar."
      : cardStatus === "cancelled"
        ? "Adição do cartão cancelada."
        : undefined;
    load(successMessage);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();

    try {
      const payload = {
        ...form,
        lastFour: form.type === "CARD" ? undefined : form.lastFour || undefined,
        phoneNumber: (form.type === "MBWAY" || form.type === "MULTICAIXA_EXPRESS") && form.phoneNumber ? form.phoneNumber : undefined,
      };

      if (form.type === "CARD" && !editingId) {
        const response = await fetchWithAuth("/api/account/payment-methods/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: form.label, isDefault: form.isDefault }),
        });
        window.location.assign(response.data.checkoutUrl);
        return;
      }

      const route = editingId ? `/api/account/payment-methods/${editingId}` : "/api/account/payment-methods";
      const method = editingId ? "PATCH" : "POST";

      await fetchWithAuth(route, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      resetForm();
      load();
      setMessage(editingId ? "Método atualizado com sucesso." : "Método adicionado com sucesso.");
    } catch {
      setMessage(editingId ? "Não foi possível atualizar o método." : "Não foi possível guardar o método.");
    }
  }

  async function remove(id: number) {
    try {
      await fetchWithAuth(`/api/account/payment-methods/${id}`, { method: "DELETE" });
      load();
      setMessage("Método removido.");
    } catch {
      setMessage("Não foi possível remover o método.");
    }
  }

  async function makeDefault(id: number) {
    try {
      await fetchWithAuth(`/api/account/payment-methods/${id}/default`, { method: "POST" });
      load();
      setMessage("Método principal atualizado.");
    } catch {
      setMessage("Não foi possível definir o método principal.");
    }
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
    setOpen(true);
  }

  const needsPhone = form.type === "MBWAY" || form.type === "MULTICAIXA_EXPRESS";

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1d6ac4]">Conta</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Métodos de pagamento</h1>
          <p className="mt-1 text-sm text-gray-500">Gestione os métodos de pagamento Stripe, MB WAY e Multicaixa.</p>
        </div>
        <button onClick={() => { setOpen(true); setEditingId(null); setForm(emptyForm); }} className="btn-primary">
          <Plus size={16} /> Adicionar método
        </button>
      </header>

      {message && <p role="status" className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</p>}

      {open && (
        <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="sm:col-span-2 text-lg font-bold text-gray-900">{editingId ? "Editar método" : "Adicionar método"}</h2>

          <label className="sm:col-span-1">
            <span className="mb-1 block text-xs font-bold text-gray-700">Tipo</span>
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            >
              <option value="CARD">Cartão Stripe</option>
              <option value="MBWAY">MB WAY</option>
              <option value="MULTICAIXA_EXPRESS">Multicaixa Express</option>
              <option value="MULTICAIXA_REFERENCE">Referência Multicaixa</option>
              <option value="TRANSFER">Transferência bancária</option>
            </select>
          </label>

          <label className="sm:col-span-1">
            <span className="mb-1 block text-xs font-bold text-gray-700">Nome</span>
            <input
              required
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              placeholder="Ex.: Cartão principal"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            />
          </label>

          {form.type === "CARD" && (
            <p className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
              A Stripe recolhe os dados do cartão num formulário seguro. O número completo e o CVV não são guardados nesta loja.
            </p>
          )}

          {needsPhone && (
            <label className="sm:col-span-1">
              <span className="mb-1 block text-xs font-bold text-gray-700">Número de telefone</span>
              <input
                required
                value={form.phoneNumber}
                onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
                placeholder="+244 900 000 000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </label>
          )}

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
            />
            Definir como principal
          </label>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={resetForm} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editingId ? "Guardar alterações" : form.type === "CARD" ? "Continuar para pagamento seguro" : "Guardar"}</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {methods.map((method) => (
          <article key={method.id} className="card flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#1d6ac4]">
                {method.type === "MULTICAIXA_EXPRESS" || method.type === "MBWAY" ? <Smartphone size={19} /> : <CreditCard size={19} />}
              </span>
              <div>
                <h2 className="font-bold text-gray-900">{method.label}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {labels[method.type] ?? "Método de pagamento"}
                  {method.lastFour ? ` terminado em ${method.lastFour}` : method.phoneNumber ? ` · ${method.phoneNumber}` : ""}
                </p>
                {method.isDefault && (
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                    <Check size={12} /> Principal
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => editMethod(method)} className="text-gray-500 hover:text-blue-600" aria-label="Editar método" title="Editar método">
                <Pencil size={16} />
              </button>
              <button type="button" aria-label="Remover método" title="Remover método" onClick={() => remove(method.id)} className="text-gray-500 hover:text-red-600">
                <Trash2 size={16} />
              </button>
              {!method.isDefault && (
                <button type="button" onClick={() => makeDefault(method.id)} className="text-xs font-bold text-[#1d6ac4]">
                  Tornar principal
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {!methods.length && !open && (
        <div className="card p-10 text-center text-sm text-gray-500">Ainda não tem métodos de pagamento guardados.</div>
      )}
    </div>
  );
}
