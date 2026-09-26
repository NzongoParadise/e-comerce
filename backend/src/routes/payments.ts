import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { multicaixaProvider } from '../payments/multicaixaProvider';

type AuthenticatedRequest = Request & { user?: { sub?: string } };
const router = Router();
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function rateLimit(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: () => void) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const current = requestWindows.get(key);
    const window = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    window.count += 1;
    requestWindows.set(key, window);
    if (window.count > limit) return res.status(429).json({ error: 'Demasiados pedidos. Tente novamente mais tarde.' });
    return next();
  };
}
const createSchema = z.object({
  orderId: z.number().int().positive(),
  method: z.enum(['MULTICAIXA_REFERENCE', 'MULTICAIXA_EXPRESS']),
  phoneNumber: z.string().regex(/^(?:\+244|244|0)?9\d{8}$/, 'Número de telemóvel angolano inválido').optional(),
  idempotencyKey: z.string().min(16).max(128),
});

function statusUpdates(status: string) {
  const now = new Date();
  return {
    status,
    ...(status === 'PAID' ? { paidAt: now } : {}),
    ...(['FAILED', 'EXPIRED', 'CANCELLED'].includes(status) ? { failedAt: now } : {}),
  };
}

router.post('/', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success || !req.user?.sub) return res.status(400).json({ error: 'Dados de pagamento inválidos' });
  if (parsed.data.method === 'MULTICAIXA_EXPRESS' && !parsed.data.phoneNumber) return res.status(400).json({ error: 'O telemóvel é obrigatório para MULTICAIXA Express' });
  const user = await prisma.user.findUnique({ where: { externalId: req.user.sub } });
  if (!user) return res.status(401).json({ error: 'User profile not found' });
  const order = await prisma.order.findFirst({ where: { id: parsed.data.orderId, userId: user.id }, include: { payment: true } });
  if (!order || !order.payment) return res.status(404).json({ error: 'Encomenda ou pagamento não encontrado' });
  if (order.country !== 'AO' || order.currency !== 'AOA') return res.status(400).json({ error: 'MULTICAIXA só está disponível para encomendas em Angola' });
  if (order.payment.status === 'PAID') return res.status(409).json({ error: 'A encomenda já está paga' });

  const existingAttempt = await prisma.paymentAttempt.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
  if (existingAttempt) {
    const payment = await prisma.payment.findUnique({ where: { id: existingAttempt.paymentId } });
    return res.json({ data: payment });
  }

  const attempt = await prisma.paymentAttempt.create({ data: { paymentId: order.payment.id, idempotencyKey: parsed.data.idempotencyKey, status: 'PROCESSING' } });
  try {
    const result = parsed.data.method === 'MULTICAIXA_REFERENCE'
      ? await multicaixaProvider.createReference({ paymentId: order.payment.id, orderNumber: order.orderNumber, amountKZ: Number(order.totalKZ), currency: 'AOA', method: parsed.data.method, phoneNumber: parsed.data.phoneNumber, idempotencyKey: parsed.data.idempotencyKey })
      : await multicaixaProvider.createExpress({ paymentId: order.payment.id, orderNumber: order.orderNumber, amountKZ: Number(order.totalKZ), currency: 'AOA', method: parsed.data.method, phoneNumber: parsed.data.phoneNumber, idempotencyKey: parsed.data.idempotencyKey });
    const payment = await prisma.payment.update({ where: { id: order.payment.id }, data: { provider: 'multicaixa', method: parsed.data.method, providerPaymentId: result.providerPaymentId, entity: result.entity, referenceNumber: result.referenceNumber, expiresAt: result.expiresAt, phoneNumber: result.phoneNumber, ...statusUpdates(result.status) } });
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { providerPaymentId: result.providerPaymentId, status: result.status } });
    return res.status(201).json({ data: payment });
  } catch (error) {
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: error instanceof Error && error.message === 'MULTICAIXA_NOT_CONFIGURED' ? 'PAYMENT_NOT_CONFIGURED' : 'FAILED' } });
    if (error instanceof Error && error.message === 'MULTICAIXA_NOT_CONFIGURED') return res.status(503).json({ error: 'Gateway MULTICAIXA não configurado' });
    console.error('MULTICAIXA payment error:', error);
    return res.status(502).json({ error: 'Não foi possível iniciar o pagamento MULTICAIXA' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.sub) return res.status(401).json({ error: 'Authentication required' });
  const payment = await prisma.payment.findFirst({ where: { id: Number(req.params.id), user: { externalId: req.user.sub } }, include: { order: true, attempts: { orderBy: { createdAt: 'desc' }, take: 1 } } });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  return res.json({ data: payment });
});

export async function handleMulticaixaWebhook(req: Request, res: Response) {
  if (!Buffer.isBuffer(req.body) || !multicaixaProvider.verifyWebhook(req.body, req.header('x-multicaixa-signature'))) return res.status(401).json({ error: 'Invalid webhook signature' });
  let event;
  try { event = multicaixaProvider.parseWebhook(req.body); } catch { return res.status(400).json({ error: 'Invalid webhook payload' }); }
  const payment = await prisma.payment.findUnique({ where: { providerPaymentId: event.providerPaymentId } });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (Number(payment.amountKZ) !== event.amountKZ || payment.currency !== event.currency) return res.status(422).json({ error: 'Payment amount or currency mismatch' });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.paymentEvent.create({ data: { paymentId: payment.id, providerEventId: event.providerEventId, eventType: event.type, status: event.status, amountKZ: event.amountKZ, currency: event.currency, payload: event.payload as Prisma.InputJsonValue, processedAt: new Date() } });
      await transaction.payment.update({ where: { id: payment.id }, data: statusUpdates(event.status) });
      if (event.status === 'PAID') await transaction.order.update({ where: { id: payment.orderId }, data: { status: 'PAYMENT_CONFIRMED' } });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) return res.json({ received: true, duplicate: true });
    throw error;
  }
  return res.json({ received: true });
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.header('stripe-signature');
  if (!secret || !signature || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'Invalid Stripe webhook configuration' });
  const timestamp = signature.match(/(?:^|,)t=(\d+)/)?.[1];
  const received = signature.match(/(?:^|,)v1=([^,]+)/)?.[1];
  if (!timestamp || !received) return res.status(400).json({ error: 'Invalid Stripe signature' });
  const signedPayload = `${timestamp}.${req.body.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) return res.status(401).json({ error: 'Invalid Stripe signature' });
  const event = JSON.parse(req.body.toString('utf8')) as { id?: string; type?: string; data?: { object?: { metadata?: { orderId?: string }; amount_total?: number; currency?: string } } };
  if (event.type !== 'checkout.session.completed') return res.json({ received: true });
  const orderId = Number(event.data?.object?.metadata?.orderId);
  const payment = await prisma.payment.findFirst({ where: { orderId, provider: 'stripe' } });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (event.data?.object?.currency && event.data.object.currency !== 'eur') return res.status(422).json({ error: 'Currency mismatch' });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.paymentEvent.create({ data: { paymentId: payment.id, providerEventId: String(event.id), eventType: String(event.type), status: 'PAID', amountKZ: payment.amountKZ, currency: payment.currency, payload: event as Prisma.InputJsonValue, processedAt: new Date() } });
      await transaction.payment.update({ where: { id: payment.id }, data: { ...statusUpdates('PAID') } });
      await transaction.order.update({ where: { id: orderId }, data: { status: 'PAYMENT_CONFIRMED' } });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) return res.json({ received: true, duplicate: true });
    throw error;
  }
  return res.json({ received: true });
}

export default router;
