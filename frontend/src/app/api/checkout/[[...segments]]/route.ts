import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const validationSchema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) })).min(1),
  country: z.enum(['AO', 'PT']).default('AO'),
  shippingMethod: z.enum(['standard', 'express', 'pickup']),
});

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!userSubject(user)) return errorResponse('Authentication required', 401);
  if (!new URL(request.url).pathname.endsWith('/validate')) return errorResponse('Not found', 404);
  const parsed = validationSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid checkout data', 400);

  const products = await prisma.product.findMany({
    where: { id: { in: parsed.data.items.map((item) => item.productId) } },
    include: { prices: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const issues: string[] = [];
  const items = parsed.data.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      issues.push(`Produto ${item.productId} não existe`);
      return null;
    }
    if (item.quantity > product.stock) issues.push(`Stock insuficiente: ${product.name}`);
    const price = Number(product.prices.find((entry) => entry.market === parsed.data.country)?.amount ?? product.basePrice);
    return { productId: product.id, name: product.name, quantity: item.quantity, unitPrice: price, subtotal: price * item.quantity };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
  const shipping = parsed.data.shippingMethod === 'express' ? (parsed.data.country === 'PT' ? 15 : 15000) : 0;
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  return Response.json({ data: { valid: issues.length === 0, issues, currency: parsed.data.country === 'PT' ? 'EUR' : 'AOA', items, subtotal, shipping, total: subtotal + shipping } });
}