import crypto from 'node:crypto';
import { prisma } from '@/lib/server/prisma';
import { cancelAwaitingPaymentAndReleaseStock } from '@/lib/server/orders/inventory';
import { multicaixaProvider } from '@/lib/server/payments/multicaixaProvider';
import { logger } from '@/lib/server/logger';
import { isStripeCurrencySupported, matchesStripePayment } from '@/lib/server/payments/stripeAmounts';
import { authenticate, errorResponse, readJson, userSubject } from '@/lib/server/api';
import { setStripeDefaultPaymentMethod } from '@/lib/server/payments/stripeCustomers';
import { createNotificationIfAllowed } from '@/lib/server/notifications';
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
  const order = await prisma.order.findFirst({ where: { id: parsed.data.orderId, userId: user.id }, include: { payment: true } });
  if (!order || !order.payment) return errorResponse('Encomenda ou pagamento não encontrado', 404);
  if (order.country !== 'AO' || order.currency !== 'AOA') return errorResponse('MULTICAIXA só está disponível para encomendas em Angola', 400);
  if (order.payment.status === 'PAID') return errorResponse('A encomenda já está paga', 409);

  const existingAttempt = await prisma.paymentAttempt.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
  if (existingAttempt) {
    const payment = await prisma.payment.findUnique({ where: { id: existingAttempt.paymentId } });
    return Response.json({ data: payment });
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
    const payment = await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        provider: 'multicaixa',
        method: parsed.data.method,
        providerPaymentId: result.providerPaymentId,
        entity: result.entity,
        referenceNumber: result.referenceNumber,
        expiresAt: result.expiresAt,
        phoneNumber: result.phoneNumber,
        ...statusUpdates(result.status),
      },
    });
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { providerPaymentId: result.providerPaymentId, status: result.status } });
    return Response.json({ data: payment }, { status: 201 });
  } catch (error) {
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: error instanceof Error && error.message === 'MULTICAIXA_NOT_CONFIGURED' ? 'PAYMENT_NOT_CONFIGURED' : 'FAILED' } });
    if (error instanceof Error && error.message === 'MULTICAIXA_NOT_CONFIGURED') return errorResponse('Gateway MULTICAIXA não configurado', 503);
    logger.error('MULTICAIXA payment error', { orderId: order.id, paymentId: order.payment.id, method: parsed.data.method, error: error instanceof Error ? error.message : error });
    return errorResponse('Não foi possível iniciar o pagamento MULTICAIXA', 502);
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
  const signature = request.headers.get('x-multicaixa-signature') || undefined;
  if (!multicaixaProvider.verifyWebhook(rawBody, signature)) {
    logger.warn('Rejected Multicaixa webhook signature', { hasSignature: Boolean(signature) });
    return errorResponse('Invalid webhook signature', 401);
  }
  let event;
  try {
    event = multicaixaProvider.parseWebhook(rawBody);
  } catch (error) {
    logger.warn('Invalid Multicaixa webhook payload', { error: error instanceof Error ? error.message : error });
    return errorResponse('Invalid webhook payload', 400);
  }
  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId: event.providerPaymentId },
    include: { order: { select: { id: true, orderNumber: true, userId: true } } },
  });
  if (!payment) return errorResponse('Payment not found', 404);
  if (Number(payment.amountKZ) !== event.amountKZ || payment.currency !== event.currency) return errorResponse('Payment amount or currency mismatch', 422);
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.paymentEvent.create({ data: {
        paymentId: payment.id,
        providerEventId: event.providerEventId,
        eventType: event.type,
        status: event.status,
        amountKZ: event.amountKZ,
        currency: event.currency,
        payload: event.payload as never,
        processedAt: new Date(),
      } });
      await transaction.payment.update({ where: { id: payment.id }, data: statusUpdates(event.status) });
      if (event.status === 'PAID') await transaction.order.update({ where: { id: payment.orderId }, data: { status: 'PAYMENT_CONFIRMED' } });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) return Response.json({ received: true, duplicate: true });
    throw error;
  }
  const lifecycle = event.status === 'PAID'
    ? { type: 'ORDER_PAYMENT_CONFIRMED', title: 'Pagamento confirmado', message: `O pagamento da encomenda ${payment.order.orderNumber} foi confirmado.` }
    : ['FAILED', 'EXPIRED', 'CANCELLED'].includes(event.status)
      ? { type: 'ORDER_PAYMENT_FAILED', title: 'Pagamento não concluído', message: `O pagamento da encomenda ${payment.order.orderNumber} não foi concluído.` }
      : null;
  if (lifecycle) {
    await createNotificationIfAllowed({ userId: payment.order.userId, channel: 'orderUpdates', ...lifecycle, link: `/account/orders/${payment.order.id}`, dedupeKey: `order:${payment.order.id}:payment:${event.status}` })
      .catch((error) => console.error('Unable to create Multicaixa payment notification:', error));
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
  const successEvent = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(eventType);
  const failedEvent = ['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(eventType);
  if (!successEvent && !failedEvent) return Response.json({ received: true });
  const session = event.data?.object;
  const orderId = Number(session?.metadata?.orderId);
  if (!Number.isSafeInteger(orderId) || typeof session?.id !== 'string' || typeof event.id !== 'string') return errorResponse('Invalid Stripe checkout session', 400);
  const sessionId = session.id;
  const payment = await prisma.payment.findFirst({
    where: { orderId, provider: 'stripe' },
    include: { order: { select: { items: { select: { productId: true, quantity: true } } } } },
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
        await cancelAwaitingPaymentAndReleaseStock(
          transaction,
          payment.orderId,
          payment.order.items,
          eventType === 'checkout.session.expired' ? 'EXPIRED' : 'FAILED',
          eventType === 'checkout.session.expired'
            ? 'Encomenda cancelada após expiração da sessão de pagamento Stripe.'
            : 'Encomenda cancelada após falha do pagamento Stripe.',
        );
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
      link: `/account/orders/${orderId}`,
      dedupeKey: `order:${orderId}:payment:failed`,
    }).catch((error) => console.error('Unable to create Stripe payment failure notification:', error));
    await createNotificationIfAllowed({
      userId: payment.userId,
      channel: 'orderUpdates',
      type: 'ORDER_CANCELLED',
      title: 'Encomenda cancelada',
      message: `A encomenda ${payment.orderNumber ?? orderId} foi cancelada após falha ou expiração do pagamento.`,
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
        data: { status: 'PAYMENT_CONFIRMED' },
      });
      if (!awaitingOrder.count) {
        const cancelledOrder = await transaction.order.updateMany({
          where: { id: orderId, status: 'CANCELLED' },
          data: { status: 'PAYMENT_REVIEW_REQUIRED' },
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
    if (error instanceof Error && error.message.includes('Unique constraint')) return Response.json({ received: true, duplicate: true });
    throw error;
  }
  return Response.json({ received: true });
}