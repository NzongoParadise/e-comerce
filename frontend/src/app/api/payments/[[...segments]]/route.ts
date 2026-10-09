import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { cancelAwaitingPaymentAndReleaseStock } from '@/lib/server/orders/inventory';
import { multicaixaProvider } from '@/lib/server/payments/multicaixaProvider';
import { logger } from '@/lib/server/logger';
import { isStripeCurrencySupported, matchesStripePayment } from '@/lib/server/payments/stripeAmounts';
import { authenticate, errorResponse, readJson, userSubject } from '@/lib/server/api';
import { setStripeDefaultPaymentMethod } from '@/lib/server/payments/stripeCustomers';
import { createNotificationIfAllowed } from '@/lib/server/notifications';
import { issueInvoiceForPaidOrder } from '@/lib/server/finance/issueInvoiceForPaidOrder';
import { issueCreditNoteForSucceededRefund } from '@/lib/server/finance/issueCreditNoteForSucceededRefund';
import { z } from 'zod';

export const runtime = 'nodejs';

const requestWindows = new Map<string, { count: number; resetAt: number }>();
const createSchema = z.object({
  orderId: z.number().int().positive(),
  method: z.enum(['MULTICAIXA_REFERENCE', 'MULTICAIXA_EXPRESS']),
  phoneNumber: z.string().regex(/^(?:\+244|244|0)?9\d{8}$/, 'Número de telemóvel angolano inválido').optional(),
  idempotencyKey: z.string().min(16).max(128),
});

function segments(request: Request) {
  return new URL(request.url).pathname.split('/').filter(Boolean).slice(2);
}

function statusUpdates(status: string) {
  const now = new Date();
  return {
    status,
    ...(status === 'PAID' ? { paidAt: now } : {}),
    ...(['FAILED', 'EXPIRED', 'CANCELLED'].includes(status) ? { failedAt: now } : {}),
  };
}

function limited(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const key = `${forwardedFor}:${new URL(request.url).pathname}`;
  const now = Date.now();
  const current = requestWindows.get(key);
  const window = !current || current.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : current;
  window.count += 1;
  requestWindows.set(key, window);
  return window.count > 20;
}

