import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { jwtAuth } from '../authMiddleware';
import { requireAdmin } from '../adminMiddleware';

const router = Router();

const priceSchema = z.object({
  market: z.enum(['PT', 'AO']),
  currency: z.string().trim().min(1).max(8),
  amount: z.coerce.number().nonnegative(),
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(2000).nullable().optional(),
  basePrice: z.coerce.number().nonnegative(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  stock: z.coerce.number().int().nonnegative(),
  categoryId: z.coerce.number().int().positive(),
  brandId: z.coerce.number().int().positive(),
  prices: z.array(priceSchema).max(10).optional(),
  attributes: z.array(z.object({ name: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(160) })).max(40).optional(),
});

const productUpdateSchema = productSchema.partial();

// Query schema for validation
const querySchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  market: z.enum(['PT', 'AO']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }
    const { category, brand, market, search, page, pageSize } = parsed.data;

    // Build where clause dynamically
    const where: any = {};
    if (category) where.category = { slug: category };
    if (brand) where.brand = { slug: brand };
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];

    // Include price filter if market supplied
    const total = await prisma.product.count({ where });
    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
        prices: market ? { where: { market } } : true,
        attributes: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: 'asc' },
    });

    const data = products.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      basePrice: p.basePrice,
      imageUrl: p.imageUrl,
      stock: p.stock,
      category: { id: p.category.id, name: p.category.name, slug: p.category.slug },
      brand: { id: p.brand.id, name: p.brand.name, slug: p.brand.slug },
      prices: p.prices?.map(price => ({
        market: price.market,
        currency: price.currency,
        amount: price.amount,
      })),
      attributes: p.attributes,
    }));

    res.json({ data, meta: { total, page, pageSize } });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid product data', details: parsed.error.flatten().fieldErrors });
  const { prices, attributes, ...productData } = parsed.data;
  try {
    const product = await prisma.product.create({
      data: { ...productData, prices: prices ? { create: prices } : undefined, attributes: attributes ? { create: attributes } : undefined },
      include: { category: true, brand: true, prices: true, attributes: true },
    });
    return res.status(201).json({ data: product });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Product slug already exists' });
    if (error?.code === 'P2003') return res.status(400).json({ error: 'Category or brand not found' });
    console.error('Error creating product:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid product id' });
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ error: 'Invalid product data' });
  const { prices, attributes, ...productData } = parsed.data;

  try {
    const product = await prisma.$transaction(async (transaction) => {
      await transaction.product.update({ where: { id }, data: productData });
      if (prices) {
        await transaction.price.deleteMany({ where: { productId: id } });
        await transaction.price.createMany({ data: prices.map((price) => ({ ...price, productId: id })) });
      }
      if (attributes) {
        await transaction.productAttribute.deleteMany({ where: { productId: id } });
        await transaction.productAttribute.createMany({ data: attributes.map((attribute) => ({ ...attribute, productId: id })) });
      }
      return transaction.product.findUnique({ where: { id }, include: { category: true, brand: true, prices: true, attributes: true } });
    });
    return res.json({ data: product });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Product slug already exists' });
    if (error?.code === 'P2003') return res.status(400).json({ error: 'Category or brand not found' });
    console.error('Error updating product:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid product id' });
  try {
    await prisma.product.delete({ where: { id } });
    return res.status(204).send();
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
    if (error?.code === 'P2003') return res.status(409).json({ error: 'Cannot delete a product referenced by an order or quote' });
    console.error('Error deleting product:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        brand: true,
        prices: true,
        attributes: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ data: product });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
