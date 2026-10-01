import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const updateClientSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
  accountType: z.enum(['B2C', 'B2B']).optional(),
  accountName: z.string().trim().min(2).max(120).optional(),
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

function clientId(request: Request) {
  const value = Number(new URL(request.url).pathname.split('/').filter(Boolean).at(-1));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function GET(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = clientId(request);
  if (id === null) return errorResponse('Invalid client id', 400);
  const client = await prisma.user.findFirst({
    where: { id, accessRole: 'CUSTOMER' },
    select: { id: true, name: true, email: true, accountName: true, accountType: true, status: true, createdAt: true, lastLoginAt: true, _count: { select: { orders: true } } },
  });
  if (!client) return errorResponse('Client not found', 404);
  return Response.json({ data: client });
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = clientId(request);
  if (id === null) return errorResponse('Invalid client id', 400);
  const parsed = updateClientSchema.safeParse(await readJson(request));
  if (!parsed.success || !Object.keys(parsed.data).length) return errorResponse('Invalid client data', 400, parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  try {
    const current = await prisma.user.findFirst({ where: { id, accessRole: 'CUSTOMER' }, select: { id: true, name: true, accountName: true, accountType: true } });
    if (!current) return errorResponse('Client not found', 404);
    const nextAccountType = parsed.data.accountType || current.accountType;
    const accountNameIsDefault = current.accountName === 'Conta Retalhista'
      || (current.accountType === 'B2B' && (current.accountName === current.name || current.accountName === 'Conta Grossista'));
    const accountNameUnchanged = parsed.data.accountName === undefined || parsed.data.accountName === current.accountName;
    const shouldUpdateDefaultName = accountNameIsDefault
      && accountNameUnchanged
      && (nextAccountType !== current.accountType || (nextAccountType === 'B2B' && Boolean(parsed.data.name)));
    const data = {
      ...parsed.data,
      ...(shouldUpdateDefaultName
        ? { accountName: nextAccountType === 'B2B' ? parsed.data.name || current.name || 'Conta Grossista' : 'Conta Retalhista' }
        : {}),
    };
    const client = await prisma.user.update({
      where: { id: current.id },
      data,
      select: { id: true, name: true, email: true, accountName: true, accountType: true, status: true, createdAt: true, lastLoginAt: true, _count: { select: { orders: true } } },
    });
    return Response.json({ data: client });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Já existe uma conta com este email.', 409);
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Client not found', 404);
    console.error('Unable to update client:', error);
    return errorResponse('Unable to update client', 503);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = clientId(request);
  if (id === null) return errorResponse('Invalid client id', 400);
  const client = await prisma.user.findFirst({ where: { id, accessRole: 'CUSTOMER' }, select: { id: true } });
  if (!client) return errorResponse('Client not found', 404);
  try {
    await prisma.user.delete({ where: { id: client.id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2003') return errorResponse('Este cliente tem encomendas ou registos associados e não pode ser excluído.', 409);
    console.error('Unable to delete client:', error);
    return errorResponse('Unable to delete client', 503);
  }
}