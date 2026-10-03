import { prisma } from '@/lib/server/prisma';
import { errorResponse, rateLimit, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const subscribeSchema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  const limit = rateLimit(request, 'newsletter:subscribe', 10, 15 * 60_000);
  if (limit) return limit;
  const parsed = subscribeSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid email address', 400, parsed.error.flatten().fieldErrors);

  try {
    const email = parsed.data.email.toLowerCase();
    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {},
      create: { email },
      select: { id: true, email: true, createdAt: true },
    });
    return Response.json({ data: subscriber });
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    return errorResponse('Internal server error', 500);
  }
}