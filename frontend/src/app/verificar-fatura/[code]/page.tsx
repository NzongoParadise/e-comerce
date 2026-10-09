"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, CheckCircle2, FileCheck2, Loader2, ShieldCheck } from "lucide-react";

type Verification = {
  invoiceNumber: string;
  status: string;
  isValid: boolean;
  currency: string;
  totalEUR: string | number;
  totalKZ: string | number;
  sellerName: string;
  sellerTaxId: string | null;
  issuedAt: string;
  voidedAt: string | null;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
};

function amount(value: Verification) {
  if (value.currency === "EUR") return "€ " + Number(value.totalEUR).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "Kz " + Number(value.totalKZ).toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

export default function VerifyInvoicePage() {
  const params = useParams();
  const code = String(params.code || "");
  const [invoice, setInvoice] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/invoices/verify/" + encodeURIComponent(code), { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Não foi possível validar a fatura.");
        return payload.data as Verification;
      })
      .then((data) => { if (active) setInvoice(data); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível validar a fatura."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">RUBRICA DILIGENTE · Verificação documental</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Validar fatura comercial</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Esta página confirma se o número e o código de verificação correspondem a um documento emitido no sistema.</p>
        </header>

        {loading ? (
          <section className="card flex items-center justify-center gap-3 p-12 text-sm font-semibold text-slate-500"><Loader2 size={18} className="animate-spin"/> A verificar o documento...</section>
        ) : error ? (
          <section role="alert" className="card p-8 text-center"><AlertCircle size={34} className="mx-auto text-rose-500"/><h2 className="mt-3 text-base font-black text-slate-950">Não foi possível validar</h2><p className="mt-2 text-sm text-slate-600">{error}</p></section>
        ) : invoice ? (
          <section className="card overflow-hidden">
            <div className={"flex items-start gap-3 border-b p-5 sm:p-6 " + (invoice.isValid ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70")}>
              {invoice.isValid ? <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-emerald-600"/> : <AlertCircle size={24} className="mt-0.5 shrink-0 text-rose-600"/>}
              <div><h2 className={"text-sm font-black " + (invoice.isValid ? "text-emerald-900" : "text-rose-900")}>{invoice.isValid ? "Documento localizado e emitido" : "Documento anulado"}</h2><p className={"mt-1 text-xs leading-5 " + (invoice.isValid ? "text-emerald-800" : "text-rose-800")}>{invoice.isValid ? "O código corresponde a uma fatura emitida neste sistema." : "A fatura foi anulada e não deve ser tratada como documento válido."}</p></div>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FileCheck2 size={18}/></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Número da fatura</p><p className="mt-1 text-lg font-black text-slate-950">{invoice.invoiceNumber}</p></div></div>
              <div className="grid gap-4 border-y border-slate-100 py-4 sm:grid-cols-2">
                <Info label="Emissor" value={invoice.sellerName}/>
                <Info label="NIF do emissor" value={invoice.sellerTaxId || "Não configurado no registo"}/>
                <Info label="Data de emissão" value={new Date(invoice.issuedAt).toLocaleString("pt-PT")}/>
                <Info label="Encomenda" value={invoice.orderNumber}/>
                <Info label="Total" value={amount(invoice)}/>
                <Info label="Pagamento" value={invoice.paymentStatus}/>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] leading-5 text-slate-600"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-slate-500"/>Esta verificação confirma apenas a existência e o estado do registo no sistema da loja. Não substitui a validação fiscal junto das autoridades competentes nem certifica, por si só, conformidade legal do documento.</div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-xs font-bold text-slate-800">{value}</p></div>;
}
