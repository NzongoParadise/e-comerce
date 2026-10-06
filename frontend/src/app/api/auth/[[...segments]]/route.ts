import { randomUUID } from 'node:crypto';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { canRequestB2BAccount, getUserRoles } from '@/lib/auth';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson, rateLimit, userSubject } from '@/lib/server/api';
import { z } from "zod";
import { base32Encode, createSecuritySession, decryptSecret, encryptSecret, generateRecoveryCodes, hashToken, securityEvent, verifyTotp } from "@/lib/server/security";

export const runtime = 'nodejs';

const credentialsSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});
const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(120),
  accountType: z.enum(['B2C', 'B2B']).default('B2C'),
});
const profileSchema = z.object({ name: z.string().trim().min(2).max(120) });
const passwordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) });
const communicationPreferenceSchema = z.object({
  promotions: z.boolean(),
  newProducts: z.boolean(),
  orderUpdates: z.boolean(),
});
const forgotPasswordSchema = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()) });
const resetPasswordSchema = z.object({ token: z.string().min(32).max(256), password: z.string().min(8).max(128) });

type DocumentFile = { field: 'companyDocument' | 'personalDocument'; file: File };

function routeName(request: Request) {
  return new URL(request.url).pathname.split('/').filter(Boolean)[2] || '';
}

function issueLocalToken(user: { externalId: string; email: string | null; name: string | null; accessRole?: string }, purpose?: "2fa") {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const accessRole = (user.accessRole || 'CUSTOMER').toUpperCase();
  const roles = accessRole === 'ADMIN' ? ['admin'] : ['customer'];
  return jwt.sign({ sub: user.externalId, email: user.email, name: user.name, provider: "local", accessRole, roles, ...(purpose ? { purpose } : {}) }, secret, { algorithm: "HS256", expiresIn: purpose ? "5m" : "7d", jwtid: randomUUID() });
}

async function readProfileBody(request: Request) {
  if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
    return { fields: await readJson(request) as Record<string, unknown> | undefined, files: [] as DocumentFile[] };
  }
  try {
    const formData = await request.formData();
    const fields: Record<string, unknown> = {};
    const files: DocumentFile[] = [];
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') fields[key] = value;
      else if ((key === 'companyDocument' || key === 'personalDocument') && value.name) files.push({ field: key, file: value });
    }
    return { fields, files };
  } catch { return null; }
}

function validDocument(file: File) {
  return file.size <= 5 * 1024 * 1024 && ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type);
}

async function hasValidSignature(file: File) {
  const header = Buffer.from(await file.slice(0, 8).arrayBuffer());
  const isPdf = header.toString('ascii', 0, 5) === '%PDF-';
  const isPng = header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  return (file.type === 'application/pdf' && isPdf) || (file.type === 'image/png' && isPng) || (file.type === 'image/jpeg' && isJpeg);
}

async function storeDocuments(files: DocumentFile[]) {
  const directory = path.resolve(process.cwd(), 'uploads');
  await mkdir(directory, { recursive: true });
  const saved: { field: DocumentFile['field']; path: string }[] = [];
  try {
    for (const { field, file } of files) {
      const extension = file.type === 'application/pdf' ? '.pdf' : file.type === 'image/png' ? '.png' : '.jpg';
      const filePath = path.join(directory, `${randomUUID()}${extension}`);
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
      saved.push({ field, path: filePath });
    }
    return saved;
  } catch (error) {
    await Promise.all(saved.map(({ path: filePath }) => unlink(filePath).catch(() => undefined)));
    throw error;
  }
}

async function removeDocuments(files: { path: string }[]) {
  await Promise.all(files.map(({ path: filePath }) => unlink(filePath).catch(() => undefined)));
}

