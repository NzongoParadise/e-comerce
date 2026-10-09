import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson } from "@/lib/server/api";
import { z } from "zod";
import { createNotificationIfAllowed } from "@/lib/server/notifications";

export const runtime = "nodejs";

const updateSchema = z.object({
  quoteId: z.coerce.number().int().positive(),
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional(),
}).superRefine((data, context) => {
  if (data.action === "REJECT" && (!data.note || data.note.trim().length < 5)) {
    context.addIssue({ code: "custom", path: ["note"], message: "Indique o motivo da rejeição (mínimo 5 caracteres)." });
  }
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse("Authentication required", 401), user: null };
  if (!isAdmin(user)) return { error: errorResponse("Administrator access required", 403), user: null };
  const profile = user.sub
    ? await prisma.user.findUnique({ where: { externalId: user.sub }, select: { id: true } })
    : null;
  if (!profile) return { error: errorResponse("Administrator profile not found", 403), user: null };
  return { error: null, user: profile };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const status = new URL(request.url).searchParams.get("status") || "ALL";
  const where = status === "ALL" ? {} : { status };

  try {
    const quotes = await prisma.quote.findMany({
      where,
      include: {
        company: { select: { id: true, legalName: true, tradeName: true, nif: true, status: true } },
        user: { select: { id: true, name: true, email: true } },
        items: { select: { productId: true, name: true, quantity: true, unitPrice: true, subtotal: true } },
        purchaseOrders: { select: { id: true, poNumber: true, status: true, orderId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const counts = await prisma.quote.groupBy({ by: ["status"], _count: { _all: true } });
    return Response.json({
      data: quotes,
      stats: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    });
  } catch (error) {
    console.error("Unable to load B2B quote queue:", error);
    return errorResponse("Unable to load B2B quotes", 503);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid quote action", 400, parsed.error.flatten().fieldErrors);

  const { quoteId, action, note } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        include: {
          company: true,
          items: true,
          purchaseOrders: true,
          user: { select: { id: true } },
        },
      });
      if (!quote) throw new Error("QUOTE_NOT_FOUND");
      if (!quote.companyId || !quote.company) throw new Error("COMPANY_REQUIRED");
      if (!["SUBMITTED", "UNDER_REVIEW"].includes(quote.status)) throw new Error("QUOTE_NOT_REVIEWABLE");

      if (action === "REJECT") {
        const updated = await tx.quote.update({
          where: { id: quote.id },
          data: { status: "REJECTED", notes: note ? [quote.notes, note].filter(Boolean).join("\n") : quote.notes },
        });
        return { quote: updated, purchaseOrder: null };
      }

      const existing = quote.purchaseOrders.find((po) => po.status !== "CANCELLED");
      const po = existing ?? await tx.purchaseOrder.create({
        data: {
          companyId: quote.companyId,
          quoteId: quote.id,
          poNumber: `PO-${new Date().getFullYear()}-${String(quote.id).padStart(6, "0")}`,
          status: "APPROVED",
          approvedBy: auth.user!.id,
          approvedAt: new Date(),
          notes: note || null,
        },
      });

      if (existing) {
        await tx.purchaseOrder.update({
          where: { id: existing.id },
          data: { status: "APPROVED", approvedBy: auth.user!.id, approvedAt: new Date(), notes: note || existing.notes },
        });
      }

      const updated = await tx.quote.update({
        where: { id: quote.id },
        data: { status: "APPROVED", notes: note ? [quote.notes, note].filter(Boolean).join("\n") : quote.notes },
      });

      return { quote: updated, purchaseOrder: po };
    });

    await createNotificationIfAllowed({
      userId: result.quote.userId,
      channel: "orderUpdates",
      type: action === "APPROVE" ? "QUOTE_APPROVED" : "QUOTE_REJECTED",
      title: action === "APPROVE" ? "Cotação aprovada" : "Cotação rejeitada",
      message: action === "APPROVE"
        ? `A cotação ${result.quote.quoteNumber} foi aprovada. Já pode consultar o Purchase Order associado.`
        : `A cotação ${result.quote.quoteNumber} foi rejeitada. Motivo: ${note!.trim()}`,
      link: "/b2b/cotacoes",
      dedupeKey: `quote:${result.quote.id}:decision:${result.quote.status}`,
    }).catch(() => undefined);

    return Response.json({
      data: {
        quoteId: result.quote.id,
        status: result.quote.status,
        purchaseOrder: result.purchaseOrder,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "QUOTE_NOT_FOUND") return errorResponse("Cotação não encontrada.", 404);
    if (code === "COMPANY_REQUIRED") return errorResponse("A cotação não está associada a uma empresa.", 409);
    if (code === "QUOTE_NOT_REVIEWABLE") return errorResponse("Esta cotação já foi processada.", 409);
    console.error("Unable to process B2B quote:", error);
    return errorResponse("Não foi possível processar a cotação.", 503);
  }
}
