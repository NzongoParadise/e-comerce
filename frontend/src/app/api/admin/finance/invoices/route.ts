import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from "@/lib/server/api";
import { logger } from "@/lib/server/logger";
import { issueInvoiceForPaidOrder } from "@/lib/server/finance/issueInvoiceForPaidOrder";
import { z } from "zod";

export const runtime = "nodejs";

const createSchema = z.object({
  orderId: z.number().int().positive(),
});

async function requireAdmin(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return { error: errorResponse("Authentication required", 401), actor: null };
  if (!isAdmin(auth)) return { error: errorResponse("Administrator access required", 403), actor: null };
  const actor = userSubject(auth);
  if (!actor) return { error: errorResponse("Identidade administrativa inválida.", 403), actor: null };
  return { error: null, actor };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const params = new URL(request.url).searchParams;
  const orderValue = params.get("orderId");
  const invoiceValue = params.get("invoiceId");
  if (orderValue && (!Number.isInteger(Number(orderValue)) || Number(orderValue) <= 0)) {
    return errorResponse("ID da encomenda inválido.", 400);
  }
  if (invoiceValue && (!Number.isInteger(Number(invoiceValue)) || Number(invoiceValue) <= 0)) {
    return errorResponse("ID da fatura inválido.", 400);
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: invoiceValue ? { id: Number(invoiceValue) } : orderValue ? { orderId: Number(orderValue) } : undefined,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalEUR: true,
            totalKZ: true,
            currency: true,
            items: true,
            payment: { select: { status: true, provider: true, paidAt: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, legalName: true, nif: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: 200,
    });
    return Response.json({ data: invoices });
  } catch (error) {
    logger.error("Unable to list invoices", { error: error instanceof Error ? error.message : error });
    return errorResponse("Não foi possível carregar as faturas.", 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Indique uma encomenda válida.", 400, parsed.error.flatten().fieldErrors);

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, legalName: true, nif: true, email: true, address: true } },
      payment: { select: { status: true, paidAt: true } },
    },
  });
  if (!order) return errorResponse("Encomenda não encontrada.", 404);
  if (order.payment?.status !== "PAID") return errorResponse("Só é possível emitir fatura depois de o pagamento estar confirmado.", 409);
  if (["CANCELLED", "REFUNDED"].includes(order.status)) {
    return errorResponse("Não é possível emitir uma nova fatura para uma encomenda cancelada ou totalmente reembolsada.", 409);
  }

  try {
    const result = await issueInvoiceForPaidOrder(order.id, auth.actor!);
    if (!result) return errorResponse("A encomenda ainda não está num estado elegível para emissão de fatura.", 409);
    return Response.json({ data: result.invoice, idempotent: !result.created }, { status: result.created ? 201 : 200 });
  } catch (error) {
    logger.error("Unable to issue invoice", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      error: error instanceof Error ? error.message : error,
    });
    return errorResponse("Não foi possível emitir a fatura.", 503);
  }
}
