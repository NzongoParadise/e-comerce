import { prisma } from '@/lib/server/prisma';
import { normalizeSupplierData, supplierSchema } from '@/lib/server/suppliers';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const querySchema = z.object({
  search: z.string().trim().max(160).default(''),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).default('ALL'),
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
  if (!parsed.success) return errorResponse('Invalid supplier query', 400);
  const { search, status, page, pageSize } = parsed.data;
  const baseWhere = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      { contactName: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
      { phone: { contains: search, mode: 'insensitive' as const } },
      { taxId: { contains: search, mode: 'insensitive' as const } },
      { city: { contains: search, mode: 'insensitive' as const } },
    ],
  } : {};
  const where = { ...baseWhere, ...(status === 'ALL' ? {} : { active: status === 'ACTIVE' }) };
  try {
    const [data, total, active, inactive, angola, portugal] = await prisma.$transaction([
      prisma.supplier.findMany({ where, orderBy: [{ active: 'desc' }, { name: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.supplier.count({ where }),
      prisma.supplier.count({ where: { ...baseWhere, active: true } }),
      prisma.supplier.count({ where: { ...baseWhere, active: false } }),
      prisma.supplier.count({ where: { ...baseWhere, country: 'Angola' } }),
      prisma.supplier.count({ where: { ...baseWhere, country: 'Portugal' } }),
    ]);
    return Response.json({ data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) }, stats: { total: active + inactive, active, inactive, angola, portugal } });
  } catch (error) {
    console.error('Error listing suppliers:', error);
    return errorResponse('Unable to load suppliers', 503);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = supplierSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid supplier data', 400, parsed.error.flatten().fieldErrors);
  try {
    const supplier = await prisma.supplier.create({ data: normalizeSupplierData(parsed.data) });
    return Response.json({ data: supplier }, { status: 201 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Já existe um fornecedor com este NIF no país indicado.', 409);
    console.error('Error creating supplier:', error);
    return errorResponse('Unable to create supplier', 503);
  }
}