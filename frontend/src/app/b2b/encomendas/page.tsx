"use client";

import Link from "next/link";
import { Package, ShoppingBag } from "lucide-react";

const orders = [
  { ref: "EN-2026-1042", date: "06/10/2026", total: "€ 1.250,00", status: "Em processamento" },
  { ref: "EN-2026-0981", date: "29/09/2026", total: "€ 740,00", status: "Concluída" },
];

export default function B2BOrdersPage() {
  return <main className="container mx-auto px-4 py-8">
    <div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#1d6ac4]">B2B · Operação</p><h1 className="mt-1 text-3xl font-black text-[#0c1b2a]">Encomendas empresariais</h1><p className="mt-2 text-sm text-gray-500">Acompanhe encomendas, estados e histórico de compras da empresa.</p></div>
    <div className="grid gap-4 md:grid-cols-3 mb-6"><div className="border bg-white p-5"><p className="text-xs font-bold text-gray-500">Em processamento</p><p className="mt-2 text-3xl font-black">1</p></div><div className="border bg-white p-5"><p className="text-xs font-bold text-gray-500">Concluídas</p><p className="mt-2 text-3xl font-black">1</p></div><div className="border bg-white p-5"><p className="text-xs font-bold text-gray-500">Volume histórico</p><p className="mt-2 text-3xl font-black">€ 1.990</p></div></div>
    <div className="overflow-hidden border bg-white"><div className="grid grid-cols-4 gap-4 border-b bg-gray-50 px-5 py-3 text-[11px] font-black uppercase tracking-wide text-gray-500"><span>Referência</span><span>Data</span><span>Total</span><span>Estado</span></div>{orders.map(o=><div key={o.ref} className="grid grid-cols-4 gap-4 border-b px-5 py-4 text-sm last:border-0"><span className="font-black">{o.ref}</span><span className="text-gray-500">{o.date}</span><span className="font-bold">{o.total}</span><span className="text-gray-600">{o.status}</span></div>)}</div>
    <div className="mt-6 flex flex-wrap gap-3"><Link href="/b2b/catalogo" className="inline-flex items-center gap-2 rounded-xl bg-[#0c1b2a] px-4 py-3 text-xs font-black text-white"><ShoppingBag size={15}/> Continuar a comprar</Link><Link href="/account" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-black text-gray-700"><Package size={15}/> Conta</Link></div>
  </main>;
}
