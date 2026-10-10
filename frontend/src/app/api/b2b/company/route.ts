import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const companySchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  tradeName: z.string().trim().max(160).optional().default(""),
  nif: z.string().trim().min(5).max(40).transform((value) => value.toUpperCase()),
  country: z.string().trim().min(2).max(80).default("Angola"),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).nullable().optional(),
  phone: z.string().trim().max(40).optional().default(""),
  province: z.string().trim().max(80).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  address: z.string().trim().max(240).optional().default(""),
});

async function getUser(request: Request) {
  const auth = await authenticate(request);
  const subject = userSubject(auth);
  if (!subject) return null;
  return prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true, companyId: true },
  });
}

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return errorResponse("Não autenticado.", 401);
  const member = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  });
  if (!member) return Response.json({ data: null, role: null });
  return Response.json({ data: member.company, role: member.role });
}

export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return errorResponse("Não autenticado.", 401);
  if (user.accountType !== "B2B") return errorResponse("Esta operação requer uma conta empresarial homologada.", 403);
  const parsed = companySchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Dados empresariais inválidos.", 400, parsed.error.flatten().fieldErrors);

  try {
    const company = await prisma.$transaction(async (tx) => {
      const existingMembership = await tx.companyMember.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
        select: { id: true },
      });
      if (existingMembership || user.companyId !== null) throw new Error("COMPANY_ALREADY_LINKED");

      const existingCompany = await tx.company.findUnique({ where: { nif: parsed.data.nif }, select: { id: true } });
      if (existingCompany) throw new Error("NIF_ALREADY_EXISTS");

      const created = await tx.company.create({
        data: {
          ...parsed.data,
          email: parsed.data.email || null,
          status: "PENDING",
        },
      });
      await tx.companyStatusHistory.create({
        data: {
          companyId: created.id,
          fromStatus: null,
          toStatus: "PENDING",
          reason: "Registo empresarial submetido pelo proprietário.",
          actorUserId: user.id,
        },
      });
      await tx.companyMember.create({
        data: { companyId: created.id, userId: user.id, role: "OWNER", status: "ACTIVE" },
      });
      await tx.user.update({ where: { id: user.id }, data: { companyId: created.id } });
      return created;
    }, { isolationLevel: "Serializable" });
    return Response.json({ data: company, role: "OWNER" }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_ALREADY_LINKED") return errorResponse("A sua conta já está associada a uma empresa.", 409);
    if (error instanceof Error && error.message === "NIF_ALREADY_EXISTS") return errorResponse("Já existe uma empresa com este NIF. Contacte o suporte para pedir a associação.", 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("A conta ou os dados da empresa foram alterados em simultâneo. Atualize a página e tente novamente.", 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return errorResponse("Já existe uma empresa com este NIF.", 409);
    console.error("Unable to create B2B company:", error);
    return errorResponse("Não foi possível criar a empresa.", 503);
  }
}

export async function PATCH(request: Request) {
  const user = await getUser(request);
  if (!user) return errorResponse("Não autenticado.", 401);
  const member = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE", role: "OWNER" },
    select: { companyId: true },
  });
  if (!member) return errorResponse("Sem permissão para alterar a empresa.", 403);
  const parsed = companySchema.partial().safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Dados empresariais inválidos.", 400, parsed.error.flatten().fieldErrors);
  if (Object.keys(parsed.data).length === 0) return errorResponse("Indique pelo menos um campo para atualizar.", 400);

  try {
    const company = await prisma.company.update({
      where: { id: member.companyId },
      data: { ...parsed.data, ...(parsed.data.email === "" ? { email: null } : {}) },
    });
    return Response.json({ data: company, role: "OWNER" });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return errorResponse("Já existe uma empresa com este NIF.", 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") return errorResponse("Empresa não encontrada.", 404);
    console.error("Unable to update B2B company:", error);
    return errorResponse("Não foi possível atualizar os dados da empresa.", 503);
  }
}
