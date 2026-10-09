import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, readJson, userSubject } from '@/lib/server/api';
import { detachStripePaymentMethod, ensureStripeCustomer, setStripeDefaultPaymentMethod } from '@/lib/server/payments/stripeCustomers';
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
  type: z.enum(['MULTICAIXA_REFERENCE', 'MULTICAIXA_EXPRESS', 'CARD', 'MBWAY', 'TRANSFER']),
  label: z.string().trim().min(2).max(80),
  lastFour: z.string().regex(/^\d{4}$/).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  isDefault: z.boolean().default(false),
});

function validateSavedPaymentPayload(payload: Partial<z.infer<typeof paymentSchema>> & { label: string; isDefault: boolean }) {
  if ((payload.type === 'MBWAY' || payload.type === 'MULTICAIXA_EXPRESS') && !payload.phoneNumber) return 'O telemóvel é obrigatório para este método de pagamento.';
  return null;
}

async function createStripeCardSetup(userId: number, label: string, isDefault: boolean) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_NOT_CONFIGURED');
  const customerId = await ensureStripeCustomer(userId);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const params = new URLSearchParams({
    mode: 'setup',
    customer: customerId,
    'payment_method_types[0]': 'card',
    success_url: `${frontendUrl}/account/payment?card=added`,
    cancel_url: `${frontendUrl}/account/payment?card=cancelled`,
    client_reference_id: String(userId),
    'setup_intent_data[usage]': 'off_session',
    'setup_intent_data[metadata][userId]': String(userId),
    'setup_intent_data[metadata][label]': label,
    'setup_intent_data[metadata][isDefault]': String(isDefault),
  });
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const session = await response.json() as { url?: unknown };
  if (!response.ok || typeof session.url !== 'string') throw new Error('STRIPE_SETUP_FAILED');
  return session.url;
}

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
  if (resource === 'communication-preferences') {
    const preferences = await prisma.communicationPreference.findUnique({
      where: { userId },
      select: { promotions: true, newProducts: true, orderUpdates: true, commercialUpdates: true },
    });
    return Response.json({
      data: preferences ?? { promotions: true, newProducts: false, orderUpdates: true, commercialUpdates: true },
    });
  }
  if (resource === 'addresses') {
    return Response.json({ data: await prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }) });
  }
  if (resource === 'payment-methods') {
    const methods = await prisma.savedPaymentMethod.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
    return Response.json({ data: methods.map(({ providerToken, ...method }) => ({ ...method, stripeReady: method.type !== 'CARD' || Boolean(providerToken) })) });
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
    if (parsed.data.type === 'CARD') return errorResponse('Adicione cartões através do fluxo seguro da Stripe.', 400);
    const validationError = validateSavedPaymentPayload(parsed.data);
    if (validationError) return errorResponse(validationError, 400);
    if (parsed.data.isDefault) await prisma.savedPaymentMethod.updateMany({ where: { userId }, data: { isDefault: false } });
    return Response.json({ data: await prisma.savedPaymentMethod.create({ data: { ...parsed.data, userId } }) }, { status: 201 });
  }
  if (resource === 'payment-methods' && id === 'setup') {
    const parsed = z.object({ label: z.string().trim().min(2).max(80), isDefault: z.boolean().default(false) }).safeParse(body);
    if (!parsed.success) return errorResponse('Indique um nome válido para o cartão.', 400);
    try {
      const checkoutUrl = await createStripeCardSetup(userId, parsed.data.label, parsed.data.isDefault);
      return Response.json({ data: { checkoutUrl } });
    } catch (error) {
      if (error instanceof Error && error.message === 'STRIPE_NOT_CONFIGURED') return errorResponse('Stripe não está configurado.', 503);
      return errorResponse('Não foi possível iniciar a adição segura do cartão.', 502);
    }
  }
  if (resource === 'payment-methods' && action === 'default') {
    const methodId = invalidId(id);
    if (!methodId) return errorResponse('Método não encontrado', 404);
    try {
      const savedMethod = await prisma.savedPaymentMethod.findFirst({ where: { id: methodId, userId } });
      if (!savedMethod) return errorResponse('Método não encontrado', 404);
      if (savedMethod.type === 'CARD' && savedMethod.providerToken) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
        if (!user?.stripeCustomerId) return errorResponse('Cliente Stripe não encontrado.', 409);
        await setStripeDefaultPaymentMethod(user.stripeCustomerId, savedMethod.providerToken);
      }
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

  if (resource === 'communication-preferences') {
    const schema = z.object({
      promotions: z.boolean().optional(),
      newProducts: z.boolean().optional(),
      orderUpdates: z.boolean().optional(),
      commercialUpdates: z.boolean().optional(),
    }).strict().refine((payload) => Object.keys(payload).length > 0, "Indique pelo menos uma preferência.");
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return errorResponse('Preferências de comunicação inválidas', 400);
    const preferences = await prisma.communicationPreference.upsert({
      where: { userId },
      create: {
        userId,
        promotions: true,
        newProducts: false,
        orderUpdates: true,
        commercialUpdates: true,
        ...parsed.data,
      },
      update: parsed.data,
      select: { promotions: true, newProducts: true, orderUpdates: true, commercialUpdates: true },
    });
    return Response.json({ data: preferences });
  }

  if (resource === 'addresses') {
    if (!id) return errorResponse('Dados de endereço inválidos', 400);
    const parsed = addressSchema.partial().safeParse(await readJson(request));
    if (!parsed.success) return errorResponse('Dados de endereço inválidos', 400);
    if (parsed.data.isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    try {
      return Response.json({ data: await prisma.address.update({ where: { id, userId }, data: parsed.data }) });
    } catch {
      return errorResponse('Endereço não encontrado', 404);
    }
  }

  if (resource === 'payment-methods') {
    if (!id) return errorResponse('Método não encontrado', 404);
    const parsed = paymentSchema.partial().safeParse(await readJson(request));
    if (!parsed.success) return errorResponse('Dados de pagamento inválidos', 400);
    const validationError = parsed.data.type ? validateSavedPaymentPayload({ ...parsed.data, label: parsed.data.label ?? '', isDefault: parsed.data.isDefault ?? false }) : null;
    if (validationError) return errorResponse(validationError, 400);
    try {
      const existing = await prisma.savedPaymentMethod.findFirst({ where: { id, userId } });
      if (!existing) return errorResponse('Método não encontrado', 404);
      if (existing.type === 'CARD') {
        if (parsed.data.type && parsed.data.type !== 'CARD') return errorResponse('Não é possível alterar o tipo de um cartão guardado.', 400);
        if (parsed.data.isDefault && existing.providerToken) {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
          if (!user?.stripeCustomerId) return errorResponse('Cliente Stripe não encontrado.', 409);
          await setStripeDefaultPaymentMethod(user.stripeCustomerId, existing.providerToken);
        }
        if (parsed.data.isDefault) await prisma.savedPaymentMethod.updateMany({ where: { userId }, data: { isDefault: false } });
        return Response.json({ data: await prisma.savedPaymentMethod.update({ where: { id, userId }, data: { label: parsed.data.label, isDefault: parsed.data.isDefault } }) });
      }
      if (parsed.data.isDefault) await prisma.savedPaymentMethod.updateMany({ where: { userId }, data: { isDefault: false } });
      return Response.json({ data: await prisma.savedPaymentMethod.update({ where: { id, userId }, data: parsed.data }) });
    } catch {
      return errorResponse('Método não encontrado', 404);
    }
  }

  return errorResponse('Dados inválidos', 400);
}

export async function DELETE(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return errorResponse('Authentication required', 401);
  const [resource, value] = segments(request);
  const id = invalidId(value);
  if (!id) return errorResponse(resource === 'addresses' ? 'Endereço não encontrado' : 'Método não encontrado', 404);
  try {
    if (resource === 'addresses') await prisma.address.delete({ where: { id, userId } });
    else if (resource === 'payment-methods') {
      const savedMethod = await prisma.savedPaymentMethod.findFirst({ where: { id, userId } });
      if (!savedMethod) return errorResponse('Método não encontrado', 404);
      if (savedMethod.type === 'CARD' && savedMethod.providerToken) await detachStripePaymentMethod(savedMethod.providerToken);
      await prisma.savedPaymentMethod.delete({ where: { id, userId } });
    }
    else return errorResponse('Not found', 404);
    return new Response(null, { status: 204 });
  } catch {
    return errorResponse(resource === 'addresses' ? 'Endereço não encontrado' : 'Método não encontrado', 404);
  }
}