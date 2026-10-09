"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, Headphones, RefreshCw } from "lucide-react";

type AppErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function AppError({ error, retry }: AppErrorProps) {
  useEffect(() => {
    console.error("Unexpected storefront error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#f7f8f8] px-4 py-12 text-gray-900">
      <section
        aria-labelledby="app-error-title"
        className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10"
      >
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
          RUBRICA DILIGENTE
        </p>
        <h1 id="app-error-title" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          Estamos a investigar um problema.
        </h1>
        <p className="mt-4 text-sm leading-6 text-gray-600 sm:text-base">
          A nossa equipa de engenharia está a analisar um erro nesta página. Os seus dados e
          encomendas permanecem seguros. Tente novamente dentro de instantes ou contacte o
          suporte se precisar de ajuda.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-gray-400">
            Referência do erro: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#f6b73c] px-5 py-3 text-sm font-bold text-[#132238] transition hover:bg-[#ffd166]"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Tentar novamente
          </button>
          <Link
            href="/info/support"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            <Headphones size={16} aria-hidden="true" />
            Contactar suporte
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  );
}
