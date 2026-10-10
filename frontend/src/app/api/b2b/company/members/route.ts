import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

const roleSchema = z.enum(["OWNER", "ADMIN", "BUYER", "APPROVER"]);
const addMemberSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  role: z.enum(["ADMIN", "BUYER", "APPROVER"]).default("BUYER"),
});
const memberActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("role"),
    memberUserId: z.coerce.number().int().positive(),
    role: roleSchema,
  }),
  z.object({
    action: z.literal("remove"),
    memberUserId: z.coerce.number().int().positive(),
  }),
]);

async function context(request: Request) {
  const auth = await authenticate(request);
  const subject = userSubject(auth);
  if (!subject) return null;
  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true, accessRole: true, status: true },
  });
  if (!user) return null;
  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: { company: { select: { id: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });
  return { user, membership };
}

export async function GET(request: Request) {
  const ctx = await context(request);
  if (!ctx) return errorResponse("Não autenticado.", 401);
  if (ctx.user.accessRole !== "CUSTOMER" || ctx.user.accountType !== "B2B" || ctx.user.status !== "ACTIVE") {
    return errorResponse("Esta funcionalidade requer uma conta empresarial ativa.", 403);
  }
  if (!ctx.membership) return Response.json({ data: [], currentRole: null });

  const members = await prisma.companyMember.findMany({
    where: { companyId: ctx.membership.companyId, status: "ACTIVE" },
    include: {
      user: { select: { id: true, name: true, email: true, accountType: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({
    data: members,
    currentRole: ctx.membership.role,
    companyStatus: ctx.membership.company.status,
  });
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if (!ctx) return errorResponse("Não autenticado.", 401);
  if (ctx.user.accessRole !== "CUSTOMER" || ctx.user.accountType !== "B2B" || ctx.user.status !== "ACTIVE") {
    return errorResponse("Esta funcionalidade requer uma conta empresarial ativa.", 403);
  }
  if (!ctx.membership || ctx.membership.role !== "OWNER") {
    return errorResponse("Apenas o proprietário pode associar membros à empresa.", 403);
  }
  if (ctx.membership.company.status !== "ACTIVE") {
    return errorResponse("A associação de membros fica disponível depois da homologação da empresa.", 409);
  }
  const parsed = addMemberSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Email ou permissão inválidos.", 400, parsed.error.flatten().fieldErrors);
  const companyId = ctx.membership.companyId;

  try {
    const member = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { status: true } });
      if (!company || company.status !== "ACTIVE") throw new Error("COMPANY_NOT_ACTIVE");
      const user = await tx.user.findUnique({
        where: { email: parsed.data.email },
        select: {
          id: true,
          accountType: true,
          accessRole: true,
          status: true,
          companyId: true,
          companyMemberships: { where: { status: "ACTIVE" }, select: { companyId: true } },
        },
      });
      if (!user) throw new Error("MEMBER_ACCOUNT_NOT_FOUND");
      if (user.accessRole !== "CUSTOMER" || user.accountType !== "B2B" || user.status !== "ACTIVE") {
        throw new Error("MEMBER_ACCOUNT_NOT_ELIGIBLE");
      }
      if ((user.companyId !== null && user.companyId !== companyId)
        || user.companyMemberships.some((membership) => membership.companyId !== companyId)) {
        throw new Error("MEMBER_ALREADY_LINKED");
      }
      const member = await tx.companyMember.upsert({
        where: { companyId_userId: { companyId, userId: user.id } },
        create: { companyId, userId: user.id, role: parsed.data.role, status: "ACTIVE" },
        update: { role: parsed.data.role, status: "ACTIVE" },
        include: { user: { select: { id: true, name: true, email: true, accountType: true, status: true } } },
      });
      await tx.user.updateMany({
        where: { id: user.id, companyId: null },
        data: { companyId },
      });
      return member;
    }, { isolationLevel: "Serializable" });
    return Response.json({ data: member }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_ACCOUNT_NOT_FOUND") return errorResponse("Não existe uma conta registada com esse email.", 404);
    if (error instanceof Error && error.message === "COMPANY_NOT_ACTIVE") return errorResponse("A empresa precisa de estar ativa para associar novos membros.", 409);
    if (error instanceof Error && error.message === "MEMBER_ACCOUNT_NOT_ELIGIBLE") return errorResponse("Só podem ser associados clientes B2B com conta ativa.", 409);
    if (error instanceof Error && error.message === "MEMBER_ALREADY_LINKED") return errorResponse("Este utilizador já está associado a outra empresa.", 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("A equipa foi alterada em simultâneo. Atualize a página e tente novamente.", 409);
    console.error("Unable to add B2B company member:", error);
    return errorResponse("Não foi possível associar o utilizador à empresa.", 503);
  }
}

export async function PATCH(request: Request) {
  const ctx = await context(request);
  if (!ctx) return errorResponse("Não autenticado.", 401);
  if (ctx.user.accessRole !== "CUSTOMER" || ctx.user.accountType !== "B2B" || ctx.user.status !== "ACTIVE") {
    return errorResponse("Esta funcionalidade requer uma conta empresarial ativa.", 403);
  }
  if (!ctx.membership || ctx.membership.role !== "OWNER") {
    return errorResponse("Apenas o proprietário pode alterar os membros da empresa.", 403);
  }
  const parsed = memberActionSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Alteração de membro inválida.", 400, parsed.error.flatten().fieldErrors);
  const companyId = ctx.membership.companyId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.companyMember.findFirst({
        where: {
          companyId,
          userId: parsed.data.memberUserId,
          status: "ACTIVE",
        },
        select: { id: true, userId: true, role: true },
      });
      if (!target) throw new Error("MEMBER_NOT_FOUND");

      const removing = parsed.data.action === "remove";
      const nextRole = parsed.data.action === "role" ? parsed.data.role : target.role;
      if (target.role === "OWNER" && (removing || nextRole !== "OWNER")) {
        const activeOwners = await tx.companyMember.count({
          where: { companyId, role: "OWNER", status: "ACTIVE" },
        });
        if (activeOwners <= 1) throw new Error("LAST_ACTIVE_OWNER");
      }

      const member = await tx.companyMember.update({
        where: { id: target.id },
        data: removing ? { status: "INACTIVE" } : { role: nextRole },
        include: { user: { select: { id: true, name: true, email: true, accountType: true, status: true } } },
      });
      if (removing) {
        await tx.user.updateMany({
          where: { id: target.userId, companyId },
          data: { companyId: null },
        });
      }
      const anotherActiveMembership = await tx.companyMember.findFirst({
        where: { userId: target.userId, status: "ACTIVE", companyId: { not: companyId } },
        select: { companyId: true },
      });
      if (anotherActiveMembership) {
        await tx.user.updateMany({
          where: { id: target.userId, companyId: null },
          data: { companyId: anotherActiveMembership.companyId },
        });
      }
      return member;
    }, { isolationLevel: "Serializable" });
    return Response.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") return errorResponse("Membro não encontrado nesta empresa.", 404);
    if (error instanceof Error && error.message === "LAST_ACTIVE_OWNER") return errorResponse("A empresa deve manter pelo menos um proprietário ativo.", 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("A equipa foi alterada em simultâneo. Atualize a página e tente novamente.", 409);
    console.error("Unable to update B2B company member:", error);
    return errorResponse("Não foi possível atualizar o membro.", 503);
  }
}
