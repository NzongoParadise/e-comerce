import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();

const subscribeSchema = z.object({
  email: z.string().trim().email().max(254),
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = subscribeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid email address',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { email: parsed.data.email.toLowerCase() },
      update: {},
      create: { email: parsed.data.email.toLowerCase() },
      select: { id: true, email: true, createdAt: true },
    });

    return res.status(200).json({ data: subscriber });
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
