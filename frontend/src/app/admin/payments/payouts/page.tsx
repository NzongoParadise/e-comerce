"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
export default function StripePayoutsPage(){
 const [data,setData]=useState<any[]>([]); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 async function load(sync=false){setBusy(true);try{const r=await fetchWithAuth(`/api/admin/payouts${sync?"?sync=1":""}`);setData(r.data);}catch(e){setError(e instanceof Error?e.message:"Erro")}finally{setBusy(false)}}
 useEffect(()=>{void load()},[]);
 return <main className="mx-auto max-w-6xl p-6"><div className="flex items-center justify-between"><Link href="/admin/payments" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={14}/>Pagamentos</Link><button onClick={()=>void load(true)} disabled={busy} className="inline-flex items-center gap-2 border bg-white px-3 py-2 text-xs font-bold"><RefreshCw size={14}/>Sincronizar</button></div><h1 className="mt-4 text-2xl font-black">Payouts Stripe</h1>{error&&<p className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 overflow-x-auto border bg-white"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-gray-50 text-[10px] uppercase text-gray-500"><tr><th className="p-3">Payout</th><th>Valor</th><th>Estado</th><th>Data de chegada</th><th>Criado</th></tr></thead><tbody>{data.map(p=><tr key={p.stripePayoutId} className="border-t"><td className="p-3 font-mono">{p.stripePayoutId}</td><td>{p.currency.toUpperCase()} {(p.amount/100).toFixed(2)}</td><td>{p.status}</td><td>{p.arrivalDate?new Date(p.arrivalDate).toLocaleDateString("pt-PT"):"—"}</td><td>{new Date(p.createdAt).toLocaleString("pt-PT")}</td></tr>)}</tbody></table>{!data.length&&<p className="p-6 text-center text-xs text-gray-500">Sem payouts sincronizados.</p>}</div></main>
}