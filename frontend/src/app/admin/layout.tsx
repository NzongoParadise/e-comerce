"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, ClipboardList, LayoutDashboard, Menu, Megaphone, Package, Search, ShieldCheck, ShoppingBag, Truck, Users, Wallet, X } from "lucide-react";
import { getDashboardDestination } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/api";

const groups = [
  { label: "Operação", items: [["Visão geral", "/admin", LayoutDashboard], ["Vendas", "/admin/orders", ShoppingBag], ["Produtos", "/admin/products", Package], ["Stock", "/admin/stock", Boxes], ["Fornecedores", "/admin/suppliers", Truck]] },
  { label: "Clientes", items: [["Clientes", "/admin/clients", Users], ["Utilizadores", "/admin/users", Users]] },
  { label: "Financeiro", items: [["Visão financeira", "/admin/finance", Wallet], ["Pagamentos", "/admin/finance/payments", Wallet], ["Revisão de pagamentos", "/admin/orders/payment-review", ShieldCheck], ["Reembolsos", "/admin/finance/refunds", Wallet], ["Conciliação", "/admin/finance/reconciliation", ShieldCheck], ["Relatórios", "/admin/finance/reports", BarChart3]] },
  { label: "Marketing", items: [["Cupões", "/admin/marketing", Megaphone], ["Promoções", "/admin/marketing/promotions", Megaphone], ["Newsletter", "/admin/marketing/newsletter", Megaphone], ["Depoimentos", "/admin/marketing/testimonials", Megaphone]] },
  { label: "Sistema", items: [["Logs", "/admin/logs", ClipboardList], ["Configurações", "/admin/settings", ClipboardList]] },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/auth/me").then((response) => {
      if (!active) return;
      if (getDashboardDestination(response.data) === "/admin") setAuthorized(true);
      else router.replace("/account");
    }).catch(() => { if (active) router.replace("/login"); });
    return () => { active = false; };
  }, [router]);

  const activeGroup = useMemo(() => groups.find((group) => group.items.some((item) => isActivePath(pathname, item[1]))), [pathname]);
  const activeItem = activeGroup?.items.find((item) => isActivePath(pathname, item[1]));
  const closeMobile = () => setSidebarOpen(false);

  if (!authorized) return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">A validar permissões...</main>;

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-full items-center gap-3 px-4 lg:px-6">
          <button type="button" onClick={() => setSidebarOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Abrir menu administrativo"><Menu size={18} /></button>
          <Link href="/admin" className="flex min-w-0 items-center gap-3 lg:w-64">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1555d8] text-white shadow-sm"><ShoppingBag size={17} /></span>
            <span className="hidden min-w-0 sm:block"><strong className="block truncate text-sm font-black tracking-tight">RUBRICA DILIGENTE</strong><span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[#1555d8]">Admin · Angola + Portugal</span></span>
          </Link>
          <div className="relative hidden max-w-2xl flex-1 md:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && search.trim()) router.push(`/admin/orders?search=${encodeURIComponent(search.trim())}`); }} placeholder="Pesquisar encomendas, produtos ou clientes..." className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" aria-label="Pesquisa administrativa" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin/orders/payment-review" className="hidden items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800 hover:bg-amber-100 sm:inline-flex"><ShieldCheck size={14} />Revisões</Link>
            <Link href="/admin/users" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white ring-2 ring-white" aria-label="Abrir utilizadores">AD</Link>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)]">
        {sidebarOpen && <button type="button" aria-label="Fechar menu" onClick={closeMobile} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200 bg-white pt-16 shadow-xl transition-transform lg:sticky lg:top-16 lg:z-30 lg:h-[calc(100vh-64px)] lg:w-64 lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:hidden"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Menu administrativo</span><button type="button" onClick={closeMobile} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar menu"><X size={17} /></button></div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação administrativa">
              {groups.map((group) => <section key={group.label} className="mb-5">
                <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
                <div className="space-y-1">{group.items.map(([label, href, Icon]) => {
                  const active = isActivePath(pathname, href);
                  return <Link key={href} href={href} onClick={closeMobile} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${active ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                    <Icon size={15} className={active ? "text-blue-700" : "text-slate-400 group-hover:text-slate-600"} /><span className="flex-1">{label}</span>
                    {label === "Revisão de pagamentos" && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-800">ATENÇÃO</span>}
                  </Link>;
                })}</div>
              </section>)}
            </nav>
            <div className="border-t border-slate-100 p-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Área atual</p><p className="mt-1 truncate text-xs font-bold text-slate-800">{activeGroup?.label || "Administração"}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{activeItem?.[0] || "Painel"}</p></div></div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-11 max-w-[1600px] items-center gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8"><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{activeGroup?.label || "Administração"}</span><span className="text-slate-300">/</span><span className="truncate text-[11px] font-semibold text-slate-700">{activeItem?.[0] || "Painel"}</span></div></div>
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
