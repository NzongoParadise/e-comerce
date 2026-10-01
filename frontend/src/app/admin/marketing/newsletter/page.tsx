"use client";

import { useEffect, useState } from "react";
import { Download, LoaderCircle, Search, Trash2 } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Subscriber = { id: number; email: string; createdAt: string };
type SubscriberStats = { total: number; newThisMonth: number };

export default function MarketingNewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<SubscriberStats>({ total: 0, newThisMonth: 0 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const query = new URLSearchParams({ search, page: String(page), pageSize: "30" });
          const response = await fetchWithAuth(`/api/admin/marketing/subscribers?${query}`);
          if (!active) return;
          setSubscribers(response.data);
          setStats(response.stats);
          setPageCount(response.meta.pageCount || 1);
        } catch (loadError) {
          if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os subscritores.");
        } finally { if (active) setLoading(false); }
      })();
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, page]);

  async function removeSubscriber(subscriber: Subscriber) {
    if (!window.confirm(`Remover ${subscriber.email} da newsletter?`)) return;
    setBusyId(subscriber.id);
    setError("");
    try {
      await fetchWithAuth(`/api/admin/marketing/subscribers/${subscriber.id}`, { method: "DELETE" });
      setNotice(`${subscriber.email} foi removido da lista.`);
      setSubscribers((current) => current.filter((item) => item.id !== subscriber.id));
      setStats((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Não foi possível remover o subscritor.");
    } finally { setBusyId(null); }
  }

  async function exportSubscribers() {
    setError("");
    try {
      const response = await fetchWithAuth("/api/admin/marketing/subscribers?page=1&pageSize=100");
      const records: Subscriber[] = [...response.data];
      for (let currentPage = 2; currentPage <= response.meta.pageCount; currentPage += 1) {
        const pageResponse = await fetchWithAuth(`/api/admin/marketing/subscribers?page=${currentPage}&pageSize=100`);
        records.push(...pageResponse.data);
      }
      const csv = ["Email,Data de subscrição", ...records.map((item) => `"${item.email}","${new Date(item.createdAt).toLocaleDateString("pt-PT")}"`)].join("\n");
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "subscritores-newsletter.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Não foi possível exportar a lista.");
    }
  }

  return <main>
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Marketing · Audiência</p><h1 className="mt-1 text-2xl font-black">Newsletter</h1><p className="mt-1 text-sm text-gray-500">Consulte subscrições e remova pedidos de saída.</p></div><button type="button" onClick={exportSubscribers} className="inline-flex items-center gap-2 border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><Download size={15} />Exportar CSV</button></div>
    {notice && <p role="status" className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-2"><Metric label="Subscritores" value={stats.total} /><Metric label="Novos este mês" value={stats.newThisMonth} /></div>
    <section className="border border-gray-200 bg-white"><div className="relative border-b border-gray-200 p-4"><Search size={15} className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} aria-label="Pesquisar subscritores" placeholder="Pesquisar email" className="w-full max-w-lg border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-700" /></div><div className="hidden grid-cols-[1.5fr_1fr_48px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[9px] font-black uppercase text-gray-500 sm:grid"><span>Email</span><span>Subscrito em</span><span /></div><div className="divide-y divide-gray-100">{loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500"><LoaderCircle size={16} className="animate-spin" />A carregar subscritores...</div> : subscribers.length === 0 ? <p className="p-10 text-center text-sm text-gray-500">Nenhum subscritor encontrado.</p> : subscribers.map((subscriber) => <div key={subscriber.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1.5fr_1fr_48px] sm:items-center"><strong className="break-all text-xs text-gray-800">{subscriber.email}</strong><span className="text-[10px] text-gray-500">{new Date(subscriber.createdAt).toLocaleString("pt-PT")}</span><button type="button" disabled={busyId === subscriber.id} onClick={() => void removeSubscriber(subscriber)} aria-label={`Remover ${subscriber.email}`} title="Remover da newsletter" className="flex h-8 w-8 items-center justify-center border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} /></button></div>)}</div><div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500"><span>Página {page} de {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="border border-gray-200 px-3 py-1.5 disabled:opacity-40">Anterior</button><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="border border-gray-200 px-3 py-1.5 disabled:opacity-40">Seguinte</button></div></div></section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="border border-gray-200 bg-white p-4"><p className="text-[10px] font-bold uppercase text-gray-500">{label}</p><p className="mt-2 text-2xl font-black text-gray-900">{value.toLocaleString("pt-PT")}</p></div>;
}
