"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Headphones, MapPin, Package, RefreshCw, Truck } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type TrackingEvent = { id: number; status: string; location?: string; description?: string; occurredAt: string };
type Tracking = { orderNumber: string; carrier?: string; trackingNumber?: string; status: string; trackingEvents: TrackingEvent[]; carrierData?: { status?: string; events?: TrackingEvent[] } | null; carrierDataError?: string | null };

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestInFlight = useRef(false);
  const hasLoaded = useRef(false);

  const refreshTracking = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (hasLoaded.current) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/orders/${id}/tracking`, { cache: "no-store" });
      setTracking(response.data);
      setLastUpdated(new Date());
      setError("");
      setRefreshError(response.data.carrierDataError || "");
      hasLoaded.current = true;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Não foi possível atualizar o tracking.";
      if (hasLoaded.current) setRefreshError(message);
      else setError(message);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshTracking(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshTracking();
    }, 120_000);
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") void refreshTracking();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [refreshTracking]);

  if (error) return <div className="py-20 text-center"><p className="text-sm text-red-600">{error}</p><button type="button" onClick={() => void refreshTracking()} className="btn-secondary mt-4"><RefreshCw size={14} /> Tentar novamente</button></div>;
  if (loading || !tracking) return <div className="py-20 text-center text-sm text-gray-500" role="status">A carregar tracking...</div>;
  const events = tracking.carrierData?.events?.length ? tracking.carrierData.events : tracking.trackingEvents;

  return <div className="space-y-5 pb-8">
    <nav className="text-xs text-gray-400"><Link href="/account/orders" className="hover:text-[#1d6ac4]">As minhas encomendas</Link> › Tracking</nav>
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-black text-gray-900">Acompanhar encomenda</h1><p className="mt-1 text-sm text-gray-500">O tracking atualiza automaticamente enquanto esta página estiver aberta.</p></div><div className="rounded-lg bg-blue-50 px-4 py-3 text-xs"><strong className="block text-gray-900">{tracking.orderNumber}</strong><span>{tracking.carrier || "Transportadora por definir"} · {tracking.trackingNumber || "Sem código"}</span></div></header>
    <main className="card max-w-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[#1555d8]"><Truck size={20} /></span><div><p className="text-sm font-bold text-gray-900">{tracking.carrierData?.status || tracking.status}</p><p className="text-xs text-gray-500">{events.length ? `${events.length} atualização(ões)` : "Sem atualizações disponíveis"}</p></div></div>
        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && <span className="text-[10px] text-gray-400">Verificado às {lastUpdated.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button type="button" onClick={() => void refreshTracking()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </div>
      {refreshError && <p role="status" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{refreshError}</p>}
      <div className="mt-6 space-y-6">{events.map((event, index) => <div key={event.id} className="relative flex gap-3"><span className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-[#1555d8] text-white" : "bg-gray-100 text-gray-500"}`}>{index === 0 ? <Check size={14} /> : <Package size={14} />}</span><div><p className="text-xs font-bold text-gray-900">{event.status}</p><p className="mt-1 text-xs text-gray-600">{event.description || "Atualização recebida."}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-gray-400"><MapPin size={11} /> {event.location || "Localização não informada"} · {new Date(event.occurredAt).toLocaleString("pt-PT")}</p></div></div>)}</div>
      <Link href={`/account/support?orderId=${id}`} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-xs font-bold text-[#1555d8] hover:bg-blue-100"><Headphones size={15} /> Reportar um problema com esta encomenda</Link>
    </main>
  </div>;
}
