"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, LayoutDashboard, Package, Settings, ShoppingBag, Users, WalletCards, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { fetchWithAuth } from "@/lib/api";
import WorkspaceHeader from "@/components/layout/WorkspaceHeader";

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
  const [authResolved, setAuthResolved] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    if (!localStorage.getItem("jwt_token")) {
      setAuthResolved(true);
      return () => { active = false; };
    }
    fetchWithAuth("/api/auth/me")
      .then((response) => {
        if (!active) return;
        const accountType = String(response.data?.accountType || "").toUpperCase();
        if (accountType === "B2B") setAuthenticated(true);
        else window.location.replace("/account");
      })
      .catch(() => { if (active) setAuthenticated(false); })
      .finally(() => { if (active) setAuthResolved(true); });
    return () => { active = false; };
  }, []);

  const activeGroup = useMemo(() => groups.find((group) => group.items.some((item) => isActive(pathname, item.href))), [pathname]);
  const activeItem = activeGroup?.items.find((item) => isActive(pathname, item.href));
  const closeMobile = () => setSidebarOpen(false);

  if (!authResolved) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] text-sm text-slate-500"><div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">A carregar a área empresarial...</div></div>;
  }

  if (!authenticated) return <><Header /><main className="flex-1">{children}</main><Footer /></>;

  return (
    <div className="marketplace-workspace workspace-main min-h-screen text-slate-950">
      <WorkspaceHeader
        kind="b2b"
        title="RUBRICA DILIGENTE"
        subtitle="B2B · Angola + Portugal"
        searchPlaceholder="Pesquisar no catálogo, encomendas ou cotações..."
        searchHref="/b2b/catalogo?search="
        initials="B2"
        mobileLabel="menu empresarial"
        onMenu={() => setSidebarOpen(true)}
        actionHref="/products"
        actionLabel="Loja"
        actionIcon="store"
      />

      <div className="flex min-h-[calc(100vh-108px)]">
        {sidebarOpen && <button type="button" aria-label="Fechar menu empresarial" onClick={closeMobile} className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] lg:hidden" />}

        <aside className={`workspace-sidebar fixed inset-y-0 left-0 z-50 w-72 transform border-r bg-white pt-[108px] shadow-xl transition-transform lg:sticky lg:top-[108px] lg:z-30 lg:h-[calc(100vh-108px)] lg:w-[272px] lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:hidden">
              <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Workspace</p><span className="text-xs font-black text-slate-800">Área empresarial</span></div>
              <button type="button" onClick={closeMobile} className="workspace-icon-button" aria-label="Fechar menu"><X size={17} /></button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação B2B">
              {groups.map((group) => (
                <section key={group.label} className="workspace-nav-group">
                  <p className="workspace-nav-label mb-2">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map(({ href, label, Icon }) => {
                      const active = isActive(pathname, href);
                      return (
                        <Link key={href} href={href} onClick={closeMobile} aria-current={active ? "page" : undefined} className={`workspace-nav-item ${active ? "is-active" : ""}`}>
                          <Icon size={16} />
                          <span className="min-w-0 flex-1 truncate">{label}</span>
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
                <p className="mt-1 truncate text-xs font-bold text-slate-800">{activeGroup?.label || "Empresa"}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">{activeItem?.label || "Painel"}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="workspace-main min-w-0 flex-1">
          <div className="workspace-breadcrumb">
            <div className="mx-auto flex min-h-10 max-w-[1680px] items-center gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{activeGroup?.label || "Empresa"}</span>
              <span className="text-slate-300">/</span>
              <span className="truncate text-[10px] font-bold text-slate-600">{activeItem?.label || "Painel"}</span>
            </div>
          </div>
          <div className="account-admin-fields workspace-page px-3 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
