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
  { name: "Multicaixa", src: "/payment-logos/multicaixa.svg", width: 210, height: 39, imageClassName: "h-4 w-16", tileClassName: "border border-[#0b4e68] bg-gradient-to-br from-[#07526b] to-[#002133] shadow-sm ring-1 ring-inset ring-white/15" },
  { name: "MB WAY", src: "/payment-logos/mb-way.png", width: 292, height: 143, imageClassName: "h-5 w-11", tileClassName: "bg-white" },
  { name: "Visa", src: "/payment-logos/visa.svg", width: 1000, height: 325, imageClassName: "h-4 w-12", tileClassName: "bg-white" },
  { name: "Mastercard", src: "/payment-logos/mastercard.svg", width: 999, height: 776, imageClassName: "h-7 w-8", tileClassName: "bg-white" },
];

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-[#e1e8e4] bg-white text-[#52615d]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 py-14 sm:gap-x-10 lg:grid-cols-4 lg:gap-x-8 xl:grid-cols-[minmax(17rem,1.35fr)_repeat(4,minmax(0,1fr))]">
          <div className="col-span-2 max-w-sm xl:col-span-1">
            <div className="mb-5"><BrandLogo className="justify-start" /></div>
            <p className="max-w-xs text-sm leading-6 text-[#64736f]">Tecnologia e equipamentos para clientes em Angola e Portugal, com apoio especializado.</p>
            <h2 className="mb-3 mt-7 text-xs font-bold text-[#263a36]">Contactos</h2>
            <address className="space-y-3 not-italic text-sm leading-6 text-[#64736f]">
              <p className="flex items-start gap-3"><MapPin size={16} className="mt-1 shrink-0 text-[#087e76]" /><span>4425-440 Mala, Portugal</span></p>
              <a href="tel:+33758920080" className="flex items-center gap-3 transition hover:text-[#087e76]"><Phone size={16} className="shrink-0 text-[#087e76]" /><span>+33 7 58 92 00 80</span></a>
              <Link href="/info/contact" className="flex items-center gap-3 transition hover:text-[#087e76]"><Mail size={16} className="shrink-0 text-[#087e76]" /><span>Fale connosco</span></Link>
            </address>
          </div>
          {groups.map((group) => <nav key={group.title} aria-label={group.title}>
            <h2 className="mb-5 text-xs font-bold text-[#263a36]">{group.title}</h2>
            <ul className="space-y-3.5">
              {group.links.map(([label, href]) => <li key={label}><Link href={href} className="text-sm leading-6 text-[#64736f] transition hover:text-[#087e76] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087e76]">{label}</Link></li>)}
            </ul>
          </nav>)}
        </div>

        <div className="flex flex-col gap-4 border-y border-[#e8eeeb] py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#64736f]">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#263a36]">Mercados</span>
            <span>🇦🇴 Angola · Kz</span>
            <span>🇵🇹 Portugal · €</span>
          </div>
          <p className="flex items-center gap-2 text-sm text-[#64736f]"><Lock size={15} className="text-[#087e76]" />Pagamento protegido</p>
        </div>

        <div className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs text-[#71807c]">© 2026 RUBRICA DILIGENTE (SU), LDA. Todos os direitos reservados.</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Pagamentos</span>
            {paymentMethods.map((method) => <span key={method.name} className={`flex h-9 min-w-14 items-center justify-center rounded-md px-2 ${method.tileClassName}`}>
              <Image src={method.src} alt={method.name} width={method.width} height={method.height} className={`${method.imageClassName} object-contain`} />
            </span>)}
            <CookieSettingsButton />
          </div>
        </div>
      </div>
    </footer>
  );
}