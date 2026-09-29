import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  recipient: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(30),
  country: z.string().trim().min(2).max(60).default('Angola'),
  province: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(3).max(250),
  postalCode: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(250).optional(),
  isDefault: z.boolean().default(false),
});
const paymentSchema = z.object({
  type: z.enum(['MULTICAIXA_REFERENCE', 'MULTICAIXA_EXPRESS', 'CARD', 'TRANSFER']),
  label: z.string().trim().min(2).max(80),
  lastFour: z.string().regex(/^\d{4}$/).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  providerToken: z.string().trim().max(255).optional(),
  isDefault: z.boolean().default(false),
});

function segments(request: Request) {
  return new URL(request.url).pathname.split('/').filter(Boolean).slice(2);
}

async function getUserId(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return null;
  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true } });
  return user?.id || null;
}

function invalidId(value?: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse('Authentication required', 401);
  const [resource] = segments(request);
  if (resource === 'addresses') {
    return Response.json({ data: await prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }) });
  }
  if (resource === 'payment-methods') {
    return Response.json({ data: await prisma.savedPaymentMethod.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }) });
  }
  if (resource === 'coupons') {
    const coupons = await prisma.userCoupon.findMany({ where: { userId }, include: { coupon: true }, orderBy: { claimedAt: 'desc' } });
    return Response.json({ data: coupons.map(({ coupon, ...assignment }) => ({
      ...coupon,
      ...assignment,
      discountValue: coupon.discountValue.toString(),
      minimumOrderKZ: coupon.minimumOrderKZ?.toString(),
    })) });
  }
  return errorResponse('Not found', 404);
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse('Authentication required', 401);
  const [resource, id, action] = segments(request);
  const body = await readJson(request);

  if (resource === 'addresses' && !id) {
    const parsed = addressSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Dados de endereço inválidos', 400);
    if (parsed.data.isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return Response.json({ data: await prisma.address.create({ data: { ...parsed.data, userId } }) }, { status: 201 });
  }
  if (resource === 'addresses' && action === 'default') {
    const addressId = invalidId(id);
    if (!addressId) return errorResponse('Endereço não encontrado', 404);
    try {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return Response.json({ data: await prisma.address.update({ where: { id: addressId, userId }, data: { isDefault: true } }) });
    } catch {
      return errorResponse('Endereço não encontrado', 404);
    }
  }
  if (resource === 'payment-methods' && !id) {
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Dados de pagamento inválidos', 400);
    if (parsed.data.isDefault) await prisma.savedPaymentMethod.updateMany({ where: { userId }, data: { isDefault: false } });
    return Response.json({ data: await prisma.savedPaymentMethod.create({ data: { ...parsed.data, userId } }) }, { status: 201 });
  }
  if (resource === 'payment-methods' && action === 'default') {
    const methodId = invalidId(id);
    if (!methodId) return errorResponse('Método não encontrado', 404);
    try {
      await prisma.savedPaymentMethod.updateMany({ where: { userId }, data: { isDefault: false } });
      return Response.json({ data: await prisma.savedPaymentMethod.update({ where: { id: methodId, userId }, data: { isDefault: true } }) });
    } catch {
      return errorResponse('Método não encontrado', 404);
    }
  }
  if (resource === 'coupons' && id === 'claim') {
    const parsed = z.string().trim().min(3).max(40).safeParse((body as { code?: unknown } | undefined)?.code);
    if (!parsed.success) return errorResponse('Código inválido', 400);
    const coupon = await prisma.coupon.findFirst({
      where: { code: parsed.data.toUpperCase(), active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    if (!coupon) return errorResponse('Cupão inválido ou expirado', 404);
    try {
      const userCoupon = await prisma.userCoupon.create({ data: { userId, couponId: coupon.id }, include: { coupon: true } });
      return Response.json({ data: userCoupon }, { status: 201 });
    } catch {
      return errorResponse('Este cupão já está na sua conta', 409);
    }
  }
  return errorResponse('Not found', 404);
}

export async function PATCH(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse('Authentication required', 401);
  const [resource, value] = segments(request);
  const id = invalidId(value);
  if (resource !== 'addresses' || !id) return errorResponse('Dados de endereço inválidos', 400);
  const parsed = addressSchema.partial().safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Dados de endereço inválidos', 400);
  if (parsed.data.isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
  try {
    return Response.json({ data: await prisma.address.update({ where: { id, userId }, data: parsed.data }) });
  } catch {
    return errorResponse('Endereço não encontrado', 404);
  }
}

export async function DELETE(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse('Authentication required', 401);
  const [resource, value] = segments(request);
  const id = invalidId(value);
  if (!id) return errorResponse(resource === 'addresses' ? 'Endereço não encontrado' : 'Método não encontrado', 404);
  try {
    if (resource === 'addresses') await prisma.address.delete({ where: { id, userId } });
    else if (resource === 'payment-methods') await prisma.savedPaymentMethod.delete({ where: { id, userId } });
    else return errorResponse('Not found', 404);
    return new Response(null, { status: 204 });
  } catch {
    return errorResponse(resource === 'addresses' ? 'Endereço não encontrado' : 'Método não encontrado', 404);
  }
}