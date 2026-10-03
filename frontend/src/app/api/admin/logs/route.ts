import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const querySchema = z.object({
  level: z.enum(['INFO', 'WARN', 'ERROR', 'DEBUG']).optional(),
  source: z.string().trim().max(80).optional(),
  search: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return errorResponse('Authentication required', 401);
  if (!isAdmin(auth)) return errorResponse('Administrator access required', 403);

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse('Invalid log query', 400);

  const { page, pageSize } = parsed.data;
  return Response.json({
    data: {
      page,
      pageSize,
      total: 0,
      items: [],
      summary: { info: 0, warn: 0, error: 0, debug: 0 },
    },
    meta: {
      auditLogging: 'not_configured',
      message: 'No audit events are stored by this endpoint yet.',
    },
  });
}
