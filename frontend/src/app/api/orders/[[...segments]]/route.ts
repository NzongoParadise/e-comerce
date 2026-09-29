import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, readJson, userSubject } from '@/lib/server/api';
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

async function createStripeCheckout(orderId: number, orderNumber: string, totalEUR: number) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: `${frontendUrl}/confirmation/${orderId}?payment=success`,
    cancel_url: `${frontendUrl}/checkout?order=${orderId}&payment=cancelled`,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][product_data][name]': `Encomenda ${orderNumber}`,
    'line_items[0][price_data][unit_amount]': String(Math.round(totalEUR * 100)),
    'line_items[0][quantity]': '1',
    'metadata[orderId]': String(orderId),
  });
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!response.ok) throw new Error(`STRIPE:${response.status}`);
  return response.json() as Promise<{ id: string; url: string }>;
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
    const existingOrder = await prisma.order.findFirst({ where: { userId: user.id, idempotencyKey }, include: { payment: true } });
    if (existingOrder) return Response.json({ data: { id: existingOrder.id, orderNumber: existingOrder.orderNumber, checkoutUrl: undefined, paymentStatus: existingOrder.payment?.status } });
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
    const totalEUR = calculatedItems.reduce((sum, entry) => sum + entry.eurPrice * entry.item.quantity, 0) + (parsed.data.shippingMethod === 'express' ? 15 : 0);
    const totalKZ = calculatedItems.reduce((sum, entry) => sum + entry.aoPrice * entry.item.quantity, 0) + (parsed.data.shippingMethod === 'express' ? 15000 : 0);
    if (parsed.data.paymentMethod === 'card' && !process.env.STRIPE_SECRET_KEY) return errorResponse('Pagamentos por cartão não estão configurados', 503);
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
          trackingNumber: orderNumber,
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
            provider: parsed.data.paymentMethod,
            method: parsed.data.paymentMethod,
            status: 'PENDING',
            amountEUR: totalEUR,
            amountKZ: totalKZ,
            currency,
          } },
          trackingEvents: { create: { status: 'PROCESSING', location: parsed.data.address || 'Armazém TechGlobal', description: 'Encomenda recebida e em processamento.' } },
        },
      });
    });

    let checkoutUrl: string | undefined;
    if (parsed.data.paymentMethod === 'card') {
      try {
        const checkout = await createStripeCheckout(order.id, order.orderNumber, totalEUR);
        checkoutUrl = checkout.url;
        await prisma.payment.update({ where: { orderId: order.id }, data: { provider: 'stripe', status: 'REQUIRES_PAYMENT', reference: checkout.id } });
      } catch (error) {
        await prisma.payment.update({ where: { orderId: order.id }, data: { status: 'FAILED' } });
        if (error instanceof Error && error.message === 'PAYMENT_PROVIDER_NOT_CONFIGURED') return errorResponse('Pagamentos por cartão não estão configurados', 503);
        console.error('Error creating Stripe checkout:', error);
        return errorResponse('Não foi possível iniciar o pagamento', 502);
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