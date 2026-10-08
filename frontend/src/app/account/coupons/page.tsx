"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Copy, Loader2, Tag, Ticket, X } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Coupon = {
  id: number;
  code: string;
  description: string;
  discountType: string;
  discountValue: string;
  minimumOrderKZ?: string;
  expiresAt?: string;
  usedAt?: string;
};

type CouponState = "ALL" | "AVAILABLE" | "USED" | "EXPIRED";

function isExpired(coupon: Coupon) {
  return Boolean(coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now());
}

function discountLabel(coupon: Coupon) {
  return coupon.discountType === "PERCENTAGE"
    ? String(coupon.discountValue) + "%"
    : "Kz " + Number(coupon.discountValue).toLocaleString("pt-AO");
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [filter, setFilter] = useState<CouponState>("ALL");
  const [copied, setCopied] = useState<number | null>(null);

  async function load() {
    setError("");
    try {
      const response = await fetchWithAuth("/api/account/coupons");
      setCoupons(response.data || []);
    } catch {
      setError("Não foi possível carregar os seus cupões.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function claim(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setClaiming(true);
    setMessage("");
    setError("");
    try {
      await fetchWithAuth("/api/account/coupons/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      setCode("");
      setMessage("Cupão adicionado à sua conta.");
      await load();
    } catch {
      setError("Cupão inválido, expirado ou já associado à sua conta.");
    } finally {
      setClaiming(false);
    }
  }

  async function copy(codeValue: string, id: number) {
    try {
      await navigator.clipboard.writeText(codeValue);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Não foi possível copiar o código.");
    }
  }

  const counts = useMemo(() => {
    const available = coupons.filter((coupon) => !coupon.usedAt && !isExpired(coupon)).length;
    const used = coupons.filter((coupon) => Boolean(coupon.usedAt)).length;
    const expired = coupons.filter((coupon) => !coupon.usedAt && isExpired(coupon)).length;
    return { ALL: coupons.length, AVAILABLE: available, USED: used, EXPIRED: expired };
  }, [coupons]);

  const visible = useMemo(() => coupons.filter((coupon) => {
    if (filter === "AVAILABLE") return !coupon.usedAt && !isExpired(coupon);
    if (filter === "USED") return Boolean(coupon.usedAt);
    if (filter === "EXPIRED") return !coupon.usedAt && isExpired(coupon);
    return true;
  }), [coupons, filter]);

  const tabs: Array<[CouponState, string]> = [
    ["ALL", "Todos"],
    ["AVAILABLE", "Disponíveis"],
    ["USED", "Utilizados"],
    ["EXPIRED", "Expirados"],
  ];

  return (
    <div className="space-y-6 pb-8">
      <header>
        <p className="section-kicker">Conta · Benefícios</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Os meus cupões</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Conserve códigos promocionais na conta e aplique os benefícios elegíveis durante o checkout.</p>
      </header>

      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">{message}</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800"><X size={14} className="mt-0.5 shrink-0"/>{error}</div>}

      <section className="rounded-2xl bg-[#132238] p-5 text-white shadow-[0_18px_45px_rgba(19,34,56,.14)] sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#f6b73c]"><Ticket size={21}/></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f6b73c]">Adicionar benefício</p>
            <h2 className="mt-1 text-base font-black sm:text-lg">Tem um código promocional?</h2>
            <form onSubmit={claim} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="INTRODUZA O CÓDIGO" aria-label="Código do cupão" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white px-3 text-xs font-black tracking-[0.12em] text-slate-900 outline-none placeholder:font-semibold placeholder:tracking-normal placeholder:text-slate-400 focus:ring-4 focus:ring-white/20"/>
              <button type="submit" disabled={claiming} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#f6b73c] px-5 text-xs font-black text-[#132238] hover:bg-[#ffd166] disabled:opacity-60">{claiming && <Loader2 size={14} className="animate-spin"/>}{claiming ? "A validar..." : "Adicionar cupão"}</button>
            </form>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-1">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={filter === id ? "shrink-0 border-b-2 border-[#1d6ac4] px-3 py-2.5 text-[10px] font-black text-[#1d6ac4]" : "shrink-0 border-b-2 border-transparent px-3 py-2.5 text-[10px] font-bold text-slate-500 hover:text-slate-900"}>
              {label} <span className="ml-1 opacity-60">{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((coupon) => {
            const expired = isExpired(coupon);
            const used = Boolean(coupon.usedAt);
            const inactive = used || expired;
            return (
              <article key={coupon.id} className={"relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition " + (inactive ? "border-slate-200 opacity-75" : "border-blue-100 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md")}>
                <span className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full border-[12px] border-slate-100"/>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + (inactive ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-[#1d6ac4]")}><Tag size={18}/></span>
                    <div>
                      <p className="text-xl font-black tracking-tight text-slate-950">{discountLabel(coupon)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{coupon.description || "Benefício promocional"}</p>
                    </div>
                  </div>
                  <span className={"rounded-full px-2.5 py-1 text-[9px] font-black " + (used ? "bg-slate-100 text-slate-500" : expired ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>{used ? "Utilizado" : expired ? "Expirado" : "Disponível"}</span>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
                  <span className="text-[11px] font-black tracking-[0.16em] text-[#1d6ac4]">{coupon.code}</span>
                  <button type="button" disabled={inactive} onClick={() => void copy(coupon.code, coupon.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[9px] font-black text-slate-600 shadow-sm hover:text-[#1d6ac4] disabled:cursor-not-allowed disabled:opacity-40"><Copy size={13}/>{copied === coupon.id ? "Copiado" : "Copiar"}</button>
                </div>

                <div className="mt-4 space-y-2 text-[10px] text-slate-500">
                  {coupon.minimumOrderKZ && <p>Compra mínima: <strong className="text-slate-700">Kz {Number(coupon.minimumOrderKZ).toLocaleString("pt-AO")}</strong></p>}
                  {coupon.expiresAt && <p>Validade: <strong className="text-slate-700">{new Date(coupon.expiresAt).toLocaleDateString("pt-PT")}</strong></p>}
                  {coupon.usedAt && <p>Utilizado em: <strong className="text-slate-700">{new Date(coupon.usedAt).toLocaleDateString("pt-PT")}</strong></p>}
                </div>

                {!inactive && <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] font-bold text-slate-500"><span>Elegível conforme as condições da campanha.</span><ChevronRight size={14} className="text-slate-300"/></div>}
              </article>
            );
          })}
        </div>

        {!visible.length && (
          <div className="mt-4 card border-dashed p-12 text-center">
            <Tag size={30} className="mx-auto text-slate-300"/>
            <h3 className="mt-3 text-sm font-black text-slate-800">Nenhum cupão nesta categoria</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{filter === "AVAILABLE" ? "Quando tiver benefícios disponíveis, eles aparecerão aqui." : "Experimente outra categoria ou adicione um novo código promocional."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
