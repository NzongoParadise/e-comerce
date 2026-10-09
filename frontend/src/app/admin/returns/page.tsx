"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, Loader2, RefreshCw, Save } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type ReturnEvent = {
  id: number;
  previousStatus: string | null;
  nextStatus: string;
  actorExternalId: string;
  note: string | null;
  createdAt: string;
};

type ReturnRefund = {
  id: number;
  status: string;
  amountEUR: string | number;
  amountKZ: string | number;
  currency: string;
  provider: string;
  providerRefundId: string | null;
  failureReason: string | null;
  createdAt: string;
};

type ReturnItem = {
  id: number;
  requestNumber: string;
  orderId: number;
  type: "RETURN" | "EXCHANGE" | "COMPLAINT";
  status: string;
  reason: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: number; name: string | null; email: string | null };
  order: { id: number; orderNumber: string; status: string; currency: string; totalEUR: string | number; totalKZ: string | number };
  events: ReturnEvent[];
  refunds: ReturnRefund[];
};

const labels: Record<string, string> = {
  RECEIVED: "Recebida",
  UNDER_REVIEW: "Em análise",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  WAITING_FOR_RETURN: "A aguardar artigo",
  ITEM_RECEIVED: "Artigo recebido",
  REFUND_PROCESSING: "Reembolso em processamento",
  EXCHANGE_PROCESSING: "Troca em processamento",
  COMPLETED: "Concluída",
};

