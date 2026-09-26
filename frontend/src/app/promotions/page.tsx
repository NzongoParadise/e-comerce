"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, Clock3, Headphones, Heart, Package, ShieldCheck, ShoppingCart, Truck, Zap } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useMarket } from "@/context/MarketContext";

const promotionProducts = [
  { id: 1, name: "MacBook Air M3 13\"", category: "Computadores", specs: "8GB | 256GB | Space Gray", priceEUR: 1120, oldPriceEUR: 1400, image: "/Apple.jpg", rating: 4.8, reviews: 32 },
  { id: 2, name: "iPhone 15 128GB", category: "Smartphones", specs: "128GB | Titânio", priceEUR: 1020, oldPriceEUR: 1200, image: "/iPhone.jpg", rating: 4.7, reviews: 18 },
  { id: 3, name: "Dell Monitor 27\"", category: "Computadores", specs: "QHD | 75Hz", priceEUR: 280, oldPriceEUR: 400, image: "/Dell.jpg", rating: 4.6, reviews: 27 },
  { id: 4, name: "Sony WH-1000XM5", category: "Acessórios", specs: "Noise Cancelling", priceEUR: 360, oldPriceEUR: 480, image: "/Sony.jpg", rating: 4.8, reviews: 20 },
  { id: 5, name: "HP LaserJet Pro 4003dw", category: "Impressão", specs: "Impressora Wi-Fi | Duplex", priceEUR: 210, oldPriceEUR: 235, image: "/HP.jpg", rating: 4.5, reviews: 9 },
  { id: 6, name: "SSD Samsung 1TB", category: "Componentes", specs: "NVMe | 7.000 MB/s", priceEUR: 220, oldPriceEUR: 340, image: "/Samsung.jpg", rating: 4.7, reviews: 16 },
  { id: 7, name: "Teclado Mecânico RGB", category: "Acessórios", specs: "Switch Blue | USB", priceEUR: 85, oldPriceEUR: 110, image: "/ASUS.jpg", rating: 4.6, reviews: 14 },
  { id: 8, name: "Cadeira Gaming Pro", category: "Gaming", specs: "Ergonómica | Ajustável", priceEUR: 320, oldPriceEUR: 390, image: "/Dell.jpg", rating: 4.5, reviews: 11 },
];

const filters = ["Todas as promoções", "Computadores", "Smartphones", "Acessórios", "Componentes", "Outros"];

