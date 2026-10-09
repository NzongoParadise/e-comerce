"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Cookie, Settings, X } from "lucide-react";

const consentCookieName = "cookie_consent_v1";
const consentCookieMaxAge = 60 * 60 * 24 * 365;
const consentChangeEvent = "cookie-consent-change";
const openPreferencesEvent = "open-cookie-preferences";

type CookieConsentValue = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  savedAt: string;
};

function getConsentCookie() {
  if (typeof document === "undefined") return null;
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${consentCookieName}=`))
    ?.slice(consentCookieName.length + 1) ?? null;
}

function subscribeToConsent(onChange: () => void) {
  window.addEventListener(consentChangeEvent, onChange);
  return () => window.removeEventListener(consentChangeEvent, onChange);
}

function parseConsent(value: string | null): CookieConsentValue | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (
      typeof parsed === "object"
      && parsed !== null
      && "necessary" in parsed
      && parsed.necessary === true
      && "analytics" in parsed
      && typeof parsed.analytics === "boolean"
      && "marketing" in parsed
      && typeof parsed.marketing === "boolean"
      && "savedAt" in parsed
      && typeof parsed.savedAt === "string"
    ) {
      return parsed as CookieConsentValue;
    }
  } catch {
    return null;
  }
  return null;
}

function storeConsent(analytics: boolean, marketing: boolean) {
  const value = encodeURIComponent(JSON.stringify({
    necessary: true,
    analytics,
    marketing,
    savedAt: new Date().toISOString(),
  } satisfies CookieConsentValue));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${consentCookieName}=${value}; Path=/; Max-Age=${consentCookieMaxAge}; SameSite=Lax${secure}`;
  if (getConsentCookie() !== value) {
    throw new Error("Não foi possível guardar a preferência de cookies neste navegador.");
  }
  window.dispatchEvent(new Event(consentChangeEvent));
}

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(openPreferencesEvent))}
      className="text-xs text-gray-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
    >
      Definições de cookies
    </button>
  );
}

export default function CookieConsent() {
  const rawConsent = useSyncExternalStore(subscribeToConsent, getConsentCookie, () => null);
  const consent = parseConsent(rawConsent);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState("");

  const openPreferences = useCallback(() => {
    const saved = parseConsent(getConsentCookie());
    setAnalytics(saved?.analytics ?? false);
    setMarketing(saved?.marketing ?? false);
    setError("");
    setCustomizing(true);
  }, []);

  useEffect(() => {
    window.addEventListener(openPreferencesEvent, openPreferences);
    return () => window.removeEventListener(openPreferencesEvent, openPreferences);
  }, [openPreferences]);

  function save(allowAnalytics: boolean, allowMarketing: boolean) {
    try {
      storeConsent(allowAnalytics, allowMarketing);
      setCustomizing(false);
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar a sua escolha.");
    }
  }

  if (consent && !customizing) return null;

  return (
    <section
      aria-label="Preferências de cookies"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white text-slate-900 shadow-[0_-12px_40px_rgba(15,23,42,0.16)]"
    >
      <div className="mx-auto max-h-[85vh] max-w-7xl overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:flex">
            <Cookie size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold">A sua privacidade é importante</h2>
              {customizing && (
                <button
                  type="button"
                  onClick={() => setCustomizing(false)}
                  aria-label="Fechar definições de cookies"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              Usamos cookies necessários para funcionalidades pedidas por si. Não temos ferramentas de análise ou publicidade opcionais ativas neste momento. Pode guardar a sua escolha ou alterá-la mais tarde nas definições de cookies.
              {" "}
              <Link href="/info/cookies" className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
                Saiba mais na Política de cookies
              </Link>
              .
            </p>

            {customizing && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">Necessários</span>
                    <input aria-label="Cookies necessários, sempre ativos" type="checkbox" checked disabled className="h-4 w-4 accent-blue-700" />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Essenciais para segurança, sessão e funcionalidades solicitadas.</p>
                </div>
                <label className="cursor-pointer rounded-xl border border-slate-200 p-3">
                  <span className="flex items-center justify-between gap-2 text-sm font-bold">
                    Análise e desempenho
                    <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="h-4 w-4 accent-blue-700" />
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">Atualmente não usamos ferramentas desta categoria.</span>
                </label>
                <label className="cursor-pointer rounded-xl border border-slate-200 p-3">
                  <span className="flex items-center justify-between gap-2 text-sm font-bold">
                    Publicidade e personalização
                    <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="h-4 w-4 accent-blue-700" />
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">Atualmente não usamos ferramentas desta categoria.</span>
                </label>
              </div>
            )}

            {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {!customizing && (
                <button
                  type="button"
                  onClick={openPreferences}
                  className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Settings size={16} /> Personalizar
                </button>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                {customizing ? (
                  <button type="button" onClick={() => save(analytics, marketing)} className="min-h-10 rounded-lg border border-blue-700 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                    Guardar escolhas
                  </button>
                ) : (
                  <button type="button" onClick={() => save(false, false)} className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                    Rejeitar opcionais
                  </button>
                )}
                <button type="button" onClick={() => save(true, true)} className="min-h-10 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                  Aceitar todos
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
