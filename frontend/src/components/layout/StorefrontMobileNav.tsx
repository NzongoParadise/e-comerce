"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Grid2X2, ShoppingCart, UserRound, Search } from "lucide-react";
import { useCart } from "@/context/CartContext";

const items = [
  { href: "/", label: "Início", Icon: House },
  { href: "/categories", label: "Categorias", Icon: Grid2X2 },
  { href: "/products", label: "Pesquisar", Icon: Search },
  { href: "/cart", label: "Carrinho", Icon: ShoppingCart },
  { href: "/account", label: "Conta", Icon: UserRound },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function StorefrontMobileNav() {
  const pathname = usePathname();
  const { cartCount } = useCart();

  return (
    <nav
      aria-label="Navegação rápida"
      className="storefront-mobile-nav fixed inset-x-3 bottom-3 z-[60] lg:hidden"
    >
      <div className="grid grid-cols-5 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-1 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          const showBadge = href === "/cart" && cartCount > 0;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[9px] font-bold transition " +
                (active
                  ? "bg-[#e8f0fc] text-[#1d6ac4]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")
              }
            >
              <span className="relative">
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                {showBadge && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e63946] px-1 text-[8px] font-black leading-none text-white">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
