"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, Monitor } from "lucide-react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setResetToken("");
    try {
      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível pedir a recuperação.");
      setMessage(data.data.message);
      if (data.data.resetToken) setResetToken(data.data.resetToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível contactar o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-[calc(100vh-170px)] items-center justify-center bg-[#f5f6fa] px-4 py-12"><section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-10"><Link href="/login" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-[#1d6ac4]"><ArrowLeft size={15} />Voltar ao login</Link><div className="mb-8 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1d6ac4] text-white"><Monitor size={23} /></div><div><div className="font-black text-gray-900">TechGlobal</div><div className="text-[9px] font-bold uppercase tracking-widest text-[#1d6ac4]">Recuperar acesso</div></div></div><div className="mb-7"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f0fc] text-[#1d6ac4]"><LockKeyhole size={21} /></div><h1 className="text-2xl font-black text-gray-900">Esqueceu-se da palavra-passe?</h1><p className="mt-2 text-sm leading-6 text-gray-500">Introduza o email da sua conta e enviaremos as instruções para recuperar o acesso.</p></div><form onSubmit={handleSubmit} className="space-y-4"><label htmlFor="forgot-email" className="block text-sm font-semibold text-gray-700">Email</label><div className="relative"><Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input id="forgot-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@exemplo.com" autoComplete="email" className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-[#1d6ac4] focus:ring-2 focus:ring-[#1d6ac4]/15" /></div><button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "A verificar..." : "Enviar instruções"}<ArrowRight size={16} /></button></form>{message && <p role="status" className="mt-5 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>}{resetToken && <Link href={`/reset-password?token=${resetToken}`} className="mt-4 block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Abrir link de redefinição de desenvolvimento</Link>}</section></main>;
}
