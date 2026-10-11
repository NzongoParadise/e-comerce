"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Trash2 } from "lucide-react";

const maxDurationSeconds = 5 * 60;
const audioFormats = [
  { mimeType: "audio/webm;codecs=opus", type: "audio/webm", extension: "webm" },
  { mimeType: "audio/ogg;codecs=opus", type: "audio/ogg", extension: "ogg" },
  { mimeType: "audio/mp4", type: "audio/mp4", extension: "m4a" },
] as const;

type Props = {
  recording: File | null;
  onRecordingChange: (recording: File | null) => void;
  disabled?: boolean;
};

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function VoiceMessageRecorder({ recording, onRecordingChange, disabled = false }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function startRecording() {
    setError("");
    onRecordingChange(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador não suporta gravação de voz.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Não foi possível aceder ao microfone. Verifique as permissões do navegador.");
      return;
    }

    const preferredFormat = audioFormats.find((format) => MediaRecorder.isTypeSupported(format.mimeType))
      || audioFormats.find((format) => MediaRecorder.isTypeSupported(format.type));
    if (!preferredFormat && !MediaRecorder.isTypeSupported("")) {
      stream.getTracks().forEach((track) => track.stop());
      setError("O navegador não disponibiliza um formato de gravação compatível.");
      return;
    }

    try {
      const recorder = new MediaRecorder(stream, preferredFormat ? { mimeType: preferredFormat.mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setDuration(0);
      setIsRecording(true);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => setError("Ocorreu um erro ao gravar a mensagem de voz.");
      recorder.onstop = () => {
        const mimeType = (recorder.mimeType || preferredFormat?.type || "").split(";", 1)[0].toLowerCase();
        const format = audioFormats.find((item) => item.type === mimeType);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (!format) {
          setError("O formato de áudio gravado não é suportado para envio.");
        } else if (blob.size === 0) {
          setError("A gravação está vazia. Tente novamente.");
        } else if (blob.size > 3 * 1024 * 1024) {
          setError("A gravação excede o limite de 3 MB. Grave uma mensagem mais curta.");
        } else {
          onRecordingChange(new File([blob], `mensagem-de-voz-${Date.now()}.${format.extension}`, { type: format.type }));
        }
        setIsRecording(false);
        releaseMicrophone();
      };
      recorder.start(250);
      intervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= maxDurationSeconds) stopRecording();
      }, 1000);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsRecording(false);
      setError("Não foi possível iniciar a gravação de voz.");
    }
  }

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    releaseMicrophone();
  }, []);

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => isRecording ? stopRecording() : void startRecording()}
        disabled={disabled}
        aria-label={isRecording ? "Parar gravação" : "Gravar mensagem de voz"}
        title={isRecording ? "Parar gravação" : "Gravar mensagem de voz"}
        className={`flex h-10 w-10 items-center justify-center rounded-lg disabled:opacity-40 ${isRecording ? "animate-pulse bg-red-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
      >
        {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      {isRecording && <span className="text-[9px] font-bold tabular-nums text-red-600">{formatDuration(duration)}</span>}
      {!isRecording && recording && (
        <button type="button" onClick={() => onRecordingChange(null)} disabled={disabled} className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500 hover:text-red-600">
          <Trash2 size={11} />{formatDuration(duration)}
        </button>
      )}
      {error && <span role="alert" className="max-w-36 text-center text-[9px] leading-3 text-red-600">{error}</span>}
    </div>
  );
}
