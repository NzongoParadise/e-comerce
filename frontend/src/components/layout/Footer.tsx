import { Lock } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";

const footerLinks = {
  Empresa: ["Sobre nós", "Carreiras", "Blog", "Contactos"],
  Compras: ["Como comprar", "Formas de pagamento", "Entregas", "Trocas e devoluções", "Garantia"],
  Serviços: ["Área Grossista (B2B)", "Cotações", "Suporte técnico", "Assistência pós-venda"],
};

export default function Footer() {
  return (
    <footer className="mt-12 bg-[#0f172a] text-gray-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="mb-4">
              <BrandLogo dark className="justify-start" />
            </div>
            <p className="mb-4 text-sm leading-relaxed text-gray-400">
              RUBRICA DILIGENTE (SU), LDA<br />
              4425-440 Mala, Portugal<br />
              +33 7 58 92 00 80
            </p>
            <div className="flex items-center gap-3">
              <a href="#" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 transition hover:bg-[#1d6ac4]">
                <svg width="14" height="14" fill="white" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="#" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 transition hover:bg-[#1d6ac4]">
                <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="#" aria-label="LinkedIn" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 transition hover:bg-[#1d6ac4]">
                <svg width="14" height="14" fill="white" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
              <a href="#" aria-label="YouTube" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 transition hover:bg-[#1d6ac4]">
                <svg width="14" height="14" fill="white" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>
              </a>
            </div>
          </div>

          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h3 className="mb-4 text-sm font-bold text-white">{section}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-gray-400 transition hover:text-white">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="mb-4 text-sm font-bold text-white">Países</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="flex items-center gap-2 text-sm text-gray-400 transition hover:text-white">
                  <img src="https://flagcdn.com/ao.svg" alt="Angola" width={16} height={12} className="rounded-sm border border-gray-700 object-cover" />
                  Angola (Kz)
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-2 text-sm text-gray-400 transition hover:text-white">
                  <img src="https://flagcdn.com/pt.svg" alt="Portugal" width={16} height={12} className="rounded-sm border border-gray-700 object-cover" />
                  Portugal (€)
                </a>
              </li>
            </ul>
            <h3 className="mt-6 mb-4 text-sm font-bold text-white">Ajuda</h3>
            <ul className="space-y-2">
              {['Centro de ajuda', 'Seguimento de encomendas', 'Termos e condições', 'Política de privacidade'].map((l) => (
                <li key={l}><a href="#" className="text-sm text-gray-400 transition hover:text-white">{l}</a></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-700 pt-6 sm:flex-row">
          <p className="text-xs text-gray-500">© 2024 RUBRICA DILIGENTE (SU), LDA. Todos os direitos reservados.</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {['Multicaixa','MB WAY','VISA','Mastercard'].map((p) => (
              <div key={p} className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold text-gray-300">{p}</div>
            ))}
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Lock size={12} strokeWidth={2.5} aria-hidden="true" />
              Compra 100% segura
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
