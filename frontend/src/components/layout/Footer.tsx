import Link from "next/link";
import Image from "next/image";
import { Lock, Mail, MapPin, Phone } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { CookieSettingsButton } from "@/components/layout/CookieConsent";

const groups = [
  { title: "Empresa", links: [["Sobre nós", "/info/about"], ["Contactos", "/info/contact"], ["Blog", "/info/blog"]] },
  { title: "Compras", links: [["Como comprar", "/info/how-to-buy"], ["Pagamentos", "/info/payments"], ["Entregas", "/info/shipping"], ["Trocas e devoluções", "/info/returns"], ["Garantia", "/info/warranty"]] },
  { title: "Serviços", links: [["Área empresarial B2B", "/b2b"], ["Cotações", "/b2b/cotacoes"], ["Suporte técnico", "/info/support"]] },
  { title: "Ajuda", links: [["Centro de ajuda", "/info/support"], ["Seguimento de encomendas", "/login"], ["Termos e condições", "/info/terms"], ["Política de privacidade", "/info/privacy"], ["Política de cookies", "/info/cookies"]] },
];

const paymentMethods = [
  { name: "Multicaixa", src: "/payment-logos/multicaixa.svg", width: 210, height: 39, imageClassName: "h-5 w-[88px]", tileClassName: "bg-[#002133]" },
  { name: "MB WAY", src: "/payment-logos/mb-way.png", width: 292, height: 143, imageClassName: "h-7 w-[58px]", tileClassName: "bg-white" },
  { name: "Visa", src: "/payment-logos/visa.svg", width: 1000, height: 325, imageClassName: "h-5 w-[64px]", tileClassName: "bg-white" },
  { name: "Mastercard", src: "/payment-logos/mastercard.svg", width: 999, height: 776, imageClassName: "h-9 w-[46px]", tileClassName: "bg-white" },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[#292b2e] bg-[#17191c] text-[#d4d5d7]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 py-14 sm:gap-x-10 lg:grid-cols-4 lg:gap-x-8 xl:grid-cols-[minmax(17rem,1.35fr)_repeat(4,minmax(0,1fr))]">
          <div className="col-span-2 max-w-sm xl:col-span-1">
            <div className="mb-5"><BrandLogo dark className="justify-start" /></div>
            <p className="max-w-xs text-sm leading-6 text-gray-300">Tecnologia e equipamentos para clientes em Angola e Portugal, com entrega segura e apoio especializado.</p>
            <h2 className="mb-3 mt-7 text-xs font-bold text-white">Contactos</h2>
            <address className="space-y-3 not-italic text-sm leading-6 text-gray-300">
              <p className="flex items-start gap-3"><MapPin size={16} className="mt-1 shrink-0 text-[#f5a800]" /><span>4425-440 Mala, Portugal</span></p>
              <a href="tel:+33758920080" className="flex items-center gap-3 transition hover:text-[#ffc43d]"><Phone size={16} className="shrink-0 text-[#f5a800]" /><span>+33 7 58 92 00 80</span></a>
              <Link href="/info/contact" className="flex items-center gap-3 transition hover:text-[#ffc43d]"><Mail size={16} className="shrink-0 text-[#f5a800]" /><span>Fale connosco</span></Link>
            </address>
          </div>
          {groups.map((group) => <nav key={group.title} aria-label={group.title}>
            <h2 className="mb-5 text-xs font-bold text-white">{group.title}</h2>
            <ul className="space-y-3.5">
              {group.links.map(([label, href]) => <li key={label}><Link href={href} className="text-sm leading-6 text-gray-300 transition hover:text-[#ffc43d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f5a800]">{label}</Link></li>)}
            </ul>
          </nav>)}
        </div>

        <div className="flex flex-col gap-4 border-y border-white/10 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-300">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-white">Mercados</span>
            <span>🇦🇴 Angola · Kz</span>
            <span>🇵🇹 Portugal · €</span>
          </div>
          <p className="flex items-center gap-2 text-sm text-gray-300"><Lock size={15} className="text-[#f5a800]" />Pagamento protegido</p>
        </div>

        <div className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs text-gray-400">© 2026 RUBRICA DILIGENTE (SU), LDA. Todos os direitos reservados.</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Pagamentos</span>
            {paymentMethods.map((method) => <span key={method.name} className={`flex h-12 min-w-20 items-center justify-center rounded-[4px] px-3 ${method.tileClassName}`}>
              <Image src={method.src} alt={method.name} width={method.width} height={method.height} className={`${method.imageClassName} object-contain`} />
            </span>)}
            <CookieSettingsButton />
          </div>
        </div>
      </div>
    </footer>
  );
}