"use client";
import {useEffect,useState} from "react";
import {ArrowUpRight,CheckCircle2,Clock3,RefreshCw,XCircle} from "lucide-react";
import {fetchWithAuth} from "@/lib/api";

type Payment={id:number;status:string;method:string;currency:string;amountEUR:string|number;paidAt?:string|null;createdAt:string;order:{orderNumber:string;status:string}};
export default function B2BFinancePage(){
 const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setLoading(true);setError("");try{const r=await fetchWithAuth("/api/b2b/finance");setData(r.data)}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar o financeiro empresarial")}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 if(loading)return <main className="container mx-auto px-4 py-10"><div className="h-32 animate-pulse rounded-2xl bg-gray-200"/></main>;
 if(error)return <main className="container mx-auto px-4 py-10"><div className="rounded-2xl bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div></main>;
 return <main className="container mx-auto px-4 py-8">
  <div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1d6ac4]">B2B · Financeiro</p><h1 className="mt-1 text-3xl font-black text-[#0c1b2a]">Financeiro empresarial</h1><p className="mt-2 text-sm text-gray-500">{data.company.tradeName||data.company.legalName} · NIF {data.company.nif}</p></div><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-black"><RefreshCw size={14}/> Atualizar</button></div>
  <section className="grid gap-4 md:grid-cols-3">
   <div className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold text-gray-500">Pago</p><p className="mt-2 text-2xl font-black">€ {Number(data.totals.paid).toFixed(2)}</p></div>
   <div className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold text-gray-500">Pendente</p><p className="mt-2 text-2xl font-black">€ {Number(data.totals.pending).toFixed(2)}</p></div>
   <div className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold text-gray-500">Falhado/cancelado</p><p className="mt-2 text-2xl font-black">€ {Number(data.totals.failed).toFixed(2)}</p></div>
  </section>
  <section className="mt-7 overflow-hidden rounded-2xl border bg-white">
   <div className="border-b px-5 py-4"><h2 className="font-black">Histórico financeiro</h2><p className="mt-1 text-xs text-gray-500">Todos os pagamentos da empresa, ligados às encomendas.</p></div>
   {data.payments.map((p:Payment)=><div key={p.id} className="grid gap-3 border-b px-5 py-4 md:grid-cols-[1.3fr_.8fr_.8fr_1fr] md:items-center last:border-0">
    <div><p className="text-sm font-black">{p.order.orderNumber}</p><p className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleString("pt-PT")}</p></div>
    <div className="font-black">€ {Number(p.amountEUR).toFixed(2)}</div>
    <div className="text-xs font-bold text-gray-500">{p.method}</div>
    <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black">{p.status==="PAID"?<CheckCircle2 size={12}/>:p.status==="FAILED"?<XCircle size={12}/>:<Clock3 size={12}/>} {p.status}</span>{p.status==="PAID"&&<ArrowUpRight size={15}/>}</div>
   </div>)}
   {!data.payments.length&&<div className="p-10 text-center text-sm text-gray-500">Ainda não existem pagamentos empresariais.</div>}
  </section>
 </main>
}