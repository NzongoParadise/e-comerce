import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const createClientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  accountType: z.enum(['B2C', 'B2B']).default('B2C'),
  accountName: z.string().trim().min(2).max(120).optional(),
});
const querySchema = z.object({
  search: z.string().trim().max(160).default(''),
  accountType: z.enum(['B2C', 'B2B']).optional(),
  country: z.enum(['AO', 'PT']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  newOnly: z.enum(['true', 'false']).optional(),
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
  if (!parsed.success) return errorResponse('Invalid client query', 400);
  const { search, accountType, country, status, newOnly, page, pageSize } = parsed.data;
  const baseWhere = { accessRole: 'CUSTOMER' };
  const where = {
    ...baseWhere,
    ...(accountType ? { accountType } : {}),
    ...(status ? { status } : {}),
    ...(country ? { addresses: { some: { country: country === 'AO' ? 'Angola' : 'Portugal' } } } : {}),
    ...(newOnly === 'true' ? { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { accountName: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };
  try {
    const [data, total, totalCustomers, b2bCustomers, b2cCustomers, activeCustomers] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          accountName: true,
          accountType: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          addresses: { select: { phone: true, country: true, city: true, province: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }], take: 1 },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: baseWhere }),
      prisma.user.count({ where: { ...baseWhere, accountType: 'B2B' } }),
      prisma.user.count({ where: { ...baseWhere, accountType: 'B2C' } }),
      prisma.user.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
    ]);
    return Response.json({
      data,
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) },
      stats: { total: totalCustomers, b2b: b2bCustomers, b2c: b2cCustomers, active: activeCustomers },
    });
  } catch (error) {
    console.error('Unable to list clients:', error);
    return errorResponse('Unable to load clients', 503);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = createClientSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid client data', 400, parsed.error.flatten().fieldErrors);
  try {
    const user = await prisma.user.create({
      data: {
        externalId: `local:${randomUUID()}`,
        email: parsed.data.email,
        name: parsed.data.name,
        provider: 'local',
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        accessRole: 'CUSTOMER',
        status: 'ACTIVE',
        accountType: parsed.data.accountType,
        accountName: parsed.data.accountName || (parsed.data.accountType === 'B2B' ? parsed.data.name : 'Conta Retalhista'),
      },
      select: { id: true, name: true, email: true, accountName: true, accountType: true, status: true, createdAt: true },
    });
    return Response.json({ data: user }, { status: 201 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Já existe uma conta com este email.', 409);
    console.error('Unable to create client:', error);
    return errorResponse('Unable to create client', 503);
  }
}