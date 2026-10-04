import crypto from 'node:crypto';
import { prisma } from '@/lib/server/prisma';
import { logger } from '@/lib/server/logger';

const STRIPE_API = 'https://api.stripe.com/v1';
const WEBHOOK_TOLERANCE_SECONDS = 300;

export type StripeObject = Record<string, unknown>;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_NOT_CONFIGURED');
  return key;
}

export async function stripeRequest<T extends StripeObject = StripeObject>(
  path: string,
  options: { method?: 'GET' | 'POST'; params?: URLSearchParams; idempotencyKey?: string } = {},
): Promise<T> {
  const response = await fetch(`${STRIPE_API}/${path.replace(/^\//, '')}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(options.method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    ...(options.method === 'POST' ? { body: options.params } : {}),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({})) as StripeObject;
  if (!response.ok) {
    logger.warn('Stripe API request failed', { path, status: response.status, code: body.code, type: body.type });
    throw new Error(`STRIPE_API_ERROR:${response.status}`);
  }
  return body as T;
}

export function verifyStripeWebhookSignature(rawBody: string, signature: string | null, secret = process.env.STRIPE_WEBHOOK_SECRET) {
  if (!signature || !secret) return false;
  const parts = new Map<string, string>();
  for (const item of signature.split(',')) {
    const [key, value] = item.split('=', 2);
    if (key && value) parts.set(key, value);
  }
  const timestamp = Number(parts.get('t'));
  const received = parts.get('v1');
  if (!Number.isSafeInteger(timestamp) || !received || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  } catch {
    return false;
  }
}

export function toMinorUnit(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Invalid amount');
  return Math.round(amount * 100);
}

export function currencyMinorAmount(order: { currency: string; totalEUR: unknown; totalKZ: unknown }) {
  return order.currency === 'EUR' ? toMinorUnit(Number(order.totalEUR)) : toMinorUnit(Number(order.totalKZ));
}

export function stripePaymentIdempotencyKey(orderId: number) {
  return `payment-intent-order-${orderId}`;
}

export async function createPaymentIntentForOrder(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true, user: true } });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.currency !== 'EUR') throw new Error('STRIPE_CURRENCY_UNSUPPORTED');
  const amount = currencyMinorAmount(order);
  if (amount <= 0) throw new Error('INVALID_PAYMENT_AMOUNT');
  const existing = order.payment?.stripePaymentIntentId;
  if (existing) return existing;

  const params = new URLSearchParams({
    amount: String(amount),
    currency: 'eur',
    'metadata[orderId]': String(order.id),
    'metadata[orderNumber]': order.orderNumber,
    'metadata[userId]': String(order.userId),
    'metadata[environment]': process.env.NODE_ENV === 'production' ? 'live' : 'test',
    'automatic_payment_methods[enabled]': 'true',
  });
  if (order.user.stripeCustomerId) params.set('customer', order.user.stripeCustomerId);
  const intent = await stripeRequest<{ id: string }>('payment_intents', {
    method: 'POST',
    params,
    idempotencyKey: stripePaymentIdempotencyKey(order.id),
  });
  await prisma.payment.update({
    where: { orderId: order.id },
    data: {
      provider: 'stripe',
      method: 'card',
      status: 'REQUIRES_PAYMENT',
      stripePaymentIntentId: intent.id,
      providerPaymentId: intent.id,
      grossAmount: amount,
      currency: 'EUR',
    },
  });
  return intent.id;
}

function objectId(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function objectNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function objectString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

export async function syncChargeFinancials(paymentId: number, charge: StripeObject) {
  const chargeId = objectId(charge.id);
  const paymentIntentId = objectId(charge.payment_intent);
  const balanceTransactionId = objectId(charge.balance_transaction);
  let fee: number | null = null;
  let net: number | null = null;
  if (balanceTransactionId) {
    const balance = await stripeRequest<StripeObject>(`balance_transactions/${encodeURIComponent(balanceTransactionId)}`);
    fee = objectNumber(balance.fee);
    net = objectNumber(balance.net);
  }
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      ...(chargeId ? { stripeChargeId: chargeId } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId, providerPaymentId: paymentIntentId } : {}),
      ...(objectNumber(charge.amount) !== null ? { grossAmount: objectNumber(charge.amount) } : {}),
      ...(fee !== null ? { stripeFee: fee } : {}),
      ...(net !== null ? { netAmount: net } : {}),
    },
  });
}

export async function createStripeRefund(paymentId: number, amount?: number, reason?: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { refunds: true, order: true } });
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.provider !== 'stripe' || !payment.stripePaymentIntentId) throw new Error('STRIPE_PAYMENT_NOT_FOUND');
  const gross = payment.grossAmount ?? currencyMinorAmount(payment.order);
  const refunded = payment.refunds.filter((item) => item.status !== 'failed' && item.status !== 'canceled').reduce((sum, item) => sum + item.amount, 0);
  const available = Math.max(0, gross - refunded);
  const refundAmount = amount ?? available;
  if (!Number.isSafeInteger(refundAmount) || refundAmount <= 0) throw new Error('INVALID_REFUND_AMOUNT');
  if (refundAmount > available) throw new Error('REFUND_EXCEEDS_AVAILABLE');

  const params = new URLSearchParams({ payment_intent: payment.stripePaymentIntentId, amount: String(refundAmount) });
  if (reason) params.set('reason', reason);
  const refund = await stripeRequest<{ id: string; amount: number; currency: string; status: string; reason?: string; failure_reason?: string }>('refunds', {
    method: 'POST',
    params,
    idempotencyKey: `refund-payment-${payment.id}-${refundAmount}-${refunded}`,
  });
  await prisma.stripeRefund.upsert({
    where: { stripeRefundId: refund.id },
    create: {
      paymentId,
      stripeRefundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      reason: refund.reason || reason || null,
      status: refund.status,
      failureReason: refund.failure_reason || null,
    },
    update: {
      status: refund.status,
      failureReason: refund.failure_reason || null,
    },
  });
  return refund;
}

export async function processStripeWebhookEvent(event: StripeObject) {
  const eventId = objectId(event.id);
  const type = objectString(event.type);
  const data = event.data as StripeObject | undefined;
  const object = data?.object as StripeObject | undefined;
  if (!eventId || !type || !object) throw new Error('INVALID_STRIPE_EVENT');

  const duplicate = await prisma.paymentEvent.findUnique({ where: { providerEventId: eventId } });
  if (duplicate) return { duplicate: true };

  const metadata = (object.metadata as StripeObject | undefined) || {};
  const orderIdFromMetadata = Number(metadata.orderId);
  const paymentIntentId = objectId(object.payment_intent) || (type.startsWith('payment_intent.') ? objectId(object.id) : null);
  const sessionPaymentIntent = type.startsWith('checkout.session.') ? objectId(object.payment_intent) : null;
  const effectiveIntentId = paymentIntentId || sessionPaymentIntent;
  const payment = effectiveIntentId
    ? await prisma.payment.findFirst({ where: { stripePaymentIntentId: effectiveIntentId } })
    : Number.isSafeInteger(orderIdFromMetadata) && orderIdFromMetadata > 0
      ? await prisma.payment.findUnique({ where: { orderId: orderIdFromMetadata } })
      : null;

  if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
    const sessionId = objectId(object.id);
    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          reference: sessionId || payment.reference,
          ...(effectiveIntentId ? { stripePaymentIntentId: effectiveIntentId, providerPaymentId: effectiveIntentId } : {}),
        },
      });
    }
  }

  if (payment) {
    const amount = objectNumber(object.amount_received) ?? objectNumber(object.amount) ?? objectNumber(object.amount_total);
    const currency = objectString(object.currency);
    const baseEvent = {
      paymentId: payment.id,
      providerEventId: eventId,
      eventType: type,
      status: type,
      amountKZ: currency === 'aoa' && amount !== null ? amount / 100 : null,
      currency,
      payload: event,
      processedAt: new Date(),
    };

    await prisma.$transaction(async (transaction) => {
      await transaction.paymentEvent.create({ data: baseEvent });
      if (type === 'payment_intent.succeeded' || type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
        await transaction.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            failedAt: null,
            ...(effectiveIntentId ? { stripePaymentIntentId: effectiveIntentId, providerPaymentId: effectiveIntentId } : {}),
            ...(amount !== null ? { grossAmount: amount } : {}),
            ...(currency ? { currency: currency.toUpperCase() } : {}),
          },
        });
        await transaction.order.updateMany({
          where: { id: payment.orderId, status: { notIn: ['CANCELLED', 'DELIVERED', 'SHIPPED'] } },
          data: { status: 'PAYMENT_CONFIRMED' },
        });
      } else if (type === 'payment_intent.payment_failed') {
        await transaction.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureCode: objectString((object.last_payment_error as StripeObject | undefined)?.code),
            failureMessage: objectString((object.last_payment_error as StripeObject | undefined)?.message),
          },
        });
      } else if (type === 'payment_intent.canceled') {
        await transaction.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED', failedAt: new Date() } });
      } else if (type === 'charge.refunded' || type === 'refund.updated' || type === 'refund.created' || type === 'refund.failed') {
        const refund = type.startsWith('refund.') ? object : ((object.refunds as StripeObject | undefined)?.data as unknown as StripeObject | undefined);
        const refundId = objectId(refund?.id);
        if (refundId) {
          const refundAmount = objectNumber(refund.amount) ?? amount ?? 0;
          await transaction.stripeRefund.upsert({
            where: { stripeRefundId: refundId },
            create: {
              paymentId: payment.id,
              stripeRefundId: refundId,
              amount: refundAmount,
              currency: objectString(refund.currency) || currency || payment.currency,
              reason: objectString(refund.reason),
              status: objectString(refund.status) || 'pending',
              failureReason: objectString(refund.failure_reason),
            },
            update: {
              status: objectString(refund.status) || 'pending',
              failureReason: objectString(refund.failure_reason),
            },
          });
          const refunds = await transaction.stripeRefund.findMany({ where: { paymentId: payment.id } });
          const totalRefunded = refunds.filter((item) => !['failed', 'canceled'].includes(item.status)).reduce((sum, item) => sum + item.amount, 0);
          const gross = payment.grossAmount ?? 0;
          await transaction.payment.update({ where: { id: payment.id, }, data: { status: totalRefunded >= gross && gross > 0 ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
        }
      } else if (type.startsWith('charge.dispute.')) {
        const disputeId = objectId(object.id);
        if (disputeId) {
          await transaction.stripeDispute.upsert({
            where: { stripeDisputeId: disputeId },
            create: {
              paymentId: payment.id,
              stripeDisputeId: disputeId,
              amount: amount || 0,
              currency: currency || payment.currency,
              reason: objectString(object.reason),
              status: objectString(object.status) || 'needs_response',
              closedAt: type === 'charge.dispute.closed' ? new Date() : null,
            },
            update: {
              status: objectString(object.status) || 'needs_response',
              reason: objectString(object.reason),
              closedAt: type === 'charge.dispute.closed' ? new Date() : undefined,
            },
          });
          await transaction.payment.update({ where: { id: payment.id }, data: { status: 'DISPUTED', disputedAt: new Date() } });
        }
      }
    });

    if (type === 'charge.succeeded' && objectId(object.id)) {
      await syncChargeFinancials(payment.id, object);
    }
  } else if (type.startsWith('payout.')) {
    const payoutId = objectId(object.id);
    if (!payoutId) throw new Error('INVALID_PAYOUT_EVENT');
    await prisma.$transaction(async (transaction) => {
      await transaction.paymentEvent.create({
        data: {
          providerEventId: eventId,
          eventType: type,
          status: type,
          amountKZ: null,
          currency: objectString(object.currency),
          payload: event,
          processedAt: new Date(),
        },
      });
      await transaction.stripePayout.upsert({
        where: { stripePayoutId: payoutId },
        create: {
          stripePayoutId: payoutId,
          amount: objectNumber(object.amount) || 0,
          currency: objectString(object.currency) || 'eur',
          status: objectString(object.status) || type.replace('payout.', ''),
          arrivalDate: objectNumber(object.arrival_date) ? new Date(Number(object.arrival_date) * 1000) : null,
        },
        update: {
          status: objectString(object.status) || type.replace('payout.', ''),
          arrivalDate: objectNumber(object.arrival_date) ? new Date(Number(object.arrival_date) * 1000) : undefined,
        },
      });
    });
  } else {
    await prisma.paymentEvent.create({
      data: {
        providerEventId: eventId,
        eventType: type,
        status: 'IGNORED',
        payload: event,
        processedAt: new Date(),
      },
    });
  }

  logger.info('Stripe webhook processed', { eventId, type, paymentId: payment?.id || null });
  return { duplicate: false };
}
