import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { z } from "zod";
export const runtime = "nodejs";
const schema = z.object({ memberUserId: z.coerce.number().int().positive(), role: z.enum(["BUYER", "APPROVER", "OWNER"]) });
async function context(request: Request) {
  const auth = await authenticate(request); const subject = userSubject(auth); if (!subject) return null;
  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true, accountType: true } }); if (!user) return null;
  const membership = await prisma.companyMember.findFirst({ where: { userId: user.id, status: "ACTIVE" } }); return { user, membership };
}
export async function GET(request: Request) {
  const ctx = await context(request); if (!ctx?.membership) return errorResponse("Empresa não encontrada.", 403);
  const members = await prisma.companyMember.findMany({ where: { companyId: ctx.membership.companyId, status: "ACTIVE" }, include: { user: { select: { id: true, name: true, email: true, accountType: true, status: true } } }, orderBy: { createdAt: "asc" } });
  return Response.json({ data: members, currentRole: ctx.membership.role });
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