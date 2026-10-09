import crypto from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/server/api";
import { logger } from "@/lib/server/logger";
import { issueInvoiceForPaidOrder } from "@/lib/server/finance/issueInvoiceForPaidOrder";
import { issueCreditNoteForSucceededRefund } from "@/lib/server/finance/issueCreditNoteForSucceededRefund";

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

  const creditNoteCandidates = await prisma.refund.findMany({
    where: {
      status: "SUCCEEDED",
      creditNote: { is: null },
    },
    select: { id: true, orderId: true },
    orderBy: [{ processedAt: "asc" }, { createdAt: "asc" }],
    take: 100,
  });

  let creditNotesIssued = 0;
  let creditNotesAlreadyIssued = 0;
  const creditNoteFailures: Array<{ refundId: number; reason: string }> = [];

  for (const refund of creditNoteCandidates) {
    try {
      const result = await issueCreditNoteForSucceededRefund(refund.id, "SYSTEM_CRON");
      if (!result) continue;
      if (result.created) creditNotesIssued += 1;
      else creditNotesAlreadyIssued += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown credit note error";
      creditNoteFailures.push({ refundId: refund.id, reason });
      logger.error("Automatic credit note issuance failed", {
        refundId: refund.id,
        orderId: refund.orderId,
        error: reason,
      });
    }
  }

  return Response.json({
    data: {
      invoiceReconciliation: {
        scanned: candidates.length,
        issued,
        alreadyIssued,
        skipped,
        failed: failures.length,
        failures,
        hasMoreCandidates: candidates.length === 100,
      },
      creditNoteReconciliation: {
        scanned: creditNoteCandidates.length,
        issued: creditNotesIssued,
        alreadyIssued: creditNotesAlreadyIssued,
        failed: creditNoteFailures.length,
        failures: creditNoteFailures,
        hasMoreCandidates: creditNoteCandidates.length === 100,
      },
      ranAt: now.toISOString(),
    },
  });
}
