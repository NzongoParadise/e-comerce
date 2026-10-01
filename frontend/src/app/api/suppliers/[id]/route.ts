import { prisma } from '@/lib/server/prisma';
import { normalizeSupplierData, supplierUpdateSchema } from '@/lib/server/suppliers';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson } from '@/lib/server/api';

export const runtime = 'nodejs';

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

function supplierId(request: Request) {
  const id = Number(new URL(request.url).pathname.split('/').filter(Boolean).at(-1));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = supplierId(request);
  if (id === null) return errorResponse('Invalid supplier id', 400);
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) return errorResponse('Supplier not found', 404);
  return Response.json({ data: supplier });
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = supplierId(request);
  if (id === null) return errorResponse('Invalid supplier id', 400);
  const parsed = supplierUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return errorResponse('Invalid supplier data', 400, parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  try {
    const supplier = await prisma.supplier.update({ where: { id }, data: normalizeSupplierData(parsed.data) });
    return Response.json({ data: supplier });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Supplier not found', 404);
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Já existe um fornecedor com este NIF no país indicado.', 409);
    console.error('Error updating supplier:', error);
    return errorResponse('Unable to update supplier', 503);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = supplierId(request);
  if (id === null) return errorResponse('Invalid supplier id', 400);
  try {
    await prisma.supplier.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Supplier not found', 404);
    console.error('Error deleting supplier:', error);
    return errorResponse('Unable to delete supplier', 503);
  }
}