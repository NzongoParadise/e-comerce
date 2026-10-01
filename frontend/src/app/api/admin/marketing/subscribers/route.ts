import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const querySchema = z.object({
  search: z.string().trim().max(160).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
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
  if (!parsed.success) return errorResponse('Invalid subscriber query', 400);
  const { search, page, pageSize } = parsed.data;
  const where = search ? { email: { contains: search, mode: 'insensitive' as const } } : {};
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  try {
    const [data, total, newThisMonth] = await prisma.$transaction([
      prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.newsletterSubscriber.count({ where }),
      prisma.newsletterSubscriber.count({ where: { createdAt: { gte: monthStart } } }),
    ]);
    return Response.json({ data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) }, stats: { total: await prisma.newsletterSubscriber.count(), newThisMonth } });
  } catch (error) {
    console.error('Unable to load newsletter subscribers:', error);
    return errorResponse('Unable to load subscribers', 503);
  }
}