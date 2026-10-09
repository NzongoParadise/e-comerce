import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().trim().min(32).max(128),
});

export async function POST(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Inicie sessão para aceitar o convite.", 401);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Token de convite inválido.", 400);

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, email: true, accountType: true, companyId: true },
  });
  if (!user) return errorResponse("Perfil de utilizador não encontrado.", 401);
  if (!user.email) return errorResponse("A conta precisa de ter um e-mail verificado para aceitar convites empresariais.", 422);

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const invitation = await prisma.b2BInvitation.findUnique({
    where: { tokenHash },
    include: { company: { select: { id: true, legalName: true, tradeName: true, status: true } } },
  });
  if (!invitation) return errorResponse("Convite inexistente ou já revogado.", 404);

  if (invitation.status === "ACCEPTED" && invitation.acceptedByUserId === user.id) {
    return Response.json({ data: { accepted: true, companyId: invitation.companyId, companyName: invitation.company.tradeName || invitation.company.legalName, idempotent: true } });
  }
  if (invitation.status !== "PENDING") return errorResponse("Este convite já não está pendente.", 409);
  if (invitation.expiresAt.getTime() <= Date.now()) {
    await prisma.b2BInvitation.updateMany({
      where: { id: invitation.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    return errorResponse("O convite expirou. Peça ao proprietário da empresa para enviar outro.", 410);
  }
  if (invitation.company.status !== "ACTIVE") return errorResponse("A empresa ainda não está homologada e não pode aceitar membros.", 409);
  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return errorResponse("O convite foi enviado para outro e-mail. Inicie sessão com o e-mail convidado.", 403);
  }

  const otherMembership = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE", companyId: { not: invitation.companyId } },
    select: { companyId: true },
  });
  if (otherMembership) {
    return errorResponse("Esta versão permite uma empresa ativa por utilizador. Saia da outra empresa ou contacte o suporte para transferir o acesso.", 409);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const freshInvitation = await tx.b2BInvitation.findUnique({
        where: { id: invitation.id },
        include: { company: { select: { id: true, legalName: true, tradeName: true, status: true } } },
      });
      if (!freshInvitation || freshInvitation.tokenHash !== tokenHash) throw new Error("INVITATION_NOT_FOUND");
      if (freshInvitation.status === "ACCEPTED" && freshInvitation.acceptedByUserId === user.id) {
        return { company: freshInvitation.company, alreadyAccepted: true };
      }
      if (freshInvitation.status !== "PENDING") throw new Error("INVITATION_NOT_PENDING");
      if (freshInvitation.expiresAt.getTime() <= Date.now()) throw new Error("INVITATION_EXPIRED");
      if (freshInvitation.company.status !== "ACTIVE") throw new Error("COMPANY_NOT_ACTIVE");

      const member = await tx.companyMember.findUnique({
        where: { companyId_userId: { companyId: freshInvitation.companyId, userId: user.id } },
      });
      if (member?.status === "ACTIVE") throw new Error("ALREADY_MEMBER");
      if (member?.role === "OWNER") throw new Error("OWNER_MEMBERSHIP_CONFLICT");

      if (member) {
        await tx.companyMember.update({
          where: { id: member.id },
          data: { status: "ACTIVE", role: freshInvitation.role },
        });
      } else {
        await tx.companyMember.create({
          data: {
            companyId: freshInvitation.companyId,
            userId: user.id,
            role: freshInvitation.role,
            status: "ACTIVE",
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          accountType: "B2B",
          companyId: freshInvitation.companyId,
          b2bRequestStatus: "APPROVED",
        },
      });
      await tx.b2BInvitation.update({
        where: { id: freshInvitation.id },
        data: {
          status: "ACCEPTED",
          acceptedByUserId: user.id,
          acceptedAt: new Date(),
        },
      });

      return { company: freshInvitation.company, alreadyAccepted: false };
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });

    return Response.json({
      data: {
        accepted: true,
        companyId: result.company.id,
        companyName: result.company.tradeName || result.company.legalName,
        idempotent: result.alreadyAccepted,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVITATION_NOT_FOUND") return errorResponse("Convite inexistente.", 404);
    if (code === "INVITATION_NOT_PENDING") return errorResponse("O convite já foi utilizado ou cancelado.", 409);
    if (code === "INVITATION_EXPIRED") {
      await prisma.b2BInvitation.updateMany({ where: { id: invitation.id, status: "PENDING" }, data: { status: "EXPIRED" } }).catch(() => undefined);
      return errorResponse("O convite expirou. Peça um novo convite ao proprietário.", 410);
    }
    if (code === "COMPANY_NOT_ACTIVE") return errorResponse("A empresa ainda não está homologada.", 409);
    if (code === "ALREADY_MEMBER") return errorResponse("Já é membro ativo desta empresa.", 409);
    if (code === "OWNER_MEMBERSHIP_CONFLICT") return errorResponse("O acesso de proprietário não pode ser alterado por um convite.", 409);
    if ((error as { code?: string })?.code === "P2034") return errorResponse("O convite foi alterado em simultâneo. Atualize a página e tente de novo.", 409);
    logger.error("B2B invitation acceptance failed", {
      invitationId: invitation.id,
      error: error instanceof Error ? error.message : error,
    });
    return errorResponse("Não foi possível aceitar o convite. Tente novamente.", 503);
  }
}
