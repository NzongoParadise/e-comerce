"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Building2,
  Gift,
  LayoutDashboard,
  Mail,
  Package,
  ShoppingBag,
  Star,
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
  { label: "Financeiro", href: "/admin/finance", Icon: Wallet },
];

const marketingSections = [
  { label: "Cupões", href: "/admin/marketing", Icon: Gift },
  { label: "Newsletter", href: "/admin/marketing/newsletter", Icon: Mail },
  { label: "Testemunhos", href: "/admin/marketing/testimonials", Icon: Star },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return <div className="min-h-screen bg-[#f7f9fc] text-gray-900">
    <header className="border-b border-gray-200 bg-white"><div className="flex h-16 items-center gap-3 px-4 lg:px-6"><Link href="/admin" aria-label="Voltar ao painel" className="flex h-9 w-9 items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50"><ArrowLeft size={16} /></Link><span className="flex h-9 w-9 items-center justify-center bg-[#1555d8] text-white"><BarChart3 size={17} /></span><div><strong className="block text-sm font-black">TechGlobal</strong><span className="text-[9px] font-bold uppercase tracking-widest text-[#1555d8]">Marketing</span></div><span className="ml-auto text-xs font-bold text-gray-600">Campanhas e audiência</span></div></header>
    <div className="flex flex-col lg:flex-row">
      <aside className="w-full shrink-0 bg-[#10233e] text-white lg:min-h-[calc(100vh-64px)] lg:w-60">
        <nav aria-label="Navegação administrativa" className="space-y-1 p-3 text-xs font-medium">
          {primaryItems.map(({ label, href, Icon }) => <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2.5 text-blue-100 hover:bg-white/10"><Icon size={15} />{label}</Link>)}
          <div>
            <Link href="/admin/marketing" aria-current={pathname.startsWith("/admin/marketing") ? "page" : undefined} className="flex items-center gap-3 bg-blue-600 px-3 py-2.5 text-white"><BarChart3 size={15} />Marketing</Link>
            <div aria-label="Subopções de Marketing" className="ml-5 border-l border-white/20 py-1 pl-2">
              {marketingSections.map(({ label, href, Icon }) => {
                const active = pathname === href;
                return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 px-2 py-2 text-[11px] ${active ? "bg-white/15 font-bold text-white" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}><Icon size={13} />{label}</Link>;
              })}
            </div>
          </div>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  </div>;
}
