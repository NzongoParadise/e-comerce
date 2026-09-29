import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const returnSchema = z.object({
  orderId: z.number().int().positive(),
  type: z.enum(['RETURN', 'EXCHANGE', 'COMPLAINT']),
  reason: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse('Authentication required', 401);
  const parsed = returnSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid return request data', 400);
  const user = await prisma.user.findUnique({ where: { externalId: subject } });
  if (!user) return errorResponse('User profile not found', 401);
  const order = await prisma.order.findFirst({ where: { id: parsed.data.orderId, userId: user.id } });
  if (!order) return errorResponse('Order not found', 404);
  const requestNumber = `DV${new Date().getFullYear()}${String(Date.now()).slice(-8)}`;
  const returnRequest = await prisma.returnRequest.create({ data: { ...parsed.data, requestNumber, userId: user.id } });
  return Response.json({ data: returnRequest }, { status: 201 });
}

export async function GET(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse('Authentication required', 401);
  const requests = await prisma.returnRequest.findMany({
    where: { user: { externalId: subject } },
    include: { order: true },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json({ data: requests });
}