import crypto from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { createNotificationIfAllowed } from "@/lib/server/notifications";
import { z } from "zod";

export const runtime = "nodejs";

const returnSchema = z.object({
  orderId: z.number().int().positive(),
  type: z.enum(["RETURN", "EXCHANGE", "COMPLAINT"]),
  reason: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Authentication required", 401);

  const parsed = returnSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Dados da solicitação inválidos.", 400, parsed.error.flatten().fieldErrors);

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true },
  });
  if (!user) return errorResponse("User profile not found", 401);

  const order = await prisma.order.findFirst({
    where: { id: parsed.data.orderId, userId: user.id },
    select: { id: true, orderNumber: true, status: true, payment: { select: { status: true } } },
  });
  if (!order) return errorResponse("Encomenda não encontrada.", 404);
  if (!["PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"].includes(order.status) ||
      order.payment?.status !== "PAID") {
    return errorResponse("A encomenda ainda não é elegível para pós-venda: o pagamento deve estar confirmado e a encomenda não pode estar cancelada.", 409);
  }

  const requestNumber = "DV" + new Date().getFullYear() + crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const returnRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.returnRequest.create({
      data: {
        ...parsed.data,
        requestNumber,
        userId: user.id,
        status: "RECEIVED",
      },
    });
    await tx.returnRequestEvent.create({
      data: {
        returnRequestId: created.id,
        previousStatus: null,
        nextStatus: "RECEIVED",
        actorExternalId: subject,
        note: "Solicitação criada pelo cliente.",
      },
    });
    return created;
  });

  await createNotificationIfAllowed({
    userId: user.id,
    channel: "orderUpdates",
    type: "RETURN_REQUEST_RECEIVED",
    title: "Solicitação recebida",
    message: "A solicitação " + returnRequest.requestNumber + " associada à encomenda " + order.orderNumber + " foi registada e aguarda análise.",
    link: "/account/returns",
    dedupeKey: "return:" + returnRequest.id + ":status:RECEIVED",
  }).catch(() => undefined);

  return Response.json({ data: returnRequest }, { status: 201 });
}

export async function GET(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Authentication required", 401);

  const requests = await prisma.returnRequest.findMany({
    where: { user: { externalId: subject } },
    include: {
      order: { select: { id: true, orderNumber: true, status: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json({ data: requests });
}
