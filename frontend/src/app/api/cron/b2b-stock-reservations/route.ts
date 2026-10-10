import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/server/api";
import { createNotificationIfAllowed } from "@/lib/server/notifications";
import {
  B2B_STOCK_RESERVATION_DURATION_MS,
  cancelAwaitingPaymentAndReleaseStock,
  getB2BStockReservationExpiry,
} from "@/lib/server/orders/inventory";

export const runtime = "nodejs";

const BATCH_SIZE = 50;

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expected = Buffer.from(secret);
  const supplied = Buffer.from(suppliedToken);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

async function stripeCheckoutHasNotSettled(reference: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is required to safely expire a B2B Stripe reservation");

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Stripe checkout lookup failed with status ${response.status}`);

  const session = await response.json() as { status?: unknown };
  if (!["open", "complete", "expired"].includes(String(session.status))) {
    throw new Error("Stripe returned an invalid checkout status");
  }
  return session.status !== "expired";
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    console.error("CRON_SECRET is missing or shorter than 32 characters");
    return errorResponse("O agendador de expiração não está configurado.", 503);
  }
  if (!isAuthorized(request, secret)) return errorResponse("Não autorizado.", 401);

  const now = new Date();
  const legacyExpiryCutoff = new Date(now.getTime() - B2B_STOCK_RESERVATION_DURATION_MS);
  const orders = await prisma.order.findMany({
    where: {
      companyId: { not: null },
      status: { in: ["AWAITING_PAYMENT", "PENDING"] },
      OR: [
        {
          AND: [
            { createdAt: { lte: legacyExpiryCutoff } },
            { payment: { is: null } },
          ],
        },
        {
          payment: {
            is: {
              status: { not: "PAID" },
              expiresAt: { lte: now },
            },
          },
        },
        {
          AND: [
            { createdAt: { lte: legacyExpiryCutoff } },
            { payment: { is: { status: { not: "PAID" }, expiresAt: null } } },
          ],
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
    include: {
      payment: { select: { status: true, provider: true, reference: true, expiresAt: true } },
      items: { select: { productId: true, quantity: true } },
    },
  });

  let cancelledCount = 0;
  let deferredCount = 0;
  let failureCount = 0;
  for (const order of orders) {
    if (order.payment?.status === "PAID") continue;
    const reservationExpiry = getB2BStockReservationExpiry(order.createdAt, order.payment?.expiresAt ?? null);
    if (reservationExpiry > now) continue;

    if (order.payment?.provider.toLowerCase() === "stripe" && order.payment.reference?.startsWith("cs_")) {
      try {
        if (await stripeCheckoutHasNotSettled(order.payment.reference)) {
          deferredCount += 1;
          continue;
        }
      } catch (error) {
        failureCount += 1;
        console.error("Unable to verify expired B2B Stripe checkout before releasing stock:", {
          orderId: order.id,
          error: error instanceof Error ? error.message : error,
        });
        continue;
      }
    }

    try {
      const cancelled = await prisma.$transaction((transaction) => cancelAwaitingPaymentAndReleaseStock(
        transaction,
        order.id,
        order.items,
        "EXPIRED",
        "Encomenda B2B cancelada após expiração da reserva de stock de 24 horas.",
        { allowedOrderStatuses: ["AWAITING_PAYMENT", "PENDING"], allowMissingPayment: true },
      ));
      if (!cancelled) continue;
      cancelledCount += 1;
      await createNotificationIfAllowed({
        userId: order.userId,
        channel: "orderUpdates",
        type: "ORDER_CANCELLED",
        title: "Reserva de encomenda expirada",
        message: `A encomenda ${order.orderNumber} foi cancelada após 24 horas sem pagamento e o stock foi libertado.`,
        link: `/account/orders/${order.id}`,
        dedupeKey: `order:${order.id}:status:CANCELLED`,
      }).catch((error) => console.error("Unable to notify B2B customer about expired reservation:", error));
    } catch (error) {
      failureCount += 1;
      console.error("Unable to cancel expired B2B stock reservation:", {
        orderId: order.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  const result = {
    scanned: orders.length,
    cancelled: cancelledCount,
    deferredForStripe: deferredCount,
    failures: failureCount,
    moreAvailable: orders.length === BATCH_SIZE,
  };
  if (failureCount) return Response.json({ data: result }, { status: 503 });
  return Response.json({ data: result });
}
