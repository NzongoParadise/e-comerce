import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();
const validationSchema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) })).min(1),
  country: z.enum(['AO', 'PT']).default('AO'),
  shippingMethod: z.enum(['standard', 'express', 'pickup']),
});

type AuthenticatedRequest = Request & { user?: { sub?: string } };

router.post('/validate', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.sub) return res.status(401).json({ error: 'Authentication required' });
  const parsed = validationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid checkout data' });

  const products = await prisma.product.findMany({ where: { id: { in: parsed.data.items.map((item) => item.productId) } }, include: { prices: true } });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const issues: string[] = [];
  const items = parsed.data.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) { issues.push(`Produto ${item.productId} não existe`); return null; }
    if (item.quantity > product.stock) issues.push(`Stock insuficiente: ${product.name}`);
    const price = Number(product.prices.find((entry) => entry.market === parsed.data.country)?.amount ?? product.basePrice);
    return { productId: product.id, name: product.name, quantity: item.quantity, unitPrice: price, subtotal: price * item.quantity };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
  const shipping = parsed.data.shippingMethod === 'express' ? (parsed.data.country === 'PT' ? 15 : 15000) : 0;
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  return res.json({ data: { valid: issues.length === 0, issues, currency: parsed.data.country === 'PT' ? 'EUR' : 'AOA', items, subtotal, shipping, total: subtotal + shipping } });
});

export default router;
