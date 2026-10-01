import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { getUserRoles, isAdminUser } from '@/lib/auth';
import { prisma } from '@/lib/server/prisma';

export type ApiUser = jwt.JwtPayload & {
  app_metadata?: { roles?: unknown; provider?: string };
  roles?: unknown;
  provider?: string;
  accessRole?: string;
  accountType?: string;
  status?: string;
  b2bRequestStatus?: string;
};

const jwksClients = new Map<string, ReturnType<typeof jwksRsa>>();

export function errorResponse(error: string, status: number, details?: unknown) {
  return Response.json({ error, ...(details === undefined ? {} : { details }) }, { status });
}

export function prismaErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function getJwksClient(uri: string) {
  let client = jwksClients.get(uri);
  if (!client) {
    client = jwksRsa({ jwksUri: uri, cache: true, rateLimit: true });
    jwksClients.set(uri, client);
  }
  return client;
}

export async function authenticate(request: Request): Promise<ApiUser | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return process.env.ALLOW_INSECURE_AUTH === 'true'
      ? { sub: 'local-user', roles: ['admin'], accessRole: 'ADMIN', status: 'ACTIVE' }
      : null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') return null;

  let verifiedUser: ApiUser | null = null;
  if (decoded.header.alg === 'HS256') {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    try {
      verifiedUser = jwt.verify(token, secret, { algorithms: ['HS256'] }) as ApiUser;
    } catch {
      return null;
    }
  } else {
    const jwksUri = process.env.JWKS_URI;
    if (!jwksUri || decoded.header.alg !== 'RS256') return null;

    const client = getJwksClient(jwksUri);
    verifiedUser = await new Promise((resolve) => {
      jwt.verify(token, (header, callback) => {
        if (!header.kid) return callback(new Error('Missing kid in token header'));
        client.getSigningKey(header.kid, (error, key) => {
          if (error) return callback(error);
          callback(null, key?.getPublicKey());
        });
      }, {
        algorithms: ['RS256'],
        issuer: process.env.AUTH_ISSUER,
        audience: process.env.AUTH_AUDIENCE,
      }, (error, user) => resolve(error || typeof user === 'string' || !user ? null : user as ApiUser));
    });
  }

  if (!verifiedUser) return null;
  if (verifiedUser.sub === 'local-user' && process.env.ALLOW_INSECURE_AUTH === 'true') return verifiedUser;

  try {
    const profile = typeof verifiedUser.sub === 'string'
      ? await prisma.user.findUnique({
        where: { externalId: verifiedUser.sub },
        select: { accessRole: true, accountType: true, status: true, b2bRequestStatus: true, email: true },
      })
      : null;
    if (!profile) {
      return new URL(request.url).pathname === '/api/auth/me' ? verifiedUser : null;
    }
    if (profile.status !== 'ACTIVE') return null;

    const roles = getUserRoles({ accessRole: profile.accessRole });
    return {
      ...verifiedUser,
      email: profile.email || verifiedUser.email,
      accessRole: profile.accessRole,
      accountType: profile.accountType,
      status: profile.status,
      b2bRequestStatus: profile.b2bRequestStatus,
      roles,
    };
  } catch {
    return null;
  }
}

export function isAdmin(user: ApiUser | null) {
  return isAdminUser(user);
}

export function userSubject(user: ApiUser | null) {
  return typeof user?.sub === 'string' ? user.sub : null;
}