export async function POST(request: Request) {
  const action = routeName(request);
  const limit = action === 'login' ? rateLimit(request, 'auth:login', 10, 60_000)
    : action === 'login-2fa' ? rateLimit(request, 'auth:login-2fa', 8, 5 * 60_000)
      : action === 'forgot-password' ? rateLimit(request, 'auth:forgot', 5, 15 * 60_000)
        : action === 'register' ? rateLimit(request, 'auth:register', 5, 15 * 60_000) : null;
  if (limit) return limit;

  if (action === 'register') {
    const parsed = registerSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorResponse('Invalid registration data', 400);
    try {
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const user = await prisma.user.create({ data: { externalId: `local:${randomUUID()}`, email: parsed.data.email, name: parsed.data.name, provider: "local", passwordHash, accountType: "B2C", accountName: "Conta Retalhista" } });
      const token = issueLocalToken(user); await createSecuritySession(user.id, token, request, new Date(Date.now() + 7 * 86400000)); await securityEvent(user.id, "REGISTER", request);
      return Response.json({ token }, { status: 201 });
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') return errorResponse('Email already registered', 409);
      console.error('Error creating user:', error);
      return errorResponse('Unable to create account', 500);
    }
  }

  if (action === 'login') {
    const parsed = credentialsSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorResponse('Invalid credentials', 400);
    try {
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return errorResponse('Invalid email or password', 401);
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      const twoFactor = await prisma.twoFactorAuth.findUnique({ where: { userId: user.id } });
      if (twoFactor?.enabled) return Response.json({ twoFactorRequired: true, challengeToken: issueLocalToken(user, "2fa") });
      const token = issueLocalToken(user); await createSecuritySession(user.id, token, request, new Date(Date.now() + 7 * 86400000)); await securityEvent(user.id, "LOGIN_SUCCESS", request);
      return Response.json({ token });
    } catch (error) {
      console.error('Error authenticating user:', error);
      return errorResponse('Database unavailable. Try again shortly.', 503);
    }
  }

  if (action === 'b2b-request') return submitB2BRequest(request);
  if (action === 'forgot-password') return forgotPassword(request);
  if (action === "reset-password") return resetPassword(request);
  if (action === "security") return securityPost(request);
  if (action === "login-2fa") return loginTwoFactor(request);
  return errorResponse('Not found', 404);
}

export async function PATCH(request: Request) {
  const action = routeName(request);
  if (action === 'password') return updatePassword(request);
  if (action === 'profile') return updateProfile(request);
  if (action === 'notifications') return updateCommunicationPreferences(request);
  return errorResponse('Not found', 404);
}

export async function GET(request: Request) {
  const action = routeName(request);
  if (action === "security") return securityGet(request);
  if (action === "notifications") return communicationPreferencesGet(request);
  if (action !== "me") return errorResponse("Not found", 404);
  const user = await authenticate(request);
  const subject = userSubject(user);
  if (!user || !subject) return errorResponse('Authentication required', 401);
  try {
    const provider = user.provider || user.app_metadata?.provider;
    const profile = await prisma.user.upsert({ where: { externalId: subject }, create: { externalId: subject, email: user.email, name: user.name, provider }, update: { provider, lastLoginAt: new Date() } });
    const roles = getUserRoles({ roles: user.roles || user.app_metadata?.roles || [], accessRole: profile.accessRole, email: user.email });
    return Response.json({ data: { id: profile.id, externalId: profile.externalId, email: profile.email, name: profile.name, provider: profile.provider, accessRole: profile.accessRole, isAdmin: isAdmin({ ...user, accessRole: profile.accessRole, email: profile.email }), accountName: profile.accountName, accountType: profile.accountType, b2bRequestStatus: profile.b2bRequestStatus, roles } });
  } catch (error) {
    console.error('Error syncing authenticated user:', error);
    return errorResponse('Unable to load user profile', 500);
  }
}

async function communicationPreferencesGet(request: Request) {
  const user = await authenticate(request);
  const subject = userSubject(user);
  if (!user || !subject) return errorResponse("Authentication required", 401);

  const profile = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true } });
  if (!profile) return errorResponse("User profile not found", 404);

  const preferences = await prisma.communicationPreference.upsert({
    where: { userId: profile.id },
    create: { userId: profile.id },
    update: {},
  });

  return Response.json({
    data: {
      promotions: preferences.promotions,
      newProducts: preferences.newProducts,
      orderUpdates: preferences.orderUpdates,
    },
  });
}

async function updateCommunicationPreferences(request: Request) {
  const user = await authenticate(request);
  const subject = userSubject(user);
  if (!user || !subject) return errorResponse("Authentication required", 401);

  const parsed = communicationPreferenceSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Preferências de comunicação inválidas.", 400);

  const profile = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true } });
  if (!profile) return errorResponse("User profile not found", 404);

  const preferences = await prisma.communicationPreference.upsert({
    where: { userId: profile.id },
    create: { userId: profile.id, ...parsed.data },
    update: parsed.data,
  });

  return Response.json({
    data: {
      promotions: preferences.promotions,
      newProducts: preferences.newProducts,
      orderUpdates: preferences.orderUpdates,
    },
  });
}

