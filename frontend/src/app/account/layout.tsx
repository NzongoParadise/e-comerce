"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CreditCard, FileText, Heart, Headphones, Home, LogOut, MapPin, Menu,
  Package, RefreshCcw, Settings, Tags, UserRound, Users, Boxes, X,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type NavItem = { name: string; href: string; Icon: LucideIcon };
const navGroups: { label: string; items: NavItem[] }[] = [
  { label: "Principal", items: [
    { name: "Visão geral", href: "/account", Icon: Home },
    { name: "As minhas encomendas", href: "/account/orders", Icon: Package },
  ] },
  { label: "A minha conta", items: [
    { name: "Dados pessoais", href: "/account/profile", Icon: UserRound },
    { name: "Endereços", href: "/account/addresses", Icon: MapPin },
    { name: "Métodos de pagamento", href: "/account/payment", Icon: CreditCard },
    { name: "Definições", href: "/account/settings", Icon: Settings },
  ] },
  { label: "Compras e apoio", items: [
    { name: "Lista de favoritos", href: "/favorites", Icon: Heart },
    { name: "Os meus cupões", href: "/account/coupons", Icon: Tags },
    { name: "Devoluções", href: "/account/returns", Icon: RefreshCcw },
    { name: "Ajuda e suporte", href: "/account/support", Icon: Headphones },
  ] },
  { label: "Administração", items: [
    { name: "Gestão de utilizadores", href: "/account/users", Icon: Users },
    { name: "Gestão de stock", href: "/admin/stock", Icon: Boxes },
    { name: "Termos e condições", href: "/terms", Icon: FileText },
  ] },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/account" && pathname.startsWith(`${href}/`));
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<{ name?: string; email?: string; accountName?: string; accountType?: string; isAdmin?: boolean } | null>(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchWithAuth("/api/auth/me").then((response) => setProfile(response.data))
      .catch(() => setProfile(null)).finally(() => setProfileResolved(true));
  }, []);

  useEffect(() => {
    if (!profileResolved || profile?.accountType !== "B2B") return;
    const destination = pathname.startsWith("/account/orders")
      ? "/b2b/encomendas"
      : pathname.startsWith("/account/quotes")
        ? "/b2b/cotacoes"
        : pathname === "/account/profile" || pathname === "/account/addresses"
          ? "/b2b/empresa"
          : pathname === "/account/settings"
            ? "/b2b/conta"
            : pathname === "/account/payment"
              ? "/b2b/financeiro"
              : pathname === "/account/users"
                ? "/b2b/utilizadores"
                : pathname === "/account/coupons"
                  ? "/b2b/catalogo"
                  : pathname === "/account/returns"
                    ? "/b2b/encomendas"
                    : pathname === "/account"
                      ? "/b2b"
                      : null;
    if (destination) router.replace(destination);
  }, [pathname, profile, profileResolved, router]);

  useEffect(() => {
    if (profileResolved && !profile && pathname !== "/account/support") router.replace("/login");
  }, [pathname, profile, profileResolved, router]);

  const visibleGroups = useMemo(() => navGroups.map((group) => ({
    ...group,
    items: group.items.filter(({ href }) => {
      if (href === "/account/users" || href === "/admin/stock") return profile?.isAdmin === true;
      if (href === "/terms") return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0), [profile?.isAdmin]);
  const activeGroup = visibleGroups.find((group) => group.items.some(({ href }) => isActivePath(pathname, href)));
  const activeItem = activeGroup?.items.find(({ href }) => isActivePath(pathname, href));
  const initials = (profile?.name || profile?.email || "RD").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  const closeMobile = () => setSidebarOpen(false);

  if (pathname === "/account/support" && profileResolved && !profile) return <>{children}</>;
  if (profileResolved && profile?.accountType === "B2B") return <main className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500">A abrir a área empresarial...</main>;
  if (profileResolved && !profile) return <main className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500">A redirecionar para o login...</main>;

  return (
    <div className="min-h-[60vh] bg-[#f6f8fb] text-slate-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setSidebarOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Abrir navegação da conta"><Menu size={18} /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{activeGroup?.label || "Conta de cliente"}</p>
            <p className="truncate text-xs font-bold text-slate-800">{activeItem?.name || "A minha conta"}</p>
          </div>
          <Link href="/products" className="rounded-lg px-3 py-2 text-[10px] font-bold text-blue-700 hover:bg-blue-50">Continuar compras</Link>
          <button type="button" onClick={() => { localStorage.removeItem("jwt_token"); router.replace("/login"); }} className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 sm:inline-flex"><LogOut size={14} /> Sair</button>
        </div>
      </div>

      <div className="mx-auto flex min-h-[calc(60vh-56px)] max-w-[1600px]">
        {sidebarOpen && <button type="button" aria-label="Fechar navegação" onClick={closeMobile} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}
        <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col border-r border-slate-200 bg-white pt-16 shadow-xl transition-transform lg:sticky lg:top-40 lg:z-20 lg:h-[calc(100vh-10rem)] lg:w-64 lg:translate-x-0 lg:pt-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:hidden"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Navegação da conta</span><button type="button" onClick={closeMobile} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar navegação"><X size={17} /></button></div>
          <div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">{initials}</span><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900">{profile?.name || profile?.email || "A minha conta"}</p><p className="truncate text-[9px] font-semibold text-slate-500">{profile?.accountName || "Cliente"} · B2C</p></div></div></div>
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação da conta">
            {visibleGroups.map((group) => <section key={group.label} className="mb-5"><p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{group.label}</p><div className="space-y-1">{group.items.map(({ name, href, Icon }) => {
              const active = isActivePath(pathname, href);
              return <Link key={href} href={href} onClick={closeMobile} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${active ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon size={15} className={active ? "text-blue-700" : "text-slate-400 group-hover:text-slate-600"} /><span>{name}</span></Link>;
            })}</div></section>)}
          </nav>
          <div className="border-t border-slate-100 p-4"><Link href="/terms" onClick={closeMobile} className="block rounded-xl bg-slate-50 p-3 text-[10px] font-semibold text-slate-600 hover:bg-slate-100">Termos e condições</Link><button type="button" onClick={() => { localStorage.removeItem("jwt_token"); router.replace("/login"); }} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 sm:hidden"><LogOut size={15} />Sair da conta</button></div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:px-8 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
