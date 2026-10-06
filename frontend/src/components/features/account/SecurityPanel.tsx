"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Laptop,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Session = {
  id: number;
  deviceName: string;
  browser: string;
  operatingSystem: string;
  ipAddress?: string | null;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
};

type Event = {
  id: number;
  type: string;
  status: string;
  ipAddress?: string | null;
  createdAt: string;
};

const labels: Record<string, string> = {
  LOGIN_SUCCESS: "Login bem-sucedido",
  LOGIN_SUCCESS_2FA: "Login com 2FA",
  REGISTER: "Conta criada",
  TWO_FACTOR_ENABLED: "Autenticação de dois factores ativada",
  TWO_FACTOR_DISABLED: "Autenticação de dois factores desativada",
  SESSION_REVOKED: "Sessão terminada",
  ALL_SESSIONS_REVOKED: "Todas as sessões terminadas",
  TWO_FACTOR_FAILED: "Falha na autenticação de dois factores",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SecurityPanel() {
  const [enabled, setEnabled] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/auth/security");
      setEnabled(response.data.twoFactorEnabled);
      setSessions(response.data.sessions);
      setEvents(response.data.events);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar a segurança.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function securityAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetchWithAuth("/api/auth/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      return response.data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operação não concluída.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function begin2fa() {
    const data = await securityAction("begin-2fa");
    if (data) {
      setSecret(data.secret);
      setOtpauth(data.otpauth);
      setCode("");
    }
  }

  async function verify2fa() {
    const data = await securityAction("verify-2fa", { code });
    if (data) {
      setEnabled(true);
      setRecovery(data.recoveryCodes || []);
      setSecret("");
      setOtpauth("");
      setCode("");
      await load();
    }
  }

  async function disable2fa() {
    const value = window.prompt("Introduza o código de 6 dígitos do autenticador para desativar a autenticação de dois factores.");
    if (!value) return;

    const data = await securityAction("disable-2fa", { code: value });
    if (data) {
      setEnabled(false);
      await load();
    }
  }

  async function revoke(id: number) {
    const data = await securityAction("revoke-session", { sessionId: id });
    if (data) await load();
  }

  async function revokeAll() {
    if (!window.confirm("Isto vai terminar todas as sessões ativas desta conta. Deseja continuar?")) return;
    const data = await securityAction("revoke-all");
    if (data) await load();
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage("As palavras-passe não coincidem.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await fetchWithAuth("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Palavra-passe alterada com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar a palavra-passe.");
    } finally {
      setBusy(false);
    }
  }

  const score = enabled ? 100 : 65;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 via-white to-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#1d6ac4]">
              <ShieldCheck size={23} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">Centro de segurança</p>
              <h2 className="mt-1 text-xl font-black text-gray-900">Proteja a sua conta</h2>
              <p className="mt-1 max-w-xl text-sm leading-5 text-gray-500">
                Gere a palavra-passe, autenticação de dois factores e dispositivos com acesso à sua conta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white bg-white/80 px-4 py-3 shadow-sm sm:min-w-[150px]">
            <div className="relative h-11 w-11 shrink-0">
              <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={94}
                  strokeDashoffset={94 - (94 * score) / 100}
                  className={enabled ? "text-green-500" : "text-amber-500"}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-gray-900">{score}</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Segurança</p>
              <p className={"text-xs font-black " + (enabled ? "text-green-700" : "text-amber-700")}>
                {enabled ? "Proteção forte" : "Pode melhorar"}
              </p>
            </div>
          </div>
        </div>

        {!enabled && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-black text-amber-900">Recomendação</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-800">
                Ative a autenticação de dois factores para adicionar uma camada extra de proteção aos seus logins.
              </p>
            </div>
          </div>
        )}
      </header>

      {message && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {recovery.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <KeyRound size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-gray-900">Guarde os seus códigos de recuperação</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    Estes códigos permitem recuperar o acesso se perder o autenticador. Cada código só pode ser usado uma vez.
                  </p>
                </div>
                <button type="button" onClick={() => setRecovery([])} aria-label="Fechar códigos de recuperação">
                  <XCircle size={18} className="text-gray-400" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {recovery.map((item) => (
                  <code key={item} className="rounded-lg border border-amber-100 bg-white px-2 py-2.5 text-center text-xs font-black tracking-wide text-gray-800">
                    {item}
                  </code>
                ))}
              </div>

              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(recovery.join("\n"))}
                className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#1d6ac4] hover:underline"
              >
                <Copy size={14} /> Copiar códigos
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + (enabled ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500")}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-gray-900">Autenticação em dois factores</h3>
                <span className={"rounded-full px-2 py-0.5 text-[10px] font-black " + (enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                  {enabled ? "Ativa" : "Desativada"}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">
                {enabled
                  ? "Os novos logins exigem um código temporário do seu aplicativo autenticador."
                  : "Proteja a conta mesmo que alguém descubra a sua palavra-passe."}
              </p>
            </div>
          </div>

          {enabled ? (
            <button type="button" disabled={busy} onClick={disable2fa} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50">
              Desativar
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={begin2fa} className="rounded-lg bg-[#1d6ac4] px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              Ativar 2FA
            </button>
          )}
        </div>

        {secret && (
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-black text-gray-900">Configurar o autenticador</p>
              <p className="mt-1 text-xs leading-5 text-gray-600">
                Adicione a chave abaixo no Google Authenticator, Microsoft Authenticator ou outra aplicação compatível com TOTP.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-500">Chave secreta</label>
                <code className="block break-all rounded-lg border border-blue-100 bg-white px-3 py-3 text-xs font-black text-gray-800">{secret}</code>
                <p className="mt-2 text-[10px] leading-4 text-gray-500">
                  Se a aplicação suportar URI TOTP, também pode utilizar esta configuração diretamente.
                </p>
              </div>

              <div className="lg:w-[250px]">
                <label htmlFor="security-totp-code" className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-500">Código de verificação</label>
                <div className="flex gap-2">
                  <input
                    id="security-totp-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="settings-input min-w-0 text-center font-black tracking-[0.35em]"
                    aria-label="Código de autenticação de dois factores"
                  />
                  <button type="button" disabled={busy || code.length !== 6} onClick={verify2fa} className="rounded-lg bg-[#1d6ac4] px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                    Confirmar
                  </button>
                </div>
              </div>
            </div>

            <details className="mt-4 rounded-lg border border-blue-100 bg-white px-3 py-2">
              <summary className="cursor-pointer text-xs font-bold text-gray-600">Ver URI TOTP</summary>
              <code className="mt-2 block break-all text-[10px] leading-4 text-gray-500">{otpauth}</code>
            </details>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1d6ac4]">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h3 className="font-black text-gray-900">Palavra-passe</h3>
            <p className="mt-1 text-sm text-gray-500">Atualize-a regularmente e não reutilize a mesma palavra-passe noutros serviços.</p>
          </div>
        </div>

        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-3">
          <PasswordField label="Palavra-passe atual" value={currentPassword} onChange={setCurrentPassword} />
          <PasswordField label="Nova palavra-passe" value={newPassword} onChange={setNewPassword} minLength={12} />
          <PasswordField label="Confirmar nova palavra-passe" value={confirmPassword} onChange={setConfirmPassword} minLength={12} />
          <div className="sm:col-span-3">
            <p className="mb-3 text-[11px] text-gray-500">Recomendado: pelo menos 12 caracteres, com combinação de letras, números e símbolos.</p>
            <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
              <KeyRound size={15} /> {busy ? "A guardar..." : "Alterar palavra-passe"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1d6ac4]">
              <Laptop size={20} />
            </div>
            <div>
              <h3 className="font-black text-gray-900">Dispositivos e sessões</h3>
              <p className="mt-1 text-sm text-gray-500">Veja onde a sua conta está ativa e termine acessos que não reconhece.</p>
            </div>
          </div>

          {sessions.length > 0 && (
            <button type="button" disabled={busy} onClick={revokeAll} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50">
              <LogOut size={14} /> Terminar todas
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3" aria-label="A carregar sessões">
            <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <Laptop className="mx-auto text-gray-300" size={28} />
            <p className="mt-2 text-sm font-bold text-gray-700">Nenhuma sessão ativa encontrada</p>
            <p className="mt-1 text-xs text-gray-500">Os novos acessos aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session, index) => {
              const mobile = /android|iphone|ipad/i.test(session.deviceName + session.operatingSystem);

              return (
                <div key={session.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#1d6ac4] shadow-sm">
                      {mobile ? <Smartphone size={19} /> : <Laptop size={19} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-gray-900">{session.browser} · {session.operatingSystem}</p>
                        {index === 0 && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-black text-green-700">Mais recente</span>}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {session.ipAddress || "IP indisponível"} · Última atividade {formatDate(session.lastActivityAt)}
                      </p>
                    </div>
                  </div>

                  <button type="button" disabled={busy} onClick={() => revoke(session.id)} className="self-start text-xs font-black text-red-600 hover:underline sm:self-auto">
                    Terminar sessão
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
            <RefreshCw size={19} />
          </div>
          <div>
            <h3 className="font-black text-gray-900">Atividade de segurança</h3>
            <p className="mt-1 text-sm text-gray-500">Consulte as últimas ações relacionadas com a proteção da sua conta.</p>
          </div>
        </div>

        {events.length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-4 py-5 text-center text-xs text-gray-500">Ainda não existem eventos de segurança.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{labels[event.type] || event.type}</p>
                  <p className="mt-1 text-xs text-gray-500">{event.ipAddress || "IP indisponível"} · {formatDate(event.createdAt)}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[9px] font-black text-green-700">
                  <Check size={11} /> {event.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  minLength = 8,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-gray-700">{label}</span>
      <input
        type="password"
        required
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="settings-input"
        autoComplete={label === "Palavra-passe atual" ? "current-password" : "new-password"}
      />
    </label>
  );
}
