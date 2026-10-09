import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/server/api";
import { cancelAwaitingPaymentAndReleaseStock } from "@/lib/server/orders/inventory";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 100;
const MAX_ORDERS_PER_RUN = 400;
const WORK_BUDGET_MS = 45_000;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!secret || !supplied) return false;
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

const expiredOrderWhere = (now: Date): Prisma.OrderWhereInput => ({
  inventoryReserved: true,
  inventoryReservationExpiresAt: { lte: now },
  status: { in: ["PENDING", "AWAITING_PAYMENT"] },
});

async function runCleanup(request: Request) {
  if (!process.env.CRON_SECRET) return errorResponse("Cron cleanup is not configured.", 503);
  if (!authorized(request)) return errorResponse("Unauthorized.", 401);

  const startedAt = Date.now();
  const deadline = startedAt + WORK_BUDGET_MS;
  const now = new Date(startedAt);
  const attemptedIds: number[] = [];
  let scanned = 0;
  let released = 0;
  let alreadyPaid = 0;
  let skipped = 0;
  const failures: Array<{ orderId: number; reason: string }> = [];

  while (scanned < MAX_ORDERS_PER_RUN && Date.now() < deadline) {
    const take = Math.min(BATCH_SIZE, MAX_ORDERS_PER_RUN - scanned);
    const batch = await prisma.order.findMany({
      where: {
        ...expiredOrderWhere(now),
        ...(attemptedIds.length ? { id: { notIn: attemptedIds } } : {}),
      },
      select: { id: true },
      orderBy: [{ inventoryReservationExpiresAt: "asc" }, { id: "asc" }],
      take,
    });
    if (!batch.length) break;

    for (const candidate of batch) {
      // Keep a safety margin for platform shutdown. Unstarted rows remain eligible
      // for the next scheduled run; attempted rows are excluded from this run only.
      if (Date.now() >= deadline) break;
      attemptedIds.push(candidate.id);
      scanned += 1;

      try {
        const outcome = await prisma.$transaction(async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: candidate.id },
            include: {
              items: { select: { productId: true, quantity: true } },
              payment: { select: { id: true, status: true } },
            },
          });
          if (
            !order ||
            !order.inventoryReserved ||
            !order.inventoryReservationExpiresAt ||
            order.inventoryReservationExpiresAt > now ||
            !["PENDING", "AWAITING_PAYMENT"].includes(order.status)
          ) return "SKIPPED";

          if (order.payment?.status === "PAID") {
            const updated = await tx.order.updateMany({
              where: {
                id: order.id,
                inventoryReserved: true,
                status: { in: ["PENDING", "AWAITING_PAYMENT"] },
              },
              data: {
                status: "PAYMENT_CONFIRMED",
                inventoryReserved: false,
                inventoryReservationExpiresAt: null,
              },
            });
            if (updated.count === 1) {
              await tx.trackingEvent.create({
                data: {
                  orderId: order.id,
                  status: "PAYMENT_CONFIRMED",
                  location: "Online",
                  description: "Pagamento reconciliado pelo processo de expiração; reserva consumida sem libertar stock.",
                },
              });
              return "PAID";
            }
            return "SKIPPED";
          }

          const didRelease = await cancelAwaitingPaymentAndReleaseStock(
            tx,
            order.id,
            order.items,
            "EXPIRED",
            "Encomenda cancelada automaticamente porque a reserva de stock expirou sem pagamento confirmado.",
          );
          if (!didRelease) return "SKIPPED";

          if (order.companyId) {
            await tx.purchaseOrder.updateMany({
              where: {
                companyId: order.companyId,
                orderId: order.id,
                status: "CONVERTED",
              },
              data: {
                status: "APPROVED",
                orderId: null,
                approvedBy: null,
                approvedAt: null,
              },
            });
          }
          return "RELEASED";
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        });

        if (outcome === "RELEASED") released += 1;
        else if (outcome === "PAID") alreadyPaid += 1;
        else skipped += 1;
      } catch (error) {
        failures.push({
          orderId: candidate.id,
          reason: error instanceof Error ? error.message : "Unknown cleanup error",
        });
        logger.error("Expired inventory reservation cleanup failed", {
          orderId: candidate.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    if (batch.length < take || Date.now() >= deadline) break;
  }

  let hasMoreCandidates = true;
  try {
    hasMoreCandidates = (await prisma.order.count({ where: expiredOrderWhere(now) })) > 0;
  } catch (error) {
    logger.warn("Unable to count remaining expired inventory reservations", {
      error: error instanceof Error ? error.message : error,
    });
  }

  return Response.json({
    data: {
      scanned,
      released,
      alreadyPaid,
      skipped,
      failed: failures.length,
      failures,
      hasMoreCandidates,
      maxOrdersPerRun: MAX_ORDERS_PER_RUN,
      elapsedMs: Date.now() - startedAt,
      ranAt: now.toISOString(),
    },
  });
}

export async function GET(request: Request) {
  return runCleanup(request);
}

export async function POST(request: Request) {
  return runCleanup(request);
}
