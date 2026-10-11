import { createHash, randomBytes } from "node:crypto";
import { authenticate, errorResponse, rateLimit, userSubject } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { z } from "zod";
import { createStaffNotification, notificationMessagePreview } from "@/lib/server/notifications";
import { readSupportChatRequest, serializeSupportAttachment } from "@/lib/server/supportAttachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const guestCookie = "support_guest_session";
const guestSessionMaxAge = 60 * 60 * 24 * 30;
const unavailableMessage = "O chat está temporariamente indisponível. Tente novamente mais tarde ou escreva para suporte@techglobal.co.ao.";

function unavailableResponse(error: unknown) {
  const code = typeof error === "object" && error !== null && "errorCode" in error
    ? String((error as { errorCode?: unknown }).errorCode)
    : typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "UNKNOWN";
  const reason = error instanceof Error ? error.message.split("\n")[0] : "Unknown error";
  console.error("[support-chat] database request failed", { code, name: error instanceof Error ? error.name : "UnknownError", reason });
  return errorResponse(unavailableMessage, 503);
}
const messageSchema = z.object({
  content: z.string().trim().max(4000).optional(),
  subject: z.string().trim().max(160).optional(),
  orderId: z.coerce.number().int().positive().optional(),
  guestName: z.string().trim().min(2).max(100).optional(),
  guestEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
});

type SupportUser = { id: number; name: string | null; email: string | null };
type ChatMessageRecord = {
  id: number;
  content: string;
  senderId: number | null;
  senderRole: string;
  createdAt: Date;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  sender: { id: number; name: string | null } | null;
};

async function getAuthenticatedUser(request: Request): Promise<{ user: SupportUser | null; invalid: boolean }> {
  if (!request.headers.has("authorization")) return { user: null, invalid: false };
  const auth = await authenticate(request);
  const subject = userSubject(auth);
  if (!subject) return { user: null, invalid: true };
  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true, name: true, email: true } });
  return user ? { user, invalid: false } : { user: null, invalid: true };
}

function readGuestToken(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${guestCookie}=`));
  const token = cookie?.slice(guestCookie.length + 1) || "";
  return /^[a-f0-9]{64}$/i.test(token) ? token : null;
}

function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function setGuestCookie(response: Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${guestCookie}=${token}; HttpOnly; SameSite=Lax; Path=/api/support/chat; Max-Age=${guestSessionMaxAge}${secure}`);
  return response;
}

function serializeConversation(conversation: {
  id: number; status: string; subject: string | null; agent: { id: number; name: string | null } | null;
  messages: ChatMessageRecord[];
}) {
  return {
    id: conversation.id,
    status: conversation.status,
    subject: conversation.subject,
    agent: conversation.agent,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      senderRole: message.senderRole,
      senderName: message.sender?.name || (message.senderRole === "AGENT" ? "Suporte" : "Cliente"),
      createdAt: message.createdAt,
      ...serializeSupportAttachment(message),
    })),
  };
}

