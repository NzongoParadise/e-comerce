import { z } from "zod";
import { Buffer } from "node:buffer";

export const SUPPORT_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;
const maxChatRequestBytes = SUPPORT_ATTACHMENT_MAX_BYTES + 64 * 1024;

const supportAttachmentTypes = {
  "application/pdf": { extensions: [".pdf"], signature: (header: Uint8Array) => Buffer.from(header).toString("ascii", 0, 5) === "%PDF-" },
  "image/jpeg": { extensions: [".jpg", ".jpeg"], signature: (header: Uint8Array) => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff },
  "image/png": { extensions: [".png"], signature: (header: Uint8Array) => Buffer.from(header).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "audio/webm": { extensions: [".webm"], signature: (header: Uint8Array) => Buffer.from(header.subarray(0, 4)).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
  "audio/ogg": { extensions: [".ogg"], signature: (header: Uint8Array) => Buffer.from(header.subarray(0, 4)).toString("ascii") === "OggS" },
  "audio/mp4": { extensions: [".m4a", ".mp4"], signature: (header: Uint8Array) => Buffer.from(header.subarray(4, 8)).toString("ascii") === "ftyp" },
  "audio/mpeg": { extensions: [".mp3"], signature: (header: Uint8Array) => (
    Buffer.from(header.subarray(0, 3)).toString("ascii") === "ID3"
    || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
  ) },
} as const;

const chatFieldsSchema = z.record(z.string(), z.union([z.string(), z.number()]));

export type SupportAttachment = {
  name: string;
  type: keyof typeof supportAttachmentTypes;
  size: number;
  data: Uint8Array;
};

export async function readSupportChatRequest(request: Request): Promise<
  | { fields: Record<string, string>; attachment: SupportAttachment | null; error: null }
  | { fields: null; attachment: null; error: string }
> {
  let rawFields: unknown;
  let file: File | null = null;

  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > maxChatRequestBytes) {
      return { fields: null, attachment: null, error: "O pedido excede o tamanho permitido." };
    }
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return { fields: null, attachment: null, error: "O formulário enviado é inválido." };
    }
    const files = [...formData.entries()].filter(([, value]) => typeof value !== "string");
    if (files.some(([key]) => key !== "attachment") || files.length > 1) {
      return { fields: null, attachment: null, error: "Envie apenas um ficheiro por mensagem." };
    }
    file = files[0]?.[1] as File | undefined || null;
    rawFields = Object.fromEntries([...formData.entries()]
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, value as string]));
  } else {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > 1024 * 1024) {
      return { fields: null, attachment: null, error: "O corpo da mensagem excede o tamanho permitido." };
    }
    try {
      rawFields = await request.json();
    } catch {
      return { fields: null, attachment: null, error: "O corpo da mensagem é inválido." };
    }
  }

  const parsedFields = chatFieldsSchema.safeParse(rawFields);
  if (!parsedFields.success) return { fields: null, attachment: null, error: "Os dados da mensagem são inválidos." };
  const fields = Object.fromEntries(Object.entries(parsedFields.data).map(([key, value]) => [key, String(value)]));
  if (!file || !file.name) return { fields, attachment: null, error: null };
  if (file.size === 0) return { fields: null, attachment: null, error: "O ficheiro está vazio." };
  if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
    return { fields: null, attachment: null, error: "O ficheiro não pode exceder 3 MB." };
  }

  const mediaType = file.type.split(";", 1)[0].trim().toLowerCase() as keyof typeof supportAttachmentTypes;
  const fileType = supportAttachmentTypes[mediaType];
  if (!fileType) {
    return { fields: null, attachment: null, error: "Formato não permitido. Envie PDF, JPG, PNG ou áudio gravado pelo chat." };
  }
  const originalName = file.name.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!fileType.extensions.some((extension) => originalName.toLowerCase().endsWith(extension))) {
    return { fields: null, attachment: null, error: "A extensão do ficheiro não corresponde ao formato enviado." };
  }

  const data = new Uint8Array(await file.arrayBuffer());
  if (!fileType.signature(data.subarray(0, 8))) {
    return { fields: null, attachment: null, error: "O conteúdo do ficheiro não corresponde ao formato indicado." };
  }

  const name = originalName.slice(0, 120);
  return {
    fields,
    attachment: { name, type: mediaType, size: file.size, data },
    error: null,
  };
}

export function serializeSupportAttachment<T extends {
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
}>(message: T) {
  return {
    attachment: message.attachmentName && message.attachmentType && message.attachmentSize !== null
      ? { name: message.attachmentName, type: message.attachmentType, size: message.attachmentSize }
      : null,
  };
}
