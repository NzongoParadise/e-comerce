"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Paperclip, Play } from "lucide-react";
import { fetchWithAuthResponse } from "@/lib/api";

type Props = {
  messageId: number;
  name: string;
  type: string;
  inverse?: boolean;
};

export function SupportAttachmentLink({ messageId, name, type, inverse = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  async function loadAudio() {
    if (loading || audioUrl) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuthResponse(`/api/support/chat/attachments/${messageId}`);
      setAudioUrl(URL.createObjectURL(await response.blob()));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a mensagem de voz.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadAttachment() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuthResponse(`/api/support/chat/attachments/${messageId}`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Não foi possível transferir o ficheiro.");
    } finally {
      setLoading(false);
    }
  }

  if (type.startsWith("audio/")) {
    return (
      <div className="mt-2">
        {audioUrl ? <audio controls preload="metadata" src={audioUrl} aria-label="Mensagem de voz" className="max-w-full" />
          : <button type="button" onClick={() => void loadAudio()} disabled={loading} className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold disabled:opacity-60 ${inverse ? "border-white/20 bg-white/10 text-white hover:bg-white/20" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            <span>Reproduzir mensagem de voz</span>
          </button>}
        {error && <p role="alert" className="mt-1 text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => void downloadAttachment()}
        disabled={loading}
        className={`inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold disabled:opacity-60 ${
          inverse ? "border-white/20 bg-white/10 text-white hover:bg-white/20" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Paperclip size={14} className="shrink-0" />
        <span className="max-w-[15rem] truncate">{name}</span>
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} className="shrink-0" />}
      </button>
      {error && <p role="alert" className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
