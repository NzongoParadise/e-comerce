import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

const querySchema = z.object({
  status: z.enum(["ALL", "ISSUED", "VOIDED"]).default("ALL"),
  search: z.string().trim().max(160).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !isAdmin(auth)) return errorResponse("Administrator access required", 403);

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse("Filtros de notas de crédito inválidos.", 400);

  const { status, search, page, pageSize } = parsed.data;
  const where: Prisma.CreditNoteWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(search ? {
      OR: [
        { creditNoteNumber: { contains: search, mode: "insensitive" } },
        { invoice: { invoiceNumber: { contains: search, mode: "insensitive" } } },
        { order: { orderNumber: { contains: search, mode: "insensitive" } } },
        { buyerName: { contains: search, mode: "insensitive" } },
        { buyerTaxId: { contains: search, mode: "insensitive" } },
      ],
    } : {}),
  };

  try {
    const [data, total, counts] = await prisma.$transaction([
      prisma.creditNote.findMany({
        where,
        include: {
          invoice: { select: { id: true, invoiceNumber: true, status: true } },
          order: { select: { id: true, orderNumber: true, status: true } },
          refund: { select: { id: true, status: true, provider: true, providerRefundId: true, processedAt: true } },
          user: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, legalName: true, tradeName: true, nif: true } },
        },
        orderBy: { issuedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.creditNote.count({ where }),
      prisma.creditNote.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    return Response.json({
      data,
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) },
      stats: Object.fromEntries(counts.map((item) => [item.status, item._count._all])),
    });
  } catch (error) {
    console.error("Unable to load credit notes:", error);
    return errorResponse("Não foi possível carregar as notas de crédito.", 503);
  }
}
