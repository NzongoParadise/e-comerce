"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
export default function StripeDisputesPage(){
 const [data,setData]=useState<any[]>([]); const [error,setError]=useState("");
 useEffect(()=>{fetchWithAuth("/api/admin/disputes").then(r=>setData(r.data)).catch(e=>setError(e instanceof Error?e.message:"Erro"));},[]);
 return <main className="mx-auto max-w-6xl p-6"><Link href="/admin/payments" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={14}/>Pagamentos</Link><h1 className="mt-4 text-2xl font-black">Disputas Stripe</h1>{error&&<p className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 overflow-x-auto border bg-white"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-gray-50 text-[10px] uppercase text-gray-500"><tr><th className="p-3">Disputa</th><th>Pedido</th><th>Valor</th><th>Motivo</th><th>Estado</th><th>Data</th></tr></thead><tbody>{data.map(d=><tr key={d.stripeDisputeId} className="border-t"><td className="p-3 font-mono">{d.stripeDisputeId}</td><td>{d.payment.order.orderNumber}</td><td>{d.currency.toUpperCase()} {(d.amount/100).toFixed(2)}</td><td>{d.reason||"—"}</td><td>{d.status}</td><td>{new Date(d.createdAt).toLocaleString("pt-PT")}</td></tr>)}</tbody></table>{!data.length&&<p className="p-6 text-center text-xs text-gray-500">Sem disputas registadas.</p>}</div></main>
}