"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Paperclip, Send, ShieldCheck } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { SupportAttachmentLink } from "@/components/support/SupportAttachmentLink";
import { VoiceMessageRecorder } from "@/components/support/VoiceMessageRecorder";

type ChatMessage = { id: number; content: string; senderRole: string; senderName: string; createdAt: string; attachment?: { name: string; type: string; size: number } | null };
type Conversation = { id: number; status: string; subject: string | null; agent: { name?: string | null } | null; messages: ChatMessage[] };

export default function SupportChatPanel() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [voiceRecording, setVoiceRecording] = useState<File | null>(null);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);

  const loadConversation = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/support/chat", { cache: "no-store" });
      setConversation(response.data ?? null);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a conversa.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadConversation(), 0);
    const timer = window.setInterval(() => void loadConversation(), 4000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadConversation]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation?.messages?.length]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if ((!content && !attachment && !voiceRecording) || sending) return;
    setSending(true);
    setError("");
    try {
      const body = new FormData();
      body.append("content", content);
      if (attachment || voiceRecording) body.append("attachment", attachment || voiceRecording!);
      await fetchWithAuth("/api/support/chat", { method: "POST", body });
      setDraft("");
      setAttachment(null);
      setVoiceRecording(null);
      if (attachmentInput.current) attachmentInput.current.value = "";
      await loadConversation();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><MessageCircle size={21} /></span>
          <div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-700">Atendimento</p><h1 className="text-lg font-black text-slate-950">Conversa com o suporte</h1></div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />Resposta automática a cada 4 segundos</div>
      </header>

      <div className="flex min-h-[440px] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          {loading ? <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> A carregar a conversa...</div> : conversation ? <>
            <div className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-slate-600"><strong className="text-slate-900">{conversation.agent?.name ? `Atendido por ${conversation.agent.name}` : "Equipa de suporte"}</strong><span className="ml-2 rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase text-blue-700">{conversation.status}</span><br />As mensagens ficam guardadas na sua conta.</div>
            {conversation.messages.map((message) => {
              const mine = message.senderRole === "CUSTOMER";
              return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${mine ? "rounded-br-md bg-blue-700 text-white" : "rounded-bl-md bg-slate-100 text-slate-800"}`}><p className="mb-1 text-[10px] font-bold opacity-70">{mine ? "Eu" : message.senderName || "Suporte"}</p>{message.content && <p className="whitespace-pre-wrap leading-6">{message.content}</p>}{message.attachment && <SupportAttachmentLink messageId={message.id} name={message.attachment.name} type={message.attachment.type} inverse={mine} />}<p className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>{new Date(message.createdAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}</p></div></div>;
            })}
            <div ref={endRef} />
          </> : <div className="flex min-h-[320px] flex-col items-center justify-center text-center"><MessageCircle size={36} className="text-slate-300" /><h2 className="mt-3 text-sm font-black text-slate-900">Como podemos ajudar?</h2><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Envie uma mensagem para iniciar uma conversa privada com a equipa de suporte.</p></div>}
          {error && <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"><p>{error}</p><a href="mailto:suporte@techglobal.co.ao" className="mt-1 inline-flex font-bold underline underline-offset-2">Enviar e-mail ao suporte</a></div>}
        </div>
        <form onSubmit={sendMessage} className="border-t border-slate-100 p-4">
          {attachment && <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900"><span className="truncate">{attachment.name} · {(attachment.size / (1024 * 1024)).toFixed(1)} MB</span><button type="button" onClick={() => { setAttachment(null); if (attachmentInput.current) attachmentInput.current.value = ""; }} className="shrink-0 font-bold underline">Remover</button></div>}
          {voiceRecording && <p className="mb-2 truncate rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">Mensagem de voz pronta para enviar: {voiceRecording.name}</p>}
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 p-2 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50">
            <input ref={attachmentInput} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" aria-label="Anexar ficheiro" onChange={(event) => {
              const file = event.target.files?.[0] || null;
              if (file && (file.size > 3 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type))) {
                setError(file.size > 3 * 1024 * 1024 ? "O ficheiro não pode exceder 3 MB." : "Formato não permitido. Envie PDF, JPG ou PNG.");
                event.target.value = "";
                return;
              }
              setError("");
              setAttachment(file);
              if (file) setVoiceRecording(null);
            }} />
            <button type="button" onClick={() => attachmentInput.current?.click()} disabled={sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40" aria-label="Anexar ficheiro"><Paperclip size={18} /></button>
            <VoiceMessageRecorder recording={voiceRecording} disabled={sending || Boolean(attachment)} onRecordingChange={(file) => { setVoiceRecording(file); if (file) { setAttachment(null); if (attachmentInput.current) attachmentInput.current.value = ""; } }} />
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} maxLength={4000} placeholder="Escreva a sua mensagem..." className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none" aria-label="Mensagem para o suporte" />
            <button type="submit" disabled={(!draft.trim() && !attachment && !voiceRecording) || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Enviar mensagem">{sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}</button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400"><ShieldCheck size={12} />PDF, JPG ou PNG até 3 MB; voz até 5 minutos e 3 MB. Não partilhe palavras-passe, códigos de autenticação nem dados completos de cartão.</p>
        </form>
      </div>
    </section>
  );
}
