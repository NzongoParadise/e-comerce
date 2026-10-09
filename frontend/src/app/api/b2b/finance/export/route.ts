import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_LIMIT = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(";");
}

function amount(currency: string, eur: unknown, aoa: unknown) {
  return currency === "EUR" ? Number(eur || 0) : Number(aoa || 0);
}

export async function GET(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Authentication required", 401);

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true },
  });
  if (!user || user.accountType !== "B2B") return errorResponse("Esta exportação requer uma conta empresarial.", 403);

  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE", company: { status: "ACTIVE" } },
    select: { companyId: true, role: true, company: { select: { tradeName: true, legalName: true, country: true } } },
  });
  if (!membership) return errorResponse("Empresa não encontrada ou inativa.", 403);
  if (!["OWNER", "APPROVER"].includes(membership.role)) {
    return errorResponse("Apenas o proprietário ou aprovador pode exportar dados financeiros.", 403);
  }

  const params = new URL(request.url).searchParams;
  const toRaw = params.get("to");
  const fromRaw = params.get("from");
  const to = toRaw ? new Date(toRaw) : new Date();
  const from = fromRaw ? new Date(fromRaw) : new Date(to.getTime() - 365 * DAY_MS);
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from.getTime() > to.getTime() ||
    to.getTime() - from.getTime() > 366 * DAY_MS
  ) {
    return errorResponse("Período inválido. Indique datas ISO e um intervalo máximo de 366 dias.", 400);
  }
  to.setUTCHours(23, 59, 59, 999);

  const dateRange = { gte: from, lte: to };
  const [payments, invoices, creditNotes, refunds] = await Promise.all([
    prisma.payment.findMany({
      where: { order: { companyId: membership.companyId }, createdAt: dateRange },
      select: {
        id: true,
        provider: true,
        method: true,
        status: true,
        currency: true,
        amountEUR: true,
        amountKZ: true,
        referenceNumber: true,
        entity: true,
        providerPaymentId: true,
        createdAt: true,
        paidAt: true,
        order: { select: { orderNumber: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: EXPORT_LIMIT + 1,
    }),
    prisma.invoice.findMany({
      where: { companyId: membership.companyId, issuedAt: dateRange },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        currency: true,
        totalEUR: true,
        totalKZ: true,
        issuedAt: true,
        verificationCode: true,
        order: { select: { orderNumber: true } },
      },
      orderBy: [{ issuedAt: "asc" }, { id: "asc" }],
      take: EXPORT_LIMIT + 1,
    }),
    prisma.creditNote.findMany({
      where: { companyId: membership.companyId, issuedAt: dateRange },
      select: {
        id: true,
        creditNoteNumber: true,
        status: true,
        currency: true,
        amountEUR: true,
        amountKZ: true,
        issuedAt: true,
        verificationCode: true,
        order: { select: { orderNumber: true } },
      },
      orderBy: [{ issuedAt: "asc" }, { id: "asc" }],
      take: EXPORT_LIMIT + 1,
    }),
    prisma.refund.findMany({
      where: { order: { companyId: membership.companyId }, createdAt: dateRange },
      select: {
        id: true,
        status: true,
        provider: true,
        providerRefundId: true,
        currency: true,
        amountEUR: true,
        amountKZ: true,
        reason: true,
        createdAt: true,
        processedAt: true,
        order: { select: { orderNumber: true } },
        returnRequest: { select: { requestNumber: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: EXPORT_LIMIT + 1,
    }),
  ]);

  const datasets = [
    { name: "pagamentos", data: payments },
    { name: "faturas", data: invoices },
    { name: "notas de crédito", data: creditNotes },
    { name: "reembolsos", data: refunds },
  ];
  const overflow = datasets.find((dataset) => dataset.data.length > EXPORT_LIMIT);
  if (overflow) {
    return errorResponse(
      "O período contém mais de " + EXPORT_LIMIT + " registos de " + overflow.name + ". Reduza o intervalo para exportar sem truncar dados.",
      413,
    );
  }

  const rows: unknown[][] = [[
    "Tipo",
    "Data",
    "Documento",
    "Encomenda",
    "Estado",
    "Fornecedor",
    "Método",
    "Moeda",
    "Valor",
    "Referência externa",
    "Referência de devolução",
    "Detalhe",
  ]];

  for (const payment of payments) {
    rows.push([
      "PAGAMENTO",
      payment.paidAt || payment.createdAt,
      "PAY-" + payment.id,
      payment.order.orderNumber,
      payment.status,
      payment.provider,
      payment.method,
      payment.currency,
      amount(payment.currency, payment.amountEUR, payment.amountKZ).toFixed(payment.currency === "EUR" ? 2 : 0),
      payment.referenceNumber || payment.providerPaymentId || payment.entity,
      "",
      "",
    ]);
  }
  for (const invoice of invoices) {
    rows.push([
      "FATURA",
      invoice.issuedAt,
      invoice.invoiceNumber,
      invoice.order.orderNumber,
      invoice.status,
      "RUBRICA DILIGENTE",
      "",
      invoice.currency,
      amount(invoice.currency, invoice.totalEUR, invoice.totalKZ).toFixed(invoice.currency === "EUR" ? 2 : 0),
      invoice.verificationCode,
      "",
      "",
    ]);
  }
  for (const note of creditNotes) {
    rows.push([
      "NOTA_DE_CREDITO",
      note.issuedAt,
      note.creditNoteNumber,
      note.order.orderNumber,
      note.status,
      "RUBRICA DILIGENTE",
      "",
      note.currency,
      amount(note.currency, note.amountEUR, note.amountKZ).toFixed(note.currency === "EUR" ? 2 : 0),
      note.verificationCode,
      "",
      "",
    ]);
  }
  for (const refund of refunds) {
    rows.push([
      "REEMBOLSO",
      refund.processedAt || refund.createdAt,
      "REF-" + refund.id,
      refund.order.orderNumber,
      refund.status,
      refund.provider,
      "",
      refund.currency,
      amount(refund.currency, refund.amountEUR, refund.amountKZ).toFixed(refund.currency === "EUR" ? 2 : 0),
      refund.providerRefundId,
      refund.returnRequest?.requestNumber || "",
      refund.reason,
    ]);
  }

  const prefix = "\uFEFF";
  const csv = prefix + rows.map(csvRow).join("\r\n") + "\r\n";
  const companyName = membership.company.tradeName || membership.company.legalName || "empresa";
  const safeName = companyName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "empresa";
  const fileName = "financeiro-" + safeName + "-" + from.toISOString().slice(0, 10) + "-" + to.toISOString().slice(0, 10) + ".csv";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + fileName + '"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
