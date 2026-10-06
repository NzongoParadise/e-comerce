"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Data = {
  summary: { checked: number; anomalies: number; high: number; medium: number; paid: number; pending: number; failed: number };
  anomalies: { paymentId: number; orderNumber: string; severity: "HIGH" | "MEDIUM"; code: string; message: string }[];
  checkedAt: string;
};

export default function ReconciliationPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const response = await fetchWithAuth("/api/admin/finance/reconciliation");
    if (response.ok) setData((await response.json()).data);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  return <section className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#1555d8]">Controlo financeiro</p><h1 className="mt-1 text-2xl font-black">Conciliação</h1><p className="mt-1 text-sm text-gray-500">Compara o estado interno dos pagamentos com os eventos recebidos dos gateways.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 border border-gray-200 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/>Atualizar</button>
    </div>
    {data && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[["Pagamentos verificados", data.summary.checked], ["PAID", data.summary.paid], ["Pendentes", data.summary.pending], ["Falhados", data.summary.failed], ["Anomalias", data.summary.anomalies]].map(([label, value]) => <div key={String(label)} className="border border-gray-200 bg-white p-4"><div className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>)}
    </div>
    <div className="border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3"><ShieldAlert size={17}/><strong>Anomalias para revisão</strong></div>
      {data.anomalies.length === 0 ? <div className="flex items-center gap-2 p-6 text-sm text-emerald-700"><CheckCircle2 size={18}/>Nenhuma anomalia encontrada nos últimos pagamentos verificados.</div> :
        <div className="divide-y">{data.anomalies.map((item, index) => <div key={index} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-black"><AlertTriangle size={16} className={item.severity === "HIGH" ? "text-red-600" : "text-amber-600"}/>{item.orderNumber} · Pagamento #{item.paymentId}</div><p className="mt-1 text-sm text-gray-600">{item.message}</p></div><span className="text-[10px] font-black uppercase tracking-wider text-gray-500">{item.code}</span></div>)}</div>}
    </div><p className="text-xs text-gray-400">Última verificação: {new Date(data.checkedAt).toLocaleString("pt-PT")}</p></>}
  </section>;
}
