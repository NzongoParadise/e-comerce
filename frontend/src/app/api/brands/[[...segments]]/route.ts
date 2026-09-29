import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const brandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
});

function brandId(request: Request) {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return parts.length === 3 ? Number(parts[2]) : null;
}

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

export async function GET(request: Request) {
  const id = brandId(request);
  if (id !== null) {
    if (!Number.isInteger(id)) return errorResponse('Invalid brand id', 400);
    const brand = await prisma.brand.findUnique({ where: { id }, include: { products: { select: { id: true } } } });
    if (!brand) return errorResponse('Brand not found', 404);
    return Response.json({ data: { ...brand, productCount: brand.products.length, products: undefined } });
  }

  try {
    const brands = await prisma.brand.findMany({
      include: { products: { select: { id: true } } },
      orderBy: { name: 'asc' },
    });
    return Response.json({ data: brands.map(({ id: brandKey, name, slug, products }) => ({
      id: brandKey,
      name,
      slug,
      productCount: products.length,
    })) });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = brandSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid brand data', 400, parsed.error.flatten().fieldErrors);

  try {
    const brand = await prisma.brand.create({ data: parsed.data });
    return Response.json({ data: { ...brand, productCount: 0 } }, { status: 201 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Brand name or slug already exists', 409);
    console.error('Error creating brand:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = brandId(request);
  if (id === null || !Number.isInteger(id)) return errorResponse('Invalid brand id', 400);
  const parsed = brandSchema.partial().safeParse(await readJson(request));
  if (!parsed.success || !Object.keys(parsed.data).length) return errorResponse('Invalid brand data', 400);

  try {
    const brand = await prisma.brand.update({ where: { id }, data: parsed.data, include: { products: { select: { id: true } } } });
    return Response.json({ data: { ...brand, productCount: brand.products.length, products: undefined } });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Brand not found', 404);
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Brand name or slug already exists', 409);
    console.error('Error updating brand:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = brandId(request);
  if (id === null || !Number.isInteger(id)) return errorResponse('Invalid brand id', 400);
  const brand = await prisma.brand.findUnique({ where: { id }, include: { products: { select: { id: true }, take: 1 } } });
  if (!brand) return errorResponse('Brand not found', 404);
  if (brand.products.length) return errorResponse('Cannot delete a brand with products', 409);
  await prisma.brand.delete({ where: { id } });
  return new Response(null, { status: 204 });
}