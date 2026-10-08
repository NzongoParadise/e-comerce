import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  PackageCheck,
  Store,
  Truck,
  Zap,
} from "lucide-react";

const deliveryOptions = [
  {
    market: "Angola",
    currency: "Kz · AOA",
    options: [
      { name: "Entrega padrão", description: "Entrega numa morada ou endereço empresarial. O checkout apresenta o custo final.", icon: Truck },
      { name: "Entrega expressa", description: "Opção mais rápida, com custo apresentado antes de confirmar a encomenda.", icon: Zap },
      { name: "Levantamento na loja", description: "Disponível para Angola. A morada de levantamento é indicada no checkout.", icon: Store },
    ],
  },
  {
    market: "Portugal",
    currency: "€ · EUR",
    options: [
      { name: "Entrega padrão", description: "Receba a encomenda numa morada selecionada na sua conta.", icon: Truck },
      { name: "Entrega expressa", description: "Opção mais rápida. O preço varia com o peso calculado da encomenda.", icon: Zap },
      { name: "Entrega empresarial", description: "Indique a morada da empresa para receber a encomenda.", icon: Building2 },
    ],
  },
];

const steps = [
  { number: "01", title: "Escolha a morada", description: "Selecione ou adicione um endereço na sua conta. Para levantamento, consulte o ponto indicado no checkout." },
  { number: "02", title: "Compare as opções", description: "Veja os modos de entrega, custos e estimativas disponíveis para a encomenda." },
  { number: "03", title: "Acompanhe o pedido", description: "Depois da compra, consulte o estado e o acompanhamento na área de encomendas." },
];

const faqs = [
  {
    question: "Quanto custa a entrega?",
    answer: "O custo depende do mercado, do método e do peso da encomenda. O checkout calcula e apresenta o valor antes da confirmação.",
  },
  {
    question: "Posso levantar a encomenda?",
    answer: "O levantamento está disponível para Angola. Consulte no checkout a morada e a disponibilidade antes de escolher esta opção.",
  },
  {
    question: "Onde acompanho a entrega?",
    answer: "Entre na sua conta, abra as encomendas e selecione o pedido para ver o estado e os detalhes de acompanhamento disponíveis.",
  },
  {
    question: "Posso usar uma morada empresarial?",
    answer: "Sim. No checkout pode selecionar a modalidade de entrega empresarial e indicar a morada associada à encomenda.",
  },
];

export default function ShippingInfoPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <nav aria-label="Navegação estrutural" className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-xs text-slate-500 sm:px-6 lg:px-8">
          <Link href="/" className="transition hover:text-blue-700">Início</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="font-semibold text-slate-800">Entregas</span>
        </nav>
      </div>

      <section className="relative isolate overflow-hidden bg-[#10243a]">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-700/30 via-transparent to-transparent" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-blue-100">
              <Truck size={15} /> Entregas
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Receba a sua encomenda à sua maneira.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Consulte os modos de entrega para Angola e Portugal. O checkout confirma os custos e as estimativas para cada encomenda.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/products" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243a]">
                Explorar produtos <ArrowRight size={16} />
              </Link>
              <Link href="/account/orders" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <PackageCheck size={16} /> Acompanhar encomendas
              </Link>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-400/10 text-blue-200"><MapPin size={21} /></div>
            <h2 className="mt-4 text-lg font-extrabold text-white">Custos e prazos à vista</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Antes de concluir a compra, o checkout mostra as opções, os custos aplicáveis e a estimativa de entrega.</p>
            <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-slate-300">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300" />
              Confirme a morada e o método selecionados antes de pagar.
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Opções por mercado</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Escolha como quer receber</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">A disponibilidade depende do país de entrega e dos detalhes da encomenda.</p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {deliveryOptions.map((market) => (
            <section key={market.market} aria-labelledby={`shipping-${market.market}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
              <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                <h3 id={`shipping-${market.market}`} className="text-base font-extrabold text-slate-950">{market.market}</h3>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-600">{market.currency}</span>
              </header>
              <div className="divide-y divide-slate-100 px-5">
                {market.options.map(({ name, description, icon: Icon }) => (
                  <article key={name} className="flex gap-3 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon size={17} /></span>
                    <div><h4 className="text-sm font-bold text-slate-900">{name}</h4><p className="mt-1 text-xs leading-5 text-slate-600">{description}</p></div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Do checkout à entrega</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Três passos para acompanhar</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {steps.map((step) => (
                <article key={step.number} className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-xs font-black tracking-wider text-blue-700">{step.number}</span>
                  <h3 className="mt-2 text-sm font-extrabold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{step.description}</p>
                </article>
              ))}
            </div>
            <Link href="/account/orders" className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900">
              Abrir as minhas encomendas <ArrowRight size={14} />
            </Link>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Clock3 size={18} className="text-blue-700" /><h2 className="text-base font-extrabold text-slate-950">Perguntas frequentes</h2></div>
            <div className="mt-3 divide-y divide-slate-100">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="group py-3">
                  <summary className="cursor-pointer list-none pr-5 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    {question}<span aria-hidden="true" className="float-right text-blue-700 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 pr-3 text-xs leading-5 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div><h2 className="text-base font-extrabold text-slate-950">Tem uma dúvida sobre a entrega?</h2><p className="mt-1 text-sm text-slate-600">Tenha o número da encomenda disponível para receber ajuda.</p></div>
          <Link href="/account/support" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <MessageCircle size={16} /> Falar com o suporte
          </Link>
        </div>
      </section>
    </main>
  );
}
