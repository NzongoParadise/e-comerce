import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

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

const querySchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  market: z.enum(['PT', 'AO']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
});

function productSegment(request: Request) {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return parts.length === 3 ? parts[2] : null;
}

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

export async function GET(request: Request) {
  const segment = productSegment(request);
  if (segment !== null) {
    try {
      const product = await prisma.product.findUnique({
        where: { slug: segment },
        include: { category: true, brand: true, prices: true, attributes: true },
      });
      if (!product) return errorResponse('Product not found', 404);
      return Response.json({ data: product });
    } catch (error) {
      console.error('Error fetching product details:', error);
      return errorResponse('Internal server error', 500);
    }
  }

  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) return errorResponse('Invalid query parameters', 400, parsed.error.issues);
    const { category, brand, market, search, page, pageSize } = parsed.data;
    const where: Record<string, unknown> = {};
    if (category) where.category = { slug: category };
    if (brand) where.brand = { slug: brand };
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];

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
    const data = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      basePrice: product.basePrice,
      imageUrl: product.imageUrl,
      stock: product.stock,
      category: { id: product.category.id, name: product.category.name, slug: product.category.slug },
      brand: { id: product.brand.id, name: product.brand.name, slug: product.brand.slug },
      prices: product.prices.map((price) => ({ market: price.market, currency: price.currency, amount: price.amount })),
      attributes: product.attributes,
    }));
    return Response.json({ data, meta: { total, page, pageSize } });
  } catch (error) {
    console.error('Error fetching products:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = productSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid product data', 400, parsed.error.flatten().fieldErrors);
  const { prices, attributes, ...productData } = parsed.data;
  try {
    const product = await prisma.product.create({
      data: { ...productData, prices: prices ? { create: prices } : undefined, attributes: attributes ? { create: attributes } : undefined },
      include: { category: true, brand: true, prices: true, attributes: true },
    });
    return Response.json({ data: product }, { status: 201 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Product slug already exists', 409);
    if (prismaErrorCode(error) === 'P2003') return errorResponse('Category or brand not found', 400);
    console.error('Error creating product:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const segment = productSegment(request);
  const id = Number(segment);
  if (!segment || !Number.isInteger(id)) return errorResponse('Invalid product id', 400);
  const parsed = productSchema.partial().safeParse(await readJson(request));
  if (!parsed.success || !Object.keys(parsed.data).length) return errorResponse('Invalid product data', 400);
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
    return Response.json({ data: product });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Product not found', 404);
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Product slug already exists', 409);
    if (prismaErrorCode(error) === 'P2003') return errorResponse('Category or brand not found', 400);
    console.error('Error updating product:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const segment = productSegment(request);
  const id = Number(segment);
  if (!segment || !Number.isInteger(id)) return errorResponse('Invalid product id', 400);
  try {
    await prisma.product.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Product not found', 404);
    if (prismaErrorCode(error) === 'P2003') return errorResponse('Cannot delete a product referenced by an order or quote', 409);
    console.error('Error deleting product:', error);
    return errorResponse('Internal server error', 500);
  }
}