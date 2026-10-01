"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Boxes, ChevronDown, FileText, Headphones, Heart, LayoutDashboard, LogOut, MapPin, Menu, Monitor, Package, Search, Settings, ShoppingBag, ShoppingCart, UserRound, Users, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useMarket } from "@/context/MarketContext";
import { fetchWithAuth } from "@/lib/api";

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
  { label: "Painel empresarial", href: "/account", Icon: LayoutDashboard },
  { label: "Encomendas", href: "/account/orders", Icon: ShoppingBag },
  { label: "Cotações", href: "/account/quotes", Icon: FileText },
  { label: "Dados da empresa", href: "/account/profile", Icon: UserRound },
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

  return <header className="sticky top-0 z-50 w-full shadow-sm">
    <div className="bg-[#131921] text-gray-200"><div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2 text-[11px]"><span className="hidden font-semibold sm:block">Tecnologia para Angola e Portugal</span><div className="ml-auto flex items-center gap-3"><button type="button" onClick={() => setMarket("AO")} className={`flex items-center gap-1.5 ${market === "AO" ? "font-bold text-white" : "text-gray-400 hover:text-white"}`}><span aria-label="Bandeira de Angola" role="img">🇦🇴</span>Angola · Kz</button><span className="text-white/20">|</span><button type="button" onClick={() => setMarket("PT")} className={`flex items-center gap-1.5 ${market === "PT" ? "font-bold text-white" : "text-gray-400 hover:text-white"}`}><span aria-label="Bandeira de Portugal" role="img">🇵🇹</span>Portugal · €</button><Link href="/account/support" className="ml-2 hidden text-gray-300 hover:text-white md:block">Apoio ao cliente</Link></div></div></div>
    <div className="border-b border-gray-200 bg-[#232f3e] text-white"><div className="container mx-auto flex flex-wrap items-center gap-x-2 gap-y-2 px-2 py-2 sm:flex-nowrap sm:gap-4 sm:px-4 sm:py-3">
      <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} className="order-1 p-1.5 text-white hover:bg-white/10 sm:order-none sm:p-2 lg:hidden" aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}>{mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      <Link href="/" className="order-2 flex shrink-0 items-center gap-1.5 sm:order-none sm:gap-2"><span className="flex h-8 w-8 items-center justify-center bg-[#f6b73c] text-[#132238] sm:h-9 sm:w-9"><Monitor size={20} strokeWidth={2.5} /></span><span className="leading-tight"><strong className="block text-sm font-black tracking-tight sm:text-lg">TechGlobal</strong><small className="hidden text-[8px] font-bold uppercase tracking-widest text-blue-100 sm:block">Tecnologia sem fronteiras</small></span></Link>
      <button type="button" onClick={requestLocation} disabled={locationLoading} className="hidden shrink-0 items-center gap-2 px-1 py-2 text-left hover:bg-white/10 lg:flex"><MapPin size={19} className="text-[#f6b73c]" /><span className="max-w-32 leading-tight"><small className="block text-[9px] text-gray-300">Entregar em</small><strong className="block truncate text-xs">{locationLoading ? "A localizar..." : location}</strong></span></button>
      <form onSubmit={searchCatalog} className="order-4 flex min-w-0 basis-full sm:order-none sm:basis-0 sm:flex-1"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que procuras?" aria-label="Pesquisar produtos" className="min-w-0 flex-1 border-0 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 sm:px-4" /><button type="submit" className="flex w-11 shrink-0 items-center justify-center bg-[#f6b73c] text-[#132238] hover:bg-[#ffd166] sm:w-12" aria-label="Buscar produtos"><Search size={19} strokeWidth={2.5} /></button></form>
      <nav className="order-3 ml-auto flex shrink-0 items-center gap-0 sm:order-none sm:ml-0 sm:gap-1">
        <div className="relative">
          {profile ? (
            <>
              <button type="button" onClick={() => setAccountMenuOpen((open) => !open)} aria-expanded={accountMenuOpen} aria-label={`Conta de ${profile.name || profile.email || "cliente"}`} className="flex items-center gap-2 p-1.5 text-left hover:bg-white/10 sm:p-2">
                <UserRound size={20} />
                <span className="hidden text-[10px] font-semibold leading-tight sm:block">
                  <span className="block text-gray-300">Olá, {profile.name?.trim().split(/\s+/)[0] || "cliente"}</span>
                  <strong className="whitespace-nowrap text-white">{profileMenuTitle}</strong>
                </span>
                <ChevronDown size={13} className="hidden sm:block" />
              </button>
              {accountMenuOpen && <div className="absolute right-0 top-full z-60 mt-1 w-64 border border-gray-200 bg-white py-2 text-gray-900 shadow-xl">
                <div className="border-b border-gray-100 px-4 pb-3">
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
          ) : <Link href="/login" aria-label="Entrar na conta" className="flex items-center gap-2 p-1.5 hover:bg-white/10 sm:p-2"><UserRound size={20} /><span className="hidden text-[10px] font-semibold xl:block">Entrar<br />Conta</span></Link>}
        </div>
        <Link href="/favorites" className="p-1.5 hover:bg-white/10 sm:p-2" aria-label="Favoritos"><Heart size={20} /></Link>
        <Link href="/compare" className="hidden p-2 hover:bg-white/10 sm:block" aria-label="Comparar produtos"><ArrowLeftRight size={19} /></Link>
        <Link href="/cart" className="relative p-1.5 hover:bg-white/10 sm:p-2" aria-label={`Carrinho, ${cartCount} artigos`}><ShoppingCart size={21} />{cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f6b73c] px-1 text-[9px] font-black text-[#132238]">{cartCount}</span>}</Link>
      </nav>
    </div></div>
    <div className="hidden bg-[#1b2735] text-white lg:block"><div className="container mx-auto flex items-center px-4"><div className="relative"><button type="button" onClick={() => setCategoriesOpen((open) => !open)} aria-expanded={categoriesOpen} className="flex items-center gap-2 bg-[#131921] px-4 py-3 text-xs font-black hover:bg-black"><Menu size={16} />Todas as categorias<ChevronDown size={13} className={`transition-transform ${categoriesOpen ? "rotate-180" : ""}`} /></button>{categoriesOpen && <div className="absolute left-0 top-full z-50 w-64 border border-gray-200 bg-white p-2 text-gray-800 shadow-xl">{categories.map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} onClick={() => setCategoriesOpen(false)} className="block px-3 py-2.5 text-sm hover:bg-[#e8f0fc] hover:text-[#1d6ac4]">{category.name}</Link>)}<Link href="/categories" onClick={() => setCategoriesOpen(false)} className="mt-1 block border-t border-gray-100 px-3 py-2.5 text-xs font-bold text-[#1d6ac4]">Ver todas as categorias</Link></div>}</div><div className="flex min-w-0 flex-1 items-center overflow-x-auto">{categories.slice(0, 8).map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-gray-200 hover:bg-white/10 hover:text-white">{category.name}</Link>)}<Link href="/promotions" className="ml-auto shrink-0 bg-[#f6b73c] px-4 py-3 text-xs font-black text-[#132238] hover:bg-[#ffd166]">Ofertas</Link></div></div></div>
    {mobileMenuOpen && <div className="absolute inset-x-0 top-full z-50 border-b border-gray-200 bg-white p-3 shadow-lg lg:hidden"><button type="button" onClick={requestLocation} className="mb-2 flex w-full items-center gap-2 border-b border-gray-100 px-3 py-3 text-left text-xs text-gray-600"><MapPin size={17} className="text-[#1d6ac4]" />{locationLoading ? "A localizar..." : `Entregar em ${location}`}</button>{categories.map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">{category.name}</Link>)}<Link href="/promotions" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-sm font-black text-[#1d6ac4]">Ofertas</Link></div>}
  </header>;
}
