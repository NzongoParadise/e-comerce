import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const querySchema = z.object({
  search: z.string().trim().max(160).default(''),
  role: z.enum(['ADMIN', 'CUSTOMER', 'ALL']).default('ALL'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  accessRole: z.enum(['ADMIN', 'CUSTOMER']).optional(),
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse('Authentication required', 401), user: null };
  if (!isAdmin(user)) return { error: errorResponse('Administrator access required', 403), user: null };
  return { error: null, user };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse('Invalid user query', 400, parsed.error.flatten().fieldErrors);

  const { search, role, status, page, pageSize } = parsed.data;
  const where = {
    ...(role === 'ADMIN' ? { accessRole: 'ADMIN' } : role === 'CUSTOMER' ? { accessRole: 'CUSTOMER' } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { accountName: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  try {
    const [data, total, all, admins, customers, active, inactive] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          accountName: true,
          accountType: true,
          accessRole: true,
          status: true,
          provider: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { orders: true, notifications: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({ where: { accessRole: 'ADMIN' } }),
      prisma.user.count({ where: { accessRole: 'CUSTOMER' } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'INACTIVE' } }),
    ]);

    return Response.json({
      data,
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
      stats: { total: all, admins, customers, active, inactive },
    });
  } catch (error) {
    console.error('Unable to list users:', error);
    return errorResponse('Unable to load users', 503);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid user data', 400, parsed.error.flatten().fieldErrors);

  const { id, ...changes } = parsed.data;
  try {
    const current = await prisma.user.findUnique({
      where: { id },
      select: { id: true, accessRole: true, status: true },
    });
    if (!current) return errorResponse('User not found', 404);

    const actorProfile = auth.user?.sub
      ? await prisma.user.findUnique({ where: { externalId: auth.user.sub }, select: { id: true } })
      : null;
    const changingSelf = actorProfile?.id === id;

    if (changingSelf && changes.status === 'INACTIVE') {
      return errorResponse('Não pode desativar a sua própria conta administrativa.', 409);
    }
    if (changingSelf && changes.accessRole === 'CUSTOMER') {
      return errorResponse('Não pode remover a sua própria permissão administrativa.', 409);
    }

    if (current.accessRole === 'ADMIN' && changes.accessRole === 'CUSTOMER') {
      const adminCount = await prisma.user.count({ where: { accessRole: 'ADMIN', status: 'ACTIVE' } });
      if (current.status === 'ACTIVE' && adminCount <= 1) {
        return errorResponse('É necessário manter pelo menos um administrador ativo.', 409);
      }
    }

    const data = await prisma.user.update({
      where: { id },
      data: changes,
      select: {
        id: true,
        name: true,
        email: true,
        accountName: true,
        accountType: true,
        accessRole: true,
        status: true,
        provider: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { orders: true, notifications: true } },
      },
    });
    return Response.json({ data });
  } catch (error) {
    console.error('Unable to update user:', error);
    return errorResponse('Unable to update user', 503);
  }
}
