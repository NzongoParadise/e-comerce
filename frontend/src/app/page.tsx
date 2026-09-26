"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Apple, Building2, ChevronRight, CreditCard, Gamepad2, Headphones, Headset, Heart, Laptop, Mail, MessageCircle, Monitor, Package, Settings, ShieldCheck, ShoppingCart, Smartphone, Truck, type LucideIcon } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";
import { fetchWithAuth } from "@/lib/api";

type Product = { id: number; name: string; slug: string; description: string | null; basePrice: string | number; imageUrl: string | null; stock: number; category: { name: string; slug: string }; brand: { name: string; slug: string }; prices?: { market: string; amount: string | number; currency: string }[] };
type Category = { id: number; name: string; slug: string; productCount: number };
type Brand = { id: number; name: string; slug: string };
type Testimonial = { id: number; name: string; location: string; text: string; stars: number };
const categoryIcons: Record<string, { Icon: LucideIcon; subtitle: string }> = {
  computadores: { Icon: Laptop, subtitle: "Portáteis e desktops" }, iphone: { Icon: Smartphone, subtitle: "Todos os modelos" }, apple: { Icon: Apple, subtitle: "Mac, iPad e acessórios" }, smartphones: { Icon: Smartphone, subtitle: "Todas as marcas" }, gaming: { Icon: Gamepad2, subtitle: "Gaming e entretenimento" }, monitores: { Icon: Monitor, subtitle: "Trabalho e entretenimento" }, componentes: { Icon: Settings, subtitle: "RAM, SSD e componentes" }, acessorios: { Icon: Headphones, subtitle: "Tudo para o seu setup" },
};
const brandImages: Record<string, string> = { apple: "/Apple.jpg", dell: "/Dell.jpg", hp: "/HP.jpg", lenovo: "/Lenovo.jpg", asus: "/ASUS.jpg", samsung: "/Samsung.jpg", xiaomi: "/Xiaomi.jpg", canon: "/Canon.jpg", epson: "/Epson.jpg", microsoft: "/Microsoft.jpg" };
const banners = ["/banner_principal0.jpg", "/banner_principal1.png", "/banner_principal2.png", "/banner_principal3.png", "/banner_principal4.png", "/banner_principal5.png", "/banner_principal6.png", "/banner_principal7.png"];
const popularTerms = ["Impressoras", "Computadores", "Mochilas", "Cabos", "Monitores", "Adaptadores", "Teclados", "Ratos", "Tablets"];
const benefits: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: CreditCard, title: "Multicaixa", detail: "Express ou Referência" },
  { icon: Headset, title: "Suporte online", detail: "Apoio especializado" },
  { icon: Truck, title: "Envio nacional", detail: "Entrega segura em dias úteis" },
  { icon: ShieldCheck, title: "Compra protegida", detail: "Produtos originais e garantia" },
];

function Stars({ count }: { count: number }) {
  return <div className="flex gap-0.5 text-[#e6a400]" aria-label={`${count} de 5 estrelas`}>{Array.from({ length: 5 }, (_, index) => <span key={index}>{index < count ? "★" : "☆"}</span>)}</div>;
}