async function securityGet(request: Request) {
  const user = await authenticate(request); const subject = userSubject(user);
  if (!user || !subject) return errorResponse("Authentication required", 401);
  const profile = await prisma.user.findUnique({ where: { externalId: subject } }); if (!profile) return errorResponse("User profile not found", 404);
  const twoFactor = await prisma.twoFactorAuth.findUnique({ where: { userId: profile.id } });
  const sessions = await prisma.securitySession.findMany({ where: { userId: profile.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastActivityAt: "desc" }, take: 20 });
  const events = await prisma.securityEvent.findMany({ where: { userId: profile.id }, orderBy: { createdAt: "desc" }, take: 12 });
  const currentJti = typeof user?.jti === "string" ? user.jti : null;
  const currentSession = currentJti
    ? sessions.find((session) => session.tokenHash === hashToken(currentJti))
    : null;
  const recoveryCodes = twoFactor?.enabled
    ? await prisma.twoFactorRecoveryCode.count({ where: { userId: profile.id, usedAt: null } })
    : 0;
  return Response.json({ data: {
    twoFactorEnabled: Boolean(twoFactor?.enabled),
    recoveryCodesRemaining: recoveryCodes,
    currentSessionId: currentSession?.id ?? null,
    sessions,
    events,
  } });
}

