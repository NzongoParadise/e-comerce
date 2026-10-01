import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const querySchema = z.object({
  search: z.string().trim().max(120).default(''),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE', 'EXPIRED']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const couponSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  description: z.string().trim().min(5).max(240),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.coerce.number().positive().max(1_000_000),
  minimumOrderKZ: z.coerce.number().nonnegative().max(1_000_000_000).nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  active: z.boolean().default(true),
}).superRefine((coupon, context) => {
  if (coupon.discountType === 'PERCENTAGE' && coupon.discountValue > 100) {
    context.addIssue({ code: 'custom', path: ['discountValue'], message: 'A percentagem máxima é 100.' });
  }
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse('Authentication required', 401) };
  if (!isAdmin(user)) return { error: errorResponse('Administrator access required', 403) };
  return { user };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse('Invalid coupon query', 400);
  const { search, status, page, pageSize } = parsed.data;
  const now = new Date();
  const filters: Prisma.CouponWhereInput[] = [];
  if (status === 'ACTIVE') filters.push({ active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
  if (status === 'INACTIVE') filters.push({ active: false });
  if (status === 'EXPIRED') filters.push({ active: true, expiresAt: { lte: now } });
  if (search) filters.push({ OR: [
      { code: { contains: search, mode: 'insensitive' as const } },
      { description: { contains: search, mode: 'insensitive' as const } },
    ] });
  const where: Prisma.CouponWhereInput = filters.length ? { AND: filters } : {};
  try {
    const [data, total, active, inactive, expired] = await prisma.$transaction([
      prisma.coupon.findMany({
        where,
        include: { _count: { select: { users: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.coupon.count({ where }),
      prisma.coupon.count({ where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
      prisma.coupon.count({ where: { active: false } }),
      prisma.coupon.count({ where: { active: true, expiresAt: { lte: now } } }),
    ]);
    return Response.json({ data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) }, stats: { active, inactive, expired } });
  } catch (error) {
    console.error('Unable to list marketing coupons:', error);
    return errorResponse('Unable to load coupons', 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = couponSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid coupon data', 400, parsed.error.flatten().fieldErrors);
  try {
    const coupon = await prisma.coupon.create({
      data: {
        ...parsed.data,
        minimumOrderKZ: parsed.data.minimumOrderKZ ?? null,
        expiresAt: parsed.data.expiresAt ?? null,
      },
    });
    return Response.json({ data: coupon }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return errorResponse('Este código de cupão já existe.', 409);
    console.error('Unable to create marketing coupon:', error, 'actor', userSubject(auth.user));
    return errorResponse('Unable to create coupon', 503);
  }
}