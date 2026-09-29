import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const inviteSchema = z.object({ email: z.string().email(), accessRole: z.string().min(2).max(40) });

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

export async function GET(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, accessRole: true, status: true, lastLoginAt: true, accountType: true },
    });
    return Response.json({ data: users });
  } catch (error) {
    console.error('Error listing users:', error);
    return errorResponse('Unable to load users', 503);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  if (segments[2] !== 'invite') return errorResponse('Not found', 404);
  const parsed = inviteSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid invitation data', 400);
  return Response.json({ message: `Invitation queued for ${parsed.data.email}` }, { status: 202 });
}