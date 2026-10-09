"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, FileCheck2, Loader2, Printer, ShieldCheck } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type CreditNote = {
  id: number;
  creditNoteNumber: string;
  verificationCode: string;
  status: string;
  currency: string;
  amountEUR: string | number;
  amountKZ: string | number;
  reason: string;
  sellerName: string;
  sellerTaxId: string | null;
  sellerAddress: string | null;
  buyerName: string | null;
  buyerTaxId: string | null;
  buyerAddress: string | null;
  issuedBy: string;
  issuedAt: string;
  invoice: { id: number; invoiceNumber: string; status: string; issuedAt: string };
  order: { id: number; orderNumber: string; status: string; currency: string; totalEUR: string | number; totalKZ: string | number };
  refund: { id: number; status: string; provider: string; providerRefundId: string | null; processedAt: string | null };
  company: { legalName: string; tradeName: string | null; nif: string; address: string | null; email: string | null } | null;
  user: { name: string | null; email: string | null };
};

function money(value: string | number, currency: string) {
  return currency === "EUR"
    ? "€ " + Number(value).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "Kz " + Number(value).toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

export default function CreditNoteDocumentPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [note, setNote] = useState<CreditNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/credit-notes/" + encodeURIComponent(id), { cache: "no-store" })
      .then((response) => {
        if (!response?.data) throw new Error("Nota de crédito não encontrada.");
        if (active) setNote(response.data as CreditNote);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar a nota de crédito.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const siteUrl = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "")
    : (process.env.NEXT_PUBLIC_SITE_URL || "");
  const verificationUrl = useMemo(
    () => note && siteUrl ? siteUrl + "/verificar-nota-credito/" + encodeURIComponent(note.verificationCode) : "",
    [note, siteUrl],
  );
  const qrUrl = verificationUrl
    ? "https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=svg&data=" + encodeURIComponent(verificationUrl)
    : "";

  if (loading) return <main className="mx-auto max-w-5xl p-8"><div className="flex min-h-64 items-center justify-center gap-3 text-sm font-semibold text-slate-500"><Loader2 size={18} className="animate-spin"/> A carregar documento...</div></main>;
  if (error || !note) return <main className="mx-auto max-w-5xl p-8"><div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">{error || "Nota de crédito não encontrada."}</div><Link href="/account/invoices" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700"><ArrowLeft size={15}/> Voltar aos documentos</Link></main>;

  const amount = note.currency === "EUR" ? note.amountEUR : note.amountKZ;
  const buyerName = note.buyerName || note.company?.tradeName || note.company?.legalName || note.user.name || "Cliente";
  const buyerTaxId = note.buyerTaxId || note.company?.nif || null;
  const buyerAddress = note.buyerAddress || note.company?.address || null;

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/account/invoices" className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-700"><ArrowLeft size={14}/> Voltar aos documentos</Link>
        <button type="button" onClick={() => window.print()} className="btn-primary"><Printer size={15}/> Imprimir / Guardar como PDF</button>
      </div>

      <article className="card overflow-hidden print:rounded-none print:border-0 print:shadow-none">
        <header className="flex flex-col gap-5 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-blue-700"><FileCheck2 size={21}/><span className="text-[10px] font-black uppercase tracking-[0.18em]">Nota de crédito</span></div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{note.creditNoteNumber}</h1>
            <p className="mt-2 text-xs text-slate-500">Relativa à fatura {note.invoice.invoiceNumber} · Encomenda {note.order.orderNumber}</p>
            <p className="mt-1 text-xs text-slate-500">Emitida em {new Date(note.issuedAt).toLocaleString("pt-PT")}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700"><CheckCircle2 size={13}/> Documento {note.status === "ISSUED" ? "emitido" : note.status}</div>
          </div>
          <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-3">
            {qrUrl && <img src={qrUrl} alt="QR para verificar a nota de crédito" width={104} height={104} className="h-24 w-24 shrink-0"/>}
            <div className="min-w-0 max-w-48">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-700">Verificação</p>
              <p className="mt-1 break-all text-[9px] leading-4 text-slate-500">O QR abre a validação pública deste documento.</p>
              {verificationUrl && <a href={verificationUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-blue-700 hover:underline">Validar documento <ExternalLink size={10}/></a>}
            </div>
          </div>
        </header>

        <div className="grid gap-6 border-b border-slate-200 p-5 sm:grid-cols-2 sm:p-8">
          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Emitente</p>
            <h2 className="mt-2 text-sm font-black text-slate-950">{note.sellerName}</h2>
            {note.sellerTaxId && <p className="mt-1 text-xs text-slate-600">NIF: {note.sellerTaxId}</p>}
            {note.sellerAddress && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{note.sellerAddress}</p>}
          </section>
          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Cliente</p>
            <h2 className="mt-2 text-sm font-black text-slate-950">{buyerName}</h2>
            {buyerTaxId && <p className="mt-1 text-xs text-slate-600">NIF: {buyerTaxId}</p>}
            {note.user.email && <p className="mt-1 break-all text-xs text-slate-600">{note.user.email}</p>}
            {buyerAddress && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{buyerAddress}</p>}
          </section>
        </div>

        <section className="p-5 sm:p-8">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Motivo</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-800">{note.reason}</p>
            <p className="mt-3 text-[10px] text-slate-500">Reembolso de referência interna #{note.refund.id} · Estado: {note.refund.status} · Prestador: {note.refund.provider}</p>
            {note.refund.processedAt && <p className="mt-1 text-[10px] text-slate-500">Processado em {new Date(note.refund.processedAt).toLocaleString("pt-PT")}</p>}
          </div>

          <div className="ml-auto mt-6 max-w-sm space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-4"><span className="text-sm font-black text-slate-800">Valor creditado</span><strong className="text-xl font-black text-slate-950">{money(amount, note.currency)}</strong></div>
            <p className="text-[10px] leading-5 text-slate-500">O valor do documento está registado na mesma moeda da fatura original e do reembolso confirmado.</p>
          </div>
        </section>

        <footer className="border-t border-slate-200 bg-slate-50/70 p-5 sm:p-8">
          <div className="flex items-start gap-2 text-[10px] leading-5 text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0"/>O QR confirma a existência e o estado do documento neste sistema; não substitui a validação fiscal junto das autoridades competentes.</div>
        </footer>
      </article>
    </main>
  );
}
