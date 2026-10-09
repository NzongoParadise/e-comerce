import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const code = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
  if (!code || !/^[A-Za-z0-9_-]{12,64}$/.test(code)) {
    return errorResponse("Código de verificação inválido.", 400);
  }

  const invoice = await prisma.invoice.findUnique({
    where: { verificationCode: code },
    select: {
      invoiceNumber: true,
      status: true,
      currency: true,
      totalEUR: true,
      totalKZ: true,
      sellerName: true,
      sellerTaxId: true,
      issuedAt: true,
      voidedAt: true,
      order: {
        select: {
          orderNumber: true,
          status: true,
          payment: { select: { status: true } },
        },
      },
    },
  });
  if (!invoice) return errorResponse("Não foi encontrada uma fatura com este código.", 404);

  return Response.json({
    data: {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      isValid: invoice.status === "ISSUED",
      currency: invoice.currency,
      totalEUR: invoice.totalEUR,
      totalKZ: invoice.totalKZ,
      sellerName: invoice.sellerName,
      sellerTaxId: invoice.sellerTaxId,
      issuedAt: invoice.issuedAt,
      voidedAt: invoice.voidedAt,
      orderNumber: invoice.order.orderNumber,
      orderStatus: invoice.order.status,
      paymentStatus: invoice.order.payment?.status || "UNKNOWN",
    },
  });
}
