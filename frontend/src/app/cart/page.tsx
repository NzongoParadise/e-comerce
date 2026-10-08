"use client";

import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, ShoppingCart, ArrowLeft, Trash2, X, ShieldCheck, Truck } from "lucide-react";
import { useMarket } from "@/context/MarketContext";
import { calculatePortugalShipping, estimateCartWeightKg } from "@/lib/shipping";
import { RecommendationRail } from "@/components/features/catalog/RecommendationRail";


export default function CartPage() {
  const { items, updateQuantity, removeFromCart, clearCart, cartTotalEUR } = useCart();
  const { market, formatPrice, eurToKz } = useMarket();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const estimatedWeightKg = estimateCartWeightKg(items);
  const standardShippingEUR = market === "PT" ? calculatePortugalShipping(estimatedWeightKg, false) : 0;
  const expressShippingEUR = market === "PT" ? calculatePortugalShipping(estimatedWeightKg, true) : 0;
  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : items.map((item) => item.id));
  }

  function removeSelected() {
    selectedIds.forEach((id) => removeFromCart(id));
    setSelectedIds([]);
  }



  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <ShoppingCart size={56} className="mx-auto mb-6 text-gray-300" strokeWidth={1.5} aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">O seu carrinho está vazio</h1>
        <p className="text-gray-500 mb-8">Navegue pelas nossas categorias e descubra os melhores produtos.</p>
        <Link href="/products" className="btn-primary">
          Começar a comprar
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto animate-fade-in-up px-4 py-8">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Carrinho de compras</h1>
          <p className="text-sm text-gray-500">Revise os seus produtos e finalize a compra com segurança.</p>
        </div>
        <Link href="/products" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><ArrowLeft size={14} /> Continuar a comprar</Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
          <div className="flex items-start gap-3">
            <Truck size={19} className="mt-0.5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-xs font-black text-emerald-900">{market === "AO" ? "Entrega padrão em Angola" : "Entrega em Portugal"}</p>
              <p className="mt-1 text-[11px] leading-5 text-emerald-800">{market === "AO" ? "O método padrão é gratuito. A entrega expressa é calculada no checkout." : "O custo é calculado automaticamente pelo peso e pelo método escolhido."}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#1d6ac4]" />
            <div>
              <p className="text-xs font-black text-blue-950">Preço e promoções</p>
              <p className="mt-1 text-[11px] leading-5 text-blue-800">As condições elegíveis são recalculadas no checkout antes da confirmação.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper (Visual only for now) */}
      <div className="flex w-full min-w-0 max-w-full items-center gap-4 text-sm font-semibold mb-8 border-b border-gray-200 pb-4 overflow-x-auto">
        <div className="flex items-center gap-2 text-primary">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">1</span>
          Carrinho
        </div>
        <div className="h-px w-8 bg-gray-300 hidden sm:block" />
        <div className="flex items-center gap-2 text-gray-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200">2</span>
          Entrega
        </div>
        <div className="h-px w-8 bg-gray-300 hidden sm:block" />
        <div className="flex items-center gap-2 text-gray-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200">3</span>
          Pagamento
        </div>
        <div className="h-px w-8 bg-gray-300 hidden sm:block" />
        <div className="flex items-center gap-2 text-gray-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200">4</span>
          Confirmação
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Cart Items */}
        <div className="lg:col-span-8">
          <div className="card p-0 overflow-hidden">
            <div className="hidden bg-gray-50 p-4 border-b border-gray-200 grid-cols-12 text-xs font-bold text-gray-500 uppercase tracking-wide sm:grid">
              <label className="col-span-6 flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-primary" /> Produtos ({items.length})</label>
              <div className="col-span-2 text-center">Preço unitário</div>
              <div className="col-span-2 text-center">Quantidade</div>
              <div className="col-span-2 text-right">Subtotal</div>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 items-center gap-4 p-4 transition-all duration-200 hover:bg-slate-50/80">
                  <div className="col-span-12 flex items-center gap-3 sm:col-span-6">
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} className="accent-primary" aria-label={`Selecionar ${item.name}`} />
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full rounded-lg object-contain" /> : <ShoppingCart size={24} className="text-gray-300" aria-hidden="true" />}
                    </div>
                    <div>
                      <Link href={`/products/${item.slug}`} className="font-bold text-sm text-gray-900 hover:text-primary transition-colors line-clamp-1">
                        {item.name}
                      </Link>
                      {item.variant && (
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {item.variant.storage && `${item.variant.storage} | `}
                          {item.variant.ram && `${item.variant.ram} | `}
                          {item.variant.color}
                        </div>
                      )}
                      <div className="text-[10px] font-bold text-green-600 mt-1">● Em stock</div>
                    </div>
                  </div>
                  
                  <div className="col-span-6 text-left sm:col-span-2 sm:text-center">
                    <div className="text-sm font-bold text-gray-900">{formatPrice(item.priceEUR)}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {market === "PT"
                        ? `Kz ${eurToKz(item.priceEUR).toLocaleString("pt-AO")}`
                        : `€ ${item.priceEUR.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
                      }
                    </div>
                  </div>
                  
                  <div className="col-span-6 flex justify-end sm:col-span-2 sm:justify-center">
                    <div className="flex items-center border border-gray-300 rounded-lg max-w-25">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 text-gray-500 hover:bg-gray-50 rounded-l-lg">−</button>
                      <span className="px-2 py-1 text-xs font-bold border-x border-gray-300 text-center w-8">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 text-gray-500 hover:bg-gray-50 rounded-r-lg">+</button>
                    </div>
                  </div>
                  
                  <div className="col-span-12 flex flex-row items-center justify-between border-t border-gray-100 pt-3 sm:col-span-2 sm:flex-col sm:items-end sm:justify-center sm:border-0 sm:pt-0">
                    <div className="text-sm font-bold text-gray-900">{formatPrice(item.priceEUR * item.quantity)}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 mb-2">
                      {market === "PT"
                        ? `Kz ${eurToKz(item.priceEUR * item.quantity).toLocaleString("pt-AO")}`
                        : `€ ${(item.priceEUR * item.quantity).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
                      }
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors" aria-label={`Remover ${item.name}`}>
                      <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-gray-50 p-4 border-t border-gray-200 flex flex-wrap justify-between gap-3 items-center">
              <div className="flex flex-wrap gap-2">
                <button onClick={removeSelected} disabled={!selectedIds.length} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-600 hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={13} /> Remover selecionados</button>
                <button onClick={() => setSelectedIds([])} disabled={!selectedIds.length} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"><Heart size={13} /> Adicionar aos favoritos</button>
              </div>
              <button onClick={() => { clearCart(); setSelectedIds([]); }} className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-red-600"><X size={14} /> Limpar carrinho</button>
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div className="lg:col-span-4">
          <div className="card sticky top-32 bg-white p-6 shadow-[0_22px_50px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-0.5">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Resumo da encomenda</h2>
            
            <div className="space-y-3 text-sm mb-6 border-b border-gray-100 pb-6">
                <div className="flex justify-between">
                <span className="text-gray-500">Subtotal ({items.reduce((s,i)=>s+i.quantity,0)} itens)</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatPrice(cartTotalEUR)}</div>
                  <div className="text-[10px] text-gray-400">
                    {market === "PT"
                      ? `Kz ${eurToKz(cartTotalEUR).toLocaleString("pt-AO")}`
                      : `€ ${cartTotalEUR.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
                    }
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Desconto</span>
                <span className="font-semibold text-gray-900">- € 0,00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Entrega</span>
                <span className="text-primary text-xs font-semibold">
                  {market === "PT"
                    ? `${formatPrice(standardShippingEUR)} (padrão)`
                    : "Calcular no checkout"}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-end mb-6">
              <span className="font-bold text-gray-900">Total estimado</span>
              <div className="text-right">
                <div className="text-2xl font-black text-gray-900">{formatPrice(cartTotalEUR + (market === "PT" ? standardShippingEUR : 0))}</div>
                <div className="text-xs font-bold text-warning">
                  {market === "PT"
                    ? `Kz ${eurToKz(cartTotalEUR + standardShippingEUR).toLocaleString("pt-AO")}`
                    : `€ ${cartTotalEUR.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
                  }
                </div>
              </div>
            </div>

            <button onClick={() => router.push('/checkout')} className="btn-primary w-full py-3 mb-6">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Avançar para o checkout →
            </button>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Promoções</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">As campanhas e condições elegíveis são aplicadas e validadas no processo de checkout.</p>
            </div>
            </div>
          </div>
        </div>
      </div>

      <RecommendationRail
        title="Pode complementar a sua compra"
        description="Sugestões reais do catálogo disponíveis neste momento."
        limit={4}
      />
    </div>
  );
}

