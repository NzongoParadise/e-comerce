"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Clock3, FileText, Search, ShieldAlert } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";
type LogStatus = "OK" | "WARN" | "CRITICAL";

type LogEntry = {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  details?: string;
  actor?: string;
  status: LogStatus;
};

type LogSummary = {
  info: number;
  warn: number;
  error: number;
  debug: number;
};

const levelStyles: Record<LogLevel, string> = {
  INFO: "bg-blue-50 text-blue-700 ring-blue-200",
  WARN: "bg-amber-50 text-amber-700 ring-amber-200",
  ERROR: "bg-red-50 text-red-700 ring-red-200",
  DEBUG: "bg-slate-100 text-slate-700 ring-slate-200",
};

const statusStyles: Record<LogStatus, string> = {
  OK: "bg-emerald-50 text-emerald-700",
  WARN: "bg-amber-50 text-amber-700",
  CRITICAL: "bg-red-50 text-red-700",
};

export default function AdminLogsPage() {
  const [level, setLevel] = useState<LogLevel | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [items, setItems] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<LogSummary>({ info: 0, warn: 0, error: 0, debug: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (level !== "ALL") params.set("level", level);
    if (source) params.set("source", source);
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetchWithAuth(`/api/admin/logs?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        const payload = response.data;
        setItems(payload.items || []);
        setSummary(payload.summary || { info: 0, warn: 0, error: 0, debug: 0 });
        setTotal(payload.total || 0);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os logs do sistema.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [level, source, search, page]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-gray-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1d6ac4]">Observabilidade</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950">Gestão de logs</h1>
            <p className="mt-1 text-xs text-gray-500">Eventos do sistema, autenticação, stock, pagamentos e operações críticas.</p>
          </div>
          <Link href="/admin" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
            <ArrowRight size={13} className="rotate-180" /> Voltar ao painel
          </Link>
        </div>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Informações" value={summary.info.toString()} tone="bg-blue-50 text-blue-700" icon={FileText} />
          <MetricCard label="Avisos" value={summary.warn.toString()} tone="bg-amber-50 text-amber-700" icon={AlertTriangle} />
          <MetricCard label="Erros" value={summary.error.toString()} tone="bg-red-50 text-red-700" icon={ShieldAlert} />
          <MetricCard label="Debug" value={summary.debug.toString()} tone="bg-slate-100 text-slate-700" icon={Clock3} />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder="Pesquisar evento, origem, utilizador..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs text-gray-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </label>
            <select
              value={level}
              onChange={(event) => {
                setPage(1);
                setLevel(event.target.value as LogLevel | "ALL");
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
            >
              <option value="ALL">Todos os níveis</option>
              <option value="INFO">Info</option>
              <option value="WARN">Aviso</option>
              <option value="ERROR">Erro</option>
              <option value="DEBUG">Debug</option>
            </select>
            <input
              value={source}
              onChange={(event) => {
                setPage(1);
                setSource(event.target.value);
              }}
              placeholder="Origem"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-gray-500">A carregar logs...</div>
          ) : items.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-gray-500">Nenhum evento encontrado com os filtros atuais.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-3">Data</th>
                    <th className="px-3 py-3">Nível</th>
                    <th className="px-3 py-3">Origem</th>
                    <th className="px-3 py-3">Mensagem</th>
                    <th className="px-3 py-3">Utilizador</th>
                    <th className="px-3 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-gray-50/80">
                      <td className="px-3 py-3 text-[11px] text-gray-600">{new Date(item.timestamp).toLocaleString("pt-PT")}</td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${levelStyles[item.level]}`}>{item.level}</span></td>
                      <td className="px-3 py-3 text-[11px] font-semibold text-gray-700">{item.source}</td>
                      <td className="px-3 py-3">
                        <p className="text-xs font-bold text-gray-900">{item.message}</p>
                        {item.details && <p className="mt-1 text-[11px] leading-5 text-gray-500">{item.details}</p>}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-gray-600">{item.actor || "—"}</td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${statusStyles[item.status]}`}>{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && total > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500">Página {page} de {pageCount} · {total} eventos</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 disabled:opacity-40"
                >
                  Seguinte
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon: typeof FileText;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-gray-950">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
    </div>
  );
}
