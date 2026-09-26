import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { jwtAuth } from '../authMiddleware';
import { requireAdmin } from '../adminMiddleware';

const router = Router();
const brandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const brands = await prisma.brand.findMany({
      include: { products: { select: { id: true } } },
      orderBy: { name: 'asc' },
    });
    const data = brands.map(b => ({ id: b.id, name: b.name, slug: b.slug, productCount: b.products.length }));
    res.json({ data });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid brand id' });
  const brand = await prisma.brand.findUnique({ where: { id }, include: { products: { select: { id: true } } } });
  if (!brand) return res.status(404).json({ error: 'Brand not found' });
  return res.json({ data: { ...brand, productCount: brand.products.length, products: undefined } });
});

router.post('/', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const parsed = brandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid brand data', details: parsed.error.flatten().fieldErrors });
  try {
    const brand = await prisma.brand.create({ data: parsed.data });
    return res.status(201).json({ data: { ...brand, productCount: 0 } });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Brand name or slug already exists' });
    console.error('Error creating brand:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid brand id' });
  const parsed = brandSchema.partial().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ error: 'Invalid brand data' });
  try {
    const brand = await prisma.brand.update({ where: { id }, data: parsed.data, include: { products: { select: { id: true } } } });
    return res.json({ data: { ...brand, productCount: brand.products.length, products: undefined } });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Brand not found' });
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Brand name or slug already exists' });
    console.error('Error updating brand:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid brand id' });
  const brand = await prisma.brand.findUnique({ where: { id }, include: { products: { select: { id: true }, take: 1 } } });
  if (!brand) return res.status(404).json({ error: 'Brand not found' });
  if (brand.products.length) return res.status(409).json({ error: 'Cannot delete a brand with products' });
  await prisma.brand.delete({ where: { id } });
  return res.status(204).send();
});

export default router;
