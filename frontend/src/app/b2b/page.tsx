"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Building2, CheckCircle2, Clock3, FileText, Package, Plus, ShoppingBag, Users, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api";

type Dashboard = {
  company: { legalName: string; tradeName?: string | null; nif: string; status: string };
  role: string;
  metrics: { quotesPending: number; openOrders: number; purchaseOrdersPending: number; totalOrders: number; totalEUR: number; priceRules: number };
  quotes: Array<{ id: number; quoteNumber: string; status: string; createdAt: string }>;
  orders: Array<{ id: number; orderNumber: string; status: string; totalEUR: number | string; createdAt: string }>;
  purchaseOrders: Array<{ id: number; poNumber: string; status: string; orderId?: number | null; createdAt: string }>;
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Empresa ativa",
  PENDING: "Em homologação",
  REJECTED: "Homologação recusada",
  SUSPENDED: "Conta suspensa",
};

const orderStatus: Record<string, string> = {
  PENDING: "Pendente",
  AWAITING_PAYMENT: "A aguardar pagamento",
  PROCESSING: "Em processamento",
  SHIPPED: "Enviada",
  DELIVERED: "Entregue",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const quoteStatus: Record<string, string> = {
  PENDING: "Em análise",
  REVIEW: "Em revisão",
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
  CONVERTED: "Convertida",
};

export default function B2BPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/auth/me")
      .then(() => fetchWithAuth("/api/b2b/dashboard"))
      .then((response) => { if (active) setData(response.data ?? null); })
      .catch(() => { if (active) setGuest(true); });
    return () => { active = false; };
  }, []);

  if (guest) {
    return (
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
            {[["Catálogo empresarial", "Consulte produtos e condições comerciais."], ["Cotações", "Envie pedidos de cotação para compras maiores."], ["Gestão", "Organize utilizadores, encomendas e dados da empresa."]].map(([title, detail]) => (
              <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-black text-gray-900">{title}</p>
                <p className="mt-2 text-xs leading-5 text-gray-500">{detail}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div>
        <button type="button" onClick={() => window.location.reload()} className="btn-primary">Tentar novamente</button>
      </div>
    );
  }

  if (!data) {
    return <div className="grid gap-3 md:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="card h-28 animate-pulse" />)}</div>;
  }

  const active = data.company.status === "ACTIVE";
  const cards: Array<{ label: string; value: number | string; detail: string; Icon: LucideIcon; href: string; tone: string }> = [
    { label: "Cotações pendentes", value: data.metrics.quotesPending, detail: "Aguardam tratamento", Icon: FileText, href: "/b2b/cotacoes", tone: "bg-blue-50 text-[#1d6ac4]" },
    { label: "Encomendas abertas", value: data.metrics.openOrders, detail: "Em execução", Icon: ShoppingBag, href: "/b2b/encomendas", tone: "bg-violet-50 text-violet-700" },
    { label: "POs por processar", value: data.metrics.purchaseOrdersPending, detail: "Ações pendentes", Icon: WalletCards, href: "/b2b/encomendas", tone: "bg-amber-50 text-amber-700" },
    { label: "Volume comprado", value: "€ " + data.metrics.totalEUR.toFixed(2), detail: data.metrics.totalOrders + " encomenda(s) no histórico", Icon: Package, href: "/b2b/financeiro", tone: "bg-emerald-50 text-emerald-700" },
  ];

  const recentOrders = useMemo(
    () => [...data.orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5),
    [data.orders],
  );

  const recentQuotes = useMemo(
    () => [...data.quotes].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 4),
    [data.quotes],
  );

  return (
    <div className="space-y-6 pb-8">
      <header className="relative overflow-hidden rounded-3xl bg-[#0c1b2a] p-6 text-white shadow-[0_18px_50px_rgba(12,27,42,.16)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#1d6ac4]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 h-40 w-40 rounded-full bg-[#f6b73c]/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f6b73c]">RUBRICA DILIGENTE · CENTRO DE NEGÓCIOS</p>
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[9px] font-bold text-blue-100">{data.role}</span>
            </div>
            <h1 className="mt-2 truncate text-2xl font-black tracking-tight sm:text-3xl">{data.company.tradeName || data.company.legalName}</h1>
            <p className="mt-2 text-xs text-blue-100 sm:text-sm">NIF {data.company.nif} · compras empresariais, cotações e encomendas num único espaço.</p>
          </div>
          <span className={"inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black " + (active ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200")}>
            {active ? <CheckCircle2 size={14}/> : <Clock3 size={14}/>} {statusLabel[data.company.status] || data.company.status}
          </span>
        </div>
        {!active && <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-blue-100">A conta pode preparar os dados e cotações, mas as compras empresariais ficam condicionadas à homologação administrativa.</div>}
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, Icon, href, tone }) => (
          <Link key={label} href={href} className="group card p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <span className={"flex h-10 w-10 items-center justify-center rounded-xl " + tone}><Icon size={18}/></span>
              <ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#1d6ac4]" />
            </div>
            <p className="mt-4 text-[10px] font-bold text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{String(value)}</p>
            <p className="mt-1 text-[9px] text-slate-400">{detail}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div><p className="section-kicker">Atividade recente</p><h2 className="mt-1 text-base font-black text-slate-950">Encomendas</h2></div>
            <Link href="/b2b/encomendas" className="inline-flex items-center gap-1 text-[10px] font-black text-[#1d6ac4] hover:underline">Ver tudo <ArrowRight size={13}/></Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentOrders.length ? recentOrders.map((order) => (
              <Link key={order.id} href="/b2b/encomendas" className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><ShoppingBag size={17}/></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-slate-900">{order.orderNumber}</span>
                  <span className="mt-1 block text-[9px] text-slate-500">{new Date(order.createdAt).toLocaleDateString("pt-PT")}</span>
                </span>
                <span className="text-right">
                  <span className="block text-xs font-black text-slate-900">€ {Number(order.totalEUR).toFixed(2)}</span>
                  <span className="mt-1 block text-[9px] font-bold text-slate-500">{orderStatus[order.status] || order.status}</span>
                </span>
              </Link>
            )) : (
              <div className="p-10 text-center"><ShoppingBag size={28} className="mx-auto text-slate-300"/><p className="mt-3 text-xs font-bold text-slate-700">Ainda não existem encomendas.</p><p className="mt-1 text-[10px] text-slate-400">As compras convertidas a partir das cotações aparecerão aqui.</p></div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div><p className="section-kicker">Ações rápidas</p><h2 className="mt-1 text-base font-black text-slate-950">Começar uma operação</h2></div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1d6ac4]"><Plus size={17}/></span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <Link href="/b2b/catalogo" className="flex items-center justify-between rounded-xl bg-[#0c1b2a] px-4 py-3 text-xs font-black text-white hover:bg-[#132238]"><span className="flex items-center gap-2"><ShoppingBag size={15}/> Comprar no catálogo</span><ArrowRight size={14}/></Link>
              <Link href="/b2b/cotacoes" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-800 hover:border-blue-200 hover:text-[#1d6ac4]"><span className="flex items-center gap-2"><FileText size={15}/> Pedir cotação</span><ArrowRight size={14}/></Link>
              <Link href="/b2b/empresa" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-800 hover:border-blue-200 hover:text-[#1d6ac4]"><span className="flex items-center gap-2"><Building2 size={15}/> Gerir empresa</span><ArrowRight size={14}/></Link>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="section-kicker">Cotações</p><h2 className="mt-1 text-base font-black text-slate-950">Acompanhamento comercial</h2></div>
              <Link href="/b2b/cotacoes" className="text-[10px] font-black text-[#1d6ac4] hover:underline">Abrir</Link>
            </div>
            <div className="mt-4 space-y-2">
              {recentQuotes.length ? recentQuotes.map((quote) => (
                <Link key={quote.id} href="/b2b/cotacoes" className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 transition hover:border-blue-100 hover:bg-blue-50/40">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1d6ac4]"><FileText size={14}/></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-900">{quote.quoteNumber}</span><span className="mt-1 block text-[9px] text-slate-500">{new Date(quote.createdAt).toLocaleDateString("pt-PT")}</span></span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-600">{quoteStatus[quote.status] || quote.status}</span>
                </Link>
              )) : <p className="py-5 text-center text-[10px] text-slate-400">Nenhuma cotação registada.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Preços empresariais</p><p className="mt-2 text-xl font-black text-slate-950">{data.metrics.priceRules}</p><p className="mt-1 text-[10px] text-slate-500">Regras de preço disponíveis para a sua empresa.</p></div>
          <div className="border-t border-slate-100 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Total de encomendas</p><p className="mt-2 text-xl font-black text-slate-950">{data.metrics.totalOrders}</p><p className="mt-1 text-[10px] text-slate-500">Compras registadas no histórico da empresa.</p></div>
          <div className="border-t border-slate-100 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Gestão de equipa</p><p className="mt-2 text-xl font-black text-slate-950"><Users size={19} className="mr-1 inline align-[-3px]"/> Equipa</p><p className="mt-1 text-[10px] text-slate-500">Papéis e membros podem ser geridos em Utilizadores.</p></div>
        </div>
      </section>
    </div>
  );
}
