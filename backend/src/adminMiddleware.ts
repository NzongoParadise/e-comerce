import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

type AuthenticatedRequest = Request & { user?: string | jwt.JwtPayload };

export function isAdmin(user?: string | jwt.JwtPayload) {
  if (!user || typeof user === 'string') return false;
  const roles = user.roles || user.app_metadata?.roles || [];
  const email = user.email;
  const configuredAdmins = (process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase());

  return (Array.isArray(roles) && roles.some((role) => String(role).toLowerCase() === 'admin'))
    || (typeof email === 'string' && configuredAdmins.includes(email.toLowerCase()));
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Administrator access required' });
  return next();
}
