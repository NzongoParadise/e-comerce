"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileDown, LoaderCircle, Plus, Search, X, Megaphone } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Coupon = {
  id: number;
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string | number;
  minimumOrderKZ?: string | number | null;
  expiresAt?: string | null;
  active: boolean;
  createdAt: string;
  _count: { users: number };
};
type CouponForm = { code: string; description: string; discountType: "PERCENTAGE" | "FIXED"; discountValue: string; minimumOrderKZ: string; expiresAt: string; active: boolean };
type CouponStats = { active: number; inactive: number; expired: number };

const blankForm: CouponForm = { code: "", description: "", discountType: "PERCENTAGE", discountValue: "10", minimumOrderKZ: "", expiresAt: "", active: true };

function discountLabel(coupon: Coupon) {
  return coupon.discountType === "PERCENTAGE"
    ? `${Number(coupon.discountValue).toLocaleString("pt-PT")}%`
    : `Kz ${Number(coupon.discountValue).toLocaleString("pt-AO", { minimumFractionDigits: 2 })}`;
}

function couponStatus(coupon: Coupon): "ACTIVE" | "INACTIVE" | "EXPIRED" {
  if (coupon.expiresAt && new Date(coupon.expiresAt) <= new Date()) return "EXPIRED";
  return coupon.active ? "ACTIVE" : "INACTIVE";
}

