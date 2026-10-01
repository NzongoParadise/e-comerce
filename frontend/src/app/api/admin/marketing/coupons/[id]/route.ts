import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const updateSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()).optional(),
  description: z.string().trim().min(5).max(240).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  discountValue: z.coerce.number().positive().max(1_000_000).optional(),
  minimumOrderKZ: z.coerce.number().nonnegative().max(1_000_000_000).nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'Indique campos para atualizar' });

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

function couponId(request: Request) {
  const value = Number(new URL(request.url).pathname.split('/').filter(Boolean).at(-1));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function GET(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = couponId(request);
  if (id === null) return errorResponse('Invalid coupon id', 400);
  const coupon = await prisma.coupon.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!coupon) return errorResponse('Coupon not found', 404);
  return Response.json({ data: coupon });
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = couponId(request);
  if (id === null) return errorResponse('Invalid coupon id', 400);
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid coupon update', 400, parsed.error.flatten().fieldErrors);

  try {
    const current = await prisma.coupon.findUnique({ where: { id } });
    if (!current) return errorResponse('Coupon not found', 404);
    const nextType = parsed.data.discountType || current.discountType;
    const nextValue = parsed.data.discountValue ?? Number(current.discountValue);
    if (nextType === 'PERCENTAGE' && nextValue > 100) return errorResponse('A percentagem máxima é 100.', 400);
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(parsed.data.minimumOrderKZ !== undefined ? { minimumOrderKZ: parsed.data.minimumOrderKZ } : {}),
        ...(parsed.data.expiresAt !== undefined ? { expiresAt: parsed.data.expiresAt } : {}),
      },
      include: { _count: { select: { users: true } } },
    });
    return Response.json({ data: coupon });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return errorResponse('Este código de cupão já existe.', 409);
    console.error('Unable to update marketing coupon:', error);
    return errorResponse('Unable to update coupon', 503);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = couponId(request);
  if (id === null) return errorResponse('Invalid coupon id', 400);
  try {
    const coupon = await prisma.coupon.update({
      where: { id },
      data: { active: false },
      include: { _count: { select: { users: true } } },
    });
    return Response.json({ data: coupon });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') return errorResponse('Coupon not found', 404);
    console.error('Unable to deactivate marketing coupon:', error);
    return errorResponse('Unable to deactivate coupon', 503);
  }
}