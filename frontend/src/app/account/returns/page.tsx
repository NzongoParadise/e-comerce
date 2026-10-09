"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Package, RefreshCcw, Send } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type RequestType = "RETURN" | "EXCHANGE" | "COMPLAINT";
type Order = { id: number; orderNumber: string; createdAt: string };
type ReturnRequestEvent = { id: number; previousStatus: string | null; nextStatus: string; note: string | null; createdAt: string };
type ReturnRequest = { id: number; requestNumber: string; orderId: number; type: RequestType; status: string; reason: string; description?: string | null; createdAt: string; events?: ReturnRequestEvent[]; order?: { orderNumber?: string; status?: string } | null };

const returnStatusLabels: Record<string, string> = {
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

const requestTypes: Array<{ id: RequestType; label: string; description: string; icon: typeof Package }> = [
  { id: "RETURN", label: "Devolução", description: "Devolver um produto dentro das condições aplicáveis.", icon: Package },
  { id: "EXCHANGE", label: "Troca", description: "Solicitar substituição de um produto.", icon: RefreshCcw },
  { id: "COMPLAINT", label: "Reclamação", description: "Reportar um problema com uma compra.", icon: AlertCircle },
];

export default function ReturnsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [orderId, setOrderId] = useState("");
  const [type, setType] = useState<RequestType>("RETURN");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchWithAuth("/api/orders"), fetchWithAuth("/api/returns")])
      .then(([ordersResponse, returnsResponse]) => {
        const response = ordersResponse;
        setRequests(returnsResponse.data || []);
        const data = response.data || [];
        setOrders(data);
        if (data[0]) setOrderId(String(data[0].id));
      })
      .catch(() => setMessage("Não foi possível carregar os seus pedidos de pós-venda."))
      .finally(() => setLoading(false));
  }, []);

  async function submitRequest() {
    if (!orderId || !reason.trim()) {
      setMessage("Seleccione a encomenda e indique o motivo da solicitação.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetchWithAuth("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: Number(orderId),
          type,
          reason: reason.trim(),
          description: description.trim(),
        }),
      });
      setMessage("Solicitação " + response.data.requestNumber + " enviada com sucesso.");
      setReason("");
      setDescription("");
      const history = await fetchWithAuth("/api/returns");
      setRequests(history.data || []);
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Não foi possível enviar a solicitação.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedOrder = orders.find((order) => String(order.id) === orderId);

  return (
    <div className="space-y-6 pb-8">
      <header>
        <p className="section-kicker">Conta · Pós-venda</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Devoluções e reclamações</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Abra uma solicitação associada a uma encomenda real e descreva claramente o que aconteceu.</p>
      </header>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="section-kicker">Histórico</p>
          <h2 className="mt-1 text-base font-black text-slate-950">As minhas solicitações</h2>
        </div>
        {requests.length ? (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => (
              <article key={request.id} className="p-4 transition hover:bg-slate-50/60 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><FileText size={17}/></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black text-slate-950">{request.requestNumber}</p><span className={"rounded-full px-2.5 py-1 text-[9px] font-black " + (["REJECTED"].includes(request.status) ? "bg-rose-50 text-rose-700" : request.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>{returnStatusLabels[request.status] || request.status}</span></div>
                    <p className="mt-1 text-[10px] text-slate-500">{request.type === "RETURN" ? "Devolução" : request.type === "EXCHANGE" ? "Troca" : "Reclamação"} · {request.order?.orderNumber || "Encomenda #" + request.orderId} · {new Date(request.createdAt).toLocaleDateString("pt-PT")}</p>
                    <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-600">{request.reason}{request.description ? " · " + request.description : ""}</p>
                    {request.events?.length ? <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <p className="mb-2 text-[9px] font-black uppercase tracking-wide text-slate-500">Histórico da solicitação</p>
                      <ol className="space-y-2">
                        {request.events.map((event) => <li key={event.id} className="flex flex-col gap-0.5 text-[10px] sm:flex-row sm:items-start sm:justify-between">
                          <span className="font-semibold text-slate-700">{event.previousStatus ? (returnStatusLabels[event.previousStatus] || event.previousStatus) + " → " : ""}{returnStatusLabels[event.nextStatus] || event.nextStatus}{event.note ? " · " + event.note : ""}</span>
                          <time className="shrink-0 text-slate-400">{new Date(event.createdAt).toLocaleString("pt-PT")}</time>
                        </li>)}
                      </ol>
                    </div> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center"><FileText size={30} className="mx-auto text-slate-300"/><p className="mt-3 text-xs font-bold text-slate-700">Ainda não existem solicitações</p><p className="mt-1 text-[10px] text-slate-500">Quando criar uma devolução, troca ou reclamação, o pedido ficará registado aqui.</p></div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {requestTypes.map(({ id, label, description, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setType(id)} className={"card p-4 text-left transition " + (type === id ? "border-[#1d6ac4]/40 bg-blue-50/50 shadow-[0_10px_25px_rgba(29,106,196,.08)]" : "hover:-translate-y-0.5 hover:border-blue-200")}>
            <span className={"flex h-10 w-10 items-center justify-center rounded-xl " + (type === id ? "bg-blue-100 text-[#1d6ac4]" : "bg-slate-100 text-slate-500")}><Icon size={18}/></span>
            <strong className="mt-3 block text-xs font-black text-slate-900">{label}</strong>
            <span className="mt-1 block text-[10px] leading-4 text-slate-500">{description}</span>
          </button>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="section-kicker">Nova solicitação</p>
            <h2 className="mt-1 text-base font-black text-slate-950">Dados do pedido</h2>
          </div>

          <div className="space-y-5 p-5">
            <label className="block text-xs font-bold text-slate-600">
              Encomenda
              <select value={orderId} onChange={(event) => setOrderId(event.target.value)} disabled={loading || !orders.length} className="settings-input mt-2">
                {!orders.length && <option value="">Nenhuma encomenda disponível</option>}
                {orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {new Date(order.createdAt).toLocaleDateString("pt-PT")}</option>)}
              </select>
            </label>

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-start gap-3">
                <FileText size={17} className="mt-0.5 shrink-0 text-[#1d6ac4]"/>
                <div>
                  <p className="text-xs font-black text-slate-900">Tipo de solicitação</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-600">{requestTypes.find((item) => item.id === type)?.description}</p>
                </div>
              </div>
            </div>

            <label className="block text-xs font-bold text-slate-600">
              Motivo
              <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={180} className="settings-input mt-2" placeholder="Ex.: produto danificado à chegada" />
            </label>

            <label className="block text-xs font-bold text-slate-600">
              Descrição detalhada
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} className="settings-input mt-2 min-h-32 resize-y" placeholder="Explique o problema, quando o identificou e qualquer informação útil para a equipa." />
              <span className="mt-1 block text-right text-[9px] font-normal text-slate-400">{description.length}/2000</span>
            </label>

            {message && <div role="status" className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-xs font-bold text-blue-800"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/>{message}</div>}

            <button type="button" onClick={() => void submitRequest()} disabled={submitting || loading || !orders.length} className="btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <span className="animate-pulse">A enviar...</span> : <><Send size={15}/> Enviar solicitação</>}
            </button>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="card p-5">
            <p className="section-kicker">Antes de enviar</p>
            <h2 className="mt-1 text-sm font-black text-slate-950">Inclua informação suficiente</h2>
            <div className="mt-4 space-y-3 text-[10px] leading-5 text-slate-500">
              <p><strong className="text-slate-800">Encomenda:</strong> confirme que selecionou o pedido correto.</p>
              <p><strong className="text-slate-800">Motivo:</strong> seja objetivo e indique o problema principal.</p>
              <p><strong className="text-slate-800">Descrição:</strong> acrescente contexto útil para a análise da equipa.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-800">Pedido selecionado</p>
            <p className="mt-2 text-sm font-black text-slate-900">{selectedOrder?.orderNumber || "Nenhuma encomenda"}</p>
            <p className="mt-1 text-[10px] leading-4 text-amber-900">A equipa de suporte poderá analisar a solicitação com base nos dados desta encomenda.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
