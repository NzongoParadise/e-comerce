"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Apple, ArrowRight, ChevronRight, CreditCard, Gamepad2, Headphones, Laptop, Mail, MessageCircle, Monitor, Package, RefreshCcw, Settings, Smartphone, Truck, type LucideIcon } from "lucide-react";
import { useMarket } from "@/context/MarketContext";
import { ProductCard, type CatalogProduct } from "@/components/features/catalog/ProductCard";
import { Stars } from "@/components/features/home/Stars";
import { fetchWithAuth } from "@/lib/api";
import { storefrontCollections } from "@/lib/storefrontCollections";

type Category = { id: number; name: string; slug: string; productCount: number };
type Brand = { id: number; name: string; slug: string };
type Testimonial = { id: number; name: string; location: string; text: string; stars: number };
const categoryIcons: Record<string, LucideIcon> = {
  computadores: Laptop, iphone: Smartphone, apple: Apple, smartphones: Smartphone, gaming: Gamepad2, monitores: Monitor, componentes: Settings, acessorios: Headphones,
};
const categoryImages: Record<string, string> = {
  computadores: "/pc_01.png",
  iphone: "/conjunto de Iphone.png",
  apple: "/conjunto de Apple.png",
  smartphones: "/Iphone_15.png",
  gaming: "/game.png",
  monitores: "/monitor.png",
  componentes: "/Componentes.png",
  acessorios: "/Acessorio.png",
};

