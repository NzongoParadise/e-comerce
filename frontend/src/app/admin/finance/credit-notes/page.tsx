"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ExternalLink, FileCheck2, RefreshCw, Search } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type CreditNote = {
  id: number;
  creditNoteNumber: string;
  verificationCode: string;
  status: string;
  currency: string;
  amountEUR: string | number;
  amountKZ: string | number;
  reason: string;
  issuedAt: string;
  sellerTaxId: string | null;
  invoice: { id: number; invoiceNumber: string; status: string };
  order: { id: number; orderNumber: string; status: string };
  refund: { id: number; status: string; provider: string; providerRefundId: string | null; processedAt: string | null };
  user: { id: number; name: string | null; email: string | null };
  company: { id: number; legalName: string; tradeName: string | null; nif: string } | null;
};

type ApiResponse = {
  data: CreditNote[];
  meta: { total: number; page: number; pageSize: number; pageCount: number };
  stats: Record<string, number>;
};

function money(note: CreditNote) {
  return note.currency === "EUR"
    ? "€ " + Number(note.amountEUR).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "Kz " + Number(note.amountKZ).toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

export default function AdminCreditNotesPage() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ status, search, page: String(page), pageSize: "25" });
    try {
      const response = await fetchWithAuth("/api/admin/finance/credit-notes?" + query.toString(), { cache: "no-store" }) as ApiResponse;
      setNotes(response.data || []);
      setStats(response.stats || {});
      setTotal(response.meta?.total || 0);
      setPageCount(Math.max(1, response.meta?.pageCount || 1));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as notas de crédito.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [status, search, page]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Financeiro · Documentos de crédito</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Notas de crédito</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Registo de notas emitidas após reembolsos confirmados, ligadas à fatura original e ao identificador de reembolso. Cada registo tem número e código de verificação únicos.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar</button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => { setStatus("ALL"); setPage(1); }} className={"card p-4 text-left transition " + (status === "ALL" ? "border-blue-200 bg-blue-50/50" : "hover:border-slate-300")}>
          <p className="text-[10px] font-bold text-slate-500">Todas as notas</p><p className="mt-1 text-2xl font-black text-slate-950">{total}</p>
        </button>
        <button type="button" onClick={() => { setStatus("ISSUED"); setPage(1); }} className={"card p-4 text-left transition " + (status === "ISSUED" ? "border-emerald-200 bg-emerald-50/50" : "hover:border-slate-300")}>
          <p className="text-[10px] font-bold text-slate-500">Emitidas</p><p className="mt-1 text-2xl font-black text-slate-950">{stats.ISSUED || 0}</p>
        </button>
        <button type="button" onClick={() => { setStatus("VOIDED"); setPage(1); }} className={"card p-4 text-left transition " + (status === "VOIDED" ? "border-rose-200 bg-rose-50/50" : "hover:border-slate-300")}>
          <p className="text-[10px] font-bold text-slate-500">Anuladas</p><p className="mt-1 text-2xl font-black text-slate-950">{stats.VOIDED || 0}</p>
        </button>
      </section>

      <form onSubmit={submitSearch} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} maxLength={160} placeholder="Pesquisar nota, fatura, encomenda, nome ou NIF..." aria-label="Pesquisar notas de crédito" className="settings-input pl-9"/>
        </div>
        <button type="submit" className="btn-primary justify-center">Pesquisar</button>
        <button type="button" onClick={() => { setSearchDraft(""); setSearch(""); setStatus("ALL"); setPage(1); }} className="btn-secondary justify-center">Limpar filtros</button>
      </form>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><div className="flex items-center gap-2"><FileCheck2 size={17} className="text-blue-700"/><h2 className="text-sm font-black text-slate-950">Registo de documentos</h2></div><p className="text-[10px] text-slate-500">{total} resultado(s)</p></div>
        {loading ? (
          <div className="space-y-3 p-5">{[1,2,3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-50"/>)}</div>
        ) : notes.length ? (
          <div className="divide-y divide-slate-100">
            {notes.map((note) => {
              const buyer = note.company?.tradeName || note.company?.legalName || note.user.name || note.user.email || "Cliente";
              const verifyUrl = "/verificar-nota-credito/" + encodeURIComponent(note.verificationCode);
              return <article key={note.id} className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><FileCheck2 size={18}/></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-slate-950">{note.creditNoteNumber}</h3><span className={"rounded-full px-2.5 py-1 text-[9px] font-black " + (note.status === "ISSUED" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{note.status === "ISSUED" ? "Emitida" : note.status}</span></div>
                  <p className="mt-1 text-sm font-black text-slate-800">{money(note)}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{buyer}{note.company?.nif ? " · NIF " + note.company.nif : note.user.email ? " · " + note.user.email : ""}</p>
                  <p className="mt-1 text-[10px] text-slate-500">Fatura {note.invoice.invoiceNumber} · Encomenda {note.order.orderNumber} · Reembolso #{note.refund.id} ({note.refund.status})</p>
                  <p className="mt-1 text-[10px] text-slate-500">Emitida em {new Date(note.issuedAt).toLocaleString("pt-PT")} · Referência externa {note.refund.providerRefundId || "não disponibilizada"}</p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{note.reason}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:max-w-48">
                  <Link href={"/notas-de-credito/" + note.id} className="btn-primary"><FileCheck2 size={13}/> Abrir documento</Link>
                  <Link href={verifyUrl} target="_blank" className="btn-secondary"><ExternalLink size={12}/> Validar código</Link>
                </div>
              </article>;
            })}
          </div>
        ) : <div className="p-12 text-center"><FileCheck2 size={32} className="mx-auto text-slate-300"/><h2 className="mt-3 text-sm font-black text-slate-800">Nenhuma nota de crédito nesta vista</h2><p className="mt-1 text-xs text-slate-500">Quando um reembolso for confirmado, a nota correspondente aparecerá aqui.</p></div>}
        {pageCount > 1 && <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10px] text-slate-500">Página {page} de {pageCount}</p><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="btn-secondary disabled:opacity-40">Anterior</button><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || loading} className="btn-secondary disabled:opacity-40">Seguinte</button></div></div>}
      </section>
    </div>
  );
}
