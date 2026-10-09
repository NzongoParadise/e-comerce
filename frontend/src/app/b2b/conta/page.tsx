"use client";

import Link from "next/link";
import { Bell, LockKeyhole, Save, ShieldCheck, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";

type CommunicationPreferences = {
  promotions: boolean;
  newProducts: boolean;
  orderUpdates: boolean;
  commercialUpdates: boolean;
};

const defaults: CommunicationPreferences = {
  promotions: true,
  newProducts: false,
  orderUpdates: true,
  commercialUpdates: true,
};

const preferenceRows: Array<{ key: keyof CommunicationPreferences; title: string; description: string }> = [
  { key: "orderUpdates", title: "Atualizações de encomendas e cotações", description: "Receber mensagens sobre aprovações, estado de compra e pagamento." },
  { key: "commercialUpdates", title: "Comunicações comerciais", description: "Receber comunicações relevantes para a conta empresarial." },
  { key: "promotions", title: "Promoções e ofertas", description: "Conhecer campanhas e condições especiais disponíveis." },
  { key: "newProducts", title: "Novos produtos", description: "Receber informação sobre novos artigos do catálogo." },
];

export default function B2BSettingsPage() {
  const [preferences, setPreferences] = useState<CommunicationPreferences>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/account/communication-preferences", { cache: "no-store" })
      .then((response) => {
        if (active) setPreferences({ ...defaults, ...(response.data || {}) });
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as preferências.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function savePreferences() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetchWithAuth("/api/account/communication-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (!response.data) throw new Error("O serviço não confirmou a gravação das preferências.");
      setPreferences({ ...defaults, ...response.data });
      setNotice("Preferências guardadas na sua conta.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar as preferências.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <header>
        <p className="section-kicker">B2B · Conta</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Definições empresariais</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Gerir segurança da conta e preferências de comunicação. As alterações são guardadas no seu perfil.</p>
      </header>

      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/>{notice}</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{error}</div>}

      <section className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck size={20}/></span>
            <div>
              <h2 className="text-sm font-black text-slate-950">Segurança da conta</h2>
              <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">Gerir palavra-passe, autenticação de dois fatores e sessões ativas na área de segurança da conta.</p>
            </div>
          </div>
          <Link href="/account/settings" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-800 hover:border-blue-200 hover:text-blue-700"><LockKeyhole size={15}/> Gerir segurança</Link>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Bell size={20}/></span>
          <div><h2 className="text-sm font-black text-slate-950">Preferências de comunicação</h2><p className="mt-1 text-xs leading-5 text-slate-500">Escolha os e-mails que pretende receber. As preferências ficam associadas à sua conta e são usadas pelos serviços de notificação que suportam estes canais.</p></div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-50"/>)}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {preferenceRows.map((row) => (
              <label key={row.key} className="flex cursor-pointer items-start gap-4 p-5 transition hover:bg-slate-50/70 sm:px-6">
                <input
                  type="checkbox"
                  checked={preferences[row.key]}
                  onChange={(event) => setPreferences((current) => ({ ...current, [row.key]: event.target.checked }))}
                  disabled={saving}
                  className="mt-1 h-4 w-4 rounded border-slate-300 accent-blue-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black text-slate-900">{row.title}</span>
                  <span className="mt-1 block text-[10px] leading-5 text-slate-500">{row.description}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[10px] leading-5 text-slate-500">As preferências não alteram mensagens transacionais obrigatórias relacionadas com segurança ou conformidade.</p>
          <button type="button" onClick={() => void savePreferences()} disabled={loading || saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#132238] px-4 py-3 text-xs font-black text-white transition hover:bg-[#1d6ac4] disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}
            {saving ? "A guardar..." : "Guardar preferências"}
          </button>
        </div>
      </section>
    </div>
  );
}
