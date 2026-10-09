import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from "@/lib/server/api";
import { createNotificationIfAllowed } from "@/lib/server/notifications";
import { z } from "zod";

export const runtime = "nodejs";

const moderateSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.status === "REJECTED" && (!value.note || value.note.length < 5)) {
    context.addIssue({ code: "custom", path: ["note"], message: "Indique o motivo da rejeição." });
  }
});

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !isAdmin(auth)) return errorResponse("Administrator access required", 403);
  const status = new URL(request.url).searchParams.get("status") || "PENDING";
  if (!["ALL", "PENDING", "APPROVED", "REJECTED"].includes(status)) return errorResponse("Filtro de avaliação inválido.", 400);

  const reviews = await prisma.productReview.findMany({
    where: status === "ALL" ? {} : { status },
    include: {
      product: { select: { id: true, name: true, slug: true, imageUrl: true } },
      user: { select: { id: true, name: true, email: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const counts = await prisma.productReview.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return Response.json({
    data: reviews,
    stats: Object.fromEntries(counts.map((entry) => [entry.status, entry._count._all])),
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !isAdmin(auth)) return errorResponse("Administrator access required", 403);
  const parsed = moderateSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Dados de moderação inválidos.", 400, parsed.error.flatten().fieldErrors);

  const actor = userSubject(auth) || "admin";
  try {
    const review = await prisma.$transaction(async (tx) => {
      const existing = await tx.productReview.findUnique({
        where: { id: parsed.data.id },
        include: {
          product: { select: { id: true, slug: true, name: true } },
          user: { select: { id: true } },
        },
      });
      if (!existing) throw new Error("REVIEW_NOT_FOUND");
      if (existing.status !== "PENDING") throw new Error("REVIEW_ALREADY_MODERATED");

      return tx.productReview.update({
        where: { id: existing.id },
        data: {
          status: parsed.data.status,
          moderatedBy: actor,
          moderatedAt: new Date(),
          moderationNote: parsed.data.note || null,
        },
        include: {
          product: { select: { id: true, slug: true, name: true } },
          user: { select: { id: true } },
        },
      });
    });

    await createNotificationIfAllowed({
      userId: review.user.id,
      channel: "orderUpdates",
      type: "PRODUCT_REVIEW_MODERATED",
      title: review.status === "APPROVED" ? "Avaliação publicada" : "Avaliação não publicada",
      message: review.status === "APPROVED"
        ? "A sua avaliação de " + review.product.name + " foi aprovada e já pode ser consultada no catálogo."
        : "A sua avaliação de " + review.product.name + " não foi publicada." + (parsed.data.note ? " Motivo: " + parsed.data.note : ""),
      link: "/products/" + review.product.slug,
      dedupeKey: "product-review:" + review.id + ":status:" + review.status,
    }).catch(() => undefined);

    return Response.json({ data: review });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "REVIEW_NOT_FOUND") return errorResponse("Avaliação não encontrada.", 404);
    if (code === "REVIEW_ALREADY_MODERATED") return errorResponse("A avaliação já foi moderada.", 409);
    return errorResponse("Não foi possível moderar a avaliação.", 503);
  }
}
