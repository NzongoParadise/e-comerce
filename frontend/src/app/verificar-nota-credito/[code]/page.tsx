"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, CheckCircle2, FileCheck2, Loader2, ShieldCheck } from "lucide-react";

type Verification = {
  creditNoteNumber: string;
  status: string;
  isValid: boolean;
  currency: string;
  amountEUR: string | number;
  amountKZ: string | number;
  sellerName: string;
  sellerTaxId: string | null;
  issuedAt: string;
  invoiceNumber: string;
  invoiceStatus: string;
  orderNumber: string;
  refundStatus: string;
};

function amount(value: Verification) {
  return value.currency === "EUR"
    ? "€ " + Number(value.amountEUR).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "Kz " + Number(value.amountKZ).toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

export default function VerifyCreditNotePage() {
  const params = useParams();
  const code = String(params.code || "");
  const [note, setNote] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/credit-notes/verify/" + encodeURIComponent(code), { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Não foi possível validar a nota de crédito.");
        return payload.data as Verification;
      })
      .then((data) => { if (active) setNote(data); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível validar a nota de crédito."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">RUBRICA DILIGENTE · Verificação documental</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Validar nota de crédito</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Esta página confirma se o código corresponde a um documento de crédito emitido no sistema.</p>
        </header>

        {loading ? (
          <section className="card flex items-center justify-center gap-3 p-12 text-sm font-semibold text-slate-500"><Loader2 size={18} className="animate-spin"/> A verificar o documento...</section>
        ) : error ? (
          <section role="alert" className="card p-8 text-center"><AlertCircle size={34} className="mx-auto text-rose-500"/><h2 className="mt-3 text-base font-black text-slate-950">Não foi possível validar</h2><p className="mt-2 text-sm text-slate-600">{error}</p></section>
        ) : note ? (
          <section className="card overflow-hidden">
            <div className={"flex items-start gap-3 border-b p-5 sm:p-6 " + (note.isValid ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70")}>
              {note.isValid ? <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-emerald-600"/> : <AlertCircle size={24} className="mt-0.5 shrink-0 text-rose-600"/>}
              <div><h2 className={"text-sm font-black " + (note.isValid ? "text-emerald-900" : "text-rose-900")}>{note.isValid ? "Documento localizado e emitido" : "Documento não está válido"}</h2><p className={"mt-1 text-xs leading-5 " + (note.isValid ? "text-emerald-800" : "text-rose-800")}>{note.isValid ? "A nota de crédito e o reembolso correspondente estão registados." : "O estado da nota, da fatura original ou do reembolso não permite considerá-la válida."}</p></div>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FileCheck2 size={18}/></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Nota de crédito</p><p className="mt-1 text-lg font-black text-slate-950">{note.creditNoteNumber}</p></div></div>
              <div className="grid gap-4 border-y border-slate-100 py-4 sm:grid-cols-2">
                <Info label="Emitente" value={note.sellerName}/>
                <Info label="NIF do emitente" value={note.sellerTaxId || "Não configurado no registo"}/>
                <Info label="Data de emissão" value={new Date(note.issuedAt).toLocaleString("pt-PT")}/>
                <Info label="Valor creditado" value={amount(note)}/>
                <Info label="Fatura original" value={note.invoiceNumber}/>
                <Info label="Encomenda" value={note.orderNumber}/>
                <Info label="Estado da fatura original" value={note.invoiceStatus}/>
                <Info label="Estado do reembolso" value={note.refundStatus}/>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] leading-5 text-slate-600"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-slate-500"/>Esta verificação confirma a existência e o estado do registo neste sistema. Não certifica, por si só, a conformidade fiscal do documento.</div>
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
