"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Building2, CheckCircle2, FileText, Package, ShoppingBag, Users, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";

type Dashboard = {
  company: { legalName: string; tradeName?: string | null; nif: string; status: string };
  role: string;
  metrics: { quotesPending: number; openOrders: number; purchaseOrdersPending: number; totalOrders: number; totalEUR: number; priceRules: number };
  quotes: Array<{ id: number; quoteNumber: string; status: string; createdAt: string }>;
  orders: Array<{ id: number; orderNumber: string; status: string; totalEUR: number | string; createdAt: string }>;
  purchaseOrders: Array<{ id: number; poNumber: string; status: string; orderId?: number | null; createdAt: string }>;
};

export default function B2BPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/auth/me")
      .then(() => fetchWithAuth("/api/b2b/dashboard"))
      .then((r) => { if (active) setData(r.data ?? null); })
      .catch(() => { if (active) setGuest(true); })
    return () => { active = false; };
  }, []);

  if (guest) return (
    <main className="bg-transparent">
      <section className="container mx-auto grid gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative overflow-hidden rounded-[28px] bg-[#132238] p-7 text-white shadow-sm sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(246,183,60,0.24),transparent_35%)]" />
          <div className="relative max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f6b73c]">RUBRICA DILIGENTE · PARA EMPRESAS</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">Compre tecnologia para a sua empresa com condições B2B.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">Catálogo empresarial, pedidos de cotação, preços negociados e acompanhamento de encomendas num único espaço.</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link href="/register?accountType=B2B" className="inline-flex items-center gap-2 rounded-xl bg-[#f6b73c] px-5 py-3 text-sm font-black text-[#132238] hover:bg-[#ffd166]">Criar conta empresarial <ArrowRight size={16}/></Link>
              <Link href="/login?next=/b2b" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Entrar</Link>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[["Catálogo empresarial", "Consulte produtos e condições comerciais."], ["Cotações", "Envie pedidos de cotação para compras maiores."], ["Gestão", "Organize utilizadores, encomendas e dados da empresa."]].map(([title, detail]) => <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm font-black text-gray-900">{title}</p><p className="mt-2 text-xs leading-5 text-gray-500">{detail}</p></div>)}
        </div>
      </section>
    </main>
  );

  if (error) return <main className="container mx-auto px-4 py-12"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-700">{error}</div></main>;

  if (!data) return <main className="container mx-auto px-4 py-12"><div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map((i)=><div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200" />)}</div></main>;

  const active = data.company.status === "ACTIVE";
  const statusLabel = { ACTIVE: "Empresa ativa", PENDING: "Em homologação", REJECTED: "Homologação recusada", SUSPENDED: "Conta suspensa" }[data.company.status] || data.company.status;
  const cards: { label: string; value: number | string; Icon: LucideIcon; href: string }[] = [
    { label: "Cotações pendentes", value: data.metrics.quotesPending, Icon: FileText, href: "/b2b/cotacoes" },
    { label: "Encomendas abertas", value: data.metrics.openOrders, Icon: ShoppingBag, href: "/b2b/encomendas" },
    { label: "POs por processar", value: data.metrics.purchaseOrdersPending, Icon: WalletCards, href: "/b2b/encomendas" },
    { label: "Volume comprado", value: `€ ${data.metrics.totalEUR.toFixed(2)}`, Icon: Package, href: "/b2b/encomendas" },
  ];

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-8 rounded-3xl bg-[#0c1b2a] p-7 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f6b73c]">RUBRICA DILIGENTE · B2B</p>
            <h1 className="mt-2 text-3xl font-black">{data.company.tradeName || data.company.legalName}</h1>
            <p className="mt-2 text-sm text-blue-100">NIF {data.company.nif} · Perfil {data.role}</p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black ${active ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>
            {active ? <CheckCircle2 size={15}/> : <Building2 size={15}/>} {statusLabel}
          </span>
        </div>
        {!active && <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-blue-100">A conta pode preparar os dados, mas as compras empresariais ficam disponíveis depois da homologação administrativa.</div>}
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, Icon, href }) => (
          <Link key={label} href={href} className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-gray-500">{label}</span><Icon size={18} className="text-[#1d6ac4]"/></div>
            <p className="mt-3 text-2xl font-black text-[#0c1b2a]">{String(value)}</p>
          </Link>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Atividade</p><h2 className="mt-1 text-lg font-black">Últimas operações</h2></div><Link href="/b2b/encomendas" className="text-xs font-black text-[#1d6ac4]">Ver tudo</Link></div>
          <div className="mt-5 divide-y">
            {data.orders.map((o) => <div key={o.id} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-black">{o.orderNumber}</p><p className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString("pt-PT")}</p></div><div className="text-right"><p className="text-sm font-black">€ {Number(o.totalEUR).toFixed(2)}</p><p className="text-[11px] font-bold text-gray-500">{o.status}</p></div></div>)}
            {!data.orders.length && <p className="py-8 text-center text-sm text-gray-500">Ainda não existem encomendas.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Conta empresarial</p>
          <h2 className="mt-1 text-lg font-black">Capacidade de compra</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between rounded-xl bg-gray-50 p-3"><span>Preços empresariais</span><strong>{data.metrics.priceRules}</strong></div>
            <div className="flex justify-between rounded-xl bg-gray-50 p-3"><span>Total de encomendas</span><strong>{data.metrics.totalOrders}</strong></div>
          </div>
          <div className="mt-5 grid gap-2">
            <Link href="/b2b/catalogo" className="inline-flex items-center justify-between rounded-xl bg-[#0c1b2a] px-4 py-3 text-xs font-black text-white">Abrir catálogo <ArrowRight size={15}/></Link>
            <Link href="/b2b/empresa" className="inline-flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-black">Gerir empresa <Users size={15}/></Link>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Pedidos de cotação</p><h2 className="mt-1 text-lg font-black">Acompanhamento comercial</h2></div><Link href="/b2b/cotacoes" className="text-xs font-black text-[#1d6ac4]">Abrir cotações</Link></div>
        <div className="mt-4 flex flex-wrap gap-2">{data.quotes.map(q=><span key={q.id} className="rounded-xl border px-3 py-2 text-xs font-bold">{q.quoteNumber} · {q.status}</span>)}</div>
        {!data.quotes.length && <p className="mt-4 text-sm text-gray-500">Nenhuma cotação registada.</p>}
      </section>
    </main>
  );
}
