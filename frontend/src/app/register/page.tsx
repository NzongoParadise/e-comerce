"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Globe2, LockKeyhole, Mail, Monitor, UserRound } from "lucide-react";

const providerUrls = {
  google: process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL,
  apple: process.env.NEXT_PUBLIC_APPLE_AUTH_URL,
};

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"B2C" | "B2B">("B2C");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, accountType }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível criar a conta.");

      localStorage.setItem("jwt_token", data.token);
      router.push(accountType === "B2B" ? "/account/profile" : "/account");
    } catch (error) {
      setMessage(
        error instanceof TypeError
          ? "Não foi possível contactar o servidor. Confirme que o backend está a correr."
          : error instanceof Error
            ? error.message
            : "Não foi possível criar a conta.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleProviderRegister(provider: keyof typeof providerUrls) {
    const url = providerUrls[provider];
    if (!url) {
      setMessage(`O registo com ${provider === "google" ? "Google" : "Apple"} ainda não está configurado.`);
      return;
    }
    window.location.assign(url);
  }

  return (
    <main className="min-h-[calc(100vh-170px)] bg-[radial-gradient(circle_at_top,_rgba(29,106,196,0.08),transparent_32%),#f3f5f7] lg:grid lg:grid-cols-[minmax(420px,0.95fr)_1.05fr]">
      <section className="relative hidden min-h-[760px] overflow-hidden bg-[#0c1b2a] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <Image src="/banner_principal2.png" alt="" fill priority className="object-cover opacity-25" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(7,21,37,0.96),rgba(12,27,42,0.8),rgba(21,80,153,0.8))]" />

        <div className="relative z-10 animate-fade-in-up">
          <Link href="/" className="inline-flex items-center gap-3 text-white">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f6b73c] text-[#0c1b2a] shadow-lg shadow-[#f6b73c]/30">
              <Monitor size={23} strokeWidth={2.5} />
            </span>
            <span>
              <strong className="block text-xl font-black tracking-tight">RUBRICA DILIGENTE (SU), LDA</strong>
              <small className="block text-[9px] font-bold uppercase tracking-[0.2em] text-blue-200">Tecnologia sem fronteiras</small>
            </span>
          </Link>

          <div className="mt-28 max-w-md">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#f6b73c]">Uma conta para tudo</p>
            <h1 className="text-5xl font-black leading-[1.02] tracking-tight text-white xl:text-6xl">Comece a sua próxima descoberta.</h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-blue-100">Crie uma conta e tenha uma experiência mais rápida, organizada e personalizada.</p>
          </div>
        </div>

        <div className="relative z-10 animate-fade-in-up border-t border-white/15 pt-6 text-sm text-blue-100">
          <p className="mb-3 font-bold text-white">Com a sua conta pode:</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2"><Check size={16} className="text-[#f6b73c]" />Acompanhar encomendas em tempo real</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-[#f6b73c]" />Guardar favoritos e comparar produtos</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-[#f6b73c]" />Comprar mais rápido nas próximas visitas</li>
          </ul>
        </div>
      </section>

      <section className="flex min-h-[760px] items-center justify-center px-5 py-10 sm:px-10 lg:px-16 xl:px-24">
        <div className="w-full max-w-md animate-fade-in-up rounded-[32px] border border-gray-200 bg-white/90 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-8">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2 text-[#1d6ac4]">
              <Monitor size={22} />
              <strong>RUBRICA DILIGENTE (SU), LDA</strong>
            </Link>
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500"><ArrowLeft size={14} /> Loja</Link>
          </div>

          <div className="mb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#1d6ac4]">Nova conta</p>
            <h2 className="text-3xl font-black tracking-tight text-[#0c1b2a] sm:text-4xl">Junte-se à RUBRICA DILIGENTE (SU), LDA.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">Crie a sua conta em menos de um minuto.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => handleProviderRegister("google")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#1d6ac4] hover:bg-[#f5f9ff] hover:text-[#1d6ac4]">
              <Globe2 size={17} />Google
            </button>
            <button type="button" onClick={() => handleProviderRegister("apple")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#1d6ac4] hover:bg-[#f5f9ff] hover:text-[#1d6ac4]">
              <span className="text-lg leading-none" aria-hidden="true">&#63743;</span>Apple
            </button>
          </div>

          <div className="my-7 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <span className="h-px flex-1 bg-gray-200" />
            ou email
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-bold text-gray-700">Nome completo</label>
              <div className="relative">
                <UserRound size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="O seu nome completo"
                  autoComplete="name"
                  required
                  className="w-full rounded-2xl border border-gray-200 bg-slate-50 py-3.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-[#1d6ac4] focus:bg-white focus:ring-4 focus:ring-[#1d6ac4]/10"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">Tipo de conta</label>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-slate-50 p-1">
                {([
                  { value: "B2C", label: "Retalhista", description: "Compras pessoais" },
                  { value: "B2B", label: "Grossista", description: "Para empresas" },
                ] as const).map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setAccountType(option.value)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      accountType === option.value
                        ? "border-[#1d6ac4] bg-white shadow-sm ring-1 ring-[#1d6ac4]/15"
                        : "border-transparent bg-transparent text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <span className="block text-xs font-black text-gray-800">{option.label}</span>
                    <span className="mt-1 block text-[10px] text-gray-500">{option.description}</span>
                  </button>
                ))}
              </div>
              {accountType === "B2B" && <p className="mt-2 text-xs text-gray-500">A conta empresarial requer documentação da empresa e pessoal.</p>}
            </div>

            <div>
              <label htmlFor="register-email" className="mb-2 block text-sm font-bold text-gray-700">Email</label>
              <div className="relative">
                <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nome@exemplo.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-2xl border border-gray-200 bg-slate-50 py-3.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-[#1d6ac4] focus:bg-white focus:ring-4 focus:ring-[#1d6ac4]/10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-password" className="mb-2 block text-sm font-bold text-gray-700">Palavra-passe</label>
              <div className="relative">
                <LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-2xl border border-gray-200 bg-slate-50 py-3.5 pl-10 pr-11 text-sm text-gray-900 outline-none transition focus:border-[#1d6ac4] focus:bg-white focus:ring-4 focus:ring-[#1d6ac4]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-[#1d6ac4]"
                  aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {message && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d6ac4] py-3.5 text-sm font-black text-white shadow-lg shadow-[#1d6ac4]/20 transition hover:-translate-y-0.5 hover:bg-[#155099] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "A criar conta..." : "Criar a minha conta"}
              <ArrowRight size={17} />
            </button>

            <p className="text-center text-sm text-gray-500">
              Já tem conta? {" "}
              <Link href="/login" className="font-semibold text-[#1d6ac4] hover:text-[#155099]">
                Iniciar sessão
              </Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
