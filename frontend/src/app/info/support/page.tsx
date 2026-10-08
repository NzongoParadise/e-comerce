import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Headphones,
  MessageCircle,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";

const quickLinks = [
  { title: "Acompanhar encomenda", href: "/account/orders", icon: PackageCheck },
  { title: "Pagamentos", href: "/info/payments", icon: CreditCard },
  { title: "Entregas", href: "/info/shipping", icon: Truck },
  { title: "Devoluções", href: "/info/returns", icon: CheckCircle2 },
];

const helpAreas = [
  {
    title: "Antes de comprar",
    description: "Consulte o catálogo e confirme as características do produto.",
    action: "Explorar produtos",
    href: "/products",
    icon: Search,
  },
  {
    title: "Acompanhar pedido",
    description: "Consulte o estado e o histórico das suas encomendas.",
    action: "Ver encomendas",
    href: "/account/orders",
    icon: PackageCheck,
  },
  {
    title: "Pagamento e entrega",
    description: "Veja as informações e condições disponíveis para o seu mercado.",
    action: "Consultar informações",
    href: "/info/payments",
    icon: CreditCard,
  },
  {
    title: "Apoio personalizado",
    description: "Explique a sua questão à equipa através do chat de suporte.",
    action: "Abrir o chat",
    href: "/account/support",
    icon: MessageCircle,
  },
];

export default function PublicSupportPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <nav
          aria-label="Navegação estrutural"
          className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-xs text-slate-500 sm:px-6 lg:px-8"
        >
          <Link href="/" className="transition hover:text-blue-700">
            Início
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="font-semibold text-slate-800">
            Ajuda e suporte
          </span>
        </nav>
      </div>

      <section className="relative isolate overflow-hidden bg-[#10243a]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-700/30 via-transparent to-transparent"
        />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-blue-100">
              <Headphones size={15} /> Centro de ajuda
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Estamos aqui para ajudar.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Encontre orientação para comprar, acompanhar uma encomenda ou resolver uma questão de pagamento e pós-venda.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/account/support"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243a]"
              >
                <MessageCircle size={17} /> Falar com o suporte <ArrowRight size={16} />
              </Link>
              <Link
                href="/products"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Search size={16} /> Explorar produtos
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Pode iniciar uma conversa com a equipa na página de suporte.
            </p>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">
              Acesso rápido
            </p>
            <h2 className="mt-2 text-lg font-extrabold text-white">
              O que precisa de resolver?
            </h2>
            <div className="mt-5 divide-y divide-white/10">
              {quickLinks.map(({ title, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 py-3 text-sm font-semibold text-slate-200 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                >
                  <Icon size={17} className="text-blue-300" />
                  <span className="flex-1">{title}</span>
                  <ArrowRight
                    size={15}
                    className="text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-blue-200"
                  />
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            Orientação clara
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Resolva cada etapa com confiança
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Escolha o tema mais próximo da sua dúvida. Se precisar de ajuda personalizada, a equipa pode continuar a conversa consigo.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {helpAreas.map(({ title, description, action, href, icon: Icon }) => (
            <article
              key={title}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Icon size={19} />
              </span>
              <h3 className="mt-4 text-base font-extrabold text-slate-950">{title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{description}</p>
              <Link
                href={href}
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 transition hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {action} <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-950">Ainda precisa de ajuda?</h2>
            <p className="mt-1 text-sm text-slate-600">
              A equipa de suporte pode orientar o próximo passo.
            </p>
          </div>
          <Link
            href="/account/support"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <MessageCircle size={16} /> Contactar suporte
          </Link>
        </div>
      </section>
    </main>
  );
}
