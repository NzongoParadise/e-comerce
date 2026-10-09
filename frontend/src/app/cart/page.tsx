"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Heart, ShieldCheck, ShoppingCart, Trash2, Truck, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";
import { calculatePortugalShipping, estimateCartWeightKg } from "@/lib/shipping";
import { RecommendationRail } from "@/components/features/catalog/RecommendationRail";

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, clearCart, cartTotalEUR } = useCart();
  const { market, formatPrice, eurToKz } = useMarket();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");

  const estimatedWeightKg = estimateCartWeightKg(items);
  const standardShippingEUR = market === "PT" ? calculatePortugalShipping(estimatedWeightKg, false) : 0;
  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));
  const selectedCount = selectedIds.length;

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : items.map((item) => item.id));
  }

  function removeSelected() {
    selectedIds.forEach((id) => removeFromCart(id));
    setSelectedIds([]);
    setFeedback(selectedCount + (selectedCount === 1 ? " item removido." : " itens removidos."));
  }

  function saveSelectedToFavorites() {
    const selected = items.filter((item) => selectedIds.includes(item.id));
    let added = 0;
    selected.forEach((item) => {
      if (!isFavorite(item.productId)) {
        toggleFavorite({
          id: item.productId,
          name: item.name,
          slug: item.slug,
          category: "",
          specs: [item.variant?.storage, item.variant?.ram, item.variant?.color].filter(Boolean).join(" · "),
          priceEUR: item.priceEUR,
          imageUrl: item.imageUrl,
        });
        added += 1;
      }
    });
    setSelectedIds([]);
    setFeedback(added ? added + (added === 1 ? " produto adicionado aos favoritos." : " produtos adicionados aos favoritos.") : "Os produtos selecionados já estavam nos favoritos.");
  }

  if (items.length === 0) {
    return (
      <main className="container mx-auto px-4 py-20 sm:py-28">
        <section className="mx-auto max-w-lg text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><ShoppingCart size={30}/></span>
          <p className="section-kicker mt-6">Carrinho</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">O seu carrinho está vazio</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Explore o catálogo e encontre produtos para a sua próxima compra.</p>
          <Link href="/products" className="btn-primary mt-6">Começar a comprar <ArrowLeft size={15} className="rotate-180"/></Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      <div className="border-b border-slate-200 bg-white">
        <div className="container mx-auto flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
          <Link href="/" className="hover:text-[#1d6ac4]">Início</Link><span>›</span><span className="font-bold text-slate-800">Carrinho</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Compra segura</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Carrinho de compras</h1>
            <p className="mt-1 text-sm text-slate-500">{totalItems} {totalItems === 1 ? "produto" : "produtos"} selecionados para revisão.</p>
          </div>
          <Link href="/products" className="inline-flex items-center gap-1 text-xs font-black text-[#1d6ac4] hover:underline"><ArrowLeft size={14}/> Continuar a comprar</Link>
        </header>

        <nav aria-label="Progresso da compra" className="mb-6 flex items-center gap-3 overflow-x-auto border-b border-slate-200 pb-4">
          <Step active number="1" label="Carrinho"/><span className="h-px w-8 shrink-0 bg-slate-200"/><Step number="2" label="Entrega"/><span className="h-px w-8 shrink-0 bg-slate-200"/><Step number="3" label="Pagamento"/><span className="h-px w-8 shrink-0 bg-slate-200"/><Step number="4" label="Confirmação"/>
        </nav>

        {feedback && <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800"><Check size={14}/>{feedback}</div>}

        <section className="mb-5 grid gap-3 sm:grid-cols-2">
          <InfoStrip icon={Truck} title={market === "AO" ? "Entrega padrão em Angola" : "Entrega em Portugal"} detail={market === "AO" ? "Entrega padrão gratuita. O método express pode ter custo adicional." : "O valor padrão é calculado automaticamente pelo peso."} tone="green"/>
          <InfoStrip icon={ShieldCheck} title="Preço validado no checkout" detail="Promoções e custos finais são recalculados antes da confirmação." tone="blue"/>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="card overflow-hidden">
            <div className="hidden border-b border-slate-100 bg-slate-50 px-4 py-3 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500 sm:grid sm:grid-cols-[minmax(0,1fr)_110px_130px_110px] sm:items-center sm:gap-4">
              <label className="flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[#1d6ac4]"/> Produtos ({items.length})</label>
              <span className="text-center">Preço</span><span className="text-center">Quantidade</span><span className="text-right">Subtotal</span>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <article key={item.id} className="grid gap-4 p-4 transition hover:bg-slate-50/60 sm:grid-cols-[minmax(0,1fr)_110px_130px_110px] sm:items-center sm:gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} className="mt-2 accent-[#1d6ac4]" aria-label={"Selecionar " + item.name}/>
                    <Link href={"/products/" + item.slug} className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-contain" /> : <ShoppingCart size={22} className="text-slate-300"/>}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={"/products/" + item.slug} className="line-clamp-2 text-xs font-black leading-5 text-slate-950 hover:text-[#1d6ac4]">{item.name}</Link>
                      {item.variant && <p className="mt-1 text-[10px] text-slate-500">{[item.variant.storage, item.variant.ram, item.variant.color].filter(Boolean).join(" · ")}</p>}
                      <p className="mt-1 text-[10px] font-bold text-emerald-600">Em stock</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:block sm:text-center">
                    <span className="text-[10px] font-semibold text-slate-400 sm:hidden">Preço unitário</span>
                    <div><p className="text-xs font-black text-slate-900">{formatPrice(item.priceEUR)}</p><p className="mt-0.5 text-[9px] text-slate-400">{market === "PT" ? "Kz " + eurToKz(item.priceEUR).toLocaleString("pt-AO") : "€ " + item.priceEUR.toFixed(2)}</p></div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-center">
                    <span className="text-[10px] font-semibold text-slate-400 sm:hidden">Quantidade</span>
                    <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-8 w-8 text-slate-500 hover:bg-slate-50" aria-label="Diminuir quantidade">−</button>
                      <span className="grid h-8 w-9 place-items-center border-x border-slate-200 text-xs font-black text-slate-900">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-8 w-8 text-slate-500 hover:bg-slate-50" aria-label="Aumentar quantidade">+</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:block sm:text-right">
                    <span className="text-[10px] font-semibold text-slate-400 sm:hidden">Subtotal</span>
                    <div><p className="text-xs font-black text-slate-950">{formatPrice(item.priceEUR * item.quantity)}</p><p className="mt-0.5 text-[9px] text-slate-400">{market === "PT" ? "Kz " + eurToKz(item.priceEUR * item.quantity).toLocaleString("pt-AO") : "€ " + (item.priceEUR * item.quantity).toFixed(2)}</p></div>
                    <button type="button" onClick={() => removeFromCart(item.id)} className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-rose-600"><Trash2 size={13}/> Remover</button>
                  </div>
                </article>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={removeSelected} disabled={!selectedIds.length} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={13}/> Remover selecionados</button>
                <button type="button" onClick={saveSelectedToFavorites} disabled={!selectedIds.length} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 hover:border-blue-200 hover:text-[#1d6ac4] disabled:cursor-not-allowed disabled:opacity-40"><Heart size={13}/> Guardar nos favoritos</button>
              </div>
              <button type="button" onClick={() => { clearCart(); setSelectedIds([]); setFeedback("Carrinho limpo."); }} className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-rose-600"><X size={14}/> Limpar carrinho</button>
            </div>
          </section>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <section className="card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><p className="section-kicker">Resumo</p><h2 className="mt-1 text-base font-black text-slate-950">Resumo da encomenda</h2></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-600">{totalItems} itens</span></div>

              <div className="mt-5 space-y-3 border-b border-slate-100 pb-5 text-xs">
                <SummaryRow label="Subtotal" value={formatPrice(cartTotalEUR)} />
                <SummaryRow label="Desconto" value={formatPrice(0)} valueClass="text-emerald-700"/>
                <SummaryRow label="Entrega padrão" value={market === "PT" ? formatPrice(standardShippingEUR) : "Grátis"} valueClass={market === "AO" ? "text-emerald-700" : ""}/>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="flex items-end justify-between gap-3"><span className="text-xs font-black text-slate-800">Total estimado</span><span className="text-xl font-black tracking-tight text-slate-950">{formatPrice(cartTotalEUR + (market === "PT" ? standardShippingEUR : 0))}</span></div>
                <p className="mt-1 text-right text-[9px] text-slate-400">O total final é confirmado no checkout.</p>
              </div>

              <button type="button" onClick={() => router.push("/checkout")} className="btn-primary mt-5 w-full py-3.5">Avançar para checkout <ArrowLeft size={15} className="rotate-180"/></button>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-[10px] leading-4 text-emerald-800"><ShieldCheck size={14} className="mt-0.5 shrink-0"/> Pagamento protegido e validação de condições antes da confirmação.</div>
            </section>
          </aside>
        </div>

        <RecommendationRail title="Pode complementar a sua compra" description="Sugestões reais do catálogo disponíveis neste momento." limit={4}/>
      </div>
    </main>
  );
}

function Step({ active = false, number, label }: { active?: boolean; number: string; label: string }) {
  return <span className={"flex shrink-0 items-center gap-2 text-[10px] font-black " + (active ? "text-[#1d6ac4]" : "text-slate-400")}><span className={"grid h-6 w-6 place-items-center rounded-full text-[9px] " + (active ? "bg-[#1d6ac4] text-white" : "bg-slate-100 text-slate-500")}>{number}</span>{label}</span>;
}

function InfoStrip({ icon: Icon, title, detail, tone }: { icon: typeof Truck; title: string; detail: string; tone: "green" | "blue" }) {
  return <div className={"rounded-xl border p-4 " + (tone === "green" ? "border-emerald-100 bg-emerald-50/60" : "border-blue-100 bg-blue-50/60")}><div className="flex gap-3"><Icon size={18} className={"mt-0.5 shrink-0 " + (tone === "green" ? "text-emerald-700" : "text-[#1d6ac4]")}/><div><p className="text-xs font-black text-slate-900">{title}</p><p className="mt-1 text-[10px] leading-4 text-slate-600">{detail}</p></div></div></div>;
}

function SummaryRow({ label, value, valueClass = "text-slate-900" }: { label: string; value: string; valueClass?: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><span className={"font-bold " + valueClass}>{value}</span></div>;
}
