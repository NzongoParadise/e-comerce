"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, ChevronDown, ClipboardList, LayoutDashboard, Megaphone, Package, Settings2, ShieldCheck, ShoppingBag, Truck, Users, Wallet } from "lucide-react";
import { getDashboardDestination } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/api";

const groups = [
  { label: "Operação", items: [["Visão geral","/admin",LayoutDashboard],["Vendas","/admin/orders",ShoppingBag],["Produtos","/admin/products",Package],["Stock","/admin/stock",Boxes],["Fornecedores","/admin/suppliers",Truck]] },
  { label: "Clientes", items: [["Clientes","/admin/clients",Users],["Utilizadores","/admin/users",Users]] },
  { label: "Financeiro", items: [["Visão financeira","/admin/finance",Wallet],["Pagamentos","/admin/finance/payments",Wallet],["Revisão de pagamentos","/admin/orders/payment-review",ShieldCheck],["Relatórios","/admin/finance/reports",BarChart3]] },
  { label: "Marketing", items: [["Marketing","/admin/marketing",Megaphone],["Promoções","/admin/marketing/promotions",Megaphone]] },
  { label: "Sistema", items: [["Logs","/admin/logs",ClipboardList],["Configurações","/admin/settings",Settings2]] },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/auth/me").then((response) => {
      if (!active) return;
      if (getDashboardDestination(response.data) === "/admin") setAuthorized(true);
      else router.replace("/account");
    }).catch(() => { if (active) router.replace("/login"); });
    return () => { active = false; };
  }, [router]);

  const activeGroup = useMemo(() => groups.find((group) => group.items.some((item) => pathname === item[1] || (item[1] !== "/admin" && pathname.startsWith(item[1] + "/")))), [pathname]);

  if (!authorized) return <main className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500">A validar permissões...</main>;

  const linkClass = (href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(href + "/")) ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50";

  return <div className="min-h-screen bg-[#f7f9fc]">
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-[1600px] items-center gap-3 px-4 lg:px-6">
        <Link href="/admin" className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#1555d8] text-white"><ShoppingBag size={16}/></span>
          <span className="hidden sm:block"><strong className="block text-xs font-black">Painel Administrativo</strong><span className="block text-[9px] text-gray-500">Operação · Angola + Portugal</span></span>
        </Link>
        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Navegação administrativa">
          {groups.map((group) => <div key={group.label} className="group relative">
            <button type="button" className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-[10px] font-bold ${activeGroup?.label === group.label ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}>{group.label}<ChevronDown size={12}/></button>
            <div className="invisible absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-1.5 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
              {group.items.map(([label,href,Icon]) => <Link key={href} href={href} className={`flex items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold ${linkClass(href)}`}><Icon size={13}/>{label}</Link>)}
            </div>
          </div>)}
        </nav>
        <Link href="/admin/orders/payment-review" className="ml-auto hidden rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800 md:inline-flex">Revisão de pagamentos</Link>
        <button type="button" onClick={() => setMobileOpen(v => !v)} className="ml-auto rounded-md border border-gray-200 px-3 py-2 text-[10px] font-bold text-gray-700 lg:hidden" aria-expanded={mobileOpen}>Menu administrativo</button>
      </div>
      {mobileOpen && <div className="border-t border-gray-200 bg-white px-4 py-3 lg:hidden"><div className="grid gap-3 sm:grid-cols-2">
        {groups.map(group => <section key={group.label}><p className="mb-1 text-[9px] font-black uppercase tracking-wider text-gray-400">{group.label}</p><div className="grid gap-1">{group.items.map(([label,href,Icon]) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold ${linkClass(href)}`}><Icon size={13}/>{label}</Link>)}</div></section>)}
      </div></div>}
    </header>
    <div className="border-b border-gray-200 bg-white"><div className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto px-4 py-2 lg:px-6"><span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Área atual</span><span className="text-[10px] font-bold text-gray-700">{activeGroup?.label || "Administração"}</span><span className="text-gray-300">/</span><span className="truncate text-[10px] text-gray-500">{activeGroup?.items.find(item => pathname === item[1] || (item[1] !== "/admin" && pathname.startsWith(item[1] + "/")))?.[0] || "Painel"}</span></div></div>
    {children}
  </div>;
}