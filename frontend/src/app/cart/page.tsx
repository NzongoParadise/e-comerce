"use client";

import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Gift, Heart, ShoppingCart, ArrowLeft, Tag, Trash2, X } from "lucide-react";
import { useMarket } from "@/context/MarketContext";

const FREE_SHIPPING_THRESHOLD_EUR = 200;
const recommendations = [
  { id: 9001, name: "AirPods Pro 2", priceEUR: 349, imageUrl: "/Apple.jpg" },
  { id: 9002, name: "iPad Air M2", priceEUR: 980, imageUrl: "/Samsung.jpg" },
  { id: 9003, name: "Teclado Mecânico RGB", priceEUR: 85, imageUrl: "/ASUS.jpg" },
  { id: 9004, name: "Cadeira Gaming Pro", priceEUR: 320, imageUrl: "/Dell.jpg" },
];

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, addToCart, clearCart, cartTotalEUR } = useCart();
  const { market, formatPrice, eurToKz } = useMarket();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [promo, setPromo] = useState("");
  const [promoMessage, setPromoMessage] = useState("");

  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD_EUR - cartTotalEUR);
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

  function applyPromo() {
    setPromoMessage(promo.trim().toUpperCase() === "TECH10" ? "Código aplicado: 10% de desconto" : "Código promocional inválido");
  }

  function addRecommendation(product: typeof recommendations[number]) {
    addToCart({ id: `recommendation-${product.id}`, productId: product.id, name: product.name, slug: product.name.toLowerCase().replaceAll(" ", "-"), priceEUR: product.priceEUR, priceKZ: eurToKz(product.priceEUR), quantity: 1, imageUrl: product.imageUrl });
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Carrinho de compras</h1>
          <p className="text-sm text-gray-500">Revise os seus produtos e finalize a compra com segurança.</p>
        </div>
        <Link href="/products" className="inline-flex items-center gap-1 text-xs font-bold text-[#1d6ac4] hover:underline"><ArrowLeft size={14} /> Continuar a comprar</Link>
      </div>

      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-center gap-3">
          <Gift size={22} className="text-[#1d6ac4]" aria-hidden="true" />
          <p className="text-sm font-semibold text-gray-800">{amountToFreeShipping > 0 ? `Falta ${formatPrice(amountToFreeShipping)} para obter envio grátis.` : "Já beneficia de envio grátis."}</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-[#1d6ac4] transition-all" style={{ width: `${Math.min(100, (cartTotalEUR / FREE_SHIPPING_THRESHOLD_EUR) * 100)}%` }} /></div>
        <p className="mt-2 text-right text-[11px] font-semibold text-gray-500">Meta: {formatPrice(FREE_SHIPPING_THRESHOLD_EUR)}</p>
      </div>

      {/* Stepper (Visual only for now) */}
      <div className="flex w-full min-w-0 max-w-full items-center gap-4 text-sm font-semibold mb-8 border-b border-gray-200 pb-4 overflow-x-auto">
        <div className="flex items-center gap-2 text-[#1d6ac4]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1d6ac4] text-white">1</span>
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
              <label className="col-span-6 flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[#1d6ac4]" /> Produtos ({items.length})</label>
              <div className="col-span-2 text-center">Preço unitário</div>
              <div className="col-span-2 text-center">Quantidade</div>
              <div className="col-span-2 text-right">Subtotal</div>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 items-center gap-4 p-4">
                  <div className="col-span-12 flex items-center gap-3 sm:col-span-6">
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} className="accent-[#1d6ac4]" aria-label={`Selecionar ${item.name}`} />
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full rounded-lg object-contain" /> : <ShoppingCart size={24} className="text-gray-300" aria-hidden="true" />}
                    </div>
                    <div>
                      <Link href={`/products/${item.slug}`} className="font-bold text-sm text-gray-900 hover:text-[#1d6ac4] transition-colors line-clamp-1">
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
                    <div className="flex items-center border border-gray-300 rounded-lg max-w-[100px]">
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
          <div className="card p-6 bg-white sticky top-32">
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
                <span className="text-[#1d6ac4] text-xs cursor-pointer hover:underline">Calcular no checkout</span>
              </div>
            </div>

            <div className="flex justify-between items-end mb-6">
              <span className="font-bold text-gray-900">Total estimado</span>
              <div className="text-right">
                <div className="text-2xl font-black text-gray-900">{formatPrice(cartTotalEUR)}</div>
                <div className="text-xs font-bold text-[#f59e0b]">
                  {market === "PT"
                    ? `Kz ${eurToKz(cartTotalEUR).toLocaleString("pt-AO")}`
                    : `€ ${cartTotalEUR.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
                  }
                </div>
              </div>
            </div>

            <button onClick={() => router.push('/checkout')} className="btn-primary w-full py-3 mb-6">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Avançar para o checkout →
            </button>

            <div>
              <label className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                <Tag size={14} strokeWidth={2} aria-hidden="true" /> Tem um código de desconto?
              </label>
              <div className="flex min-w-0">
                <input type="text" value={promo} onChange={(event) => setPromo(event.target.value)} placeholder="Inserir código" className="min-w-0 flex-1 border border-gray-300 rounded-l-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1d6ac4]" />
                <button onClick={applyPromo} className="shrink-0 border border-[#1d6ac4] bg-white text-[#1d6ac4] font-semibold text-sm px-3 py-2 rounded-r-lg hover:bg-blue-50 transition-colors sm:px-4">
                  Aplicar
                </button>
              </div>
              {promoMessage && <p className="mt-2 text-xs font-semibold text-gray-500">{promoMessage}</p>}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Também pode gostar</h2>
          <Link href="/products" className="text-xs font-bold text-[#1d6ac4] hover:underline">Ver todos →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {recommendations.map((product) => (
            <div key={product.id} className="card p-3">
              <div className="relative flex h-28 items-center justify-center rounded-lg bg-gray-50">
                <img src={product.imageUrl} alt="" className="h-full w-full rounded-lg object-contain" />
                <button type="button" className="absolute right-2 top-2 text-gray-400 hover:text-red-500" aria-label={`Adicionar ${product.name} aos favoritos`}><Heart size={14} /></button>
              </div>
              <h3 className="mt-3 line-clamp-1 text-xs font-bold text-gray-900">{product.name}</h3>
              <p className="mt-1 text-sm font-black text-gray-900">{formatPrice(product.priceEUR)}</p>
              <p className="mb-2 text-[10px] font-semibold text-green-600">● Em stock</p>
              <button type="button" onClick={() => addRecommendation(product)} className="w-full rounded-lg border border-[#1d6ac4] px-2 py-2 text-[10px] font-bold text-[#1d6ac4] hover:bg-blue-50">Adicionar ao carrinho</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
