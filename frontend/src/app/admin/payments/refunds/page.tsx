"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

export default function StripeRefundsPage() {
  const [data,setData]=useState<Array<{id:number;stripeRefundId:string;amount:number;currency:string;status:string;reason?:string|null;failureReason?:string|null;createdAt:string;payment:{id:number;stripePaymentIntentId?:string|null;order:{orderNumber:string}}}>>([]);
  const [error,setError]=useState("");
  useEffect(()=>{fetchWithAuth("/api/admin/refunds").then(r=>setData(r.data)).catch(e=>setError(e instanceof Error?e.message:"Erro"));},[]);
  return <main className="mx-auto max-w-6xl p-6"><Link href="/admin/payments" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={14}/>Pagamentos Stripe</Link><div className="mt-5"><h1 className="text-2xl font-black">Reembolsos Stripe</h1><p className="mt-1 text-xs text-gray-500">Histórico imutável dos reembolsos registados pelo sistema.</p></div>{error&&<p className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-5 overflow-x-auto border bg-white"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-gray-50 text-[10px] uppercase text-gray-500"><tr><th className="p-3">Reembolso</th><th>Pedido</th><th>Valor</th><th>Estado</th><th>Motivo</th><th>PaymentIntent</th><th>Data</th></tr></thead><tbody>{data.map(r=><tr key={r.id} className="border-t"><td className="p-3 font-mono">{r.stripeRefundId}</td><td className="font-bold">{r.payment.order.orderNumber}</td><td>{r.currency.toUpperCase()} {(r.amount/100).toFixed(2)}</td><td>{r.status}</td><td>{r.reason||r.failureReason||"—"}</td><td className="font-mono text-[10px]">{r.payment.stripePaymentIntentId||"—"}</td><td>{new Date(r.createdAt).toLocaleString("pt-PT")}</td></tr>)}</tbody></table>{!data.length&&<p className="p-6 text-center text-xs text-gray-500">Sem reembolsos registados.</p>}</div></main>;
}
