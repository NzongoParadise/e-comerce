import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin } from "@/lib/server/api";
import { createNotificationIfAllowed } from "@/lib/server/notifications";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !isAdmin(auth)) return errorResponse("Administrator access required", 403);
  const status = new URL(request.url).searchParams.get("status") || "PENDING";
  const companies = await prisma.company.findMany({
    where: status === "ALL" ? {} : { status },
    include: { members: { where: { status: "ACTIVE" }, include: { user: { select: { id: true, name: true, email: true } } } } },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  return Response.json({ data: companies });
}

export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !isAdmin(auth)) return errorResponse("Administrator access required", 403);
  const body = await request.json().catch(() => null) as { companyId?: number; status?: string } | null;
  if (!body?.companyId || !["ACTIVE", "REJECTED", "SUSPENDED"].includes(body.status || "")) return errorResponse("Dados de homologação inválidos.", 400);
  const existing = await prisma.company.findUnique({
    where: { id: body.companyId },
    include: { members: { where: { status: "ACTIVE" }, select: { userId: true } } },
  });
  if (!existing) return errorResponse("Empresa não encontrada.", 404);
  const company = await prisma.company.update({ where: { id: body.companyId }, data: { status: body.status } });
  if (existing.status !== company.status) {
    const activated = company.status === "ACTIVE";
    const suspended = company.status === "SUSPENDED";
    await Promise.allSettled(existing.members.map((member) => createNotificationIfAllowed({
      userId: member.userId,
      channel: "orderUpdates",
      type: "B2B_COMPANY_STATUS_CHANGED",
      title: activated ? "Empresa homologada" : suspended ? "Acesso empresarial suspenso" : "Pedido empresarial rejeitado",
      message: activated
        ? "A empresa foi homologada. Já pode aceder às operações B2B."
        : suspended
          ? "O acesso empresarial está suspenso. Contacte o suporte se considerar que se trata de um erro."
          : "O pedido de acesso empresarial foi rejeitado. Contacte o suporte para esclarecer os próximos passos.",
      link: "/b2b/empresa",
      dedupeKey: `company:${company.id}:status:${company.status}`,
    })));
  }
  return Response.json({ data: company });
}
