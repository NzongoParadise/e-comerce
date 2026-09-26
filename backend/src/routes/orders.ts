import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();
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

type AuthenticatedRequest = Request & { user?: { sub?: string } };

async function createStripeCheckout(orderId: number, orderNumber: string, totalEUR: number) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/confirmation/${orderId}?payment=success`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout?order=${orderId}&payment=cancelled`,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][product_data][name]': `Encomenda ${orderNumber}`,
    'line_items[0][price_data][unit_amount]': String(Math.round(totalEUR * 100)),
    'line_items[0][quantity]': '1',
    'metadata[orderId]': String(orderId),
  });
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!response.ok) throw new Error(`STRIPE:${response.status}`);
  return response.json() as Promise<{ id: string; url: string }>;
}

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success || !req.user?.sub) return res.status(400).json({ error: 'Invalid order data' });

  try {
    const user = await prisma.user.findUnique({ where: { externalId: req.user.sub } });
    if (!user) return res.status(401).json({ error: 'User profile not found' });
    const idempotencyKey = req.header('Idempotency-Key');
    if (!idempotencyKey || idempotencyKey.length > 128) return res.status(400).json({ error: 'Idempotency-Key is required' });
    const existingOrder = await prisma.order.findFirst({ where: { userId: user.id, idempotencyKey }, include: { payment: true } });
    if (existingOrder) return res.status(200).json({ data: { id: existingOrder.id, orderNumber: existingOrder.orderNumber, checkoutUrl: undefined, paymentStatus: existingOrder.payment?.status } });
    if (parsed.data.deliveryMode === 'address' && (!parsed.data.address || !parsed.data.phone)) return res.status(400).json({ error: 'Endereço e telefone são obrigatórios para entrega ao domicílio' });
    if (parsed.data.shippingMethod === 'pickup' && parsed.data.deliveryMode === 'address') return res.status(400).json({ error: 'Levantamento na loja requer o modo de entrega pickup' });
    const currency = parsed.data.currency || (parsed.data.country === 'PT' ? 'EUR' : 'AOA');
    if (currency !== (parsed.data.country === 'PT' ? 'EUR' : 'AOA')) return res.status(400).json({ error: 'Moeda incompatível com o país selecionado' });
    const productIds = parsed.data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { prices: true },
    });
    if (products.length !== new Set(productIds).size) return res.status(400).json({ error: 'Um ou mais produtos não existem' });

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
    if (parsed.data.paymentMethod === 'card' && !process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Pagamentos por cartão não estão configurados' });
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
          payment: {
            create: {
              userId: user.id,
              provider: parsed.data.paymentMethod,
              method: parsed.data.paymentMethod,
              status: 'PENDING',
              amountEUR: totalEUR,
              amountKZ: totalKZ,
              currency,
            },
          },
          trackingEvents: {
            create: { status: 'PROCESSING', location: parsed.data.address || 'Armazém TechGlobal', description: 'Encomenda recebida e em processamento.' },
          },
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
        if (error instanceof Error && error.message === 'PAYMENT_PROVIDER_NOT_CONFIGURED') return res.status(503).json({ error: 'Pagamentos por cartão não estão configurados' });
        console.error('Error creating Stripe checkout:', error);
        return res.status(502).json({ error: 'Não foi possível iniciar o pagamento' });
      }
    }
    return res.status(201).json({ data: { id: order.id, orderNumber: order.orderNumber, checkoutUrl } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('STOCK:')) return res.status(409).json({ error: `Stock insuficiente: ${error.message.slice(6)}` });
    if (error instanceof Error && error.message === 'PRODUCT_MISMATCH') return res.status(400).json({ error: 'Os dados do produto não correspondem ao catálogo atual' });
    if (error instanceof Error && error.message === 'PRICE_CHANGED') return res.status(409).json({ error: 'O preço de um produto foi atualizado. Reveja o carrinho.' });
    console.error('Error creating order:', error);
    return res.status(503).json({ error: 'Unable to create order' });
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.sub) return res.status(401).json({ error: 'Authentication required' });
  const orders = await prisma.order.findMany({ where: { user: { externalId: req.user.sub } }, include: { items: true }, orderBy: { createdAt: 'desc' } });
  return res.json({ data: orders });
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.sub) return res.status(401).json({ error: 'Authentication required' });
  const order = await prisma.order.findFirst({ where: { id: Number(req.params.id), user: { externalId: req.user.sub } }, include: { items: true, payment: true, trackingEvents: { orderBy: { occurredAt: 'desc' } } } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  return res.json({ data: order });
});

router.get('/:id/tracking', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.sub) return res.status(401).json({ error: 'Authentication required' });
  const order = await prisma.order.findFirst({
    where: { id: Number(req.params.id), user: { externalId: req.user.sub } },
    select: { id: true, orderNumber: true, carrier: true, trackingNumber: true, status: true, trackingEvents: { orderBy: { occurredAt: 'desc' } } },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  let carrierData: unknown = null;
  const trackingApiUrl = process.env.TRACKING_API_URL;
  if (trackingApiUrl && order.trackingNumber) {
    const url = new URL(trackingApiUrl);
    url.searchParams.set('carrier', order.carrier || process.env.DEFAULT_CARRIER || '');
    url.searchParams.set('trackingNumber', order.trackingNumber);
    const response = await fetch(url, { headers: process.env.TRACKING_API_KEY ? { Authorization: `Bearer ${process.env.TRACKING_API_KEY}` } : undefined });
    if (response.ok) carrierData = await response.json();
  }
  return res.json({ data: { ...order, carrierData } });
});

export default router;