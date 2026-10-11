"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, RefreshCw, XCircle, Building2 } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Quote = {
  id: number;
  quoteNumber: string;
  status: string;
  currency: "AOA" | "EUR";
  companyName: string;
  companyNif: string;
  email: string;
  phone: string;
  createdAt: string;
  version: number;
  items: Array<{ productId: number; name: string; quantity: number; unitPrice: string | number; subtotal: string | number }>;
  company?: { id: number; legalName: string; tradeName?: string | null; nif: string; status: string } | null;
  user?: { name?: string | null; email?: string | null } | null;
  purchaseOrders: Array<{ id: number; poNumber: string; status: string; orderId?: number | null }>;
};

function formatQuoteAmount(value: number | string, currency: string) {
  const supportedCurrency = currency === "EUR" ? "EUR" : "AOA";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: supportedCurrency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

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
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [proposalEdits, setProposalEdits] = useState<Record<number, Record<number, { quantity: string; unitPrice: string }>>>({});
  const [proposalTerms, setProposalTerms] = useState<Record<number, { shippingAmount: string; taxAmount: string; deliveryDays: string; paymentTerms: string }>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ companyId: "", productId: "", minQuantity: "1", unitPrice: "", currency: "AOA" });

  async function load() {
    setLoading(true); setError("");
    try {
      const [quoteResult, priceResult] = await Promise.all([
        fetchWithAuth(`/api/admin/b2b/quotes?status=ALL${companyId ? `&companyId=${companyId}` : ""}`),
        fetchWithAuth(`/api/admin/b2b/price-rules${companyId ? `?companyId=${companyId}` : ""}`),
      ]);
      setQuotes(quoteResult.data ?? []);
      setRules(priceResult.data ?? []);
      setCompanies(priceResult.companies ?? []);
      setProducts(priceResult.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a operação B2B.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const initialCompanyId = params.get("companyId") || "";
    const initialTab = params.get("tab");
    Promise.all([
      fetchWithAuth(`/api/admin/b2b/quotes?status=ALL${initialCompanyId ? `&companyId=${initialCompanyId}` : ""}`),
      fetchWithAuth(`/api/admin/b2b/price-rules${initialCompanyId ? `?companyId=${initialCompanyId}` : ""}`),
    ]).then(([quoteResult, priceResult]) => {
      if (!active) return;
      setCompanyId(initialCompanyId);
      if (initialTab === "pricing") setTab("pricing");
      setQuotes(quoteResult.data ?? []);
      setRules(priceResult.data ?? []);
      setCompanies(priceResult.companies ?? []);
      setProducts(priceResult.products ?? []);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a operação B2B.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function processQuote(quoteId: number, action: "ISSUE_PROPOSAL" | "REJECT") {
    const quote = quotes.find((item) => item.id === quoteId);
    if (!quote) {
      setError("A cotação já não está disponível. Atualize a lista.");
      return;
    }

    let items: Array<{ productId: number; quantity: number; unitPrice: number }> | undefined;
    let termsPayload: { shippingAmount: number; taxAmount: number; deliveryDays?: number; paymentTerms: string } | undefined;
    if (action === "ISSUE_PROPOSAL") {
      const edits = proposalEdits[quoteId] ?? {};
      const terms = proposalTerms[quoteId] ?? { shippingAmount: "0", taxAmount: "0", deliveryDays: "", paymentTerms: "" };
      items = quote.items.map((item) => {
        const edit = edits[item.productId];
        return {
          productId: item.productId,
          quantity: Number(edit?.quantity ?? item.quantity),
          unitPrice: Number(edit?.unitPrice ?? (Number(item.unitPrice) > 0 ? String(item.unitPrice) : "")),
        };
      });
      const invalidLine = items.find((item) =>
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100000 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice <= 0 ||
        item.unitPrice > 99999999.99 ||
        Math.abs(item.unitPrice * 100 - Math.round(item.unitPrice * 100)) > 0.000001
      );
      if (invalidLine) {
        setError("Antes de emitir a proposta, indique para cada artigo uma quantidade inteira válida e um preço unitário positivo com até duas casas decimais.");
        return;
      }
      const shippingAmount = Number(terms.shippingAmount || "0");
      const taxAmount = Number(terms.taxAmount || "0");
      const deliveryDays = terms.deliveryDays.trim() ? Number(terms.deliveryDays) : undefined;
      if (
        !Number.isFinite(shippingAmount) || shippingAmount < 0 || shippingAmount > 99999999.99 ||
        Math.abs(shippingAmount * 100 - Math.round(shippingAmount * 100)) > 0.000001 ||
        !Number.isFinite(taxAmount) || taxAmount < 0 || taxAmount > 99999999.99 ||
        Math.abs(taxAmount * 100 - Math.round(taxAmount * 100)) > 0.000001
      ) {
        setError("Transporte e impostos devem ser valores não negativos com até duas casas decimais.");
        return;
      }
      if (deliveryDays !== undefined && (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365)) {
        setError("O prazo de entrega deve ser um número inteiro entre 1 e 365 dias.");
        return;
      }
      if (terms.paymentTerms.trim().length < 3 || terms.paymentTerms.trim().length > 500) {
        setError("Indique as condições de pagamento (entre 3 e 500 caracteres).");
        return;
      }
      termsPayload = { shippingAmount, taxAmount, ...(deliveryDays ? { deliveryDays } : {}), paymentTerms: terms.paymentTerms.trim() };
    }

    setBusy(quoteId); setError(""); setMessage("");
    try {
      const result = await fetchWithAuth("/api/admin/b2b/quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, action, ...(items ? { items, ...termsPayload } : {}) }),
      });
      if (action === "ISSUE_PROPOSAL") {
        setProposalEdits((current) => {
          const next = { ...current };
          delete next[quoteId];
          return next;
        });
        setProposalTerms((current) => {
          const next = { ...current };
          delete next[quoteId];
          return next;
        });
      }
      setMessage(action === "ISSUE_PROPOSAL"
        ? `Proposta ${result.data.version} enviada. Válida até ${new Date(result.data.validUntil).toLocaleDateString("pt-PT")}.`
        : "Pedido de cotação rejeitado.");
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
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Admin · B2B</p><h1 className="mt-1 text-2xl font-black">Operação empresarial</h1><p className="mt-1 text-sm text-slate-500">Gestão de empresas, cotações e preços comerciais por volume.</p></div>
        <Link href="/admin/b2b/empresas" className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800"><Building2 size={15}/>Gestão de empresas</Link><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>Atualizar</button>
      </div>
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo da operação empresarial">
        <Link href="/admin/b2b/empresas" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow">
          <p className="text-xs font-semibold text-slate-500">Empresas registadas</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{companies.length}</p>
          <p className="mt-1 text-xs font-semibold text-blue-700">Abrir gestão de empresas →</p>
        </Link>
        <button type="button" onClick={() => setTab("quotes")} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow">
          <p className="text-xs font-semibold text-slate-500">Cotações por analisar</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{quotes.filter((quote) => ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"].includes(quote.status)).length}</p>
          <p className="mt-1 text-xs font-semibold text-blue-700">Consultar cotações →</p>
        </button>
        <button type="button" onClick={() => setTab("pricing")} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow">
          <p className="text-xs font-semibold text-slate-500">Regras de preço empresarial</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{rules.length}</p>
          <p className="mt-1 text-xs font-semibold text-blue-700">Gerir preços comerciais →</p>
        </button>
      </section>

      {companyId && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900"><span>A mostrar a operação comercial da empresa #{companyId}.</span><Link href="/admin/b2b" className="font-bold underline">Ver todas as empresas</Link></div>}
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("quotes")} className={`border-b-2 px-4 py-3 text-xs font-black ${tab === "quotes" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}>Cotações B2B ({quotes.filter(q => ["SUBMITTED","UNDER_REVIEW","REVISION_REQUESTED"].includes(q.status)).length})</button>
        <button onClick={() => setTab("pricing")} className={`border-b-2 px-4 py-3 text-xs font-black ${tab === "pricing" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}>Preços empresariais ({rules.length})</button>
      </div>

      {tab === "quotes" ? (
        <section className="space-y-3">
          {quotes.filter(q => ["SUBMITTED","UNDER_REVIEW","REVISION_REQUESTED"].includes(q.status)).length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Não existem cotações pendentes.</div> :
          quotes.filter(q => ["SUBMITTED","UNDER_REVIEW","REVISION_REQUESTED"].includes(q.status)).map((quote) => {
            const edits = proposalEdits[quote.id] ?? {};
            const proposedLines = quote.items.map((item) => {
              const edit = edits[item.productId];
              const quantity = Number(edit?.quantity ?? item.quantity);
              const unitPrice = Number(edit?.unitPrice ?? (Number(item.unitPrice) > 0 ? String(item.unitPrice) : ""));
              return { quantity, unitPrice };
            });
            const currentTerms = proposalTerms[quote.id] ?? { shippingAmount: "0", taxAmount: "0", deliveryDays: "", paymentTerms: "" };
            const shippingAmount = Number(currentTerms.shippingAmount || "0");
            const taxAmount = Number(currentTerms.taxAmount || "0");
            const deliveryDays = currentTerms.deliveryDays.trim() ? Number(currentTerms.deliveryDays) : undefined;
            const termsComplete = currentTerms.paymentTerms.trim().length >= 3 &&
              Number.isFinite(shippingAmount) && shippingAmount >= 0 && shippingAmount <= 99999999.99 &&
              Number.isFinite(taxAmount) && taxAmount >= 0 && taxAmount <= 99999999.99 &&
              Math.abs(shippingAmount * 100 - Math.round(shippingAmount * 100)) <= 0.000001 &&
              Math.abs(taxAmount * 100 - Math.round(taxAmount * 100)) <= 0.000001 &&
              (deliveryDays === undefined || (Number.isInteger(deliveryDays) && deliveryDays >= 1 && deliveryDays <= 365));
            const proposalComplete = proposedLines.every((item) =>
              Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 100000 &&
              Number.isFinite(item.unitPrice) && item.unitPrice > 0 && item.unitPrice <= 99999999.99 &&
              Math.abs(item.unitPrice * 100 - Math.round(item.unitPrice * 100)) <= 0.000001
            ) && termsComplete;
            const proposedTotal = proposedLines.reduce((sum, item) =>
              sum + (Number.isFinite(item.unitPrice) && item.unitPrice > 0 && Number.isInteger(item.quantity) && item.quantity > 0
                ? item.unitPrice * item.quantity
                : 0), 0) + (Number.isFinite(shippingAmount) && shippingAmount > 0 ? shippingAmount : 0) + (Number.isFinite(taxAmount) && taxAmount > 0 ? taxAmount : 0);
            return (
            <article key={quote.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><h2 className="font-black">{quote.quoteNumber}</h2><p className="mt-1 text-sm font-semibold">{quote.company?.tradeName || quote.companyName}</p><p className="text-xs text-slate-500">NIF {quote.companyNif} · {quote.email} · {new Date(quote.createdAt).toLocaleString("pt-PT")}</p></div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700">{quote.status}</span>
              </div>
              <div className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
                {quote.items.map((item) => {
                  const edit = proposalEdits[quote.id]?.[item.productId];
                  const quantity = edit?.quantity ?? String(item.quantity);
                  const unitPrice = edit?.unitPrice ?? (Number(item.unitPrice) > 0 ? String(item.unitPrice) : "");
                  return (
                    <div key={item.productId} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_9rem] sm:items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">Pedido: {item.quantity} un. · {Number(item.unitPrice) > 0 ? formatQuoteAmount(item.subtotal, quote.currency || "AOA") : "Preço por definir"}</p>
                      </div>
                      <label className="text-xs font-semibold text-slate-600">
                        Quantidade proposta
                        <input
                          aria-label={`Quantidade proposta de ${item.name}`}
                          type="number"
                          min={1}
                          max={100000}
                          step={1}
                          value={quantity}
                          onChange={(event) => setProposalEdits((current) => ({
                            ...current,
                            [quote.id]: {
                              ...current[quote.id],
                              [item.productId]: { quantity: event.target.value, unitPrice },
                            },
                          }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-normal"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Preço unitário ({quote.currency || "AOA"})
                        <input
                          aria-label={`Preço unitário de ${item.name}`}
                          type="number"
                          min="0.01"
                          max="99999999.99"
                          step="0.01"
                          inputMode="decimal"
                          value={unitPrice}
                          onChange={(event) => setProposalEdits((current) => ({
                            ...current,
                            [quote.id]: {
                              ...current[quote.id],
                              [item.productId]: { quantity, unitPrice: event.target.value },
                            },
                          }))}
                          placeholder="Definir preço"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-normal"
                        />
                      </label>
                    </div>
                  );
                })}
                <div className="grid gap-3 border-t border-slate-100 py-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Transporte ({quote.currency || "AOA"})
                    <input type="number" min="0" max="99999999.99" step="0.01" value={currentTerms.shippingAmount} onChange={(event) => setProposalTerms((current) => ({ ...current, [quote.id]: { ...currentTerms, shippingAmount: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    IVA/impostos a acrescentar ({quote.currency || "AOA"})
                    <input type="number" min="0" max="99999999.99" step="0.01" value={currentTerms.taxAmount} onChange={(event) => setProposalTerms((current) => ({ ...current, [quote.id]: { ...currentTerms, taxAmount: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Prazo de entrega (dias, opcional)
                    <input type="number" min="1" max="365" step="1" value={currentTerms.deliveryDays} onChange={(event) => setProposalTerms((current) => ({ ...current, [quote.id]: { ...currentTerms, deliveryDays: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-normal" placeholder="A confirmar" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Condições de pagamento (obrigatório)
                    <textarea maxLength={500} rows={2} value={currentTerms.paymentTerms} onChange={(event) => setProposalTerms((current) => ({ ...current, [quote.id]: { ...currentTerms, paymentTerms: event.target.value } }))} className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-normal" placeholder="Ex.: pagamento integral antes do envio" />
                  </label>
                </div>
                <div className="flex justify-between gap-4 py-3 text-sm">
                  <span className="font-bold text-slate-600">Total da proposta · {quote.currency || "AOA"}</span>
                  <strong className="text-right font-black">
                    {proposalComplete
                      ? formatQuoteAmount(proposedTotal, quote.currency || "AOA")
                      : proposedTotal > 0
                        ? `Parcial: ${formatQuoteAmount(proposedTotal, quote.currency || "AOA")}`
                        : "Preencha os preços"}
                  </strong>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button disabled={busy === quote.id} onClick={() => void processQuote(quote.id, "REJECT")} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50"><XCircle size={14}/>Rejeitar pedido</button>
                <button disabled={busy === quote.id} onClick={() => void processQuote(quote.id, "ISSUE_PROPOSAL")} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white hover:bg-blue-800 disabled:opacity-50"><CheckCircle2 size={14}/>{busy === quote.id ? "A processar..." : "Emitir proposta (15 dias)"}</button>
              </div>
            </article>
            );
          })}
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
