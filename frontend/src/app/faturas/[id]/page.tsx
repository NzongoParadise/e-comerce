"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, FileCheck2, Loader2, Printer, ShieldCheck } from "lucide-react";

type Invoice = {
  id: number;
  invoiceNumber: string;
  verificationCode: string;
  status: string;
  currency: string;
  totalEUR: string | number;
  totalKZ: string | number;
  discountTotalEUR: string | number;
  discountTotalKZ: string | number;
  sellerName: string;
  sellerTaxId: string | null;
  sellerAddress: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerTaxId: string | null;
  buyerAddress: string | null;
  issuedAt: string;
  order: {
    id: number;
    orderNumber: string;
    status: string;
    country: string;
    currency: string;
    totalEUR: string | number;
    totalKZ: string | number;
    discountTotalEUR: string | number;
    discountTotalKZ: string | number;
    address: string | null;
    phone: string | null;
    createdAt: string;
    items: Array<{ name: string; slug: string; quantity: number; unitPrice: string | number; subtotal: string | number; imageUrl: string | null }>;
    payment: { status: string; provider: string; method: string; paidAt: string | null } | null;
  };
  company: { legalName: string; tradeName: string | null; nif: string; address: string | null; email: string | null } | null;
  user: { name: string | null; email: string | null };
};

function money(value: string | number, currency: string) {
  return currency === "EUR"
    ? "€ " + Number(value).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "Kz " + Number(value).toLocaleString("pt-AO", { maximumFractionDigits: 0 });
}

export default function InvoiceDocumentPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/invoices/" + encodeURIComponent(id), { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar a fatura.");
        return payload.data as Invoice;
      })
      .then((data) => { if (active) setInvoice(data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a fatura."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const baseUrl = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "")
    : (process.env.NEXT_PUBLIC_SITE_URL || "");
  const verificationUrl = useMemo(
    () => invoice && baseUrl ? baseUrl + "/verificar-fatura/" + encodeURIComponent(invoice.verificationCode) : "",
    [baseUrl, invoice],
  );
  const qrSource = verificationUrl
    ? "https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=svg&data=" + encodeURIComponent(verificationUrl)
    : "";

  if (loading) return <main className="mx-auto max-w-5xl p-8"><div className="flex min-h-64 items-center justify-center gap-3 text-sm font-semibold text-slate-500"><Loader2 size={18} className="animate-spin"/> A carregar documento...</div></main>;
  if (error || !invoice) return <main className="mx-auto max-w-5xl p-8"><div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">{error || "Fatura não encontrada."}</div><Link href="/account/invoices" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700"><ArrowLeft size={15}/> Voltar às faturas</Link></main>;

  const total = invoice.currency === "EUR" ? invoice.totalEUR : invoice.totalKZ;
  const discount = invoice.currency === "EUR" ? invoice.discountTotalEUR : invoice.discountTotalKZ;
  const buyerName = invoice.buyerName || invoice.company?.tradeName || invoice.company?.legalName || invoice.user.name || "Cliente";
  const buyerTaxId = invoice.buyerTaxId || invoice.company?.nif || null;
  const buyerAddress = invoice.buyerAddress || invoice.company?.address || invoice.order.address || null;

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/account/invoices" className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-700"><ArrowLeft size={14}/> Voltar às faturas</Link>
        <button type="button" onClick={() => window.print()} className="btn-primary"><Printer size={15}/> Imprimir / Guardar como PDF</button>
      </div>

      <article className="card overflow-hidden print:rounded-none print:border-0 print:shadow-none">
        <header className="flex flex-col gap-5 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-blue-700"><FileCheck2 size={21}/><span className="text-[10px] font-black uppercase tracking-[0.18em]">Fatura comercial</span></div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{invoice.invoiceNumber}</h1>
            <p className="mt-2 text-xs text-slate-500">Encomenda {invoice.order.orderNumber} · Emitida em {new Date(invoice.issuedAt).toLocaleString("pt-PT")}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700"><CheckCircle2 size={13}/> Documento {invoice.status === "ISSUED" ? "emitido" : invoice.status}</div>
          </div>
          <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-3">
            {qrSource && <img src={qrSource} alt="QR para verificar a fatura no sistema" width={104} height={104} className="h-24 w-24 shrink-0"/>}
            <div className="min-w-0 max-w-48">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-700">Verificação</p>
              <p className="mt-1 break-all text-[9px] leading-4 text-slate-500">Este QR abre a página pública de validação do número e do estado do documento.</p>
              {verificationUrl && <a href={verificationUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-blue-700 hover:underline">Validar fatura <ExternalLink size={10}/></a>}
            </div>
          </div>
        </header>

        <div className="grid gap-6 border-b border-slate-200 p-5 sm:grid-cols-2 sm:p-8">
          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Emitente</p>
            <h2 className="mt-2 text-sm font-black text-slate-950">{invoice.sellerName}</h2>
            {invoice.sellerTaxId && <p className="mt-1 text-xs text-slate-600">NIF: {invoice.sellerTaxId}</p>}
            {invoice.sellerAddress && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{invoice.sellerAddress}</p>}
          </section>
          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Cliente</p>
            <h2 className="mt-2 text-sm font-black text-slate-950">{buyerName}</h2>
            {buyerTaxId && <p className="mt-1 text-xs text-slate-600">NIF: {buyerTaxId}</p>}
            {(invoice.buyerEmail || invoice.company?.email || invoice.user.email) && <p className="mt-1 break-all text-xs text-slate-600">{invoice.buyerEmail || invoice.company?.email || invoice.user.email}</p>}
            {buyerAddress && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{buyerAddress}</p>}
          </section>
        </div>

        <section className="p-5 sm:p-8">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Descrição</th><th className="px-3 py-3 text-right">Qtd.</th><th className="px-3 py-3 text-right">Preço unitário</th><th className="px-3 py-3 text-right">Subtotal</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.order.items.map((item, index) => <tr key={invoice.order.id + "-" + index}>
                  <td className="max-w-sm px-3 py-3"><p className="font-bold text-slate-900">{item.name}</p></td>
                  <td className="px-3 py-3 text-right text-slate-700">{item.quantity}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">{money(item.unitPrice, invoice.currency)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-slate-900">{money(item.subtotal, invoice.currency)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <div className="ml-auto mt-6 max-w-sm space-y-3 border-t border-slate-200 pt-4">
            {Number(discount) > 0 && <div className="flex items-center justify-between gap-4 text-xs"><span className="text-slate-500">Descontos</span><strong className="text-slate-800">− {money(discount, invoice.currency)}</strong></div>}
            <div className="flex items-center justify-between gap-4"><span className="text-sm font-black text-slate-800">Total do documento</span><strong className="text-xl font-black text-slate-950">{money(total, invoice.currency)}</strong></div>
            <p className="text-[10px] leading-5 text-slate-500">Estado do pagamento: {invoice.order.payment?.status || "Desconhecido"} · Método: {invoice.order.payment?.method || "Não indicado"}</p>
          </div>
        </section>

        <footer className="border-t border-slate-200 bg-slate-50/70 p-5 sm:p-8">
          <div className="flex items-start gap-2 text-[10px] leading-5 text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0"/>O QR contém apenas o endereço público de verificação; os dados pessoais não são transmitidos ao serviço gerador do QR. A validade fiscal do documento depende dos dados do emissor e do enquadramento aplicável. Configure os dados fiscais reais antes de utilizar este documento em produção.</div>
        </footer>
      </article>
    </main>
  );
}
