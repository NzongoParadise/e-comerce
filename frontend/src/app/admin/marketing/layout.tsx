"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Mail, Megaphone, MessageSquareQuote, Percent } from "lucide-react";

const items = [
  { label: "Visão geral", href: "/admin/marketing", Icon: BarChart3 },
  { label: "Promoções", href: "/admin/marketing/promotions", Icon: Percent },
  { label: "Newsletter", href: "/admin/marketing/newsletter", Icon: Mail },
  { label: "Depoimentos", href: "/admin/marketing/testimonials", Icon: MessageSquareQuote },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Megaphone size={18} /></span>
          <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-700">Área comercial</p><h1 className="text-base font-black">Marketing</h1><p className="mt-0.5 text-[10px] text-slate-500">Campanhas, promoções, newsletter e prova social.</p></div>
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto border-t border-slate-100 pt-3" aria-label="Navegação de marketing">
          {items.map(({label,href,Icon}) => {
            const active=pathname===href||pathname.startsWith(href+"/");
            return <Link key={href} href={href} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold transition ${active?"bg-violet-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-50"}`}><Icon size={13}/>{label}</Link>
          })}
        </nav>
      </section>
      {children}
    </div>
  );
}
