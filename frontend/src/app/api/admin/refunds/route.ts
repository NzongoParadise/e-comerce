import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  const refunds = await prisma.stripeRefund.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { payment: { select: { id: true, stripePaymentIntentId: true, order: { select: { orderNumber: true } } } } },
  });
  return Response.json({ data: refunds });
}
