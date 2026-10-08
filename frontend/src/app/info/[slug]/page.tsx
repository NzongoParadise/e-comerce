import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Headphones,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";

type InfoPage = {
  kicker: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string; href?: string; action?: string }>;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  note?: string;
};

const pages: Record<string, InfoPage> = {
  about: {
    kicker: "A EMPRESA",
    title: "Tecnologia para avançar.",
    intro: "Uma experiência de comércio eletrónico pensada para clientes em Angola e Portugal, com catálogo online e apoio ao longo da compra.",
    sections: [
      { title: "O que fazemos", body: "Disponibilizamos equipamentos, computadores, smartphones, acessórios e outras soluções tecnológicas.", href: "/products", action: "Explorar catálogo" },
      { title: "Dois mercados", body: "Consulte a loja para Angola ou Portugal e confirme moeda, entrega e opções disponíveis no checkout.", href: "/info/shipping", action: "Ver entregas" },
      { title: "Particulares e empresas", body: "Clientes particulares compram na loja e empresas podem consultar a área B2B para cotações e compras empresariais.", href: "/b2b", action: "Conhecer B2B" },
    ],
    cta: { label: "Ver produtos", href: "/products" },
    secondary: { label: "Contactar a equipa", href: "/info/contact" },
  },
  contact: {
    kicker: "CONTACTOS",
    title: "Fale connosco.",
    intro: "Precisa de ajuda com um produto, uma encomenda ou uma questão comercial? Escolha o canal mais conveniente.",
    sections: [
      { title: "Chat de suporte", body: "Envie a sua questão à equipa. Para assuntos sobre uma compra, indique o número da encomenda.", href: "/account/support", action: "Abrir chat" },
      { title: "E-mail", body: "Escreva para suporte@techglobal.co.ao e inclua os dados necessários para identificarmos o pedido.", href: "mailto:suporte@techglobal.co.ao", action: "Enviar e-mail" },
      { title: "Telefone", body: "+33 7 58 92 00 80", href: "tel:+33758920080", action: "Ligar" },
      { title: "Morada", body: "4425-440 Mala, Portugal. Para uma questão sobre uma encomenda, use também o chat de suporte.", href: "/account/support", action: "Pedir orientação" },
    ],
    cta: { label: "Falar com o suporte", href: "/account/support" },
    secondary: { label: "Consultar encomendas", href: "/account/orders" },
  },
  "how-to-buy": {
    kicker: "COMO COMPRAR",
    title: "Comprar, passo a passo.",
    intro: "Encontre o artigo, reveja os detalhes e confirme a encomenda no checkout. O resumo final mostra os valores antes da compra.",
    sections: [
      { title: "1. Encontre", body: "Pesquise no catálogo ou navegue pelas categorias para localizar o artigo.", href: "/products", action: "Abrir catálogo" },
      { title: "2. Confirme", body: "Reveja preço, disponibilidade, características e informação do produto.", href: "/products", action: "Ver produtos" },
      { title: "3. Prepare", body: "Adicione os artigos ao carrinho e confirme as quantidades selecionadas.", href: "/cart", action: "Ver carrinho" },
      { title: "4. Finalize", body: "No checkout, escolha morada, entrega e pagamento e reveja o total antes de confirmar.", href: "/checkout", action: "Ir para checkout" },
    ],
    cta: { label: "Começar a comprar", href: "/products" },
    secondary: { label: "Ver opções de pagamento", href: "/info/payments" },
  },
  warranty: {
    kicker: "GARANTIA E PÓS-VENDA",
    title: "Apoio depois da compra.",
    intro: "Se precisar de assistência, reúna os dados da encomenda e a informação do artigo para que a equipa possa orientar o próximo passo.",
    sections: [
      { title: "Consulte o artigo", body: "As condições podem variar conforme o produto e a documentação que o acompanha.", href: "/account/orders", action: "Ver encomendas" },
      { title: "Descreva o problema", body: "Indique o que aconteceu, quando começou e quais os passos que já tentou.", href: "/account/support", action: "Contactar suporte" },
      { title: "Tenha a encomenda à mão", body: "O número da encomenda ajuda a equipa a localizar a compra e dar seguimento ao pedido.", href: "/account/orders", action: "Consultar histórico" },
    ],
    cta: { label: "Pedir assistência", href: "/account/support" },
    secondary: { label: "Ver devoluções", href: "/info/returns" },
  },
  terms: {
    kicker: "INFORMAÇÃO DA LOJA",
    title: "Termos e condições.",
    intro: "Consulte os pontos gerais a ter em conta ao utilizar a loja e ao concluir uma encomenda.",
    sections: [
      { title: "Encomendas", body: "Antes de confirmar, reveja os artigos, quantidades, morada, método de entrega e total apresentados no checkout.", href: "/info/how-to-buy", action: "Como comprar" },
      { title: "Preços e disponibilidade", body: "Os valores, stock e opções aplicáveis são apresentados na loja e confirmados durante o processo de compra.", href: "/products", action: "Ver catálogo" },
      { title: "Conta e segurança", body: "Mantenha os dados da conta atualizados e proteja as suas credenciais de acesso.", href: "/account/profile", action: "Aceder à conta" },
    ],
    cta: { label: "Falar com a empresa", href: "/info/contact" },
    secondary: { label: "Centro de ajuda", href: "/info/support" },
    note: "Esta página apresenta informação geral da loja. As condições completas aplicáveis à sua compra devem ser confirmadas nos documentos e no checkout antes da encomenda.",
  },
  privacy: {
    kicker: "PRIVACIDADE",
    title: "A sua informação merece cuidado.",
    intro: "A loja utiliza dados necessários para gerir a conta, processar encomendas e prestar apoio relacionado com a compra.",
    sections: [
      { title: "Dados da conta", body: "Os dados de perfil ajudam a identificar a conta e a gerir as interações com a loja.", href: "/account/profile", action: "Ver perfil" },
      { title: "Encomendas e entrega", body: "Os dados necessários à compra permitem tratar os artigos, o pagamento e a entrega selecionada.", href: "/account/orders", action: "Ver encomendas" },
      { title: "Pedidos de privacidade", body: "Para esclarecer uma questão sobre os seus dados, contacte a equipa através dos canais de suporte.", href: "/info/contact", action: "Contactar equipa" },
    ],
    cta: { label: "Contactar sobre privacidade", href: "/info/contact" },
    secondary: { label: "Centro de ajuda", href: "/info/support" },
    note: "Para uma política formal, consulte a versão completa disponibilizada pela empresa e aplicável ao seu mercado.",
  },
  blog: {
    kicker: "GUIAS E CONTEÚDOS",
    title: "Escolha com mais informação.",
    intro: "Explore o catálogo, compare alternativas e consulte as informações úteis antes de escolher um equipamento.",
    sections: [
      { title: "Guias de compra", body: "Comece por definir o que precisa e consulte as características dos artigos disponíveis.", href: "/products", action: "Explorar produtos" },
      { title: "Compare alternativas", body: "Coloque produtos lado a lado para rever diferenças antes de decidir.", href: "/compare", action: "Abrir comparação" },
      { title: "Informação de compra", body: "Consulte os detalhes de pagamento, entrega e pós-venda antes de finalizar.", href: "/info/how-to-buy", action: "Ver como comprar" },
    ],
    cta: { label: "Explorar catálogo", href: "/products" },
    secondary: { label: "Comparar produtos", href: "/compare" },
  },
};