export async function POST(request: Request) {
  const [action, nestedAction] = segments(request);
  if (action === 'webhook' && !nestedAction) return handleMulticaixaWebhook(request);
  if (action === 'stripe' && nestedAction === 'webhook') return handleStripeWebhook(request);
  if (action || nestedAction) return errorResponse('Not found', 404);
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse('Authentication required', 401);
  if (limited(request)) return errorResponse('Demasiados pedidos. Tente novamente mais tarde.', 429);

  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Dados de pagamento inválidos', 400);
  if (parsed.data.method === 'MULTICAIXA_EXPRESS' && !parsed.data.phoneNumber) return errorResponse('O telemóvel é obrigatório para MULTICAIXA Express', 400);
  const user = await prisma.user.findUnique({ where: { externalId: subject } });
  if (!user) return errorResponse('User profile not found', 401);
  const order = await prisma.order.findFirst({ where: { id: parsed.data.orderId, userId: user.id }, include: { payment: true, items: { select: { productId: true, quantity: true } } } });
  if (!order || !order.payment) return errorResponse('Encomenda ou pagamento não encontrado', 404);
  if (order.country !== 'AO' || order.currency !== 'AOA') return errorResponse('MULTICAIXA só está disponível para encomendas em Angola', 400);
  if (order.payment.status === 'PAID') return errorResponse('A encomenda já está paga', 409);

  const existingAttempt = await prisma.paymentAttempt.findUnique({
    where: { idempotencyKey: parsed.data.idempotencyKey },
    include: { payment: true },
  });
  if (existingAttempt) {
    if (existingAttempt.payment.orderId !== order.id || existingAttempt.payment.userId !== user.id) {
      return errorResponse("A chave de idempotência já está associada a outra encomenda.", 409);
    }
    return Response.json({ data: existingAttempt.payment, idempotent: true });
  }
  const attempt = await prisma.paymentAttempt.create({ data: { paymentId: order.payment.id, idempotencyKey: parsed.data.idempotencyKey, status: 'PROCESSING' } });
  try {
    const input = {
      paymentId: order.payment.id,
      orderNumber: order.orderNumber,
      amountKZ: Number(order.totalKZ),
      currency: 'AOA' as const,
      method: parsed.data.method,
      phoneNumber: parsed.data.phoneNumber,
      idempotencyKey: parsed.data.idempotencyKey,
    };
    const result = parsed.data.method === 'MULTICAIXA_REFERENCE'
      ? await multicaixaProvider.createReference(input)
      : await multicaixaProvider.createExpress(input);
    const terminalFailure = ["FAILED", "EXPIRED", "CANCELLED"].includes(result.status);
    const paymentStatus = result.status === "PAID" ? "PAID" : terminalFailure ? result.status : "AWAITING_PAYMENT";
    const reservationExpiresAt = result.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);
    const payment = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.payment.update({
        where: { id: order.payment!.id },
        data: {
          provider: "multicaixa",
          method: parsed.data.method,
          providerPaymentId: result.providerPaymentId,
          entity: result.entity,
          referenceNumber: result.referenceNumber,
          expiresAt: result.expiresAt ?? reservationExpiresAt,
          phoneNumber: result.phoneNumber,
          ...statusUpdates(paymentStatus),
        },
      });
      await transaction.paymentAttempt.update({
        where: { id: attempt.id },
        data: { providerPaymentId: result.providerPaymentId, status: result.status },
      });

      if (result.status === "PAID") {
        const confirmed = await transaction.order.updateMany({
          where: { id: order.id, status: "AWAITING_PAYMENT" },
          data: { status: "PAYMENT_CONFIRMED", inventoryReserved: false, inventoryReservationExpiresAt: null },
        });
        if (!confirmed.count && order.status === "CANCELLED") {
          await transaction.order.update({
            where: { id: order.id },
            data: { status: "PAYMENT_REVIEW_REQUIRED", inventoryReserved: false, inventoryReservationExpiresAt: null },
          });
        }
      } else if (terminalFailure) {
        await cancelAwaitingPaymentAndReleaseStock(
          transaction,
          order.id,
          order.items,
          result.status === "EXPIRED" ? "EXPIRED" : result.status === "CANCELLED" ? "CANCELLED" : "FAILED",
          "Encomenda cancelada após falha ao iniciar MULTICAIXA.",
        );
      } else {
        await transaction.order.updateMany({
          where: { id: order.id, status: "AWAITING_PAYMENT" },
          data: { inventoryReservationExpiresAt: reservationExpiresAt },
        });
      }
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    if (paymentStatus === "PAID") {
      await issueInvoiceForPaidOrder(order.id).catch((error) => logger.error("Invoice issuance after direct payment confirmation failed", {
        orderId: order.id,
        error: error instanceof Error ? error.message : error,
      }));
    }
    return Response.json({ data: payment }, { status: 201 });
  } catch (error) {
    await prisma.$transaction(async (transaction) => {
      await transaction.paymentAttempt.updateMany({
        where: { id: attempt.id },
        data: { status: error instanceof Error && error.message === "MULTICAIXA_NOT_CONFIGURED" ? "PAYMENT_NOT_CONFIGURED" : "FAILED" },
      });
      await cancelAwaitingPaymentAndReleaseStock(
        transaction,
        order.id,
        order.items,
        "FAILED",
        "Encomenda cancelada após erro ao iniciar o pagamento MULTICAIXA.",
      );
    }).catch((transactionError) => logger.error("Unable to release failed Multicaixa order reservation", {
      orderId: order.id,
      error: transactionError instanceof Error ? transactionError.message : transactionError,
    }));
    if (error instanceof Error && error.message === "MULTICAIXA_NOT_CONFIGURED") return errorResponse("Gateway MULTICAIXA não configurado", 503);
    logger.error("MULTICAIXA payment error", { orderId: order.id, paymentId: order.payment.id, method: parsed.data.method, error: error instanceof Error ? error.message : error });
    return errorResponse("Não foi possível iniciar o pagamento MULTICAIXA. A encomenda foi cancelada se a reserva de stock ainda estava ativa.", 502);
  }
}

