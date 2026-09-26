import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();
const quoteSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(10000),
  })).min(1),
  companyName: z.string().min(2).max(200),
  companyNif: z.string().min(3).max(50),
  address: z.string().max(500).optional(),
  sector: z.string().max(150).optional(),
  phone: z.string().min(5).max(40),
  email: z.string().email(),
  notes: z.string().max(2000).optional(),
});

type AuthenticatedRequest = Request & { user?: { sub?: string } };

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success || !req.user?.sub) return res.status(400).json({ error: 'Invalid quote data' });

  try {
    const user = await prisma.user.findUnique({ where: { externalId: req.user.sub } });
    if (!user) return res.status(401).json({ error: 'User profile not found' });
    const productIds = parsed.data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { prices: true } });
    if (products.length !== new Set(productIds).size) return res.status(400).json({ error: 'Um ou mais produtos não existem' });

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
    return res.status(201).json({ data: quote });
  } catch (error) {
    if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') return res.status(400).json({ error: 'Produto inválido' });
    console.error('Error creating quote:', error);
    return res.status(503).json({ error: 'Unable to create quote' });
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.sub) return res.status(401).json({ error: 'Authentication required' });
  const quotes = await prisma.quote.findMany({ where: { user: { externalId: req.user.sub } }, include: { items: true }, orderBy: { createdAt: 'desc' } });
  return res.json({ data: quotes });
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.sub) return res.status(401).json({ error: 'Authentication required' });
  const quote = await prisma.quote.findFirst({ where: { id: Number(req.params.id), user: { externalId: req.user.sub } }, include: { items: true } });
  if (!quote) return res.status(404).json({ error: 'Quote not found' });
  return res.json({ data: quote });
});

export default router;
