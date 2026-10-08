"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import type { LucideIcon } from "lucide-react";
import {
  Home, Package, UserRound, MapPin, CreditCard, Heart,
  Headphones, RefreshCcw, Tags, Users, Settings, FileText, LogOut,
  Boxes, Menu, X, Search, ShoppingBag,
} from "lucide-react";

type NavItem = { name: string; href: string; Icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "Conta", items: [
    { name: "Visão geral", href: "/account", Icon: Home },
    { name: "As minhas encomendas", href: "/account/orders", Icon: Package },
    { name: "Lista de favoritos", href: "/favorites", Icon: Heart },
  ]},
  { label: "Gestão", items: [
    { name: "Dados da conta", href: "/account/profile", Icon: UserRound },
    { name: "Endereços", href: "/account/addresses", Icon: MapPin },
    { name: "Métodos de pagamento", href: "/account/payment", Icon: CreditCard },
    { name: "Os meus cupões", href: "/account/coupons", Icon: Tags },
    { name: "Devoluções e reclamações", href: "/account/returns", Icon: RefreshCcw },
  ]},
  { label: "Suporte", items: [
    { name: "Ajuda e suporte", href: "/account/support", Icon: Headphones },
  ]},
  { label: "Administração", items: [
    { name: "Gestão de utilizadores", href: "/account/users", Icon: Users },
    { name: "Gestão de stock", href: "/admin/stock", Icon: Boxes },
    { name: "Definições", href: "/account/settings", Icon: Settings },
    { name: "Termos e condições", href: "/terms", Icon: FileText },
  ]},
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/account" && pathname.startsWith(href + "/"));
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<{ name?: string; email?: string; accountName?: string; accountType?: string; isAdmin?: boolean } | null>(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchWithAuth("/api/auth/me").then((response) => setProfile(response.data)).catch(() => setProfile(null)).finally(() => setProfileResolved(true));
  }, []);

  useEffect(() => {
    if (profileResolved && !profile && pathname !== "/account/support") router.replace("/login");
  }, [pathname, profile, profileResolved, router]);

  if (pathname === "/account/support" && profileResolved && !profile) return <>{children}</>;
  if (profileResolved && !profile) return <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] text-sm text-slate-500">A redirecionar para o login...</main>;

  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter(({ href }) => {
      if (href === "/account/users" || href === "/admin/stock") return profile?.isAdmin === true;
      if (href === "/account/quotes") return profile?.accountType === "B2B";
      return true;
    }),
  })).filter((group) => group.items.length);

  const activeGroup = useMemo(() => visibleGroups.find((group) => group.items.some((item) => isActivePath(pathname, item.href))), [pathname, profile]);
  const activeItem = activeGroup?.items.find((item) => isActivePath(pathname, item.href));
  const initials = (profile?.name || profile?.email || "CL").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  const closeMobile = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-full items-center gap-3 px-4 lg:px-6">
          <button type="button" onClick={() => setSidebarOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Abrir menu da conta"><Menu size={18} /></button>
          <Link href="/account" className="flex min-w-0 items-center gap-3 lg:w-64">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1555d8] text-white shadow-sm"><ShoppingBag size={17} /></span>
            <span className="hidden min-w-0 sm:block"><strong className="block truncate text-sm font-black tracking-tight">RUBRICA DILIGENTE</strong><span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[#1555d8]">{profile?.accountType === "B2B" ? "Conta empresarial" : "Conta de cliente"} · Angola + Portugal</span></span>
          </Link>
          <div className="relative hidden max-w-2xl flex-1 md:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && search.trim()) router.push(`/products?search=${encodeURIComponent(search.trim())}`); }} placeholder="Pesquisar produtos, encomendas ou ajuda..." className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" aria-label="Pesquisar na conta" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/products" className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 sm:inline-flex">Continuar a comprar</Link>
            <Link href="/account/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white ring-2 ring-white" aria-label="Abrir perfil">{initials}</Link>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)]">
        {sidebarOpen && <button type="button" aria-label="Fechar menu" onClick={closeMobile} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200 bg-white pt-16 shadow-xl transition-transform lg:sticky lg:top-16 lg:z-30 lg:h-[calc(100vh-64px)] lg:w-64 lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:hidden"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Menu da conta</span><button type="button" onClick={closeMobile} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar menu"><X size={17} /></button></div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação da conta">
              {visibleGroups.map((group) => <section key={group.label} className="mb-5">
                <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
                <div className="space-y-1">{group.items.map(({ name, href, Icon }) => {
                  const active = isActivePath(pathname, href);
                  return <Link key={href} href={href} onClick={closeMobile} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${active ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                    <Icon size={15} className={active ? "text-blue-700" : "text-slate-400 group-hover:text-slate-600"} /><span className="flex-1">{name}</span>
                  </Link>;
                })}</div>
              </section>)}
            </nav>
            <div className="border-t border-slate-100 p-4">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Área atual</p><p className="mt-1 truncate text-xs font-bold text-slate-800">{activeGroup?.label || "Conta"}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{activeItem?.name || "Painel"}</p></div>
              <Link href="/logout" className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50" onClick={closeMobile}><LogOut size={15} /> Sair da conta</Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-11 max-w-[1600px] items-center gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8"><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{activeGroup?.label || "Conta"}</span><span className="text-slate-300">/</span><span className="truncate text-[11px] font-semibold text-slate-700">{activeItem?.name || "Painel"}</span></div></div>
          <div className="account-admin-fields mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
