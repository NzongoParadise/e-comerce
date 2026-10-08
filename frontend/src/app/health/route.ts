import { prisma } from '@/lib/server/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok', database: 'ok' });
  } catch (error) {
    console.error('Database health check failed:', error);
    return Response.json({ status: 'error', database: 'unavailable' }, { status: 503 });
  }
}