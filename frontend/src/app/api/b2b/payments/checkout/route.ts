import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { isStripeCurrencySupported, toStripeMinorUnits } from "@/lib/server/payments/stripeAmounts";
import { multicaixaProvider } from "@/lib/server/payments/multicaixaProvider";
import { cancelAwaitingPaymentAndReleaseStock } from "@/lib/server/orders/inventory";
import { logger } from "@/lib/server/logger";
import { createNotificationIfAllowed } from "@/lib/server/notifications";

export const runtime = "nodejs";

const schema = z.object({
  poId: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(16).max(128),
  method: z.enum(["STRIPE_CHECKOUT", "MULTICAIXA_REFERENCE", "MULTICAIXA_EXPRESS"]).optional(),
  phoneNumber: z.string().trim().regex(/^(?:\+244|244|0)?9\d{8}$/).optional(),
});

type PaymentMethod = "STRIPE_CHECKOUT" | "MULTICAIXA_REFERENCE" | "MULTICAIXA_EXPRESS";

async function stripeRequest(path: string, body: URLSearchParams, idempotencyKey: string) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED");

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body,
    cache: "no-store",
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = data.error as { message?: unknown } | undefined;
    throw new Error(typeof error?.message === "string" ? error.message : "STRIPE_REQUEST_FAILED");
  }
  return data;
}

async function stripeSessionUrl(sessionId: string) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED");
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) return null;
  return typeof data.url === "string" ? data.url : null;
}

async function expireStripeSession(sessionId: string) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return;
  const body = new URLSearchParams();
  try {
    await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });
  } catch {
    // The payment event/webhook remains the source of truth if compensation cannot be confirmed.
  }
}

function responseForExisting(payment: {
  id: number;
  orderId: number;
  status: string;
  method: string;
  reference: string | null;
  entity: string | null;
  referenceNumber: string | null;
  expiresAt: Date | null;
  amountEUR: unknown;
  amountKZ: unknown;
  currency: string;
}, checkoutUrl: string | null, idempotent = true) {
  return Response.json({ data: { payment, checkoutUrl, idempotent } });
}

