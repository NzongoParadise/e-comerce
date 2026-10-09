import crypto from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";
import { createNotificationIfAllowed } from "@/lib/server/notifications";

export async function issueInvoiceForPaidOrder(orderId: number, issuedBy = "SYSTEM_PAYMENT") {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, legalName: true, nif: true, email: true, address: true } },
      payment: { select: { status: true } },
    },
  });
  if (!order || order.payment?.status !== "PAID") return null;

  // A paid event that arrived after cancellation remains in manual reconciliation.
  // Do not issue a commercial invoice until the order lifecycle is safe to process.
  const issuableStatuses = ["PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"];
  if (!issuableStatuses.includes(order.status)) return null;

  const existing = await prisma.invoice.findUnique({ where: { orderId: order.id } });
  if (existing) return { invoice: existing, created: false };

  const sellerName = process.env.SELLER_NAME?.trim() || "RUBRICA DILIGENTE (SU), LDA";
  const sellerTaxId = process.env.SELLER_TAX_ID?.trim() || process.env.COMPANY_NIF?.trim() || null;
  const sellerAddress = process.env.SELLER_ADDRESS?.trim() || null;
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (isProduction && (!sellerTaxId || !sellerAddress)) {
    logger.error("Commercial invoice is blocked because the seller fiscal profile is incomplete", {
      orderId: order.id,
      missingSellerTaxId: !sellerTaxId,
      missingSellerAddress: !sellerAddress,
    });
    throw new Error("SELLER_FISCAL_PROFILE_INCOMPLETE");
  }

  const invoiceNumber = "FT-" + new Date().getFullYear() + "-" + String(order.id).padStart(8, "0");
  const verificationCode = crypto.randomBytes(12).toString("base64url");

  try {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        verificationCode,
        orderId: order.id,
        userId: order.userId,
        companyId: order.companyId,
        status: "ISSUED",
        currency: order.currency,
        totalEUR: order.totalEUR,
        totalKZ: order.totalKZ,
        discountTotalEUR: order.discountTotalEUR,
        discountTotalKZ: order.discountTotalKZ,
        sellerName,
        sellerTaxId,
        sellerAddress,
        buyerName: order.billingName || order.company?.legalName || order.user.name || null,
        buyerEmail: order.billingEmail || order.company?.email || order.user.email || null,
        buyerTaxId: order.billingTaxId || order.company?.nif || null,
        buyerAddress: order.address || order.company?.address || null,
        issuedBy,
      },
    });

    await createNotificationIfAllowed({
      userId: order.userId,
      channel: "orderUpdates",
      type: "INVOICE_ISSUED",
      title: "Fatura emitida",
      message: "A fatura " + invoice.invoiceNumber + " da encomenda " + order.orderNumber + " já está disponível.",
      link: order.companyId ? "/b2b/financeiro" : "/account/invoices",
      dedupeKey: "invoice:" + invoice.id + ":issued",
    }).catch((error) => logger.warn("Unable to create invoice notification", {
      invoiceId: invoice.id,
      orderId: order.id,
      error: error instanceof Error ? error.message : error,
    }));

    return { invoice, created: true };
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      const duplicate = await prisma.invoice.findUnique({ where: { orderId: order.id } });
      if (duplicate) return { invoice: duplicate, created: false };
    }
    logger.error("Unable to issue invoice for paid order", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}
