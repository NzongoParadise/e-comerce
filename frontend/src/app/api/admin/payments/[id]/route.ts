import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';

export const runtime = 'nodejs';

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse('Authentication required', 401) };
  if (!isAdmin(user)) return { error: errorResponse('Administrator access required', 403) };
  return { user };
}

function getId(request: Request) {
  const value = Number(new URL(request.url).pathname.split('/').filter(Boolean).at(-1));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = getId(request);
  if (id === null) return errorResponse('Invalid payment id', 400);

  const payment = await prisma.payment.findFirst({
    where: { id, provider: 'stripe' },
    include: {
      order: { include: { items: true } },
      user: { select: { id: true, name: true, email: true, accountName: true } },
      refunds: { orderBy: { createdAt: 'desc' } },
      disputes: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'desc' }, take: 100 },
    },
  });
  if (!payment) return errorResponse('Stripe payment not found', 404);
  return Response.json({ data: payment });
}
