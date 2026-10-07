"use client";

import Link from "next/link";
import { ArrowRight, Building2, FileText, HandCoins, Package, ShieldCheck, Users, WalletCards } from "lucide-react";

const capabilities = [
  { icon: Package, title: "Catálogo empresarial", text: "Consulte produtos, disponibilidade e condições comerciais num espaço próprio." },
  { icon: HandCoins, title: "Preços e volume", text: "Prepare compras em quantidade e solicite condições comerciais." },
  { icon: FileText, title: "Cotações", text: "Envie pedidos de cotação e acompanhe o estado de cada negociação." },
  { icon: WalletCards, title: "Encomendas e faturação", text: "Centralize encomendas, documentos e histórico financeiro da empresa." },
];

export default function B2BPage() {
  return (
    <main className="min-h-screen bg-[#f5f7fa]">
      <section className="bg-[#0c1b2a] text-white">
        <div className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-24">
          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-[#f6b73c]">RUBRICA DILIGENTE · B2B</p>
            <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">Tecnologia para empresas, com uma experiência de compra profissional.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-blue-100">Um espaço dedicado a empresas que precisam de comprar tecnologia com organização, acompanhamento comercial e condições adequadas ao volume.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register?accountType=B2B" className="inline-flex items-center gap-2 rounded-xl bg-[#f6b73c] px-5 py-3.5 text-sm font-black text-[#0c1b2a]">Criar conta empresarial <ArrowRight size={17} /></Link>
              <Link href="/products" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3.5 text-sm font-bold text-white hover:bg-white/10">Consultar catálogo</Link>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6b73c] text-[#0c1b2a]"><Building2 size={24} /></span>
              <div><p className="text-xs text-blue-200">Conta empresarial</p><p className="font-black">Gestão centralizada</p></div>
            </div>
            <div className="grid gap-3 pt-5 sm:grid-cols-2">
              {["Dados da empresa", "Utilizadores", "Pedidos de cotação", "Encomendas", "Documentos", "Condições comerciais"].map((item) => (
                <div key={item} className="rounded-xl bg-white/[0.05] px-4 py-3 text-sm font-semibold text-blue-50">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-14">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1d6ac4]">Experiência B2B</p>
          <h2 className="mt-2 text-3xl font-black text-[#0c1b2a]">Tudo o que a sua empresa precisa para comprar melhor.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {capabilities.map(({ icon: Icon, title, text }) => (
            <article key={title} className="border border-gray-200 bg-white p-5">
              <Icon size={23} className="text-[#1d6ac4]" />
              <h3 className="mt-5 text-base font-black text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-gray-200 bg-white">
        <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Segurança e controlo</p>
            <h2 className="mt-2 text-2xl font-black text-gray-900">Uma conta empresarial, vários utilizadores e histórico centralizado.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">A experiência B2B é separada da compra de consumidor final, mas utiliza o mesmo catálogo, operação e núcleo financeiro da plataforma.</p>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold text-gray-700"><ShieldCheck className="text-[#1d6ac4]" size={22} /> <Users size={22} className="text-[#1d6ac4]" /> Gestão empresarial</div>
        </div>
      </section>
    </main>
  );
}
