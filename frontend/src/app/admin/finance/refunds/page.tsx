"use client";

import { FormEvent, useEffect, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Refund = { id:number; orderId:number; amountEUR:string; amountKZ:string; currency:string; reason:string; status:string; provider:string; failureReason?:string|null; createdAt:string; order:{orderNumber:string} };

export default function RefundsPage() {
  const [items,setItems]=useState<Refund[]>([]);
  const [orderId,setOrderId]=useState("");
  const [amount,setAmount]=useState("");
  const [reason,setReason]=useState("");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){ setLoading(true); const r=await fetchWithAuth("/api/admin/finance/refunds"); if(r.ok) setItems((await r.json()).data); setLoading(false); }
  useEffect(()=>{void load()},[]);

  async function submit(e:FormEvent){
    e.preventDefault(); setMessage("");
    const r=await fetchWithAuth("/api/admin/finance/refunds",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:Number(orderId),amount:Number(amount),reason})});
    const body=await r.json().catch(()=>({}));
    if(!r.ok){setMessage(body?.error||"Não foi possível processar o reembolso.");return}
    setMessage(body?.data?.status==="SUCCEEDED"?"Reembolso processado com sucesso.":"Reembolso registado.");
    setOrderId("");setAmount("");setReason("");void load();
  }

  return <section className="space-y-6">
    <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#1555d8]">Financeiro</p><h1 className="mt-1 text-2xl font-black">Reembolsos</h1><p className="mt-1 text-sm text-gray-500">Registo, processamento e rastreabilidade de reembolsos. Stripe é processado automaticamente; outros gateways ficam pendentes para execução manual.</p></div>
    <form onSubmit={submit} className="grid gap-3 border border-gray-200 bg-white p-5 sm:grid-cols-4">
      <input value={orderId} onChange={e=>setOrderId(e.target.value)} placeholder="ID da encomenda" type="number" required className="border border-gray-200 px-3 py-2 text-sm"/>
      <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Valor" type="number" step="0.01" min="0.01" required className="border border-gray-200 px-3 py-2 text-sm"/>
      <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Motivo do reembolso" minLength={8} required className="border border-gray-200 px-3 py-2 text-sm"/>
      <button disabled={loading} className="inline-flex items-center justify-center gap-2 bg-[#1555d8] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><RotateCcw size={15}/>Processar</button>
    </form>
    {message && <div className="border border-gray-200 bg-white p-3 text-sm">{message}</div>}
    <div className="flex items-center justify-between"><h2 className="font-black">Histórico</h2><button onClick={()=>void load()} className="inline-flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 text-xs font-bold"><RefreshCw size={14}/>Atualizar</button></div>
    <div className="overflow-x-auto border border-gray-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="border-b bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Encomenda</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Gateway</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Motivo</th></tr></thead><tbody className="divide-y">{items.map(item=><tr key={item.id}><td className="px-4 py-3 font-bold">{item.order.orderNumber}</td><td className="px-4 py-3">{Number(item.currency==="EUR"?item.amountEUR:item.amountKZ).toLocaleString("pt-PT",{minimumFractionDigits:2})} {item.currency}</td><td className="px-4 py-3">{item.provider}</td><td className="px-4 py-3 font-bold">{item.status}</td><td className="px-4 py-3 text-gray-600">{item.reason}{item.failureReason ? ` — ${item.failureReason}` : ""}</td></tr>)}</tbody></table>{items.length===0&&<div className="p-8 text-center text-sm text-gray-500">Nenhum reembolso registado.</div>}</div>
  </section>
}
