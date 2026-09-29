import { prisma } from '@/lib/server/prisma';
import { errorResponse } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

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
  return intersection ? intersection / Math.sqrt(left.size * right.size) : 0;
}

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return errorResponse('Invalid recommendation query', 400);

  try {
    const products = await prisma.product.findMany({
      include: { category: true, brand: true, attributes: true, prices: true },
      orderBy: { stock: 'desc' },
    }) as RecommendationProduct[];
    const source = parsed.data.productId ? products.find((product) => product.id === parsed.data.productId) : undefined;
    const sourceTokens = source ? tokens(source) : undefined;
    const recommendations = products
      .filter((product) => product.id !== parsed.data.productId && product.stock > 0)
      .map((product) => ({
        product,
        score: sourceTokens
          ? cosineSimilarity(sourceTokens, tokens(product))
          : product.stock / Math.max(...products.map((item) => item.stock), 1),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, parsed.data.limit)
      .map(({ product, score }) => ({
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
      }));
    return Response.json({ data: recommendations, meta: { algorithm: 'content-similarity-v1', sourceProductId: parsed.data.productId || null } });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return errorResponse('Unable to generate recommendations', 500);
  }
}