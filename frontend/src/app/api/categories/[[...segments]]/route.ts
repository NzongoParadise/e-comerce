import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
});

function categoryId(request: Request) {
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
  const id = categoryId(request);
  if (id !== null) {
    if (!Number.isInteger(id)) return errorResponse('Invalid category id', 400);
    const category = await prisma.category.findUnique({ where: { id }, include: { products: { select: { id: true } } } });
    if (!category) return errorResponse('Category not found', 404);
    return Response.json({ data: { ...category, productCount: category.products.length, products: undefined } });
  }

  try {
    const categories = await prisma.category.findMany({
      include: { products: { select: { id: true } } },
      orderBy: { name: 'asc' },
    });
    return Response.json({ data: categories.map(({ id: categoryId, name, slug, products }) => ({
      id: categoryId,
      name,
      slug,
      productCount: products.length,
    })) });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = categorySchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid category data', 400, parsed.error.flatten().fieldErrors);

  try {
    const category = await prisma.category.create({ data: parsed.data });
    return Response.json({ data: { ...category, productCount: 0 } }, { status: 201 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Category name or slug already exists', 409);
    console.error('Error creating category:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = categoryId(request);
  if (id === null || !Number.isInteger(id)) return errorResponse('Invalid category id', 400);
  const parsed = categorySchema.partial().safeParse(await readJson(request));
  if (!parsed.success || !Object.keys(parsed.data).length) return errorResponse('Invalid category data', 400);

  try {
    const category = await prisma.category.update({ where: { id }, data: parsed.data, include: { products: { select: { id: true } } } });
    return Response.json({ data: { ...category, productCount: category.products.length, products: undefined } });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Category not found', 404);
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Category name or slug already exists', 409);
    console.error('Error updating category:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = categoryId(request);
  if (id === null || !Number.isInteger(id)) return errorResponse('Invalid category id', 400);
  const category = await prisma.category.findUnique({ where: { id }, include: { products: { select: { id: true }, take: 1 } } });
  if (!category) return errorResponse('Category not found', 404);
  if (category.products.length) return errorResponse('Cannot delete a category with products', 409);
  await prisma.category.delete({ where: { id } });
  return new Response(null, { status: 204 });
}