import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();
type AuthenticatedRequest = Request & { user?: string | jwt.JwtPayload };

async function getUserId(req: AuthenticatedRequest) {
  const subject = req.user && typeof req.user !== 'string' ? req.user.sub : undefined;
  if (!subject || typeof subject !== 'string') return null;
  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true } });
  return user?.id || null;
}

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40), recipient: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(30), country: z.string().trim().min(2).max(60).default('Angola'),
  province: z.string().trim().min(2).max(80), city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(3).max(250), postalCode: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(250).optional(), isDefault: z.boolean().default(false),
});
const paymentSchema = z.object({
  type: z.enum(['MULTICAIXA_REFERENCE', 'MULTICAIXA_EXPRESS', 'CARD', 'TRANSFER']),
  label: z.string().trim().min(2).max(80), lastFour: z.string().regex(/^\d{4}$/).optional(),
  phoneNumber: z.string().trim().max(30).optional(), providerToken: z.string().trim().max(255).optional(), isDefault: z.boolean().default(false),
});

router.get('/addresses', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  return res.json({ data: await prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }) });
});
router.post('/addresses', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); const parsed = addressSchema.safeParse(req.body);
  if (!userId) return res.status(401).json({ error: 'Authentication required' }); if (!parsed.success) return res.status(400).json({ error: 'Dados de endereço inválidos' });
  if (parsed.data.isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
  return res.status(201).json({ data: await prisma.address.create({ data: { ...parsed.data, userId } }) });
});
router.patch('/addresses/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); const id = Number(req.params.id); const parsed = addressSchema.partial().safeParse(req.body);
  if (!userId) return res.status(401).json({ error: 'Authentication required' }); if (!Number.isInteger(id) || !parsed.success) return res.status(400).json({ error: 'Dados de endereço inválidos' });
  if (parsed.data.isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
  try { return res.json({ data: await prisma.address.update({ where: { id, userId }, data: parsed.data }) }); } catch { return res.status(404).json({ error: 'Endereço não encontrado' }); }
});
router.delete('/addresses/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); const id = Number(req.params.id); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  try { await prisma.address.delete({ where: { id, userId } }); return res.status(204).send(); } catch { return res.status(404).json({ error: 'Endereço não encontrado' }); }
});
router.post('/addresses/:id/default', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); const id = Number(req.params.id); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  try {
    await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return res.json({ data: await prisma.address.update({ where: { id, userId }, data: { isDefault: true } }) });
  } catch { return res.status(404).json({ error: 'Endereço não encontrado' }); }
});

router.get('/payment-methods', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  return res.json({ data: await prisma.savedPaymentMethod.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }) });
});
router.post('/payment-methods', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); const parsed = paymentSchema.safeParse(req.body);
  if (!userId) return res.status(401).json({ error: 'Authentication required' }); if (!parsed.success) return res.status(400).json({ error: 'Dados de pagamento inválidos' });
  if (parsed.data.isDefault) await prisma.savedPaymentMethod.updateMany({ where: { userId }, data: { isDefault: false } });
  return res.status(201).json({ data: await prisma.savedPaymentMethod.create({ data: { ...parsed.data, userId } }) });
});
router.delete('/payment-methods/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); const id = Number(req.params.id); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  try { await prisma.savedPaymentMethod.delete({ where: { id, userId } }); return res.status(204).send(); } catch { return res.status(404).json({ error: 'Método não encontrado' }); }
});
router.post('/payment-methods/:id/default', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); const id = Number(req.params.id); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  try {
    await prisma.savedPaymentMethod.updateMany({ where: { userId }, data: { isDefault: false } });
    return res.json({ data: await prisma.savedPaymentMethod.update({ where: { id, userId }, data: { isDefault: true } }) });
  } catch { return res.status(404).json({ error: 'Método não encontrado' }); }
});

router.get('/coupons', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const coupons = await prisma.userCoupon.findMany({ where: { userId }, include: { coupon: true }, orderBy: { claimedAt: 'desc' } });
  return res.json({ data: coupons.map(({ coupon, ...assignment }) => ({ ...coupon, ...assignment, discountValue: coupon.discountValue.toString(), minimumOrderKZ: coupon.minimumOrderKZ?.toString() })) });
});
router.post('/coupons/claim', async (req: AuthenticatedRequest, res: Response) => {
  const userId = await getUserId(req); const code = z.string().trim().min(3).max(40).safeParse(req.body.code);
  if (!userId) return res.status(401).json({ error: 'Authentication required' }); if (!code.success) return res.status(400).json({ error: 'Código inválido' });
  const coupon = await prisma.coupon.findFirst({ where: { code: code.data.toUpperCase(), active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  if (!coupon) return res.status(404).json({ error: 'Cupão inválido ou expirado' });
  try { return res.status(201).json({ data: await prisma.userCoupon.create({ data: { userId, couponId: coupon.id }, include: { coupon: true } }) }); } catch { return res.status(409).json({ error: 'Este cupão já está na sua conta' }); }
});

export default router;