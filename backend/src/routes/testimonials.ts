import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { jwtAuth } from '../authMiddleware';
import { requireAdmin } from '../adminMiddleware';

const router = Router();
const testimonialSchema = z.object({
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120),
  text: z.string().trim().min(10).max(1000),
  stars: z.coerce.number().int().min(1).max(5),
  published: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

const submissionSchema = testimonialSchema.pick({ name: true, location: true, text: true }).extend({
  stars: z.coerce.number().int().min(1).max(5).default(5),
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { published: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return res.json({ data: testimonials });
  } catch (error) {
    console.error('Error listing testimonials:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin', jwtAuth, requireAdmin, async (_req: Request, res: Response) => {
  const testimonials = await prisma.testimonial.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }] });
  return res.json({ data: testimonials });
});

router.post('/submit', async (req: Request, res: Response) => {
  const parsed = submissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid testimonial submission', details: parsed.error.flatten().fieldErrors });
  try {
    const testimonial = await prisma.testimonial.create({ data: { ...parsed.data, published: false } });
    return res.status(201).json({ data: { id: testimonial.id, status: 'PENDING_REVIEW' } });
  } catch (error) {
    console.error('Error submitting testimonial:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const parsed = testimonialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid testimonial data', details: parsed.error.flatten().fieldErrors });
  const testimonial = await prisma.testimonial.create({ data: parsed.data });
  return res.status(201).json({ data: testimonial });
});

router.patch('/:id', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = testimonialSchema.partial().safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ error: 'Invalid testimonial data' });
  try {
    const testimonial = await prisma.testimonial.update({ where: { id }, data: parsed.data });
    return res.json({ data: testimonial });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Testimonial not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', jwtAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid testimonial id' });
  try {
    await prisma.testimonial.delete({ where: { id } });
    return res.status(204).send();
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Testimonial not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
