"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Package, RefreshCcw, Send } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type RequestType = "RETURN" | "EXCHANGE" | "COMPLAINT";
type Order = { id: number; orderNumber: string; createdAt: string };

const requestTypes: Array<{ id: RequestType; label: string; description: string; icon: typeof Package }> = [
  { id: "RETURN", label: "Devolução", description: "Quero devolver o produto", icon: Package },
  { id: "EXCHANGE", label: "Troca", description: "Quero trocar o produto", icon: RefreshCcw },
  { id: "COMPLAINT", label: "Reclamação", description: "Reportar um problema", icon: CircleAlert },
];

export default function ReturnsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderId, setOrderId] = useState("");
  const [type, setType] = useState<RequestType>("RETURN");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWithAuth("/api/orders")
      .then((response) => {
        setOrders(response.data);
        if (response.data[0]) setOrderId(String(response.data[0].id));
      })
      .catch(() => setMessage("Não foi possível carregar as suas encomendas."));
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
        body: JSON.stringify({ orderId: Number(orderId), type, reason, description }),
      });
      setMessage(`Solicitação ${response.data.requestNumber} enviada com sucesso.`);
      setReason("");
      setDescription("");
    } catch {
      setMessage("Não foi possível enviar a solicitação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1d6ac4]">A minha conta</p>
        <h1 className="mt-2 text-2xl font-black text-gray-900">Devoluções e reclamações</h1>
        <p className="mt-1 text-sm text-gray-500">Registe uma solicitação associada a uma encomenda real.</p>
      </header>
      <main className="card max-w-3xl p-5 sm:p-6">
        <div className="grid gap-3 md:grid-cols-3">
          {requestTypes.map(({ id, label, description, icon: Icon }) => (
            <button type="button" key={id} onClick={() => setType(id)} className={`rounded-lg border p-4 text-left ${type === id ? "border-[#1555d8] bg-blue-50" : "border-gray-200"}`}>
              <Icon size={21} className="text-[#1555d8]" />
              <strong className="mt-2 block text-xs text-gray-900">{label}</strong>
              <small className="text-[10px] text-gray-500">{description}</small>
            </button>
          ))}
        </div>
        <label className="mt-5 block text-sm font-semibold text-gray-700">
          Encomenda
          <select className="settings-input mt-2" value={orderId} onChange={(event) => setOrderId(event.target.value)} disabled={!orders.length}>
            {!orders.length && <option value="">Nenhuma encomenda disponível</option>}
            {orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {new Date(order.createdAt).toLocaleDateString("pt-PT")}</option>)}
          </select>
        </label>
        <label className="mt-5 block text-sm font-semibold text-gray-700">
          Motivo
          <input value={reason} onChange={(event) => setReason(event.target.value)} className="settings-input mt-2" placeholder="Ex.: produto danificado" />
        </label>
        <label className="mt-5 block text-sm font-semibold text-gray-700">
          Descrição
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="settings-input mt-2 min-h-28" placeholder="Descreva o que aconteceu" />
        </label>
        {message && <p role="status" className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-[#1555d8]">{message}</p>}
        <button type="button" onClick={submitRequest} disabled={submitting || !orders.length} className="btn-primary mt-5 disabled:opacity-60"><Send size={15} /> {submitting ? "A enviar..." : "Enviar solicitação"}</button>
      </main>
    </div>
  );
}
