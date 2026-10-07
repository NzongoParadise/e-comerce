"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Headphones,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

type Topic = {
  title: string;
  description: string;
  icon: typeof Package;
  href: string;
};

type Article = {
  title: string;
  description: string;
  href: string;
  keywords: string;
};

const topics: Topic[] = [
  { title: "Encomendas", description: "Acompanhar pedidos, estados e histórico.", icon: Package, href: "/account/orders" },
  { title: "Pagamentos", description: "Métodos de pagamento e questões de cobrança.", icon: WalletCards, href: "/info/payments" },
  { title: "Entregas", description: "Prazos, zonas e informações de entrega.", icon: Truck, href: "/info/shipping" },
  { title: "Devoluções", description: "Trocas, devoluções e reembolsos.", icon: CheckCircle2, href: "/info/returns" },
  { title: "Garantia", description: "Condições e assistência de produtos.", icon: ShieldCheck, href: "/info/warranty" },
  { title: "Produtos", description: "Informação, características e disponibilidade.", icon: BookOpen, href: "/products" },
  { title: "Conta", description: "Perfil, endereços e segurança da conta.", icon: UserRound, href: "/account/profile" },
  { title: "Empresas (B2B)", description: "Cotações, compras e condições empresariais.", icon: FileText, href: "/b2b" },
];

const articles: Article[] = [
  {
    title: "Como acompanhar a minha encomenda?",
    description: "Consulte o estado e o histórico das suas compras na área de encomendas.",
    href: "/account/orders",
    keywords: "encomenda pedido estado acompanhar rastrear",
  },
  {
    title: "Quais são os métodos de pagamento disponíveis?",
    description: "Veja as opções de pagamento disponíveis para as compras.",
    href: "/info/payments",
    keywords: "pagamento cartão visa mastercard stripe mb way multicaixa",
  },
  {
    title: "Qual é o prazo de entrega?",
    description: "Consulte as condições gerais, zonas e prazos de entrega.",
    href: "/info/shipping",
    keywords: "entrega prazo envio transporte luanda angola portugal",
  },
  {
    title: "Como solicitar uma devolução?",
    description: "Conheça as condições e o processo para solicitar uma devolução.",
    href: "/info/returns",
    keywords: "devolução troca reembolso retorno",
  },
  {
    title: "Como funciona a garantia?",
    description: "Consulte as condições de garantia e assistência pós-venda.",
    href: "/info/warranty",
    keywords: "garantia assistência técnica produto",
  },
  {
    title: "Como criar e gerir a minha conta?",
    description: "Aceda aos dados pessoais, endereços e definições da conta.",
    href: "/account/profile",
    keywords: "conta perfil utilizador endereço segurança",
  },
];

const faqs = [
  {
    question: "Preciso de uma conta para comprar?",
    answer: "Pode consultar o catálogo sem conta. Para concluir determinadas operações, como acompanhar uma encomenda ou gerir dados pessoais, poderá ser necessário iniciar sessão.",
  },
  {
    question: "Como posso saber o estado da minha encomenda?",
    answer: "Depois de iniciar sessão, aceda a “As minhas encomendas” na sua área de cliente para consultar o histórico e o estado das compras.",
  },
  {
    question: "Como posso falar com o suporte?",
    answer: "Pode contactar a equipa por telefone, WhatsApp ou e-mail. Para assuntos relacionados com uma encomenda, inclua o número da encomenda na mensagem.",
  },
  {
    question: "Como funciona uma devolução?",
    answer: "Consulte a página de devoluções para conhecer as condições aplicáveis. Se já tiver uma compra, tenha o número da encomenda disponível quando contactar o suporte.",
  },
  {
    question: "Onde encontro as informações de pagamento?",
    answer: "A página de pagamentos reúne os métodos e orientações disponíveis para as compras na plataforma.",
  },
];

const phone = "+33 7 58 92 00 80";
const email = "suporte@techglobal.co.ao";
const whatsapp = "33758920080";

