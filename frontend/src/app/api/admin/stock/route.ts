import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const lowStockThreshold = Number.isInteger(Number(process.env.LOW_STOCK_THRESHOLD)) && Number(process.env.LOW_STOCK_THRESHOLD) > 0
  ? Number(process.env.LOW_STOCK_THRESHOLD)
  : 5;

const querySchema = z.object({
  search: z.string().trim().max(160).default(''),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  status: z.enum(['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/),
  categoryId: z.coerce.number().int().positive(),
  brandId: z.coerce.number().int().positive(),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  amountAOA: z.coerce.number().nonnegative(),
  amountEUR: z.coerce.number().nonnegative(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

export async function GET(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse('Invalid inventory query', 400);
  const { search, categoryId, brandId, status, page, pageSize } = parsed.data;
  const where = {
    ...(categoryId ? { categoryId } : {}),
    ...(brandId ? { brandId } : {}),
    ...(search ? { OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      { slug: { contains: search, mode: 'insensitive' as const } },
    ] } : {}),
    ...(status === 'OUT_OF_STOCK' ? { stock: 0 } : {}),
    ...(status === 'LOW_STOCK' ? { stock: { gt: 0, lte: lowStockThreshold } } : {}),
    ...(status === 'IN_STOCK' ? { stock: { gt: lowStockThreshold } } : {}),
  };

  try {
    const [products, total, inStock, lowStock, outOfStock, stockAggregate, categories, brands] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { category: true, brand: true, prices: { where: { market: 'AO' } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
      prisma.product.count({ where: { stock: { gt: lowStockThreshold } } }),
      prisma.product.count({ where: { stock: { gt: 0, lte: lowStockThreshold } } }),
      prisma.product.count({ where: { stock: 0 } }),
      prisma.product.aggregate({ _sum: { stock: true } }),
      prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.brand.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return Response.json({
      data: products.map((product) => ({
        id: product.id,
        name: product.name,
        reference: product.slug,
        slug: product.slug,
        categoryId: product.categoryId,
        category: product.category.name,
        brandId: product.brandId,
        brand: product.brand.name,
        stock: product.stock,
        minimum: lowStockThreshold,
        price: product.prices[0]?.amount ?? product.basePrice,
        image: product.imageUrl,
        status: product.stock === 0 ? 'OUT_OF_STOCK' : product.stock <= lowStockThreshold ? 'LOW_STOCK' : 'IN_STOCK',
      })),
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize), lowStockThreshold },
      stats: { total: await prisma.product.count(), inStock, lowStock, outOfStock, units: stockAggregate._sum.stock || 0 },
      filters: { categories, brands },
    });
  } catch (error) {
    console.error('Unable to load stock inventory:', error);
    return errorResponse('Unable to load inventory', 503);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid inventory product', 400, parsed.error.flatten().fieldErrors);
  const { amountAOA, amountEUR, ...product } = parsed.data;
  try {
    const created = await prisma.product.create({
      data: {
        ...product,
        basePrice: amountEUR,
        prices: { create: [
          { market: 'AO', currency: 'AOA', amount: amountAOA },
          { market: 'PT', currency: 'EUR', amount: amountEUR },
        ] },
      },
      select: { id: true, name: true, slug: true, stock: true },
    });
    return Response.json({ data: created }, { status: 201 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Já existe um produto com este slug.', 409);
    if (prismaErrorCode(error) === 'P2003') return errorResponse('Categoria ou marca não encontrada.', 400);
    console.error('Unable to create inventory product:', error);
    return errorResponse('Unable to create inventory product', 503);
  }
}