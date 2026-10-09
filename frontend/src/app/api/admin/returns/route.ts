import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from "@/lib/server/api";
import { createNotificationIfAllowed } from "@/lib/server/notifications";
import { z } from "zod";

export const runtime = "nodejs";

const statuses = [
  "RECEIVED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "WAITING_FOR_RETURN",
  "ITEM_RECEIVED",
  "REFUND_PROCESSING",
  "EXCHANGE_PROCESSING",
  "COMPLETED",
] as const;

const updateSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(statuses),
  note: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (value.status === "REJECTED" && (!value.note || value.note.length < 5)) {
    context.addIssue({ code: "custom", path: ["note"], message: "Indique um motivo para rejeitar a solicitação." });
  }
});

const transitions: Record<string, string[]> = {
  RECEIVED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["WAITING_FOR_RETURN", "REFUND_PROCESSING", "EXCHANGE_PROCESSING"],
  WAITING_FOR_RETURN: ["ITEM_RECEIVED"],
  ITEM_RECEIVED: ["REFUND_PROCESSING", "EXCHANGE_PROCESSING"],
  REFUND_PROCESSING: ["COMPLETED"],
  EXCHANGE_PROCESSING: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !isAdmin(auth)) return errorResponse("Administrator access required", 403);

  const params = new URL(request.url).searchParams;
  const status = params.get("status") || "ALL";
  const where = status === "ALL" ? {} : { status: { equals: status } };

  const requests = await prisma.returnRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      order: { select: { id: true, orderNumber: true, status: true, currency: true, totalEUR: true, totalKZ: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return Response.json({ data: requests });
}

export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !isAdmin(auth)) return errorResponse("Administrator access required", 403);

  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Dados de transição inválidos.", 400, parsed.error.flatten().fieldErrors);
  const actor = userSubject(auth) || "admin";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.returnRequest.findUnique({
        where: { id: parsed.data.id },
        include: {
          user: { select: { id: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      });
      if (!current) throw new Error("RETURN_NOT_FOUND");
      if (current.status === parsed.data.status) {
        return {
          request: current,
          userId: current.user.id,
          orderNumber: current.order.orderNumber,
          idempotent: true,
        };
      }
      const allowedTransition = (transitions[current.status] || []).includes(parsed.data.status) ||
        (current.type === "COMPLAINT" && current.status === "APPROVED" && parsed.data.status === "COMPLETED");
      if (!allowedTransition) throw new Error("INVALID_TRANSITION");
      if (current.type === "COMPLAINT" && ["WAITING_FOR_RETURN", "ITEM_RECEIVED", "REFUND_PROCESSING", "EXCHANGE_PROCESSING"].includes(parsed.data.status)) {
        throw new Error("RETURN_TYPE_TRANSITION_MISMATCH");
      }
      if (current.type === "RETURN" && parsed.data.status === "EXCHANGE_PROCESSING") throw new Error("RETURN_TYPE_TRANSITION_MISMATCH");
      if (current.type === "EXCHANGE" && parsed.data.status === "REFUND_PROCESSING") throw new Error("RETURN_TYPE_TRANSITION_MISMATCH");
      if (current.type === "RETURN" && parsed.data.status === "REFUND_PROCESSING" && current.status !== "ITEM_RECEIVED") {
        throw new Error("RETURN_ITEM_NOT_RECEIVED");
      }

      if (parsed.data.status === "COMPLETED" && current.status === "REFUND_PROCESSING" && current.type === "RETURN") {
        const refund = await tx.refund.findFirst({
          where: { returnRequestId: current.id, status: "SUCCEEDED" },
          select: { id: true },
        });
        if (!refund) throw new Error("REFUND_NOT_CONFIRMED");
      }

      const updated = await tx.returnRequest.update({
        where: { id: current.id },
        data: {
          status: parsed.data.status,
          ...(parsed.data.note
            ? { description: [current.description, "Admin: " + parsed.data.note].filter(Boolean).join("\n").slice(0, 2000) }
            : {}),
        },
      });

      await tx.returnRequestEvent.create({
        data: {
          returnRequestId: current.id,
          previousStatus: current.status,
          nextStatus: parsed.data.status,
          actorExternalId: actor,
          note: parsed.data.note || null,
        },
      });

      return { request: updated, userId: current.user.id, orderNumber: current.order.orderNumber, idempotent: false };
    });

    const labels: Record<string, string> = {
      UNDER_REVIEW: "Em análise",
      APPROVED: "Aprovada",
      REJECTED: "Rejeitada",
      WAITING_FOR_RETURN: "A aguardar devolução do artigo",
      ITEM_RECEIVED: "Artigo recebido",
      REFUND_PROCESSING: "Reembolso em processamento",
      EXCHANGE_PROCESSING: "Troca em processamento",
      COMPLETED: "Concluída",
    };

    if (!result.idempotent) await createNotificationIfAllowed({
      userId: result.userId,
      channel: "orderUpdates",
      type: "RETURN_STATUS_CHANGED",
      title: "Atualização do pedido de pós-venda",
      message: "A solicitação " + result.request.requestNumber + " da encomenda " + result.orderNumber + " está agora: " + (labels[result.request.status] || result.request.status) + "." + (parsed.data.note ? " Nota: " + parsed.data.note : ""),
      link: "/account/returns",
      dedupeKey: "return:" + result.request.id + ":status:" + result.request.status,
    }).catch(() => undefined);

    return Response.json({ data: result.request, idempotent: result.idempotent });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "RETURN_NOT_FOUND") return errorResponse("Solicitação não encontrada.", 404);
    if (code === "INVALID_TRANSITION") return errorResponse("Esta transição não é permitida. Atualize a lista e selecione o próximo estado válido.", 409);
    if (code === "RETURN_TYPE_TRANSITION_MISMATCH") return errorResponse("O próximo estado não corresponde ao tipo de solicitação (devolução, troca ou reclamação).", 409);
    if (code === "REFUND_NOT_CONFIRMED") return errorResponse("A solicitação só pode ser concluída depois de existir um reembolso confirmado para esta devolução.", 409);
    if (code === "RETURN_ITEM_NOT_RECEIVED") return errorResponse("Registe primeiro a receção do artigo antes de iniciar o reembolso.", 409);
    return errorResponse("Não foi possível atualizar a solicitação.", 503);
  }
}
