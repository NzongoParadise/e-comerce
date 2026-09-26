import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();
const returnSchema = z.object({
  orderId: z.number().int().positive(),
  type: z.enum(['RETURN', 'EXCHANGE', 'COMPLAINT']),
  reason: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
});

type AuthenticatedRequest = Request & { user?: { sub?: string } };

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = returnSchema.safeParse(req.body);
  if (!parsed.success || !req.user?.sub) return res.status(400).json({ error: 'Invalid return request data' });

  const user = await prisma.user.findUnique({ where: { externalId: req.user.sub } });
  if (!user) return res.status(401).json({ error: 'User profile not found' });
  const order = await prisma.order.findFirst({ where: { id: parsed.data.orderId, userId: user.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const requestNumber = `DV${new Date().getFullYear()}${String(Date.now()).slice(-8)}`;
  const request = await prisma.returnRequest.create({
    data: { ...parsed.data, requestNumber, userId: user.id },
  });
  return res.status(201).json({ data: request });
});

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.sub) return res.status(401).json({ error: 'Authentication required' });
  const requests = await prisma.returnRequest.findMany({ where: { user: { externalId: req.user.sub } }, include: { order: true }, orderBy: { createdAt: 'desc' } });
  return res.json({ data: requests });
});

export default router;
