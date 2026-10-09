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
      className="storefront-mobile-nav fixed inset-x-0 bottom-0 z-[60] border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.1)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-xl grid-cols-5 px-2 pt-2 pb-1">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          const showBadge = href === "/cart" && cartCount > 0;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition " +
                (active
                  ? "text-[#8a5b00] after:absolute after:left-1/2 after:top-0 after:h-0.5 after:w-8 after:-translate-x-1/2 after:rounded-full after:bg-[#f5a800]"
                  : "text-slate-500 hover:text-slate-900")
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
