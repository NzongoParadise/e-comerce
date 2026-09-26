import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';

const router = Router();
const querySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(12).default(6),
});

type RecommendationProduct = Awaited<ReturnType<typeof prisma.product.findMany>>[number] & {
  category: { name: string; slug: string };
  brand: { name: string; slug: string };
  attributes: { name: string; value: string }[];
  prices: { market: string; currency: string; amount: unknown }[];
};

function tokens(product: RecommendationProduct) {
  return new Set([
    ...product.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
    ...(product.description || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
    product.category.slug.toLowerCase(),
    product.brand.slug.toLowerCase(),
    ...product.attributes.flatMap((attribute) => `${attribute.name} ${attribute.value}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)),
  ]);
}

function cosineSimilarity(left: Set<string>, right: Set<string>) {
  const intersection = [...left].filter((token) => right.has(token)).length;
  if (!intersection) return 0;
  return intersection / Math.sqrt(left.size * right.size);
}

function serialize(product: RecommendationProduct, score: number) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    basePrice: product.basePrice,
    imageUrl: product.imageUrl,
    stock: product.stock,
    category: product.category,
    brand: product.brand,
    attributes: product.attributes,
    prices: product.prices,
    score: Number(score.toFixed(4)),
  };
}

router.get('/', async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid recommendation query' });

  try {
    const products = await prisma.product.findMany({
      include: { category: true, brand: true, attributes: true, prices: true },
      orderBy: { stock: 'desc' },
    }) as RecommendationProduct[];
    const source = parsed.data.productId ? products.find((product) => product.id === parsed.data.productId) : undefined;
    const sourceTokens = source ? tokens(source) : undefined;
    const recommendations = products
      .filter((product) => product.id !== parsed.data.productId && product.stock > 0)
      .map((product) => {
        const similarity = sourceTokens ? cosineSimilarity(sourceTokens, tokens(product)) : product.stock / Math.max(...products.map((item) => item.stock), 1);
        return { product, score: similarity };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, parsed.data.limit)
      .map(({ product, score }) => serialize(product, score));

    return res.json({ data: recommendations, meta: { algorithm: 'content-similarity-v1', sourceProductId: parsed.data.productId || null } });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return res.status(500).json({ error: 'Unable to generate recommendations' });
  }
});

export default router;
