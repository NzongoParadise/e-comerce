"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, Plus, Power, Save } from "lucide-react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api";

type Promotion = {
  id: number; name: string; slug: string; code?: string | null; status: string; startAt: string; endAt?: string | null;
  priority: number; stackable: boolean; exclusive: boolean; usageLimit?: number | null; perCustomerLimit?: number | null;
  actions: { type: string; value?: string | number | null }[]; _count: { usages: number };
};
type Option = { id: number; name: string; slug: string };

const initial = {
  name: "", slug: "", description: "", code: "", status: "DRAFT", startAt: new Date().toISOString().slice(0, 16),
  endAt: "", priority: "100", stackable: false, exclusive: false, usageLimit: "", perCustomerLimit: "",
  minOrderAOA: "", minOrderEUR: "", actionType: "PERCENTAGE", actionValue: "10", maxDiscount: "",
  ruleKind: "NONE", ruleValue: "", productIds: [] as number[], categoryIds: [] as number[], brandIds: [] as number[],
};

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [form, setForm] = useState(initial);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [promo, categoryResult, brandResult, productResult] = await Promise.all([
        fetchWithAuth("/api/admin/marketing/promotions"),
        fetchWithAuth("/api/categories"),
        fetchWithAuth("/api/brands"),
        fetchWithAuth("/api/products?page=1&pageSize=100"),
      ]);
      setPromotions(promo.data);
      setCategories(categoryResult.data);
      setBrands(brandResult.data);
      setProducts(productResult.data.map((p: any) => ({ id: p.id, name: p.name, slug: p.slug })));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar as promoções."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function createPromotion(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = {
        name: form.name, slug: form.slug, description: form.description || null, code: form.code || null, status: form.status,
        startAt: new Date(form.startAt).toISOString(), endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        priority: Number(form.priority), stackable: form.stackable, exclusive: form.exclusive,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null, perCustomerLimit: form.perCustomerLimit ? Number(form.perCustomerLimit) : null,
        minOrderAOA: form.minOrderAOA ? Number(form.minOrderAOA) : null, minOrderEUR: form.minOrderEUR ? Number(form.minOrderEUR) : null,
        rules: form.ruleKind === "NONE" ? [] : [{ kind: form.ruleKind, operator: form.ruleKind === "MIN_ORDER" ? "GTE" : "EQ", value: form.ruleValue }],
        actions: [{ type: form.actionType, value: form.actionType === "FREE_SHIPPING" ? undefined : Number(form.actionValue), maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null }],
        productIds: form.productIds, categoryIds: form.categoryIds, brandIds: form.brandIds,
      };
      await fetchWithAuth("/api/admin/marketing/promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setNotice("Promoção criada com sucesso.");
      setForm(initial); setShow(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar a promoção."); }
    finally { setBusy(false); }
  }

  async function deactivate(id: number) {
    if (!window.confirm("Desativar esta promoção? Os pedidos anteriores serão preservados.")) return;
    setBusy(true);
    try { await fetchWithAuth(`/api/admin/marketing/promotions/${id}`, { method: "DELETE" }); setNotice("Promoção desativada."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível desativar."); }
    finally { setBusy(false); }
  }

  const toggle = (field: "productIds" | "categoryIds" | "brandIds", id: number) => setForm((current) => ({ ...current, [field]: current[field].includes(id) ? current[field].filter((v) => v !== id) : [...current[field], id] }));

  return <main className="mx-auto max-w-[1440px]">
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><Link href="/admin/marketing" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700"><ArrowLeft size={12}/> Marketing</Link><p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Marketing · Promotion Engine</p><h1 className="mt-1 text-2xl font-black">Promoções comerciais</h1><p className="mt-1 text-sm text-gray-500">Regras por cliente, produto, canal e período, com controlo de acumulação.</p></div>
      <button onClick={() => { setShow(true); setError(""); }} className="inline-flex items-center gap-2 bg-blue-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-800"><Plus size={15}/> Nova promoção</button>
    </div>
    {notice && <div className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    {error && <div role="alert" className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    <section className="border border-gray-200 bg-white">
      <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.5fr_0.5fr] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[9px] font-black uppercase text-gray-500"><span>Campanha</span><span>Estado</span><span>Oferta</span><span>Período</span><span>Prioridade</span><span>Usos</span></div>
      {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500"><LoaderCircle size={16} className="animate-spin"/>A carregar...</div> : promotions.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">Ainda não existem promoções.</div> : <div className="divide-y divide-gray-100">{promotions.map((promotion) => <div key={promotion.id} className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.5fr_0.5fr] items-center gap-3 px-4 py-4 text-xs"><div><strong className="block">{promotion.name}</strong><span className="text-[10px] text-gray-500">{promotion.code || promotion.slug}</span></div><span className="w-fit bg-gray-100 px-2 py-1 text-[9px] font-bold">{promotion.status}</span><span>{promotion.actions.map((a) => a.type === "PERCENTAGE" ? `${a.value}%` : a.type === "FIXED" ? `Kz ${a.value}` : a.type === "FREE_SHIPPING" ? "Frete grátis" : a.type).join(" + ")}</span><span className="text-[10px] text-gray-600">{new Date(promotion.startAt).toLocaleDateString("pt-PT")} {promotion.endAt ? `→ ${new Date(promotion.endAt).toLocaleDateString("pt-PT")}` : "→ sem fim"}</span><span>{promotion.priority}</span><div className="flex items-center justify-between gap-2"><strong>{promotion._count.usages}</strong>{promotion.status === "ACTIVE" && <button title="Desativar" onClick={() => void deactivate(promotion.id)} disabled={busy} className="text-red-700"><Power size={14}/></button>}</div></div>)}</div>}
    </section>

    {show && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3"><form onSubmit={createPromotion} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto bg-white p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-black">Nova promoção</h2><p className="text-xs text-gray-500">O motor valida as regras no servidor antes do pedido.</p></div><button type="button" onClick={() => setShow(false)} className="text-gray-500">Fechar</button></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold">Nome<input required value={form.name} onChange={e => setForm({...form,name:e.target.value})} className="mt-1 w-full border p-2.5"/></label>
        <label className="text-xs font-bold">Slug<input required value={form.slug} onChange={e => setForm({...form,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-")})} className="mt-1 w-full border p-2.5"/></label>
        <label className="text-xs font-bold">Código opcional<input value={form.code} onChange={e => setForm({...form,code:e.target.value.toUpperCase()})} className="mt-1 w-full border p-2.5" placeholder="BLACK10"/></label>
        <label className="text-xs font-bold">Estado<select value={form.status} onChange={e => setForm({...form,status:e.target.value})} className="mt-1 w-full border bg-white p-2.5"><option>DRAFT</option><option>ACTIVE</option><option>PAUSED</option></select></label>
        <label className="text-xs font-bold">Início<input required type="datetime-local" value={form.startAt} onChange={e => setForm({...form,startAt:e.target.value})} className="mt-1 w-full border p-2.5"/></label>
        <label className="text-xs font-bold">Fim<input type="datetime-local" value={form.endAt} onChange={e => setForm({...form,endAt:e.target.value})} className="mt-1 w-full border p-2.5"/></label>
        <label className="text-xs font-bold">Prioridade<input type="number" min="0" value={form.priority} onChange={e => setForm({...form,priority:e.target.value})} className="mt-1 w-full border p-2.5"/></label>
        <label className="text-xs font-bold">Tipo de benefício<select value={form.actionType} onChange={e => setForm({...form,actionType:e.target.value})} className="mt-1 w-full border bg-white p-2.5"><option value="PERCENTAGE">Percentagem</option><option value="FIXED">Valor fixo</option><option value="FIXED_PRICE">Preço fixo por unidade</option><option value="FREE_SHIPPING">Frete grátis</option></select></label>
        {form.actionType !== "FREE_SHIPPING" && <label className="text-xs font-bold">Valor<input required type="number" min="0.01" step="0.01" value={form.actionValue} onChange={e => setForm({...form,actionValue:e.target.value})} className="mt-1 w-full border p-2.5"/></label>}
        <label className="text-xs font-bold">Limite global<input type="number" min="1" value={form.usageLimit} onChange={e => setForm({...form,usageLimit:e.target.value})} className="mt-1 w-full border p-2.5" placeholder="Sem limite"/></label>
        <label className="text-xs font-bold">Limite por cliente<input type="number" min="1" value={form.perCustomerLimit} onChange={e => setForm({...form,perCustomerLimit:e.target.value})} className="mt-1 w-full border p-2.5" placeholder="Sem limite"/></label>
        <label className="text-xs font-bold">Mínimo AOA<input type="number" min="0" value={form.minOrderAOA} onChange={e => setForm({...form,minOrderAOA:e.target.value})} className="mt-1 w-full border p-2.5"/></label>
        <label className="text-xs font-bold">Mínimo EUR<input type="number" min="0" value={form.minOrderEUR} onChange={e => setForm({...form,minOrderEUR:e.target.value})} className="mt-1 w-full border p-2.5"/></label>
        <label className="text-xs font-bold">Regra de cliente/canal<select value={form.ruleKind} onChange={e => setForm({...form,ruleKind:e.target.value})} className="mt-1 w-full border bg-white p-2.5"><option value="NONE">Sem regra extra</option><option value="CUSTOMER_TIER">Nível do cliente</option><option value="CHANNEL">Canal</option><option value="MARKET">Mercado</option><option value="FIRST_ORDER">Primeira compra</option><option value="MIN_ORDER">Valor mínimo por regra</option></select></label>
        {form.ruleKind !== "NONE" && <label className="text-xs font-bold">Valor da regra<input required value={form.ruleValue} onChange={e => setForm({...form,ruleValue:e.target.value.toUpperCase()})} className="mt-1 w-full border p-2.5" placeholder={form.ruleKind === "CUSTOMER_TIER" ? "GOLD" : form.ruleKind === "CHANNEL" ? "ONLINE" : form.ruleKind === "MARKET" ? "AO" : form.ruleKind === "FIRST_ORDER" ? "true" : "100000"}/></label>}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div><p className="mb-1 text-xs font-bold">Categorias alvo</p><select multiple value={form.categoryIds.map(String)} onChange={e => setForm({...form,categoryIds:Array.from(e.target.selectedOptions).map(o=>Number(o.value))})} className="h-28 w-full border p-2 text-xs">{categories.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        <div><p className="mb-1 text-xs font-bold">Marcas alvo</p><select multiple value={form.brandIds.map(String)} onChange={e => setForm({...form,brandIds:Array.from(e.target.selectedOptions).map(o=>Number(o.value))})} className="h-28 w-full border p-2 text-xs">{brands.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        <div><p className="mb-1 text-xs font-bold">Produtos alvo</p><select multiple value={form.productIds.map(String)} onChange={e => setForm({...form,productIds:Array.from(e.target.selectedOptions).map(o=>Number(o.value))})} className="h-28 w-full border p-2 text-xs">{products.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 border-t pt-4 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={form.stackable} onChange={e=>setForm({...form,stackable:e.target.checked})}/> Pode acumular</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.exclusive} onChange={e=>setForm({...form,exclusive:e.target.checked})}/> Exclusiva</label></div>
      <div className="mt-5 flex justify-end gap-2 border-t pt-4"><button type="button" onClick={()=>setShow(false)} className="border px-4 py-2 text-sm font-bold">Cancelar</button><button disabled={busy} className="inline-flex items-center gap-2 bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={15}/>{busy ? "A guardar..." : "Criar promoção"}</button></div>
    </form></div>}
  </main>;
}
