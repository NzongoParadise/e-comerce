"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Analytics = {
  incomeAOA: number; incomeEUR: number; gatewayIncomeAOA: number; gatewayIncomeEUR: number;
  expenseAOA: number; expenseEUR: number; pendingAOA: number; pendingEUR: number;
  netAOA: number; netEUR: number; totalEntries: number;
};

export default function FinanceReportsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const response = await fetchWithAuth("/api/admin/finance/analytics");
    if (response.ok) setData((await response.json()).data);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const exportCsv = () => {
    if (!data) return;
    const rows = [["Indicador","AOA","EUR"],["Receita confirmada",data.incomeAOA,data.incomeEUR],["Receita de gateways",data.gatewayIncomeAOA,data.gatewayIncomeEUR],["Despesas",data.expenseAOA,data.expenseEUR],["Pendente",data.pendingAOA,data.pendingEUR],["Resultado líquido",data.netAOA,data.netEUR]];
    const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"','""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "relatorio-financeiro.csv"; anchor.click(); URL.revokeObjectURL(url);
  };

  return <section className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#1555d8]">Financeiro</p><h1 className="mt-1 text-2xl font-black">Relatórios</h1><p className="mt-1 text-sm text-gray-500">Resumo financeiro operacional com exportação CSV.</p></div><div className="flex gap-2"><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 border border-gray-200 bg-white px-4 py-2 text-sm font-bold"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/>Atualizar</button><button onClick={exportCsv} disabled={!data} className="inline-flex items-center gap-2 bg-[#1555d8] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Download size={15}/>Exportar CSV</button></div></div>
    {data && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["Receita confirmada",data.incomeAOA,"AOA"],["Receita gateways",data.gatewayIncomeAOA,"AOA"],["Despesas",data.expenseAOA,"AOA"],["Pendente",data.pendingAOA,"AOA"],["Resultado líquido",data.netAOA,"AOA"],["Total movimentos",data.totalEntries,""]].map(([label,value,currency]) => <div key={String(label)} className="border border-gray-200 bg-white p-5"><div className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</div><div className="mt-2 text-2xl font-black">{typeof value === "number" ? value.toLocaleString("pt-PT",{minimumFractionDigits:2,maximumFractionDigits:2}) : value}</div><div className="mt-1 text-xs text-gray-400">{currency}</div></div>)}</div>}
  </section>;
}
