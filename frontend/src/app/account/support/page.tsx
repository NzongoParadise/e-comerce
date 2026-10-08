"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  Send,
  Loader2,
  ShieldCheck,
  Truck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

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
    answer: "Pode usar o chat nesta página sem criar conta ou contactar a equipa por telefone, WhatsApp ou e-mail. Para assuntos sobre uma encomenda, indique o respetivo número.",
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

function matchesSupportQuery(value: string, query: string) {
  if (!query) return true;
  const searchableWords = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const queryWords = query.split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  return queryWords.every((word) => searchableWords.some((searchableWord) => searchableWord.startsWith(word)));
}

export default function SupportPage() {
  const [query, setQuery] = useState("");
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [showAllArticles, setShowAllArticles] = useState(false);
  const [chat, setChat] = useState<any>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatSending, setChatSending] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatError, setChatError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const loadChat = async () => {
    try {
      const payload = await fetchWithAuth("/api/support/chat", { cache: "no-store" });
      setChat(payload.data);
      setIsAuthenticated(Boolean(localStorage.getItem("jwt_token")));
      setChatError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível ligar ao serviço de chat.";
      if (message.includes("401") || message.includes("Não autenticado")) {
        setIsAuthenticated(false);
        setChat(null);
        setChatError("");
      } else setChatError(message);
    }
    finally { setChatLoading(false); }
  };

  useEffect(() => {
    setIsAuthenticated(Boolean(localStorage.getItem("jwt_token")));
    loadChat();
    const timer = window.setInterval(loadChat, 4000);
    return () => window.clearInterval(timer);
  }, []);

  const sendChatMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = chatDraft.trim();
    if (!content || chatSending) return;
    setChatSending(true); setChatError("");
    try {
      await fetchWithAuth("/api/support/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, ...(!isAuthenticated && !chat ? { guestName, guestEmail } : {}) }) });
      setChatDraft("");
      await loadChat();
    } catch (error) { setChatError(error instanceof Error ? error.message : "Não foi possível enviar a mensagem."); }
    finally { setChatSending(false); }
  };

  const normalizedQuery = query
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const filteredTopics = useMemo(
    () => topics.filter((topic) => matchesSupportQuery(`${topic.title} ${topic.description}`, normalizedQuery)),
    [normalizedQuery],
  );

  const filteredArticles = useMemo(() => {
    if (!normalizedQuery) return articles;
    return articles.filter((article) =>
      matchesSupportQuery(`${article.title} ${article.description} ${article.keywords}`, normalizedQuery),
    );
  }, [normalizedQuery]);

  const visibleArticles = showAllArticles ? filteredArticles : filteredArticles.slice(0, 5);
  const supportAgentName = typeof chat?.agent?.name === "string" ? chat.agent.name.trim() : "";
  const supportAgentInitials = supportAgentName
    ? supportAgentName.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase()
    : "ST";

  const supportMail = `mailto:${email}?subject=Pedido%20de%20suporte%20-%20RUBRICA%20DILIGENTE`;
  const whatsappUrl = `https://wa.me/${whatsapp}?text=Olá,%20preciso%20de%20ajuda%20com%20a%20minha%20conta/encomenda.`;

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6 shadow-sm sm:p-8 lg:p-10">
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

      <nav aria-label="Navegação do centro de ajuda" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[["Chat com suporte", "#support-chat"], ["Temas", "#support-topics"], ["Artigos", "#support-articles"], ["Contactos", "#support-contacts"], ["Perguntas frequentes", "#support-faq"]].map(([label, href], index) => <a key={href} href={href} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${index === 0 ? "border-blue-700 bg-blue-700 text-white hover:bg-blue-800" : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-700"}`}>{label}</a>)}
      </nav>

      <section id="support-chat" className="scroll-mt-24 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#1d6ac4]"><MessageCircle size={21} /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Atendimento em tempo real</p>
              <h2 className="text-lg font-black text-gray-950">Chat com o suporte</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500"><Clock3 size={14} className="text-[#1d6ac4]" /> Seg–sáb · 08h00–20h00</div>
        </div>
        <div className="grid lg:grid-cols-[1fr_280px]">
          <div className="flex min-h-[420px] flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
              {chatLoading ? (
                <div className="flex min-h-[300px] items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="animate-spin" size={18} /> A ligar ao suporte...</div>
              ) : chat ? (
                <>
                  <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-black text-white ring-4 ring-white">
                      {supportAgentInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-blue-700">Perfil de atendimento</p>
                      <p className="mt-0.5 truncate text-sm font-bold text-gray-900">
                        {supportAgentName || "Equipa de suporte"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-gray-600">
                        {supportAgentName ? "Agente responsável pela conversa" : "A sua conversa será acompanhada pela equipa"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[9px] font-bold text-blue-800">
                      {supportAgentName ? "A acompanhar" : "Suporte"}
                    </span>
                  </div>
                  {chat.messages?.map((message: any) => {
                    const mine = message.senderRole === "CUSTOMER" || message.senderRole === "GUEST";
                    return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? "rounded-br-md bg-[#1d6ac4] text-white" : "rounded-bl-md bg-gray-100 text-gray-800"}`}>
                        {!mine && <p className="mb-1 text-[10px] font-bold text-gray-500">{message.senderName || supportAgentName || "Suporte"}</p>}
                        <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                        <p className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-gray-400"}`}>{new Date(message.createdAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>;
                  })}
                </>
              ) : isAuthenticated ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                  <MessageCircle className="text-gray-300" size={34} />
                  <h3 className="mt-3 text-sm font-black text-gray-900">Inicie uma conversa com o suporte</h3>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">Envie a sua dúvida. A conversa ficará guardada aqui para continuar mais tarde.</p>
                </div>
              ) : (
                <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                  <MessageCircle className="text-gray-300" size={34} />
                  <h3 className="mt-3 text-sm font-black text-gray-900">Fale connosco sem criar conta</h3>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">Indique o seu nome e e-mail para iniciar. O histórico fica guardado neste navegador.</p>
                </div>
              )}
              {chatError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{chatError}</p>}
            </div>
            {!chatLoading && <form onSubmit={sendChatMessage} className="border-t border-gray-100 p-4">
              {!chat && !isAuthenticated && <div className="mb-3 grid gap-2 sm:grid-cols-2"><input value={guestName} onChange={(e) => setGuestName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" placeholder="O seu nome" className="h-10 min-w-0 rounded-lg border border-gray-200 px-3 text-xs outline-none focus:border-[#1d6ac4]" aria-label="O seu nome" /><input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required type="email" maxLength={254} autoComplete="email" placeholder="O seu e-mail" className="h-10 min-w-0 rounded-lg border border-gray-200 px-3 text-xs outline-none focus:border-[#1d6ac4]" aria-label="O seu e-mail" /></div>}
              <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white p-2 focus-within:border-[#1d6ac4] focus-within:ring-4 focus-within:ring-blue-50">
                <textarea value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} maxLength={4000} rows={2} placeholder="Escreva a sua mensagem..." className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-gray-900 outline-none" aria-label="Mensagem para o suporte" />
                <button type="submit" disabled={!chatDraft.trim() || chatSending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1d6ac4] text-white transition hover:bg-[#155099] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Enviar mensagem">
                  {chatSending ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-gray-400">Nunca partilhe palavras-passe, códigos de autenticação ou dados de cartão.</p>
            </form>}
          </div>
          <aside className="border-t border-gray-100 bg-gray-50 p-5 lg:border-l lg:border-t-0">
            <h3 className="text-sm font-black text-gray-900">Como funciona</h3>
            <div className="mt-4 space-y-4 text-xs leading-5 text-gray-500">
              <p><span className="font-bold text-gray-900">1. Envie a mensagem.</span><br />Explique o problema e, se necessário, indique o número da encomenda.</p>
              <p><span className="font-bold text-gray-900">2. A equipa responde.</span><br />O chat atualiza automaticamente enquanto a conversa estiver aberta.</p>
              <p><span className="font-bold text-gray-900">3. Continue quando quiser.</span><br />Com conta, o histórico fica associado ao perfil. Como visitante, use o mesmo navegador.</p>
            </div>
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Segurança</p>
              <p className="mt-2 text-xs leading-5 text-gray-600">Nunca pediremos a sua palavra-passe nem o código completo do cartão pelo chat.</p>
            </div>
          </aside>
        </div>
      </section>

      <section id="support-topics" className="scroll-mt-24">
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
          {filteredTopics.map(({ title, description, icon: Icon, href }) => (
            <Link
              key={title}
              href={href}
              aria-label={`${title}: ${description}`}
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
        {filteredTopics.length === 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
            <p className="text-sm font-bold text-gray-800">Não encontrámos um tema correspondente.</p>
            <p className="mt-1 text-xs text-gray-500">Experimente outra pesquisa ou fale com a equipa de suporte.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-3 text-xs font-bold text-[#1d6ac4] hover:underline">
              Limpar pesquisa
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div id="support-articles" className="scroll-mt-24">
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

        <aside id="support-contacts" className="scroll-mt-24 space-y-3">
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

      <section id="support-faq" className="scroll-mt-24">
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

      <p className="text-center text-[11px] leading-5 text-gray-400">Para questões sobre uma compra, indique o número da encomenda na conversa.</p>
    </main>
  );
}
