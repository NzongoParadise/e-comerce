"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Building2,
  CreditCard,
  LayoutDashboard,
  Package,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

const primaryItems = [
  { label: "Visão geral", href: "/admin", Icon: LayoutDashboard },
  { label: "Vendas", href: "/admin/orders", Icon: ShoppingBag },
  { label: "Produtos", href: "/admin/products", Icon: Package },
  { label: "Gestão de stock", href: "/admin/stock", Icon: Boxes },
  { label: "Clientes", href: "/admin/clients", Icon: Users },
  { label: "Fornecedores", href: "/admin/suppliers", Icon: Truck },
  { label: "Utilizadores", href: "/admin/users", Icon: Building2 },
];

const financeSections = [
  { label: "Movimentos", href: "/admin/finance", Icon: Wallet },
  { label: "Pagamentos", href: "/admin/finance/payments", Icon: CreditCard },
  { label: "Revisão de pagamentos", href: "/admin/finance/review", Icon: ShieldCheck },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return <div className="min-h-screen bg-[#f7f9fc] text-gray-900">
    <header className="border-b border-gray-200 bg-white"><div className="flex h-16 items-center gap-3 px-4 lg:px-6"><Link href="/admin" aria-label="Voltar ao painel" className="flex h-9 w-9 items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50"><ArrowLeft size={16} /></Link><span className="flex h-9 w-9 items-center justify-center bg-[#1555d8] text-white"><Wallet size={17} /></span><div><strong className="block text-sm font-black">RUBRICA DILIGENTE (SU), LDA</strong><span className="text-[9px] font-bold uppercase tracking-widest text-[#1555d8]">Painel administrativo</span></div><span className="ml-auto text-xs font-bold text-gray-600">Financeiro</span></div></header>
    <div className="flex flex-col lg:flex-row">
      <aside className="w-full shrink-0 bg-[#10233e] text-white lg:min-h-[calc(100vh-64px)] lg:w-60">
        <nav aria-label="Navegação administrativa" className="space-y-1 p-3 text-xs font-medium">
          {primaryItems.map(({ label, href, Icon }) => <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2.5 text-blue-100 hover:bg-white/10"><Icon size={15} />{label}</Link>)}
          <div>
            <Link href="/admin/finance" aria-current={pathname === "/admin/finance" ? "page" : undefined} className="flex items-center gap-3 bg-blue-600 px-3 py-2.5 text-white"><Wallet size={15} />Financeiro</Link>
            <div aria-label="Subopções de Financeiro" className="ml-5 border-l border-white/20 py-1 pl-2">
              {financeSections.map(({ label, href, Icon }) => {
                const active = pathname === href;
                return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 px-2 py-2 text-[11px] ${active ? "bg-white/15 font-bold text-white" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}><Icon size={13} />{label}</Link>;
              })}
            </div>
          </div>
          <Link href="/admin/marketing" className="flex items-center gap-3 px-3 py-2.5 text-blue-100 hover:bg-white/10"><BarChart3 size={15} />Marketing</Link>
          <Link href="/admin/finance/refunds" className={`flex items-center gap-3 px-3 py-2.5 ${pathname.startsWith("/admin/finance/refunds") ? "bg-white/15 font-bold text-white" : "text-blue-100 hover:bg-white/10"}`}><Wallet size={15} />Reembolsos</Link>
          <Link href="/admin/finance/reconciliation" className={`flex items-center gap-3 px-3 py-2.5 ${pathname.startsWith("/admin/finance/reconciliation") ? "bg-white/15 font-bold text-white" : "text-blue-100 hover:bg-white/10"}`}><ShieldCheck size={15} />Conciliação</Link>
          <Link href="/admin/finance/reports" className={`flex items-center gap-3 px-3 py-2.5 ${pathname.startsWith("/admin/finance/reports") ? "bg-white/15 font-bold text-white" : "text-blue-100 hover:bg-white/10"}`}><BarChart3 size={15} />Relatórios</Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  </div>;
}