const nextOptions: Record<string, string[]> = {
  RECEIVED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["WAITING_FOR_RETURN", "REFUND_PROCESSING", "EXCHANGE_PROCESSING", "COMPLETED"],
  WAITING_FOR_RETURN: ["ITEM_RECEIVED"],
  ITEM_RECEIVED: ["REFUND_PROCESSING", "EXCHANGE_PROCESSING"],
  REFUND_PROCESSING: ["COMPLETED"],
  EXCHANGE_PROCESSING: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

function money(item: ReturnItem) {
  return item.order.currency === "EUR"
    ? "€ " + Number(item.order.totalEUR).toFixed(2)
    : "Kz " + Number(item.order.totalKZ).toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

function newReturnRefundKey(item: ReturnItem) {
  const nonce = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 18);
  return "return-refund-" + item.id + "-" + nonce;
}

export default function AdminReturnsPage() {
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [draftStatuses, setDraftStatuses] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [refundAmounts, setRefundAmounts] = useState<Record<number, string>>({});
  const [refundAttemptKeys, setRefundAttemptKeys] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchWithAuth("/api/admin/returns?status=" + encodeURIComponent(filter), { cache: "no-store" });
      const data = (result.data || []) as ReturnItem[];
      setItems(data);
      setDraftStatuses(Object.fromEntries(data.map((item) => [item.id, item.status])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os pedidos de pós-venda.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [filter]);

  async function save(item: ReturnItem) {
    const status = draftStatuses[item.id];
    if (!status || status === item.status) return;
    const note = (notes[item.id] || "").trim();
    if (status === "REJECTED" && note.length < 5) {
      setError("Indique o motivo da rejeição com pelo menos cinco caracteres.");
      return;
    }

    setSavingId(item.id);
    setError("");
    setNotice("");
    try {
      await fetchWithAuth("/api/admin/returns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status, note: note || undefined }),
      });
      setNotice("Solicitação " + item.requestNumber + " atualizada.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível atualizar a solicitação.");
    } finally {
      setSavingId(null);
    }
  }

  async function startReturnRefund(item: ReturnItem, newAttempt = false) {
    const note = (notes[item.id] || "").trim();
    const amount = Number(refundAmounts[item.id]);
    const latestRefund = item.refunds?.[0];

    if (item.type !== "RETURN" || !["ITEM_RECEIVED", "REFUND_PROCESSING"].includes(item.status)) {
      setError("A devolução ainda não está numa etapa elegível para reembolso.");
      return;
    }
    if (item.status === "REFUND_PROCESSING" && latestRefund && latestRefund.status !== "FAILED") {
      setError("Já existe uma tentativa de reembolso pendente ou concluída. Atualize o estado antes de criar outra.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Indique o valor que será realmente devolvido ao cliente.");
      return;
    }
    const orderTotal = item.order.currency === "EUR" ? Number(item.order.totalEUR) : Number(item.order.totalKZ);
    if (amount > orderTotal + 0.000001) {
      setError("O valor do reembolso não pode ultrapassar o total original da encomenda.");
      return;
    }
    if (note.length < 8) {
      setError("Explique o motivo do reembolso com pelo menos oito caracteres.");
      return;
    }

    let key = refundAttemptKeys[item.id];
    if (!key || newAttempt) {
      key = newReturnRefundKey(item);
      setRefundAttemptKeys((current) => ({ ...current, [item.id]: key }));
    }

    setSavingId(item.id);
    setError("");
    setNotice("");
    try {
      if (item.status === "ITEM_RECEIVED") {
        await fetchWithAuth("/api/admin/returns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, status: "REFUND_PROCESSING", note }),
        });
      }

      const reason = ("Devolução " + item.requestNumber + ": " + note).slice(0, 500);
      const refundResponse = await fetchWithAuth("/api/admin/finance/refunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({
          orderId: item.orderId,
          returnRequestId: item.id,
          amount,
          reason,
        }),
      });
      if (!refundResponse?.data) throw new Error(refundResponse?.error || "Não foi possível registar o reembolso.");
      const refundStatus = String(refundResponse.data.status || "");

      if (refundStatus === "SUCCEEDED") {
        await fetchWithAuth("/api/admin/returns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.id,
            status: "COMPLETED",
            note: "Reembolso confirmado no processamento inicial.",
          }),
        });
      }

      const refundFailed = refundStatus === "FAILED";
      if (refundFailed) {
        setRefundAttemptKeys((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      } else {
        setNotice(refundStatus === "SUCCEEDED"
          ? "Reembolso confirmado e devolução concluída."
          : "Reembolso registado. A solicitação permanece em processamento até o gateway confirmar o resultado.");
        setRefundAttemptKeys((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      }
      await load();
      if (refundFailed) {
        setError("O gateway não concluiu o reembolso. Reveja o motivo e selecione «Nova tentativa» apenas depois de confirmar que não houve transferência.");
      }
    } catch (refundError) {
      const message = refundError instanceof Error ? refundError.message : "Não foi possível iniciar o reembolso.";
      await load();
      setError(message);
    } finally {
      setSavingId(null);
    }
  }

  async function synchronizeReturnCompletion(item: ReturnItem) {
    setSavingId(item.id);
    setError("");
    setNotice("");
    try {
      await fetchWithAuth("/api/admin/returns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          status: "COMPLETED",
          note: "Estado sincronizado com o reembolso confirmado.",
        }),
      });
      setNotice("A devolução " + item.requestNumber + " foi sincronizada com o reembolso confirmado.");
      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Não foi possível sincronizar a devolução.");
    } finally {
      setSavingId(null);
    }
  }

  const pendingCount = useMemo(() => items.filter((item) => !["REJECTED", "COMPLETED"].includes(item.status)).length, [items]);

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Admin · Pós-venda</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Devoluções, trocas e reclamações</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Cada transição é validada no servidor e registada no histórico de auditoria da solicitação.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar</button>
      </header>

      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={16} className="mt-0.5"/>{notice}</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><AlertCircle size={16} className="mt-0.5"/>{error}</div>}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ClipboardList size={18}/></span><div><h2 className="text-sm font-black text-slate-950">Fila de pós-venda</h2><p className="mt-1 text-[10px] text-slate-500">{pendingCount} pedido(s) ainda em tratamento nesta vista</p></div></div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="settings-input sm:max-w-56"><option value="ALL">Todos os estados</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>

        {loading ? (
          <div className="space-y-3 p-4 sm:p-5">{[1,2,3].map((id) => <div key={id} className="h-40 animate-pulse rounded-xl bg-slate-50"/>)}</div>
        ) : items.length ? (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const latestRefund = item.refunds?.[0];
              const options = [...(nextOptions[item.status] || [])]
                .filter((option) => {
                  if (item.type === "RETURN") return !["REFUND_PROCESSING", "EXCHANGE_PROCESSING"].includes(option);
                  if (item.type === "EXCHANGE") return option !== "REFUND_PROCESSING";
                  if (item.type === "COMPLAINT") return !["WAITING_FOR_RETURN", "ITEM_RECEIVED", "REFUND_PROCESSING", "EXCHANGE_PROCESSING"].includes(option);
                  return true;
                });
              if (item.type === "COMPLAINT" && item.status === "APPROVED") options.push("COMPLETED");
              const selectedStatus = draftStatuses[item.id] || item.status;
              const canStartRefund = item.type === "RETURN" &&
                (item.status === "ITEM_RECEIVED" || (item.status === "REFUND_PROCESSING" && (!latestRefund || latestRefund.status === "FAILED")));
              const canSyncCompletion = item.type === "RETURN" && item.status === "REFUND_PROCESSING" && latestRefund?.status === "SUCCEEDED";
              return (
                <article key={item.id} className="space-y-4 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-slate-950">{item.requestNumber}</h3><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black text-blue-700">{labels[item.status] || item.status}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-600">{item.type === "RETURN" ? "Devolução" : item.type === "EXCHANGE" ? "Troca" : "Reclamação"}</span></div>
                      <p className="mt-2 text-xs font-bold text-slate-800">{item.order.orderNumber} · {money(item)}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{item.user.name || "Cliente"} · {item.user.email || "Sem e-mail"} · Criado em {new Date(item.createdAt).toLocaleString("pt-PT")}</p>
                      <p className="mt-3 text-xs font-bold text-slate-800">{item.reason}</p>
                      {item.description && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-500">{item.description}</p>}
                    </div>
                  </div>

                  {item.events.length > 0 && <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Histórico de estados</p><div className="mt-2 space-y-2">{item.events.map((event) => <div key={event.id} className="flex flex-col gap-1 text-[10px] sm:flex-row sm:items-center sm:justify-between"><span className="font-bold text-slate-700">{event.previousStatus ? labels[event.previousStatus] + " → " : ""}{labels[event.nextStatus] || event.nextStatus}{event.note ? " · " + event.note : ""}</span><time className="shrink-0 text-slate-400">{new Date(event.createdAt).toLocaleString("pt-PT")}</time></div>)}</div></div>}

                  {item.type === "RETURN" && ["ITEM_RECEIVED", "REFUND_PROCESSING"].includes(item.status) && (
                    <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="text-xs font-black text-slate-900">Gestão do reembolso</h4>
                          <p className="mt-1 text-[10px] leading-5 text-slate-600">
                            {latestRefund?.status === "REQUESTED" || latestRefund?.status === "PROCESSING"
                              ? "Existe uma tentativa pendente. Não inicie outra enquanto o gateway estiver a confirmar."
                              : latestRefund?.status === "SUCCEEDED"
                                ? "O reembolso está confirmado; sincronize o estado da devolução se necessário."
                                : latestRefund?.status === "FAILED"
                                  ? "A tentativa anterior falhou. Confirme que não ocorreu transferência antes de iniciar uma nova tentativa."
                                  : "Depois de receber o artigo, registe o valor exato e inicie o reembolso."}
                          </p>
                        </div>
                        {latestRefund && <span className={"w-fit rounded-full px-2.5 py-1 text-[9px] font-black " + (latestRefund.status === "SUCCEEDED" ? "bg-emerald-100 text-emerald-800" : latestRefund.status === "FAILED" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800")}>{latestRefund.status === "SUCCEEDED" ? "Confirmado" : latestRefund.status === "FAILED" ? "Falhou" : latestRefund.status === "REQUESTED" ? "Solicitado" : "Em processamento"}</span>}
                      </div>
                      {latestRefund?.providerRefundId && <p className="break-all text-[10px] text-slate-500">Referência externa: {latestRefund.providerRefundId}</p>}
                      {latestRefund?.failureReason && <p className="break-words text-[10px] font-semibold text-rose-700">{latestRefund.failureReason}</p>}
                      {canStartRefund && (
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_auto] sm:items-end">
                          <label className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Valor a reembolsar ({item.order.currency === "EUR" ? "EUR" : "AOA"})
                            <input type="number" inputMode="decimal" min="0.01" step="0.01" max={item.order.currency === "EUR" ? Number(item.order.totalEUR) : Number(item.order.totalKZ)} value={refundAmounts[item.id] || ""} onChange={(event) => setRefundAmounts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={item.order.currency === "EUR" ? "Ex.: 39.90" : "Ex.: 25000"} required className="settings-input mt-2"/>
                            <span className="mt-1 block normal-case font-medium tracking-normal text-slate-400">Total original: {money(item)}</span>
                          </label>
                          <label className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Motivo do reembolso
                            <input value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={500} minLength={8} placeholder="Explique o motivo (mínimo 8 caracteres)" required className="settings-input mt-2"/>
                          </label>
                          <button type="button" onClick={() => void startReturnRefund(item, latestRefund?.status === "FAILED")} disabled={savingId === item.id} className="btn-primary min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-50">
                            {savingId === item.id ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                            {latestRefund?.status === "FAILED" ? "Nova tentativa" : "Iniciar reembolso"}
                          </button>
                        </div>
                      )}
                      {canSyncCompletion && (
                        <button type="button" onClick={() => void synchronizeReturnCompletion(item)} disabled={savingId === item.id} className="btn-primary disabled:opacity-50">
                          {savingId === item.id ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} Sincronizar conclusão
                        </button>
                      )}
                    </section>
                  )}


                  {options.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-end">
                      <label className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Próximo estado<select value={selectedStatus} onChange={(event) => setDraftStatuses((current) => ({ ...current, [item.id]: event.target.value }))} className="settings-input mt-2"><option value={item.status}>{labels[item.status]}</option>{options.map((option) => <option key={option} value={option}>{labels[option]}</option>)}</select></label>
                      <label className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Nota de tratamento<input value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} minLength={selectedStatus === "REJECTED" ? 5 : 0} placeholder={selectedStatus === "REJECTED" ? "Motivo da rejeição (obrigatório)" : "Instruções ou observação (opcional)"} className="settings-input mt-2"/></label>
                      <button type="button" onClick={() => void save(item)} disabled={savingId === item.id || selectedStatus === item.status} className="btn-primary disabled:opacity-50">{savingId === item.id ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Guardar estado</button>
                    </div>
                  ) : <p className="text-[10px] font-semibold text-slate-400">{item.type === "RETURN" && item.status === "REFUND_PROCESSING" ? "A devolução só pode ser concluída após confirmação do reembolso." : item.type === "RETURN" && item.status === "ITEM_RECEIVED" ? "Use o painel de reembolso acima para iniciar o pagamento de retorno." : "Esta solicitação está num estado terminal ou aguarda o processo específico do seu tipo."}</p>}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center"><ClipboardList size={30} className="mx-auto text-slate-300"/><h2 className="mt-3 text-sm font-black text-slate-800">Sem solicitações nesta vista</h2><p className="mt-1 text-xs text-slate-500">Novos pedidos aparecerão aqui assim que forem submetidos.</p></div>
        )}
      </section>
    </div>
  );
}
