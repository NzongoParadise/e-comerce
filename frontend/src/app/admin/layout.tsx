"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, Building2, ClipboardList, FileCheck2, LayoutDashboard, Megaphone, MessageCircle, Package, ShieldCheck, ShoppingBag, Truck, Users, Wallet, X } from "lucide-react";
import { getDashboardDestination } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/api";
import WorkspaceHeader from "@/components/layout/WorkspaceHeader";

const groups = [
  { label: "Operação", items: [["Visão geral", "/admin", LayoutDashboard], ["Vendas", "/admin/orders", ShoppingBag], ["Pós-venda", "/admin/returns", ClipboardList], ["Produtos", "/admin/products", Package], ["Avaliações", "/admin/reviews", ClipboardList], ["Stock", "/admin/stock", Boxes], ["Fornecedores", "/admin/suppliers", Truck]] },
  { label: "B2B", items: [["Operação empresarial", "/admin/b2b", Building2]] },
  { label: "Atendimento", items: [["Chat de suporte", "/admin/support", MessageCircle]] },
  { label: "Clientes", items: [["Clientes", "/admin/clients", Users], ["Utilizadores", "/admin/users", Users]] },
  { label: "Financeiro", items: [["Visão financeira", "/admin/finance", Wallet], ["Pagamentos", "/admin/finance/payments", Wallet], ["Revisão de pagamentos", "/admin/finance/review", ShieldCheck], ["Reembolsos", "/admin/finance/refunds", Wallet], ["Faturas", "/admin/finance/invoices", FileCheck2], ["Notas de crédito", "/admin/finance/credit-notes", FileCheck2], ["Conciliação", "/admin/finance/reconciliation", ShieldCheck], ["Relatórios", "/admin/finance/reports", BarChart3]] },
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

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/auth/me")
      .then((response) => {
        if (!active) return;
        if (getDashboardDestination(response.data) === "/admin") setAuthorized(true);
        else router.replace("/account");
      })
      .catch(() => { if (active) router.replace("/login"); });
    return () => { active = false; };
  }, [router]);

  const activeGroup = useMemo(
    () => groups.find((group) => group.items.some((item) => isActivePath(pathname, item[1]))),
    [pathname],
  );
  const activeItem = activeGroup?.items.find((item) => isActivePath(pathname, item[1]));
  const closeMobile = () => setSidebarOpen(false);
  const initials = "AD";

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-sm text-slate-500">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#1d6ac4]" />
          A validar permissões administrativas...
        </div>
      </main>
    );
  }

  return (
    <div className="workspace-main admin-data-density min-h-screen text-slate-950">
      <WorkspaceHeader
        kind="admin"
        title="RUBRICA DILIGENTE"
        subtitle="Administração · Angola + Portugal"
        searchPlaceholder="Pesquisar encomendas, produtos ou clientes..."
        searchHref="/admin/orders?search="
        initials={initials}
        mobileLabel="menu administrativo"
        onMenu={() => setSidebarOpen(true)}
        actionHref="/admin/finance/review"
        actionLabel="Revisões"
        actionIcon="review"
      />

      <div className="flex min-h-[calc(100vh-108px)]">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Fechar menu administrativo"
            onClick={closeMobile}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
          />
        )}

        <aside className={`workspace-sidebar fixed inset-y-0 left-0 z-50 w-72 transform border-r bg-white pt-[108px] shadow-xl transition-transform lg:sticky lg:top-[108px] lg:z-30 lg:h-[calc(100vh-108px)] lg:w-[272px] lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:hidden">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Workspace</p>
                <span className="text-xs font-black text-slate-800">Administração</span>
              </div>
              <button type="button" onClick={closeMobile} className="workspace-icon-button" aria-label="Fechar menu">
                <X size={17} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação administrativa">
              {groups.map((group) => (
                <section key={group.label} className="workspace-nav-group">
                  <p className="workspace-nav-label mb-2">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map(([label, href, Icon]) => {
                      const active = isActivePath(pathname, href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={closeMobile}
                          aria-current={active ? "page" : undefined}
                          className={`workspace-nav-item ${active ? "is-active" : ""}`}
                        >
                          <Icon size={16} />
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          {label === "Revisão de pagamentos" && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-800">ATENÇÃO</span>
                          )}
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
                <p className="mt-1 truncate text-xs font-bold text-slate-800">{activeGroup?.label || "Administração"}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">{activeItem?.[0] || "Painel"}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="workspace-main min-w-0 flex-1">
          <div className="workspace-breadcrumb">
            <div className="mx-auto flex min-h-10 max-w-[1680px] items-center gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{activeGroup?.label || "Administração"}</span>
              <span className="text-slate-300">/</span>
              <span className="truncate text-[10px] font-bold text-slate-600">{activeItem?.[0] || "Painel"}</span>
            </div>
          </div>
          <div className="workspace-page px-3 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
