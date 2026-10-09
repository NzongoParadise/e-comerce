"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Refund = {
  id: number;
  orderId: number;
  amountEUR: string | number;
  amountKZ: string | number;
  currency: string;
  reason: string;
  status: string;
  provider: string;
  failureReason?: string | null;
  createdAt: string;
  order: { orderNumber: string; status?: string };
};

const statusLabel: Record<string, string> = {
  REQUESTED: "Solicitado",
  PROCESSING: "A processar",
  SUCCEEDED: "Concluído",
  FAILED: "Falhou",
};

function formatMoney(refund: Pick<Refund, "amountEUR" | "amountKZ" | "currency">) {
  if (refund.currency === "EUR") {
    return "€ " + Number(refund.amountEUR).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return "Kz " + Number(refund.amountKZ).toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

function makeIdempotencyKey() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "refund-" + Date.now() + "-" + Math.random().toString(36).slice(2, 18);
}

export default function RefundsPage() {
  const [items, setItems] = useState<Refund[]>([]);
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [requestSignature, setRequestSignature] = useState("");

  const signature = useMemo(
    () => JSON.stringify({ orderId: Number(orderId), amount: Number(amount), reason: reason.trim() }),
    [orderId, amount, reason],
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth("/api/admin/finance/refunds", { cache: "no-store" });
      setItems((response.data || []) as Refund[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o histórico de reembolsos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const key = requestKey && requestSignature === signature ? requestKey : makeIdempotencyKey();
    setRequestKey(key);
    setRequestSignature(signature);
    setSubmitting(true);

    try {
      const response = await fetchWithAuth("/api/admin/finance/refunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({
          orderId: Number(orderId),
          amount: Number(amount),
          reason: reason.trim(),
        }),
      });

      setMessage(response.data?.status === "SUCCEEDED"
        ? "Reembolso confirmado pelo gateway."
        : response.idempotent
          ? "Este pedido de reembolso já tinha sido registado; foi devolvido o mesmo resultado."
          : "Reembolso registado com estado: " + (statusLabel[response.data?.status] || response.data?.status || "pendente") + ".");
      setOrderId("");
      setAmount("");
      setReason("");
      setRequestKey("");
      setRequestSignature("");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível registar o reembolso.");
      // Keep the key for an exact retry. Editing any field automatically generates a new key.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6 pb-8">
      <header>
        <p className="section-kicker">Financeiro · Controlo de reembolsos</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Reembolsos</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Cada pedido exige uma chave de idempotência, valida o saldo ainda reembolsável e preserva o resultado para evitar cobranças duplicadas em tentativas repetidas.</p>
      </header>

      {message && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0"/>{message}</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div>}

      <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-[minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(240px,1.8fr)_auto] xl:items-end">
        <label className="block text-xs font-bold text-slate-600">ID da encomenda
          <input value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="Ex.: 204" type="number" min="1" required className="settings-input mt-2"/>
        </label>
        <label className="block text-xs font-bold text-slate-600">Valor a reembolsar
          <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Valor na moeda original" type="number" step="0.01" min="0.01" required className="settings-input mt-2"/>
        </label>
        <label className="block text-xs font-bold text-slate-600">Motivo do reembolso
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explique o motivo (mínimo 8 caracteres)" minLength={8} maxLength={500} required className="settings-input mt-2"/>
        </label>
        <button type="submit" disabled={submitting || loading} className="btn-primary min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? <Loader2 size={15} className="animate-spin"/> : <RotateCcw size={15}/>}
          {submitting ? "A processar..." : "Registar reembolso"}
        </button>
      </form>
      <p className="text-[10px] leading-5 text-slate-500">Use o valor na moeda original do pagamento. O servidor recusa montantes superiores ao saldo reembolsável. Reembolsos de outros gateways ficam pendentes para execução e confirmação manual.</p>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div><h2 className="text-sm font-black text-slate-950">Histórico de reembolsos</h2><p className="mt-1 text-[10px] text-slate-500">{items.length} registo(s) apresentados</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Encomenda</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Gateway</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Motivo / detalhe</th><th className="px-4 py-3">Data</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => <tr key={item.id} className="align-top hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-4 py-3 font-black text-slate-900">{item.order?.orderNumber || "Encomenda #" + item.orderId}</td>
                <td className="whitespace-nowrap px-4 py-3 font-black text-slate-800">{formatMoney(item)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.provider}</td>
                <td className="whitespace-nowrap px-4 py-3"><span className={"rounded-full px-2.5 py-1.5 text-[9px] font-black " + (item.status === "SUCCEEDED" ? "bg-emerald-50 text-emerald-700" : item.status === "FAILED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700")}>{statusLabel[item.status] || item.status}</span></td>
                <td className="min-w-56 max-w-md px-4 py-3 text-slate-600">{item.reason}{item.failureReason ? <p className="mt-1 break-words text-[10px] font-semibold text-rose-600">{item.failureReason}</p> : null}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleString("pt-PT")}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {!loading && items.length === 0 && <div className="p-10 text-center text-xs text-slate-500">Ainda não existem registos de reembolso.</div>}
      </section>
    </section>
  );
}
