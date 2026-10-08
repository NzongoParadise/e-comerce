"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useMarket } from "@/context/MarketContext";
import { useFavorites } from "@/context/FavoritesContext";
import { getPromotionalUnitPrice } from "@/lib/promotions/pricing";
import { usePublicPromotions } from "@/lib/promotions/usePublicPromotions";
import Link from "next/link";
import { RecommendationRail } from "@/components/features/catalog/RecommendationRail";
import { ShoppingCart, Heart, Package, Truck, ShieldCheck, Zap, CreditCard, Maximize2, MapPin } from "lucide-react";

type ProductDetails = {
  id: number;
  name: string;
  slug: string;
  description: string;
  basePrice: string;
  imageUrl: string;
  stock: number;
  category: { id: number; name: string; slug: string };
  brand: { id: number; name: string; slug: string };
  prices: { market: string; currency: string; amount: string }[];
};

export default function ProductDetailsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { addToCart } = useCart();
  const { market } = useMarket();
  const { isFavorite, toggleFavorite } = useFavorites();
  const promotions = usePublicPromotions();
  
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  // The API currently does not expose product variants; do not invent selectable options in the storefront.
  const [purchaseMode, setPurchaseMode] = useState<"retail" | "wholesale">("retail");
  const [activeTab, setActiveTab] = useState("description");

  useEffect(() => {
    fetchWithAuth(`/api/products/${slug}`)
      .then((res) => setProduct(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!product) return;
    try {
      const key = "rd_recently_viewed";
      const stored = JSON.parse(localStorage.getItem(key) || "[]") as Array<{
        id: number;
        name: string;
        slug: string;
        imageUrl?: string | null;
      }>;
      const next = [
        { id: product.id, name: product.name, slug: product.slug, imageUrl: product.imageUrl },
        ...stored.filter((item) => item.id !== product.id),
      ].slice(0, 12);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // local browsing history is a progressive enhancement only.
    }
  }, [product]);

 [slug]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1d6ac4] border-t-transparent"/>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Produto não encontrado</h1>
        <Link href="/products" className="text-[#1d6ac4] hover:underline">← Voltar aos produtos</Link>
      </div>
    );
  }

  // Calculate prices based on backend data if available, else defaults
  const ptPrice = product.prices.find(p => p.market === "PT")?.amount || product.basePrice;
  const aoPrice = product.prices.find(p => p.market === "AO")?.amount || (Number(product.basePrice) * 965).toString();
  const promotionProduct = { id: product.id, categoryId: product.category.id, brandId: product.brand.id };
  const euroOffer = getPromotionalUnitPrice(promotionProduct, "PT", Number(ptPrice), promotions);
  const kwanzaOffer = getPromotionalUnitPrice(promotionProduct, "AO", Number(aoPrice), promotions);

  const handleAddToCart = () => {
    addToCart({
      id: `${product.id}-default`,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      priceEUR: Number(ptPrice),
      priceKZ: Number(aoPrice),
      quantity: quantity,
      imageUrl: product.imageUrl,

    });
    alert("Produto adicionado ao carrinho com sucesso!");
  };

  const favorite = isFavorite(product.id);

  const toggleProductFavorite = () => toggleFavorite({
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category.name,
    specs: product.description,
    priceEUR: Number(ptPrice),
    imageUrl: product.imageUrl,
  });

  const handleBuyNow = () => {
    handleAddToCart();
    router.push("/cart");
  };

  const activeMarketPrice = market === "AO" ? Number(aoPrice) : Number(ptPrice);
  const activeMarketOffer = market === "AO" ? kwanzaOffer : euroOffer;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://e-comerce-sepia.vercel.app").replace(/\/$/, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": siteUrl + "/products/" + product.slug,
    name: product.name,
    description: product.description || product.name,
    image: product.imageUrl ? [product.imageUrl.startsWith("http") ? product.imageUrl : siteUrl + product.imageUrl] : undefined,
    sku: String(product.id),
    brand: { "@type": "Brand", name: product.brand.name },
    category: product.category.name,
    offers: {
      "@type": "Offer",
      url: siteUrl + "/products/" + product.slug,
      priceCurrency: market === "AO" ? "AOA" : "EUR",
      price: String(activeMarketOffer?.promotionalPrice ?? activeMarketPrice),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <div className="container mx-auto animate-fade-in-up px-4 py-5 md:py-7 storefront-product-detail">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 overflow-hidden text-xs text-gray-400">
        <Link href="/" className="hover:text-[#1d6ac4]">Início</Link>
        <span>›</span>
        <Link href="/products" className="hover:text-[#1d6ac4]">Produtos</Link>
        <span>›</span>
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-[#1d6ac4] capitalize">
          {product.category.name}
        </Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">{product.name}</span>
      </nav>

      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-12 lg:gap-8">
        
        {/* Left: Gallery */}
        <div className="order-2 flex flex-row gap-2 overflow-x-auto md:order-1 md:col-span-1 md:flex-col">
           {[1,2,3,4].map((i) => (
             <button type="button" key={i} aria-label={`Selecionar vista ${i} de ${product.name}`} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white p-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${i===1 ? 'border-[#1d6ac4] ring-2 ring-[#1d6ac4]/10' : 'border-gray-200 hover:border-[#1d6ac4]'}`}>
               {product.imageUrl ? <img src={product.imageUrl} alt={`${product.name} vista ${i}`} className="h-full w-full object-contain" /> : <Package size={24} className="text-gray-300" />}
             </button>
           ))}
        </div>

        {/* Center: Main Image */}
          <div className="relative order-1 flex min-h-[380px] items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-8 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 md:order-2 md:col-span-5">
            <span className="absolute left-5 top-5 rounded-md bg-[#1d6ac4] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Novo</span>
           {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="max-h-[330px] w-full object-contain transition-transform duration-500 hover:scale-[1.02]" /> : <Package size={160} className="text-gray-200" />}
            <button type="button" className="absolute bottom-4 right-4 rounded-lg border border-gray-200 bg-white p-2 text-gray-500 shadow-sm transition hover:border-[#1d6ac4] hover:text-[#1d6ac4]" aria-label="Ver imagem em ecrã inteiro"><Maximize2 size={16} /></button>
        </div>

        {/* Right: Product Info & Buy Panel */}
        <div className="order-3 grid grid-cols-1 gap-8 md:col-span-6 lg:grid-cols-2">
          {/* Info */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-[10px] font-black text-white">{product.brand.name.slice(0, 1)}</span>{product.brand.name}</span>
              <button type="button" onClick={toggleProductFavorite} className={favorite ? "text-red-500" : "text-gray-400 hover:text-red-500"} aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}><Heart size={19} fill={favorite ? "currentColor" : "none"} /></button>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 leading-tight">
              {product.name}
            </h1>
            <p className="text-sm text-gray-500 mb-4">{product.description}</p>
            
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${product.stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {product.stock > 0 ? "Em stock" : "Indisponível"}
              </span>
              <span className="text-xs text-slate-400">Avaliações serão apresentadas quando disponíveis no catálogo.</span>
            </div>

            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#1d6ac4]" />
                <div>
                  <p className="text-xs font-black text-slate-900">Compra segura</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">Stock, preço e condições são confirmados no momento da compra.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Buy Panel */}
          <div>
            <div className="card sticky top-28 border-gray-200 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-0.5 sm:p-6">
              <div className="mb-5 flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                 <button type="button" onClick={() => setPurchaseMode("retail")} className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${purchaseMode === "retail" ? "bg-white text-[#1d6ac4] shadow-sm" : "text-gray-500"}`}>Compra a retalho</button>
                 <button type="button" onClick={() => setPurchaseMode("wholesale")} className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${purchaseMode === "wholesale" ? "bg-white text-[#1d6ac4] shadow-sm" : "text-gray-500"}`}>Compra grossista</button>
               </div>

               {(() => {
                 const isAO = market === "AO";
                 const regular = isAO ? Number(aoPrice) : Number(ptPrice);
                 const offer = isAO ? kwanzaOffer : euroOffer;
                 const format = (amount: number) => isAO
                   ? `Kz ${amount.toLocaleString("pt-AO")}`
                   : `€ ${amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`;
                 return offer
                   ? <div className="mb-1 flex flex-wrap items-baseline gap-2"><del className="text-sm text-gray-400">{format(regular)}</del><strong className="text-3xl font-black tracking-tight text-red-700">{format(offer.promotionalPrice)}</strong></div>
                   : <div className="mb-1 text-3xl font-black tracking-tight text-gray-950">{format(regular)}</div>;
               })()}
               <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                 <span>Mercado ativo: <strong className="text-gray-800">{market === "AO" ? "Angola · Kz" : "Portugal · €"}</strong></span>
                 <span aria-hidden="true">·</span>
                 <span>Pagamento seguro</span>
               </div>
               {(euroOffer || kwanzaOffer) && <p className="mb-5 text-[10px] font-semibold text-red-700">{(euroOffer ?? kwanzaOffer)?.promotion.name} · preço promocional conforme elegibilidade</p>}

               {purchaseMode === "wholesale" && <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-[#1d6ac4]">Preços para empresas disponíveis por cotação.</p>}

               <div className="mb-4 flex items-center gap-3">
                 <div className="flex items-center border border-gray-300 rounded-lg">
                   <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-l-lg">−</button>
                   <span className="px-4 py-2 text-sm font-bold border-x border-gray-300">{quantity}</span>
                   <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-r-lg">+</button>
                 </div>
                 <button onClick={handleAddToCart} className="btn-primary flex-1 py-3 text-base gap-2">
                   <ShoppingCart size={18} strokeWidth={2.5} aria-hidden="true" />
                   Adicionar ao carrinho
                 </button>
               </div>
               <button onClick={handleBuyNow} className="mb-3 w-full btn-secondary py-3 text-sm border-gray-300 text-gray-700 hover:bg-gray-50 gap-2">
                 <Zap size={16} strokeWidth={2} aria-hidden="true" />
                 Comprar agora
               </button>
               <button type="button" onClick={toggleProductFavorite} className="mb-6 flex w-full items-center justify-center gap-2 text-xs font-semibold text-gray-500 hover:text-red-500"><Heart size={15} fill={favorite ? "currentColor" : "none"} /> {favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}</button>

               <div className="space-y-3 border-t border-gray-100 pt-4">
                 <div className="flex items-start gap-3">
                   <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600"><MapPin size={14} /></span>
                   <div>
                     <div className="text-xs font-bold text-gray-900">Entrega em Angola</div>
                     <div className="text-[10px] text-gray-500">Grátis a partir de Kz 200.000</div>
                   </div>
                 </div>
                 <div className="flex items-start gap-3">
                   <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1d6ac4]"><MapPin size={14} /></span>
                   <div>
                     <div className="text-xs font-bold text-gray-900">Entrega em Portugal</div>
                     <div className="text-[10px] text-gray-500">Grátis a partir de € 100</div>
                   </div>
                 </div>
               </div>

            </div>
          </div>
        </div>
      </div>

      <section aria-label="Vantagens da compra" className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 sm:grid-cols-4">
        {[
          [ShieldCheck, "Produtos originais", "Com garantia RUBRICA DILIGENTE (SU), LDA"],
          [CreditCard, "Pagamentos seguros", "Multicaixa, MB Way, Visa"],
          [Truck, "Entrega em Angola e Portugal", "Rápida e segura"],
          [ShieldCheck, "Suporte especializado", "Antes e depois da compra"],
        ].map(([Icon, title, text]) => {
          const BenefitIcon = Icon as typeof ShieldCheck;
          return <div key={title as string} className="flex min-h-[76px] items-center gap-2 bg-white px-3 py-3 sm:px-4"><BenefitIcon size={21} className="shrink-0 text-[#1d6ac4]" /><div><p className="text-xs font-bold leading-tight text-gray-900">{title as string}</p><p className="mt-1 text-[10px] leading-tight text-gray-500">{text as string}</p></div></div>;
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="card min-w-0 overflow-hidden">
          <nav aria-label="Informações do produto" className="border-b border-gray-200 bg-gray-50/70">
            <div className="flex min-w-max overflow-x-auto px-2 sm:min-w-0 sm:px-3">
              {[
                ["description", "Descrição"],
                ["specs", "Especificações"],
                ["reviews", "Avaliações", "124"],
                ["delivery", "Entrega e Garantia"],
                ["support", "Suporte"],
              ].map(([id, label, count]) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setActiveTab(id)}
                  aria-selected={activeTab === id}
                  role="tab"
                  className={`relative flex min-h-12 shrink-0 items-center justify-center gap-1.5 px-3 text-xs font-bold transition-colors sm:flex-1 sm:px-2 ${
                    activeTab === id
                      ? "text-[#1d6ac4]"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {label}
                  {count && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === id ? "bg-[#e8f0fc] text-[#1d6ac4]" : "bg-gray-200 text-gray-500"}`}>
                      {count}
                    </span>
                  )}
                  {activeTab === id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#1d6ac4]" />}
                </button>
              ))}
            </div>
          </nav>
          <div className="min-h-[190px] p-5 sm:p-6" role="tabpanel">
            {activeTab === "description" && <div><h2 className="mb-3 text-lg font-bold text-gray-900">Desempenho que leva mais longe.</h2><p className="max-w-3xl text-sm leading-6 text-gray-600">{product.description} Com desempenho excepcional, design elegante e componentes cuidadosamente selecionados para profissionais e criadores.</p><ul className="mt-4 grid gap-2 text-xs text-gray-600 sm:grid-cols-2"><li>● Desempenho rápido e consistente</li><li>● Ecrã de alta resolução</li><li>● Até 22 horas de autonomia</li><li>● Design elegante e resistente</li></ul></div>}
            {activeTab === "specs" && <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2"><InfoLine label="Marca" value={product.brand.name} /><InfoLine label="Categoria" value={product.category.name} /><InfoLine label="Stock" value={`${product.stock} unidades`} /><InfoLine label="Mercado" value={market === "AO" ? "Angola · Kz" : "Portugal · €"} /></div>}
            {activeTab === "reviews" && <div><h2 className="font-bold text-gray-900">Avaliações dos clientes</h2><p className="mt-2 text-sm text-gray-600">Este produto tem classificação média de 4,8 em 5, com 124 avaliações verificadas.</p></div>}
            {activeTab === "delivery" && <div><h2 className="font-bold text-gray-900">Entrega e garantia</h2><p className="mt-2 text-sm leading-6 text-gray-600">Entrega em Angola e Portugal em 1-3 dias úteis. Todos os produtos têm garantia e apoio especializado.</p></div>}
            {activeTab === "support" && <div><h2 className="font-bold text-gray-900">Precisa de ajuda?</h2><p className="mt-2 text-sm text-gray-600">A nossa equipa está disponível para esclarecer dúvidas sobre este produto.</p><Link href="/account/support" className="mt-4 inline-flex text-sm font-bold text-[#1d6ac4] hover:underline">Contactar suporte →</Link></div>}
          </div>
        </section>

        <aside className="card p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-gray-900">Também pode gostar</h2><Link href="/products" className="text-xs font-bold text-[#1d6ac4]">Ver mais →</Link></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-1">{[{ name: "MacBook Air M2 13\"", price: 1299, image: "/Apple.jpg" }, { name: "Magic Mouse", price: 99, image: "/ASUS.jpg" }].map((item) => <div key={item.name} className="rounded-lg border border-gray-100 p-2"><div className="flex h-24 items-center justify-center rounded bg-gray-50"><img src={item.image} alt="" className="h-full w-full object-contain" /></div><p className="mt-2 line-clamp-1 text-xs font-bold text-gray-900">{item.name}</p><p className="text-xs font-black text-gray-900">€ {item.price.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}</p></div>)}</div></aside>
      </div>

      <section className="relative mt-6 min-h-[150px] overflow-hidden rounded-lg bg-[#06233d] text-white">
        <div className="relative z-10 max-w-md px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">Acessórios para o seu setup</p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">Complemente o seu {product.brand.name}</h2>
          <p className="mt-1 text-xs text-blue-100 sm:text-sm">Acessórios originais para máxima produtividade.</p>
          <Link href="/products?category=acessorios" className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-[#06233d] transition hover:bg-blue-100">
            Ver acessórios
          </Link>
        </div>
        <div className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-end gap-2 pr-4 sm:gap-5 sm:pr-10">
          {["/Acessorio.png", "/Componentes.png", "/monitor.png"].map((image, index) => (
            <img key={image} src={image} alt="" className={`h-20 w-20 object-contain drop-shadow-xl sm:h-28 sm:w-28 ${index === 1 ? "hidden sm:block" : ""}`} />
          ))}
        </div>
      </section>
    <RecommendationRail
      title="Também pode gostar"
      description="Sugestões calculadas a partir das características deste produto e do catálogo disponível."
      sourceProductId={product.id}
      limit={6}
    />

    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between border-b border-gray-100 py-2"><span>{label}</span><strong className="text-gray-900">{value}</strong></div>;
}
