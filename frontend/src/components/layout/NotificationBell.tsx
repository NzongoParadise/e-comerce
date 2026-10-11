"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, Check, LoaderCircle, RefreshCw } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type Props = { variant?: "storefront" | "admin" };

export function NotificationBell({ variant = "storefront" }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const isAdmin = variant === "admin";

  const loadNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetchWithAuth("/api/notifications", { cache: "no-store" });
      setItems(response.data);
      setUnread(response.meta.unread);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadNotifications(true); }, 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadNotifications(true);
    }, 30_000);
    const onFocus = () => { void loadNotifications(true); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadNotifications]);

  async function markRead(id: number) {
    const previousItems = items;
    const previousUnread = unread;
    setItems((current) => current.map((item) => item.id === id && !item.readAt
      ? { ...item, readAt: new Date().toISOString() } : item));
    setUnread((count) => Math.max(0, count - (items.some((item) => item.id === id && !item.readAt) ? 1 : 0)));
    try {
      await fetchWithAuth("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setError("");
    } catch (markError) {
      setItems(previousItems);
      setUnread(previousUnread);
      setError(markError instanceof Error ? markError.message : "Não foi possível atualizar a notificação.");
    }
  }

  async function markAllRead() {
    setUpdating(true);
    try {
      await fetchWithAuth("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
      setUnread(0);
      setError("");
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Não foi possível marcar as notificações como lidas.");
    } finally {
      setUpdating(false);
    }
  }

  function dateLabel(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Data indisponível"
      : new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((value) => !value); if (!open) void loadNotifications(true); }}
        aria-expanded={open}
        aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}
        className={isAdmin
          ? "relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          : "relative rounded-xl p-1.5 hover:bg-white/10 sm:p-2"}
      >
        <Bell size={20} />
        {unread > 0 && <span className={`absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black ${isAdmin ? "bg-red-600 text-white" : "bg-[#f6b73c] text-[#132238]"}`}>{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <section className={`absolute right-0 top-full z-[70] mt-2 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-[0_20px_45px_rgba(15,23,42,0.18)] ${isAdmin ? "sm:right-0" : ""}`} aria-label="Centro de notificações">
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div><h2 className="text-sm font-bold">Notificações</h2><p className="text-[10px] text-gray-500">{unread} não lidas</p></div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void loadNotifications()} aria-label="Atualizar notificações" className="text-gray-500 hover:text-blue-700"><RefreshCw size={14} /></button>
            {unread > 0 && <button type="button" disabled={updating} onClick={() => void markAllRead()} className="text-[10px] font-bold text-blue-700 hover:underline disabled:opacity-50">Marcar todas como lidas</button>}
          </div>
        </header>
        {error && <div role="alert" className="flex items-center justify-between gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-[10px] text-red-700"><span>{error}</span><button type="button" onClick={() => void loadNotifications()} className="shrink-0 font-bold underline">Tentar novamente</button></div>}
        <div className="max-h-[min(24rem,65vh)] overflow-y-auto">
          {loading ? <p className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-gray-500"><LoaderCircle size={15} className="animate-spin" />A carregar...</p>
            : items.length === 0 ? <div className="px-4 py-8 text-center"><Bell size={22} className="mx-auto text-gray-300" /><p className="mt-2 text-xs font-semibold text-gray-600">Não tem notificações.</p></div>
              : items.map((item) => {
                const safeLink = item.link?.startsWith("/")
                  && !item.link.startsWith("//")
                  && !item.link.includes("\\")
                  ? item.link : null;
                return <article key={item.id} className={`border-b border-gray-50 px-4 py-3 last:border-0 ${item.readAt ? "bg-white" : "bg-blue-50/60"}`}>
                  <div className="flex items-start gap-3"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.readAt ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700"}`}><Bell size={15} /></span><div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-gray-900">{item.title}</h3><p className="mt-0.5 text-[11px] leading-4 text-gray-600">{item.message}</p>
                    <div className="mt-2 flex items-center justify-between gap-2"><time dateTime={item.createdAt} className="text-[9px] text-gray-400">{dateLabel(item.createdAt)}</time><div className="flex items-center gap-2">
                      {!item.readAt && <button type="button" onClick={() => void markRead(item.id)} className="text-[9px] font-bold text-blue-700 hover:underline">Marcar como lida</button>}
                      {safeLink && <Link href={safeLink} onClick={() => { if (!item.readAt) void markRead(item.id); setOpen(false); }} className="text-[9px] font-bold text-blue-700 hover:underline">Ver</Link>}
                      {item.readAt && <Check size={13} aria-label="Lida" className="text-emerald-600" />}
                    </div></div>
                  </div></div>
                </article>;
              })}
        </div>
      </section>}
    </div>
  );
}
