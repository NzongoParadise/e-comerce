"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, FileDown, LayoutDashboard, RefreshCcw, RotateCcw, ShieldCheck, Wallet } from "lucide-react";

const items = [
  { label: "Visão geral", href: "/admin/finance", Icon: LayoutDashboard },
  { label: "Pagamentos", href: "/admin/finance/payments", Icon: CreditCard },
  { label: "Revisão", href: "/admin/finance/review", Icon: ShieldCheck },
  { label: "Reembolsos", href: "/admin/finance/refunds", Icon: RotateCcw },
  { label: "Conciliação", href: "/admin/finance/reconciliation", Icon: RefreshCcw },
  { label: "Relatórios", href: "/admin/finance/reports", Icon: FileDown },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Wallet size={18} /></span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-700">Área financeira</p>
              <h1 className="text-base font-black tracking-tight text-slate-950">Gestão financeira</h1>
              <p className="mt-0.5 text-[10px] text-slate-500">Movimentos, pagamentos, reembolsos, conciliação e relatórios.</p>
            </div>
          </div>
          <Link href="/admin" className="text-[10px] font-bold text-slate-500 hover:text-blue-700">Voltar ao painel geral →</Link>
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto border-t border-slate-100 pt-3" aria-label="Navegação financeira">
          {items.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return <Link key={href} href={href} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold transition ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={13} />{label}</Link>;
          })}
        </nav>
      </section>
      {children}
    </div>
  );
}
