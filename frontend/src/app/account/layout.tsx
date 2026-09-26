"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import type { LucideIcon } from "lucide-react";
import {
  Home, Package, UserRound, MapPin, CreditCard, Heart,
  Headphones, RefreshCcw, Tags, Users, Settings, FileText, LogOut,
  Boxes,
} from "lucide-react";

type NavItem = { name: string; href: string; Icon: LucideIcon };

const navItems: NavItem[] = [
  { name: "Visão geral",              href: "/account",           Icon: Home },
  { name: "As minhas encomendas",     href: "/account/orders",    Icon: Package },
  { name: "Cotações",                 href: "/account/quotes",     Icon: FileText },
  { name: "Dados da conta",           href: "/account/profile",   Icon: UserRound },
  { name: "Endereços",                href: "/account/addresses", Icon: MapPin },
  { name: "Métodos de pagamento",     href: "/account/payment",   Icon: CreditCard },
  { name: "Lista de favoritos",       href: "/favorites",         Icon: Heart },
  { name: "Ajuda e suporte",          href: "/account/support",   Icon: Headphones },
  { name: "Devoluções e reclamações", href: "/account/returns",   Icon: RefreshCcw },
  { name: "Os meus cupões",           href: "/account/coupons",   Icon: Tags },
  { name: "Gestão de utilizadores",   href: "/account/users",       Icon: Users },
  { name: "Gestão de stock",          href: "/admin/stock",        Icon: Boxes },
  { name: "Definições",               href: "/account/settings",  Icon: Settings },
  { name: "Termos e condições",       href: "/terms",             Icon: FileText },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<{ name?: string; email?: string; accountName?: string; accountType?: string } | null>(null);

  useEffect(() => {
    fetchWithAuth("/api/auth/me").then((response) => {
      setProfile(response.data);
    }).catch(() => setProfile(null));
  }, []);

  const initials = (profile?.name || profile?.email || "TG")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1">
        <Link href="/" className="hover:text-[#1d6ac4]">Início</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">Conta</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Sidebar */}
        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-bold">
                {initials}
              </div>
              <div>
                <div className="font-bold text-gray-900">{profile?.name || profile?.email}</div>
                <div className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded uppercase inline-block mt-1">
                  {profile?.accountName} ({profile?.accountType})
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <nav className="flex flex-col py-2">
              {navItems.map(({ name, href, Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={name}
                    href={href}
                    className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? "text-[#1d6ac4] bg-blue-50/50 border-r-4 border-[#1d6ac4]"
                        : "text-gray-600 hover:text-[#1d6ac4] hover:bg-gray-50 border-r-4 border-transparent"
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                    {name}
                  </Link>
                );
              })}

              <div className="h-px bg-gray-100 my-2 mx-4" />

              <Link href="/logout" className="flex items-center gap-3 px-6 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
                Sair da conta
              </Link>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {children}
        </div>
        
      </div>
    </div>
  );
}
