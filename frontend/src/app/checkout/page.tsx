"use client";

import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Truck, Zap, Store, CreditCard, Building2, Banknote, LockKeyhole, ChevronLeft, Package } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { useMarket } from "@/context/MarketContext";
import { calculatePortugalShipping, estimateCartWeightKg } from "@/lib/shipping";
import { AddressSelector, type SavedAddress } from "@/components/features/checkout/AddressSelector";

export default function CheckoutPage() {
  const { items, isLoaded, cartTotalEUR, cartTotalKZ, clearCart } = useCart();
  const { market: country } = useMarket();
  const router = useRouter();
  
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express" | "pickup">("standard");
  const [deliveryMode, setDeliveryMode] = useState<"address" | "pickup" | "business">("address");
  const [paymentMethod, setPaymentMethod] = useState("multicaixa_reference");
  const [accountProfile, setAccountProfile] = useState<{ name?: string; email?: string }>({});
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<Array<{ id: number; type: string; label: string; lastFour?: string; phoneNumber?: string; isDefault: boolean; stripeReady?: boolean }>>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addressLoadError, setAddressLoadError] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      window.setTimeout(() => {
        setIsAuthenticated(false);
        setLoadingAddresses(false);
      }, 0);
      return;
    }
    fetchWithAuth("/api/auth/me")
      .then((response) => {
        setIsAuthenticated(true);
        setAccountProfile({ name: response.data.name || "", email: response.data.email || "" });
      })
      .catch(() => {
        setIsAuthenticated(false);
        setAccountProfile({});
        setLoadingAddresses(false);
      });
  }, []);

  useEffect(() => {
    let active = true;
    if (!localStorage.getItem("jwt_token")) return () => { active = false; };
    fetchWithAuth("/api/account/addresses")
      .then((response) => {
        if (!active) return;
        const addresses = Array.isArray(response.data) ? response.data as SavedAddress[] : [];
        setSavedAddresses(addresses);
        const defaultAddress = addresses.find((savedAddress) => savedAddress.isDefault) ?? addresses[0];
        if (defaultAddress) setSelectedAddressId(defaultAddress.id);
      })
      .catch(() => {
        if (active) setAddressLoadError(true);
      })
      .finally(() => {
        if (active) setLoadingAddresses(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!localStorage.getItem("jwt_token")) return () => { active = false; };

    fetchWithAuth("/api/account/payment-methods")
      .then((response) => {
        if (!active) return;
        const methods: Array<{ id: number; type: string; label: string; lastFour?: string; phoneNumber?: string; isDefault: boolean; stripeReady?: boolean }> = Array.isArray(response.data) ? response.data : [];
        setSavedPaymentMethods(methods);

        const availableMethods = methods.filter((method) => method.type !== "CARD" || method.stripeReady);
        const defaultMethod = availableMethods.find((method) => method.isDefault) ?? availableMethods[0];
        if (!defaultMethod) return;

        if (country === "PT" && defaultMethod.type === "MBWAY") {
          setPaymentMethod("mbway");
        }

        if (country === "PT" && defaultMethod.type === "CARD") {
          setPaymentMethod("card");
        }
      })
      .catch(() => {
        if (active) setSavedPaymentMethods([]);
      });

    return () => { active = false; };
  }, [country]);
  
  if (!isLoaded) {
    return <div className="container mx-auto px-4 py-24 text-center text-sm text-gray-500" role="status">A carregar o carrinho...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold mb-4">Carrinho vazio</h1>
        <button onClick={() => router.push("/products")} className="btn-primary">Voltar à loja</button>
      </div>
    );
  }

  const selectedAddress = savedAddresses.find((savedAddress) => savedAddress.id === selectedAddressId);
  const defaultSavedPhone = savedPaymentMethods.find((method) => method.isDefault)?.phoneNumber || savedPaymentMethods[0]?.phoneNumber || "";
  const availableSavedMethods = savedPaymentMethods.filter((method) => method.type !== "CARD" || method.stripeReady);
  const defaultSavedMethod = availableSavedMethods.find((method) => method.isDefault) ?? availableSavedMethods[0];
  const phone = selectedAddress?.phone || defaultSavedPhone || "";
  const billingName = accountProfile.name || selectedAddress?.recipient || "";
  const activeDeliveryMode = country === "PT" && deliveryMode === "pickup" ? "address" : deliveryMode;
  const activeShippingMethod = country === "PT" && deliveryMode === "pickup" ? "standard" : shippingMethod;
  const activePaymentMethod = country === "AO" && paymentMethod === "card"
    ? "multicaixa_reference"
    : country === "PT" && paymentMethod.startsWith("multicaixa")
    ? "transfer"
    : paymentMethod === "multicaixa_express" && !phone ? "multicaixa_reference" : paymentMethod;

  const estimatedCartWeightKg = estimateCartWeightKg(items);
  const shippingCostKZ = country === "AO" && activeShippingMethod === "express" ? 15000 : country === "AO" ? 0 : 0;
  const shippingCostEUR = country === "PT"
    ? calculatePortugalShipping(estimatedCartWeightKg, activeShippingMethod === "express")
    : activeShippingMethod === "express" ? 15 : 0;
  const expressShippingCost = country === "PT"
    ? calculatePortugalShipping(estimatedCartWeightKg, true)
    : 15000;
  const pickupStoreAddress = process.env.NEXT_PUBLIC_STORE_PICKUP_ADDRESS?.trim();
  
  const finalTotalKZ = cartTotalKZ + shippingCostKZ;
  const finalTotalEUR = cartTotalEUR + shippingCostEUR;
  const formatAmount = (amount: number, market: "AO" | "PT" = country) => market === "PT"
    ? `€ ${amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
    : `Kz ${amount.toLocaleString("pt-AO")}`;
  const subtotal = country === "PT" ? cartTotalEUR : cartTotalKZ;
  const shippingCost = country === "PT" ? shippingCostEUR : shippingCostKZ;
  const finalTotal = country === "PT" ? finalTotalEUR : finalTotalKZ;
  const handleCompleteOrder = async () => {
    if (isAuthenticated !== true) {
      setMessage("Para escolher um endereço e finalizar a compra, entre na sua conta ou crie uma conta nova.");
      return;
    }
    if (activeDeliveryMode !== "pickup" && !selectedAddress) {
      setMessage("Selecione um endereço guardado na sua conta para continuar.");
      return;
    }
    if (country === "AO" && activePaymentMethod === "multicaixa_express" && !phone.trim()) {
      setMessage("Indique o telefone associado ao pagamento MULTICAIXA.");
      return;
    }
    if (country === "PT" && activePaymentMethod === "mbway" && !phone.trim()) {
      setMessage("Indique o telefone associado ao pagamento MB WAY.");
      return;
    }
    if (!acceptedTerms) {
      setMessage("Aceite os termos e condições para confirmar a encomenda.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const requestKey = idempotencyKey || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      setIdempotencyKey(requestKey);
      const response = await fetchWithAuth("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey },
        body: JSON.stringify({
          items,
          country,
          currency: country === "PT" ? "EUR" : "AOA",
          deliveryMode: activeDeliveryMode,
          shippingMethod: activeShippingMethod,
          paymentMethod: activePaymentMethod,
          address: activeDeliveryMode === "pickup" ? pickupStoreAddress || undefined : selectedAddress?.address,
          phone: activeDeliveryMode !== "pickup" ? phone : undefined,
          billingName: billingName || undefined,
          billingEmail: accountProfile.email || undefined,
          deliveryRecipient: activeDeliveryMode !== "pickup" ? selectedAddress?.recipient : billingName,
          deliveryCity: activeDeliveryMode !== "pickup" ? selectedAddress?.city : undefined,
          deliveryRegion: activeDeliveryMode !== "pickup" ? selectedAddress?.province : undefined,
          postalCode: activeDeliveryMode !== "pickup" ? selectedAddress?.postalCode : undefined,
          deliveryNotes: activeDeliveryMode !== "pickup" ? selectedAddress?.notes : undefined,
        }),
      });
      if (response.data.checkoutUrl) {
        window.location.assign(response.data.checkoutUrl);
        return;
      }
      if (country === "AO" && (activePaymentMethod === "multicaixa_reference" || activePaymentMethod === "multicaixa_express")) {
        await fetchWithAuth("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: response.data.id, method: activePaymentMethod === "multicaixa_reference" ? "MULTICAIXA_REFERENCE" : "MULTICAIXA_EXPRESS", phoneNumber: phone || undefined, idempotencyKey: requestKey }),
        });
      }
      clearCart();
      router.push(`/confirmation/${response.data.id}`);
    } catch (error) {
      if (activePaymentMethod === "card" && error instanceof Error && ["API error: 409", "API error: 502"].includes(error.message)) {
        setIdempotencyKey("");
      }
      setMessage(error instanceof Error ? error.message : "Não foi possível criar a encomenda.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto animate-fade-in-up px-4 py-8">
      {/* Breadcrumb / Stepper */}
      <nav className="mb-6 flex items-center gap-1 text-xs text-gray-400">
        <Link href="/" className="hover:text-primary">Início</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">Checkout</span>
      </nav>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-1">Finalizar compra</h1>
          <p className="text-sm text-gray-500">Preencha os seus dados para concluir a encomenda de forma segura.</p>
        </div>
        
        {/* Visual Stepper */}
        <div className="flex w-full min-w-0 items-center gap-4 overflow-x-auto text-sm font-semibold md:w-auto">
          <div className="flex items-center gap-2 text-gray-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white">✓</span>
            Carrinho
          </div>
          <div className="h-px w-8 bg-gray-300 hidden sm:block" />
          <div className="flex items-center gap-2 text-primary">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">2</span>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Forms */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Step 1: Delivery Data */}
          <div className="card animate-fade-in-up p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-white">1</span>
              <h2 className="text-lg font-bold text-gray-900">Dados de entrega</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-3">
              <button type="button" aria-pressed={activeDeliveryMode === "address"} onClick={() => { setDeliveryMode("address"); if (activeShippingMethod === "pickup") setShippingMethod("standard"); }} className={`${activeDeliveryMode === "address" ? "border-2 border-primary bg-blue-50 text-primary" : "border border-gray-200 text-gray-600"} flex transform-gpu flex-col items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1d6ac4]`}>
                <Truck size={20} aria-hidden="true" /> Entrega em morada
              </button>
              <button type="button" disabled={country === "PT"} aria-pressed={activeDeliveryMode === "pickup"} onClick={() => { setDeliveryMode("pickup"); setShippingMethod("pickup"); }} className={`${activeDeliveryMode === "pickup" ? "border-2 border-primary bg-blue-50 text-primary" : "border border-gray-200 text-gray-600"} flex transform-gpu flex-col items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1d6ac4] disabled:cursor-not-allowed disabled:opacity-45`}>
                <Store size={20} aria-hidden="true" /> Levantar na loja
                {country === "PT" && <span className="text-xs font-normal">Apenas em Angola</span>}
              </button>
              <button type="button" aria-pressed={activeDeliveryMode === "business"} onClick={() => { setDeliveryMode("business"); if (activeShippingMethod === "pickup") setShippingMethod("standard"); }} className={`${activeDeliveryMode === "business" ? "border-2 border-primary bg-blue-50 text-primary" : "border border-gray-200 text-gray-600"} flex transform-gpu flex-col items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1d6ac4]`}>
                <Building2 size={20} aria-hidden="true" /> Entrega empresarial
              </button>
            </div>

            {activeDeliveryMode === "pickup" ? (
              <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-bold text-emerald-900">Morada para levantamento</p>
                <p className="mt-1 text-sm text-emerald-900">{pickupStoreAddress || "Morada de levantamento por configurar."}</p>
              </div>
            ) : (
              <AddressSelector
                loadingAddresses={loadingAddresses}
                isAuthenticated={isAuthenticated}
                addressLoadError={addressLoadError}
                savedAddresses={savedAddresses}
                selectedAddressId={selectedAddressId}
                onSelectAddress={setSelectedAddressId}
              />
            )}
            
          </div>

          {/* Step 2: Delivery Method */}
          {activeDeliveryMode !== "pickup" && <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold">2</span>
              <h2 className="text-lg font-bold text-gray-900">Método de entrega</h2>
            </div>
            
            <div className="space-y-3">
              <p className="mb-2 text-xs text-gray-500">Custo calculado conforme o peso total da encomenda e o tipo de entrega em Portugal.</p>
              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${activeShippingMethod === 'standard' ? 'border-primary bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="shipping" checked={activeShippingMethod === 'standard'} onChange={() => setShippingMethod('standard')} className="accent-primary w-4 h-4 mt-1 self-start" />
                <div className="ml-3 flex-1 flex flex-col sm:flex-row sm:items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900 text-sm flex items-center gap-2"><Truck size={16} strokeWidth={2} aria-hidden="true" /> Entrega padrão</div>
                    <div className="text-xs text-gray-500 mt-0.5">Entrega em 1-3 dias úteis</div>
                  </div>
                  <div className="text-right mt-2 sm:mt-0">
                    <div className="font-bold text-green-600 text-sm">
                      {country === "PT" ? formatAmount(calculatePortugalShipping(estimatedCartWeightKg, false)) : "Grátis"}
                    </div>
                  </div>
                </div>
              </label>

              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${activeShippingMethod === 'express' ? 'border-primary bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="shipping" checked={activeShippingMethod === 'express'} onChange={() => setShippingMethod('express')} className="accent-primary w-4 h-4 mt-1 self-start" />
                <div className="ml-3 flex-1 flex flex-col sm:flex-row sm:items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900 text-sm flex items-center gap-2"><Zap size={16} strokeWidth={2} aria-hidden="true" /> Entrega expressa</div>
                    <div className="text-xs text-gray-500 mt-0.5">Entrega em 24-48 horas</div>
                  </div>
                  <div className="text-right mt-2 sm:mt-0 font-bold text-gray-900 text-sm">
                    {formatAmount(expressShippingCost)}
                  </div>
                </div>
              </label>
            </div>
          </div>}

          {/* Step 3: Payment */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold">3</span>
              <h2 className="text-lg font-bold text-gray-900">Método de pagamento</h2>
            </div>
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
              {defaultSavedMethod ? (
                <span>
                  Pagamento rápido ativo: <strong>{defaultSavedMethod.type === "CARD" ? "Cartão guardado" : defaultSavedMethod.type === "MBWAY" ? "MB WAY guardado" : "Método guardado"}</strong>.
                </span>
              ) : (
                <span>Escolha uma opção abaixo para concluir o pagamento de forma segura.</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["multicaixa_reference", "Referência MULTICAIXA", "Pague numa caixa automática ou no homebanking", CreditCard],
                ["multicaixa_express", "MULTICAIXA Express", "Autorize o pagamento na aplicação MCX Express", CreditCard],
                ["transfer", "Transferência bancária", "Confirmação em até 24h", Building2],
                ["card", "Cartão de crédito / débito", "Visa e Mastercard", CreditCard],
                ["mbway", "MB WAY", "Pague usando o seu telemóvel", CreditCard],
                ["cash", "Pagamento na entrega", "Disponível em Luanda", Banknote],
              ].filter(([value]) => {
                if (country === "AO") {
                  return !["card", "mbway", "cash"].includes(value as string) && !(value === "multicaixa_express" && !phone);
                }
                if (country === "PT") {
                  return !["multicaixa_reference", "multicaixa_express", "cash"].includes(value as string);
                }
                return true;
              }).map(([value, title, description, Icon]) => {
                const PaymentIcon = Icon as typeof CreditCard;
                const showSavedBadge =
                  (value === "card" && defaultSavedMethod?.type === "CARD") ||
                  (value === "mbway" && defaultSavedMethod?.type === "MBWAY");
                const paymentTitle = value === "card" && defaultSavedMethod?.type === "CARD" && defaultSavedMethod.lastFour
                  ? `${defaultSavedMethod.label} •••• ${defaultSavedMethod.lastFour}`
                  : title as string;

                return (
                  <button
                    type="button"
                    key={value as string}
                    aria-pressed={activePaymentMethod === value}
                    onClick={() => setPaymentMethod(value as string)}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${activePaymentMethod === value ? "border-primary bg-blue-50 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100">
                      <PaymentIcon size={22} className={activePaymentMethod === value ? "text-primary" : "text-gray-500"} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="block text-sm font-bold text-gray-900">{paymentTitle}</span>
                        {showSavedBadge && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                            Guardado
                          </span>
                        )}
                      </div>
                      <span className="mt-1 block text-xs text-gray-500">{description as string}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div id="review" className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold">4</span>
              <h2 className="text-lg font-bold text-gray-900">Rever e confirmar</h2>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 accent-primary" />
              <span>Li e aceito os termos e condições e a política de privacidade.</span>
            </label>
            {message && <p role="alert" aria-live="assertive" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button onClick={handleCompleteOrder} disabled={submitting} className="btn-primary flex-1 bg-green-600 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"><LockKeyhole size={16} /> {submitting ? "A confirmar..." : "Confirmar encomenda"}</button>
              <Link href="/cart" className="inline-flex items-center justify-center gap-1 text-sm font-bold text-primary hover:underline"><ChevronLeft size={15} /> Voltar ao carrinho</Link>
            </div>
            <p className="mt-3 flex items-center gap-1 text-xs text-green-700"><ShieldCheck size={14} /> A sua compra é segura e encriptada.</p>
          </div>

        </div>

        {/* Right: Summary Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-32">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Resumo da encomenda</h2>
              <Link href="/cart" className="text-xs font-semibold text-primary hover:underline">Editar carrinho</Link>
            </div>

            {/* Items list snippet */}
            <div className="space-y-4 mb-6 border-b border-gray-100 pb-6 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
              {items.map(item => (
                <div key={item.id} className="flex gap-3">
                  <div className="h-12 w-12 bg-gray-50 rounded flex items-center justify-center border border-gray-100 shrink-0 text-gray-500"><Package size={20} aria-hidden="true" /></div>
                  <div className="flex-1">
                    <div className="font-bold text-xs text-gray-900 line-clamp-1">{item.name}</div>
                    <div className="text-[10px] text-gray-500 mb-1">{[item.variant?.storage, item.variant?.color].filter(Boolean).join(" | ")} · Qtd: {item.quantity}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xs text-gray-900">{formatAmount((country === "PT" ? item.priceEUR : item.priceKZ) * item.quantity)}</div>
                    <div className="text-[10px] text-gray-400">{formatAmount((country === "PT" ? item.priceKZ : item.priceEUR) * item.quantity, country === "PT" ? "AO" : "PT")}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 text-sm mb-6 border-b border-gray-100 pb-6">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal ({items.reduce((s,i)=>s+i.quantity,0)} itens)</span>
                <span className="font-semibold text-gray-900">{formatAmount(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Entrega</span>
                <span className={shippingCostKZ === 0 ? "font-bold text-green-600" : "font-semibold text-gray-900"}>
                  {shippingCost === 0 ? "Grátis" : formatAmount(shippingCost)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-end mb-6 bg-gray-50 p-4 rounded-lg">
              <span className="font-bold text-gray-900">Total a pagar</span>
              <div className="text-right">
                <div className="text-xl font-black text-gray-900 mb-0.5">{formatAmount(finalTotal)}</div>
                <div className="text-xs font-bold text-gray-500">{formatAmount(country === "PT" ? finalTotalKZ : finalTotalEUR, country === "PT" ? "AO" : "PT")}</div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-6 flex items-start gap-3">
              <ShieldCheck className="text-green-600 mt-0.5 shrink-0" size={20} strokeWidth={2} aria-hidden="true" />
              <div>
                <div className="text-xs font-bold text-green-800">Compra 100% segura</div>
                <div className="text-[10px] text-green-700">Os seus dados estão protegidos com encriptação SSL.</div>
              </div>
            </div>

            <Link href="#review" className="btn-primary w-full py-3 mb-4">Rever dados e confirmar <ChevronLeft size={16} className="rotate-180" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}

