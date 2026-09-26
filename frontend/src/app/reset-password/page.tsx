"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Monitor } from "lucide-react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ResetPasswordPage() {
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") || "" : "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) { setMessage("As palavras-passe não coincidem."); return; }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível redefinir a palavra-passe.");
      setSuccess(true);
      setMessage(data.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível contactar o servidor.");
    } finally { setLoading(false); }
  }

  return <main className="flex min-h-[calc(100vh-170px)] items-center justify-center bg-[#f5f6fa] px-4 py-12"><section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-10"><Link href="/login" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-[#1d6ac4]"><ArrowLeft size={15} />Voltar ao login</Link><div className="mb-8 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1d6ac4] text-white"><Monitor size={23} /></div><div><div className="font-black text-gray-900">TechGlobal</div><div className="text-[9px] font-bold uppercase tracking-widest text-[#1d6ac4]">Nova palavra-passe</div></div></div>{success ? <div className="text-center"><CheckCircle2 size={42} className="mx-auto mb-4 text-green-600" /><h1 className="text-2xl font-black text-gray-900">Palavra-passe atualizada</h1><p className="mt-2 text-sm text-gray-500">Já pode entrar na sua conta com a nova palavra-passe.</p><Link href="/login" className="btn-primary mt-6 w-full py-3">Ir para o login</Link></div> : <><div className="mb-7"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f0fc] text-[#1d6ac4]"><LockKeyhole size={21} /></div><h1 className="text-2xl font-black text-gray-900">Criar nova palavra-passe</h1><p className="mt-2 text-sm leading-6 text-gray-500">Escolha uma palavra-passe com pelo menos 8 caracteres.</p></div><form onSubmit={handleSubmit} className="space-y-4"><label htmlFor="new-password" className="block text-sm font-semibold text-gray-700">Nova palavra-passe</label><div className="relative"><input id="new-password" type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-3 pr-11 text-sm outline-none focus:border-[#1d6ac4]" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700">Confirmar palavra-passe</label><input id="confirm-password" type="password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none focus:border-[#1d6ac4]" /><button type="submit" disabled={loading || !token} className="btn-primary w-full py-3 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "A atualizar..." : "Atualizar palavra-passe"}</button></form>{message && <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}</>}</section></main>;
}
