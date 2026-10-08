"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Bell, Boxes, ChevronDown, FileText, Headphones, Heart, LayoutDashboard, LogOut, MapPin, Menu, Monitor, Package, Search, Settings, ShoppingBag, ShoppingCart, UserRound, Users, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useMarket } from "@/context/MarketContext";
import { fetchWithAuth } from "@/lib/api";
import { BrandLogo } from "@/components/ui/BrandLogo";

type Category = { id: number; name: string; slug: string };
type AccountProfile = { name?: string; email?: string; accessRole?: string; accountType?: string; isAdmin?: boolean };
type NotificationItem = { id: number; type: string; title: string; message: string; link?: string | null; readAt?: string | null; createdAt: string };

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
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
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

  useEffect(() => {
    if (!profile) { setNotifications([]); return; }
    let active = true;
    setNotificationLoading(true);
    fetchWithAuth("/api/notifications")
      .then((response) => { if (active) setNotifications(response.data || []); })
      .catch(() => { if (active) setNotifications([]); })
      .finally(() => { if (active) setNotificationLoading(false); });
    return () => { active = false; };
  }, [profile?.email]);

  async function markNotificationRead(id: number) {
    try {
      await fetchWithAuth("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch { /* Keep the notification unread when the request fails. */ }
  }

  async function markAllNotificationsRead() {
    try {
      await fetchWithAuth("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    } catch { /* Keep current state when the request fails. */ }
  }

  function notificationDate(value: string) {
    return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  }

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

  return <header className="sticky top-0 z-50 w-full shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
    <div className="bg-[#131921] text-gray-200"><div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2 text-[11px]"><span className="hidden font-semibold sm:block">Tecnologia para Angola e Portugal</span><div className="ml-auto flex items-center gap-3"><button type="button" onClick={() => setMarket("AO")} className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${market === "AO" ? "font-bold text-white bg-white/5" : "text-gray-400 hover:text-white"}`}><span aria-label="Bandeira de Angola" role="img">🇦🇴</span>Angola · Kz</button><span className="text-white/20">|</span><button type="button" onClick={() => setMarket("PT")} className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${market === "PT" ? "font-bold text-white bg-white/5" : "text-gray-400 hover:text-white"}`}><span aria-label="Bandeira de Portugal" role="img">🇵🇹</span>Portugal · €</button><Link href="/info/support" className="ml-2 hidden text-gray-300 hover:text-white md:block">Ajuda e suporte</Link><Link href="/b2b" className="hidden text-gray-300 hover:text-white lg:block">Para empresas</Link></div></div></div>
    <div className="border-b border-white/10 bg-[#232f3e] text-white backdrop-blur-sm"><div className="container mx-auto flex flex-wrap items-center gap-x-2 gap-y-2 px-2 py-2 sm:flex-nowrap sm:gap-4 sm:px-4 sm:py-3">
      <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} className="order-1 rounded-lg p-1.5 text-white hover:bg-white/10 sm:order-none sm:p-2 lg:hidden" aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}>{mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      <div className="order-2 sm:order-none"><BrandLogo dark className="sm:gap-2" /></div>
      <button type="button" onClick={requestLocation} disabled={locationLoading} className="hidden shrink-0 items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-white/10 lg:flex"><MapPin size={19} className="text-[#f6b73c]" /><span className="max-w-32 leading-tight"><small className="block text-[9px] text-gray-300">Entregar em</small><strong className="block truncate text-xs">{locationLoading ? "A localizar..." : location}</strong></span></button>
      <form onSubmit={searchCatalog} className="order-4 flex min-w-0 basis-full overflow-hidden rounded-xl border border-transparent bg-white shadow-sm sm:order-none sm:basis-0 sm:flex-1"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que procuras?" aria-label="Pesquisar produtos" className="min-w-0 flex-1 border-0 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 sm:px-4" /><button type="submit" className="flex w-11 shrink-0 items-center justify-center bg-[#f6b73c] text-[#132238] transition hover:bg-[#ffd166] sm:w-12" aria-label="Buscar produtos"><Search size={19} strokeWidth={2.5} /></button></form>
      <nav className="order-3 ml-auto flex shrink-0 items-center gap-0 sm:order-none sm:ml-0 sm:gap-1">
        <div className="relative">
          {profile ? (
            <>
              <button type="button" onClick={() => setAccountMenuOpen((open) => !open)} aria-expanded={accountMenuOpen} aria-label={`Conta de ${profile.name || profile.email || "cliente"}`} className="flex items-center gap-2 rounded-xl p-1.5 text-left hover:bg-white/10 sm:p-2">
                <UserRound size={20} />
                <span className="hidden text-[10px] font-semibold leading-tight sm:block">
                  <span className="block text-gray-300">Olá, {profile.name?.trim().split(/\s+/)[0] || "cliente"}</span>
                  <strong className="whitespace-nowrap text-white">{profileMenuTitle}</strong>
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
          ) : <div className="flex items-center gap-1"><Link href="/login" aria-label="Entrar na conta" className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-white/10 sm:p-2"><UserRound size={20} /><span className="hidden text-[10px] font-semibold xl:block">Entrar<br />Conta</span></Link><Link href="/register" className="hidden rounded-xl bg-white px-3 py-2 text-[10px] font-black text-[#132238] hover:bg-[#f6b73c] xl:block">Criar conta</Link></div> }
        </div>
        <div className="relative">
          {profile && <button type="button" onClick={() => { setNotificationMenuOpen((open) => !open); setAccountMenuOpen(false); }} aria-expanded={notificationMenuOpen} aria-label="Notificações" className="relative rounded-xl p-1.5 hover:bg-white/10 sm:p-2">
            <Bell size={20} />
            {notifications.some((item) => !item.readAt) && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f6b73c] px-1 text-[9px] font-black text-[#132238]">{notifications.filter((item) => !item.readAt).length > 99 ? "99+" : notifications.filter((item) => !item.readAt).length}</span>}
          </button>}
          {profile && notificationMenuOpen && <div className="absolute right-0 top-full z-60 mt-2 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-[0_20px_45px_rgba(15,23,42,0.14)]">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div><p className="text-sm font-bold">Notificações</p><p className="text-[10px] text-gray-500">{notifications.filter((item) => !item.readAt).length} não lidas</p></div>{notifications.some((item) => !item.readAt) && <button type="button" onClick={markAllNotificationsRead} className="text-[10px] font-bold text-[#1d6ac4] hover:underline">Marcar todas como lidas</button>}</div>
            <div className="max-h-96 overflow-y-auto">
              {notificationLoading ? <p className="px-4 py-8 text-center text-xs text-gray-500">A carregar notificações...</p> :
                notifications.length === 0 ? <div className="px-4 py-8 text-center"><Bell size={22} className="mx-auto text-gray-300" /><p className="mt-2 text-xs font-semibold text-gray-600">Não tem notificações.</p><p className="mt-1 text-[10px] text-gray-400">Novidades e atualizações da sua conta aparecerão aqui.</p></div> :
                notifications.slice(0, 8).map((item) => <div key={item.id} className={`border-b border-gray-50 px-4 py-3 last:border-b-0 ${item.readAt ? "bg-white" : "bg-blue-50/60"}`}>
                  <div className="flex items-start gap-3"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.readAt ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-[#1d6ac4]"}`}><Bell size={15} /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-gray-900">{item.title}</p><p className="mt-0.5 text-[11px] leading-4 text-gray-600">{item.message}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[9px] text-gray-400">{notificationDate(item.createdAt)}</span><div className="flex items-center gap-2">{!item.readAt && <button type="button" onClick={() => markNotificationRead(item.id)} className="text-[9px] font-bold text-[#1d6ac4] hover:underline">Marcar como lida</button>}{item.link && <Link href={item.link} onClick={() => { if (!item.readAt) void markNotificationRead(item.id); setNotificationMenuOpen(false); }} className="text-[9px] font-bold text-[#1d6ac4] hover:underline">Ver</Link>}</div></div></div></div>
                </div>)}
            </div>
          </div>}
        </div>
        <Link href="/favorites" className="rounded-xl p-1.5 hover:bg-white/10 sm:p-2" aria-label="Favoritos"><Heart size={20} /></Link>
        <Link href="/compare" className="hidden rounded-xl p-2 hover:bg-white/10 sm:block" aria-label="Comparar produtos"><ArrowLeftRight size={19} /></Link>
        <Link href="/cart" className="relative rounded-xl p-1.5 hover:bg-white/10 sm:p-2" aria-label={`Carrinho, ${cartCount} artigos`}><ShoppingCart size={21} />{cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f6b73c] px-1 text-[9px] font-black text-[#132238]">{cartCount}</span>}</Link>
      </nav>
    </div></div>
    <div className="hidden bg-[#1b2735] text-white lg:block"><div className="container mx-auto flex items-center px-4"><div className="relative"><button type="button" onClick={() => setCategoriesOpen((open) => !open)} aria-expanded={categoriesOpen} className="flex items-center gap-2 bg-[#131921] px-4 py-3 text-xs font-black hover:bg-black"><Menu size={16} />Todas as categorias<ChevronDown size={13} className={`transition-transform ${categoriesOpen ? "rotate-180" : ""}`} /></button>{categoriesOpen && <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 text-gray-800 shadow-[0_20px_45px_rgba(15,23,42,0.14)]">{categories.map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} onClick={() => setCategoriesOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm transition hover:bg-[#e8f0fc] hover:text-[#1d6ac4]">{category.name}</Link>)}<Link href="/categories" onClick={() => setCategoriesOpen(false)} className="mt-1 block rounded-xl border-t border-gray-100 px-3 py-2.5 text-xs font-bold text-[#1d6ac4]">Ver todas as categorias</Link></div>}</div><div className="flex min-w-0 flex-1 items-center overflow-x-auto">{categories.slice(0, 8).map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white">{category.name}</Link>)}<Link href="/promotions" className="ml-auto shrink-0 rounded-r-xl bg-[#f6b73c] px-4 py-3 text-xs font-black text-[#132238] transition hover:bg-[#ffd166]">Ofertas</Link></div></div></div>
    {mobileMenuOpen && <div className="absolute inset-x-0 top-full z-50 border-b border-gray-200 bg-white p-3 shadow-lg lg:hidden"><button type="button" onClick={requestLocation} className="mb-2 flex w-full items-center gap-2 border-b border-gray-100 px-3 py-3 text-left text-xs text-gray-600"><MapPin size={17} className="text-[#1d6ac4]" />{locationLoading ? "A localizar..." : `Entregar em ${location}`}</button>{categories.map((category) => <Link key={category.id} href={`/products?category=${category.slug}`} onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">{category.name}</Link>)}<Link href="/promotions" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-sm font-black text-[#1d6ac4]">Ofertas</Link><Link href="/b2b" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-sm font-black text-[#1d6ac4]">Para empresas</Link><Link href="/info/support" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Ajuda e suporte</Link><div className="grid grid-cols-2 gap-2 border-t border-gray-100 p-3"><Link href="/login" onClick={() => setMobileMenuOpen(false)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-center text-xs font-bold">Entrar</Link><Link href="/register" onClick={() => setMobileMenuOpen(false)} className="rounded-xl bg-[#1d6ac4] px-3 py-2.5 text-center text-xs font-bold text-white">Criar conta</Link></div></div>}
  </header>;
}
