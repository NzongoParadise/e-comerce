import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const code = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
  if (!code || !/^[A-Za-z0-9_-]{12,64}$/.test(code)) {
    return errorResponse("Código de verificação inválido.", 400);
  }

  const note = await prisma.creditNote.findUnique({
    where: { verificationCode: code },
    select: {
      creditNoteNumber: true,
      status: true,
      currency: true,
      amountEUR: true,
      amountKZ: true,
      sellerName: true,
      sellerTaxId: true,
      issuedAt: true,
      invoice: { select: { invoiceNumber: true, status: true } },
      order: { select: { orderNumber: true } },
      refund: { select: { status: true } },
    },
  });
  if (!note) return errorResponse("Não foi encontrada uma nota de crédito com este código.", 404);

  return Response.json({
    data: {
      creditNoteNumber: note.creditNoteNumber,
      status: note.status,
      isValid: note.status === "ISSUED" && note.invoice.status === "ISSUED" && note.refund.status === "SUCCEEDED",
      currency: note.currency,
      amountEUR: note.amountEUR,
      amountKZ: note.amountKZ,
      sellerName: note.sellerName,
      sellerTaxId: note.sellerTaxId,
      issuedAt: note.issuedAt,
      invoiceNumber: note.invoice.invoiceNumber,
      invoiceStatus: note.invoice.status,
      orderNumber: note.order.orderNumber,
      refundStatus: note.refund.status,
    },
  });
}
