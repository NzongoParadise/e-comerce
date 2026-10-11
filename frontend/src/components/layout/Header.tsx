"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Boxes, ChevronDown, FileText, Headphones, Heart, LayoutDashboard, LogOut, MapPin, Menu, Package, Search, Settings, ShoppingBag, ShoppingCart, UserRound, Users, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useMarket } from "@/context/MarketContext";
import { fetchWithAuth } from "@/lib/api";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { NotificationBell } from "@/components/layout/NotificationBell";

type Category = { id: number; name: string; slug: string };
type AccountProfile = { name?: string; email?: string; accessRole?: string; accountType?: string; isAdmin?: boolean };

const adminMenuItems = [
  { label: "Painel administrativo", href: "/admin", Icon: LayoutDashboard },
  { label: "Produtos", href: "/admin/products", Icon: Package },
  { label: "Gestão de stock", href: "/admin/stock", Icon: Boxes },
  { label: "Encomendas", href: "/admin/orders", Icon: ShoppingBag },
  { label: "Clientes", href: "/admin/clients", Icon: Users },
  { label: "Utilizadores e permissões", href: "/admin/users", Icon: Users },
];
const retailMenuItems = [
  { label: "A minha conta", href: "/account", Icon: UserRound },
  { label: "As minhas encomendas", href: "/account/orders", Icon: ShoppingBag },
  { label: "Os meus endereços", href: "/account/addresses", Icon: MapPin },
];
const wholesaleMenuItems = [
  { label: "Painel empresarial", href: "/b2b", Icon: LayoutDashboard },
  { label: "Encomendas", href: "/b2b/encomendas", Icon: ShoppingBag },
  { label: "Cotações", href: "/b2b/cotacoes", Icon: FileText },
  { label: "Dados da empresa", href: "/b2b/empresa", Icon: UserRound },
];
const internalMenuItems = [
  { label: "O meu perfil", href: "/account/profile", Icon: UserRound },
  { label: "Definições", href: "/account/settings", Icon: Settings },
  { label: "Ajuda e suporte", href: "/account/support", Icon: Headphones },
];
const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  CUSTOMER: "Cliente",
  SALES: "Vendas",
  SUPPORT: "Suporte",
  MARKETING: "Marketing",
  HR: "Recursos humanos",
};

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { market, setMarket } = useMarket();
  const { cartCount } = useCart();
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location, setLocation] = useState("Selecionar localização");
  const [locationLoading, setLocationLoading] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accessRole = profile?.accessRole?.toUpperCase() || "CUSTOMER";
  const isWholesale = accessRole === "CUSTOMER" && profile?.accountType?.toUpperCase() === "B2B";
  const profileMenuItems = profile?.isAdmin
    ? adminMenuItems
    : accessRole !== "CUSTOMER"
      ? internalMenuItems
      : isWholesale
        ? wholesaleMenuItems
        : retailMenuItems;
  const profileLabel = profile?.isAdmin
    ? "Administrador"
    : accessRole === "CUSTOMER"
      ? isWholesale ? "Cliente grossista" : "Cliente retalhista"
      : roleLabels[accessRole] || "Acesso interno";
  const profileMenuTitle = profile?.isAdmin
    ? "Painel administrativo"
    : isWholesale
      ? "Área empresarial"
      : accessRole === "CUSTOMER"
        ? "Conta e listas"
        : "Acesso interno";

  useEffect(() => {
    fetchWithAuth("/api/categories").then((response) => setCategories(response.data)).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    if (!localStorage.getItem("jwt_token")) {
      return () => { active = false; };
    }
    fetchWithAuth("/api/auth/me")
      .then((response) => { if (active) setProfile(response.data); })
      .catch(() => { if (active) setProfile(null); });
    return () => { active = false; };
  }, [pathname]);

  function logout() {
    localStorage.removeItem("jwt_token");
    setProfile(null);
    setAccountMenuOpen(false);
    router.push("/");
  }

  function searchCatalog(event?: React.FormEvent) {
    event?.preventDefault();
    if (search.trim()) router.push(`/products?q=${encodeURIComponent(search.trim())}`);
  }

  function requestLocation() {
    if (!navigator.geolocation) { setLocation("Localização indisponível"); return; }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetchWithAuth(`/api/location/reverse?latitude=${coords.latitude}&longitude=${coords.longitude}`);
        const data = response.data;
        setLocation([data.city, data.region].filter(Boolean).join(", ") || data.country || "Localização encontrada");
      } catch { setLocation("Não foi possível localizar"); }
      finally { setLocationLoading(false); }
    }, () => { setLocation("Permissão necessária"); setLocationLoading(false); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  }

  return <header className="storefront-header sticky top-0 z-50 w-full border-b border-[#e4e9e6] bg-white">
    <div className="bg-[#f5f7f6] text-[#52615d]"><div className="container mx-auto flex items-center justify-between gap-3 px-4 py-1.5 text-[11px]"><span className="hidden font-medium sm:block">Tecnologia para Angola e Portugal</span><div className="ml-auto flex items-center gap-3"><button type="button" onClick={() => setMarket("AO")} className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${market === "AO" ? "font-semibold text-[#087e76]" : "text-[#71807c] hover:text-[#263a36]"}`}><span aria-label="Bandeira de Angola" role="img">🇦🇴</span>Angola · Kz</button><span className="text-[#cbd4d0]">|</span><button type="button" onClick={() => setMarket("PT")} className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${market === "PT" ? "font-semibold text-[#087e76]" : "text-[#71807c] hover:text-[#263a36]"}`}><span aria-label="Bandeira de Portugal" role="img">🇵🇹</span>Portugal · €</button><Link href="/info/support" className="ml-2 hidden text-[#52615d] hover:text-[#087e76] md:block">Ajuda e suporte</Link><Link href="/b2b" className="hidden text-[#52615d] hover:text-[#087e76] lg:block">Para empresas</Link></div></div></div>
    <div className="bg-white text-[#263a36]"><div className="container mx-auto flex flex-wrap items-center gap-x-2 gap-y-2 px-2 py-2 sm:flex-nowrap sm:gap-4 sm:px-4 sm:py-3">
      <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} className="order-1 rounded-lg p-1.5 text-[#263a36] hover:bg-[#f1f5f3] sm:order-none sm:p-2 lg:hidden" aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}>{mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      <div className="order-2 sm:order-none"><BrandLogo className="sm:gap-2" /></div>
      <button type="button" onClick={requestLocation} disabled={locationLoading} className="hidden shrink-0 items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-[#f1f5f3] lg:flex"><MapPin size={19} className="text-[#087e76]" /><span className="max-w-32 leading-tight"><small className="block text-[9px] text-[#71807c]">Entregar em</small><strong className="block truncate text-xs">{locationLoading ? "A localizar..." : location}</strong></span></button>
      <form onSubmit={searchCatalog} className="order-4 flex min-w-0 basis-full overflow-hidden rounded-xl border border-[#d9e2de] bg-white sm:order-none sm:basis-0 sm:flex-1"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que procuras?" aria-label="Pesquisar produtos" className="min-w-0 flex-1 border-0 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 sm:px-4" /><button type="submit" className="flex w-11 shrink-0 items-center justify-center bg-[#087e76] text-white transition hover:bg-[#066a64] sm:w-12" aria-label="Buscar produtos"><Search size={19} strokeWidth={2.5} /></button></form>
      <nav className="order-3 ml-auto flex shrink-0 items-center gap-0 sm:order-none sm:ml-0 sm:gap-1">
        <div className="relative">
          {profile ? (
            <>
              <button type="button" onClick={() => setAccountMenuOpen((open) => !open)} aria-expanded={accountMenuOpen} aria-label={`Conta de ${profile.name || profile.email || "cliente"}`} className="flex items-center gap-2 rounded-xl p-1.5 text-left hover:bg-[#f1f5f3] sm:p-2">
                <UserRound size={20} />
                <span className="hidden text-[10px] font-semibold leading-tight sm:block">
                  <span className="block text-[#71807c]">Olá, {profile.name?.trim().split(/\s+/)[0] || "cliente"}</span>
                  <strong className="whitespace-nowrap text-[#263a36]">{profileMenuTitle}</strong>
                </span>
                <ChevronDown size={13} className="hidden sm:block" />
              </button>
              {accountMenuOpen && <div className="absolute right-0 top-full z-60 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white py-2 text-gray-900 shadow-[0_20px_45px_rgba(15,23,42,0.14)]">
                <div className="border-b border-gray-100 px-4 pb-3 pt-2">
                  <p className="text-sm font-bold">Olá, {profile.name || "cliente"}</p>
                  {profile.email && <p className="mt-0.5 truncate text-xs text-gray-500">{profile.email}</p>}
                  <p className="mt-2 text-[10px] font-bold uppercase text-blue-700">{profileLabel}</p>
                </div>
                {profileMenuItems.map(({ label, href, Icon }) => (
                  <Link key={href} href={href} onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50">
                    <Icon size={15} className="text-gray-500" />{label}
                  </Link>
                ))}
                <button type="button" onClick={logout} className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"><LogOut size={15} />Terminar sessão</button>
              </div>}
            </>
          ) : <div className="flex items-center gap-1"><Link href="/login" aria-label="Entrar na conta" className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-[#f1f5f3] sm:p-2"><UserRound size={20} /><span className="hidden text-[10px] font-semibold xl:block">Entrar<br />Conta</span></Link><Link href="/register" className="hidden rounded-lg bg-[#087e76] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#066a64] xl:block">Criar conta</Link></div> }
        </div>
        {profile && <NotificationBell />}
        <Link href="/favorites" className="rounded-xl p-1.5 hover:bg-[#f1f5f3] sm:p-2" aria-label="Favoritos"><Heart size={20} /></Link>
        <Link href="/compare" className="hidden rounded-xl p-2 hover:bg-[#f1f5f3] sm:block" aria-label="Comparar produtos"><ArrowLeftRight size={19} /></Link>
        <Link href="/cart" className="relative rounded-xl p-1.5 hover:bg-[#f1f5f3] sm:p-2" aria-label={`Carrinho, ${cartCount} artigos`}><ShoppingCart size={21} />{cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#087e76] px-1 text-[9px] font-black text-white">{cartCount}</span>}</Link>
      </nav>
    </div></div>
    <div className="hidden border-t border-[#edf0ee] bg-white text-[#52615d] lg:block"><div className="container mx-auto flex items-center px-4"><div className="relative"><button type="button" onClick={() => setCategoriesOpen((open) => !open)} aria-expanded={categoriesOpen} className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-[#263a36] hover:text-[#087e76]"><Menu size={16} />Todas as categorias<ChevronDown size={13} className={`transition-transform ${categoriesOpen ? "rotate-180" : ""}`} /></button>{categoriesOpen && <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 text-gray-800 shadow-[0_20px_45px_rgba(15,23,42,0.14)]">{categories.map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} onClick={() => setCategoriesOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm transition hover:bg-[#e5f2ed] hover:text-[#087e76]">{category.name}</Link>)}<Link href="/categories" onClick={() => setCategoriesOpen(false)} className="mt-1 block rounded-lg border-t border-gray-100 px-3 py-2.5 text-xs font-semibold text-[#087e76]">Ver todas as categorias</Link></div>}</div><div className="flex min-w-0 flex-1 items-center overflow-x-auto">{categories.slice(0, 8).map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-[#52615d] transition hover:text-[#087e76]">{category.name}</Link>)}<Link href="/promotions" className="ml-auto shrink-0 rounded-lg bg-[#e5f2ed] px-4 py-2.5 text-xs font-semibold text-[#087e76] transition hover:bg-[#d6ebe3]">Ofertas</Link></div></div></div>
    {mobileMenuOpen && <div className="absolute inset-x-0 top-full z-50 border-b border-gray-200 bg-white p-3 shadow-lg lg:hidden"><button type="button" onClick={requestLocation} className="mb-2 flex w-full items-center gap-2 border-b border-gray-100 px-3 py-3 text-left text-xs text-gray-600"><MapPin size={17} className="text-[#1d6ac4]" />{locationLoading ? "A localizar..." : `Entregar em ${location}`}</button>{categories.map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">{category.name}</Link>)}<Link href="/promotions" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-sm font-black text-[#1d6ac4]">Ofertas</Link><Link href="/b2b" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-sm font-black text-[#1d6ac4]">Para empresas</Link><Link href="/info/support" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Ajuda e suporte</Link><div className="grid grid-cols-2 gap-2 border-t border-gray-100 p-3"><Link href="/login" onClick={() => setMobileMenuOpen(false)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-center text-xs font-bold">Entrar</Link><Link href="/register" onClick={() => setMobileMenuOpen(false)} className="rounded-xl bg-[#1d6ac4] px-3 py-2.5 text-center text-xs font-bold text-white">Criar conta</Link></div></div>}
  </header>;
}
