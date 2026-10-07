"use client";

import { FileText, Plus, Search } from "lucide-react";
import { useState } from "react";

type Quote = { id: string; reference: string; description: string; status: string; date: string };

const demoQuotes: Quote[] = [
  { id: "1", reference: "COT-2026-001", description: "Equipamentos informáticos para empresa", status: "Em análise", date: "06/10/2026" },
  { id: "2", reference: "COT-2026-002", description: "Consumíveis e acessórios", status: "Respondida", date: "02/10/2026" },
];

export default function B2BQuotesPage() {
  const [query, setQuery] = useState("");
  const filtered = demoQuotes.filter(q => (q.reference + q.description).toLowerCase().includes(query.toLowerCase()));
  return <main className="container mx-auto px-4 py-8">
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#1d6ac4]">B2B · Comercial</p><h1 className="mt-1 text-3xl font-black text-[#0c1b2a]">Pedidos de cotação</h1><p className="mt-2 text-sm text-gray-500">Centralize pedidos, respostas e condições comerciais.</p></div>
      <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0c1b2a] px-4 py-3 text-xs font-black text-white"><Plus size={15}/> Nova cotação</button>
    </div>
    <div className="mb-5 flex items-center gap-3 border border-gray-200 bg-white px-4 py-3"><Search size={17} className="text-gray-400"/><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full outline-none text-sm" placeholder="Pesquisar por referência ou descrição..."/></div>
    <div className="overflow-hidden border border-gray-200 bg-white"><div className="grid grid-cols-[1.1fr_2fr_1fr_1fr] gap-4 border-b bg-gray-50 px-5 py-3 text-[11px] font-black uppercase tracking-wide text-gray-500"><span>Referência</span><span>Descrição</span><span>Estado</span><span>Data</span></div>
      {filtered.map(q=><div key={q.id} className="grid grid-cols-[1.1fr_2fr_1fr_1fr] gap-4 border-b px-5 py-4 text-sm last:border-0"><span className="font-black text-[#0c1b2a]">{q.reference}</span><span className="text-gray-600">{q.description}</span><span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{q.status}</span></span><span className="text-gray-500">{q.date}</span></div>)}
      {!filtered.length && <div className="p-10 text-center text-sm text-gray-500"><FileText className="mx-auto mb-2 text-gray-300"/>Nenhum pedido encontrado.</div>}
    </div>
  </main>;
}