export default function MarketingCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats>({ active: 0, inactive: 0, expired: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CouponForm>(blankForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = coupons.find((coupon) => coupon.id === selectedId) || null;

  async function loadCoupons() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ search, status: statusFilter, page: String(page), pageSize: "20" });
      const response = await fetchWithAuth(`/api/admin/marketing/coupons?${query}`);
      setCoupons(response.data);
      setStats(response.stats);
      setPageCount(response.meta.pageCount || 1);
      setSelectedId((current: number | null) => response.data.some((coupon: Coupon) => coupon.id === current) ? current : response.data[0]?.id || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os cupões.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const query = new URLSearchParams({ search, status: statusFilter, page: String(page), pageSize: "20" });
          const response = await fetchWithAuth(`/api/admin/marketing/coupons?${query}`);
          if (!active) return;
          setCoupons(response.data);
          setStats(response.stats);
          setPageCount(response.meta.pageCount || 1);
          setSelectedId((current: number | null) => response.data.some((coupon: Coupon) => coupon.id === current) ? current : response.data[0]?.id || null);
        } catch (loadError) {
          if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os cupões.");
        } finally { if (active) setLoading(false); }
      })();
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, statusFilter, page]);

  async function saveCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        discountValue: Number(form.discountValue),
        minimumOrderKZ: form.minimumOrderKZ ? Number(form.minimumOrderKZ) : null,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      };
      await fetchWithAuth(editingId ? `/api/admin/marketing/coupons/${editingId}` : "/api/admin/marketing/coupons", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setShowForm(false);
      setEditingId(null);
      setForm(blankForm);
      setNotice(editingId ? "Cupão atualizado." : "Cupão criado.");
      await loadCoupons();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar o cupão.");
    } finally { setBusy(false); }
  }

  function createCoupon() {
    setEditingId(null);
    setForm(blankForm);
    setError("");
    setShowForm(true);
  }

  function editCoupon(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minimumOrderKZ: coupon.minimumOrderKZ ? String(coupon.minimumOrderKZ) : "",
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 10) : "",
      active: coupon.active,
    });
    setError("");
    setShowForm(true);
  }

  async function deactivateCoupon(coupon: Coupon) {
    if (!window.confirm(`Desativar o cupão ${coupon.code}? Os resgates existentes serão preservados.`)) return;
    setBusy(true);
    setError("");
    try {
      await fetchWithAuth(`/api/admin/marketing/coupons/${coupon.id}`, { method: "DELETE" });
      setNotice("Cupão desativado; os resgates anteriores foram preservados.");
      await loadCoupons();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível desativar o cupão.");
    } finally { setBusy(false); }
  }

  async function exportCoupons() {
    try {
      const query = new URLSearchParams({ search, status: statusFilter, page: "1", pageSize: "100" });
      const response = await fetchWithAuth(`/api/admin/marketing/coupons?${query}`);
      const rows: string[][] = [["Código", "Descrição", "Tipo", "Valor", "Mínimo AOA", "Validade", "Estado", "Resgates"], ...response.data.map((coupon: Coupon) => [coupon.code, coupon.description, coupon.discountType, String(coupon.discountValue), String(coupon.minimumOrderKZ || ""), coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString("pt-PT") : "Sem validade", couponStatus(coupon), String(coupon._count.users)])];
      const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "cupoes-marketing.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) { setError(exportError instanceof Error ? exportError.message : "Não foi possível exportar os cupões."); }
  }

  return <main>
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Marketing · Campanhas</p><h1 className="mt-1 text-2xl font-black">Cupões promocionais</h1><p className="mt-1 text-sm text-gray-500">Crie descontos, acompanhe resgates e controle validade.</p></div><div className="flex gap-2"><a href="/admin/marketing/promotions" className="inline-flex items-center gap-2 border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800"><Megaphone size={15} />Promoções</a><button type="button" onClick={exportCoupons} className="inline-flex items-center gap-2 border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><FileDown size={15} />Exportar</button><button type="button" onClick={createCoupon} className="inline-flex items-center gap-2 bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"><Plus size={15} />Novo cupão</button></div></div>
    {notice && <p role="status" className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-3">{[["Ativos", stats.active, "text-emerald-700"], ["Inativos", stats.inactive, "text-gray-600"], ["Expirados", stats.expired, "text-amber-700"]].map(([label, value, tone]) => <div key={String(label)} className="border border-gray-200 bg-white p-4"><p className="text-[10px] font-bold uppercase text-gray-500">{label}</p><p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="min-w-0 border border-gray-200 bg-white"><div className="grid gap-2 border-b border-gray-200 p-4 sm:grid-cols-[minmax(180px,1fr)_180px]"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar código ou descrição" className="w-full border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-700" /></div><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="ALL">Todos os estados</option><option value="ACTIVE">Ativos</option><option value="INACTIVE">Inativos</option><option value="EXPIRED">Expirados</option></select></div><div className="hidden grid-cols-[1fr_1.5fr_0.7fr_0.8fr_0.6fr] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[9px] font-black uppercase text-gray-500 md:grid"><span>Código</span><span>Oferta</span><span>Estado</span><span>Validade</span><span className="text-right">Resgates</span></div><div className="divide-y divide-gray-100">{loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500"><LoaderCircle size={16} className="animate-spin" />A carregar cupões...</div> : coupons.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">Nenhum cupão encontrado.</div> : coupons.map((coupon) => <button type="button" key={coupon.id} onClick={() => setSelectedId(coupon.id)} className={`grid w-full gap-2 px-4 py-3 text-left hover:bg-blue-50/40 md:grid-cols-[1fr_1.5fr_0.7fr_0.8fr_0.6fr] md:items-center ${selectedId === coupon.id ? "bg-blue-50/70" : ""}`}><strong className="text-xs font-black text-gray-900">{coupon.code}</strong><span className="min-w-0"><span className="block truncate text-xs text-gray-800">{coupon.description}</span><span className="text-[10px] font-bold text-blue-700">{discountLabel(coupon)}</span></span><span className={`w-fit px-2 py-1 text-[9px] font-bold ${couponStatus(coupon) === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : couponStatus(coupon) === "EXPIRED" ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600"}`}>{couponStatus(coupon) === "ACTIVE" ? "Ativo" : couponStatus(coupon) === "EXPIRED" ? "Expirado" : "Inativo"}</span><span className="text-[10px] text-gray-600">{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString("pt-PT") : "Sem validade"}</span><strong className="text-right text-xs text-gray-800">{coupon._count.users}</strong></button>)}</div><div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500"><span>Página {page} de {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="border border-gray-200 px-3 py-1.5 disabled:opacity-40">Anterior</button><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="border border-gray-200 px-3 py-1.5 disabled:opacity-40">Seguinte</button></div></div></section>
    <aside className="border border-gray-200 bg-white">{!selected ? <div className="p-8 text-center text-sm text-gray-500">Selecione um cupão para ver os detalhes.</div> : <div className="space-y-3 p-4 text-xs"><div className="border-b border-gray-100 pb-3"><p className="text-[9px] font-black uppercase tracking-widest text-blue-700">Detalhe do cupão</p><h2 className="mt-1 text-lg font-black">{selected.code}</h2><p className="mt-1 text-gray-600">{selected.description}</p></div><p><span className="text-gray-500">Desconto:</span> <strong>{discountLabel(selected)}</strong></p><p><span className="text-gray-500">Compra mínima:</span> <strong>{selected.minimumOrderKZ ? `Kz ${Number(selected.minimumOrderKZ).toLocaleString("pt-AO")}` : "Sem mínimo"}</strong></p><p><span className="text-gray-500">Resgates:</span> <strong>{selected._count.users}</strong></p><p><span className="text-gray-500">Criado:</span> {new Date(selected.createdAt).toLocaleDateString("pt-PT")}</p><div className="flex gap-2 border-t border-gray-100 pt-3"><button type="button" onClick={() => editCoupon(selected)} className="flex-1 border border-gray-300 px-3 py-2 font-bold text-gray-700 hover:bg-gray-50">Editar</button>{selected.active && couponStatus(selected) !== "EXPIRED" && <button type="button" disabled={busy} onClick={() => void deactivateCoupon(selected)} className="border border-red-200 px-3 py-2 font-bold text-red-700 hover:bg-red-50">Desativar</button>}</div></div>}</aside></div>
    {showForm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"><section role="dialog" aria-modal="true" aria-labelledby="coupon-title" className="max-h-[94vh] w-full max-w-xl overflow-y-auto bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><div><h2 id="coupon-title" className="text-lg font-black">{editingId ? "Editar cupão" : "Novo cupão"}</h2><p className="mt-1 text-xs text-gray-500">Cupões desativados preservam resgates anteriores.</p></div><button type="button" onClick={() => setShowForm(false)} aria-label="Fechar" className="p-2 text-gray-500 hover:bg-gray-100"><X size={18} /></button></div><form onSubmit={saveCoupon} className="space-y-4 p-5"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-gray-700">Código<input required minLength={3} maxLength={40} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5 uppercase" /></label><label className="text-xs font-bold text-gray-700">Estado<select value={String(form.active)} onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === "true" }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5"><option value="true">Ativo</option><option value="false">Inativo</option></select></label><label className="text-xs font-bold text-gray-700 sm:col-span-2">Descrição<input required minLength={5} maxLength={240} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="text-xs font-bold text-gray-700">Tipo de desconto<select value={form.discountType} onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value as CouponForm["discountType"], discountValue: event.target.value === "PERCENTAGE" ? "10" : "5000" }))} className="mt-1 w-full border border-gray-300 bg-white px-3 py-2.5"><option value="PERCENTAGE">Percentagem</option><option value="FIXED">Valor fixo</option></select></label><label className="text-xs font-bold text-gray-700">Valor do desconto<input required type="number" min="0.01" step="0.01" max={form.discountType === "PERCENTAGE" ? 100 : 1000000} value={form.discountValue} onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="text-xs font-bold text-gray-700">Compra mínima (AOA)<input type="number" min="0" step="1" value={form.minimumOrderKZ} onChange={(event) => setForm((current) => ({ ...current, minimumOrderKZ: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label><label className="text-xs font-bold text-gray-700">Validade<input type="date" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} className="mt-1 w-full border border-gray-300 px-3 py-2.5" /></label></div><div className="flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">Fechar</button><button type="submit" disabled={busy} className="bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "A guardar..." : "Guardar cupão"}</button></div></form></section></div>}
  </main>;
}
