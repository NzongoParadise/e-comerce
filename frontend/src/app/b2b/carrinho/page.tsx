"use client";

import Link from "next/link";
import { ArrowRight, FileText, Minus, Plus, ShoppingBag, Trash2, ShieldCheck, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { getB2BUnitPrice, useB2BCart } from "@/context/B2BCartContext";
import { useMarket } from "@/context/MarketContext";

function money(value: number, market: "AO" | "PT") {
  return market === "PT"
    ? "€ " + value.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "Kz " + value.toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

export default function B2BCartPage() {
  const { market } = useMarket();
  const { items, isLoaded, removeFromCart, updateQuantity, clearCart, cartCount } = useB2BCart();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const totals = useMemo(() => {
    const productTotal = items.reduce((sum, item) => sum + getB2BUnitPrice(item, item.quantity, market) * item.quantity, 0);
    return { productTotal };
  }, [items, market]);

  async function requestQuote() {
    if (!items.length || submitting) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const result = await fetchWithAuth("/api/b2b/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          notes: notes.trim() || undefined,
        }),
      });
      if (!result?.data) throw new Error(result?.error || "Não foi possível enviar o pedido de cotação.");
      clearCart();
      setNotes("");
      setNotice("Pedido de cotação enviado. A equipa comercial irá analisar as condições e criar o Purchase Order após aprovação.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível enviar o pedido de cotação.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoaded) {
    return <div className="space-y-4"><div className="h-24 animate-pulse rounded-xl bg-slate-200"/><div className="h-72 animate-pulse rounded-xl bg-slate-200"/></div>;
  }

  if (!items.length && !notice) {
    return (
      <div className="space-y-6 pb-10">
        <header>
          <p className="section-kicker">B2B · Compras</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Carrinho empresarial</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Reúna os artigos que pretende comprar e envie um único pedido de cotação à equipa comercial.</p>
        </header>
        <section className="card p-10 text-center sm:p-14">
          <ShoppingBag size={38} className="mx-auto text-slate-300"/>
          <h2 className="mt-4 text-lg font-black text-slate-900">O seu carrinho empresarial está vazio</h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">Explore o catálogo, escolha quantidades e mantenha o processo empresarial separado da loja B2C.</p>
          <Link href="/b2b/catalogo" className="btn-primary mt-5"><ShoppingBag size={14}/> Explorar catálogo</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">B2B · Compras</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Carrinho empresarial</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Prepare a compra por volume. O preço final é recalculado no servidor no momento da cotação.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/b2b/catalogo" className="btn-secondary">Continuar a comprar</Link>
          <button type="button" onClick={clearCart} className="btn-secondary text-rose-700 hover:border-rose-200 hover:bg-rose-50">Esvaziar carrinho</button>
        </div>
      </header>

      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><ShieldCheck size={17} className="mt-0.5 shrink-0"/><span>{notice} <Link href="/b2b/cotacoes" className="underline">Ver cotações</Link></span></div>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      {items.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
              <div><p className="text-sm font-black text-slate-950">Artigos selecionados</p><p className="text-[10px] text-slate-500">{cartCount} unidade(s)</p></div>
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[9px] font-black text-blue-700">Mercado {market}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const unitPrice = getB2BUnitPrice(item, item.quantity, market);
                return (
                  <article key={item.id} className="p-4 sm:p-5">
                    <div className="flex gap-4">
                      <Link href="/b2b/catalogo" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-2 sm:h-24 sm:w-24">
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain"/> : <ShoppingBag size={25} className="text-slate-300"/>}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href="/b2b/catalogo" className="line-clamp-2 text-sm font-black text-slate-900 hover:text-blue-700">{item.name}</Link>
                        <p className="mt-1 text-[10px] text-slate-400">Stock atual: {item.stock}</p>
                        {item.b2bPriceRules.length > 0 && <p className="mt-1 text-[10px] font-bold text-blue-700">{item.b2bPriceRules.length} nível(is) de preço por volume</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                            <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="flex h-9 w-9 items-center justify-center text-slate-500 hover:bg-slate-50" aria-label={"Diminuir quantidade de " + item.name}><Minus size={14}/></button>
                            <span className="min-w-10 px-2 text-center text-xs font-black text-slate-900">{item.quantity}</span>
                            <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock} className="flex h-9 w-9 items-center justify-center text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35" aria-label={"Aumentar quantidade de " + item.name}><Plus size={14}/></button>
                          </div>
                          <button type="button" onClick={() => removeFromCart(item.id)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50"><Trash2 size={13}/> Remover</button>
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-xs font-black text-slate-900">{money(unitPrice, market)}</p>
                        <p className="mt-1 text-[9px] text-slate-400">por unidade</p>
                        <p className="mt-2 text-sm font-black text-slate-950">{money(unitPrice * item.quantity, market)}</p>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-3 text-right sm:hidden">
                      <span className="text-[10px] text-slate-400">Subtotal </span><strong className="text-sm text-slate-950">{money(unitPrice * item.quantity, market)}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="card p-5">
              <div className="flex items-center gap-2"><FileText size={17} className="text-blue-700"/><h2 className="text-sm font-black text-slate-950">Pedido de cotação</h2></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">A equipa comercial confirma preços, disponibilidade e condições antes da aprovação.</p>
              <label className="mt-4 block text-[10px] font-black uppercase tracking-wide text-slate-500">Notas comerciais
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} className="settings-input mt-2 min-h-28 normal-case" placeholder="Prazo, compra recorrente, entrega, referências..." />
              </label>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Total estimado</span><strong className="text-lg font-black text-slate-950">{money(totals.productTotal, market)}</strong></div>
                <p className="mt-2 text-[9px] leading-4 text-slate-400">Estimativa baseada nas regras de preço disponíveis para a sua empresa. O servidor volta a validar preço e stock.</p>
                <button type="button" onClick={() => void requestQuote()} disabled={submitting} className="btn-primary mt-4 w-full disabled:opacity-50">{submitting ? "A enviar..." : "Enviar pedido de cotação"} <ArrowRight size={14}/></button>
              </div>
            </section>

            <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-start gap-3"><Truck size={17} className="mt-0.5 text-blue-700"/><div><p className="text-xs font-black text-slate-900">Processo empresarial</p><p className="mt-1 text-[10px] leading-5 text-slate-600">Cotação → aprovação → Purchase Order → encomenda → pagamento.</p></div></div>
            </section>
          </aside>
        </div>
      )}

    </div>
  );
}
