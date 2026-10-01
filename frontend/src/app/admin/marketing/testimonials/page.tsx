"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, Search, Star, Trash2, X } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Testimonial = { id: number; name: string; location: string; text: string; stars: number; published: boolean; displayOrder: number; createdAt: string };
type TestimonialForm = { name: string; location: string; text: string; stars: number; published: boolean; displayOrder: number };
const emptyForm: TestimonialForm = { name: "", location: "", text: "", stars: 5, published: false, displayOrder: 0 };

export default function MarketingTestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TestimonialForm>(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => testimonials.filter((testimonial) => {
    const matchesSearch = `${testimonial.name} ${testimonial.location} ${testimonial.text}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filter === "ALL" || (filter === "PUBLISHED" ? testimonial.published : !testimonial.published);
    return matchesSearch && matchesStatus;
  }), [testimonials, search, filter]);
  const selected = testimonials.find((testimonial) => testimonial.id === selectedId) || null;

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/testimonials/admin")
      .then((response) => { if (active) setTestimonials(response.data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os testemunhos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function reload() {
    const response = await fetchWithAuth("/api/testimonials/admin");
    setTestimonials(response.data);
    setSelectedId((current) => response.data.some((item: Testimonial) => item.id === current) ? current : response.data[0]?.id || null);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function startEdit(testimonial: Testimonial) {
    setEditingId(testimonial.id);
    setForm({ name: testimonial.name, location: testimonial.location, text: testimonial.text, stars: testimonial.stars, published: testimonial.published, displayOrder: testimonial.displayOrder });
    setError("");
    setShowForm(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetchWithAuth(editingId ? `/api/testimonials/${editingId}` : "/api/testimonials", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setNotice(editingId ? "Testemunho atualizado." : "Testemunho criado.");
      await reload();
      setSelectedId(response.data.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar o testemunho.");
    } finally { setBusy(false); }
  }

  async function deleteTestimonial(testimonial: Testimonial) {
    if (!window.confirm(`Eliminar o testemunho de ${testimonial.name}?`)) return;
    setBusy(true);
    setError("");
    try {
      await fetchWithAuth(`/api/testimonials/${testimonial.id}`, { method: "DELETE" });
      setNotice("Testemunho removido.");
      await reload();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível remover o testemunho.");
    } finally { setBusy(false); }
  }

  return <main>
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Marketing · Prova social</p><h1 className="mt-1 text-2xl font-black">Testemunhos</h1><p className="mt-1 text-sm text-gray-500">Modere avaliações e controle a ordem de publicação na loja.</p></div><button type="button" onClick={startCreate} className="inline-flex items-center gap-2 bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"><Plus size={15} />Novo testemunho</button></div>
    {notice && <p role="status" className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Total" value={testimonials.length} /><Metric label="Publicados" value={testimonials.filter((item) => item.published).length} /><Metric label="A aguardar revisão" value={testimonials.filter((item) => !item.published).length} /></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="min-w-0 border border-gray-200 bg-white"><div className="grid gap-2 border-b border-gray-200 p-4 sm:grid-cols-[minmax(180px,1fr)_180px]"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar nome, local ou texto" className="w-full border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-700" /></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="ALL">Todos os estados</option><option value="PUBLISHED">Publicados</option><option value="PENDING">A aguardar revisão</option></select></div><div className="divide-y divide-gray-100">{loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500"><LoaderCircle size={16} className="animate-spin" />A carregar testemunhos...</div> : filtered.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">Nenhum testemunho encontrado.</div> : filtered.map((testimonial) => <button type="button" key={testimonial.id} onClick={() => setSelectedId(testimonial.id)} className={`w-full px-4 py-3 text-left hover:bg-blue-50/40 ${selectedId === testimonial.id ? "bg-blue-50/60" : ""}`}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs text-gray-900">{testimonial.name} · {testimonial.location}</strong><span className={`px-2 py-1 text-[9px] font-bold ${testimonial.published ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{testimonial.published ? "Publicado" : "Pendente"}</span></div><div className="mt-1 flex items-center gap-0.5 text-amber-500">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={11} fill={index < testimonial.stars ? "currentColor" : "none"} />)}<span className="ml-1 text-[9px] text-gray-500">· posição {testimonial.displayOrder}</span></div><p className="mt-2 line-clamp-2 text-xs text-gray-600">{testimonial.text}</p></button>)}</div></section>
    <aside className="border border-gray-200 bg-white">{!selected ? <p className="p-8 text-center text-sm text-gray-500">Selecione um testemunho para ver os detalhes.</p> : <div className="space-y-3 p-4"><div className="border-b border-gray-100 pb-3"><p className="text-[9px] font-black uppercase tracking-widest text-blue-700">Detalhe do testemunho</p><h2 className="mt-1 text-base font-black">{selected.name}</h2><p className="text-xs text-gray-500">{selected.location}</p></div><p className="text-sm leading-6 text-gray-700">“{selected.text}”</p><p className="text-xs text-gray-500">{selected.stars}/5 · ordem {selected.displayOrder}</p><div className="flex gap-2 border-t border-gray-100 pt-3"><button type="button" onClick={() => startEdit(selected)} className="flex-1 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">Editar / moderar</button><button type="button" disabled={busy} onClick={() => void deleteTestimonial(selected)} aria-label="Eliminar testemunho" className="border border-red-200 px-3 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} /></button></div></div>}</aside></div>
    {showForm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"><section role="dialog" aria-modal="true" aria-labelledby="testimonial-title" className="max-h-[94vh] w-full max-w-xl overflow-y-auto bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><div><h2 id="testimonial-title" className="text-lg font-black">{editingId ? "Editar testemunho" : "Novo testemunho"}</h2><p className="mt-1 text-xs text-gray-500">Publicação e ordem controlam a exibição na loja.</p></div><button type="button" onClick={() => setShowForm(false)} aria-label="Fechar" className="p-2 text-gray-500 hover:bg-gray-100"><X size={18} /></button></div><form onSubmit={save} className="space-y-4 p-5"><label className="block text-xs font-bold text-gray-700">Nome<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="block text-xs font-bold text-gray-700">Localização<input required minLength={2} maxLength={120} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="block text-xs font-bold text-gray-700">Testemunho<textarea required minLength={10} maxLength={1000} rows={5} value={form.text} onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))} className="mt-1 w-full resize-y border border-gray-300 px-3 py-2.5" /></label><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold text-gray-700">Classificação<select value={form.stars} onChange={(event) => setForm((current) => ({ ...current, stars: Number(event.target.value) }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5">{[5, 4, 3, 2, 1].map((stars) => <option key={stars} value={stars}>{stars} estrelas</option>)}</select></label><label className="text-xs font-bold text-gray-700">Ordem<input type="number" min="0" value={form.displayOrder} onChange={(event) => setForm((current) => ({ ...current, displayOrder: Number(event.target.value) }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="text-xs font-bold text-gray-700">Publicação<select value={String(form.published)} onChange={(event) => setForm((current) => ({ ...current, published: event.target.value === "true" }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5"><option value="false">Pendente</option><option value="true">Publicado</option></select></label></div><div className="flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">Fechar</button><button type="submit" disabled={busy} className="bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "A guardar..." : "Guardar testemunho"}</button></div></form></section></div>}
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="border border-gray-200 bg-white p-4"><p className="text-[10px] font-bold uppercase text-gray-500">{label}</p><p className="mt-2 text-2xl font-black text-gray-900">{value}</p></div>;
}
