import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, readJson, userSubject } from '@/lib/server/api';
import { cancelAwaitingPaymentAndReleaseStock } from '@/lib/server/orders/inventory';
import { isStripeCurrencySupported, toStripeMinorUnits } from '@/lib/server/payments/stripeAmounts';
import { isDefinitiveStripeRejection, isStripeSessionForOrder, stripeCheckoutIdempotencyKey } from '@/lib/server/payments/stripeRequestRules';
import { calculateShipping, estimateCartWeightKg } from '@/lib/shipping';
import { z } from 'zod';

export const runtime = 'nodejs';

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(200),
    imageUrl: z.string().optional(),
    priceEUR: z.number().nonnegative(),
    priceKZ: z.number().nonnegative(),
    quantity: z.number().int().min(1).max(99),
  })).min(1),
  country: z.enum(['AO', 'PT']).default('AO'),
  currency: z.enum(['AOA', 'EUR']).optional(),
  deliveryMode: z.enum(['address', 'pickup', 'business']),
  shippingMethod: z.enum(['standard', 'express', 'pickup']),
  paymentMethod: z.enum(['multicaixa_reference', 'multicaixa_express', 'multicaixa', 'transfer', 'card', 'cash']),
  address: z.string().max(500).optional(),
  phone: z.string().max(40).optional(),
  billingName: z.string().max(200).optional(),
  billingEmail: z.string().email().optional(),
  billingTaxId: z.string().max(50).optional(),
  deliveryRecipient: z.string().max(200).optional(),
  deliveryCity: z.string().max(100).optional(),
  deliveryRegion: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  deliveryNotes: z.string().max(500).optional(),
});

function segments(request: Request) {
  return new URL(request.url).pathname.split('/').filter(Boolean).slice(2);
}

class StripeCheckoutRejectedError extends Error {
  constructor(readonly statusCode: number) {
    super(`Stripe rejected checkout creation: ${statusCode}`);
    this.name = 'StripeCheckoutRejectedError';
  }
}

type StripeCheckoutSession = {
  id: string;
  url?: string;
  status: 'open' | 'complete' | 'expired';
  expiresAt?: Date;
};

function parseStripeCheckoutSession(value: unknown): StripeCheckoutSession {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid Stripe checkout response');
  const session = value as Record<string, unknown>;
  if (typeof session.id !== 'string' || !['open', 'complete', 'expired'].includes(String(session.status))) {
    throw new Error('Invalid Stripe checkout response');
  }
  if (session.status === 'open' && typeof session.url !== 'string') throw new Error('Invalid Stripe checkout response');
  return {
    id: session.id,
    ...(typeof session.url === 'string' ? { url: session.url } : {}),
    status: session.status as StripeCheckoutSession['status'],
    ...(typeof session.expires_at === 'number' ? { expiresAt: new Date(session.expires_at * 1000) } : {}),
  };
}

async function createStripeCheckout(orderId: number, orderNumber: string, amount: number, expiresAt: Date) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: `${frontendUrl}/confirmation/${orderId}?payment=success`,
    cancel_url: `${frontendUrl}/checkout?order=${orderId}&payment=cancelled`,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][product_data][name]': `Encomenda ${orderNumber}`,
    'line_items[0][price_data][unit_amount]': String(toStripeMinorUnits(amount)),
    'line_items[0][quantity]': '1',
    expires_at: String(Math.floor(expiresAt.getTime() / 1000)),
    client_reference_id: orderNumber,
    'metadata[orderId]': String(orderId),
  });
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': stripeCheckoutIdempotencyKey(orderId),
    },
    body: params,
  });
  if (!response.ok) {
    if (isDefinitiveStripeRejection(response.status)) throw new StripeCheckoutRejectedError(response.status);
    throw new Error(`Stripe checkout response requires reconciliation: ${response.status}`);
  }
  return parseStripeCheckoutSession(await response.json());
}

async function retrieveStripeCheckout(sessionId: string): Promise<StripeCheckoutSession> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok) throw new Error(`Stripe checkout retrieval requires reconciliation: ${response.status}`);
  return parseStripeCheckoutSession(await response.json());
}

