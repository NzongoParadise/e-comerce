import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';

export const runtime = 'nodejs';

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

function subscriberId(request: Request) {
  const value = Number(new URL(request.url).pathname.split('/').filter(Boolean).at(-1));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = subscriberId(request);
  if (id === null) return errorResponse('Invalid subscriber id', 400);
  try {
    await prisma.newsletterSubscriber.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') return errorResponse('Subscriber not found', 404);
    console.error('Unable to remove newsletter subscriber:', error);
    return errorResponse('Unable to remove subscriber', 503);
  }
}