export default function PromotionsPage() {
  const { addToCart } = useCart();
  const { formatPrice, eurToKz } = useMarket();
  const [filter, setFilter] = useState("Todas as promoções");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const products = useMemo(() => filter === "Todas as promoções" || filter === "Outros"
    ? promotionProducts
    : promotionProducts.filter((product) => product.category === filter), [filter]);

  function addProduct(product: typeof promotionProducts[number]) {
    addToCart({ id: `promotion-${product.id}`, productId: product.id, name: product.name, slug: product.name.toLowerCase().replaceAll(" ", "-"), priceEUR: product.priceEUR, priceKZ: eurToKz(product.priceEUR), quantity: 1, imageUrl: product.image });
    setMessage(`${product.name} foi adicionado ao carrinho.`);
  }

  function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(email ? "Subscrição realizada com sucesso." : "Introduza o seu email.");
    if (email) setEmail("");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="mb-6 flex items-center gap-1 text-xs text-gray-400"><Link href="/" className="hover:text-[#1d6ac4]">Início</Link><span>›</span><span className="font-medium text-gray-700">Promoções</span></nav>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-black text-gray-900"><span className="text-[#e63946]">%</span> Ofertas e Promoções</h1><p className="mt-1 text-sm text-gray-500">Grandes oportunidades, a tecnologia que você quer, com os melhores preços.</p></div><div className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-xs font-bold text-red-700"><Clock3 size={18} /><span>Esta campanha termina em:<strong className="ml-2">02 dias 04h 36m</strong></span></div></div>
      <section className="relative mb-5 overflow-hidden rounded-xl bg-[#07111f] p-6 text-white sm:p-8"><img src="/banner_principal2.png" alt="Grandes descontos em tecnologia" className="absolute inset-0 h-full w-full object-cover opacity-70" /><div className="relative max-w-md"><p className="text-2xl font-black leading-none sm:text-3xl">GRANDES DESCONTOS</p><p className="mt-1 text-xl font-black text-[#facc15]">EM TECNOLOGIA</p><p className="mt-2 text-xs text-gray-200">Mais desempenho. Mais possibilidades. Mais por si.</p><Link href="#offers" className="mt-5 inline-flex rounded-lg bg-[#e63946] px-4 py-2 text-xs font-bold text-white hover:bg-[#c1121f]">Ver todas as ofertas</Link></div><div className="absolute right-8 top-1/2 hidden -translate-y-1/2 rounded-full bg-yellow-400 px-5 py-4 text-center font-black text-gray-900 sm:block"><span className="block text-3xl">40%</span><span className="text-[10px]">DESCONTO</span></div></section>

      {message && <div role="status" className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
      <div className="grid gap-8 lg:grid-cols-[1fr_230px]">
        <main id="offers"><div className="mb-5 flex gap-2 overflow-x-auto border-b border-gray-200 pb-2">{filters.map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${filter === item ? "bg-[#1d6ac4] text-white" : "text-gray-600 hover:bg-gray-100"}`}>{item}</button>)}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{products.map((product) => { const discount = Math.round((1 - product.priceEUR / product.oldPriceEUR) * 100); return <article key={product.id} className="card card-hover relative flex flex-col p-3"><span className="absolute left-3 top-3 z-10 rounded bg-[#e63946] px-2 py-1 text-[10px] font-black text-white">-{discount}%</span><button type="button" onClick={() => setFavorites((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} className={`absolute right-3 top-3 z-10 ${favorites.includes(product.id) ? "text-red-500" : "text-gray-400 hover:text-red-500"}`} aria-label={`Favoritar ${product.name}`}><Heart size={16} fill={favorites.includes(product.id) ? "currentColor" : "none"} /></button><Link href={`/products/${product.id}`} className="flex h-32 items-center justify-center rounded-lg bg-gray-50"><img src={product.image} alt={product.name} className="h-full w-full object-contain" /></Link><h2 className="mt-3 line-clamp-2 text-xs font-bold text-gray-900">{product.name}</h2><p className="mt-1 line-clamp-1 text-[10px] text-gray-500">{product.specs}</p><p className="mt-2 text-xs text-amber-500">★★★★★ <span className="text-gray-400">({product.reviews})</span></p><div className="mt-auto pt-2"><span className="text-[10px] text-gray-400 line-through">{formatPrice(product.oldPriceEUR)}</span><p className="text-base font-black text-gray-900">{formatPrice(product.priceEUR)}</p><p className="mb-2 text-[10px] font-semibold text-green-600">● Em stock</p><button type="button" onClick={() => addProduct(product)} className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[#1d6ac4] px-2 py-2 text-[10px] font-bold text-[#1d6ac4] hover:bg-blue-50"><ShoppingCart size={13} /> Adicionar ao carrinho</button></div></article>; })}</div></main>
        <aside className="space-y-4"><div className="card space-y-4 p-5"><Benefit icon={Truck} title="Entrega rápida" text="Em Luanda e nas principais províncias." /><Benefit icon={ShieldCheck} title="Pagamentos seguros" text="Multicaixa, MB WAY, cartão e transferência." /><Benefit icon={Package} title="Produtos originais" text="Garantia oficial das melhores marcas." /><Benefit icon={Headphones} title="Apoio especializado" text="Estamos aqui para o ajudar." /></div><div className="rounded-xl bg-indigo-600 p-5 text-white"><Zap size={22} /><h2 className="mt-2 font-bold">Ofertas da Semana</h2><p className="mt-1 text-xs text-indigo-100">Novas promoções seleccionadas todas as semanas.</p><Link href="#offers" className="mt-4 block rounded-lg bg-white px-3 py-2 text-center text-xs font-bold text-indigo-600">Ver promoções</Link></div><form onSubmit={subscribe} className="card p-5"><Bell size={20} className="text-[#1d6ac4]" /><h2 className="mt-2 font-bold text-gray-900">Receba ofertas exclusivas</h2><p className="mt-1 text-xs text-gray-500">Seja o primeiro a conhecer as nossas promoções.</p><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="O seu email" className="settings-input mt-4" /><button type="submit" className="btn-primary mt-3 w-full">Subscrever</button></form></aside>
      </div>
    </div>
  );
}

function Benefit({ icon: Icon, title, text }: { icon: typeof Truck; title: string; text: string }) { return <div className="flex gap-3"><Icon className="shrink-0 text-[#1d6ac4]" size={22} /><div><p className="text-xs font-bold text-gray-900">{title}</p><p className="text-[10px] leading-4 text-gray-500">{text}</p></div></div>; }

