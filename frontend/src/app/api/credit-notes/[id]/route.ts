import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticate(request);
  const subject = userSubject(auth);
  if (!subject) return errorResponse("Authentication required", 401);

  const id = Number(new URL(request.url).pathname.split("/").filter(Boolean).at(-1));
  if (!Number.isInteger(id) || id <= 0) return errorResponse("Nota de crédito não encontrada.", 404);

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true },
  });
  if (!user) return errorResponse("Authentication required", 401);

  const note = await prisma.creditNote.findUnique({
    where: { id },
    include: {
      invoice: { select: { id: true, invoiceNumber: true, status: true, issuedAt: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          currency: true,
          totalEUR: true,
          totalKZ: true,
          items: { select: { name: true, quantity: true, unitPrice: true, subtotal: true } },
        },
      },
      refund: { select: { id: true, status: true, provider: true, providerRefundId: true, processedAt: true } },
      user: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, legalName: true, tradeName: true, nif: true, email: true, address: true } },
    },
  });
  if (!note) return errorResponse("Nota de crédito não encontrada.", 404);

  let authorized = isAdmin(auth) || note.userId === user.id;
  if (!authorized && user.accountType === "B2B" && note.companyId) {
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId: user.id,
        companyId: note.companyId,
        status: "ACTIVE",
        company: { status: "ACTIVE" },
      },
      select: { id: true },
    });
    authorized = Boolean(membership);
  }
  if (!authorized) return errorResponse("Nota de crédito não encontrada.", 404);

  return Response.json({ data: note });
}