const icons = [BookOpen, PackageCheck, CreditCard, Truck, ShieldCheck, UserRound, Building2, ClipboardCheck];

export default async function PublicInfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <nav aria-label="Navegação estrutural" className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-xs text-slate-500 sm:px-6 lg:px-8">
          <Link href="/" className="transition hover:text-blue-700">Início</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="font-semibold text-slate-800">{page.kicker}</span>
        </nav>
      </div>

      <section className="relative isolate overflow-hidden bg-[#10243a]">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-700/30 via-transparent to-transparent" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-blue-100">
              <FileText size={15} /> {page.kicker}
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">{page.title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">{page.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={page.cta.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243a]">
                {page.cta.label} <ArrowRight size={16} />
              </Link>
              {page.secondary && <Link href={page.secondary.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                {page.secondary.label}
              </Link>}
            </div>
          </div>
          <aside className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-400/10 text-blue-200"><Headphones size={21} /></div>
            <h2 className="mt-4 text-lg font-extrabold text-white">Precisa de orientação?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">A equipa pode ajudar com dúvidas sobre produtos, compras e encomendas.</p>
            <Link href="/account/support" className="mt-5 inline-flex items-center gap-2 border-t border-white/10 pt-4 text-xs font-bold text-blue-200 transition hover:text-white">
              Abrir o centro de suporte <ArrowRight size={14} />
            </Link>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{page.kicker}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Informação para o próximo passo</h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.sections.map((section, index) => {
            const Icon = icons[index % icons.length];
            return <article key={section.title} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon size={19} /></span>
              <h3 className="mt-4 text-base font-extrabold text-slate-950">{section.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{section.body}</p>
              {section.href && <Link href={section.href} className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 transition hover:text-blue-900">
                {section.action || "Saber mais"} <ArrowRight size={14} />
              </Link>}
            </article>;
          })}
        </div>

        {page.note && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">{page.note}</p>}

        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div><h2 className="text-base font-extrabold text-slate-950">Ainda tem alguma dúvida?</h2><p className="mt-1 text-sm text-slate-600">Fale com a equipa e indique o assunto para receber ajuda adequada.</p></div>
          <Link href="/account/support" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <Headphones size={16} /> Contactar suporte
          </Link>
        </div>
      </section>
    </main>
  );
}