async function securityPost(request: Request) {
  const user = await authenticate(request); const subject = userSubject(user); if (!user || !subject) return errorResponse("Authentication required", 401);
  const profile = await prisma.user.findUnique({ where: { externalId: subject } }); if (!profile) return errorResponse("User profile not found", 404);
  const body = await readJson(request) as { action?: string; code?: string; sessionId?: number } | undefined;
  if (body?.action === "begin-2fa") {
    const secret = base32Encode(randomBytes(20)); const encrypted = encryptSecret(secret);
    await prisma.twoFactorAuth.upsert({ where: { userId: profile.id }, create: { userId: profile.id, secretEncrypted: encrypted }, update: { secretEncrypted: encrypted, enabled: false, verifiedAt: null } });
    const issuer = encodeURIComponent("RUBRICA DILIGENTE"); const account = encodeURIComponent(profile.email || String(profile.id));
    return Response.json({ data: { secret, otpauth: "otpauth://totp/" + issuer + ":" + account + "?secret=" + secret + "&issuer=" + issuer + "&algorithm=SHA1&digits=6&period=30" } });
  }
  if (body?.action === "verify-2fa") {
    if (!body.code) return errorResponse("Código obrigatório.", 400); const config = await prisma.twoFactorAuth.findUnique({ where: { userId: profile.id } });
    if (!config || !verifyTotp(decryptSecret(config.secretEncrypted), body.code)) return errorResponse("Código inválido.", 401);
    const codes = generateRecoveryCodes(); await prisma.$transaction([prisma.twoFactorAuth.update({ where: { userId: profile.id }, data: { enabled: true, verifiedAt: new Date() } }), prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: profile.id } }), prisma.twoFactorRecoveryCode.createMany({ data: codes.map(code => ({ userId: profile.id, codeHash: hashToken(code) })) })]);
    await securityEvent(profile.id, "TWO_FACTOR_ENABLED", request); return Response.json({ data: { enabled: true, recoveryCodes: codes } });
  }
  if (body?.action === "disable-2fa") {
    const config = await prisma.twoFactorAuth.findUnique({ where: { userId: profile.id } }); if (!config?.enabled || !body.code) return errorResponse("Código obrigatório.", 400);
    if (!verifyTotp(decryptSecret(config.secretEncrypted), body.code)) return errorResponse("Código inválido.", 401);
    await prisma.$transaction([prisma.twoFactorAuth.update({ where: { userId: profile.id }, data: { enabled: false } }), prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: profile.id } })]);
    await securityEvent(profile.id, "TWO_FACTOR_DISABLED", request); return Response.json({ data: { enabled: false } });
  }
  if (body?.action === "revoke-session" && body.sessionId) { await prisma.securitySession.updateMany({ where: { id: body.sessionId, userId: profile.id }, data: { revokedAt: new Date() } }); await securityEvent(profile.id, "SESSION_REVOKED", request, { sessionId: body.sessionId }); return Response.json({ data: { success: true } }); }
  if (body?.action === "revoke-all") {
    const currentJti = typeof user.jti === "string" ? user.jti : null;
    await prisma.securitySession.updateMany({
      where: {
        userId: profile.id,
        revokedAt: null,
        ...(currentJti ? { tokenHash: { not: hashToken(currentJti) } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    await securityEvent(profile.id, "ALL_SESSIONS_REVOKED", request);
    return Response.json({ data: { success: true } });
  }
  return errorResponse("Unknown security action", 400);
}

async function loginTwoFactor(request: Request) {
  const body = await readJson(request) as { challengeToken?: string; code?: string } | undefined; if (!body?.challengeToken || !body.code) return errorResponse("Código obrigatório.", 400);
  const secret = process.env.JWT_SECRET; if (!secret) return errorResponse("JWT_SECRET is not configured", 500);
  try { const challenge = jwt.verify(body.challengeToken, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload; if (challenge.purpose !== "2fa" || typeof challenge.sub !== "string") return errorResponse("Desafio inválido.", 401);
    const user = await prisma.user.findUnique({ where: { externalId: challenge.sub } }); if (!user) return errorResponse("Conta não encontrada.", 401); const config = await prisma.twoFactorAuth.findUnique({ where: { userId: user.id } });
    if (!config?.enabled) return errorResponse("Autenticação de dois factores não está ativa.", 401);

    const normalizedCode = body.code.trim().toUpperCase();
    let verified = false;
    let usedRecoveryCodeId: number | null = null;

    if (/^\\d{6}$/.test(normalizedCode)) {
      verified = verifyTotp(decryptSecret(config.secretEncrypted), normalizedCode);
    } else {
      const candidates = await prisma.twoFactorRecoveryCode.findMany({
        where: { userId: user.id, usedAt: null },
        select: { id: true, codeHash: true },
      });
      const hash = hashToken(normalizedCode);
      const match = candidates.find((candidate) => candidate.codeHash === hash);
      if (match) {
        verified = true;
        usedRecoveryCodeId = match.id;
      }
    }

    if (!verified) {
      await securityEvent(user.id, "TWO_FACTOR_FAILED", request, { method: /^\\d{6}$/.test(normalizedCode) ? "totp" : "recovery_code" });
      return errorResponse("Código inválido ou já utilizado.", 401);
    }

    if (usedRecoveryCodeId) {
      await prisma.twoFactorRecoveryCode.updateMany({
        where: { id: usedRecoveryCodeId, userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    }

    const token = issueLocalToken(user);
    await createSecuritySession(user.id, token, request, new Date(Date.now() + 7 * 86400000));
    await securityEvent(user.id, "LOGIN_SUCCESS_2FA", request, { method: usedRecoveryCodeId ? "recovery_code" : "totp" });
    return Response.json({ token });
  } catch { return errorResponse("Desafio expirado ou inválido.", 401); }
}
async function updatePassword(request: Request) {
  const user = await authenticate(request); const subject = userSubject(user);
  if (!user || !subject) return errorResponse('Authentication required', 401);
  const parsed = passwordSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('A nova palavra-passe deve ter pelo menos 8 caracteres', 400);
  try {
    const profile = await prisma.user.findUnique({ where: { externalId: subject } });
    if (!profile?.passwordHash) return errorResponse('A sua conta usa autenticação externa', 400);
    if (!(await bcrypt.compare(parsed.data.currentPassword, profile.passwordHash))) return errorResponse('A palavra-passe atual está incorreta', 401);
    await prisma.user.update({ where: { id: profile.id }, data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) } });
    return Response.json({ message: 'Password updated' });
  } catch (error) { console.error('Error updating password:', error); return errorResponse('Unable to update password', 503); }
}

async function submitB2BRequest(request: Request) {
  const user = await authenticate(request); const subject = userSubject(user);
  if (!subject) return errorResponse('Authentication required', 401);
  const profile = await prisma.user.findUnique({ where: { externalId: subject }, select: { accessRole: true, accountType: true, status: true, b2bRequestStatus: true } });
  if (!canRequestB2BAccount(profile)) return errorResponse('Apenas contas retalhistas ativas sem pedido pendente podem solicitar acesso grossista.', 403);
  const body = await readProfileBody(request);
  if (!body) return errorResponse('Formato de documento não permitido', 400);
  const companyDocument = body.files.find(({ field }) => field === 'companyDocument')?.file;
  const personalDocument = body.files.find(({ field }) => field === 'personalDocument')?.file;
  if (!companyDocument || !personalDocument) return errorResponse('Envie o documento da empresa e o documento pessoal', 400);
  for (const file of [companyDocument, personalDocument]) {
    if (!validDocument(file)) return errorResponse(file.size > 5 * 1024 * 1024 ? 'Cada documento deve ter no máximo 5 MB' : 'Formato de documento não permitido', 400);
    if (!(await hasValidSignature(file))) return errorResponse('O conteúdo do documento não corresponde ao formato indicado', 400);
  }
  const saved = await storeDocuments(body.files);
  try {
    const profile = await prisma.user.update({ where: { externalId: subject }, data: { b2bRequestStatus: 'PENDING', companyDocumentPath: saved.find(({ field }) => field === 'companyDocument')?.path, personalDocumentPath: saved.find(({ field }) => field === 'personalDocument')?.path } });
    return Response.json({ data: { b2bRequestStatus: profile.b2bRequestStatus } }, { status: 202 });
  } catch (error) { await removeDocuments(saved); console.error('Error requesting B2B account:', error); return errorResponse('Unable to submit B2B request', 500); }
}

async function updateProfile(request: Request) {
  const user = await authenticate(request); const subject = userSubject(user);
  if (!subject) return errorResponse('Authentication required', 401);
  const body = await readProfileBody(request); if (!body) return errorResponse('Formato de documento não permitido', 400);
  const parsed = profileSchema.safeParse(body.fields || {}); if (!parsed.success) return errorResponse('Invalid profile data', 400);
  const filesByField = new Map(body.files.map(({ field, file }) => [field, file]));
  for (const file of filesByField.values()) {
    if (!validDocument(file)) return errorResponse(file.size > 5 * 1024 * 1024 ? 'Cada documento deve ter no máximo 5 MB' : 'Formato de documento não permitido', 400);
    if (!(await hasValidSignature(file))) return errorResponse('O conteúdo do documento não corresponde ao formato indicado', 400);
  }
  try {
    const existing = await prisma.user.findUnique({ where: { externalId: subject } });
    if (!existing) return errorResponse('User profile not found', 404);
    if (body.files.length > 0 && (existing.accessRole !== 'CUSTOMER' || existing.accountType !== 'B2B')) return errorResponse('Apenas contas grossistas aprovadas podem atualizar documentos nesta área.', 403);
    const hasCompanyDocument = filesByField.has('companyDocument') || Boolean(existing.companyDocumentPath);
    const hasPersonalDocument = filesByField.has('personalDocument') || Boolean(existing.personalDocumentPath);
    if (existing.accessRole === 'CUSTOMER' && existing.accountType === 'B2B' && (!hasCompanyDocument || !hasPersonalDocument)) return errorResponse('Grossistas devem manter os dois documentos válidos', 400);
    const saved = await storeDocuments(body.files);
    try {
      const profile = await prisma.user.update({ where: { externalId: subject }, data: { name: parsed.data.name, ...(saved.find(({ field }) => field === 'companyDocument') ? { companyDocumentPath: saved.find(({ field }) => field === 'companyDocument')?.path } : {}), ...(saved.find(({ field }) => field === 'personalDocument') ? { personalDocumentPath: saved.find(({ field }) => field === 'personalDocument')?.path } : {}) } });
      return Response.json({ data: { name: profile.name, accountName: profile.accountName, accountType: profile.accountType, companyDocumentPath: profile.companyDocumentPath, personalDocumentPath: profile.personalDocumentPath } });
    } catch (error) { await removeDocuments(saved); throw error; }
  } catch (error) { console.error('Error updating profile:', error); return errorResponse('Unable to update profile', 500); }
}

async function forgotPassword(request: Request) {
  const parsed = forgotPasswordSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid email address', 400);
  const message = 'Se existir uma conta para esse endereço, serão enviadas instruções de recuperação.';
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash) return Response.json({ data: { message } });
  const token = randomBytes(32).toString('hex'); const tokenHash = createHash('sha256').update(token).digest('hex'); const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { tokenHash, userId: user.id, expiresAt } }),
  ]);
  return Response.json({ data: { message, ...(process.env.NODE_ENV !== 'production' ? { resetToken: token } : {}) } });
}

async function resetPassword(request: Request) {
  const parsed = resetPasswordSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid or expired reset token', 400);
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const resetToken = await transaction.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) return false;
      const claimed = await transaction.passwordResetToken.updateMany({ where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (!claimed.count) return false;
      await transaction.user.update({ where: { id: resetToken.userId }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
      return true;
    });
    if (!result) return errorResponse('Invalid or expired reset token', 400);
    return Response.json({ message: 'Password updated' });
  } catch (error) { console.error('Error resetting password:', error); return errorResponse('Unable to reset password', 503); }
}