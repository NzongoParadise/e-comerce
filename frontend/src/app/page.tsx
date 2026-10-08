"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Apple, Building2, ChevronLeft, ChevronRight, CreditCard, Gamepad2, Headphones, Headset, Heart, Laptop, Mail, MessageCircle, Monitor, Package, Settings, ShieldCheck, Smartphone, Truck, type LucideIcon } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useMarket } from "@/context/MarketContext";
import { ProductTile, type Product } from "@/components/features/home/ProductTile";
import { RecommendationRail } from "@/components/features/catalog/RecommendationRail";
import { Stars } from "@/components/features/home/Stars";
import { fetchWithAuth } from "@/lib/api";

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

  return <div className="bg-transparent">
    <section className="container mx-auto grid grid-cols-1 gap-4 px-4 pb-5 pt-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="hero-glow group relative min-h-[430px] overflow-hidden rounded-[30px] bg-[#0d1b2a] shadow-[0_24px_70px_rgba(15,23,42,0.18)] md:min-h-[470px]">
        {banners.map((src, index) => <div key={src} className={index === banner ? "absolute inset-0 opacity-100 transition-opacity duration-700" : "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700"}><Image src={src} alt={"Campanha RUBRICA DILIGENTE (SU), LDA " + (index + 1)} fill sizes="(max-width: 1024px) 100vw, 75vw" priority={index === 0} className="object-cover transition-transform duration-[7000ms] group-hover:scale-[1.02]" /></div>)}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(246,183,60,0.34),transparent_26%),linear-gradient(90deg,rgba(5,16,29,0.95)_0%,rgba(5,16,29,0.82)_34%,rgba(5,16,29,0.28)_100%)]" />
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_65%)] lg:block" />
        <div className="relative z-10 flex min-h-[430px] max-w-2xl flex-col justify-center px-6 py-10 text-white md:min-h-[470px] md:px-10 lg:px-12">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#f6b73c] backdrop-blur-sm">Tecnologia • Angola + Portugal</span>
          <h1 className="mt-5 max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.035em] sm:text-5xl lg:text-6xl">Tecnologia para avançar.</h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-blue-50 sm:text-base">Equipamentos originais, preços competitivos e entrega segura em Angola e Portugal.</p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link href="/products" className="inline-flex items-center gap-2 rounded-xl bg-[#f6b73c] px-5 py-3 text-sm font-black text-[#132238] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#ffd166]">Explorar produtos <ChevronRight size={17} /></Link>
            <Link href="/promotions" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/15">Ver ofertas</Link>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/7 px-3 py-3 backdrop-blur-sm"><strong className="block text-[10px] font-black text-white">Entrega segura</strong><span className="mt-0.5 block text-[9px] text-blue-100/80">Angola + Portugal</span></div>
            <div className="rounded-2xl border border-white/10 bg-white/7 px-3 py-3 backdrop-blur-sm"><strong className="block text-[10px] font-black text-white">Produtos originais</strong><span className="mt-0.5 block text-[9px] text-blue-100/80">Compra protegida</span></div>
            <div className="rounded-2xl border border-white/10 bg-white/7 px-3 py-3 backdrop-blur-sm"><strong className="block text-[10px] font-black text-white">Apoio especializado</strong><span className="mt-0.5 block text-[9px] text-blue-100/80">Online e comercial</span></div>
          </div>
        </div>
        <div className="absolute bottom-5 left-6 z-20 flex items-center gap-2 md:left-10">{banners.map((_, index) => <button key={index} type="button" onClick={() => setBanner(index)} aria-label={"Campanha " + (index + 1)} className={index === banner ? "h-1.5 w-8 rounded-full bg-[#f6b73c] transition-all" : "h-1.5 w-1.5 rounded-full bg-white/50 transition-all hover:bg-white/80"} />)}</div>
        <button type="button" onClick={() => setBanner((banner + banners.length - 1) % banners.length)} aria-label="Campanha anterior" className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/20 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/35 md:block"><ChevronLeft size={18} /></button>
        <button type="button" onClick={() => setBanner((banner + 1) % banners.length)} aria-label="Próxima campanha" className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/20 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/35 md:block"><ChevronRight size={18} /></button>
      </div>

      <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Link href="/promotions" className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-100/70 blur-2xl" />
          <div className="relative">
            <span className="inline-flex rounded-full bg-[#e8f0fc] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-[#1d6ac4]">Ofertas da semana</span>
            <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">Tecnologia a melhor preço</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">Descubra campanhas e oportunidades atuais antes de comprar.</p>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-black text-[#1d6ac4]">Ver ofertas <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
          </div>
        </Link>

        <Link href="/register?accountType=B2B" className="group relative overflow-hidden rounded-[24px] bg-[#132238] p-5 text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-[#f6b73c]/20 blur-2xl" />
          <div className="relative">
            <span className="inline-flex rounded-full border border-[#f6b73c]/25 bg-[#f6b73c]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-[#f6b73c]">Para empresas</span>
            <h2 className="mt-3 text-xl font-black tracking-tight">Condições B2B</h2>
            <p className="mt-2 text-xs leading-5 text-blue-100">Cotações rápidas, preços empresariais e apoio comercial.</p>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-black text-[#f6b73c]">Criar conta empresarial <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
          </div>
        </Link>
      </aside>
    </section>

    <section className="border-y border-slate-200 bg-white"><div className="container mx-auto grid grid-cols-2 gap-2 px-4 py-3.5 md:grid-cols-4">{benefits.map(({ icon: Icon, title, detail }) => <div key={title} className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-4 transition hover:-translate-y-0.5 hover:border-blue-100 hover:bg-white hover:shadow-sm sm:px-5"><Icon size={21} className="shrink-0 text-[#1d6ac4]" /><span><strong className="block text-xs text-gray-900">{title}</strong><small className="text-[10px] text-gray-500">{detail}</small></span></div>)}</div></section>

    <section className="border-b border-slate-200 bg-white py-10"><div className="container mx-auto px-4"><div className="mb-6 flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Explore a loja</p><h2 className="mt-1 text-2xl font-black text-gray-900">Compre por categoria</h2></div><Link href="/categories" className="text-xs font-bold text-[#1d6ac4] hover:underline">Todas as categorias <ChevronRight size={13} className="inline" /></Link></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{categories.map((item) => { const visual = categoryIcons[item.slug] || { Icon: Package, subtitle: item.productCount === 1 ? "1 produto" : `${item.productCount} produtos` }; return <Link key={item.id} href={`/products?category=${item.slug}`} className="group relative flex min-h-32 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-[0_8px_24px_rgba(15,23,42,0.03)] transition duration-300 hover:-translate-y-1 hover:border-[#1d6ac4]/40 hover:shadow-[0_16px_34px_rgba(29,106,196,0.10)]"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#1d6ac4] transition group-hover:scale-105 group-hover:bg-[#e8f0fc]"><visual.Icon size={23} /></span><strong className="text-xs text-gray-800">{item.name}</strong><small className="mt-1 hidden text-[9px] text-gray-500 sm:block">{visual.subtitle}</small></Link>; })}</div></div></section>

    <section className="border-b border-slate-200 bg-[#f7f9fc] py-6"><div className="container mx-auto flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black text-gray-900">Termos mais procurados</h2><p className="text-xs text-gray-500">Pesquise rapidamente no catálogo.</p></div><div className="flex flex-wrap gap-2">{popularTerms.map((term, index) => <Link key={term} href={`/search?q=${encodeURIComponent(term)}`} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-[#1d6ac4]/40 hover:text-[#1d6ac4]">{index + 1}. {term}</Link>)}</div></div></section>

    <section className="container mx-auto px-4 py-10"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Escolhas RUBRICA DILIGENTE (SU), LDA</p><h2 className="mt-1 text-2xl font-black text-gray-900">Produtos em destaque</h2></div><Link href="/products" className="text-xs font-bold text-[#1d6ac4]">Ver catálogo completo <ChevronRight size={13} className="inline" /></Link></div><div className="mb-4 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setCategory("Todos")} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${category === "Todos" ? "bg-[#132238] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-[#1d6ac4]/40 hover:text-[#1d6ac4]"}`}>Todos</button>{categories.map((item) => <button type="button" key={item.id} onClick={() => setCategory(item.slug)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${category === item.slug ? "bg-[#132238] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-[#1d6ac4]/40 hover:text-[#1d6ac4]"}`}>{item.name}</button>)}</div>{loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-80 animate-pulse bg-white" />)}</div> : error ? <div className="bg-white p-8 text-center text-sm text-red-700">{error}</div> : visibleProducts.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{visibleProducts.slice(0, 12).map((product) => <ProductTile key={product.id} product={product} />)}</div> : <div className="bg-white p-8 text-center text-sm text-gray-500">Não existem produtos nesta categoria.</div>}</section>

    <RecommendationRail
      title="Sugestões do catálogo"
      description="Produtos relacionados e disponíveis no catálogo atual, para ajudar a descobrir alternativas sem sair da loja."
      limit={6}
    />

    <section className="border-y border-slate-200 bg-slate-50 py-10"><div className="container mx-auto px-4"><div className="mb-5 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Marcas disponíveis</p><h2 className="mt-1 text-2xl font-black text-gray-900">Explore por marca</h2></div><Link href="/products" className="text-xs font-bold text-[#1d6ac4]">Ver marcas <ChevronRight size={13} className="inline" /></Link></div><div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-10">{brands.map((brand) => <Link key={brand.id} href={`/products?brand=${brand.slug}`} className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[#1d6ac4]/40 hover:shadow-md">{brandImages[brand.slug] ? <Image src={brandImages[brand.slug]} alt={brand.name} width={54} height={40} className="h-10 w-14 object-contain" /> : <span className="flex h-10 w-14 items-center justify-center bg-gray-50 text-xs font-black text-gray-600">{brand.name.slice(0, 3)}</span>}<span className="text-[10px] font-semibold text-gray-600 group-hover:text-[#1d6ac4]">{brand.name}</span></Link>)}</div></div></section>

    <section className="border-t border-slate-200 bg-white"><div className="container mx-auto px-4 py-10"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Experiências reais</p><h2 className="mt-1 text-2xl font-black text-gray-900">O que dizem os nossos clientes</h2></div><button type="button" onClick={() => setReviewOpen((open) => !open)} className="border border-[#1d6ac4] bg-white px-3 py-2 text-xs font-bold text-[#1d6ac4] hover:bg-[#e8f0fc]">Deixar avaliação</button></div>{testimonials.length ? <div className="grid gap-3 md:grid-cols-3">{testimonials.slice(0, 3).map((review) => <article key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"><Stars count={review.stars} /><p className="mt-3 text-sm leading-6 text-gray-700">“{review.text}”</p><div className="mt-4 border-t border-gray-100 pt-3"><strong className="block text-xs text-gray-900">{review.name}</strong><span className="text-[10px] text-gray-500">{review.location}</span></div></article>)}</div> : <p className="border border-gray-200 bg-white p-5 text-sm text-gray-500">Ainda não existem avaliações publicadas.</p>}{reviewOpen && <form onSubmit={submitReview} className="mt-4 border border-gray-200 bg-white p-5"><h3 className="mb-3 text-sm font-black">Partilhe a sua experiência</h3><div className="grid gap-3 sm:grid-cols-2"><input required minLength={2} value={reviewForm.name} onChange={(event) => setReviewForm({ ...reviewForm, name: event.target.value })} placeholder="Nome" className="border border-gray-300 px-3 py-2.5 text-sm" /><input required minLength={2} value={reviewForm.location} onChange={(event) => setReviewForm({ ...reviewForm, location: event.target.value })} placeholder="Cidade, país" className="border border-gray-300 px-3 py-2.5 text-sm" /></div><textarea required minLength={10} value={reviewForm.text} onChange={(event) => setReviewForm({ ...reviewForm, text: event.target.value })} placeholder="Escreva a sua avaliação" rows={3} className="mt-3 w-full border border-gray-300 px-3 py-2.5 text-sm" /><div className="mt-3 flex flex-wrap items-center gap-3"><button className="bg-[#f6b73c] px-4 py-2.5 text-xs font-black text-[#132238]">Enviar avaliação</button>{reviewMessage && <span role="status" className="text-xs text-gray-600">{reviewMessage}</span>}</div></form>}</section>

    <section className="border-y border-slate-200 bg-[#132238] py-8 text-white"><div className="container mx-auto flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center bg-[#e8f0fc] text-[#1d6ac4]"><Mail size={19} /></span><span><strong className="block text-sm text-white">Receba novidades e promoções</strong><small className="text-xs text-blue-100">Ofertas e novos produtos diretamente no seu email.</small></span></div>{newsletterMessage ? <p role="status" className="text-sm font-semibold text-gray-700">{newsletterMessage}</p> : <form onSubmit={subscribe} className="flex w-full sm:w-auto"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="O seu email" className="min-w-0 flex-1 rounded-l-xl border border-white/10 bg-white px-3 py-2.5 text-sm text-slate-900 sm:w-64" /><button disabled={newsletterLoading} className="rounded-r-xl bg-[#f6b73c] px-4 py-2.5 text-xs font-black text-[#132238] transition hover:bg-[#ffd166] disabled:opacity-60">{newsletterLoading ? "A enviar..." : "Subscrever"}</button></form>}</div></section>
    <a href="https://wa.me/244940370723" target="_blank" rel="noreferrer" aria-label="Falar com suporte no WhatsApp" className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition-transform hover:scale-105"><MessageCircle size={23} /></a>
  </div>;
}
