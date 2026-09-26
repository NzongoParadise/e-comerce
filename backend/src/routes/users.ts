import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();
type AuthenticatedRequest = Request & { user?: string | jwt.JwtPayload };
const inviteSchema = z.object({ email: z.string().email(), accessRole: z.string().min(2).max(40) });

function isAdmin(user?: string | jwt.JwtPayload) {
  if (!user || typeof user === 'string') return false;
  const roles = user.roles || user.app_metadata?.roles || [];
  const email = user.email;
  const configuredAdmins = (process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase());
  return (Array.isArray(roles) && roles.some((role) => String(role).toLowerCase() === 'admin'))
    || (typeof email === 'string' && configuredAdmins.includes(email.toLowerCase()));
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Administrator access required' });
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, accessRole: true, status: true, lastLoginAt: true, accountType: true } });
    return res.json({ data: users });
  } catch (error) {
    console.error('Error listing users:', error);
    return res.status(503).json({ error: 'Unable to load users' });
  }
});

router.post('/invite', async (req: AuthenticatedRequest, res: Response) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Administrator access required' });
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid invitation data' });
  return res.status(202).json({ message: `Invitation queued for ${parsed.data.email}` });
});

export default router;