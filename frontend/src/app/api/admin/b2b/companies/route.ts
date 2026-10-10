import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

const listSchema = z.object({
  status: z.enum(["ALL", "PENDING", "ACTIVE", "REJECTED", "SUSPENDED"]).default("ALL"),
  search: z.string().trim().max(160).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const companyChanges = z.object({
  legalName: z.string().trim().min(2).max(160).optional(),
  tradeName: z.string().trim().max(160).nullable().optional(),
  nif: z.string().trim().min(5).max(40).transform((value) => value.toUpperCase()).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  country: z.string().trim().min(2).max(80).optional(),
  province: z.string().trim().max(80).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    companyId: z.number().int().positive(),
    status: z.enum(["ACTIVE", "REJECTED", "SUSPENDED"]),
    reason: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal("details"),
    companyId: z.number().int().positive(),
    changes: companyChanges.refine((value) => Object.keys(value).length > 0, "Indique pelo menos um campo."),
  }),
  z.object({
    action: z.literal("member"),
    companyId: z.number().int().positive(),
    memberId: z.number().int().positive(),
    role: z.enum(["OWNER", "ADMIN", "BUYER", "APPROVER"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }),
  z.object({
    action: z.literal("addMember"),
    companyId: z.number().int().positive(),
    email: z.string().trim().email().max(254),
    role: z.enum(["OWNER", "ADMIN", "BUYER", "APPROVER"]).default("BUYER"),
  }),
]);

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse("Authentication required", 401), actorId: null };
  if (!isAdmin(user)) return { error: errorResponse("Administrator access required", 403), actorId: null };
  const actor = typeof user.sub === "string"
    ? await prisma.user.findUnique({ where: { externalId: user.sub }, select: { id: true } })
    : null;
  if (!actor) return { error: errorResponse("Administrator profile not found", 403), actorId: null };
  return { error: null, actorId: actor.id };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse("Filtros de empresas inválidos.", 400, parsed.error.flatten().fieldErrors);
  const { status, search, page, pageSize } = parsed.data;
  const where = {
    ...(status === "ALL" ? {} : { status }),
    ...(search ? {
      OR: [
        { legalName: { contains: search, mode: "insensitive" as const } },
        { tradeName: { contains: search, mode: "insensitive" as const } },
        { nif: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { members: { some: { user: { OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ] } } } },
      ],
    } : {}),
  };
  try {
    const [data, total, pending, active, rejected, suspended] = await prisma.$transaction([
      prisma.company.findMany({
        where,
        include: {
          members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
          statusHistory: { orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { id: true, name: true, email: true } } } },
          _count: { select: { quotes: true, orders: true, priceRules: true, purchaseOrders: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.company.count({ where }),
      prisma.company.count({ where: { status: "PENDING" } }),
      prisma.company.count({ where: { status: "ACTIVE" } }),
      prisma.company.count({ where: { status: "REJECTED" } }),
      prisma.company.count({ where: { status: "SUSPENDED" } }),
    ]);
    return Response.json({
      data,
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
      stats: { PENDING: pending, ACTIVE: active, REJECTED: rejected, SUSPENDED: suspended },
    });
  } catch (error) {
    console.error("Unable to load B2B companies:", error);
    return errorResponse("Não foi possível carregar as empresas.", 503);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Alteração empresarial inválida.", 400, parsed.error.flatten().fieldErrors);
  const operation = parsed.data;
  if (operation.action === "status" && operation.status === "REJECTED" && !operation.reason?.trim()) {
    return errorResponse("Indique o motivo da rejeição.", 400);
  }
  if (operation.action === "member" && operation.role === undefined && operation.status === undefined) {
    return errorResponse("Indique a alteração do membro.", 400);
  }

  try {
    if (operation.action === "status") {
      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.company.findUnique({ where: { id: operation.companyId }, select: { status: true } });
        if (!current) return null;
        if (current.status === operation.status) return tx.company.findUnique({ where: { id: operation.companyId } });
        if (current.status === "PENDING" && ["ACTIVE", "REJECTED"].includes(operation.status)) {
          const hasConversionRequest = await tx.companyMember.findFirst({
            where: {
              companyId: operation.companyId,
              role: "OWNER",
              status: "ACTIVE",
              user: { b2bRequestStatus: "PENDING" },
            },
            select: { id: true },
          });
          if (hasConversionRequest) throw new Error("USE_B2B_REQUEST_REVIEW");
        }
        if (operation.status === "ACTIVE") {
          const ineligibleOwner = await tx.companyMember.findFirst({
            where: {
              companyId: operation.companyId,
              role: "OWNER",
              status: "ACTIVE",
              user: { accountType: "B2C" },
            },
            select: { id: true },
          });
          if (ineligibleOwner) throw new Error("USE_B2B_REQUEST_REVIEW");
        }
        const claimed = await tx.company.updateMany({
          where: { id: operation.companyId, status: current.status },
          data: { status: operation.status },
        });
        if (!claimed.count) throw new Error("COMPANY_STATUS_CHANGED");
        await tx.companyStatusHistory.create({
          data: {
            companyId: operation.companyId,
            fromStatus: current.status,
            toStatus: operation.status,
            reason: operation.reason || null,
            actorUserId: auth.actorId,
          },
        });
        return tx.company.findUnique({ where: { id: operation.companyId } });
      }, { timeout: 15000 });
      if (!updated) return errorResponse("Empresa não encontrada.", 404);
      return Response.json({ data: updated });
    }

    if (operation.action === "details") {
      const company = await prisma.company.update({
        where: { id: operation.companyId },
        data: {
          ...operation.changes,
          ...(operation.changes.email === "" ? { email: null } : {}),
        },
      });
      return Response.json({ data: company });
    }

    if (operation.action === "addMember") {
      const member = await prisma.$transaction(async (tx) => {
        const company = await tx.company.findUnique({ where: { id: operation.companyId }, select: { id: true, status: true } });
        if (!company) throw new Error("COMPANY_NOT_FOUND");
        if (company.status !== "ACTIVE") throw new Error("COMPANY_NOT_ACTIVE");
        const user = await tx.user.findUnique({
          where: { email: operation.email.toLowerCase() },
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
        if ((user.companyId !== null && user.companyId !== company.id)
          || user.companyMemberships.some((membership) => membership.companyId !== company.id)) {
          throw new Error("MEMBER_ALREADY_LINKED");
        }
        const member = await tx.companyMember.upsert({
          where: { companyId_userId: { companyId: company.id, userId: user.id } },
          create: { companyId: company.id, userId: user.id, role: operation.role, status: "ACTIVE" },
          update: { role: operation.role, status: "ACTIVE" },
          include: { user: { select: { id: true, name: true, email: true } } },
        });
        if (user.companyId === null) await tx.user.update({ where: { id: user.id }, data: { companyId: company.id } });
        return member;
      }, { isolationLevel: "Serializable" });
      return Response.json({ data: member }, { status: 201 });
    }

    const updatedMember = await prisma.$transaction(async (tx) => {
      const member = await tx.companyMember.findFirst({
        where: { id: operation.memberId, companyId: operation.companyId },
        select: { id: true, role: true, status: true },
      });
      if (!member) throw new Error("COMPANY_MEMBER_NOT_FOUND");
      if (member.role === "OWNER" && member.status === "ACTIVE"
        && (operation.status === "INACTIVE" || (operation.role !== undefined && operation.role !== "OWNER"))) {
        const activeOwners = await tx.companyMember.count({
          where: { companyId: operation.companyId, role: "OWNER", status: "ACTIVE" },
        });
        if (activeOwners <= 1) throw new Error("LAST_ACTIVE_OWNER");
      }
      return tx.companyMember.update({
        where: { id: operation.memberId },
        data: {
          ...(operation.role === undefined ? {} : { role: operation.role }),
          ...(operation.status === undefined ? {} : { status: operation.status }),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    }, { isolationLevel: "Serializable" });
    return Response.json({ data: updatedMember });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_STATUS_CHANGED") return errorResponse("O estado da empresa foi alterado por outro administrador. Atualize a lista e tente novamente.", 409);
    if (error instanceof Error && error.message === "USE_B2B_REQUEST_REVIEW") return errorResponse("Decida este pedido na fila de conversão B2C para B2B para manter a conta e a empresa sincronizadas.", 409);
    if (error instanceof Error && error.message === "COMPANY_MEMBER_NOT_FOUND") return errorResponse("Membro não encontrado nesta empresa.", 404);
    if (error instanceof Error && error.message === "LAST_ACTIVE_OWNER") return errorResponse("A empresa deve manter pelo menos um proprietário ativo.", 409);
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") return errorResponse("Empresa não encontrada.", 404);
    if (error instanceof Error && error.message === "COMPANY_NOT_ACTIVE") return errorResponse("Só é possível associar membros a uma empresa ativa.", 409);
    if (error instanceof Error && error.message === "MEMBER_ACCOUNT_NOT_FOUND") return errorResponse("Não existe uma conta registada com esse email.", 404);
    if (error instanceof Error && error.message === "MEMBER_ACCOUNT_NOT_ELIGIBLE") return errorResponse("Apenas contas B2B ativas podem ser associadas a outra empresa.", 409);
    if (error instanceof Error && error.message === "MEMBER_ALREADY_LINKED") return errorResponse("Este utilizador já está associado a outra empresa.", 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("A associação foi alterada em simultâneo. Atualize os dados e tente novamente.", 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return errorResponse("Já existe uma empresa registada com este NIF.", 409);
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return errorResponse("Empresa ou membro não encontrado.", 404);
    }
    console.error("Unable to update B2B company:", error);
    return errorResponse("Não foi possível guardar as alterações.", 503);
  }
}