function ProductTile({ product }: { product: Product }) {
  const { market, formatPrice, eurToKz } = useMarket();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const euroPrice = Number(product.prices?.find((price) => price.market === "PT")?.amount ?? product.basePrice);
  const kwanzaPrice = Number(product.prices?.find((price) => price.market === "AO")?.amount ?? eurToKz(euroPrice));
  const favorite = isFavorite(product.id);
  return <article className="group relative flex min-w-0 flex-col border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md sm:p-4">
    <button type="button" onClick={() => toggleFavorite({ id: product.id, name: product.name, slug: product.slug, category: product.category.name, specs: product.description || "", priceEUR: euroPrice, imageUrl: product.imageUrl || undefined })} aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`} className={`absolute right-3 top-3 z-10 bg-white p-2 shadow-sm ${favorite ? "text-red-500" : "text-gray-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"}`}><Heart size={17} fill={favorite ? "currentColor" : "none"} /></button>
    {product.stock <= 3 && product.stock > 0 && <span className="absolute left-3 top-3 z-10 bg-[#f6b73c] px-2 py-1 text-[9px] font-black uppercase text-[#132238]">Últimas unidades</span>}
    <Link href={`/products/${product.slug}`} className="mb-3 flex h-36 items-center justify-center bg-[#f7f8f8] p-3 sm:h-44"><Image src={product.imageUrl || "/file.svg"} alt={product.name} width={180} height={160} className="h-full w-full object-contain mix-blend-multiply transition-transform group-hover:scale-[1.03]" /></Link>
    <Link href={`/products?brand=${product.brand.slug}`} className="text-[10px] font-bold uppercase tracking-wide text-[#1d6ac4]">{product.brand.name}</Link>
    <Link href={`/products/${product.slug}`} className="mt-1 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-gray-900 hover:text-[#1d6ac4]">{product.name}</Link>
    <p className="mt-1 line-clamp-1 text-[11px] text-gray-500">{product.description || product.category.name}</p>
    <div className="mt-2 flex items-center gap-1"><Stars count={0} /><span className="text-[10px] text-gray-400">Avaliações</span></div>
    <p className="mt-2 text-[10px] font-semibold text-green-700">{product.stock > 0 ? `Em stock (${product.stock})` : "Indisponível"}</p>
    <div className="mt-auto pt-3"><p className="text-lg font-black text-[#111827]">{formatPrice(euroPrice)}</p><p className="mb-3 text-[10px] text-gray-500">{market === "PT" ? `Kz ${kwanzaPrice.toLocaleString("pt-AO")}` : `€ ${euroPrice.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}</p><button type="button" disabled={product.stock <= 0} onClick={() => addToCart({ id: `${product.id}-default`, productId: product.id, name: product.name, slug: product.slug, priceEUR: euroPrice, priceKZ: kwanzaPrice, quantity: 1, imageUrl: product.imageUrl || undefined })} className="inline-flex w-full items-center justify-center gap-2 bg-[#f6b73c] px-3 py-2.5 text-xs font-black text-[#132238] transition hover:bg-[#ffd166] disabled:cursor-not-allowed disabled:bg-gray-200"><ShoppingCart size={15} />Adicionar ao carrinho</button></div>
  </article>;
}

