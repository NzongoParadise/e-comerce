"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type Workspace = "b2b" | "b2c";

const typeLabels: Record<string, string> = {
  ORDER_CREATED: "Encomenda",
  ORDER_PAYMENT_CONFIRMED: "Pagamento",
  ORDER_PAYMENT_FAILED: "Pagamento",
  ORDER_CANCELLED: "Encomenda",
  REFUND_PROCESSED: "Reembolso",
  QUOTE_APPROVED: "Cotação",
  QUOTE_REJECTED: "Cotação",
  PAYMENT_REVIEW_REQUIRED: "Verificação",
  B2B_INVITATION_ACCEPTED: "Equipa",
  INVOICE_ISSUED: "Fatura",
  CREDIT_NOTE_ISSUED: "Nota de crédito",
  RETURN_REQUEST_RECEIVED: "Pós-venda",
  RETURN_STATUS_CHANGED: "Pós-venda",
  PRODUCT_REVIEW_MODERATED: "Avaliação",
};

function iconFor(type: string) {
  if (type.toLowerCase().includes("payment") || type.toLowerCase().includes("refund")) return CreditCard;
  if (type.toLowerCase().includes("quote") || type.toLowerCase().includes("invoice") || type.toLowerCase().includes("credit")) return FileText;
  if (type.toLowerCase().includes("security") || type.toLowerCase().includes("review")) return ShieldAlert;
  if (type.toLowerCase().includes("order")) return Package;
  return Bell;
}

function safeInternalPath(link: string | null, workspace: Workspace) {
  if (link && link.startsWith("/") && !link.startsWith("//") && !link.includes("\\\\")) return link;
  return workspace === "b2b" ? "/b2b/encomendas" : "/account/orders";
}

export default function NotificationsCenter({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setNeedsLogin(false);
    try {
      if (!localStorage.getItem("jwt_token")) {
        setNeedsLogin(true);
        setItems([]);
        return;
      }
      const response = await fetchWithAuth("/api/notifications", { cache: "no-store" });
      setItems((response.data || []) as NotificationItem[]);
    } catch (loadError) {
      if (!localStorage.getItem("jwt_token")) setNeedsLogin(true);
      else setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);
  const visibleItems = useMemo(
    () => filter === "UNREAD" ? items.filter((item) => !item.readAt) : items,
    [items, filter],
  );

  async function markRead(id: number) {
    setBusyId(id);
    setError("");
    try {
      await fetchWithAuth("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Não foi possível marcar a notificação.");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    setError("");
    try {
      await fetchWithAuth("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => item.readAt ? item : { ...item, readAt: now }));
      setNotice("Todas as notificações foram marcadas como lidas.");
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Não foi possível atualizar as notificações.");
    } finally {
      setMarkingAll(false);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      void fetchWithAuth("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      }).catch(() => undefined);
    }
    router.push(safeInternalPath(item.link, workspace));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">{workspace === "b2b" ? "B2B · Comunicação" : "Conta · Comunicação"}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Notificações</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Acompanhe atualizações da sua conta, encomendas, pagamentos e operações empresariais.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar</button>
          {!needsLogin && <button type="button" onClick={() => void markAllRead()} disabled={markingAll || unreadCount === 0 || loading} className="btn-primary disabled:opacity-50">{markingAll ? <Loader2 size={14} className="animate-spin"/> : <CheckCheck size={14}/>} Marcar todas como lidas</button>}
        </div>
      </header>

      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div>}

      {needsLogin ? (
        <section className="card p-10 text-center sm:p-14">
          <ShieldAlert size={34} className="mx-auto text-slate-300"/>
          <h2 className="mt-3 text-sm font-black text-slate-900">Inicie sessão para ver as notificações</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">As notificações são privadas e só podem ser consultadas pelo titular da conta.</p>
          <a href={"/login?next=" + encodeURIComponent(workspace === "b2b" ? "/b2b/notificacoes" : "/notifications")} className="btn-primary mt-5">Iniciar sessão</a>
        </section>
      ) : (
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-2"><Bell size={17} className="text-blue-700"/><p className="text-sm font-black text-slate-950">Caixa de entrada</p><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black text-blue-700">{unreadCount} por ler</span></div>
            <div className="flex gap-1">
              <button type="button" onClick={() => setFilter("ALL")} className={filter === "ALL" ? "rounded-full bg-[#132238] px-3 py-2 text-[10px] font-black text-white" : "rounded-full border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-50"}>Todas ({items.length})</button>
              <button type="button" onClick={() => setFilter("UNREAD")} className={filter === "UNREAD" ? "rounded-full bg-[#132238] px-3 py-2 text-[10px] font-black text-white" : "rounded-full border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-50"}>Não lidas ({unreadCount})</button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-4 sm:p-5">{[1,2,3,4].map((index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-50"/>)}</div>
          ) : visibleItems.length ? (
            <div className="divide-y divide-slate-100">
              {visibleItems.map((item) => {
                const Icon = iconFor(item.type);
                return (
                  <article key={item.id} className={"flex gap-3 p-4 transition sm:gap-4 sm:p-5 " + (item.readAt ? "bg-white" : "bg-blue-50/40")}>
                    <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + (item.readAt ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-blue-700")}><Icon size={18}/></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className={"text-xs text-slate-950 " + (item.readAt ? "font-bold" : "font-black")}>{item.title}</h2>
                        {!item.readAt && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-label="Não lida"/>}
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-500">{typeLabels[item.type] || "Atualização"}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{item.message}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1 text-[9px] text-slate-400"><Clock3 size={11}/>{new Date(item.createdAt).toLocaleString("pt-PT")}</span>
                        <div className="flex gap-2">
                          {!item.readAt && <button type="button" onClick={() => void markRead(item.id)} disabled={busyId === item.id} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[9px] font-black text-slate-500 hover:bg-slate-100 disabled:opacity-50">{busyId === item.id ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>} Marcar como lida</button>}
                          <button type="button" onClick={() => void openNotification(item)} className="rounded-lg bg-white px-3 py-1.5 text-[9px] font-black text-blue-700 ring-1 ring-slate-200 hover:ring-blue-200">Abrir</button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center"><Bell size={32} className="mx-auto text-slate-300"/><h2 className="mt-3 text-sm font-black text-slate-800">{filter === "UNREAD" ? "Não existem notificações por ler" : "Ainda não tem notificações"}</h2><p className="mt-1 text-xs text-slate-500">As atualizações relevantes aparecerão aqui.</p></div>
          )}
        </section>
      )}
    </div>
  );
}