async function findStripeCheckoutForOrder(orderId: number, orderNumber: string, createdAt: Date) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
  const params = new URLSearchParams({
    limit: '100',
    'created[gte]': String(Math.max(0, Math.floor(createdAt.getTime() / 1000) - 60)),
    'created[lte]': String(Math.ceil(Date.now() / 1000) + 60),
  });
  const matches: StripeCheckoutSession[] = [];
  for (let page = 0; page < 10; page += 1) {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!response.ok) throw new Error(`Stripe session reconciliation failed: ${response.status}`);
    const result = await response.json() as { data?: unknown; has_more?: unknown };
    if (!Array.isArray(result.data)) throw new Error('Invalid Stripe session list response');
    for (const session of result.data) {
      if (isStripeSessionForOrder(session, orderId, orderNumber)) matches.push(parseStripeCheckoutSession(session));
    }
    if (result.has_more !== true) break;
    if (page === 9) throw new Error('Stripe session reconciliation exceeded page limit');
    const lastSession = result.data[result.data.length - 1] as { id?: unknown } | undefined;
    if (typeof lastSession?.id !== 'string') throw new Error('Stripe session list pagination cursor is missing');
    params.set('starting_after', lastSession.id);
  }
  if (matches.length > 1) throw new Error('Multiple Stripe sessions found for one order');
  return matches[0];
}

async function createOrReconcileStripeCheckout(orderId: number, orderNumber: string, amount: number, expiresAt: Date, createdAt: Date) {
  try {
    return await createStripeCheckout(orderId, orderNumber, amount, expiresAt);
  } catch (error) {
    if (error instanceof StripeCheckoutRejectedError || (error instanceof Error && error.message === 'PAYMENT_PROVIDER_NOT_CONFIGURED')) throw error;
    const checkout = await findStripeCheckoutForOrder(orderId, orderNumber, createdAt);
    if (checkout) return checkout;
    throw error;
  }
}

async function saveStripeCheckout(orderId: number, checkout: StripeCheckoutSession, fallbackExpiresAt: Date) {
  return prisma.$transaction(async (transaction) => {
    const pendingOrder = await transaction.order.updateMany({
      where: { id: orderId, status: 'AWAITING_PAYMENT' },
      data: { status: 'AWAITING_PAYMENT' },
    });
    if (!pendingOrder.count) return false;
    const pendingPayment = await transaction.payment.updateMany({
      where: { orderId, status: { in: ['PENDING', 'REQUIRES_PAYMENT'] } },
      data: {
        provider: 'stripe',
        method: 'card',
        status: 'REQUIRES_PAYMENT',
        reference: checkout.id,
        expiresAt: checkout.expiresAt || fallbackExpiresAt,
      },
    });
    return pendingPayment.count === 1;
  });
}

async function cancelForStripeRejection(orderId: number, items: { productId: number; quantity: number }[], description: string) {
  return prisma.$transaction((transaction) => cancelAwaitingPaymentAndReleaseStock(
    transaction,
    orderId,
    items,
    'FAILED',
    description,
  ));
}

async function handleDefinitiveStripeRejection(orderId: number, items: { productId: number; quantity: number }[], error: StripeCheckoutRejectedError) {
  try {
    const cancelled = await cancelForStripeRejection(orderId, items, 'Encomenda cancelada porque o gateway recusou a criação do pagamento.');
    if (!cancelled) return errorResponse('O estado da encomenda mudou durante a tentativa de pagamento.', 409);
  } catch (rollbackError) {
    console.error('Failed to release stock after Stripe rejection:', rollbackError);
    return errorResponse('Não foi possível concluir o pagamento. Contacte o suporte antes de repetir.', 503);
  }
  console.error('Stripe rejected checkout creation:', error.statusCode);
  return errorResponse('O gateway recusou iniciar o pagamento. Tente novamente.', 502);
}

