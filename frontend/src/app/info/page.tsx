import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  Headphones,
  LockKeyhole,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";

const guides = [
  { title: "Como comprar", description: "Siga os passos desde a pesquisa até à confirmação da encomenda.", href: "/info/how-to-buy", icon: BookOpen, group: "Compras" },
  { title: "Pagamentos", description: "Consulte as opções apresentadas para Angola e Portugal.", href: "/info/payments", icon: CreditCard, group: "Compras" },
  { title: "Entregas", description: "Veja os modos disponíveis e como acompanhar a encomenda.", href: "/info/shipping", icon: Truck, group: "Compras" },
  { title: "Trocas e devoluções", description: "Saiba como enviar um pedido ligado à sua encomenda.", href: "/info/returns", icon: RefreshCcw, group: "Pós-venda" },
  { title: "Garantia e assistência", description: "Prepare os dados necessários para pedir apoio pós-venda.", href: "/info/warranty", icon: ShieldCheck, group: "Pós-venda" },
  { title: "Centro de suporte", description: "Fale com a equipa por chat e consulte respostas rápidas.", href: "/info/support", icon: Headphones, group: "Pós-venda" },
  { title: "Sobre a empresa", description: "Conheça a loja, os mercados e a área para empresas.", href: "/info/about", icon: Building2, group: "Empresa" },
  { title: "Contactos", description: "Escolha o canal mais conveniente para falar connosco.", href: "/info/contact", icon: Headphones, group: "Empresa" },
  { title: "Conteúdos e guias", description: "Explore o catálogo e compare produtos antes de escolher.", href: "/info/blog", icon: BookOpen, group: "Empresa" },
  { title: "Termos e condições", description: "Consulte informação geral sobre a experiência de compra.", href: "/info/terms", icon: FileText, group: "Documentos" },
  { title: "Privacidade", description: "Saiba como a informação apoia a conta, a compra e o suporte.", href: "/info/privacy", icon: LockKeyhole, group: "Documentos" },
  { title: "As minhas encomendas", description: "Consulte os pedidos e o estado das suas compras.", href: "/account/orders", icon: PackageCheck, group: "Acesso rápido" },
];

const groups = ["Compras", "Pós-venda", "Empresa", "Documentos", "Acesso rápido"];

export default function InfoIndexPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <nav aria-label="Navegação estrutural" className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-xs text-slate-500 sm:px-6 lg:px-8">
          <Link href="/" className="transition hover:text-blue-700">Início</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="font-semibold text-slate-800">Informações</span>
        </nav>
      </div>

      <section className="relative isolate overflow-hidden bg-[#10243a]">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-700/30 via-transparent to-transparent" />
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-blue-100"><BookOpen size={15} /> Informação e ajuda</span>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">Encontre o que precisa.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">Orientação para comprar, receber e acompanhar os seus pedidos, além dos contactos e informações da empresa.</p>
          </div>
          <Link href="/account/support" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
            <Headphones size={16} /> Falar com suporte <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {groups.map((group) => {
          const items = guides.filter((guide) => guide.group === group);
          return <section key={group} aria-labelledby={`info-${group}`}>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Centro de informação</p><h2 id={`info-${group}`} className="mt-1 text-xl font-black text-slate-950">{group}</h2></div>
              {group === "Pós-venda" && <Link href="/account/support" className="hidden items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 sm:inline-flex">Abrir chat <ArrowRight size={13} /></Link>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ title, description, href, icon: Icon }) => (
                <Link key={href} href={href} className="group flex min-h-36 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white"><Icon size={19} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-950">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span><span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">Abrir <ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></span></span>
                </Link>
              ))}
            </div>
          </section>;
        })}
      </div>
    </main>
  );
}
