import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { jwtAuth } from '../authMiddleware';
import { requireAdmin } from '../adminMiddleware';

const router = Router();
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: { products: { select: { id: true } } },
      orderBy: { name: 'asc' },
    });
    const data = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      productCount: c.products.length,
    }));
    res.json({ data });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid category id' });
  const category = await prisma.category.findUnique({ where: { id }, include: { products: { select: { id: true } } } });
  if (!category) return res.status(404).json({ error: 'Category not found' });
  return res.json({ data: { ...category, productCount: category.products.length, products: undefined } });
});

router.post('/', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid category data', details: parsed.error.flatten().fieldErrors });
  try {
    const category = await prisma.category.create({ data: parsed.data });
    return res.status(201).json({ data: { ...category, productCount: 0 } });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Category name or slug already exists' });
    console.error('Error creating category:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid category id' });
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ error: 'Invalid category data' });
  try {
    const category = await prisma.category.update({ where: { id }, data: parsed.data, include: { products: { select: { id: true } } } });
    return res.json({ data: { ...category, productCount: category.products.length, products: undefined } });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Category not found' });
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Category name or slug already exists' });
    console.error('Error updating category:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid category id' });
  const category = await prisma.category.findUnique({ where: { id }, include: { products: { select: { id: true }, take: 1 } } });
  if (!category) return res.status(404).json({ error: 'Category not found' });
  if (category.products.length) return res.status(409).json({ error: 'Cannot delete a category with products' });
  await prisma.category.delete({ where: { id } });
  return res.status(204).send();
});

export default router;
