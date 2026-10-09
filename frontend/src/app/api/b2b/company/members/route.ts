import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { z } from "zod";
import { createNotificationIfAllowed } from "@/lib/server/notifications";
export const runtime = "nodejs";
const schema = z.object({ memberUserId: z.coerce.number().int().positive(), role: z.enum(["BUYER", "APPROVER", "OWNER"]) });
async function context(request: Request) {
  const auth = await authenticate(request); const subject = userSubject(auth); if (!subject) return null;
  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true, accountType: true } }); if (!user || user.accountType !== "B2B") return null;
  const membership = await prisma.companyMember.findFirst({ where: { userId: user.id, status: "ACTIVE", company: { status: "ACTIVE" } } }); return { user, membership };
}
export async function GET(request: Request) {
  const ctx = await context(request); if (!ctx?.membership) return errorResponse("Empresa não encontrada.", 403);
  const members = await prisma.companyMember.findMany({ where: { companyId: ctx.membership.companyId, status: "ACTIVE" }, include: { user: { select: { id: true, name: true, email: true, accountType: true, status: true } } }, orderBy: { createdAt: "asc" } });
  return Response.json({ data: members, currentRole: ctx.membership.role, currentUserId: ctx.user.id });
}
export async function PATCH(request: Request) {
  const ctx = await context(request); if (!ctx?.membership) return errorResponse("Empresa não encontrada.", 403);
  if (ctx.membership.role !== "OWNER") return errorResponse("Apenas o proprietário pode alterar permissões.", 403);
  const parsed = schema.safeParse(await readJson(request)); if (!parsed.success) return errorResponse("Dados inválidos.", 400, parsed.error.flatten().fieldErrors);
  const target = await prisma.companyMember.findFirst({ where: { companyId: ctx.membership.companyId, userId: parsed.data.memberUserId, status: "ACTIVE" } });
  if (!target) return errorResponse("Membro não encontrado.", 404);
  if (target.userId === ctx.user.id && parsed.data.role !== "OWNER") return errorResponse("O proprietário não pode remover a própria função.", 409);
  const ownerCount = await prisma.companyMember.count({ where: { companyId: ctx.membership.companyId, role: "OWNER", status: "ACTIVE" } });
  if (target.role === "OWNER" && parsed.data.role !== "OWNER" && ownerCount <= 1) return errorResponse("A empresa precisa de pelo menos um OWNER.", 409);
  const member = await prisma.companyMember.update({ where: { id: target.id }, data: { role: parsed.data.role }, include: { user: { select: { id: true, name: true, email: true, accountType: true, status: true } } } });
  return Response.json({ data: member });
}

const revokeSchema = z.object({
  memberUserId: z.coerce.number().int().positive(),
});

export async function DELETE(request: Request) {
  const ctx = await context(request);
  if (!ctx?.membership) return errorResponse("Empresa não encontrada.", 403);
  if (ctx.membership.role !== "OWNER") return errorResponse("Apenas o proprietário pode remover membros.", 403);

  const parsed = revokeSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Membro inválido.", 400);
  if (parsed.data.memberUserId === ctx.user.id) {
    return errorResponse("Não pode remover o seu próprio acesso. Transfira a propriedade antes de sair.", 409);
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const target = await tx.companyMember.findFirst({
        where: {
          companyId: ctx.membership!.companyId,
          userId: parsed.data.memberUserId,
          status: "ACTIVE",
        },
        include: { user: { select: { id: true, name: true, accountType: true, companyId: true } } },
      });
      if (!target) throw new Error("MEMBER_NOT_FOUND");

      if (target.role === "OWNER") {
        const ownerCount = await tx.companyMember.count({
          where: { companyId: ctx.membership!.companyId, role: "OWNER", status: "ACTIVE" },
        });
        if (ownerCount <= 1) throw new Error("LAST_OWNER");
      }

      const deactivated = await tx.companyMember.updateMany({
        where: { id: target.id, companyId: ctx.membership!.companyId, status: "ACTIVE" },
        data: { status: "INACTIVE" },
      });
      if (deactivated.count !== 1) throw new Error("MEMBER_CHANGED");

      const otherMembership = await tx.companyMember.findFirst({
        where: {
          userId: target.userId,
          status: "ACTIVE",
          companyId: { not: ctx.membership!.companyId },
          company: { status: "ACTIVE" },
        },
        select: { companyId: true },
      });

      if (target.user.companyId === ctx.membership!.companyId || target.user.accountType === "B2B") {
        await tx.user.update({
          where: { id: target.userId },
          data: otherMembership
            ? { accountType: "B2B", companyId: otherMembership.companyId, b2bRequestStatus: "APPROVED" }
            : { accountType: "B2C", companyId: null, b2bRequestStatus: "NONE" },
        });
      }

      return { userId: target.userId, name: target.user.name };
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });

    await createNotificationIfAllowed({
      userId: outcome.userId,
      channel: "orderUpdates",
      type: "B2B_ACCESS_REVOKED",
      title: "Acesso empresarial atualizado",
      message: "O seu acesso à empresa foi revogado pelo proprietário. A sua conta pessoal continua disponível.",
      link: "/account",
      dedupeKey: "b2b:membership-revoked:" + ctx.membership.companyId + ":" + outcome.userId,
    }).catch(() => undefined);

    return Response.json({ data: { removed: true, memberUserId: outcome.userId } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "MEMBER_NOT_FOUND") return errorResponse("Membro ativo não encontrado.", 404);
    if (code === "LAST_OWNER") return errorResponse("A empresa precisa de pelo menos um proprietário ativo.", 409);
    if (code === "MEMBER_CHANGED" || (error as { code?: string })?.code === "P2034") {
      return errorResponse("O membro foi alterado em simultâneo. Atualize a lista e tente de novo.", 409);
    }
    return errorResponse("Não foi possível revogar o acesso empresarial.", 503);
  }
}
