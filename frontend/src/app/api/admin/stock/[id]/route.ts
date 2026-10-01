import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const stockChangeSchema = z.object({
  action: z.enum(['IN', 'OUT', 'SET']),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
}).refine((value) => value.action === 'SET' || value.quantity > 0, { message: 'A quantidade deve ser maior que zero.' });

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

function productId(request: Request) {
  const id = Number(new URL(request.url).pathname.split('/').filter(Boolean).at(-1));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = productId(request);
  if (id === null) return errorResponse('Invalid product id', 400);
  const parsed = stockChangeSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid stock movement', 400, parsed.error.flatten().fieldErrors);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findUnique({ where: { id }, select: { id: true, name: true, stock: true } });
      if (!product) return { kind: 'NOT_FOUND' as const };
      if (parsed.data.action === 'OUT' && product.stock < parsed.data.quantity) return { kind: 'INSUFFICIENT' as const };
      const nextStock = parsed.data.action === 'IN'
        ? product.stock + parsed.data.quantity
        : parsed.data.action === 'OUT'
          ? product.stock - parsed.data.quantity
          : parsed.data.quantity;
      const updated = await transaction.product.updateMany({
        where: { id, stock: product.stock },
        data: { stock: nextStock },
      });
      if (updated.count !== 1) return { kind: 'CONFLICT' as const };
      return { kind: 'UPDATED' as const, data: { id, name: product.name, previousStock: product.stock, stock: nextStock } };
    }, { isolationLevel: 'Serializable' });

    if (result.kind === 'NOT_FOUND') return errorResponse('Product not found', 404);
    if (result.kind === 'INSUFFICIENT') return errorResponse('Stock insuficiente para esta saída.', 409);
    if (result.kind === 'CONFLICT') return errorResponse('O stock foi alterado por outro operador. Atualize a lista e tente novamente.', 409);
    return Response.json({ data: result.data });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2034') return errorResponse('O stock mudou durante esta operação. Atualize a lista e tente novamente.', 409);
    console.error('Unable to change stock:', error);
    return errorResponse('Unable to change stock', 503);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = productId(request);
  if (id === null) return errorResponse('Invalid product id', 400);
  try {
    await prisma.product.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Product not found', 404);
    if (prismaErrorCode(error) === 'P2003') return errorResponse('Produto associado a encomendas ou cotações não pode ser excluído.', 409);
    console.error('Unable to delete inventory product:', error);
    return errorResponse('Unable to delete inventory product', 503);
  }
}