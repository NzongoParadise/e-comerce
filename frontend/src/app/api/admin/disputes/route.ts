import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  const disputes = await prisma.stripeDispute.findMany({
    orderBy: { createdAt: 'desc' },
    include: { payment: { select: { id: true, status: true, currency: true, grossAmount: true, stripePaymentIntentId: true, order: { select: { orderNumber: true } } } } },
  });
  return Response.json({ data: disputes });
}
