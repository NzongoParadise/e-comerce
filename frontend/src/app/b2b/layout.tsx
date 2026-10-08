"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft, Building2, FileText, LayoutDashboard, LifeBuoy, LogOut, Menu, Package,
  Settings, ShoppingBag, Users, WalletCards, X,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";

const groups: { label: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  { label: "Principal", items: [
    { href: "/b2b", label: "Visão geral", icon: LayoutDashboard },
  ] },
  { label: "Compras", items: [
    { href: "/b2b/catalogo", label: "Catálogo", icon: Package },
    { href: "/b2b/cotacoes", label: "Cotações", icon: FileText },
    { href: "/b2b/encomendas", label: "Encomendas", icon: ShoppingBag },
  ] },
  { label: "Empresa", items: [
    { href: "/b2b/financeiro", label: "Financeiro", icon: WalletCards },
    { href: "/b2b/empresa", label: "Dados da empresa", icon: Building2 },
    { href: "/b2b/utilizadores", label: "Utilizadores", icon: Users },
    { href: "/b2b/conta", label: "Definições", icon: Settings },
  ] },
  { label: "Ajuda", items: [
    { href: "/b2b/suporte", label: "Falar com o suporte", icon: LifeBuoy },
  ] },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/b2b" && pathname.startsWith(`${href}/`));
}

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeGroup = groups.find((group) => group.items.some(({ href }) => isActivePath(pathname, href)));
  const activeItem = activeGroup?.items.find(({ href }) => isActivePath(pathname, href));
  const closeMobile = () => setSidebarOpen(false);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return () => { active = false; };
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sessão inválida");
        const payload = await response.json();
        if (!active) return;
        const profile = payload.data;
        if (profile?.isAdmin || profile?.accessRole === "ADMIN") router.replace("/admin");
        else if (profile?.accessRole !== "CUSTOMER" || profile?.accountType !== "B2B") router.replace("/account");
        else setAuthorized(true);
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem("jwt_token");
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      });
    return () => { active = false; };
  }, [pathname, router]);

  function signOut() {
    localStorage.removeItem("jwt_token");
    router.replace("/login");
  }

  if (!authorized) return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-sm font-medium text-slate-500">A validar o acesso empresarial...</main>;

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-6">
          <button type="button" onClick={() => setSidebarOpen(true)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Abrir navegação empresarial"><Menu size={18} /></button>
          <BrandLogo className="shrink-0 lg:w-64" />
          <span className="hidden items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 sm:inline-flex"><Building2 size={15} /> Área empresarial</span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950"><ArrowLeft size={15} /><span className="hidden sm:inline">Voltar à loja</span></Link>
            <button type="button" onClick={signOut} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"><LogOut size={15} /><span className="hidden sm:inline">Sair</span></button>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)]">
        {sidebarOpen && <button type="button" aria-label="Fechar navegação" onClick={closeMobile} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200 bg-white pt-16 shadow-xl transition-transform lg:sticky lg:top-16 lg:z-30 lg:h-[calc(100vh-64px)] lg:w-64 lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:hidden"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Navegação empresarial</span><button type="button" onClick={closeMobile} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar navegação"><X size={17} /></button></div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação empresarial">
              {groups.map((group) => <section key={group.label} className="mb-5"><p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{group.label}</p><div className="space-y-1">{group.items.map(({ href, label, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return <Link key={href} href={href} onClick={closeMobile} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${active ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon size={15} className={active ? "text-blue-700" : "text-slate-400 group-hover:text-slate-600"} /><span>{label}</span></Link>;
              })}</div></section>)}
            </nav>
            <div className="border-t border-slate-100 p-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Área atual</p><p className="mt-1 truncate text-xs font-bold text-slate-800">{activeGroup?.label || "Empresa"}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{activeItem?.label || "Painel empresarial"}</p></div></div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-11 max-w-[1600px] items-center gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8"><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{activeGroup?.label || "Empresa"}</span><span className="text-slate-300">/</span><span className="truncate text-[11px] font-semibold text-slate-700">{activeItem?.label || "Painel empresarial"}</span></div></div>
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
