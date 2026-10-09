import crypto from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";
import { createNotificationIfAllowed } from "@/lib/server/notifications";
import { issueInvoiceForPaidOrder } from "@/lib/server/finance/issueInvoiceForPaidOrder";

export async function issueCreditNoteForSucceededRefund(refundId: number, issuedBy = "SYSTEM_REFUND") {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: {
      order: { select: { id: true, orderNumber: true, companyId: true } },
      user: { select: { id: true } },
    },
  });
  if (!refund || refund.status !== "SUCCEEDED") return null;

  const existing = await prisma.creditNote.findUnique({ where: { refundId: refund.id } });
  if (existing) return { creditNote: existing, created: false };

  let invoice = await prisma.invoice.findUnique({ where: { orderId: refund.orderId } });
  if (!invoice) {
    // Backfill an original invoice before documenting a completed refund.
    await issueInvoiceForPaidOrder(refund.orderId, "SYSTEM_REFUND_BACKFILL");
    invoice = await prisma.invoice.findUnique({ where: { orderId: refund.orderId } });
  }
  if (!invoice) {
    throw new Error("INVOICE_REQUIRED_FOR_CREDIT_NOTE");
  }
  if (invoice.currency !== refund.currency) {
    throw new Error("CREDIT_NOTE_CURRENCY_MISMATCH");
  }

  const creditNoteNumber = "NC-" + new Date().getFullYear() + "-" + String(refund.id).padStart(8, "0");
  const verificationCode = crypto.randomBytes(12).toString("base64url");

  try {
    const creditNote = await prisma.creditNote.create({
      data: {
        creditNoteNumber,
        verificationCode,
        invoiceId: invoice.id,
        orderId: refund.orderId,
        refundId: refund.id,
        userId: refund.userId,
        companyId: refund.order.companyId,
        status: "ISSUED",
        currency: refund.currency,
        amountEUR: refund.amountEUR,
        amountKZ: refund.amountKZ,
        reason: refund.reason,
        sellerName: invoice.sellerName,
        sellerTaxId: invoice.sellerTaxId,
        sellerAddress: invoice.sellerAddress,
        buyerName: invoice.buyerName,
        buyerTaxId: invoice.buyerTaxId,
        buyerAddress: invoice.buyerAddress,
        issuedBy,
      },
    });

    await createNotificationIfAllowed({
      userId: refund.userId,
      channel: "orderUpdates",
      type: "CREDIT_NOTE_ISSUED",
      title: "Nota de crédito emitida",
      message: "A nota de crédito " + creditNote.creditNoteNumber + " relativa ao reembolso da encomenda " + refund.order.orderNumber + " já está disponível.",
      link: refund.order.companyId ? "/b2b/financeiro" : "/account/invoices",
      dedupeKey: "credit-note:" + creditNote.id + ":issued",
    }).catch((error) => logger.warn("Unable to create credit note notification", {
      creditNoteId: creditNote.id,
      refundId: refund.id,
      error: error instanceof Error ? error.message : error,
    }));

    return { creditNote, created: true };
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      const duplicate = await prisma.creditNote.findUnique({ where: { refundId: refund.id } });
      if (duplicate) return { creditNote: duplicate, created: false };
    }
    logger.error("Unable to issue credit note", {
      refundId: refund.id,
      orderId: refund.orderId,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}
