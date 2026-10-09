"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, RefreshCw, XCircle, Building2 } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Quote = {
  id: number;
  quoteNumber: string;
  status: string;
  companyName: string;
  companyNif: string;
  email: string;
  phone: string;
  createdAt: string;
  items: Array<{ productId: number; name: string; quantity: number; unitPrice: string | number; subtotal: string | number }>;
  company?: { id: number; legalName: string; tradeName?: string | null; nif: string; status: string } | null;
  user?: { name?: string | null; email?: string | null } | null;
  purchaseOrders: Array<{ id: number; poNumber: string; status: string; orderId?: number | null }>;
};

type Rule = {
  id: number;
  companyId: number;
  productId: number;
  minQuantity: number;
  unitPrice: string | number;
  currency: string;
  active: boolean;
  company: { id: number; legalName: string; tradeName?: string | null };
  product: { id: number; name: string };
};

type Option = { id: number; legalName?: string; tradeName?: string | null; name?: string; status?: string };

export default function AdminB2BPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [companies, setCompanies] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [tab, setTab] = useState<"quotes" | "pricing">("quotes");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [decisionNotes, setDecisionNotes] = useState<Record<number, string>>({});
  const [form, setForm] = useState({ companyId: "", productId: "", minQuantity: "1", unitPrice: "", currency: "AOA" });

  async function load() {
    setLoading(true); setError("");
    try {
      const [quoteResult, priceResult] = await Promise.all([
        fetchWithAuth("/api/admin/b2b/quotes?status=ALL"),
        fetchWithAuth("/api/admin/b2b/price-rules"),
      ]);
      setQuotes(quoteResult.data ?? []);
      setRules(priceResult.data ?? []);
      setCompanies(priceResult.companies ?? []);
      setProducts(priceResult.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a operação B2B.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function processQuote(quoteId: number, action: "APPROVE" | "REJECT", note = "") {
    const decisionNote = note.trim();
    if (action === "REJECT" && decisionNote.length < 5) {
      setError("Indique o motivo da rejeição com pelo menos cinco caracteres.");
      return;
    }
    setBusy(quoteId); setError(""); setMessage("");
    try {
      const result = await fetchWithAuth("/api/admin/b2b/quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, action, note: decisionNote || undefined }),
      });
      setMessage(action === "APPROVE"
        ? `Cotação aprovada. Documento ${result.data.purchaseOrder?.poNumber || "PO"} criado.`
        : "Cotação rejeitada.");
      setDecisionNotes((current) => ({ ...current, [quoteId]: "" }));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível processar a cotação."); }
    finally { setBusy(null); }
  }

  async function saveRule(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      await fetchWithAuth("/api/admin/b2b/price-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: Number(form.companyId),
          productId: Number(form.productId),
          minQuantity: Number(form.minQuantity),
          unitPrice: Number(form.unitPrice),
          currency: form.currency,
          active: true,
        }),
      });
      setMessage("Preço empresarial guardado.");
      setForm({ companyId: "", productId: "", minQuantity: "1", unitPrice: "", currency: "AOA" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível guardar o preço."); }
  }

  async function deleteRule(id: number) {
    if (!window.confirm("Remover este preço empresarial?")) return;
    try {
      await fetchWithAuth(`/api/admin/b2b/price-rules?id=${id}`, { method: "DELETE" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível remover o preço."); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Admin · B2B</p><h1 className="mt-1 text-2xl font-black">Operação empresarial</h1><p className="mt-1 text-sm text-slate-500">Aprovação de empresas, cotações e preços comerciais por volume.</p></div>
        <Link href="/admin/b2b/empresas" className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Building2 size={14}/>Empresas</Link><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>Atualizar</button>
      </div>
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("quotes")} className={`border-b-2 px-4 py-3 text-xs font-black ${tab === "quotes" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}>Cotações B2B ({quotes.filter(q => ["SUBMITTED","UNDER_REVIEW"].includes(q.status)).length})</button>
        <button onClick={() => setTab("pricing")} className={`border-b-2 px-4 py-3 text-xs font-black ${tab === "pricing" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}>Preços empresariais ({rules.length})</button>
      </div>

      {tab === "quotes" ? (
        <section className="space-y-3">
          {quotes.filter(q => ["SUBMITTED","UNDER_REVIEW"].includes(q.status)).length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Não existem cotações pendentes.</div> :
          quotes.filter(q => ["SUBMITTED","UNDER_REVIEW"].includes(q.status)).map((quote) => (
            <article key={quote.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><h2 className="font-black">{quote.quoteNumber}</h2><p className="mt-1 text-sm font-semibold">{quote.company?.tradeName || quote.companyName}</p><p className="text-xs text-slate-500">NIF {quote.companyNif} · {quote.email} · {new Date(quote.createdAt).toLocaleString("pt-PT")}</p></div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700">{quote.status}</span>
              </div>
              <div className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
                {quote.items.map((item) => <div key={item.productId} className="flex justify-between gap-4 py-2 text-sm"><span>{item.quantity} × {item.name}</span><strong>{Number(item.subtotal).toLocaleString("pt-AO")} Kz</strong></div>)}
              </div>
              <label className="mt-4 block text-[9px] font-black uppercase tracking-wide text-slate-500">
                Nota de decisão <span className="font-medium normal-case tracking-normal text-slate-400">— obrigatória para rejeitar</span>
                <textarea
                  value={decisionNotes[quote.id] || ""}
                  onChange={(event) => setDecisionNotes((current) => ({ ...current, [quote.id]: event.target.value }))}
                  maxLength={1000}
                  rows={2}
                  placeholder="Registe o motivo, condições ou esclarecimentos comerciais..."
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button disabled={busy === quote.id} onClick={() => void processQuote(quote.id, "REJECT", decisionNotes[quote.id] || "")} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50"><XCircle size={14}/>Rejeitar</button>
                <button disabled={busy === quote.id} onClick={() => void processQuote(quote.id, "APPROVE", decisionNotes[quote.id] || "")} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white hover:bg-blue-800 disabled:opacity-50"><CheckCircle2 size={14}/>{busy === quote.id ? "A processar..." : "Aprovar cotação"}</button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="space-y-5">
          <form onSubmit={saveRule} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-5">
            <select required value={form.companyId} onChange={e => setForm({...form, companyId:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Empresa</option>{companies.filter(c => c.status === "ACTIVE").map(c => <option key={c.id} value={c.id}>{c.tradeName || c.legalName}</option>)}</select>
            <select required value={form.productId} onChange={e => setForm({...form, productId:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Produto</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input required min="1" type="number" value={form.minQuantity} onChange={e => setForm({...form, minQuantity:e.target.value})} placeholder="Qtd. mínima" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/>
            <input required min="0.01" step="0.01" type="number" value={form.unitPrice} onChange={e => setForm({...form, unitPrice:e.target.value})} placeholder="Preço unitário" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/>
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800">Guardar preço</button>
            <select value={form.currency} onChange={e => setForm({...form, currency:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="AOA">AOA</option><option value="EUR">EUR</option></select>
          </form>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Mínimo</th><th className="px-4 py-3">Preço</th><th className="px-4 py-3">Ação</th></tr></thead><tbody>{rules.map(rule => <tr key={rule.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{rule.company.tradeName || rule.company.legalName}</td><td className="px-4 py-3">{rule.product.name}</td><td className="px-4 py-3">{rule.minQuantity}</td><td className="px-4 py-3 font-black">{Number(rule.unitPrice).toLocaleString(rule.currency === "EUR" ? "pt-PT" : "pt-AO")} {rule.currency}</td><td className="px-4 py-3"><button onClick={() => void deleteRule(rule.id)} className="font-bold text-rose-600 hover:underline">Remover</button></td></tr>)}</tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}
