import Link from "next/link";
import { Building2, FileText, LayoutDashboard, Package, Settings, ShoppingBag, Users } from "lucide-react";

const nav = [
  { href: "/b2b", label: "Visão geral", icon: LayoutDashboard },
  { href: "/b2b/catalogo", label: "Catálogo", icon: Package },
  { href: "/b2b/cotacoes", label: "Cotações", icon: FileText },
  { href: "/b2b/encomendas", label: "Encomendas", icon: ShoppingBag },
  { href: "/b2b/empresa", label: "Empresa", icon: Building2 },
  { href: "/b2b/utilizadores", label: "Utilizadores", icon: Users },
  { href: "/b2b/conta", label: "Definições", icon: Settings },
];

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <nav className="border-b border-gray-200 bg-white">
        <div className="container mx-auto flex items-center gap-2 overflow-x-auto px-4 py-3">
          <Link href="/b2b" className="mr-3 flex shrink-0 items-center gap-2 text-sm font-black text-[#0c1b2a]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0c1b2a] text-[#f6b73c]"><Building2 size={18} /></span>
            Área Empresarial
          </Link>
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-gray-600 hover:bg-[#eef4fb] hover:text-[#1d6ac4]">
              <Icon size={15} /> {label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
