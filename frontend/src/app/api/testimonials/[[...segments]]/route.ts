import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

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

function segments(request: Request) {
  return new URL(request.url).pathname.split('/').filter(Boolean).slice(2);
}

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

export async function GET(request: Request) {
  if (segments(request)[0] === 'admin') {
    const authError = await requireAdmin(request);
    if (authError) return authError;
    return Response.json({ data: await prisma.testimonial.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }] }) });
  }
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { published: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return Response.json({ data: testimonials });
  } catch (error) {
    console.error('Error listing testimonials:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function POST(request: Request) {
  const action = segments(request)[0];
  if (action === 'submit') {
    const parsed = submissionSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorResponse('Invalid testimonial submission', 400, parsed.error.flatten().fieldErrors);
    try {
      const testimonial = await prisma.testimonial.create({ data: { ...parsed.data, published: false } });
      return Response.json({ data: { id: testimonial.id, status: 'PENDING_REVIEW' } }, { status: 201 });
    } catch (error) {
      console.error('Error submitting testimonial:', error);
      return errorResponse('Internal server error', 500);
    }
  }
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = testimonialSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid testimonial data', 400, parsed.error.flatten().fieldErrors);
  const testimonial = await prisma.testimonial.create({ data: parsed.data });
  return Response.json({ data: testimonial }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = Number(segments(request)[0]);
  const parsed = testimonialSchema.partial().safeParse(await readJson(request));
  if (!Number.isInteger(id) || !parsed.success || !Object.keys(parsed.data).length) return errorResponse('Invalid testimonial data', 400);
  try {
    const testimonial = await prisma.testimonial.update({ where: { id }, data: parsed.data });
    return Response.json({ data: testimonial });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Testimonial not found', 404);
    return errorResponse('Internal server error', 500);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const id = Number(segments(request)[0]);
  if (!Number.isInteger(id)) return errorResponse('Invalid testimonial id', 400);
  try {
    await prisma.testimonial.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Testimonial not found', 404);
    return errorResponse('Internal server error', 500);
  }
}