import crypto from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/server/api";
import { logger } from "@/lib/server/logger";
import { issueInvoiceForPaidOrder } from "@/lib/server/finance/issueInvoiceForPaidOrder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return errorResponse("Invoice cron is not configured.", 503);
  if (!authorized(request)) return errorResponse("Unauthorized.", 401);

  const now = new Date();
  const candidates = await prisma.order.findMany({
    where: {
      payment: { is: { status: "PAID" } },
      status: { in: ["PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"] },
      invoice: { is: null },
    },
    select: { id: true, orderNumber: true, companyId: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  let issued = 0;
  let alreadyIssued = 0;
  let skipped = 0;
  const failures: Array<{ orderId: number; reason: string }> = [];

  for (const order of candidates) {
    try {
      const result = await issueInvoiceForPaidOrder(order.id, "SYSTEM_CRON");
      if (!result) {
        skipped += 1;
        continue;
      }
      if (result.created) issued += 1;
      else alreadyIssued += 1;
    } catch (error) {
      failures.push({
        orderId: order.id,
        reason: error instanceof Error ? error.message : "Unknown invoice error",
      });
      logger.error("Automatic invoice issuance failed", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        companyId: order.companyId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  return Response.json({
    data: {
      scanned: candidates.length,
      issued,
      alreadyIssued,
      skipped,
      failed: failures.length,
      failures,
      hasMoreCandidates: candidates.length === 100,
      ranAt: now.toISOString(),
    },
  });
}
