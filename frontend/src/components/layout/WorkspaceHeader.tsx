"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  Home,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";

export type WorkspaceHeaderKind = "admin" | "account" | "b2b";

type WorkspaceHeaderProps = {
  kind: WorkspaceHeaderKind;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  searchHref: string;
  initials: string;
  mobileLabel: string;
  onMenu: () => void;
  actionHref?: string;
  actionLabel?: string;
  actionIcon?: "store" | "review" | "home";
};

const config = {
  admin: { mark: ShieldCheck, markText: "Admin", title: "RUBRICA DILIGENTE", tone: "Operação e controlo", links: [] as [string, string][] },
  account: { mark: ShoppingBag, markText: "Conta", title: "RUBRICA DILIGENTE", tone: "Conta do cliente", links: [
    ["Comprar", "/products"], ["Encomendas", "/account/orders"], ["Favoritos", "/favorites"], ["Cupões", "/account/coupons"], ["Suporte", "/account/support"], ["Notificações", "/notifications"],
  ] as [string, string][] },
  b2b: { mark: Building2, markText: "B2B", title: "RUBRICA DILIGENTE", tone: "Conta empresarial", links: [
    ["Catálogo", "/b2b/catalogo"], ["Carrinho", "/b2b/carrinho"], ["Cotações", "/b2b/cotacoes"], ["Encomendas", "/b2b/encomendas"], ["Financeiro", "/b2b/financeiro"], ["Notificações", "/b2b/notificacoes"], ["Empresa", "/b2b/empresa"],
  ] as [string, string][] },
} as const;

export default function WorkspaceHeader({
  kind,
  title,
  subtitle,
  searchPlaceholder,
  searchHref,
  initials,
  mobileLabel,
  onMenu,
  actionHref,
  actionLabel,
  actionIcon = "store",
}: WorkspaceHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const meta = config[kind];
  const Icon = meta.mark;

  function submitSearch(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(`${searchHref}${encodeURIComponent(trimmed)}`);
  }

  const ActionIcon =
    actionIcon === "review" ? ShieldCheck :
    actionIcon === "home" ? Home :
    Store;

  return (
    <header className="workspace-topbar sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-[0_8px_26px_rgba(15,23,42,0.05)] backdrop-blur-xl">
      <div className="flex min-h-[68px] items-center gap-3 px-3 sm:px-5 lg:px-6">
        <button
          type="button"
          onClick={onMenu}
          className="workspace-icon-button lg:hidden"
          aria-label={`Abrir ${mobileLabel}`}
        >
          <Menu size={18} />
        </button>

        <Link href={kind === "admin" ? "/admin" : kind === "b2b" ? "/b2b" : "/account"} className="workspace-brand">
          <span className="workspace-brand-mark">
            <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-[13px] font-black tracking-tight text-slate-950 sm:text-sm">
              {title}
            </strong>
            <span className="hidden text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:block">
              {subtitle}
            </span>
          </span>
        </Link>

        <div className="mx-1 hidden h-7 w-px bg-slate-200 lg:block" />

        <div className="min-w-0 flex-1">
          <div className="hidden max-w-3xl md:block">
            <label className="workspace-search">
              <Search size={16} aria-hidden="true" />
              <input
                defaultValue=""
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitSearch(event.currentTarget.value);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
              <span className="workspace-search-hint">Enter</span>
            </label>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {actionHref && actionLabel && (
            <Link
              href={actionHref}
              className="workspace-topbar-action hidden sm:inline-flex"
            >
              <ActionIcon size={14} />
              {actionLabel}
              {actionIcon === "store" && <ArrowUpRight size={13} />}
            </Link>
          )}

          <Link
            href={kind === "admin" ? "/admin/users" : kind === "b2b" ? "/b2b/empresa" : "/account/profile"}
            className="workspace-avatar"
            aria-label="Abrir perfil e definições"
          >
            {initials || "RD"}
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-100 px-3 py-2 md:hidden">
        <label className="workspace-search">
          <Search size={15} aria-hidden="true" />
          <input
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch(event.currentTarget.value);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </label>
      </div>

      <div className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex min-h-10 max-w-[1680px] items-center gap-1 overflow-x-auto px-3 sm:px-5 lg:px-7">
          <span className="mr-2 shrink-0 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{meta.markText}</span>
          {meta.links.map(([label, href]) => {
            const active = pathname === href || (href !== "/products" && pathname.startsWith(href + "/"));
            return <Link key={href} href={href} className={active ? "workspace-shortcut is-active" : "workspace-shortcut"}>{label}</Link>;
          })}
          <span className="ml-auto hidden shrink-0 items-center gap-1 pl-3 text-[9px] font-bold text-slate-400 xl:inline-flex"><ChevronRight size={11} /> {pathname === "/" ? meta.tone : subtitle}</span>
        </div>
      </div>
    </header>
  );
}