export async function POST(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Authentication required", 401);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Dados de pagamento inválidos.", 400);

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true, stripeCustomerId: true },
  });
  if (!user || user.accountType !== "B2B") return errorResponse("Esta operação requer uma conta empresarial.", 403);

  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE", company: { status: "ACTIVE" } },
    select: { companyId: true, role: true, company: { select: { country: true } } },
  });
  if (!membership) return errorResponse("A empresa não está ativa ou não existe.", 403);
  if (!["OWNER", "APPROVER"].includes(membership.role)) {
    return errorResponse("Apenas OWNER ou APPROVER pode iniciar o pagamento.", 403);
  }

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: parsed.data.poId, companyId: membership.companyId },
    include: {
      company: { select: { country: true } },
      order: { include: { items: true, payment: true } },
    },
  });
  if (!po || !po.order) return errorResponse("Purchase Order convertido em encomenda não encontrado.", 404);
  if (po.order.companyId !== membership.companyId) return errorResponse("A encomenda não pertence à empresa ativa.", 403);
  if (po.status !== "CONVERTED") return errorResponse("O Purchase Order precisa de estar convertido antes do pagamento.", 409);
  if (["PAYMENT_CONFIRMED", "COMPLETED", "DELIVERED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(po.order.status)) {
    return errorResponse("A encomenda já foi paga ou concluída.", 409);
  }
  if (!["PENDING", "AWAITING_PAYMENT"].includes(po.order.status)) {
    return errorResponse("Esta encomenda não está disponível para pagamento. Atualize o Purchase Order.", 409);
  }
  if (po.order.payment?.status === "PAID") return errorResponse("A encomenda já está paga.", 409);

  const market = po.order.country;
  const method: PaymentMethod = parsed.data.method ?? (market === "PT" ? "STRIPE_CHECKOUT" : "MULTICAIXA_REFERENCE");
  if (market === "PT") {
    if (po.order.currency !== "EUR" || !isStripeCurrencySupported(po.order.currency)) {
      return errorResponse("A compra empresarial em Portugal deve estar denominada em EUR.", 422);
    }
    if (method !== "STRIPE_CHECKOUT") return errorResponse("Em Portugal, selecione o pagamento por cartão Stripe.", 422);
    if (!process.env.STRIPE_SECRET_KEY) return errorResponse("Stripe não está configurado no ambiente.", 503);
    if (!process.env.FRONTEND_URL && !process.env.APP_URL) return errorResponse("FRONTEND_URL/APP_URL não configurado.", 503);
  } else {
    if (po.order.currency !== "AOA") return errorResponse("A compra empresarial em Angola deve estar denominada em AOA.", 422);
    if (!["MULTICAIXA_REFERENCE", "MULTICAIXA_EXPRESS"].includes(method)) {
      return errorResponse("Em Angola, selecione MULTICAIXA Referência ou Express.", 422);
    }
    if (method === "MULTICAIXA_EXPRESS" && !parsed.data.phoneNumber) {
      return errorResponse("Indique um número angolano válido para MULTICAIXA Express.", 400);
    }
    if (!multicaixaProvider.isConfigured()) return errorResponse("Gateway MULTICAIXA não configurado.", 503);
  }

  const existingAttempt = await prisma.paymentAttempt.findUnique({
    where: { idempotencyKey: parsed.data.idempotencyKey },
    include: { payment: { include: { order: { select: { id: true, companyId: true } } } } },
  });
  if (existingAttempt) {
    if (existingAttempt.payment.orderId !== po.order.id ||
        existingAttempt.payment.order.companyId !== membership.companyId) {
      return errorResponse("A chave de idempotência já está associada a outra encomenda.", 409);
    }
    const payment = existingAttempt.payment;
    const checkoutUrl = payment.reference?.startsWith("cs_") ? await stripeSessionUrl(payment.reference) : null;
    return responseForExisting(payment, checkoutUrl, true);
  }

  const currentPayment = await prisma.payment.findUnique({ where: { orderId: po.order.id } });
  if (currentPayment?.status === "PAID") return errorResponse("A encomenda já está paga.", 409);

  if (po.order.status === "AWAITING_PAYMENT" &&
      po.order.inventoryReserved &&
      po.order.inventoryReservationExpiresAt &&
      po.order.inventoryReservationExpiresAt.getTime() <= Date.now()) {
    const released = await prisma.$transaction(async (tx) => {
      const cancelled = await cancelAwaitingPaymentAndReleaseStock(
        tx,
        po.order!.id,
        po.order!.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        "EXPIRED",
        "Reserva empresarial expirada antes da confirmação do pagamento.",
      );
      if (cancelled) {
        await tx.purchaseOrder.updateMany({
          where: { id: po.id, orderId: po.order!.id, status: "CONVERTED" },
          data: { status: "APPROVED", orderId: null, approvedBy: null, approvedAt: null },
        });
      }
      return cancelled;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (released) return errorResponse("A reserva expirou. O stock foi libertado; volte a converter o Purchase Order para iniciar uma nova tentativa.", 409);
  }

  if (currentPayment && ["CREATED", "PROCESSING"].includes(currentPayment.status) &&
      Date.now() - currentPayment.updatedAt.getTime() < 120_000) {
    return errorResponse("Já existe uma tentativa de pagamento em preparação. Atualize as encomendas antes de tentar novamente.", 409);
  }
  if (currentPayment?.status === "AWAITING_PAYMENT" && currentPayment.method === method &&
      currentPayment.expiresAt && currentPayment.expiresAt.getTime() > Date.now()) {
    const checkoutUrl = currentPayment.reference?.startsWith("cs_") ? await stripeSessionUrl(currentPayment.reference) : null;
    if (method === "STRIPE_CHECKOUT" && checkoutUrl) return responseForExisting(currentPayment, checkoutUrl, true);
    if (method !== "STRIPE_CHECKOUT" && (currentPayment.referenceNumber || currentPayment.entity)) {
      return responseForExisting(currentPayment, null, true);
    }
  }

  let paymentId: number | null = null;
  let attemptId: number | null = null;
  let providerPaymentId: string | null = null;
  let providerPaymentCreated = false;

  try {
    const prepared = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: po.order!.id },
        include: { items: true, payment: true },
      });
      if (!order || order.companyId !== membership.companyId) throw new Error("ORDER_NOT_FOUND");
      if (order.status === "CANCELLED") throw new Error("ORDER_CANCELLED");
      const payment = order.payment;
      if (payment?.status === "PAID") throw new Error("ALREADY_PAID");
      if (payment && ["CREATED", "PROCESSING"].includes(payment.status) &&
          Date.now() - payment.updatedAt.getTime() < 120_000) {
        throw new Error("PAYMENT_ATTEMPT_IN_PROGRESS");
      }

      if (!order.inventoryReserved) {
        for (const item of order.items) {
          const reserved = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (reserved.count !== 1) throw new Error(`STOCK:${item.name}`);
        }
      }

      const paymentData = {
        provider: method === "STRIPE_CHECKOUT" ? "stripe" : "multicaixa",
        method,
        status: "CREATED",
        providerPaymentId: null,
        reference: null,
        entity: null,
        referenceNumber: null,
        expiresAt: null,
        phoneNumber: method === "MULTICAIXA_EXPRESS" ? parsed.data.phoneNumber ?? null : null,
        failedAt: null,
        paidAt: null,
        currency: po.order!.currency,
        amountEUR: Number(po.order!.totalEUR),
        amountKZ: Number(po.order!.totalKZ),
      };

      const savedPayment = payment
        ? await tx.payment.update({ where: { id: payment.id }, data: paymentData })
        : await tx.payment.create({ data: { ...paymentData, orderId: po.order!.id, userId: user.id } });

      const attempt = await tx.paymentAttempt.create({
        data: { paymentId: savedPayment.id, idempotencyKey: parsed.data.idempotencyKey, status: "PROCESSING" },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "AWAITING_PAYMENT",
          paymentMethod: method,
          inventoryReserved: true,
          inventoryReservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      return { payment: savedPayment, attempt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    paymentId = prepared.payment.id;
    attemptId = prepared.attempt.id;

    if (method === "STRIPE_CHECKOUT") {
      const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL;
      if (!frontendUrl) throw new Error("FRONTEND_URL/APP_URL not configured");
      const baseUrl = frontendUrl.replace(/\/$/, "");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const body = new URLSearchParams();
      body.set("mode", "payment");
      body.set("expires_at", String(Math.floor(expiresAt.getTime() / 1000)));
      body.set("success_url", `${baseUrl}/b2b/encomendas?payment=success&session_id={CHECKOUT_SESSION_ID}`);
      body.set("cancel_url", `${baseUrl}/b2b/encomendas?payment=cancelled&po=${po.id}`);
      body.set("metadata[orderId]", String(po.order.id));
      body.set("metadata[companyId]", String(po.companyId));
      body.set("metadata[poId]", String(po.id));
      body.set("metadata[userId]", String(user.id));
      body.set("payment_method_types[0]", "card");
      if (user.stripeCustomerId) body.set("customer", user.stripeCustomerId);

      po.order.items.forEach((item, index) => {
        body.set(`line_items[${index}][price_data][currency]`, "eur");
        body.set(`line_items[${index}][price_data][product_data][name]`, item.name.slice(0, 250));
        body.set(`line_items[${index}][price_data][unit_amount]`, String(toStripeMinorUnits(Number(item.unitPrice))));
        body.set(`line_items[${index}][quantity]`, String(item.quantity));
      });

      const session = await stripeRequest("checkout/sessions", body, `b2b-${parsed.data.idempotencyKey}`);
      const sessionId = typeof session.id === "string" ? session.id : "";
      const sessionUrl = typeof session.url === "string" ? session.url : "";
      if (!sessionId || !sessionUrl) throw new Error("STRIPE_SESSION_INVALID");
      providerPaymentId = sessionId;
      providerPaymentCreated = true;

      const updated = await prisma.$transaction(async (tx) => {
        const saved = await tx.payment.update({
          where: { id: paymentId! },
          data: { status: "AWAITING_PAYMENT", providerPaymentId: sessionId, reference: sessionId, expiresAt },
        });
        await tx.paymentAttempt.update({
          where: { id: attemptId! },
          data: { providerPaymentId: sessionId, status: "CREATED" },
        });
        await tx.order.update({
          where: { id: po.order!.id },
          data: { status: "AWAITING_PAYMENT", paymentMethod: method, inventoryReserved: true, inventoryReservationExpiresAt: expiresAt },
        });
        return saved;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
      return Response.json({ data: { payment: updated, checkoutUrl: sessionUrl, sessionId }, status: "AWAITING_PAYMENT" }, { status: 201 });
    }

    const result = method === "MULTICAIXA_REFERENCE"
      ? await multicaixaProvider.createReference({
          paymentId,
          orderNumber: po.order.orderNumber,
          amountKZ: Number(po.order.totalKZ),
          currency: "AOA",
          method,
          idempotencyKey: parsed.data.idempotencyKey,
        })
      : await multicaixaProvider.createExpress({
          paymentId,
          orderNumber: po.order.orderNumber,
          amountKZ: Number(po.order.totalKZ),
          currency: "AOA",
          method,
          phoneNumber: parsed.data.phoneNumber,
          idempotencyKey: parsed.data.idempotencyKey,
        });
    providerPaymentId = result.providerPaymentId;
    providerPaymentCreated = true;

    const isPaid = result.status === "PAID";
    const terminalFailure = ["FAILED", "EXPIRED", "CANCELLED"].includes(result.status);
    const nextStatus = isPaid ? "PAID" : terminalFailure ? result.status : "AWAITING_PAYMENT";
    const expiresAt = result.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.payment.update({
        where: { id: paymentId! },
        data: {
          status: nextStatus,
          providerPaymentId: result.providerPaymentId,
          entity: result.entity,
          referenceNumber: result.referenceNumber,
          expiresAt: result.expiresAt,
          phoneNumber: result.phoneNumber ?? null,
          paidAt: isPaid ? new Date() : null,
          failedAt: terminalFailure ? new Date() : null,
        },
      });
      await tx.paymentAttempt.update({
        where: { id: attemptId! },
        data: { providerPaymentId: result.providerPaymentId, status: result.status },
      });
      await tx.order.update({
        where: { id: po.order!.id },
        data: isPaid
          ? { status: "PAYMENT_CONFIRMED", inventoryReserved: false, inventoryReservationExpiresAt: null }
          : { status: terminalFailure ? "AWAITING_PAYMENT" : "AWAITING_PAYMENT", inventoryReserved: true, inventoryReservationExpiresAt: expiresAt },
      });
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });

    if (isPaid) {
      await prisma.order.update({ where: { id: po.order.id }, data: { status: "PAYMENT_CONFIRMED", inventoryReserved: false, inventoryReservationExpiresAt: null } });
      await createNotificationIfAllowed({
        userId: po.order.userId,
        channel: "orderUpdates",
        type: "ORDER_PAYMENT_CONFIRMED",
        title: "Pagamento confirmado",
        message: `O pagamento da encomenda empresarial ${po.order.orderNumber} foi confirmado.`,
        link: "/b2b/encomendas",
        dedupeKey: `order:${po.order.id}:payment:paid`,
      }).catch(() => undefined);
    } else if (terminalFailure) {
      await prisma.$transaction(async (tx) => {
        const cancelled = await cancelAwaitingPaymentAndReleaseStock(
          tx,
          po.order!.id,
          po.order!.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          result.status === "EXPIRED" ? "EXPIRED" : "FAILED",
          "Encomenda empresarial cancelada porque o gateway não iniciou o pagamento.",
        );
        if (cancelled) {
          await tx.purchaseOrder.updateMany({
            where: { id: po.id, orderId: po.order!.id },
            data: { status: "APPROVED", orderId: null },
          });
        }
      });
    }

    return Response.json({
      data: { payment: updated, checkoutUrl: null, idempotent: false },
    }, { status: 201 });
  } catch (error) {
    if (providerPaymentCreated && providerPaymentId) {
      if (method === "STRIPE_CHECKOUT") await expireStripeSession(providerPaymentId);
      else await multicaixaProvider.cancelPayment(providerPaymentId).catch(() => undefined);
    }
    logger.error("B2B payment initiation failed", {
      poId: po.id,
      orderId: po.order.id,
      method,
      error: error instanceof Error ? error.message : error,
    });

    if (attemptId) {
      await prisma.$transaction(async (tx) => {
        await tx.paymentAttempt.updateMany({
          where: { id: attemptId! },
          data: { status: "FAILED" },
        });
        const cancelled = await cancelAwaitingPaymentAndReleaseStock(
          tx,
          po.order!.id,
          po.order!.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          "FAILED",
          "Encomenda empresarial cancelada após erro na criação do pagamento.",
        );
        if (cancelled) {
          await tx.purchaseOrder.updateMany({
            where: { id: po.id, orderId: po.order!.id },
            data: { status: "APPROVED", orderId: null },
          });
        } else if (paymentId) {
          await tx.payment.updateMany({
            where: { id: paymentId, status: { not: "PAID" } },
            data: { status: "FAILED", failedAt: new Date() },
          });
        }
      }).catch((transactionError) => {
        logger.error("Unable to compensate failed B2B payment", {
          poId: po.id,
          orderId: po.order!.id,
          error: transactionError instanceof Error ? transactionError.message : transactionError,
        });
      });
    }
    if (error instanceof Error && error.message === "ALREADY_PAID") return errorResponse("A encomenda já está paga.", 409);
    if (error instanceof Error && error.message === "PAYMENT_ATTEMPT_IN_PROGRESS") return errorResponse("Já existe uma tentativa de pagamento em preparação. Atualize as encomendas antes de tentar novamente.", 409);
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") return errorResponse("A encomenda empresarial já não está disponível.", 409);
    if (error instanceof Error && error.message === "ORDER_CANCELLED") return errorResponse("A encomenda foi cancelada. Volte a converter o Purchase Order.", 409);
    if (error instanceof Error && error.message.startsWith("STOCK:")) return errorResponse(`Stock insuficiente: ${error.message.slice(6)}`, 409);
    if ((error as { code?: string })?.code === "P2034") return errorResponse("Outra tentativa alterou a reserva de stock. Atualize as encomendas e tente de novo.", 409);
    if (error instanceof Error && error.message === "MULTICAIXA_NOT_CONFIGURED") return errorResponse("Gateway MULTICAIXA não configurado.", 503);
    if (error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED") return errorResponse("Stripe não está configurado no ambiente.", 503);
    return errorResponse("Não foi possível iniciar o pagamento empresarial. Se a tentativa tiver criado uma sessão, atualize as encomendas antes de tentar de novo.", 502);
  }
}
