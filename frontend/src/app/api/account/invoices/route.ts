import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Authentication required", 401);

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true },
  });
  if (!user) return errorResponse("Perfil de utilizador não encontrado.", 401);

  let where: { userId?: number; companyId?: number } = { userId: user.id };
  if (user.accountType === "B2B") {
    const membership = await prisma.companyMember.findFirst({
      where: { userId: user.id, status: "ACTIVE", company: { status: "ACTIVE" } },
      select: { companyId: true },
    });
    if (!membership) return errorResponse("Empresa ativa não encontrada.", 403);
    where = { companyId: membership.companyId };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      id: true,
      invoiceNumber: true,
      verificationCode: true,
      status: true,
      currency: true,
      totalEUR: true,
      totalKZ: true,
      issuedAt: true,
      creditNotes: {
        select: { id: true, creditNoteNumber: true, verificationCode: true, status: true, currency: true, amountEUR: true, amountKZ: true, issuedAt: true },
        orderBy: { issuedAt: "desc" },
      },
      order: {
        select: {
          orderNumber: true,
          status: true,
          payment: { select: { status: true, paidAt: true } },
        },
      },
    },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });
  return Response.json({ data: invoices });
}
