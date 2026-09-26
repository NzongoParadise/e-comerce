"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Check, ChevronRight, Clock3, FileText, Info, Mail, Phone, Send, ShieldCheck } from "lucide-react";

type QuoteProduct = { id: number; name: string; detail: string; price: number; image: string; quantity: number };
type Company = { name: string; nif: string; address: string; sector: string; phone: string; email: string };

const fallbackItems: QuoteProduct[] = [
  { id: 1, name: "MacBook Pro M3 14\"", detail: "16GB | 512GB | Space Black", price: 1920000, image: "/conjunto de Apple.png", quantity: 5 },
  { id: 2, name: "iPhone 16 Pro", detail: "256GB | Titânio Natural", price: 1250000, image: "/Iphone_15.png", quantity: 10 },
  { id: 3, name: "Dell Monitor 27\"", detail: "QHD | IPS | 75Hz", price: 280000, image: "/monitor.png", quantity: 15 },
  { id: 4, name: "HP LaserJet Pro 4003dw", detail: "Impressora | Wi-Fi | Duplex", price: 450000, image: "/HP.jpg", quantity: 8 },
];

export default function QuoteConfirmationPage() {
  const [items, setItems] = useState<QuoteProduct[]>(fallbackItems);
  const [company, setCompany] = useState<Company>({ name: "TechGlobal Lda", nif: "5417283901", address: "Talatona, Luanda", sector: "Tecnologia e Serviços", phone: "+244 923 000 000", email: "empresa@techglobal.ao" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
    const saved = localStorage.getItem("tg_quote_draft");
    if (saved) {
      try {
        const draft = JSON.parse(saved) as { items?: QuoteProduct[]; company?: Company };
        if (draft.items?.length) setItems(draft.items);
        if (draft.company) setCompany((current) => ({ ...current, ...draft.company }));
      } catch { localStorage.removeItem("tg_quote_draft"); }
    }
    setLoaded(true);
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const formatPrice = (value: number) => `${value.toLocaleString("pt-PT")},00`;
  if (!loaded) return <div className="container mx-auto px-4 py-24 text-center text-sm text-gray-500">A carregar a cotação...</div>;

  return <div className="space-y-5 pb-8"><nav className="text-[10px] text-gray-400"><Link href="/" className="hover:text-[#1d6ac4]">Início</Link> › Área empresarial (B2B) › Solicitar cotação › <span className="font-semibold text-gray-700">Cotação enviada</span></nav><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_255px]"><main className="space-y-5"><section className="flex items-center gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600"><Check size={34} strokeWidth={3} /></span><div><h1 className="text-xl font-black text-gray-900">A sua cotação foi enviada com sucesso!</h1><p className="mt-1 text-xs text-gray-600">A nossa equipa comercial recebeu o seu pedido e irá analisá-lo.</p><p className="text-xs text-gray-500">Receberá uma resposta no prazo de 24 horas úteis.</p></div></section><div className="grid gap-3 sm:grid-cols-3"><InfoCard icon={FileText} label="Nº da cotação" value="CT20250920-008" detail="20 de Setembro de 2026 | 16:42" /><InfoCard icon={Building2} label="Empresa" value={company.name} detail={`NIF: ${company.nif}`} /><InfoCard icon={Clock3} label="Tempo de resposta" value="Até 24 horas úteis" detail="Iremos contactá-lo por e-mail ou telefone." /></div><section className="card overflow-hidden"><div className="border-b border-gray-100 px-5 py-4"><h2 className="text-sm font-black text-gray-900">Resumo da cotação</h2></div><div className="hidden grid-cols-[2fr_1fr_100px_1fr] gap-3 bg-gray-50 px-5 py-2 text-[9px] font-bold uppercase text-gray-500 sm:grid"><span>Produto</span><span>Preço unitário (Kz)</span><span>Quantidade</span><span className="text-right">Subtotal (Kz)</span></div><div className="divide-y divide-gray-100">{items.map((item) => <div key={item.id} className="grid gap-3 px-5 py-3 sm:grid-cols-[2fr_1fr_100px_1fr] sm:items-center"><div className="flex items-center gap-3"><img src={item.image} alt="" className="h-10 w-10 rounded bg-gray-50 object-contain" /><div><p className="text-[10px] font-bold text-gray-900">{item.name}</p><p className="text-[9px] text-gray-500">{item.detail}</p></div></div><span className="text-[10px] font-semibold text-gray-700">{formatPrice(item.price)}</span><span className="text-[10px] font-semibold text-gray-700">{item.quantity}</span><strong className="text-right text-[10px] text-gray-900">{formatPrice(item.price * item.quantity)}</strong></div>)}</div><div className="m-3 flex items-start gap-2 rounded bg-blue-50 px-3 py-2 text-[10px] leading-4 text-gray-600"><Info size={16} className="shrink-0 text-[#1555d8]" />Os preços apresentados na sua cotação são referenciais. A proposta final será enviada com preços e condições especiais para empresas.</div><div className="grid gap-2 p-3 sm:grid-cols-3"><Link href="/account/quotes" className="btn-secondary px-2 py-2 text-[10px]"><ChevronRight size={13} className="rotate-180" /> Ver todas as cotações</Link><Link href="/account/quotes" className="btn-secondary px-2 py-2 text-[10px]"><FileText size={13} /> Editar pedido</Link><Link href="/account/support" className="btn-primary px-2 py-2 text-[10px]"><Send size={13} /> Falar com um comercial</Link></div></section><div className="grid gap-3 sm:grid-cols-[1.3fr_0.7fr]"><section className="relative min-h-[130px] overflow-hidden rounded-lg bg-[#eaf3ff] p-5"><h2 className="relative max-w-[230px] text-lg font-black leading-tight text-gray-900">Tecnologia que impulsiona o seu negócio</h2><p className="relative mt-2 max-w-[220px] text-[10px] text-gray-600">Equipamentos, suporte e soluções especiais para empresas.</p><Link href="/products" className="relative mt-4 inline-flex rounded bg-[#1555d8] px-3 py-2 text-[10px] font-bold text-white">Ver soluções B2B <ChevronRight size={12} /></Link></section><section className="card p-5"><h2 className="text-sm font-black text-gray-900">Vantagens de ser cliente empresarial</h2><ul className="mt-3 space-y-2 text-[10px] text-gray-600"><li>✓ Preços especiais por volume</li><li>✓ Condições de pagamento flexíveis</li><li>✓ Apoio comercial dedicado</li><li>✓ Entregas em Angola e Portugal</li></ul></section></div></main><aside className="space-y-4"><section className="card p-5"><h2 className="text-sm font-black text-gray-900">Estado da sua cotação</h2><div className="mt-4 space-y-4">{[["Pedido enviado", "20 de Setembro de 2026 | 16:42", "Recebemos a sua solicitação."], ["Em análise", "", "A nossa equipa está a analisar os produtos, quantidades e condições."], ["Proposta a ser preparada", "", "Iremos elaborar uma proposta personalizada para a sua empresa."], ["Resposta enviada", "", "Receberá a resposta por e-mail ou telefone."]].map(([title, date, detail], index) => <div key={title} className="flex gap-3"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${index === 0 ? "bg-green-600 text-white" : index === 1 ? "bg-[#1555d8] text-white" : "bg-gray-200 text-gray-500"}`}>{index === 0 ? <Check size={13} /> : index + 1}</span><div><p className="text-[10px] font-bold text-gray-800">{title}</p>{date && <p className="text-[9px] text-gray-500">{date}</p>}<p className="mt-1 text-[9px] text-gray-500">{detail}</p></div></div>)}</div></section><section className="card p-5"><h2 className="text-sm font-black text-gray-900">Precisa de algo mais?</h2><p className="mt-1 text-[10px] text-gray-500">A nossa equipa empresarial está disponível para si.</p><div className="mt-4 space-y-3 text-[10px] text-gray-700"><p><Phone size={14} className="mr-2 inline text-[#1555d8]" />+244 923 000 000</p><p><Mail size={14} className="mr-2 inline text-[#1555d8]" />{company.email}</p></div><Link href="/account/support" className="btn-secondary mt-4 w-full px-3 py-2 text-[10px]">Agendar uma reunião</Link></section><section className="card flex items-center gap-3 p-4"><ShieldCheck className="text-[#1555d8]" size={22} /><div><p className="text-xs font-bold text-gray-900">Pedido seguro</p><p className="text-[10px] text-gray-500">Os seus dados são tratados com confidencialidade.</p></div></section></aside></div></div>;
}

function InfoCard({ icon: Icon, label, value, detail }: { icon: typeof FileText; label: string; value: string; detail: string }) { return <section className="card p-4"><Icon size={19} className="text-[#1555d8]" /><p className="mt-2 text-[9px] font-bold text-gray-500">{label}</p><p className="text-xs font-black text-gray-900">{value}</p><p className="mt-1 text-[9px] text-gray-500">{detail}</p></section>; }
