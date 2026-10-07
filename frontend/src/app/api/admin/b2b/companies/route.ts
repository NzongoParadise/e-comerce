import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin } from "@/lib/server/api";
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
  const company = await prisma.company.update({ where: { id: body.companyId }, data: { status: body.status } });
  return Response.json({ data: company });
}