export async function GET(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse('Authentication required', 401);
  const id = Number(segments(request)[0]);
  if (!Number.isInteger(id)) return errorResponse('Payment not found', 404);
  const payment = await prisma.payment.findFirst({
    where: { id, user: { externalId: subject } },
    include: { order: true, attempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!payment) return errorResponse('Payment not found', 404);
  return Response.json({ data: payment });
}

async function handleMulticaixaWebhook(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-multicaixa-signature") || undefined;
  if (!multicaixaProvider.verifyWebhook(rawBody, signature)) {
    logger.warn("Rejected Multicaixa webhook signature", { hasSignature: Boolean(signature) });
    return errorResponse("Invalid webhook signature", 401);
  }

  let event;
  try {
    event = multicaixaProvider.parseWebhook(rawBody);
  } catch (error) {
    logger.warn("Invalid Multicaixa webhook payload", { error: error instanceof Error ? error.message : error });
    return errorResponse("Invalid webhook payload", 400);
  }

  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId: event.providerPaymentId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          companyId: true,
          status: true,
          items: { select: { productId: true, quantity: true } },
        },
      },
    },
  });
  if (!payment) return errorResponse("Payment not found", 404);
  if (Number(payment.amountKZ) !== event.amountKZ || payment.currency !== event.currency) {
    logger.warn("Rejected Multicaixa webhook amount/currency mismatch", {
      paymentId: payment.id,
      orderId: payment.orderId,
      expectedAmount: Number(payment.amountKZ),
      receivedAmount: event.amountKZ,
      expectedCurrency: payment.currency,
      receivedCurrency: event.currency,
    });
    return errorResponse("Payment amount or currency mismatch", 422);
  }

  let outcome = "UPDATED";
  try {
    outcome = await prisma.$transaction(async (transaction) => {
      const latePaidAfterCancellation =
        event.status === "PAID" &&
        ["CANCELLED", "PAYMENT_REVIEW_REQUIRED"].includes(payment.order.status);

      await transaction.paymentEvent.create({
        data: {
          paymentId: payment.id,
          providerEventId: event.providerEventId,
          eventType: event.type,
          status: latePaidAfterCancellation ? "PAID_REVIEW_REQUIRED" : event.status,
          amountKZ: event.amountKZ,
          currency: event.currency,
          payload: event.payload as never,
          processedAt: new Date(),
        },
      });

      if (event.status === "PAID") {
        if (latePaidAfterCancellation) {
          await transaction.payment.update({
            where: { id: payment.id },
            data: { ...statusUpdates("PAID") },
          });
          if (payment.order.status === "CANCELLED") {
            await transaction.order.update({
              where: { id: payment.order.id },
              data: { status: "PAYMENT_REVIEW_REQUIRED", inventoryReserved: false, inventoryReservationExpiresAt: null },
            });
            await transaction.trackingEvent.create({
              data: {
                orderId: payment.order.id,
                status: "PAYMENT_REVIEW_REQUIRED",
                location: "Online",
                description: "Pagamento MULTICAIXA confirmado após cancelamento e libertação do stock. É necessária revisão manual antes do processamento.",
              },
            });
          }
          return "LATE_PAID_REVIEW";
        }

        await transaction.payment.update({
          where: { id: payment.id },
          data: { ...statusUpdates("PAID") },
        });
        const confirmed = await transaction.order.updateMany({
          where: { id: payment.order.id, status: { in: ["PENDING", "AWAITING_PAYMENT"] } },
          data: { status: "PAYMENT_CONFIRMED", inventoryReserved: false, inventoryReservationExpiresAt: null },
        });
        if (!confirmed.count && payment.order.status !== "PAYMENT_CONFIRMED" &&
            !["PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"].includes(payment.order.status)) {
          logger.error("Multicaixa reports paid order in an unexpected lifecycle state", {
            paymentId: payment.id,
            orderId: payment.order.id,
            orderStatus: payment.order.status,
          });
          return "PAID_REVIEW_REQUIRED";
        }
        return "PAID";
      }

      if (["FAILED", "EXPIRED", "CANCELLED"].includes(event.status)) {
        if (["PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "REFUNDED"].includes(payment.order.status)) {
          logger.warn("Ignoring late non-success Multicaixa event for an already paid/fulfilled order", {
            paymentId: payment.id,
            orderId: payment.order.id,
            eventStatus: event.status,
            orderStatus: payment.order.status,
          });
          return "LATE_FAILURE_IGNORED";
        }

        if (payment.order.status === "AWAITING_PAYMENT") {
          const released = await cancelAwaitingPaymentAndReleaseStock(
            transaction,
            payment.order.id,
            payment.order.items,
            event.status === "EXPIRED" ? "EXPIRED" : event.status === "CANCELLED" ? "CANCELLED" : "FAILED",
            event.status === "EXPIRED"
              ? "Encomenda cancelada após expiração do pagamento MULTICAIXA."
              : event.status === "CANCELLED"
                ? "Encomenda cancelada no gateway MULTICAIXA."
                : "Encomenda cancelada após falha do pagamento MULTICAIXA.",
          );

          if (released && payment.order.companyId) {
            await transaction.purchaseOrder.updateMany({
              where: { companyId: payment.order.companyId, orderId: payment.order.id, status: "CONVERTED" },
              data: { status: "APPROVED", orderId: null, approvedBy: null, approvedAt: null },
            });
          }
        } else {
          await transaction.payment.updateMany({
            where: { id: payment.id, status: { not: "PAID" } },
            data: statusUpdates(event.status),
          });
        }
        return "FAILED";
      }

      await transaction.payment.updateMany({
        where: { id: payment.id, status: { not: "PAID" } },
        data: statusUpdates(event.status),
      });
      return "UPDATED";
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      if (event.status === "PAID") {
        await issueInvoiceForPaidOrder(payment.order.id).catch((invoiceError) => logger.error("Invoice issuance retry after duplicate MULTICAIXA event failed", {
          orderId: payment.order.id,
          error: invoiceError instanceof Error ? invoiceError.message : invoiceError,
        }));
      }
      return Response.json({ received: true, duplicate: true });
    }
    throw error;
  }

  if (outcome === "LATE_PAID_REVIEW" || outcome === "PAID_REVIEW_REQUIRED") {
    logger.error("Multicaixa payment requires manual reconciliation", {
      paymentId: payment.id,
      orderId: payment.order.id,
      companyId: payment.order.companyId,
      providerPaymentId: event.providerPaymentId,
    });
    await createNotificationIfAllowed({
      userId: payment.order.userId,
      channel: "orderUpdates",
      type: "PAYMENT_REVIEW_REQUIRED",
      title: "Pagamento em verificação",
      message: `O pagamento da encomenda ${payment.order.orderNumber} foi recebido, mas o estado da encomenda requer revisão manual antes do processamento.`,
      link: payment.order.companyId ? "/b2b/encomendas" : `/account/orders/${payment.order.id}`,
      dedupeKey: `order:${payment.order.id}:payment:review-required`,
    }).catch((error) => logger.error("Unable to notify about payment review", { orderId: payment.order.id, error: error instanceof Error ? error.message : error }));
    return Response.json({ received: true, reviewRequired: true });
  }

  if (outcome === "PAID") {
    await createNotificationIfAllowed({
      userId: payment.order.userId,
      channel: "orderUpdates",
      type: "ORDER_PAYMENT_CONFIRMED",
      title: "Pagamento confirmado",
      message: `O pagamento da encomenda ${payment.order.orderNumber} foi confirmado.`,
      link: payment.order.companyId ? "/b2b/encomendas" : `/account/orders/${payment.order.id}`,
      dedupeKey: `order:${payment.order.id}:payment:paid`,
    }).catch((error) => logger.error("Unable to create Multicaixa payment notification", { orderId: payment.order.id, error: error instanceof Error ? error.message : error }));
    await issueInvoiceForPaidOrder(payment.order.id).catch((error) => logger.error("Invoice issuance after MULTICAIXA confirmation failed", {
      orderId: payment.order.id,
      error: error instanceof Error ? error.message : error,
    }));
  } else if (outcome === "FAILED") {
    await createNotificationIfAllowed({
      userId: payment.order.userId,
      channel: "orderUpdates",
      type: "ORDER_PAYMENT_FAILED",
      title: "Pagamento não concluído",
      message: `O pagamento da encomenda ${payment.order.orderNumber} não foi concluído. Se for uma compra empresarial, volte às encomendas para gerar uma nova tentativa.`,
      link: payment.order.companyId ? "/b2b/encomendas" : `/account/orders/${payment.order.id}`,
      dedupeKey: `order:${payment.order.id}:payment:failed`,
    }).catch((error) => logger.error("Unable to create Multicaixa payment failure notification", { orderId: payment.order.id, error: error instanceof Error ? error.message : error }));
  }

  return Response.json({ received: true });
}

async function handleStripeWebhook(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!secret || !signature) {
    logger.warn('Stripe webhook misconfigured', { hasSecret: Boolean(secret), hasSignature: Boolean(signature) });
    return errorResponse('Invalid Stripe webhook configuration', 400);
  }
  const timestamp = signature.match(/(?:^|,)t=(\d+)/)?.[1];
  const received = signature.match(/(?:^|,)v1=([^,]+)/)?.[1];
  if (!timestamp || !received || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    logger.warn('Rejected Stripe webhook signature: invalid timestamp or payload', { hasTimestamp: Boolean(timestamp), hasSignature: Boolean(received) });
    return errorResponse('Invalid Stripe signature', 400);
  }
  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    logger.warn('Rejected Stripe webhook signature: hash mismatch');
    return errorResponse('Invalid Stripe signature', 401);
  }
  let event: {
    id?: unknown;
    type?: unknown;
    data?: { object?: { id?: unknown; customer?: unknown; payment_method?: unknown; metadata?: { orderId?: unknown; userId?: unknown; label?: unknown; isDefault?: unknown }; currency?: unknown; amount_total?: unknown; payment_status?: unknown; status?: unknown } };
  };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    logger.warn('Invalid Stripe webhook payload', { error: error instanceof Error ? error.message : error });
    return errorResponse('Invalid Stripe webhook payload', 400);
  }
  const eventType = String(event.type);
  logger.info('Received Stripe webhook', { eventType, orderId: Number(event.data?.object?.metadata?.orderId) || null, sessionId: event.data?.object?.id || null });
  if (eventType === 'setup_intent.succeeded') {
    const intent = event.data?.object;
    if (!intent) return errorResponse('Invalid Stripe setup intent', 400);
    const userId = Number(intent?.metadata?.userId);
    const customerId = intent?.customer;
    const paymentMethodId = intent?.payment_method;
    if (!Number.isSafeInteger(userId) || typeof customerId !== 'string' || typeof paymentMethodId !== 'string' || typeof event.id !== 'string') {
      return errorResponse('Invalid Stripe setup intent', 400);
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    if (!user?.stripeCustomerId || user.stripeCustomerId !== customerId) return errorResponse('Stripe customer mismatch', 422);
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return errorResponse('Stripe is not configured', 503);
    const methodResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${encodeURIComponent(paymentMethodId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const method = await methodResponse.json() as { id?: unknown; customer?: unknown; type?: unknown; card?: { brand?: unknown; last4?: unknown } };
    const lastFour = method.card?.last4;
    if (!methodResponse.ok || method.id !== paymentMethodId || method.customer !== customerId || method.type !== 'card' || typeof lastFour !== 'string') {
      return errorResponse('Stripe payment method is invalid', 422);
    }
    const existing = await prisma.savedPaymentMethod.findFirst({ where: { userId, providerToken: paymentMethodId } });
    const hasDefault = await prisma.savedPaymentMethod.findFirst({ where: { userId, isDefault: true } });
    const makeDefault = intent.metadata?.isDefault === 'true' || !hasDefault;
    if (makeDefault) await setStripeDefaultPaymentMethod(customerId, paymentMethodId);
    const cardBrand = typeof method.card?.brand === 'string' ? method.card.brand.toUpperCase() : 'CARTÃO';
    const label = typeof intent.metadata?.label === 'string' && intent.metadata.label.trim()
      ? intent.metadata.label.trim().slice(0, 80)
      : `${cardBrand} terminado em ${lastFour}`;
    await prisma.$transaction(async (transaction) => {
      if (makeDefault) await transaction.savedPaymentMethod.updateMany({ where: { userId }, data: { isDefault: false } });
      if (existing) {
        await transaction.savedPaymentMethod.update({ where: { id: existing.id }, data: { label, type: 'CARD', lastFour, isDefault: makeDefault } });
      } else {
        await transaction.savedPaymentMethod.create({ data: {
          userId,
          type: 'CARD',
          label,
          lastFour,
          providerToken: paymentMethodId,
          isDefault: makeDefault,
        } });
      }
    });
    return Response.json({ received: true });
  }
  if (['refund.created', 'refund.updated'].includes(eventType)) {
    const refundEvent = event.data?.object as Record<string, unknown> | undefined;
    const refundId = typeof refundEvent?.id === 'string' ? refundEvent.id : null;
    const metadata = refundEvent?.metadata as Record<string, unknown> | undefined;
    const internalRefundId = Number(metadata?.refundId);
    if (!refundId || !Number.isSafeInteger(internalRefundId)) return errorResponse('Invalid Stripe refund event', 400);

    const refund = await prisma.refund.findUnique({
      where: { id: internalRefundId },
      include: { payment: true },
    });
    if (!refund || refund.provider !== 'stripe') return errorResponse('Refund not found', 404);

    const stripeStatus = String(refundEvent?.status || '');
    const nextStatus = stripeStatus === 'succeeded'
      ? 'SUCCEEDED'
      : stripeStatus === 'failed' || stripeStatus === 'canceled'
        ? 'FAILED'
        : 'PROCESSING';

    const completedReturn = await prisma.$transaction(async (transaction) => {
      let completion: { id: number; requestNumber: string; userId: number; orderNumber: string } | null = null;
      await transaction.paymentEvent.create({
        data: {
          paymentId: refund.paymentId,
          providerEventId: event.id as string,
          eventType,
          status: `REFUND_${nextStatus}`,
          amountKZ: refund.payment.amountKZ,
          currency: refund.payment.currency,
          payload: event as never,
          processedAt: new Date(),
        },
      }).catch((error) => {
        if (!(error instanceof Error) || !error.message.includes('Unique constraint')) throw error;
      });

      const updated = await transaction.refund.update({
        where: { id: refund.id },
        data: {
          providerRefundId: refundId,
          status: nextStatus,
          failureReason: nextStatus === 'FAILED' ? String(refundEvent?.failure_reason || 'Stripe recusou o reembolso.') : null,
          processedAt: nextStatus === 'SUCCEEDED' ? new Date() : null,
        },
      });

      if (nextStatus === 'SUCCEEDED') {
        const totals = await transaction.refund.aggregate({
          where: { paymentId: refund.paymentId, status: 'SUCCEEDED' },
          _sum: { amountEUR: true, amountKZ: true },
        });
        const refundedTotal = refund.payment.currency === 'EUR'
          ? Number(totals._sum.amountEUR || 0)
          : Number(totals._sum.amountKZ || 0);
        const originalTotal = refund.payment.currency === 'EUR'
          ? Number(refund.payment.amountEUR)
          : Number(refund.payment.amountKZ);
        await transaction.order.update({
          where: { id: refund.orderId },
          data: { status: refundedTotal + 0.000001 >= originalTotal ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
        });

        if (refund.returnRequestId) {
          const returnRequest = await transaction.returnRequest.findUnique({
            where: { id: refund.returnRequestId },
            include: {
              user: { select: { id: true } },
              order: { select: { orderNumber: true } },
            },
          });
          if (
            returnRequest &&
            returnRequest.type === 'RETURN' &&
            returnRequest.orderId === refund.orderId &&
            returnRequest.status === 'REFUND_PROCESSING'
          ) {
            const completed = await transaction.returnRequest.update({
              where: { id: returnRequest.id },
              data: { status: 'COMPLETED' },
            });
            await transaction.returnRequestEvent.create({
              data: {
                returnRequestId: completed.id,
                previousStatus: 'REFUND_PROCESSING',
                nextStatus: 'COMPLETED',
                actorExternalId: 'SYSTEM_STRIPE_WEBHOOK',
                note: 'Stripe confirmou o reembolso ' + refundId + '.',
              },
            });
            completion = {
              id: completed.id,
              requestNumber: completed.requestNumber,
              userId: returnRequest.user.id,
              orderNumber: returnRequest.order.orderNumber,
            };
          }
        }
      }

      if (updated.status === 'SUCCEEDED') {
        await createNotificationIfAllowed({
          userId: refund.userId,
          channel: 'orderUpdates',
          type: 'REFUND_PROCESSED',
          title: 'Reembolso processado',
          message: `O reembolso da encomenda foi confirmado pelo Stripe.`,
          link: `/account/orders/${refund.orderId}`,
          dedupeKey: `refund:${refund.id}:stripe-succeeded`,
        }).catch(() => undefined);
      }
      return completion;
    });

    if (completedReturn) {
      await createNotificationIfAllowed({
        userId: completedReturn.userId,
        channel: 'orderUpdates',
        type: 'RETURN_STATUS_CHANGED',
        title: 'Devolução concluída',
        message: 'A solicitação ' + completedReturn.requestNumber + ' da encomenda ' + completedReturn.orderNumber + ' foi concluída após confirmação do reembolso.',
        link: '/account/returns',
        dedupeKey: 'return:' + completedReturn.id + ':status:COMPLETED',
      }).catch(() => undefined);
    }

    if (nextStatus === 'SUCCEEDED') {
      await issueCreditNoteForSucceededRefund(internalRefundId, 'SYSTEM_STRIPE_WEBHOOK');
    }

    return Response.json({ received: true });
  }

  const successEvent = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(eventType);
  const failedEvent = ['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(eventType);
  if (!successEvent && !failedEvent) return Response.json({ received: true });
  const session = event.data?.object;
  const orderId = Number(session?.metadata?.orderId);
  if (!Number.isSafeInteger(orderId) || typeof session?.id !== 'string' || typeof event.id !== 'string') return errorResponse('Invalid Stripe checkout session', 400);
  const sessionId = session.id;
  const payment = await prisma.payment.findFirst({
    where: { orderId, provider: 'stripe' },
    include: { order: { select: { userId: true, orderNumber: true, companyId: true, items: { select: { productId: true, quantity: true } } } } },
  });
  if (!payment) return errorResponse('Payment not found', 404);
  if (!isStripeCurrencySupported(payment.currency)) return errorResponse('Stripe payment currency is not supported', 422);
  const expectedAmount = Number(payment.amountEUR);
  if (payment.reference && payment.reference !== sessionId) return errorResponse('Checkout session mismatch', 422);
  if (!matchesStripePayment(session.amount_total, session.currency, expectedAmount, payment.currency)) return errorResponse('Payment amount or currency mismatch', 422);
  if (failedEvent) {
    if (eventType === 'checkout.session.expired' && session.status !== 'expired') return errorResponse('Invalid expired checkout session', 422);
    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.paymentEvent.create({ data: {
          paymentId: payment.id,
          providerEventId: event.id as string,
          eventType,
          status: eventType === 'checkout.session.expired' ? 'EXPIRED' : 'FAILED',
          amountKZ: payment.amountKZ,
          currency: payment.currency,
          payload: event as never,
          processedAt: new Date(),
        } });
        const released = await cancelAwaitingPaymentAndReleaseStock(
          transaction,
          payment.orderId,
          payment.order.items,
          eventType === 'checkout.session.expired' ? 'EXPIRED' : 'FAILED',
          eventType === 'checkout.session.expired'
            ? 'Encomenda cancelada após expiração da sessão de pagamento Stripe.'
            : 'Encomenda cancelada após falha do pagamento Stripe.',
        );
        if (released && payment.order.companyId) {
          await transaction.purchaseOrder.updateMany({
            where: { companyId: payment.order.companyId, orderId: payment.orderId, status: 'CONVERTED' },
            data: { status: 'APPROVED', orderId: null, approvedBy: null, approvedAt: null },
          });
        }
        await transaction.payment.updateMany({
          where: { id: payment.id, status: { not: 'PAID' } },
          data: { reference: sessionId },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) return Response.json({ received: true, duplicate: true });
      throw error;
    }
    await createNotificationIfAllowed({
      userId: payment.order.userId,
      channel: 'orderUpdates',
      type: 'ORDER_PAYMENT_FAILED',
      title: 'Pagamento não concluído',
      message: `O pagamento da encomenda ${payment.order.orderNumber} não foi concluído. A encomenda foi cancelada.`,
      link: payment.order.companyId ? "/b2b/encomendas" : `/account/orders/${orderId}`,
      dedupeKey: `order:${orderId}:payment:failed`,
    }).catch((error) => console.error('Unable to create Stripe payment failure notification:', error));
    await createNotificationIfAllowed({
      userId: payment.order.userId,
      channel: 'orderUpdates',
      type: 'ORDER_CANCELLED',
      title: 'Encomenda cancelada',
      message: `A encomenda ${payment.order.orderNumber} foi cancelada após falha ou expiração do pagamento.`,
      link: `/account/orders/${orderId}`,
      dedupeKey: `order:${orderId}:status:CANCELLED`,
    }).catch((error) => console.error('Unable to create Stripe cancellation notification:', error));
    return Response.json({ received: true });
  }
  if (session.payment_status !== 'paid') return Response.json({ received: true, pending: true });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.paymentEvent.create({ data: {
        paymentId: payment.id,
        providerEventId: event.id as string,
        eventType: event.type as string,
        status: 'PAID',
        amountKZ: payment.amountKZ,
        currency: payment.currency,
        payload: event as never,
        processedAt: new Date(),
      } });
      const awaitingOrder = await transaction.order.updateMany({
        where: { id: orderId, status: 'AWAITING_PAYMENT' },
        data: { status: 'PAYMENT_CONFIRMED', inventoryReserved: false, inventoryReservationExpiresAt: null },
      });
      if (!awaitingOrder.count) {
        const cancelledOrder = await transaction.order.updateMany({
          where: { id: orderId, status: 'CANCELLED' },
          data: { status: 'PAYMENT_REVIEW_REQUIRED', inventoryReserved: false, inventoryReservationExpiresAt: null },
        });
        if (cancelledOrder.count) {
          await transaction.trackingEvent.create({ data: {
            orderId,
            status: 'PAYMENT_REVIEW_REQUIRED',
            location: 'Online',
            description: 'Pagamento Stripe confirmado após cancelamento e libertação do stock. Revisão manual necessária antes do processamento.',
          } });
        }
      }
      await transaction.payment.update({ where: { id: payment.id }, data: { ...statusUpdates('PAID'), reference: sessionId } });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      if (successEvent && session.payment_status === 'paid') {
        await issueInvoiceForPaidOrder(orderId).catch((invoiceError) => logger.error("Invoice issuance retry after duplicate Stripe event failed", {
          orderId,
          error: invoiceError instanceof Error ? invoiceError.message : invoiceError,
        }));
      }
      return Response.json({ received: true, duplicate: true });
    }
    throw error;
  }
  if (successEvent && session.payment_status === 'paid') {
    await issueInvoiceForPaidOrder(orderId).catch((error) => logger.error("Invoice issuance after Stripe confirmation failed", {
      orderId,
      error: error instanceof Error ? error.message : error,
    }));
  }
  return Response.json({ received: true });
}
