"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, LayoutDashboard, Package, Settings, ShoppingBag, Users, WalletCards, Menu, X, Search, ChevronRight } from "lucide-react";
import { useState } from "react";

const groups = [
  { label: "Empresa", items: [
    { href: "/b2b", label: "Visão geral", Icon: LayoutDashboard },
    { href: "/b2b/catalogo", label: "Catálogo", Icon: Package },
  ]},
  { label: "Compras", items: [
    { href: "/b2b/cotacoes", label: "Cotações", Icon: FileText },
    { href: "/b2b/encomendas", label: "Encomendas", Icon: ShoppingBag },
    { href: "/b2b/financeiro", label: "Financeiro", Icon: WalletCards },
  ]},
  { label: "Organização", items: [
    { href: "/b2b/empresa", label: "Empresa", Icon: Building2 },
    { href: "/b2b/utilizadores", label: "Utilizadores", Icon: Users },
    { href: "/b2b/conta", label: "Definições", Icon: Settings },
  ]},
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/b2b" && pathname.startsWith(href + "/"));
}

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const activeGroup = groups.find((group) => group.items.some((item) => isActive(pathname, item.href)));
  const activeItem = activeGroup?.items.find((item) => isActive(pathname, item.href));
  const closeMobile = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-full items-center gap-3 px-4 lg:px-6">
          <button type="button" onClick={() => setSidebarOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Abrir menu empresarial"><Menu size={18} /></button>
          <Link href="/b2b" className="flex min-w-0 items-center gap-3 lg:w-64">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1555d8] text-white shadow-sm"><Building2 size={17} /></span>
            <span className="hidden min-w-0 sm:block"><strong className="block truncate text-sm font-black tracking-tight">RUBRICA DILIGENTE</strong><span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[#1555d8]">B2B · Angola + Portugal</span></span>
          </Link>
          <div className="relative hidden max-w-2xl flex-1 md:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && search.trim()) window.location.href = `/b2b/catalogo?search=${encodeURIComponent(search.trim())}`; }} placeholder="Pesquisar no catálogo, encomendas ou cotações..." className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" aria-label="Pesquisa empresarial" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/products" className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 sm:inline-flex">Loja</Link>
            <Link href="/b2b/empresa" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white ring-2 ring-white" aria-label="Abrir empresa">B2</Link>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)]">
        {sidebarOpen && <button type="button" aria-label="Fechar menu" onClick={closeMobile} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200 bg-white pt-16 shadow-xl transition-transform lg:sticky lg:top-16 lg:z-30 lg:h-[calc(100vh-64px)] lg:w-64 lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:hidden"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Área empresarial</span><button type="button" onClick={closeMobile} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar menu"><X size={17} /></button></div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação B2B">
              {groups.map((group) => <section key={group.label} className="mb-5">
                <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
                <div className="space-y-1">{group.items.map(({ href, label, Icon }) => {
                  const active = isActive(pathname, href);
                  return <Link key={href} href={href} onClick={closeMobile} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${active ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                    <Icon size={15} className={active ? "text-blue-700" : "text-slate-400 group-hover:text-slate-600"} /><span className="flex-1">{label}</span>{active && <ChevronRight size={13} className="text-blue-500" />}
                  </Link>;
                })}</div>
              </section>)}
            </nav>
            <div className="border-t border-slate-100 p-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Área atual</p><p className="mt-1 truncate text-xs font-bold text-slate-800">{activeGroup?.label || "Empresa"}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{activeItem?.label || "Painel"}</p></div></div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-11 max-w-[1600px] items-center gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8"><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{activeGroup?.label || "Empresa"}</span><span className="text-slate-300">/</span><span className="truncate text-[11px] font-semibold text-slate-700">{activeItem?.label || "Painel"}</span></div></div>
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
