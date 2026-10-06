"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle, Save, Settings2 } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type VatSettings = {
  vatEnabled: boolean;
  vatRate: string | number | null;
  vatIncluded: boolean;
  vatConfiguredAt?: string | null;
  vatConfiguredBy?: string | null;
};

const defaults: VatSettings = { vatEnabled: false, vatRate: null, vatIncluded: true };

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<VatSettings>(defaults);
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/admin/settings/vat")
      .then((response) => {
        if (!active) return;
        setSettings(response.data);
        setRate(response.data.vatRate == null ? "" : String(response.data.vatRate));
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as configurações."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedRate = rate.trim() ? Number(rate.replace(",", ".")) : null;
    if (settings.vatEnabled && (parsedRate === null || !Number.isFinite(parsedRate) || parsedRate <= 0 || parsedRate > 100)) {
      setError("Indique uma taxa de IVA válida entre 0,01% e 100%.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetchWithAuth("/api/admin/settings/vat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vatEnabled: settings.vatEnabled, vatRate: parsedRate, vatIncluded: settings.vatIncluded }),
      });
      setSettings(response.data);
      setRate(response.data.vatRate == null ? "" : String(response.data.vatRate));
      setNotice("Configuração fiscal global guardada. A ficha de todas as encomendas passa a usar esta configuração.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar as configurações fiscais.");
    } finally { setSaving(false); }
  }

  return <div className="min-h-screen bg-[#f7f9fc] text-gray-900">
    <header className="border-b border-gray-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4"><Link href="/admin" aria-label="Voltar ao painel" className="flex h-9 w-9 items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50"><ArrowLeft size={16} /></Link><span className="flex h-9 w-9 items-center justify-center bg-[#1555d8] text-white"><Settings2 size={18} /></span><div><strong className="block text-sm font-black">RUBRICA DILIGENTE (SU), LDA</strong><span className="text-[9px] font-bold uppercase tracking-widest text-[#1555d8]">Configuração do sistema</span></div></div></header>
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <nav className="mb-5 text-xs text-gray-500"><Link href="/admin" className="hover:text-blue-700">Administração</Link><span className="mx-2">/</span><span className="font-semibold text-gray-700">Configurações</span></nav>
      <div className="mb-6"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Faturação</p><h1 className="mt-1 text-2xl font-black">Configuração global de IVA</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Configure a taxa uma única vez. Depois de ativa, será aplicada automaticamente à ficha de todas as encomendas.</p></div>
      {error && <div role="alert" className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="mb-4 flex items-start gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{notice}</div>}

      <form onSubmit={saveSettings} className="border border-gray-200 bg-white shadow-sm">
        <section className="space-y-5 p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center"><div><h2 className="text-sm font-black">IVA da loja</h2><p className="mt-1 text-xs text-gray-500">Esta opção é global e não pode ser alterada individualmente em cada venda.</p></div><label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3"><input type="checkbox" checked={settings.vatEnabled} onChange={(event) => setSettings((current) => ({ ...current, vatEnabled: event.target.checked }))} className="h-4 w-4 accent-blue-700" /><span className="text-xs font-bold">{settings.vatEnabled ? "IVA ativo" : "IVA desativado"}</span></label></div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="text-xs font-bold text-gray-700">Taxa de IVA (%)<input type="number" min="0.01" max="100" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} disabled={!settings.vatEnabled || loading} placeholder="Ex.: 14" className="mt-2 w-full border border-gray-300 px-3 py-3 text-sm disabled:bg-gray-50 disabled:text-gray-400" /><span className="mt-1 block text-[10px] font-normal text-gray-500">A taxa configurada será usada para calcular o IVA em cada ficha.</span></label>
            <label className="text-xs font-bold text-gray-700">Como aplicar o IVA<select value={settings.vatIncluded ? "included" : "added"} onChange={(event) => setSettings((current) => ({ ...current, vatIncluded: event.target.value === "included" }))} disabled={!settings.vatEnabled || loading} className="mt-2 w-full border border-gray-300 bg-white px-3 py-3 text-sm disabled:bg-gray-50 disabled:text-gray-400"><option value="included">Incluído no total da encomenda</option><option value="added">Acrescentado ao total da fatura</option></select><span className="mt-1 block text-[10px] font-normal text-gray-500">Ao acrescentar, a ficha mostra o novo total da fatura e o valor que ainda falta pagar.</span></label>
          </div>

          <div className="rounded-lg bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900"><strong className="block">Aplicação global</strong>Esta configuração afeta as fichas de encomendas já existentes e futuras. Não altera o registo original do total pago no checkout.</div>
          {settings.vatConfiguredAt && <p className="text-[10px] text-gray-500">Última configuração: {new Date(settings.vatConfiguredAt).toLocaleString("pt-PT")}{settings.vatConfiguredBy ? ` · ${settings.vatConfiguredBy}` : ""}</p>}
        </section>
        <footer className="flex flex-col-reverse justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:px-7"><p className="text-[10px] text-gray-500">{loading ? "A carregar configuração..." : "A alteração só entra em vigor depois de guardar."}</p><button type="submit" disabled={saving || loading} className="inline-flex items-center justify-center gap-2 bg-blue-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}{saving ? "A guardar..." : "Guardar configuração fiscal"}</button></footer>
      </form>
    </main>
  </div>;
}