export async function POST(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse('Authentication required', 401);
  const parsed = orderSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid order data', 400);
  try {
    const user = await prisma.user.findUnique({ where: { externalId: subject } });
    if (!user) return errorResponse('User profile not found', 401);
    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey || idempotencyKey.length > 128) return errorResponse('Idempotency-Key is required', 400);
    const existingOrder = await prisma.order.findFirst({
      where: { userId: user.id, idempotencyKey },
      include: { payment: true, items: { select: { productId: true, quantity: true } } },
    });
    if (existingOrder?.status === 'CANCELLED') return errorResponse('Esta tentativa foi cancelada. Inicie uma nova tentativa de checkout.', 409);
    if (existingOrder) {
      if (existingOrder.paymentMethod === 'card' && existingOrder.status === 'AWAITING_PAYMENT' && existingOrder.payment?.status !== 'PAID') {
        const payment = existingOrder.payment;
        if (!payment) return errorResponse('Pagamento da encomenda não encontrado. Contacte o suporte.', 503);
        const expiresAt = payment.expiresAt;
        if (!expiresAt) return errorResponse('A tentativa de pagamento requer reconciliação. Contacte o suporte.', 503);
        try {
          const checkout = payment.reference
            ? await retrieveStripeCheckout(payment.reference)
            : await createOrReconcileStripeCheckout(
              existingOrder.id,
              existingOrder.orderNumber,
              Number(existingOrder.totalEUR),
              expiresAt,
              existingOrder.createdAt,
            );
          if (checkout.status === 'expired') {
            await prisma.$transaction((transaction) => cancelAwaitingPaymentAndReleaseStock(
              transaction,
              existingOrder.id,
              existingOrder.items,
              'EXPIRED',
              'Encomenda cancelada após expiração da sessão de pagamento Stripe.',
            ));
            return errorResponse('A sessão de pagamento expirou. Inicie uma nova tentativa.', 409);
          }
          await saveStripeCheckout(existingOrder.id, checkout, expiresAt);
          return Response.json({ data: {
            id: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            checkoutUrl: checkout.status === 'open' ? checkout.url : undefined,
            paymentStatus: payment.status,
          } });
        } catch (error) {
          if (error instanceof StripeCheckoutRejectedError) {
            return handleDefinitiveStripeRejection(existingOrder.id, existingOrder.items, error);
          }
          if (error instanceof Error && error.message === 'PAYMENT_PROVIDER_NOT_CONFIGURED') return errorResponse('Pagamentos por cartão não estão configurados', 503);
          console.error('Error reconciling Stripe checkout:', error);
          return errorResponse('Não foi possível confirmar o estado da tentativa. Tente novamente ou contacte o suporte.', 503);
        }
      }
      return Response.json({ data: { id: existingOrder.id, orderNumber: existingOrder.orderNumber, checkoutUrl: undefined, paymentStatus: existingOrder.payment?.status } });
    }
    if (parsed.data.deliveryMode === 'address' && (!parsed.data.address || !parsed.data.phone)) return errorResponse('Endereço e telefone são obrigatórios para entrega ao domicílio', 400);
    if (parsed.data.shippingMethod === 'pickup' && parsed.data.deliveryMode === 'address') return errorResponse('Levantamento na loja requer o modo de entrega pickup', 400);
    const currency = parsed.data.currency || (parsed.data.country === 'PT' ? 'EUR' : 'AOA');
    if (currency !== (parsed.data.country === 'PT' ? 'EUR' : 'AOA')) return errorResponse('Moeda incompatível com o país selecionado', 400);
    const productIds = parsed.data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { prices: true } });
    if (products.length !== new Set(productIds).size) return errorResponse('Um ou mais produtos não existem', 400);

    const productMap = new Map(products.map((product) => [product.id, product]));
    const calculatedItems = parsed.data.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product || product.slug !== item.slug) throw new Error('PRODUCT_MISMATCH');
      if (item.quantity > product.stock) throw new Error(`STOCK:${product.name}`);
      const eurPrice = product.prices.find((price) => price.market === 'PT')?.amount ?? product.basePrice;
      const aoPrice = product.prices.find((price) => price.market === 'AO')?.amount ?? product.basePrice;
      if (Math.abs(Number(eurPrice) - item.priceEUR) > 0.01 || Math.abs(Number(aoPrice) - item.priceKZ) > 0.01) throw new Error('PRICE_CHANGED');
      return { item, product, eurPrice: Number(eurPrice), aoPrice: Number(aoPrice) };
    });
    const estimatedCartWeightKg = estimateCartWeightKg(calculatedItems.map(({ item, product }) => ({
      quantity: item.quantity,
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm ? Number(product.lengthCm) : null,
      widthCm: product.widthCm ? Number(product.widthCm) : null,
      heightCm: product.heightCm ? Number(product.heightCm) : null,
    })));
    const shippingCost = calculateShipping({
      country: parsed.data.country,
      deliveryMode: parsed.data.deliveryMode,
      shippingMethod: parsed.data.shippingMethod,
      weightKg: estimatedCartWeightKg,
    });
    const productTotalEUR = calculatedItems.reduce((sum, entry) => sum + entry.eurPrice * entry.item.quantity, 0);
    const productTotalKZ = calculatedItems.reduce((sum, entry) => sum + entry.aoPrice * entry.item.quantity, 0);
    const totalEUR = productTotalEUR + (parsed.data.country === 'PT' ? shippingCost : 0);
    const totalKZ = productTotalKZ + (parsed.data.country === 'AO' ? shippingCost : 0);
    if (parsed.data.paymentMethod === 'card' && !isStripeCurrencySupported(currency)) return errorResponse('Pagamentos por cartão não estão disponíveis para encomendas em AOA. Selecione MULTICAIXA.', 400);
    if (parsed.data.paymentMethod === 'card' && !process.env.STRIPE_SECRET_KEY) return errorResponse('Pagamentos por cartão não estão configurados', 503);
    const stripeExpiresAt = parsed.data.paymentMethod === 'card' ? new Date(Date.now() + 60 * 60 * 1000) : undefined;
    const orderNumber = `TG${new Date().getFullYear()}${String(Date.now()).slice(-8)}`;
    const order = await prisma.$transaction(async (transaction) => {
      for (const entry of calculatedItems) {
        const result = await transaction.product.updateMany({
          where: { id: entry.product.id, stock: { gte: entry.item.quantity } },
          data: { stock: { decrement: entry.item.quantity } },
        });
        if (result.count !== 1) throw new Error(`STOCK:${entry.product.name}`);
      }
      return transaction.order.create({
        data: {
          orderNumber,
          idempotencyKey,
          status: ['card', 'multicaixa_reference', 'multicaixa_express', 'multicaixa'].includes(parsed.data.paymentMethod) ? 'AWAITING_PAYMENT' : 'PROCESSING',
          userId: user.id,
          deliveryMode: parsed.data.deliveryMode,
          shippingMethod: parsed.data.shippingMethod,
          paymentMethod: parsed.data.paymentMethod,
          country: parsed.data.country,
          currency,
          billingName: parsed.data.billingName,
          billingEmail: parsed.data.billingEmail,
          billingTaxId: parsed.data.billingTaxId,
          deliveryRecipient: parsed.data.deliveryRecipient,
          deliveryCity: parsed.data.deliveryCity,
          deliveryRegion: parsed.data.deliveryRegion,
          postalCode: parsed.data.postalCode,
          deliveryNotes: parsed.data.deliveryNotes,
          address: parsed.data.address,
          phone: parsed.data.phone,
          carrier: process.env.DEFAULT_CARRIER || undefined,
          trackingNumber: undefined,
          totalEUR,
          totalKZ,
          items: { create: calculatedItems.map(({ item, product, eurPrice }) => ({
            productId: product.id,
            name: product.name,
            slug: product.slug,
            imageUrl: product.imageUrl,
            unitPrice: eurPrice,
            quantity: item.quantity,
            subtotal: eurPrice * item.quantity,
          })) },
          payment: { create: {
            userId: user.id,
            provider: parsed.data.paymentMethod === 'card' ? 'stripe' : parsed.data.paymentMethod,
            method: parsed.data.paymentMethod,
            status: 'PENDING',
            amountEUR: totalEUR,
            amountKZ: totalKZ,
            currency,
            expiresAt: stripeExpiresAt,
          } },
          trackingEvents: { create: { status: 'PROCESSING', location: parsed.data.address || 'Armazém', description: 'Encomenda recebida e em processamento.' } },
        },
      });
    });

    let checkoutUrl: string | undefined;
    if (parsed.data.paymentMethod === 'card') {
      try {
        const checkout = await createOrReconcileStripeCheckout(order.id, order.orderNumber, totalEUR, stripeExpiresAt!, order.createdAt);
        if (checkout.status === 'expired') {
          await prisma.$transaction((transaction) => cancelAwaitingPaymentAndReleaseStock(
            transaction,
            order.id,
            calculatedItems.map(({ item, product }) => ({ productId: product.id, quantity: item.quantity })),
            'EXPIRED',
            'Encomenda cancelada após expiração da sessão de pagamento Stripe.',
          ));
          return errorResponse('A sessão de pagamento expirou. Inicie uma nova tentativa.', 409);
        }
        checkoutUrl = checkout.status === 'open' ? checkout.url : undefined;
        const saved = await saveStripeCheckout(order.id, checkout, stripeExpiresAt!);
        if (!saved) return errorResponse('O estado da encomenda mudou durante a criação do pagamento.', 409);
      } catch (error) {
        if (error instanceof StripeCheckoutRejectedError) {
          return handleDefinitiveStripeRejection(
            order.id,
            calculatedItems.map(({ item, product }) => ({ productId: product.id, quantity: item.quantity })),
            error,
          );
        }
        if (error instanceof Error && error.message === 'PAYMENT_PROVIDER_NOT_CONFIGURED') return errorResponse('Pagamentos por cartão não estão configurados', 503);
        console.error('Error creating Stripe checkout:', error);
        return errorResponse('Não foi possível confirmar o estado da tentativa de pagamento. Contacte o suporte antes de repetir.', 503);
      }
    }
    return Response.json({ data: { id: order.id, orderNumber: order.orderNumber, checkoutUrl } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('STOCK:')) return errorResponse(`Stock insuficiente: ${error.message.slice(6)}`, 409);
    if (error instanceof Error && error.message === 'PRODUCT_MISMATCH') return errorResponse('Os dados do produto não correspondem ao catálogo atual', 400);
    if (error instanceof Error && error.message === 'PRICE_CHANGED') return errorResponse('O preço de um produto foi atualizado. Reveja o carrinho.', 409);
    console.error('Error creating order:', error);
    return errorResponse('Unable to create order', 503);
  }
}

