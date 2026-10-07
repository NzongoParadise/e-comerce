import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messageSchema = z.object({
  content: z.string().trim().min(1, "A mensagem não pode estar vazia.").max(4000),
  subject: z.string().trim().max(160).optional(),
});

async function getUser(request: Request) {
  const auth = await authenticate(request);
  const subject = userSubject(auth);
  if (!subject) return null;
  return prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, name: true, email: true, accessRole: true, accountType: true },
  });
}

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return errorResponse("Não autenticado.", 401);
  const conversation = await prisma.supportConversation.findFirst({
    where: { customerId: user.id, status: { not: "CLOSED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 200, include: { sender: { select: { id: true, name: true, accessRole: true } } } },
    },
  });
  return Response.json({ data: conversation ? {
    id: conversation.id, status: conversation.status, subject: conversation.subject, agent: conversation.agent,
    messages: conversation.messages.map((m) => ({ id: m.id, content: m.content, senderId: m.senderId, senderRole: m.senderRole, senderName: m.sender.name || (m.senderRole === "AGENT" ? "Suporte" : "Cliente"), createdAt: m.createdAt })),
  } : null });
}

export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return errorResponse("Não autenticado.", 401);
  const parsed = messageSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Mensagem inválida.", 400);

  let conversation = await prisma.supportConversation.findFirst({ where: { customerId: user.id, status: { not: "CLOSED" } }, orderBy: { updatedAt: "desc" } });
  if (!conversation) conversation = await prisma.supportConversation.create({ data: { customerId: user.id, subject: parsed.data.subject || "Pedido de suporte" } });

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.supportMessage.create({ data: { conversationId: conversation!.id, senderId: user.id, senderRole: "CUSTOMER", content: parsed.data.content }, include: { sender: { select: { id: true, name: true } } } });
    await tx.supportConversation.update({ where: { id: conversation!.id }, data: { lastMessageAt: created.createdAt, status: "OPEN" } });
    if (conversation!.agentId) await tx.notification.create({ data: { userId: conversation!.agentId, type: "SUPPORT_CHAT", title: "Nova mensagem de suporte", message: "Novo pedido de suporte de " + (user.name || user.email || "cliente") + ".", link: "/admin/support", dedupeKey: "support-chat-" + conversation!.id + "-" + created.id } });
    return created;
  });
  return Response.json({ data: { id: message.id, content: message.content, senderId: message.senderId, senderRole: message.senderRole, senderName: message.sender.name || "Cliente", createdAt: message.createdAt } }, { status: 201 });
}