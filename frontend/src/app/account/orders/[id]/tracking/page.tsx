"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, MapPin, Package, Truck } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type TrackingEvent = { id: number; status: string; location?: string; description?: string; occurredAt: string };
type Tracking = { orderNumber: string; carrier?: string; trackingNumber?: string; status: string; trackingEvents: TrackingEvent[]; carrierData?: { status?: string; events?: TrackingEvent[] } | null };

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithAuth(`/api/orders/${id}/tracking`).then((response) => setTracking(response.data)).catch(() => setError("Não foi possível carregar o tracking desta encomenda."));
  }, [id]);

  if (error) return <div className="py-20 text-center text-sm text-red-600">{error}</div>;
  if (!tracking) return <div className="py-20 text-center text-sm text-gray-500">A carregar tracking...</div>;
  const events = tracking.carrierData?.events?.length ? tracking.carrierData.events : tracking.trackingEvents;

  return <div className="space-y-5 pb-8">
    <nav className="text-xs text-gray-400"><Link href="/account/orders" className="hover:text-[#1d6ac4]">As minhas encomendas</Link> › Tracking</nav>
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-black text-gray-900">Tracking da encomenda</h1><p className="mt-1 text-sm text-gray-500">Estado atualizado a partir dos eventos da encomenda e da transportadora.</p></div><div className="rounded-lg bg-blue-50 px-4 py-3 text-xs"><strong className="block text-gray-900">{tracking.orderNumber}</strong><span>{tracking.carrier || "Transportadora por definir"} · {tracking.trackingNumber || "Sem código"}</span></div></header>
    <main className="card max-w-3xl p-5 sm:p-6"><div className="flex items-center gap-3 border-b border-gray-100 pb-5"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[#1555d8]"><Truck size={20} /></span><div><p className="text-sm font-bold text-gray-900">{tracking.carrierData?.status || tracking.status}</p><p className="text-xs text-gray-500">{events.length ? `${events.length} atualização(ões)` : "Sem atualizações disponíveis"}</p></div></div><div className="mt-6 space-y-6">{events.map((event, index) => <div key={event.id} className="relative flex gap-3"><span className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-[#1555d8] text-white" : "bg-gray-100 text-gray-500"}`}>{index === 0 ? <Check size={14} /> : <Package size={14} />}</span><div><p className="text-xs font-bold text-gray-900">{event.status}</p><p className="mt-1 text-xs text-gray-600">{event.description || "Atualização recebida."}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-gray-400"><MapPin size={11} /> {event.location || "Localização não informada"} · {new Date(event.occurredAt).toLocaleString("pt-PT")}</p></div></div>)}</div></main>
  </div>;
}
