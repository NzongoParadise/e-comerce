import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { prisma } from '../prisma';
import { jwtAuth } from '../authMiddleware';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

type AuthenticatedRequest = Request & {
  user?: string | jwt.JwtPayload;
};

const credentialsSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(120),
  accountType: z.enum(['B2C', 'B2B']).default('B2C'),
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  accountType: z.enum(['B2C', 'B2B']).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

const uploadDirectory = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const documentUpload = multer({
  dest: uploadDirectory,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    callback(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype));
  },
});

const uploadDocuments = (req: Request, res: Response, next: () => void) => {
  documentUpload.fields([
    { name: 'companyDocument', maxCount: 1 },
    { name: 'personalDocument', maxCount: 1 },
  ])(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Cada documento deve ter no máximo 5 MB' });
    }
    if (error) return res.status(400).json({ error: 'Formato de documento não permitido' });
    next();
  });
};

function hasValidSignature(file: Express.Multer.File) {
  const header = fs.readFileSync(file.path).subarray(0, 8);
  const isPdf = header.toString('ascii', 0, 5) === '%PDF-';
  const isPng = header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  return (file.mimetype === 'application/pdf' && isPdf)
    || (file.mimetype === 'image/png' && isPng)
    || (file.mimetype === 'image/jpeg' && isJpeg);
}

function issueLocalToken(user: { externalId: string; email: string | null; name: string | null; accessRole?: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    { sub: user.externalId, email: user.email, name: user.name, provider: 'local', roles: [user.accessRole === 'ADMIN' ? 'admin' : 'customer'] },
    secret,
    { algorithm: 'HS256', expiresIn: '7d' },
  );
}

router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid registration data' });

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        externalId: `local:${randomUUID()}`,
        email: parsed.data.email,
        name: parsed.data.name,
        provider: 'local',
        passwordHash,
        accountType: parsed.data.accountType,
        accountName: parsed.data.accountType === 'B2B' ? 'Conta Grossista' : 'Conta Retalhista',
      },
    });
    return res.status(201).json({ token: issueLocalToken(user) });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Email already registered' });
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Unable to create account' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return res.json({ token: issueLocalToken(user) });
  } catch (error) {
    console.error('Error authenticating user:', error);
    return res.status(503).json({ error: 'Database unavailable. Try again shortly.' });
  }
});

router.patch('/password', jwtAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const parsed = passwordSchema.safeParse(req.body);
  if (!user || typeof user === 'string' || !user.sub) return res.status(401).json({ error: 'Authentication required' });
  if (!parsed.success) return res.status(400).json({ error: 'A nova palavra-passe deve ter pelo menos 8 caracteres' });

  try {
    const profile = await prisma.user.findUnique({ where: { externalId: user.sub } });
    if (!profile?.passwordHash) return res.status(400).json({ error: 'A sua conta usa autenticação externa' });
    if (!(await bcrypt.compare(parsed.data.currentPassword, profile.passwordHash))) {
      return res.status(401).json({ error: 'A palavra-passe atual está incorreta' });
    }
    await prisma.user.update({ where: { id: profile.id }, data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) } });
    return res.json({ message: 'Password updated' });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(503).json({ error: 'Unable to update password' });
  }
});

router.get('/me', jwtAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  if (!user || typeof user === 'string' || !user.sub) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const provider = user.provider || user.app_metadata?.provider;
    const profile = await prisma.user.upsert({
      where: { externalId: user.sub },
      create: {
        externalId: user.sub,
        email: user.email,
        name: user.name,
        provider,
      },
      update: {
        provider,
        lastLoginAt: new Date(),
      },
    });

    return res.json({
      data: {
        id: profile.id,
        externalId: profile.externalId,
        email: profile.email,
        name: profile.name,
        provider: profile.provider,
        accountName: profile.accountName,
        accountType: profile.accountType,
        b2bRequestStatus: profile.b2bRequestStatus,
        companyDocumentPath: profile.companyDocumentPath,
        personalDocumentPath: profile.personalDocumentPath,
        roles: user.roles || user.app_metadata?.roles || [],
      },
    });
  } catch (error) {
    console.error('Error syncing authenticated user:', error);
    return res.status(500).json({ error: 'Unable to load user profile' });
  }
});

router.post('/b2b-request', jwtAuth, uploadDocuments, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user || typeof user === 'string' || !user.sub) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const companyDocument = files?.companyDocument?.[0];
    const personalDocument = files?.personalDocument?.[0];
    if (!companyDocument || !personalDocument) {
      return res.status(400).json({ error: 'Envie o documento da empresa e o documento pessoal' });
    }
    for (const file of [companyDocument, personalDocument]) {
      if (!hasValidSignature(file)) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'O conteúdo do documento não corresponde ao formato indicado' });
      }
    }

    const profile = await prisma.user.update({
      where: { externalId: user.sub },
      data: {
        b2bRequestStatus: 'PENDING',
        companyDocumentPath: companyDocument.path,
        personalDocumentPath: personalDocument.path,
      },
    });
    return res.status(202).json({ data: { b2bRequestStatus: profile.b2bRequestStatus } });
  } catch (error) {
    console.error('Error requesting B2B account:', error);
    return res.status(500).json({ error: 'Unable to submit B2B request' });
  }
});

router.patch('/profile', jwtAuth, uploadDocuments, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const parsed = profileSchema.safeParse({ ...req.body, accountType: req.body.accountType || undefined });

  if (!user || typeof user === 'string' || !user.sub) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid profile data' });
  }

  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const companyDocument = files?.companyDocument?.[0];
    const personalDocument = files?.personalDocument?.[0];
    const accountType = parsed.data.accountType;
    const existingProfile = await prisma.user.findUnique({ where: { externalId: user.sub } });
    if (accountType === 'B2B' && existingProfile?.accountType === 'B2C') {
      return res.status(400).json({ error: 'Use o pedido de conversão B2B para alterar este tipo de conta' });
    }
    for (const file of [companyDocument, personalDocument]) {
      if (file && !hasValidSignature(file)) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'O conteúdo do documento não corresponde ao formato indicado' });
      }
    }
    if (accountType === 'B2B' && (!companyDocument || !personalDocument)) {
      const existing = await prisma.user.findUnique({ where: { externalId: user.sub } });
      if (!existing?.companyDocumentPath || !existing.personalDocumentPath) {
        return res.status(400).json({ error: 'Grossistas devem enviar os dois documentos' });
      }
    }
    const profile = await prisma.user.update({
      where: { externalId: user.sub },
      data: {
        name: parsed.data.name,
        ...(accountType ? { accountType, accountName: accountType === 'B2B' ? 'Conta Grossista' : 'Conta Retalhista' } : {}),
        ...(companyDocument ? { companyDocumentPath: companyDocument.path } : {}),
        ...(personalDocument ? { personalDocumentPath: personalDocument.path } : {}),
      },
    });
    return res.json({
      data: {
        name: profile.name,
        accountName: profile.accountName,
        accountType: profile.accountType,
        companyDocumentPath: profile.companyDocumentPath,
        personalDocumentPath: profile.personalDocumentPath,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Unable to update profile' });
  }
});

export default router;
