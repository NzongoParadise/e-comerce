import { prisma } from '@/lib/server/prisma';
import { isActiveWholesaleCustomer } from '@/lib/auth';
import { authenticate, errorResponse, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const quoteSchema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(10000) })).min(1),
  companyName: z.string().min(2).max(200),
  companyNif: z.string().min(3).max(50),
  address: z.string().max(500).optional(),
  sector: z.string().max(150).optional(),
  phone: z.string().min(5).max(40),
  email: z.string().email(),
  notes: z.string().max(2000).optional(),
});

function quoteId(request: Request) {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return parts.length === 3 ? Number(parts[2]) : null;
}

export async function POST(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse('Authentication required', 401);
  const parsed = quoteSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid quote data', 400);
  try {
    const user = await prisma.user.findUnique({ where: { externalId: subject } });
    if (!user) return errorResponse('User profile not found', 401);
    if (!isActiveWholesaleCustomer(user)) return errorResponse('As cotações estão disponíveis apenas para contas grossistas ativas.', 403);
    const productIds = parsed.data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { prices: true } });
    if (products.length !== new Set(productIds).size) return errorResponse('Um ou mais produtos não existem', 400);
    const productMap = new Map(products.map((product) => [product.id, product]));
    const items = parsed.data.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new Error('PRODUCT_NOT_FOUND');
      const price = product.prices.find((entry) => entry.market === 'AO')?.amount ?? product.basePrice;
      return { productId: product.id, name: product.name, unitPrice: price, quantity: item.quantity, subtotal: Number(price) * item.quantity };
    });
    const quoteNumber = `CT${new Date().getFullYear()}${String(Date.now()).slice(-8)}`;
    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        userId: user.id,
        companyName: parsed.data.companyName,
        companyNif: parsed.data.companyNif,
        address: parsed.data.address,
        sector: parsed.data.sector,
        phone: parsed.data.phone,
        email: parsed.data.email,
        notes: parsed.data.notes,
        items: { create: items },
      },
      include: { items: true },
    });
    return Response.json({ data: quote }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') return errorResponse('Produto inválido', 400);
    console.error('Error creating quote:', error);
    return errorResponse('Unable to create quote', 503);
  }
}

export async function GET(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse('Authentication required', 401);
  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { accessRole: true, accountType: true, status: true },
  });
  if (!user) return errorResponse('User profile not found', 401);
  if (!isActiveWholesaleCustomer(user)) return errorResponse('As cotações estão disponíveis apenas para contas grossistas ativas.', 403);
  const id = quoteId(request);
  if (id !== null) {
    const quote = await prisma.quote.findFirst({ where: { id, user: { externalId: subject } }, include: { items: true } });
    if (!quote) return errorResponse('Quote not found', 404);
    return Response.json({ data: quote });
  }
  const quotes = await prisma.quote.findMany({ where: { user: { externalId: subject } }, include: { items: true }, orderBy: { createdAt: 'desc' } });
  return Response.json({ data: quotes });
}