export default function SupportPage() {
  const [query, setQuery] = useState("");
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [showAllArticles, setShowAllArticles] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredArticles = useMemo(() => {
    if (!normalizedQuery) return articles;
    return articles.filter((article) =>
      `${article.title} ${article.description} ${article.keywords}`.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  const visibleArticles = showAllArticles ? filteredArticles : filteredArticles.slice(0, 5);

  const supportMail = `mailto:${email}?subject=Pedido%20de%20suporte%20-%20RUBRICA%20DILIGENTE`;
  const whatsappUrl = `https://wa.me/${whatsapp}?text=Olá,%20preciso%20de%20ajuda%20com%20a%20minha%20conta/encomenda.`;

  return (
    <main className="space-y-8 pb-12">
      <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6 sm:p-8 lg:p-10">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">
            <Headphones size={13} />
            Centro de ajuda
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">Como podemos ajudar?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
            Encontre respostas rápidas, consulte os artigos de ajuda ou fale diretamente com a nossa equipa.
          </p>

          <div className="mt-6 flex max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm focus-within:border-[#1d6ac4] focus-within:ring-4 focus-within:ring-blue-100">
            <Search className="ml-4 mt-3.5 shrink-0 text-gray-400" size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar uma dúvida, pagamento, entrega..."
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-gray-900 outline-none"
              aria-label="Pesquisar no centro de ajuda"
            />
            {query && (
              <button onClick={() => setQuery("")} className="px-3 text-gray-400 hover:text-gray-700" aria-label="Limpar pesquisa">
                <X size={18} />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["Estado da encomenda", "Devoluções", "Garantia", "Pagamentos"].map((tag) => (
              <button
                key={tag}
                onClick={() => setQuery(tag)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:border-blue-200 hover:text-[#1d6ac4]"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1d6ac4]">Navegação rápida</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">Temas de ajuda</h2>
          </div>
          <Link href="/info/support" className="hidden text-xs font-bold text-[#1d6ac4] hover:underline sm:block">
            Ajuda pública
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {topics.map(({ title, description, icon: Icon, href }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1d6ac4] transition group-hover:bg-[#1d6ac4] group-hover:text-white">
                  <Icon size={19} />
                </div>
                <ChevronRight size={17} className="mt-1 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#1d6ac4]" />
              </div>
              <h3 className="mt-4 text-sm font-black text-gray-900">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1d6ac4]">Base de conhecimento</p>
              <h2 className="mt-1 text-xl font-black text-gray-950">
                {normalizedQuery ? `Resultados para “${query}”` : "Artigos mais consultados"}
              </h2>
            </div>
            {query && <span className="text-xs text-gray-400">{filteredArticles.length} resultado(s)</span>}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {visibleArticles.length > 0 ? (
              visibleArticles.map((article, index) => (
                <Link
                  key={article.title}
                  href={article.href}
                  className="group flex gap-4 border-b border-gray-100 p-4 last:border-0 hover:bg-blue-50/40 sm:p-5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-[#1d6ac4]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-gray-900 group-hover:text-[#1d6ac4]">{article.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-gray-500">{article.description}</span>
                  </span>
                  <ArrowRight size={17} className="mt-1 shrink-0 text-gray-300 group-hover:text-[#1d6ac4]" />
                </Link>
              ))
            ) : (
              <div className="p-10 text-center">
                <Search className="mx-auto text-gray-300" size={30} />
                <h3 className="mt-3 text-sm font-black text-gray-900">Não encontramos esse assunto</h3>
                <p className="mt-1 text-xs text-gray-500">Tente outra palavra ou contacte diretamente o suporte.</p>
              </div>
            )}
          </div>

          {filteredArticles.length > 5 && (
            <button
              onClick={() => setShowAllArticles((current) => !current)}
              className="mt-3 text-xs font-bold text-[#1d6ac4] hover:underline"
            >
              {showAllArticles ? "Mostrar menos" : "Ver todos os artigos"}
            </button>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 text-[#1d6ac4]" size={20} />
              <div>
                <h3 className="text-sm font-black text-gray-900">Horário de atendimento</h3>
                <p className="mt-1 text-sm font-semibold text-gray-700">Segunda a sábado</p>
                <p className="text-xs text-gray-500">08h00 – 20h00</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5">
            <h3 className="text-sm font-black text-gray-900">Precisa de ajuda agora?</h3>
            <p className="mt-1 text-xs leading-5 text-gray-600">Escolha o canal mais conveniente para falar com a equipa.</p>
            <div className="mt-4 space-y-2">
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-[#1d6ac4] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#155099]">
                <MessageCircle size={16} /> WhatsApp
              </a>
              <a href={supportMail} className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700 transition hover:border-blue-200 hover:text-[#1d6ac4]">
                <Mail size={16} /> Enviar e-mail
              </a>
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700 transition hover:border-blue-200 hover:text-[#1d6ac4]">
                <Phone size={16} /> {phone}
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Package size={19} className="text-[#1d6ac4]" />
              <h3 className="text-sm font-black text-gray-900">Acompanhar encomendas</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-500">Consulte as suas compras e o respetivo estado na sua conta.</p>
            <Link href="/account/orders" className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-[#1d6ac4]">
              Ver as minhas encomendas <ChevronRight size={15} />
            </Link>
          </div>
        </aside>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1d6ac4]">Perguntas frequentes</p>
          <h2 className="mt-1 text-xl font-black text-gray-950">Respostas rápidas</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {faqs.map((faq, index) => {
            const open = faqOpen === index;
            return (
              <div key={faq.question} className="border-b border-gray-100 last:border-0">
                <button
                  onClick={() => setFaqOpen(open ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50"
                  aria-expanded={open}
                >
                  <span className="text-sm font-bold text-gray-900">{faq.question}</span>
                  <ChevronDown size={17} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && <div className="px-5 pb-5 pr-12 text-xs leading-6 text-gray-600">{faq.answer}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-gray-950 p-6 text-white sm:p-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-[#ffd700]">
              <Headphones size={19} />
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">RUBRICA DILIGENTE</span>
            </div>
            <h2 className="mt-2 text-xl font-black">Ainda precisa de ajuda?</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-gray-300">
              Envie-nos a sua questão. Se estiver relacionada com uma compra, indique o número da encomenda para acelerarmos o atendimento.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <a href={supportMail} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ffd700] px-5 py-3 text-xs font-black text-gray-950 hover:bg-yellow-300">
              <Mail size={16} /> Abrir pedido
            </a>
            <Link href="/info/contact" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-xs font-black text-white hover:bg-white/10">
              Contactos <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <p className="text-center text-[11px] leading-5 text-gray-400">
        Atendimento: {phone} · {email} · Segunda a sábado, 08h00–20h00
      </p>
    </main>
  );
}
