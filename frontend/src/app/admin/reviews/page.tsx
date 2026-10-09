"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldCheck, Star, ThumbsUp, XCircle } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Review = {
  id: number;
  rating: number;
  title: string | null;
  comment: string;
  status: string;
  verifiedPurchase: boolean;
  createdAt: string;
  moderationNote: string | null;
  product: { id: number; name: string; slug: string; imageUrl: string | null };
  user: { id: number; name: string | null; email: string | null };
  order: { id: number; orderNumber: string; status: string };
};

const statusLabel: Record<string, string> = { PENDING: "Pendente", APPROVED: "Aprovada", REJECTED: "Rejeitada" };

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("PENDING");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchWithAuth("/api/admin/reviews?status=" + filter, { cache: "no-store" });
      setReviews((result.data || []) as Review[]);
      setStats(result.stats || {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as avaliações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [filter]);

  async function moderate(review: Review, status: "APPROVED" | "REJECTED") {
    const note = (notes[review.id] || "").trim();
    if (status === "REJECTED" && note.length < 5) {
      setError("Indique um motivo de rejeição com pelo menos cinco caracteres.");
      return;
    }
    setBusyId(review.id);
    setError("");
    setNotice("");
    try {
      await fetchWithAuth("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: review.id, status, note: note || undefined }),
      });
      setNotice(status === "APPROVED" ? "Avaliação aprovada e publicada." : "Avaliação rejeitada e registada.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível moderar a avaliação.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Admin · Catálogo</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Avaliações de clientes</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">As avaliações só são publicadas depois de uma verificação. Cada avaliação está associada a uma encomenda paga.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar</button>
      </header>

      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={16} className="mt-0.5"/>{notice}</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><AlertCircle size={16} className="mt-0.5"/>{error}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        {([["PENDING", "Aguardam moderação"], ["APPROVED", "Publicadas"], ["REJECTED", "Rejeitadas"]] as const).map(([status, label]) => <button key={status} type="button" onClick={() => setFilter(status)} className={"card p-4 text-left transition " + (filter === status ? "border-blue-200 bg-blue-50/60" : "hover:border-slate-300")}><p className="text-[10px] font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{stats[status] || 0}</p></button>)}
      </section>

      <div className="flex flex-wrap gap-2">
        {["PENDING", "APPROVED", "REJECTED", "ALL"].map((status) => <button key={status} type="button" onClick={() => setFilter(status)} className={filter === status ? "rounded-full bg-[#132238] px-3 py-2 text-[10px] font-black text-white" : "rounded-full border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-50"}>{status === "ALL" ? "Todas" : statusLabel[status]}</button>)}
      </div>

      <section className="card overflow-hidden">
        {loading ? <div className="space-y-3 p-5">{[1,2,3].map((id) => <div key={id} className="h-40 animate-pulse rounded-xl bg-slate-50"/>)}</div> : reviews.length ? (
          <div className="divide-y divide-slate-100">
            {reviews.map((review) => (
              <article key={review.id} className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50">{review.product.imageUrl ? <img src={review.product.imageUrl} alt={review.product.name} className="h-full w-full object-contain"/> : <Star size={20} className="text-slate-300"/>}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-black text-slate-950">{review.product.name}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-600">{statusLabel[review.status] || review.status}</span>{review.verifiedPurchase && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700"><ShieldCheck size={11}/> Compra verificada</span>}</div>
                    <div className="mt-2 flex items-center gap-2"><span className="text-amber-500">{Array.from({ length: 5 }, (_, i) => i < review.rating ? "★" : "☆").join("")}</span><span className="text-[10px] font-black text-slate-600">{review.rating}/5</span></div>
                    <p className="mt-1 text-[10px] text-slate-500">{review.user.name || "Cliente"} · {review.user.email || "Sem e-mail"} · {review.order.orderNumber} · {new Date(review.createdAt).toLocaleString("pt-PT")}</p>
                  </div>
                  <Link href={"/products/" + review.product.slug} target="_blank" className="inline-flex h-fit items-center gap-1 text-[10px] font-bold text-blue-700 hover:underline">Ver produto <ExternalLink size={12}/></Link>
                </div>
                {review.title && <h3 className="text-xs font-black text-slate-900">{review.title}</h3>}
                <p className="whitespace-pre-wrap text-xs leading-5 text-slate-600">{review.comment}</p>
                {review.status === "PENDING" ? (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                    <label className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Nota de moderação (opcional; obrigatória para rejeitar)<input value={notes[review.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [review.id]: event.target.value }))} maxLength={500} className="settings-input mt-2" placeholder="Motivo ou nota"/></label>
                    <button type="button" onClick={() => void moderate(review, "REJECTED")} disabled={busyId === review.id} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50">{busyId === review.id ? <Loader2 size={14} className="animate-spin"/> : <XCircle size={14}/>} Rejeitar</button>
                    <button type="button" onClick={() => void moderate(review, "APPROVED")} disabled={busyId === review.id} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#132238] px-4 py-3 text-xs font-black text-white hover:bg-[#1d6ac4] disabled:opacity-50">{busyId === review.id ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} Publicar</button>
                  </div>
                ) : review.moderationNote && <p className="text-[10px] text-slate-500">Nota de moderação: {review.moderationNote}</p>}
              </article>
            ))}
          </div>
        ) : <div className="p-12 text-center"><Star size={32} className="mx-auto text-slate-300"/><h2 className="mt-3 text-sm font-black text-slate-800">Sem avaliações nesta vista</h2><p className="mt-1 text-xs text-slate-500">As avaliações submetidas pelos clientes aparecerão aqui para moderação.</p></div>}
      </section>
    </div>
  );
}