export async function GET(request: Request) {
  try {
    const { user, invalid } = await getAuthenticatedUser(request);
    if (invalid) return errorResponse("Não autenticado.", 401);

    const guestToken = user ? null : readGuestToken(request);
    if (!user && !guestToken) return Response.json({ data: null });
    const conversation = await prisma.supportConversation.findFirst({
      where: user
        ? { customerId: user.id, status: { not: "CLOSED" } }
        : { guestSessionHash: hashGuestToken(guestToken!) },
      orderBy: { updatedAt: "desc" },
      include: {
        agent: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
          select: {
            id: true, content: true, senderId: true, senderRole: true, createdAt: true,
            attachmentName: true, attachmentType: true, attachmentSize: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
    });
    return Response.json({ data: conversation ? serializeConversation(conversation) : null });
  } catch (error) {
    return unavailableResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const limited = rateLimit(request, "support:chat", 12, 10 * 60_000);
    if (limited) return limited;

    const { user, invalid } = await getAuthenticatedUser(request);
    if (invalid) return errorResponse("Não autenticado.", 401);
    const payload = await readSupportChatRequest(request);
    if (payload.error) return errorResponse(payload.error, 400);
    const fields = { ...payload.fields };
    if (fields.orderId === "") delete fields.orderId;
    const parsed = messageSchema.safeParse(fields);
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Mensagem inválida.", 400);
    if (!parsed.data.content && !payload.attachment) return errorResponse("Escreva uma mensagem ou anexe um ficheiro.", 400);
    if (payload.attachment) {
      const attachmentLimit = rateLimit(request, "support:chat:attachments", 8, 60 * 60_000);
      if (attachmentLimit) return attachmentLimit;
    }
    if (parsed.data.orderId && !user) return errorResponse("Inicie sessão para pedir ajuda com uma encomenda.", 401);

    const order = parsed.data.orderId
      ? await prisma.order.findFirst({
          where: { id: parsed.data.orderId, userId: user!.id },
          select: { orderNumber: true },
        })
      : null;
    if (parsed.data.orderId && !order) return errorResponse("Encomenda não encontrada.", 404);
    const content = order
      ? `[Encomenda ${order.orderNumber}]${parsed.data.content ? `\n${parsed.data.content}` : ""}`
      : parsed.data.content || "";

    let guestToken = user ? null : readGuestToken(request);
    if (!user && !guestToken && (!parsed.data.guestName || !parsed.data.guestEmail)) {
      return errorResponse("Indique o seu nome e e-mail para iniciar a conversa.", 400);
    }
    const newGuestSession = !user && !guestToken;
    if (newGuestSession) guestToken = randomBytes(32).toString("hex");
    const guestSessionHash = guestToken ? hashGuestToken(guestToken) : null;
    const previousGuestConversation = !user && guestSessionHash
      ? await prisma.supportConversation.findFirst({
          where: { guestSessionHash },
          orderBy: { updatedAt: "desc" },
          select: { guestName: true, guestEmail: true },
        })
      : null;

    let conversation = await prisma.supportConversation.findFirst({
      where: user
        ? { customerId: user.id, status: { not: "CLOSED" } }
        : { guestSessionHash: guestSessionHash!, status: { not: "CLOSED" } },
      orderBy: { updatedAt: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.supportConversation.create({
        data: {
          customerId: user?.id,
          guestName: user ? null : parsed.data.guestName || previousGuestConversation?.guestName,
          guestEmail: user ? null : parsed.data.guestEmail || previousGuestConversation?.guestEmail,
          guestSessionHash,
          subject: (order ? `Encomenda ${order.orderNumber} — apoio` : parsed.data.subject) || "Pedido de suporte",
        },
      });
    }

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.supportMessage.create({
        data: {
          conversationId: conversation!.id,
          senderId: user?.id,
          senderRole: user ? "CUSTOMER" : "GUEST",
          content,
          ...(payload.attachment ? {
            attachmentName: payload.attachment.name,
            attachmentType: payload.attachment.type,
            attachmentSize: payload.attachment.size,
            attachmentData: Buffer.from(payload.attachment.data),
          } : {}),
        },
        select: {
          id: true, content: true, senderId: true, senderRole: true, createdAt: true,
          attachmentName: true, attachmentType: true, attachmentSize: true,
        },
      });
      await tx.supportConversation.update({
        where: { id: conversation!.id },
        data: { lastMessageAt: created.createdAt, status: "OPEN" },
      });
      return created;
    });

    await createStaffNotification({
      type: "SUPPORT_CHAT",
      title: "Nova mensagem de suporte",
      message: `${user?.name || user?.email || parsed.data.guestName || "Visitante"}: "${notificationMessagePreview(message.content || (message.attachmentName ? `📎 ${message.attachmentName}` : ""))}"`,
      link: "/admin/support",
      dedupeKey: `support-chat-${conversation!.id}-${message.id}`,
      accessRoles: ["ADMIN", "SUPPORT"],
    }).catch((notificationError) => {
      console.error("Unable to notify staff about support chat message:", notificationError);
    });

    const response = Response.json({
      data: {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        senderRole: message.senderRole,
        senderName: user?.name || parsed.data.guestName || "Cliente",
        createdAt: message.createdAt,
        ...serializeSupportAttachment(message),
      },
    }, { status: 201 });
    return newGuestSession && guestToken ? setGuestCookie(response, guestToken) : response;
  } catch (error) {
    return unavailableResponse(error);
  }
}
