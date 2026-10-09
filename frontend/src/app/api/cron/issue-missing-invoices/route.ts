import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/server/api";
import { logger } from "@/lib/server/logger";
import { issueInvoiceForPaidOrder } from "@/lib/server/finance/issueInvoiceForPaidOrder";
import { issueCreditNoteForSucceededRefund } from "@/lib/server/finance/issueCreditNoteForSucceededRefund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 50;
const MAX_INVOICES_PER_RUN = 200;
const MAX_CREDIT_NOTES_PER_RUN = 200;
const INVOICE_BUDGET_MS = 22_000;
const TOTAL_WORK_BUDGET_MS = 45_000;

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

const missingInvoiceWhere: Prisma.OrderWhereInput = {
  payment: { is: { status: "PAID" } },
  status: { in: ["PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] },
  invoice: { is: null },
};

const missingCreditNoteWhere: Prisma.RefundWhereInput = {
  status: "SUCCEEDED",
  creditNote: { is: null },
};

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return errorResponse("Invoice cron is not configured.", 503);
  if (!authorized(request)) return errorResponse("Unauthorized.", 401);

  const startedAt = Date.now();
  const now = new Date(startedAt);
  const invoiceDeadline = startedAt + INVOICE_BUDGET_MS;
  const totalDeadline = startedAt + TOTAL_WORK_BUDGET_MS;

  const attemptedOrderIds: number[] = [];
  let invoiceScanned = 0;
  let issued = 0;
  let alreadyIssued = 0;
  let skipped = 0;
  const failures: Array<{ orderId: number; reason: string }> = [];

  while (invoiceScanned < MAX_INVOICES_PER_RUN && Date.now() < invoiceDeadline) {
    const take = Math.min(BATCH_SIZE, MAX_INVOICES_PER_RUN - invoiceScanned);
    const candidates = await prisma.order.findMany({
      where: {
        ...missingInvoiceWhere,
        ...(attemptedOrderIds.length ? { id: { notIn: attemptedOrderIds } } : {}),
      },
      select: { id: true, orderNumber: true, companyId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
    });
    if (!candidates.length) break;

    for (const order of candidates) {
      if (Date.now() >= invoiceDeadline) break;
      attemptedOrderIds.push(order.id);
      invoiceScanned += 1;
      try {
        const result = await issueInvoiceForPaidOrder(order.id, "SYSTEM_CRON");
        if (!result) skipped += 1;
        else if (result.created) issued += 1;
        else alreadyIssued += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown invoice error";
        failures.push({ orderId: order.id, reason });
        logger.error("Automatic invoice issuance failed", {
          orderId: order.id,
          orderNumber: order.orderNumber,
          companyId: order.companyId,
          error: reason,
        });
      }
    }

    if (candidates.length < take || Date.now() >= invoiceDeadline) break;
  }

  const attemptedRefundIds: number[] = [];
  let creditNoteScanned = 0;
  let creditNotesIssued = 0;
  let creditNotesAlreadyIssued = 0;
  let creditNotesSkipped = 0;
  const creditNoteFailures: Array<{ refundId: number; reason: string }> = [];

  while (creditNoteScanned < MAX_CREDIT_NOTES_PER_RUN && Date.now() < totalDeadline) {
    const take = Math.min(BATCH_SIZE, MAX_CREDIT_NOTES_PER_RUN - creditNoteScanned);
    const candidates = await prisma.refund.findMany({
      where: {
        ...missingCreditNoteWhere,
        ...(attemptedRefundIds.length ? { id: { notIn: attemptedRefundIds } } : {}),
      },
      select: { id: true, orderId: true },
      orderBy: [{ processedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take,
    });
    if (!candidates.length) break;

    for (const refund of candidates) {
      if (Date.now() >= totalDeadline) break;
      attemptedRefundIds.push(refund.id);
      creditNoteScanned += 1;
      try {
        const result = await issueCreditNoteForSucceededRefund(refund.id, "SYSTEM_CRON");
        if (!result) creditNotesSkipped += 1;
        else if (result.created) creditNotesIssued += 1;
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

    if (candidates.length < take || Date.now() >= totalDeadline) break;
  }

  let invoicesRemain = true;
  let creditNotesRemain = true;
  try {
    invoicesRemain = (await prisma.order.count({ where: missingInvoiceWhere })) > 0;
    creditNotesRemain = (await prisma.refund.count({ where: missingCreditNoteWhere })) > 0;
  } catch (error) {
    logger.warn("Unable to count remaining finance document backlog", {
      error: error instanceof Error ? error.message : error,
    });
  }

  return Response.json({
    data: {
      invoiceReconciliation: {
        scanned: invoiceScanned,
        issued,
        alreadyIssued,
        skipped,
        failed: failures.length,
        failures,
        hasMoreCandidates: invoicesRemain,
        maxInvoicesPerRun: MAX_INVOICES_PER_RUN,
      },
      creditNoteReconciliation: {
        scanned: creditNoteScanned,
        issued: creditNotesIssued,
        alreadyIssued: creditNotesAlreadyIssued,
        skipped: creditNotesSkipped,
        failed: creditNoteFailures.length,
        failures: creditNoteFailures,
        hasMoreCandidates: creditNotesRemain,
        maxCreditNotesPerRun: MAX_CREDIT_NOTES_PER_RUN,
      },
      elapsedMs: Date.now() - startedAt,
      ranAt: now.toISOString(),
    },
  });
}
