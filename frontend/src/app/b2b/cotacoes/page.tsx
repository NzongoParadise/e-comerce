"use client";

import { FileText, Plus, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api";

type Quote = { id: number; quoteNumber: string; status: string; createdAt: string; items?: Array<unknown> };
type Product = { id: number; name: string };

const statusLabels: Record<string, string> = {
  SUBMITTED: "Submetida",
  UNDER_REVIEW: "Em análise",
  PENDING: "Em análise",
  REVIEW: "Em análise",
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
  CONVERTED: "Convertida",
};

export default function B2BQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [quoteResult, productResult] = await Promise.all([
        fetchWithAuth("/api/b2b/quotes"),
        fetchWithAuth("/api/products?page=1&pageSize=100"),
      ]);
      setQuotes(quoteResult.data || []);
      setProducts(productResult.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const requestedProduct = new URLSearchParams(window.location.search).get("product");
    if (!requestedProduct) return;
    setProductId(requestedProduct);
    setOpen(true);
  }, []);

  async function submit() {
    if (!productId || Number(quantity) < 1) {
      setMsg("Selecione um produto e indique uma quantidade válida.");
      return;
    }
    setSending(true);
    setMsg("");
    try {
      const result = await fetchWithAuth("/api/b2b/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ productId: Number(productId), quantity: Number(quantity) }], notes }),
      });
      if (!result.data) throw new Error(result.error || "Não foi possível enviar a cotação.");
      setMsg("Cotação enviada com sucesso.");
      setOpen(false);
      setNotes("");
      setProductId("");
      setQuantity("1");
      window.history.replaceState(null, "", "/b2b/cotacoes");
      await load();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Não foi possível enviar a cotação.");
    } finally {
      setSending(false);
    }
  }

  const visible = useMemo(() => quotes.filter((quote) => {
    const matchesSearch = `${quote.quoteNumber} ${quote.status}`.toLowerCase().includes(query.toLowerCase().trim());
    const matchesFilter = filter === "ALL" || (filter === "PENDING" && (quote.status === "PENDING" || quote.status === "REVIEW")) || quote.status === filter;
    return matchesSearch && matchesFilter;
  }), [quotes, query, filter]);

  const counts = {
    ALL: quotes.length,
    PENDING: quotes.filter((quote) => quote.status === "PENDING" || quote.status === "REVIEW").length,
    APPROVED: quotes.filter((quote) => quote.status === "APPROVED").length,
    CONVERTED: quotes.filter((quote) => quote.status === "CONVERTED").length,
    REJECTED: quotes.filter((quote) => quote.status === "REJECTED").length,
  };

  const tabs = [
    { id: "ALL", label: "Todas" },
    { id: "PENDING", label: "Em análise" },
    { id: "APPROVED", label: "Aprovadas" },
    { id: "CONVERTED", label: "Convertidas" },
    { id: "REJECTED", label: "Recusadas" },
  ];

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="section-kicker">B2B · Comercial</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Pedidos de cotação</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Solicite condições comerciais por volume e acompanhe cada pedido até à aprovação.</p>
        </div>
        <button type="button" onClick={() => { setOpen(true); setMsg(""); }} className="btn-primary"><Plus size={15} /> Nova cotação</button>
      </header>

      {msg && <div role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{msg}</div>}

      {open && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#1d6ac4]">Novo pedido</p><h2 className="mt-1 text-sm font-black text-slate-950">Solicitar uma cotação</h2></div>
            <button type="button" onClick={() => setOpen(false)} className="workspace-icon-button" aria-label="Fechar"><X size={16} /></button>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-[1fr_180px]">
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Produto
              <select value={productId} onChange={(event) => setProductId(event.target.value)} className="settings-input mt-2 normal-case">
                <option value="">Selecionar produto</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Quantidade
              <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="settings-input mt-2 normal-case" />
            </label>
            <label className="md:col-span-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Notas para a equipa comercial
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Prazo, quantidade recorrente, condições de entrega..." className="settings-input mt-2 min-h-24 normal-case" />
            </label>
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="button" onClick={() => void submit()} disabled={sending} className="btn-primary disabled:opacity-50"><Send size={14} /> {sending ? "A enviar..." : "Enviar pedido"}</button>
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setFilter(tab.id)} className={filter === tab.id ? "border-b-2 border-[#1d6ac4] px-3 py-2.5 text-[10px] font-black text-[#1555d8]" : "border-b-2 border-transparent px-3 py-2.5 text-[10px] font-bold text-slate-500 hover:text-slate-900"}>{tab.label}<span className="ml-1 opacity-60">{counts[tab.id as keyof typeof counts]}</span></button>)}
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar referência..." className="settings-input lg:max-w-xs" />
        </div>

        {loading ? (
          <div className="space-y-2 p-4">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-50" />)}</div>
        ) : visible.length ? (
          <div className="divide-y divide-slate-100">
            {visible.map((quote) => (
              <article key={quote.id} className="px-4 py-4 transition hover:bg-slate-50 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1d6ac4]"><FileText size={18} /></span>
                    <div className="min-w-0"><p className="text-xs font-black text-slate-900">{quote.quoteNumber}</p><p className="mt-1 text-[9px] text-slate-500">{quote.items?.length || 0} artigo(s) · {new Date(quote.createdAt).toLocaleDateString("pt-PT")}</p></div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1.5 text-[9px] font-black ${
                    quote.status === "APPROVED" || quote.status === "CONVERTED" ? "bg-emerald-50 text-emerald-700" :
                    quote.status === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                  }`}>{statusLabels[quote.status] || quote.status}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center"><FileText size={32} className="mx-auto text-slate-300" /><h2 className="mt-3 text-sm font-black text-slate-800">Nenhuma cotação encontrada</h2><p className="mt-1 text-xs text-slate-500">Crie um novo pedido ou ajuste o filtro.</p><button type="button" onClick={() => setOpen(true)} className="btn-primary mt-4">Criar cotação</button></div>
        )}
      </section>
    </div>
  );
}
