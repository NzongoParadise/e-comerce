import Link from "next/link";
import { Lock, Mail, MapPin, Phone } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { CookieSettingsButton } from "@/components/layout/CookieConsent";

const groups = [
  { title: "Empresa", links: [["Sobre nós", "/info/about"], ["Contactos", "/info/contact"], ["Blog", "/info/blog"]] },
  { title: "Compras", links: [["Como comprar", "/info/how-to-buy"], ["Pagamentos", "/info/payments"], ["Entregas", "/info/shipping"], ["Trocas e devoluções", "/info/returns"], ["Garantia", "/info/warranty"]] },
  { title: "Serviços", links: [["Área empresarial B2B", "/b2b"], ["Cotações", "/b2b/cotacoes"], ["Suporte técnico", "/info/support"], ["Assistência pós-venda", "/info/support"]] },
  { title: "Ajuda", links: [["Centro de ajuda", "/info/support"], ["Seguimento de encomendas", "/login"], ["Termos e condições", "/info/terms"], ["Política de privacidade", "/info/privacy"], ["Política de cookies", "/info/cookies"]] },
];

export default function Footer() {
  return (
    <footer className="mt-12 bg-[#0f172a] text-gray-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-9 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="mb-5"><BrandLogo dark className="justify-start" /></div>
            <p className="max-w-sm text-sm leading-6 text-gray-400">Tecnologia, equipamentos e acessórios para clientes em Angola e Portugal, com catálogo online, compra segura e apoio especializado.</p>
            <div className="mt-5 space-y-2 text-xs text-gray-400">
              <p className="flex items-center gap-2"><MapPin size={14} className="text-[#f6b73c]" />4425-440 Mala, Portugal</p>
              <p className="flex items-center gap-2"><Phone size={14} className="text-[#f6b73c]" />+33 7 58 92 00 80</p>
              <Link href="/info/contact" className="flex items-center gap-2 hover:text-white"><Mail size={14} className="text-[#f6b73c]" />Fale connosco</Link>
            </div>
          </div>
          {groups.map((group) => <div key={group.title}><h3 className="mb-4 text-sm font-bold text-white">{group.title}</h3><ul className="space-y-2.5">{group.links.map(([label, href]) => <li key={label}><Link href={href} className="text-sm text-gray-400 transition hover:text-white">{label}</Link></li>)}</ul></div>)}
          <div>
            <h3 className="mb-4 text-sm font-bold text-white">Mercados</h3>
            <div className="space-y-2 text-sm text-gray-400"><p>🇦🇴 Angola · Kz</p><p>🇵🇹 Portugal · €</p></div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#f6b73c]">Compra segura</p><p className="mt-2 flex items-center gap-1 text-xs text-gray-400"><Lock size={12}/> Pagamento protegido</p></div>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">© 2026 RUBRICA DILIGENTE (SU), LDA. Todos os direitos reservados.</p>
          <div className="flex flex-wrap items-center gap-3">{["Multicaixa","MB WAY","VISA","Mastercard"].map((p) => <span key={p} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-gray-300">{p}</span>)}<span className="ml-1 text-xs text-gray-400">Angola · Portugal</span><CookieSettingsButton /></div>
        </div>
      </div>
    </footer>
  );
}