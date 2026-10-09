"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

export default function CompanyInvitationPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setToken(query.get("token") || "");
    setAuthenticated(Boolean(localStorage.getItem("jwt_token")));
    setReady(true);
  }, []);

  async function acceptInvitation() {
    if (!token || accepting) return;
    setAccepting(true);
    setError("");
    setSuccess("");
    try {
      const result = await fetchWithAuth("/api/b2b/company/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!result.data?.accepted) throw new Error(result.error || "Não foi possível aceitar o convite.");
      setSuccess("Convite aceite. A sua área empresarial está pronta.");
      window.setTimeout(() => router.push("/b2b"), 700);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Não foi possível aceitar o convite.");
      if (!localStorage.getItem("jwt_token")) setAuthenticated(false);
    } finally {
      setAccepting(false);
    }
  }

  const next = "/convite-empresa?token=" + encodeURIComponent(token);
  const loginHref = "/login?next=" + encodeURIComponent(next);
  const registerHref = "/register?next=" + encodeURIComponent(next);

  if (!ready) {
    return <main className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4"><Loader2 className="animate-spin text-blue-700"/></main>;
  }

  return (
    <main className="flex min-h-[calc(100vh-170px)] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(29,106,196,0.08),transparent_36%),#f5f6fa] px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Building2 size={25}/></div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">RUBRICA DILIGENTE · B2B</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Convite para a equipa empresarial</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Aceite o convite usando a conta associada ao e-mail que o recebeu. Por segurança, o convite é pessoal e tem validade limitada.</p>

        {!token && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">O link não contém um token de convite. Abra o link completo recebido por e-mail ou peça um novo convite ao proprietário da empresa.</div>}
        {error && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}
        {success && <div role="status" className="mt-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/>{success}</div>}

        {token && !success && (authenticated ? (
          <div className="mt-7 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-blue-700"/>
              <p className="text-xs leading-5 text-slate-600">O sistema irá confirmar que o e-mail da sua conta corresponde ao destinatário e que o convite continua válido antes de ativar o acesso.</p>
            </div>
            <button type="button" onClick={() => void acceptInvitation()} disabled={accepting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#132238] px-4 py-3 text-sm font-black text-white transition hover:bg-[#1d6ac4] disabled:cursor-not-allowed disabled:opacity-50">
              {accepting ? <Loader2 size={16} className="animate-spin"/> : <MailCheck size={16}/>}
              {accepting ? "A validar convite..." : "Aceitar convite"}
            </button>
          </div>
        ) : (
          <div className="mt-7 space-y-3">
            <Link href={loginHref} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#132238] px-4 py-3 text-sm font-black text-white hover:bg-[#1d6ac4]">Iniciar sessão</Link>
            <Link href={registerHref} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:border-blue-200 hover:text-blue-700">Criar conta com este e-mail</Link>
          </div>
        ))}

        <p className="mt-6 border-t border-slate-100 pt-4 text-[10px] leading-5 text-slate-400">Nunca partilhe este link. Se o convite foi encaminhado para si por engano, não o aceite.</p>
      </section>
    </main>
  );
}
