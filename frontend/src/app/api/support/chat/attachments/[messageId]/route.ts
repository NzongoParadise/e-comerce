import { createHash } from "node:crypto";
import { authenticate, errorResponse, isAdmin, userSubject } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const guestCookie = "support_guest_session";

function guestSessionHash(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${guestCookie}=`));
  const token = cookie?.slice(guestCookie.length + 1) || "";
  return /^[a-f0-9]{64}$/i.test(token) ? createHash("sha256").update(token).digest("hex") : null;
}

export async function GET(request: Request, context: { params: Promise<{ messageId: string }> }) {
  const messageId = Number((await context.params).messageId);
  if (!Number.isSafeInteger(messageId) || messageId < 1) return errorResponse("Anexo inválido.", 400);

  const auth = await authenticate(request);
  const subject = userSubject(auth);
  const user = subject
    ? await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true } })
    : null;
  const sessionHash = !request.headers.has("authorization") ? guestSessionHash(request) : null;
  if (!user && !sessionHash) return errorResponse("Não autenticado.", 401);

  const message = await prisma.supportMessage.findUnique({
    where: { id: messageId },
    select: {
      attachmentName: true,
      attachmentType: true,
      attachmentData: true,
      conversation: { select: { customerId: true, guestSessionHash: true } },
    },
  });
  if (!message?.attachmentName || !message.attachmentType || !message.attachmentData
    || !["application/pdf", "image/jpeg", "image/png", "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"].includes(message.attachmentType)) {
    return errorResponse("Ficheiro não encontrado.", 404);
  }

  const authorized = isAdmin(auth)
    || Boolean(user && message.conversation.customerId === user.id)
    || Boolean(sessionHash && message.conversation.guestSessionHash === sessionHash);
  if (!authorized) return errorResponse("Sem permissão para aceder a este ficheiro.", 403);

  const fallbackName = message.attachmentName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encodedName = encodeURIComponent(message.attachmentName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return new Response(Buffer.from(message.attachmentData), {
    headers: {
      "Content-Type": message.attachmentType,
      "Content-Disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
