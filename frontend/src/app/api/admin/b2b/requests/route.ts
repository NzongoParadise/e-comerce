import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, readJson } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const decisionSchema = z.object({
  userId: z.number().int().positive(),
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (value.status === 'REJECTED' && !value.reason) {
    context.addIssue({ code: 'custom', path: ['reason'], message: 'Indique o motivo da rejeição.' });
  }
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse('Authentication required', 401), actorId: null };
  if (!isAdmin(user)) return { error: errorResponse('Administrator access required', 403), actorId: null };
  const actor = typeof user.sub === 'string'
    ? await prisma.user.findUnique({ where: { externalId: user.sub }, select: { id: true } })
    : null;
  if (!actor) return { error: errorResponse('Administrator profile not found', 403), actorId: null };
  return { error: null, actorId: actor.id };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const params = new URL(request.url).searchParams;
  const documentType = params.get('document');
  const userId = Number(params.get('userId'));
  if (documentType || params.has('userId')) {
    if (!Number.isInteger(userId) || userId < 1 || !['company', 'personal'].includes(documentType || '')) {
      return errorResponse('Documento solicitado inválido.', 400);
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        companyDocumentPath: true,
        personalDocumentPath: true,
      },
    });
    const storedPath = documentType === 'company' ? user?.companyDocumentPath : user?.personalDocumentPath;
    if (!storedPath) return errorResponse('Documento não encontrado.', 404);

    const uploadsDirectory = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(storedPath);
    if (path.dirname(filePath) !== uploadsDirectory) return errorResponse('Documento não encontrado.', 404);

    try {
      const file = await readFile(filePath);
      const contentType = filePath.toLowerCase().endsWith('.pdf') ? 'application/pdf'
        : filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      return new Response(file, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${documentType}-document${path.extname(filePath)}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        return errorResponse('Documento não encontrado no armazenamento.', 404);
      }
      console.error('Unable to retrieve B2B application document:', error);
      return errorResponse('Não foi possível obter o documento.', 503);
    }
  }

  const requests = await prisma.user.findMany({
    where: { b2bRequestStatus: { in: ['PENDING', 'APPROVED', 'REJECTED'] } },
    select: {
      id: true,
      name: true,
      email: true,
      accountType: true,
      b2bRequestStatus: true,
      companyDocumentPath: true,
      personalDocumentPath: true,
      updatedAt: true,
      company: {
        select: {
          id: true,
          legalName: true,
          tradeName: true,
          nif: true,
          email: true,
          phone: true,
          country: true,
          province: true,
          city: true,
          address: true,
          status: true,
          statusHistory: { orderBy: { createdAt: 'desc' }, take: 1, select: { reason: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  return Response.json({
    data: requests.map(({ companyDocumentPath, personalDocumentPath, company, ...user }) => ({
      ...user,
      hasCompanyDocument: Boolean(companyDocumentPath),
      hasPersonalDocument: Boolean(personalDocumentPath),
      company: company ? { ...company, reviewReason: company.statusHistory[0]?.reason || null, statusHistory: undefined } : null,
    })),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = decisionSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Decisão de homologação inválida.', 400, parsed.error.flatten().fieldErrors);

  const { userId, status, reason } = parsed.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, companyId: true, accessRole: true, accountType: true, status: true, b2bRequestStatus: true, companyDocumentPath: true, personalDocumentPath: true },
      });
      if (!request || request.accessRole !== 'CUSTOMER' || request.accountType !== 'B2C' || request.status !== 'ACTIVE'
        || request.b2bRequestStatus !== 'PENDING' || !request.companyDocumentPath || !request.personalDocumentPath) {
        return { conflict: true as const };
      }
      if (!request.companyId) return { companyMissing: true as const };

      const claimed = await tx.user.updateMany({
        where: {
          id: userId,
          accountType: 'B2C',
          status: 'ACTIVE',
          b2bRequestStatus: 'PENDING',
          companyDocumentPath: { not: null },
          personalDocumentPath: { not: null },
        },
        data: status === 'APPROVED'
          ? { b2bRequestStatus: 'APPROVED', accountType: 'B2B', accountName: 'Conta Empresarial', companyId: request.companyId }
          : { b2bRequestStatus: 'REJECTED' },
      });
      if (!claimed.count) return { conflict: true as const };

      const company = await tx.company.findUnique({ where: { id: request.companyId }, select: { id: true, status: true } });
      if (!company) throw new Error('B2B_REQUEST_COMPANY_MISSING');
      const nextCompanyStatus = status === 'APPROVED' ? 'ACTIVE' : 'REJECTED';
      if (company.status !== nextCompanyStatus) {
        await tx.company.update({ where: { id: company.id }, data: { status: nextCompanyStatus } });
        await tx.companyStatusHistory.create({
          data: {
            companyId: company.id,
            fromStatus: company.status,
            toStatus: nextCompanyStatus,
            reason: status === 'REJECTED' ? reason : 'Pedido de conversão B2C para B2B aprovado.',
            actorUserId: auth.actorId,
          },
        });
      }
      await tx.companyMember.upsert({
        where: { companyId_userId: { companyId: company.id, userId } },
        create: { companyId: company.id, userId, role: 'OWNER', status: 'ACTIVE' },
        update: { role: 'OWNER', status: 'ACTIVE' },
      });
      return { user: await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, accountType: true, accountName: true, b2bRequestStatus: true, companyId: true },
      }) };
    });
    if ('conflict' in result) return errorResponse('O pedido já foi processado ou não está elegível.', 409);
    if ('companyMissing' in result) return errorResponse('Este pedido não tem os dados oficiais da empresa associados. Solicite ao cliente que atualize o pedido.', 409);
    return Response.json({ data: result.user });
  } catch (error) {
    if (error instanceof Error && error.message === 'B2B_REQUEST_COMPANY_MISSING') {
      return errorResponse('A empresa associada ao pedido não foi encontrada.', 409);
    }
    console.error('Unable to process B2B account request:', error);
    return errorResponse('Não foi possível processar o pedido B2B.', 503);
  }
}
