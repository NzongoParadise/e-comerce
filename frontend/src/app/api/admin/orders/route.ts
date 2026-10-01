import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const orderStatuses = ['AWAITING_PAYMENT', 'PROCESSING', 'PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PAYMENT_REVIEW_REQUIRED', 'PAYMENT_REVIEW_IN_PROGRESS'] as const;
const querySchema = z.object({
  search: z.string().trim().max(160).default(''),
  status: z.enum(['ALL', ...orderStatuses]).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const createSchema = z.object({
  userId: z.number().int().positive(),
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) })).min(1).max(30),
  country: z.enum(['AO', 'PT']),
  deliveryMode: z.enum(['address', 'pickup']),
  shippingMethod: z.enum(['standard', 'express', 'pickup']),
  paymentMethod: z.enum(['cash', 'transfer']),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
  deliveryRecipient: z.string().trim().max(200).optional(),
  deliveryCity: z.string().trim().max(100).optional(),
  deliveryRegion: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
  note: z.string().trim().min(8).max(500),
}).superRefine((data, context) => {
  if (data.deliveryMode === 'address' && (!data.address || !data.phone)) {
    context.addIssue({ code: 'custom', path: ['address'], message: 'Endereço e telefone são obrigatórios para entrega.' });
  }
  if (data.deliveryMode === 'address' && data.shippingMethod === 'pickup') {
    context.addIssue({ code: 'custom', path: ['shippingMethod'], message: 'Levantamento na loja exige o modo pickup.' });
  }
  if (data.deliveryMode === 'pickup' && data.shippingMethod !== 'pickup') {
    context.addIssue({ code: 'custom', path: ['shippingMethod'], message: 'Selecione levantamento na loja para o modo pickup.' });
  }
  if (new Set(data.items.map((item) => item.productId)).size !== data.items.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'Remova produtos duplicados da venda.' });
  }
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse('Authentication required', 401) };
  if (!isAdmin(user)) return { error: errorResponse('Administrator access required', 403) };
  return { user };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse('Invalid order query', 400);
  const { search, status, page, pageSize } = parsed.data;
  const where: Prisma.OrderWhereInput = {
    ...(status !== 'ALL' ? { status } : {}),
    ...(search ? {
      OR: [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { items: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ],
    } : {}),
  };

  try {
    const [data, total, awaitingPayment, processing, paid, shipped, delivered, cancelled, revenue] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, accountName: true, accountType: true } },
          items: true,
          payment: { select: { id: true, status: true, method: true, provider: true, currency: true, paidAt: true } },
          trackingEvents: { orderBy: { occurredAt: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
      prisma.order.count({ where: { status: 'AWAITING_PAYMENT' } }),
      prisma.order.count({ where: { status: 'PROCESSING' } }),
      prisma.order.count({ where: { payment: { is: { status: 'PAID' } } } }),
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
      prisma.order.aggregate({ where: { status: { in: ['PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED'] } }, _sum: { totalKZ: true } }),
    ]);
    return Response.json({
      data,
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) },
      stats: {
        awaitingPayment,
        processing,
        paid,
        shipped,
        delivered,
        cancelled,
        revenueKZ: revenue._sum.totalKZ || 0,
      },
    });
  } catch (error) {
    console.error('Unable to load admin orders:', error);
    return errorResponse('Unable to load orders', 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid manual order data', 400, parsed.error.flatten().fieldErrors);

  try {
    const order = await prisma.$transaction(async (transaction) => {
      const customer = await transaction.user.findFirst({
        where: { id: parsed.data.userId, accessRole: 'CUSTOMER', status: 'ACTIVE' },
        select: { id: true },
      });
      if (!customer) throw new Error('CUSTOMER_NOT_FOUND');

      const products = await transaction.product.findMany({
        where: { id: { in: parsed.data.items.map((item) => item.productId) } },
        include: { prices: true },
      });
      if (products.length !== parsed.data.items.length) throw new Error('PRODUCT_NOT_FOUND');
      const productMap = new Map(products.map((product) => [product.id, product]));
      const pricedItems = parsed.data.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) throw new Error('PRODUCT_NOT_FOUND');
        const priceEUR = Number(product.prices.find((price) => price.market === 'PT')?.amount ?? product.basePrice);
        const priceKZ = Number(product.prices.find((price) => price.market === 'AO')?.amount ?? product.basePrice);
        return { product, quantity: item.quantity, priceEUR, priceKZ };
      });
      for (const item of pricedItems) {
        const reserved = await transaction.product.updateMany({
          where: { id: item.product.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (reserved.count !== 1) throw new Error(`STOCK_UNAVAILABLE:${item.product.name}`);
      }

      const shippingEUR = parsed.data.shippingMethod === 'express' ? 15 : 0;
      const shippingKZ = parsed.data.shippingMethod === 'express' ? 15000 : 0;
      const totalEUR = pricedItems.reduce((sum, item) => sum + item.priceEUR * item.quantity, 0) + shippingEUR;
      const totalKZ = pricedItems.reduce((sum, item) => sum + item.priceKZ * item.quantity, 0) + shippingKZ;
      const orderNumber = `TG${new Date().getFullYear()}${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
      return transaction.order.create({
        data: {
          orderNumber,
          status: 'PROCESSING',
          userId: customer.id,
          deliveryMode: parsed.data.deliveryMode,
          shippingMethod: parsed.data.shippingMethod,
          paymentMethod: parsed.data.paymentMethod,
          country: parsed.data.country,
          currency: parsed.data.country === 'PT' ? 'EUR' : 'AOA',
          address: parsed.data.address,
          phone: parsed.data.phone,
          deliveryRecipient: parsed.data.deliveryRecipient,
          deliveryCity: parsed.data.deliveryCity,
          deliveryRegion: parsed.data.deliveryRegion,
          postalCode: parsed.data.postalCode,
          deliveryNotes: parsed.data.deliveryNotes,
          totalEUR,
          totalKZ,
          items: { create: pricedItems.map(({ product, quantity, priceEUR }) => ({
            productId: product.id,
            name: product.name,
            slug: product.slug,
            imageUrl: product.imageUrl,
            unitPrice: priceEUR,
            quantity,
            subtotal: priceEUR * quantity,
          })) },
          payment: { create: {
            userId: customer.id,
            provider: 'admin_manual',
            method: parsed.data.paymentMethod,
            status: 'PENDING',
            amountEUR: totalEUR,
            amountKZ: totalKZ,
            currency: parsed.data.country === 'PT' ? 'EUR' : 'AOA',
          } },
          trackingNumber: orderNumber,
          trackingEvents: { create: {
            status: 'PROCESSING',
            location: 'Administração',
            description: `Venda criada manualmente por ${userSubject(auth.user) || 'Admin'}. ${parsed.data.note}`,
          } },
        },
        include: {
          user: { select: { id: true, name: true, email: true, accountName: true, accountType: true } },
          items: true,
          payment: { select: { id: true, status: true, method: true, provider: true, currency: true, paidAt: true } },
          trackingEvents: { orderBy: { occurredAt: 'desc' }, take: 5 },
        },
      });
    });
    return Response.json({ data: order }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'CUSTOMER_NOT_FOUND') return errorResponse('Cliente ativo não encontrado', 404);
    if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') return errorResponse('Um ou mais produtos não existem', 404);
    if (error instanceof Error && error.message.startsWith('STOCK_UNAVAILABLE:')) return errorResponse(`Stock insuficiente: ${error.message.slice('STOCK_UNAVAILABLE:'.length)}`, 409);
    console.error('Unable to create manual order:', error);
    return errorResponse('Unable to create order', 503);
  }
}