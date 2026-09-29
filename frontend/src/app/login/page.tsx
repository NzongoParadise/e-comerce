"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Globe2, LockKeyhole, Mail, Monitor, ShieldCheck, Truck } from "lucide-react";

const providerUrls = { google: process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL, apple: process.env.NEXT_PUBLIC_APPLE_AUTH_URL };

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar sessão.");
      localStorage.setItem("jwt_token", data.token);
      const profileResponse = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${data.token}` } });
      if (!profileResponse.ok) { localStorage.removeItem("jwt_token"); throw new Error("Não foi possível carregar o perfil. Tente novamente."); }
      const profile = await profileResponse.json();
      const isAdmin = Array.isArray(profile.data?.roles) && profile.data.roles.some((role: string) => role.toLowerCase() === "admin");
      router.push(isAdmin ? "/admin" : "/account");
    } catch (error) { setMessage(error instanceof TypeError ? "Não foi possível contactar o servidor. Verifique se o backend está ativo." : error instanceof Error ? error.message : "Não foi possível iniciar sessão."); }
    finally { setLoading(false); }
  }

  function handleProviderLogin(provider: keyof typeof providerUrls) {
    const url = providerUrls[provider];
    if (!url) { setMessage(`O login com ${provider === "google" ? "Google" : "Apple"} ainda não está configurado.`); return; }
    window.location.assign(url);
  }

  return <main className="min-h-[calc(100vh-170px)] bg-[#f3f5f7] lg:grid lg:grid-cols-[minmax(420px,0.95fr)_1.05fr]">
    <section className="relative hidden min-h-[680px] overflow-hidden bg-[#0c1b2a] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"><Image src="/banner_principal0.jpg" alt="" fill priority className="object-cover opacity-25" /><div className="absolute inset-0 bg-linear-to-br from-[#071525]/95 via-[#0c1b2a]/85 to-[#155099]/80" /><div className="relative z-10"><Link href="/" className="inline-flex items-center gap-3 text-white"><span className="flex h-11 w-11 items-center justify-center bg-[#f6b73c] text-[#0c1b2a]"><Monitor size={23} strokeWidth={2.5} /></span><span><strong className="block text-xl font-black tracking-tight">TechGlobal</strong><small className="block text-[9px] font-bold uppercase tracking-[0.2em] text-blue-200">Tecnologia sem fronteiras</small></span></Link><div className="mt-28 max-w-md"><p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#f6b73c]">A sua conta, o seu catálogo</p><h1 className="text-5xl font-black leading-[1.02] text-white xl:text-6xl">Compre melhor. Continue mais longe.</h1><p className="mt-6 max-w-sm text-base leading-7 text-blue-100">Acompanhe encomendas, guarde favoritos e tenha uma experiência de compra feita para si.</p></div></div><div className="relative z-10 grid max-w-lg gap-4 border-t border-white/15 pt-6 sm:grid-cols-2"><div className="flex gap-3 text-sm text-blue-100"><ShieldCheck className="shrink-0 text-[#f6b73c]" size={20} /><span><strong className="block text-white">Compra protegida</strong>Os seus dados são tratados com segurança.</span></div><div className="flex gap-3 text-sm text-blue-100"><Truck className="shrink-0 text-[#f6b73c]" size={20} /><span><strong className="block text-white">Entrega acompanhada</strong>Consulte o estado das suas encomendas.</span></div></div></section>
    <section className="flex min-h-[680px] items-center justify-center px-5 py-10 sm:px-10 lg:px-16 xl:px-24"><div className="w-full max-w-md"><div className="mb-10 flex items-center justify-between lg:hidden"><Link href="/" className="flex items-center gap-2 text-[#1d6ac4]"><Monitor size={22} /><strong>TechGlobal</strong></Link><Link href="/" className="text-xs font-semibold text-gray-500">Voltar à loja</Link></div><div className="mb-8"><p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#1d6ac4]">Área reservada</p><h2 className="text-3xl font-black tracking-tight text-[#0c1b2a] sm:text-4xl">Bem-vindo de volta.</h2><p className="mt-3 text-sm leading-6 text-gray-500">Entre na sua conta para continuar a sua compra.</p></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => handleProviderLogin("google")} className="inline-flex items-center justify-center gap-2 border border-gray-300 bg-white px-3 py-3 text-sm font-bold text-gray-700 hover:border-gray-500 hover:bg-gray-50"><Globe2 size={17} />Google</button><button type="button" onClick={() => handleProviderLogin("apple")} className="inline-flex items-center justify-center gap-2 border border-gray-300 bg-white px-3 py-3 text-sm font-bold text-gray-700 hover:border-gray-500 hover:bg-gray-50"><span className="text-lg leading-none" aria-hidden="true">&#63743;</span>Apple</button></div><div className="my-7 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400"><span className="h-px flex-1 bg-gray-200" />ou email<span className="h-px flex-1 bg-gray-200" /></div><form onSubmit={handleSubmit} className="space-y-5"><div><label htmlFor="email" className="mb-2 block text-sm font-bold text-gray-700">Email</label><div className="relative"><Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@exemplo.com" autoComplete="email" required className="w-full border border-gray-300 bg-white py-3.5 pl-10 pr-3 text-sm outline-none focus:border-[#1d6ac4] focus:ring-2 focus:ring-[#1d6ac4]/15" /></div></div><div><div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-bold text-gray-700">Palavra-passe</label><Link href="/forgot-password" className="text-xs font-bold text-[#1d6ac4] hover:underline">Esqueceu-se?</Link></div><div className="relative"><LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Introduza a sua palavra-passe" autoComplete="current-password" required className="w-full border border-gray-300 bg-white py-3.5 pl-10 pr-11 text-sm outline-none focus:border-[#1d6ac4] focus:ring-2 focus:ring-[#1d6ac4]/15" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700" aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>{message && <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{message}</p>}<button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 bg-[#f6b73c] py-3.5 text-sm font-black text-[#0c1b2a] hover:bg-[#ffd166] disabled:cursor-not-allowed disabled:opacity-60">{loading ? "A entrar..." : "Entrar na minha conta"}<ArrowRight size={17} /></button></form><div className="mt-8 border-t border-gray-200 pt-6 text-center"><p className="text-sm text-gray-500">Ainda não tem conta? <Link href="/register" className="font-black text-[#1d6ac4] hover:underline">Criar conta</Link></p><p className="mt-3 text-xs text-gray-400">Precisa de ajuda? <Link href="/account/support" className="font-semibold text-[#1d6ac4] hover:underline">Contactar suporte</Link></p></div></div></section>
  </main>;
}
