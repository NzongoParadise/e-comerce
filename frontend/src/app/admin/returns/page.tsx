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

export default function AdminReturnsPage() {
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [draftStatuses, setDraftStatuses] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
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
    if (status === "COMPLETED" && item.status === "REFUND_PROCESSING" && item.type === "RETURN") {
      setNotice("A conclusão será aceite apenas quando o reembolso estiver confirmado.");
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
              const options = nextOptions[item.status] || [];
              const selectedStatus = draftStatuses[item.id] || item.status;
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

                  {options.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-end">
                      <label className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Próximo estado<select value={selectedStatus} onChange={(event) => setDraftStatuses((current) => ({ ...current, [item.id]: event.target.value }))} className="settings-input mt-2"><option value={item.status}>{labels[item.status]}</option>{options.map((option) => <option key={option} value={option}>{labels[option]}</option>)}</select></label>
                      <label className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Nota de tratamento<input value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} placeholder={selectedStatus === "REJECTED" ? "Motivo da rejeição (obrigatório)" : "Instruções ou observação (opcional)"} className="settings-input mt-2"/></label>
                      <button type="button" onClick={() => void save(item)} disabled={savingId === item.id || selectedStatus === item.status} className="btn-primary disabled:opacity-50">{savingId === item.id ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Guardar estado</button>
                    </div>
                  ) : <p className="text-[10px] font-semibold text-slate-400">Esta solicitação está num estado terminal e não aceita mais transições.</p>}
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
