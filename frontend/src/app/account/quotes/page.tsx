"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Building2, ChevronRight, FileText, Info, Minus, Plus, Search, Send, ShieldCheck, Trash2, Truck } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type QuoteProduct = { id: number; name: string; detail: string; price: number; image: string; quantity: number };

const catalog: QuoteProduct[] = [
  { id: 1, name: "MacBook Pro M3 14\"", detail: "16GB | 512GB | Space Black", price: 1920000, image: "/conjunto de Apple.png", quantity: 1 },
  { id: 2, name: "iPhone 16 Pro", detail: "256GB | Titânio Natural", price: 1250000, image: "/Iphone_15.png", quantity: 1 },
  { id: 3, name: "Dell Monitor 27\"", detail: "QHD | IPS | 75Hz", price: 280000, image: "/monitor.png", quantity: 1 },
  { id: 4, name: "HP LaserJet Pro 4003dw", detail: "Impressora | Wi-Fi | Duplex", price: 450000, image: "/HP.jpg", quantity: 1 },
];

export default function QuotesPage() {
  const router = useRouter();
  const [items, setItems] = useState<QuoteProduct[]>(catalog);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState({ name: "RUBRICA DILIGENTE (SU), LDA", nif: "", address: "BLOCO 4 1 TRASEIRO, RUA FRANCISCO ARAUJO DANTAS N 109, 4425-440 Mala, Portugal", sector: "Tecnologia e Serviços", phone: "+33 7 58 92 00 80", email: "" });
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const quantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const formatPrice = (value: number) => `${value.toLocaleString("pt-PT")},00`;

  function updateQuantity(id: number, delta: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  }

  function removeItem(id: number) { setItems((current) => current.filter((item) => item.id !== id)); }
  function addProduct() { const available = catalog.find((product) => !items.some((item) => item.id === product.id)); if (available) setItems((current) => [...current, available]); else setMessage("Todos os produtos disponíveis já foram adicionados."); }
  function saveDraft() { setMessage("Envie a cotação para a guardar na sua conta."); }
  async function continueQuote() {
    if (!items.length) { setMessage("Adicione pelo menos um produto à cotação."); return; }
    if (!company.name.trim() || !company.nif.trim() || !company.email.trim() || !company.phone.trim()) {
      setMessage("Preencha o nome, NIF, telefone e e-mail da empresa para continuar.");
      return;
    }
    try {
      const response = await fetchWithAuth("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((item) => ({ productId: item.id, quantity: item.quantity })), companyName: company.name, companyNif: company.nif, address: company.address, sector: company.sector, phone: company.phone, email: company.email }),
      });
      router.push(`/account/quotes/confirmation?id=${response.data.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a cotação.");
    }
  }

  return <div className="space-y-5 pb-8">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1d6ac4]">Conta empresarial (B2B)</p><h1 className="mt-2 text-2xl font-black text-gray-900">Solicitar cotação</h1><p className="mt-1 text-sm text-gray-500">Obtenha uma proposta personalizada com os melhores preços para a sua empresa.</p></div><div className="rounded-lg bg-blue-50 px-4 py-3 text-[10px] font-semibold text-gray-700"><strong className="block text-gray-900">Vantagens B2B</strong><span className="mt-1 block">✓ Preços especiais por volume</span><span className="block">✓ Resposta em até 24 horas</span><span className="block">✓ Apoio comercial dedicado</span></div></div>
    <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[10px] font-bold"><Step number="1" label="Produtos e quantidade" active /><ChevronRight size={14} className="text-gray-300" /><Step number="2" label="Dados da empresa" /><ChevronRight size={14} className="text-gray-300" /><Step number="3" label="Observações" /><ChevronRight size={14} className="text-gray-300" /><Step number="4" label="Revisão e envio" /></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_230px]"><main className="space-y-5"><section className="card overflow-hidden"><SectionHeader number="1" title="Produtos e quantidade" action={<button type="button" onClick={addProduct} className="btn-secondary px-3 py-2 text-[10px]"><Plus size={13} /> Adicionar produtos</button>} /><div className="border-b border-gray-100 p-3"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar produtos para adicionar à sua cotação..." className="settings-input py-2 pl-8 text-xs" /></div></div><div className="hidden grid-cols-[2fr_1fr_120px_1fr_28px] gap-3 bg-gray-50 px-4 py-2 text-[9px] font-bold uppercase text-gray-500 sm:grid"><span>Produto</span><span>Preço unitário (Kz)</span><span>Quantidade</span><span>Total (Kz)</span><span /></div><div className="divide-y divide-gray-100">{items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).map((item) => <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[2fr_1fr_120px_1fr_28px] sm:items-center"><div className="flex items-center gap-3"><img src={item.image} alt="" className="h-10 w-10 rounded bg-gray-50 object-contain" /><div><p className="text-[10px] font-bold text-gray-800">{item.name}</p><p className="text-[9px] text-gray-500">{item.detail}</p></div></div><span className="text-[10px] font-semibold text-gray-700">{formatPrice(item.price)}</span><div className="flex w-fit items-center rounded border border-gray-200"><button type="button" onClick={() => updateQuantity(item.id, -1)} className="p-1 text-gray-500"><Minus size={12} /></button><span className="min-w-7 text-center text-[10px] font-bold">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, 1)} className="p-1 text-gray-500"><Plus size={12} /></button></div><strong className="text-[10px] text-gray-900">{formatPrice(item.price * item.quantity)}</strong><button type="button" onClick={() => removeItem(item.id)} aria-label={`Remover ${item.name}`} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></div>)}</div><button type="button" onClick={addProduct} className="m-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-1 rounded border border-dashed border-blue-200 py-2 text-[10px] font-bold text-[#1555d8]"><Plus size={13} /> Adicionar mais produtos</button></section>
  <section className="card"><SectionHeader number="2" title="Dados da empresa" action={null} /><div className="grid gap-4 p-4 sm:grid-cols-2"><CompanyField label="Nome da empresa" value={company.name} onChange={(value) => setCompany((current) => ({ ...current, name: value }))} /><CompanyField label="Endereço da empresa" value={company.address} onChange={(value) => setCompany((current) => ({ ...current, address: value }))} /><CompanyField label="NIF da empresa" value={company.nif} onChange={(value) => setCompany((current) => ({ ...current, nif: value }))} /><CompanyField label="Sector de actividade" value={company.sector} onChange={(value) => setCompany((current) => ({ ...current, sector: value }))} /><CompanyField label="Telefone" value={company.phone} onChange={(value) => setCompany((current) => ({ ...current, phone: value }))} /><CompanyField label="Email de contacto" value={company.email} onChange={(value) => setCompany((current) => ({ ...current, email: value }))} /></div></section></main><aside className="space-y-4"><section className="card p-5"><h2 className="text-sm font-black text-gray-900">Resumo da cotação</h2><div className="mt-4 space-y-3 text-[10px]"><SummaryRow label="Total de produtos" value={String(items.length)} /><SummaryRow label="Quantidade total" value={String(quantity)} /><SummaryRow label="Subtotal" value={`Kz ${formatPrice(total)}`} /><SummaryRow label="Desconto estimado (B2B)" value="- Kz 0,00" /></div><div className="mt-4 flex justify-between rounded bg-blue-50 p-3 text-xs font-black"><span>Total estimado</span><span>Kz {formatPrice(total)}</span></div><div className="mt-4 rounded bg-blue-50 p-3 text-[10px] leading-4 text-gray-600"><Info size={18} className="mb-1 text-[#1555d8]" />Os valores apresentados são estimativos. A cotação final será enviada pela nossa equipa comercial.</div><button type="button" onClick={continueQuote} className="btn-primary mt-4 w-full py-3 text-xs"><Send size={14} /> Continuar</button><button type="button" onClick={saveDraft} className="btn-secondary mt-2 w-full py-3 text-xs"><FileText size={14} /> Guardar rascunho</button>{message && <p role="status" className="mt-3 rounded bg-green-50 px-3 py-2 text-[10px] text-green-700">{message}</p>}</section></aside></div>
    <div className="grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4"><Benefit icon={FileText} title="Cotações personalizadas" text="Para empresas e revendedores" /><Benefit icon={ShieldCheck} title="Preços competitivos" text="Melhores condições por volume" /><Benefit icon={Building2} title="Apoio comercial dedicado" text="Do pedido à entrega" /><Benefit icon={Truck} title="Entrega em Angola e Portugal" text="Com segurança e rastreamento" /></div>
  </div>;
}

function Step({ number, label, active = false }: { number: string; label: string; active?: boolean }) { return <span className={`flex items-center gap-2 whitespace-nowrap ${active ? "text-[#1555d8]" : "text-gray-500"}`}><b className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] ${active ? "bg-[#1555d8] text-white" : "bg-gray-100 text-gray-600"}`}>{number}</b>{label}</span>; }
function SectionHeader({ number, title, action }: { number: string; title: string; action: React.ReactNode }) { return <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1555d8] text-[9px] font-bold text-white">{number}</span><h2 className="text-xs font-black text-gray-900">{title}</h2></div>{action}</div>; }
function CompanyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="mb-1 block text-[9px] font-bold text-gray-600">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="settings-input py-2 text-[10px]" /></label>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between text-gray-600"><span>{label}</span><strong className="text-gray-900">{value}</strong></div>; }
function Benefit({ icon: Icon, title, text }: { icon: typeof FileText; title: string; text: string }) { return <div className="flex items-center gap-2"><Icon size={20} className="text-[#1555d8]" /><div><p className="text-[10px] font-bold text-gray-800">{title}</p><p className="text-[9px] text-gray-500">{text}</p></div></div>; }
