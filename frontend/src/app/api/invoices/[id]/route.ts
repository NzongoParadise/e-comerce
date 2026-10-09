import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticate(request);
  const subject = userSubject(auth);
  if (!subject) return errorResponse("Authentication required", 401);

  const id = Number(new URL(request.url).pathname.split("/").filter(Boolean).at(-1));
  if (!Number.isInteger(id) || id <= 0) return errorResponse("Fatura não encontrada.", 404);

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true },
  });
  if (!user) return errorResponse("Authentication required", 401);

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          country: true,
          currency: true,
          totalEUR: true,
          totalKZ: true,
          discountTotalEUR: true,
          discountTotalKZ: true,
          address: true,
          phone: true,
          createdAt: true,
          items: { select: { name: true, slug: true, quantity: true, unitPrice: true, subtotal: true, imageUrl: true } },
          payment: { select: { status: true, provider: true, method: true, paidAt: true } },
        },
      },
      user: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, legalName: true, tradeName: true, nif: true, address: true, email: true } },
    },
  });
  if (!invoice) return errorResponse("Fatura não encontrada.", 404);

  let authorized = isAdmin(auth) || invoice.userId === user.id;
  if (!authorized && user.accountType === "B2B" && invoice.companyId) {
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId: user.id,
        companyId: invoice.companyId,
        status: "ACTIVE",
        company: { status: "ACTIVE" },
      },
      select: { id: true },
    });
    authorized = Boolean(membership);
  }
  if (!authorized) return errorResponse("Fatura não encontrada.", 404);

  return Response.json({ data: invoice });
}