export async function GET(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse('Authentication required', 401);
  const parts = segments(request);
  if (!parts.length) {
    const orders = await prisma.order.findMany({ where: { user: { externalId: subject } }, include: { items: true }, orderBy: { createdAt: 'desc' } });
    return Response.json({ data: orders });
  }

  const id = Number(parts[0]);
  if (!Number.isInteger(id)) return errorResponse('Order not found', 404);
  if (parts[1] === 'tracking') {
    const order = await prisma.order.findFirst({
      where: { id, user: { externalId: subject } },
      select: { id: true, orderNumber: true, carrier: true, trackingNumber: true, status: true, trackingEvents: { orderBy: { occurredAt: 'desc' } } },
    });
    if (!order) return errorResponse('Order not found', 404);
    let carrierData: unknown = null;
    const trackingApiUrl = process.env.TRACKING_API_URL;
    if (trackingApiUrl && order.trackingNumber) {
      const url = new URL(trackingApiUrl);
      url.searchParams.set('carrier', order.carrier || process.env.DEFAULT_CARRIER || '');
      url.searchParams.set('trackingNumber', order.trackingNumber);
      const response = await fetch(url, { headers: process.env.TRACKING_API_KEY ? { Authorization: `Bearer ${process.env.TRACKING_API_KEY}` } : undefined });
      if (response.ok) carrierData = await response.json();
    }
    return Response.json({ data: { ...order, carrierData } });
  }

  const order = await prisma.order.findFirst({
    where: { id, user: { externalId: subject } },
    include: { items: true, payment: true, trackingEvents: { orderBy: { occurredAt: 'desc' } } },
  });
  if (!order) return errorResponse('Order not found', 404);
  return Response.json({ data: order });
}