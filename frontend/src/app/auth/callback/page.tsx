"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Monitor } from "lucide-react";
import { getDashboardDestination } from "@/lib/auth";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("A validar a sua sessão...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = query.get("access_token") || query.get("token") || hash.get("access_token") || hash.get("token");
    const error = query.get("error") || hash.get("error");

    if (error || !token) {
      window.setTimeout(() => {
        setMessage(error || "Não foi possível concluir a autenticação.");
        setFailed(true);
      }, 0);
      return;
    }

    localStorage.setItem("jwt_token", token);
    async function redirectByProfile() {
      const profileResponse = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = await profileResponse.json();
      const destination = getDashboardDestination(profileResponse.ok ? {
        roles: profile.data?.roles,
        accessRole: profile.data?.accessRole,
        email: profile.data?.email,
        isAdmin: profile.data?.isAdmin,
        accountType: profile.data?.accountType,
      } : null);
      window.history.replaceState({}, document.title, "/auth/callback");
      setMessage("Sessão iniciada. A abrir a sua conta...");
      window.setTimeout(() => window.location.replace(destination), 250);
    }
    redirectByProfile().catch(() => window.location.replace("/account"));
  }, []);

  return (
    <main className="flex min-h-[calc(100vh-170px)] items-center justify-center px-4 py-12">
      <section className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f0fc] text-[#1d6ac4]">
          {failed ? <Monitor size={24} aria-hidden="true" /> : message.includes("Sessão") ? <CheckCircle2 size={24} aria-hidden="true" /> : <LoaderCircle size={24} className="animate-spin" aria-hidden="true" />}
        </div>
        <h1 className="text-xl font-bold text-gray-900">Autenticação</h1>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        {failed && <Link href="/login" className="btn-primary mt-6">Voltar ao login</Link>}
      </section>
    </main>
  );
}
