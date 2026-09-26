import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import dotenv from 'dotenv';

dotenv.config();

const jwksClient = jwksRsa({
  jwksUri: process.env.JWKS_URI || '',
  cache: true,
  rateLimit: true,
});

const allowInsecureAuth = process.env.ALLOW_INSECURE_AUTH === 'true';

if (!process.env.JWKS_URI && !allowInsecureAuth) {
  throw new Error('JWKS_URI is required when insecure authentication is disabled');
}

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  if (!header.kid) {
    return callback(new Error('Missing kid in token header'), undefined);
  }
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err, undefined);
    // @ts-ignore – key may be of type JwkRecord or CertRecord
    const signingKey = (key as any).publicKey || (key as any).rsaPublicKey;
    callback(null, signingKey);
  });
}

/**
 * Express middleware that validates a JWT using the JWKS endpoint.
 * Responds with 401 if verification fails.
 */
export function jwtAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    if (allowInsecureAuth) {
      (req as any).user = { sub: 'local-user', roles: ['admin'] };
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decodedToken = jwt.decode(token, { complete: true });
  if (decodedToken && typeof decodedToken !== 'string' && decodedToken.header.alg === 'HS256') {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(401).json({ error: 'Local authentication is not configured' });
    }
    jwt.verify(token, secret, { algorithms: ['HS256'] }, (err, decoded) => {
      if (err) return res.status(401).json({ error: 'Invalid or expired token' });
      (req as any).user = decoded;
      next();
    });
    return;
  }

  const verifyOptions: jwt.VerifyOptions = {
    algorithms: ['RS256'],
    issuer: process.env.AUTH_ISSUER,
    audience: process.env.AUTH_AUDIENCE,
  };

  jwt.verify(token, getKey, verifyOptions, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    (req as any).user = decoded;
    next();
  });
}