export default function HomePage() {
  const { market } = useMarket();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: "", location: "", text: "" });
  const [reviewMessage, setReviewMessage] = useState("");

  useEffect(() => {
    Promise.all([fetchWithAuth("/api/products?page=1&pageSize=100"), fetchWithAuth("/api/categories"), fetchWithAuth("/api/brands"), fetchWithAuth("/api/testimonials")])
      .then(([productResult, categoryResult, brandResult, reviewResult]) => { setProducts(productResult.data); setCategories(categoryResult.data); setBrands(brandResult.data); setTestimonials(reviewResult.data); })
      .catch(() => setError("Não foi possível carregar a loja. Verifique a ligação e tente novamente."))
      .finally(() => setLoading(false));
  }, []);

  const marketName = market === "AO" ? "Angola" : "Portugal";
  const marketCurrency = market === "AO" ? "Kz" : "€";
  const inStockProducts = products.filter((product) => product.stock > 0);
  const seenProductImages = new Set<string>();
  const distinctProducts = (inStockProducts.length ? inStockProducts : products)
    .filter((product) => {
      const imageKey = product.imageUrl || product.slug;
      if (seenProductImages.has(imageKey)) return false;
      seenProductImages.add(imageKey);
      return true;
    })
    .slice(0, 8);
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

  return <div className="bg-[#f4f6f5]">
    <section className="container mx-auto px-4 pb-3 pt-4 sm:pb-4 sm:pt-6">
      <div className="grid overflow-hidden rounded-[1.25rem] bg-[#edf3f0] md:grid-cols-[0.92fr_1.08fr]">
        <div className="flex flex-col items-start justify-center px-6 py-7 sm:px-10 sm:py-9 lg:px-14">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#087e76]">Angola <span className="mx-1 text-[#9caaa5]">/</span> Portugal</p>
          <h1 className="max-w-lg text-3xl font-bold leading-[1.12] tracking-tight text-[#172b29] sm:text-4xl lg:text-[2.8rem]">Tecnologia para o seu dia a dia.</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#52615d] sm:text-base">
            Computadores, telemóveis e acessórios para trabalho, estudo e lazer.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/products" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#087e76] px-5 text-sm font-bold text-white transition hover:bg-[#066a64] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087e76] focus-visible:ring-offset-2">
              Ver produtos <ArrowRight size={16} />
            </Link>
            <Link href="/promotions" className="text-sm font-semibold text-[#176b64] underline-offset-4 hover:underline">Ver ofertas</Link>
          </div>
        </div>
        <div className="relative min-h-[170px] bg-[#101b2b] sm:min-h-[230px] md:min-h-[330px]">
          <Image
            src="/banner_principal2.png"
            alt="Computadores, telemóvel e acessórios de tecnologia"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover object-center"
          />
        </div>
      </div>
    </section>

    <section className="container mx-auto px-4 pb-2 pt-1" aria-label="Informações de compra">
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        <Link href="/info/payments" className="group flex min-w-0 items-center gap-3 rounded-xl border border-[#e0e7e3] bg-white p-3.5 transition hover:border-[#b8d6cb] hover:bg-[#fbfdfc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087e76] sm:px-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eaf4f0] text-[#087e76]"><CreditCard size={17} /></span>
          <span className="min-w-0 flex-1"><strong className="block text-xs font-semibold text-[#263a36]">Pagamento em {marketName}</strong><span className="mt-0.5 block text-[11px] leading-4 text-[#71807c]">Opções para o mercado selecionado ({marketCurrency}).</span></span>
          <ChevronRight size={15} className="shrink-0 text-[#9aa7a2] transition group-hover:translate-x-0.5 group-hover:text-[#087e76]" />
        </Link>
        <Link href="/info/shipping" className="group flex min-w-0 items-center gap-3 rounded-xl border border-[#e0e7e3] bg-white p-3.5 transition hover:border-[#b8d6cb] hover:bg-[#fbfdfc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087e76] sm:px-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eaf4f0] text-[#087e76]"><Truck size={17} /></span>
          <span className="min-w-0 flex-1"><strong className="block text-xs font-semibold text-[#263a36]">Entrega para {marketName}</strong><span className="mt-0.5 block text-[11px] leading-4 text-[#71807c]">Consulta opções, custos e estimativas no checkout.</span></span>
          <ChevronRight size={15} className="shrink-0 text-[#9aa7a2] transition group-hover:translate-x-0.5 group-hover:text-[#087e76]" />
        </Link>
        <Link href="/info/returns" className="group flex min-w-0 items-center gap-3 rounded-xl border border-[#e0e7e3] bg-white p-3.5 transition hover:border-[#b8d6cb] hover:bg-[#fbfdfc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087e76] sm:px-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eaf4f0] text-[#087e76]"><RefreshCcw size={17} /></span>
          <span className="min-w-0 flex-1"><strong className="block text-xs font-semibold text-[#263a36]">Trocas e devoluções</strong><span className="mt-0.5 block text-[11px] leading-4 text-[#71807c]">Conhece o processo de apoio pós-compra.</span></span>
          <ChevronRight size={15} className="shrink-0 text-[#9aa7a2] transition group-hover:translate-x-0.5 group-hover:text-[#087e76]" />
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-[#71807c]">Confirma os detalhes da encomenda antes de concluir a compra.</p>
        <Link href="/register?accountType=B2B" className="inline-flex items-center gap-1 text-xs font-semibold text-[#087e76] hover:underline">
          Compras para empresas <ArrowRight size={14} />
        </Link>
      </div>
    </section>

    <section className="container mx-auto px-4 py-5 sm:py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#71807c]">Encontra o que precisas</p><h2 className="text-xl font-bold tracking-tight text-[#263a36] sm:text-2xl">Explorar categorias</h2></div>
        <Link href="/categories" className="text-xs font-semibold text-[#087e76] hover:underline">Ver todas <ChevronRight size={13} className="inline" /></Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:gap-3 lg:grid-cols-4">
        {categories.map((item) => {
          const Icon = categoryIcons[item.slug] || Package;
          return <Link key={item.id} href={`/products?category=${item.slug}`} className="group flex w-[116px] shrink-0 items-center gap-3 rounded-xl bg-white p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087e76] sm:w-auto">
            <span className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f4f7f5] text-[#087e76]">
              {categoryImages[item.slug]
                ? <Image src={categoryImages[item.slug]} alt="" fill sizes="58px" className="object-contain p-1.5 transition-transform duration-200 group-hover:scale-105" />
                : <Icon size={25} strokeWidth={1.7} />}
            </span>
            <span className="min-w-0">
              <strong className="block line-clamp-2 text-xs font-semibold leading-4 text-[#344743]">{item.name}</strong>
              <small className="mt-1 block text-[10px] text-[#87938f]">{item.productCount} {item.productCount === 1 ? "produto" : "produtos"}</small>
            </span>
          </Link>;
        })}
      </div>
    </section>

    <section className="storefront-featured-products container mx-auto px-4 py-8 sm:py-11">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:mb-6 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#087e76]">Escolhas da loja</p>
          <h2 className="text-xl font-bold tracking-tight text-[#263a36] sm:text-2xl">Produtos em destaque</h2>
          <p className="mt-1.5 text-xs leading-5 text-[#71807c] sm:text-sm">Tecnologia selecionada, pronta para o teu dia a dia.</p>
        </div>
        <Link href="/products" className="inline-flex min-h-9 w-fit items-center gap-1 rounded-lg border border-[#dce6e1] bg-white px-3 text-xs font-semibold text-[#176b64] transition hover:border-[#087e76] hover:bg-[#f5faf8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087e76]">
          Ver catálogo <ChevronRight size={14} />
        </Link>
      </div>
      {loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-80 animate-pulse rounded-2xl border border-[#e6ebe8] bg-white" />)}</div>
        : error ? <div className="rounded-xl bg-white p-8 text-center text-sm text-red-700">{error}</div>
          : distinctProducts.length ? <div className="storefront-featured-grid grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4">{distinctProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
            : <div className="rounded-xl bg-white p-8 text-center text-sm text-gray-500">Não existem produtos disponíveis de momento.</div>}
    </section>

    <section className="container mx-auto px-4 pb-8 sm:pb-11" aria-labelledby="collections-heading">
      <div className="mb-5">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#087e76]">Descobre por objetivo</p>
        <h2 id="collections-heading" className="text-xl font-bold tracking-tight text-[#263a36] sm:text-2xl">Encontra o que precisas</h2>
        <p className="mt-1.5 text-xs leading-5 text-[#71807c] sm:text-sm">Seleções organizadas para diferentes formas de usar a tecnologia.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {storefrontCollections.map((collection) => {
          const availableCount = inStockProducts.filter((product) => collection.categorySlugs.includes(product.category.slug)).length;
          if (!availableCount) return null;
          return <Link
            key={collection.slug}
            href={`/products?collection=${collection.slug}`}
            className="group relative flex min-h-40 items-center overflow-hidden rounded-2xl border border-[#e2eae6] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#b8d6cb] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087e76] sm:min-h-48 sm:p-5"
          >
            <span className="relative z-10 max-w-[70%]">
              <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-[#087e76]">{collection.eyebrow}</span>
              <strong className="mt-1.5 block text-sm font-bold leading-5 text-[#263a36] sm:text-base">{collection.title}</strong>
              <span className="mt-1.5 block text-[11px] leading-4 text-[#71807c]">{collection.description}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#087e76]">
                Explorar seleção <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-1 block text-[10px] text-[#87938f]">{availableCount} {availableCount === 1 ? "produto disponível" : "produtos disponíveis"}</span>
            </span>
            <Image src={collection.image} alt="" fill sizes="(max-width: 640px) 60vw, 30vw" className="object-contain object-right p-2 opacity-20 transition duration-200 group-hover:scale-[1.03] group-hover:opacity-30 sm:p-3" />
            <span className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/20" aria-hidden="true" />
          </Link>;
        })}
      </div>
    </section>

    <section className="border-y border-[#e6ebe8] bg-white py-7"><div className="container mx-auto px-4"><div className="mb-4 flex items-center justify-between"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#71807c]">Encontra a tua marca</p><h2 className="text-xl font-bold tracking-tight text-[#263a36]">Marcas disponíveis</h2></div><Link href="/products" className="text-xs font-semibold text-[#087e76]">Ver catálogo <ChevronRight size={13} className="inline" /></Link></div><div className="flex flex-wrap gap-2">{brands.map((brand) => <Link key={brand.id} href={`/products?brand=${brand.slug}`} className="rounded-full border border-[#e1e8e4] bg-white px-4 py-2 text-xs font-semibold text-[#52615d] transition hover:border-[#087e76] hover:bg-[#f6faf8] hover:text-[#087e76]">{brand.name}</Link>)}</div></div></section>

    <section className="container mx-auto px-4 py-8 sm:py-10"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#71807c]">Opiniões partilhadas</p><h2 className="text-xl font-bold tracking-tight text-[#263a36] sm:text-2xl">O que dizem os clientes</h2></div><button type="button" onClick={() => setReviewOpen((open) => !open)} className="rounded-lg border border-[#d9e2de] bg-white px-3 py-2 text-xs font-semibold text-[#087e76] hover:bg-[#e5f2ed]">Deixar avaliação</button></div>{testimonials.length ? <div className="grid gap-3 md:grid-cols-3">{testimonials.slice(0, 3).map((review) => <article key={review.id} className="rounded-xl border border-[#e6ebe8] bg-white p-5"><Stars count={review.stars} /><p className="mt-3 text-sm leading-6 text-[#52615d]">“{review.text}”</p><div className="mt-4 border-t border-[#edf1ef] pt-3"><strong className="block text-xs text-[#263a36]">{review.name}</strong><span className="text-[10px] text-[#71807c]">{review.location}</span></div></article>)}</div> : <p className="rounded-xl border border-[#e6ebe8] bg-white p-5 text-sm text-[#71807c]">Ainda não existem avaliações publicadas.</p>}{reviewOpen && <form onSubmit={submitReview} className="mt-4 rounded-xl border border-[#e6ebe8] bg-white p-5"><h3 className="mb-3 text-sm font-semibold text-[#263a36]">Partilhe a sua experiência</h3><div className="grid gap-3 sm:grid-cols-2"><input required minLength={2} value={reviewForm.name} onChange={(event) => setReviewForm({ ...reviewForm, name: event.target.value })} placeholder="Nome" className="rounded-lg border border-[#d9e2de] px-3 py-2.5 text-sm" /><input required minLength={2} value={reviewForm.location} onChange={(event) => setReviewForm({ ...reviewForm, location: event.target.value })} placeholder="Cidade, país" className="rounded-lg border border-[#d9e2de] px-3 py-2.5 text-sm" /></div><textarea required minLength={10} value={reviewForm.text} onChange={(event) => setReviewForm({ ...reviewForm, text: event.target.value })} placeholder="Escreva a sua avaliação" rows={3} className="mt-3 w-full rounded-lg border border-[#d9e2de] px-3 py-2.5 text-sm" /><div className="mt-3 flex flex-wrap items-center gap-3"><button className="rounded-lg bg-[#087e76] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#066a64]">Enviar avaliação</button>{reviewMessage && <span role="status" className="text-xs text-[#52615d]">{reviewMessage}</span>}</div></form>}</section>

    <section className="border-y border-[#e6ebe8] bg-white py-6"><div className="container mx-auto flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5f2ed] text-[#087e76]"><Mail size={19} /></span><span><strong className="block text-sm text-[#263a36]">Novidades e campanhas</strong><small className="text-xs text-[#71807c]">Recebe novidades e campanhas da loja no teu email.</small></span></div>{newsletterMessage ? <p role="status" className="text-sm font-semibold text-[#52615d]">{newsletterMessage}</p> : <form onSubmit={subscribe} className="flex w-full sm:w-auto"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="O teu email" className="min-w-0 flex-1 rounded-l-lg border border-[#d9e2de] px-3 py-2.5 text-sm sm:w-64" /><button disabled={newsletterLoading} className="rounded-r-lg bg-[#087e76] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#066a64] disabled:opacity-60">{newsletterLoading ? "A enviar..." : "Subscrever"}</button></form>}</div></section>
    <a href="https://wa.me/244940370723" target="_blank" rel="noreferrer" aria-label="Falar com suporte no WhatsApp" className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition-transform hover:scale-105"><MessageCircle size={23} /></a>
  </div>;
}
