"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Home, Package, UserRound, MapPin, CreditCard, Heart, Headphones, RefreshCcw, Tags, Users, Settings, FileText, LogOut, Boxes, X, ShoppingBag } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import WorkspaceHeader from "@/components/layout/WorkspaceHeader";

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

  useEffect(() => {
    fetchWithAuth("/api/auth/me")
      .then((response) => setProfile(response.data))
      .catch(() => setProfile(null))
      .finally(() => setProfileResolved(true));
  }, []);

  useEffect(() => {
    if (profileResolved && !profile && pathname !== "/account/support") router.replace("/login");
  }, [pathname, profile, profileResolved, router]);

  if (pathname === "/account/support" && profileResolved && !profile) return <>{children}</>;
  if (profileResolved && !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-sm text-slate-500">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">A redirecionar para o login...</div>
      </main>
    );
  }

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(({ href }) => {
        if (href === "/account/users" || href === "/admin/stock") return profile?.isAdmin === true;
        return true;
      }),
    }))
    .filter((group) => group.items.length);

  const activeGroup = useMemo(
    () => visibleGroups.find((group) => group.items.some((item) => isActivePath(pathname, item.href))),
    [pathname, profile?.isAdmin],
  );
  const activeItem = activeGroup?.items.find((item) => isActivePath(pathname, item.href));
  const initials = (profile?.name || profile?.email || "CL")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  const closeMobile = () => setSidebarOpen(false);

  return (
    <div className="workspace-main min-h-screen text-slate-950">
      <WorkspaceHeader
        kind="account"
        title="RUBRICA DILIGENTE"
        subtitle={profile?.accountType === "B2B" ? "Conta empresarial · Angola + Portugal" : "Conta de cliente · Angola + Portugal"}
        searchPlaceholder="Pesquisar produtos, encomendas ou ajuda..."
        searchHref="/products?q="
        initials={initials}
        mobileLabel="menu da conta"
        onMenu={() => setSidebarOpen(true)}
        actionHref="/products"
        actionLabel="Continuar a comprar"
        actionIcon="store"
      />

      <div className="flex min-h-[calc(100vh-108px)]">
        {sidebarOpen && <button type="button" aria-label="Fechar menu" onClick={closeMobile} className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] lg:hidden" />}
        <aside className={`workspace-sidebar fixed inset-y-0 left-0 z-50 w-72 transform border-r bg-white pt-[108px] shadow-xl transition-transform lg:sticky lg:top-[108px] lg:z-30 lg:h-[calc(100vh-108px)] lg:w-[272px] lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:hidden">
              <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Workspace</p><span className="text-xs font-black text-slate-800">{profile?.accountType === "B2B" ? "Conta empresarial" : "Minha conta"}</span></div>
              <button type="button" onClick={closeMobile} className="workspace-icon-button" aria-label="Fechar menu"><X size={17} /></button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação da conta">
              {visibleGroups.map((group) => (
                <section key={group.label} className="workspace-nav-group">
                  <p className="workspace-nav-label mb-2">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map(({ name, href, Icon }) => {
                      const active = isActivePath(pathname, href);
                      return (
                        <Link key={href} href={href} onClick={closeMobile} aria-current={active ? "page" : undefined} className={`workspace-nav-item ${active ? "is-active" : ""}`}>
                          <Icon size={16} />
                          <span className="min-w-0 flex-1 truncate">{name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </nav>

            <div className="border-t border-slate-100 p-4">
              <div className="workspace-context-card">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Área atual</p>
                <p className="mt-1 truncate text-xs font-bold text-slate-800">{activeGroup?.label || "Conta"}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">{activeItem?.name || "Painel"}</p>
              </div>
              <Link href="/logout" onClick={closeMobile} className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50">
                <LogOut size={15} /> Sair da conta
              </Link>
            </div>
          </div>
        </aside>

        <main className="workspace-main min-w-0 flex-1">
          <div className="workspace-breadcrumb">
            <div className="mx-auto flex min-h-10 max-w-[1680px] items-center gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{activeGroup?.label || "Conta"}</span>
              <span className="text-slate-300">/</span>
              <span className="truncate text-[10px] font-bold text-slate-600">{activeItem?.name || "Painel"}</span>
            </div>
          </div>
          <div className="account-admin-fields workspace-page px-3 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
