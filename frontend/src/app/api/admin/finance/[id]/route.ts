import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const updateSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  description: z.string().trim().min(3).max(180).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  amount: z.coerce.number().positive().max(1_000_000_000_000).optional(),
  currency: z.enum(['AOA', 'EUR']).optional(),
  status: z.enum(['PENDING', 'CONFIRMED']).optional(),
  transactionDate: z.coerce.date().optional(),
  reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  note: z.string().trim().min(8).max(500),
}).refine((data) => Object.keys(data).some((key) => key !== 'note'), {
  message: 'Indique pelo menos um campo para atualizar',
});
const cancelSchema = z.object({ note: z.string().trim().min(8).max(500) });

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse('Authentication required', 401) };
  if (!isAdmin(user)) return { error: errorResponse('Administrator access required', 403) };
  return { user };
}

function entryId(request: Request) {
  const value = Number(new URL(request.url).pathname.split('/').filter(Boolean).at(-1));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function snapshot(entry: {
  type: string;
  description: string;
  category: string;
  amount: { toString(): string };
  currency: string;
  status: string;
  transactionDate: Date;
  reference: string | null;
  notes: string | null;
}) {
  return {
    type: entry.type,
    description: entry.description,
    category: entry.category,
    amount: entry.amount.toString(),
    currency: entry.currency,
    status: entry.status,
    transactionDate: entry.transactionDate.toISOString(),
    reference: entry.reference,
    notes: entry.notes,
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = entryId(request);
  if (id === null) return errorResponse('Invalid finance entry id', 400);
  const entry = await prisma.financeEntry.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: 'desc' } } },
  });
  if (!entry) return errorResponse('Finance entry not found', 404);
  return Response.json({ data: entry });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = entryId(request);
  if (id === null) return errorResponse('Invalid finance entry id', 400);
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid finance entry update', 400, parsed.error.flatten().fieldErrors);
  const { note, ...changes } = parsed.data;
  const actor = userSubject(auth.user);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.financeEntry.findUnique({ where: { id } });
      if (!current) return { kind: 'NOT_FOUND' as const };
      if (current.status === 'CANCELLED') return { kind: 'ALREADY_CANCELLED' as const };
      const updated = await transaction.financeEntry.update({
        where: { id },
        data: {
          ...changes,
          ...(changes.reference !== undefined ? { reference: changes.reference || null } : {}),
          ...(changes.notes !== undefined ? { notes: changes.notes || null } : {}),
          updatedBy: actor,
        },
      });
      await transaction.financeEntryEvent.create({
        data: {
          entryId: id,
          actorExternalId: actor,
          eventType: 'UPDATED',
          payload: { before: snapshot(current), after: snapshot(updated), note },
        },
      });
      return { kind: 'UPDATED' as const, entry: await transaction.financeEntry.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: 'desc' } } } }) };
    });
    if (result.kind === 'NOT_FOUND') return errorResponse('Finance entry not found', 404);
    if (result.kind === 'ALREADY_CANCELLED') return errorResponse('Movimentos cancelados não podem ser editados.', 409);
    return Response.json({ data: result.entry });
  } catch (error) {
    console.error('Unable to update finance entry:', error);
    return errorResponse('Unable to update finance entry', 503);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = entryId(request);
  if (id === null) return errorResponse('Invalid finance entry id', 400);
  const parsed = cancelSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('A justificativa deve ter pelo menos 8 caracteres.', 400);
  const actor = userSubject(auth.user);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.financeEntry.findUnique({ where: { id } });
      if (!current) return { kind: 'NOT_FOUND' as const };
      if (current.status === 'CANCELLED') return { kind: 'ALREADY_CANCELLED' as const };
      const updated = await transaction.financeEntry.update({
        where: { id },
        data: { status: 'CANCELLED', updatedBy: actor },
      });
      await transaction.financeEntryEvent.create({
        data: {
          entryId: id,
          actorExternalId: actor,
          eventType: 'CANCELLED',
          payload: { before: snapshot(current), after: snapshot(updated), note: parsed.data.note },
        },
      });
      return { kind: 'CANCELLED' as const };
    });
    if (result.kind === 'NOT_FOUND') return errorResponse('Finance entry not found', 404);
    if (result.kind === 'ALREADY_CANCELLED') return errorResponse('Este movimento já está cancelado.', 409);
    return Response.json({ data: { id, status: 'CANCELLED' } });
  } catch (error) {
    console.error('Unable to cancel finance entry:', error);
    return errorResponse('Unable to cancel finance entry', 503);
  }
}