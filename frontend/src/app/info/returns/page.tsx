import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Headphones,
  MessageCircle,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Escolha a encomenda",
    description: "Entre na sua conta e selecione a compra relacionada com o pedido.",
    icon: PackageCheck,
  },
  {
    number: "02",
    title: "Explique o que aconteceu",
    description: "Indique se pretende uma devolução, troca ou apresentar uma reclamação.",
    icon: ClipboardCheck,
  },
  {
    number: "03",
    title: "Acompanhe a análise",
    description: "A equipa analisará os dados enviados e dará seguimento ao pedido.",
    icon: MessageCircle,
  },
];

const requestTypes = [
  {
    title: "Devolução",
    description: "Peça a devolução de um artigo da sua encomenda.",
    icon: PackageCheck,
  },
  {
    title: "Troca",
    description: "Informe a equipa de que pretende trocar um artigo.",
    icon: RefreshCcw,
  },
  {
    title: "Reclamação",
    description: "Registe um problema e descreva a situação com detalhe.",
    icon: Headphones,
  },
];

const faqs = [
  {
    question: "Como faço um pedido de devolução ou troca?",
    answer:
      "Aceda à área de devoluções, escolha a encomenda, selecione o tipo de pedido e descreva o motivo.",
  },
  {
    question: "Preciso de indicar a encomenda?",
    answer:
      "Sim. O formulário associa o pedido a uma encomenda da sua conta para que a equipa possa analisá-lo.",
  },
  {
    question: "Quando recebo uma resposta?",
    answer:
      "Depois de submeter o pedido, a equipa analisará a informação e entrará em contacto através dos canais associados à sua conta.",
  },
  {
    question: "Onde consulto as condições aplicáveis?",
    answer:
      "As condições podem depender do artigo e da encomenda. Fale com o suporte se precisar de orientação sobre um caso específico.",
  },
];

export default function ReturnsInfoPage() {
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
          <span className="font-semibold text-slate-800" aria-current="page">
            Trocas e devoluções
          </span>
        </nav>
      </div>

      <section className="relative isolate overflow-hidden bg-[#10243a]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-700/30 via-transparent to-transparent"
        />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-blue-100">
              <RefreshCcw size={15} /> Apoio pós-venda
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Trocas e devoluções, com um processo claro.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Registe um pedido ligado à sua encomenda e acompanhe o respetivo tratamento através da equipa de suporte.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/account/returns"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243a]"
              >
                Criar pedido <ArrowRight size={16} />
              </Link>
              <Link
                href="/account/support"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <MessageCircle size={16} /> Falar com o suporte
              </Link>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <ShieldCheck size={22} />
            </div>
            <h2 className="mt-4 text-lg font-extrabold text-white">Cada pedido é analisado</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              As condições dependem do artigo e da encomenda. Envie os detalhes para receber orientação adequada ao seu caso.
            </p>
            <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-slate-300">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300" />
              Tenha o número da encomenda e uma descrição do problema à mão.
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Como funciona</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Três passos para iniciar o pedido
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            O formulário associa a solicitação à sua compra e envia os detalhes para análise.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map(({ number, title, description, icon: Icon }) => (
            <article key={number} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03]">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon size={19} />
                </span>
                <span className="text-xs font-black tracking-wider text-slate-300">{number}</span>
              </div>
              <h3 className="mt-5 text-base font-extrabold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Tipos de pedido</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Escolha a opção que melhor descreve o seu caso</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {requestTypes.map(({ title, description, icon: Icon }) => (
                <article key={title} className="rounded-xl border border-slate-200 bg-white p-4">
                  <Icon size={19} className="text-blue-700" />
                  <h3 className="mt-3 text-sm font-extrabold text-slate-900">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-extrabold text-slate-950">Perguntas frequentes</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="group py-3">
                  <summary className="cursor-pointer list-none pr-5 text-sm font-semibold text-slate-800 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    {question}
                    <span aria-hidden="true" className="float-right text-blue-700 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 pr-3 text-xs leading-5 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-950">Pronto para registar o seu pedido?</h2>
            <p className="mt-1 text-sm text-slate-600">Selecione a encomenda e conte-nos o que aconteceu.</p>
          </div>
          <Link
            href="/account/returns"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Começar agora <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </main>
  );
}
