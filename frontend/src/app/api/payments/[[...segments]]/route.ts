import crypto from 'node:crypto';
import { prisma } from '@/lib/server/prisma';
import { multicaixaProvider } from '@/lib/server/payments/multicaixaProvider';
import { authenticate, errorResponse, readJson, userSubject } from '@/lib/server/api';
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
    console.error('MULTICAIXA payment error:', error);
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
  if (!multicaixaProvider.verifyWebhook(rawBody, request.headers.get('x-multicaixa-signature') || undefined)) {
    return errorResponse('Invalid webhook signature', 401);
  }
  let event;
  try {
    event = multicaixaProvider.parseWebhook(rawBody);
  } catch {
    return errorResponse('Invalid webhook payload', 400);
  }
  const payment = await prisma.payment.findUnique({ where: { providerPaymentId: event.providerPaymentId } });
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
  return Response.json({ received: true });
}

async function handleStripeWebhook(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!secret || !signature) return errorResponse('Invalid Stripe webhook configuration', 400);
  const timestamp = signature.match(/(?:^|,)t=(\d+)/)?.[1];
  const received = signature.match(/(?:^|,)v1=([^,]+)/)?.[1];
  if (!timestamp || !received) return errorResponse('Invalid Stripe signature', 400);
  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) return errorResponse('Invalid Stripe signature', 401);
  const event = JSON.parse(rawBody.toString('utf8')) as { id?: string; type?: string; data?: { object?: { metadata?: { orderId?: string }; currency?: string } } };
  if (event.type !== 'checkout.session.completed') return Response.json({ received: true });
  const orderId = Number(event.data?.object?.metadata?.orderId);
  const payment = await prisma.payment.findFirst({ where: { orderId, provider: 'stripe' } });
  if (!payment) return errorResponse('Payment not found', 404);
  if (event.data?.object?.currency && event.data.object.currency !== 'eur') return errorResponse('Currency mismatch', 422);
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.paymentEvent.create({ data: {
        paymentId: payment.id,
        providerEventId: String(event.id),
        eventType: String(event.type),
        status: 'PAID',
        amountKZ: payment.amountKZ,
        currency: payment.currency,
        payload: event as never,
        processedAt: new Date(),
      } });
      await transaction.payment.update({ where: { id: payment.id }, data: statusUpdates('PAID') });
      await transaction.order.update({ where: { id: orderId }, data: { status: 'PAYMENT_CONFIRMED' } });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) return Response.json({ received: true, duplicate: true });
    throw error;
  }
  return Response.json({ received: true });
}