export default function HomePage() {
  const [banner, setBanner] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("Todos");
  const [email, setEmail] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: "", location: "", text: "" });
  const [reviewMessage, setReviewMessage] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setBanner((current) => (current + 1) % banners.length), 6000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    Promise.all([fetchWithAuth("/api/products?page=1&pageSize=100"), fetchWithAuth("/api/categories"), fetchWithAuth("/api/brands"), fetchWithAuth("/api/testimonials")])
      .then(([productResult, categoryResult, brandResult, reviewResult]) => { setProducts(productResult.data); setCategories(categoryResult.data); setBrands(brandResult.data); setTestimonials(reviewResult.data); })
      .catch(() => setError("Não foi possível carregar a loja. Verifique a ligação e tente novamente."))
      .finally(() => setLoading(false));
  }, []);

  const visibleProducts = products.filter((product) => category === "Todos" || product.category.slug === category);
  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNewsletterLoading(true); setNewsletterMessage("");
    try { const result = await fetchWithAuth("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); setNewsletterMessage(result.data ? "Subscrição confirmada. Obrigado!" : "Subscrição registada."); setEmail(""); }
    catch { setNewsletterMessage("Não foi possível concluir a subscrição. Tente novamente."); }
    finally { setNewsletterLoading(false); }
  }
  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setReviewMessage("A enviar...");
    try { await fetchWithAuth("/api/testimonials/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...reviewForm, stars: 5 }) }); setReviewForm({ name: "", location: "", text: "" }); setReviewMessage("Obrigado. A avaliação será publicada após revisão."); }
    catch { setReviewMessage("Não foi possível enviar a avaliação."); }
  }

  return <div className="bg-[#eaeded]">
    <section className="container mx-auto grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_230px]">
      <div className="relative min-h-[340px] overflow-hidden bg-[#132238] shadow-sm md:min-h-[410px]">
        {banners.map((src, index) => <div key={src} className={`absolute inset-0 transition-opacity duration-700 ${index === banner ? "opacity-100" : "pointer-events-none opacity-0"}`}><Image src={src} alt={`Campanha TechGlobal ${index + 1}`} fill sizes="(max-width: 1024px) 100vw, 75vw" priority={index === 0} className="object-cover" /></div>)}
        <div className="absolute inset-0 bg-linear-to-r from-[#071525]/90 via-[#071525]/45 to-transparent" />
        <div className="relative z-10 flex min-h-[340px] max-w-lg flex-col justify-center px-6 py-9 text-white md:min-h-[410px] md:px-10"><p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#f6b73c]">TechGlobal marketplace</p><h1 className="max-w-md text-4xl font-black leading-[1.02] sm:text-5xl">Tecnologia para avançar.</h1><p className="mt-4 max-w-sm text-sm leading-6 text-blue-50 sm:text-base">Equipamentos originais, preços competitivos e entrega segura em Angola e Portugal.</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/products" className="inline-flex items-center gap-2 bg-[#f6b73c] px-5 py-3 text-sm font-black text-[#132238] hover:bg-[#ffd166]">Explorar produtos <ChevronRight size={17} /></Link><Link href="/promotions" className="border border-white/60 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Ofertas</Link></div></div>
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">{banners.map((_, index) => <button key={index} onClick={() => setBanner(index)} aria-label={`Campanha ${index + 1}`} className={`h-1.5 transition-all ${index === banner ? "w-7 bg-[#f6b73c]" : "w-1.5 bg-white/70"} `} />)}</div>
        <button type="button" onClick={() => setBanner((banner + banners.length - 1) % banners.length)} aria-label="Campanha anterior" className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 bg-white/80 p-2 text-gray-900 md:block">‹</button><button type="button" onClick={() => setBanner((banner + 1) % banners.length)} aria-label="Próxima campanha" className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 bg-white/80 p-2 text-gray-900 md:block">›</button>
      </div>
      <aside className="grid grid-cols-2 gap-3 lg:grid-cols-1"><Link href="/promotions" className="bg-white p-4 shadow-sm hover:shadow-md"><p className="text-[10px] font-black uppercase tracking-wider text-[#1d6ac4]">Ofertas da semana</p><h2 className="mt-2 text-lg font-black text-gray-900">Tecnologia a melhor preço</h2><p className="mt-1 text-xs text-gray-500">Descubra campanhas e oportunidades atuais.</p><span className="mt-4 inline-flex items-center text-xs font-bold text-[#1d6ac4]">Ver ofertas <ChevronRight size={14} /></span></Link><Link href="/register?accountType=B2B" className="bg-[#132238] p-4 text-white hover:bg-[#1b3150]"><p className="text-[10px] font-black uppercase tracking-wider text-[#f6b73c]">Para empresas</p><h2 className="mt-2 text-lg font-black">Condições B2B</h2><p className="mt-1 text-xs text-blue-100">Cotações rápidas e apoio comercial.</p><span className="mt-4 inline-flex items-center text-xs font-bold text-[#f6b73c]">Criar conta empresarial <ChevronRight size={14} /></span></Link></aside>
    </section>

    <section className="border-y border-gray-200 bg-white"><div className="container mx-auto grid grid-cols-2 divide-x divide-gray-100 px-4 md:grid-cols-4">{benefits.map(({ icon: Icon, title, detail }) => <div key={title} className="flex items-center gap-3 px-3 py-4 sm:px-5"><Icon size={21} className="shrink-0 text-[#1d6ac4]" /><span><strong className="block text-xs text-gray-900">{title}</strong><small className="text-[10px] text-gray-500">{detail}</small></span></div>)}</div></section>

    <section className="border-b border-gray-200 bg-white py-8"><div className="container mx-auto px-4"><div className="mb-5 flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Explore a loja</p><h2 className="mt-1 text-2xl font-black text-gray-900">Compre por categoria</h2></div><Link href="/categories" className="text-xs font-bold text-[#1d6ac4] hover:underline">Todas as categorias <ChevronRight size={13} className="inline" /></Link></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{categories.map((item) => { const visual = categoryIcons[item.slug] || { Icon: Package, subtitle: `${item.productCount} produtos` }; return <Link key={item.id} href={`/products?category=${item.slug}`} className="group flex min-h-28 flex-col items-center justify-center border border-gray-200 bg-white p-3 text-center hover:border-[#1d6ac4] hover:shadow-sm"><span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#f1f5f9] text-[#1d6ac4] group-hover:bg-[#e8f0fc]"><visual.Icon size={23} /></span><strong className="text-xs text-gray-800">{item.name}</strong><small className="mt-1 hidden text-[9px] text-gray-500 sm:block">{visual.subtitle}</small></Link>; })}</div></div></section>

    <section className="border-b border-gray-200 bg-[#f7f8f8] py-5"><div className="container mx-auto flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black text-gray-900">Termos mais procurados</h2><p className="text-xs text-gray-500">Pesquise rapidamente no catálogo.</p></div><div className="flex flex-wrap gap-2">{popularTerms.map((term, index) => <Link key={term} href={`/search?q=${encodeURIComponent(term)}`} className="border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-[#1d6ac4] hover:text-[#1d6ac4]">{index + 1}. {term}</Link>)}</div></div></section>

    <section className="container mx-auto px-4 py-8"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Escolhas TechGlobal</p><h2 className="mt-1 text-2xl font-black text-gray-900">Produtos em destaque</h2></div><Link href="/products" className="text-xs font-bold text-[#1d6ac4]">Ver catálogo completo <ChevronRight size={13} className="inline" /></Link></div><div className="mb-4 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setCategory("Todos")} className={`whitespace-nowrap px-4 py-2 text-xs font-bold ${category === "Todos" ? "bg-[#232f3e] text-white" : "border border-gray-300 bg-white text-gray-600"}`}>Todos</button>{categories.map((item) => <button type="button" key={item.id} onClick={() => setCategory(item.slug)} className={`whitespace-nowrap px-4 py-2 text-xs font-bold ${category === item.slug ? "bg-[#232f3e] text-white" : "border border-gray-300 bg-white text-gray-600"}`}>{item.name}</button>)}</div>{loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-80 animate-pulse bg-white" />)}</div> : error ? <div className="bg-white p-8 text-center text-sm text-red-700">{error}</div> : visibleProducts.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{visibleProducts.slice(0, 12).map((product) => <ProductTile key={product.id} product={product} />)}</div> : <div className="bg-white p-8 text-center text-sm text-gray-500">Não existem produtos nesta categoria.</div>}</section>

    <section className="border-y border-gray-200 bg-white py-8"><div className="container mx-auto px-4"><div className="mb-5 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Marcas disponíveis</p><h2 className="mt-1 text-2xl font-black text-gray-900">Explore por marca</h2></div><Link href="/products" className="text-xs font-bold text-[#1d6ac4]">Ver marcas <ChevronRight size={13} className="inline" /></Link></div><div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-10">{brands.map((brand) => <Link key={brand.id} href={`/products?brand=${brand.slug}`} className="group flex min-h-20 flex-col items-center justify-center gap-2 border border-gray-200 p-3 hover:border-[#1d6ac4]">{brandImages[brand.slug] ? <Image src={brandImages[brand.slug]} alt={brand.name} width={54} height={40} className="h-10 w-14 object-contain" /> : <span className="flex h-10 w-14 items-center justify-center bg-gray-50 text-xs font-black text-gray-600">{brand.name.slice(0, 3)}</span>}<span className="text-[10px] font-semibold text-gray-600 group-hover:text-[#1d6ac4]">{brand.name}</span></Link>)}</div></div></section>

    <section className="container mx-auto px-4 py-9"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Experiências reais</p><h2 className="mt-1 text-2xl font-black text-gray-900">O que dizem os nossos clientes</h2></div><button type="button" onClick={() => setReviewOpen((open) => !open)} className="border border-[#1d6ac4] bg-white px-3 py-2 text-xs font-bold text-[#1d6ac4] hover:bg-[#e8f0fc]">Deixar avaliação</button></div>{testimonials.length ? <div className="grid gap-3 md:grid-cols-3">{testimonials.slice(0, 3).map((review) => <article key={review.id} className="border border-gray-200 bg-white p-5"><Stars count={review.stars} /><p className="mt-3 text-sm leading-6 text-gray-700">“{review.text}”</p><div className="mt-4 border-t border-gray-100 pt-3"><strong className="block text-xs text-gray-900">{review.name}</strong><span className="text-[10px] text-gray-500">{review.location}</span></div></article>)}</div> : <p className="border border-gray-200 bg-white p-5 text-sm text-gray-500">Ainda não existem avaliações publicadas.</p>}{reviewOpen && <form onSubmit={submitReview} className="mt-4 border border-gray-200 bg-white p-5"><h3 className="mb-3 text-sm font-black">Partilhe a sua experiência</h3><div className="grid gap-3 sm:grid-cols-2"><input required minLength={2} value={reviewForm.name} onChange={(event) => setReviewForm({ ...reviewForm, name: event.target.value })} placeholder="Nome" className="border border-gray-300 px-3 py-2.5 text-sm" /><input required minLength={2} value={reviewForm.location} onChange={(event) => setReviewForm({ ...reviewForm, location: event.target.value })} placeholder="Cidade, país" className="border border-gray-300 px-3 py-2.5 text-sm" /></div><textarea required minLength={10} value={reviewForm.text} onChange={(event) => setReviewForm({ ...reviewForm, text: event.target.value })} placeholder="Escreva a sua avaliação" rows={3} className="mt-3 w-full border border-gray-300 px-3 py-2.5 text-sm" /><div className="mt-3 flex flex-wrap items-center gap-3"><button className="bg-[#f6b73c] px-4 py-2.5 text-xs font-black text-[#132238]">Enviar avaliação</button>{reviewMessage && <span role="status" className="text-xs text-gray-600">{reviewMessage}</span>}</div></form>}</section>

    <section className="border-y border-gray-200 bg-white py-6"><div className="container mx-auto flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center bg-[#e8f0fc] text-[#1d6ac4]"><Mail size={19} /></span><span><strong className="block text-sm text-gray-900">Receba novidades e promoções</strong><small className="text-xs text-gray-500">Ofertas e novos produtos diretamente no seu email.</small></span></div>{newsletterMessage ? <p role="status" className="text-sm font-semibold text-gray-700">{newsletterMessage}</p> : <form onSubmit={subscribe} className="flex w-full sm:w-auto"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="O seu email" className="min-w-0 flex-1 border border-gray-300 px-3 py-2.5 text-sm sm:w-64" /><button disabled={newsletterLoading} className="bg-[#f6b73c] px-4 py-2.5 text-xs font-black text-[#132238] disabled:opacity-60">{newsletterLoading ? "A enviar..." : "Subscrever"}</button></form>}</div></section>
    <a href="https://wa.me/244940370723" target="_blank" rel="noreferrer" aria-label="Falar com suporte no WhatsApp" className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition-transform hover:scale-105"><MessageCircle size={23} /></a>
  </div>;
}
