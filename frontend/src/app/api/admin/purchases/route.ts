import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

const itemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(1_000_000),
  unitCost: z.number().positive().max(1_000_000_000),
});

const createSchema = z.object({
  supplierId: z.number().int().positive().nullable().optional(),
  currency: z.enum(["AOA", "EUR"]).default("AOA"),
  transactionDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(itemSchema).min(1).max(500),
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse("Authentication required", 401) };
  if (!isAdmin(user)) return { error: errorResponse("Administrator access required", 403) };
  return { user };
}

function purchaseNumber() {
  return `CMP-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "ALL";
  const paymentStatus = url.searchParams.get("paymentStatus") || "ALL";
  const search = url.searchParams.get("search")?.trim() || "";
  const where = {
    ...(status !== "ALL" ? { status } : {}),
    ...(paymentStatus !== "ALL" ? { paymentStatus } : {}),
    ...(search ? { OR: [
      { purchaseNumber: { contains: search, mode: "insensitive" as const } },
      { reference: { contains: search, mode: "insensitive" as const } },
      { supplier: { name: { contains: search, mode: "insensitive" as const } } },
    ] } : {}),
  };
  try {
    const data = await prisma.purchase.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      take: 200,
      include: { supplier: { select: { id: true, name: true, taxId: true } }, items: { include: { product: { select: { id: true, name: true, stock: true } } } }, financeEntry: { select: { id: true, status: true, amount: true, currency: true } } },
    });
    return Response.json({ data });
  } catch (error) {
    console.error("Unable to load purchases:", error);
    return errorResponse("Unable to load purchase transactions", 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid purchase transaction", 400, parsed.error.flatten().fieldErrors);
  const actor = userSubject(auth.user);
  try {
    const productIds = parsed.data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } });
    const productMap = new Map(products.map((product) => [product.id, product]));
    if (products.length !== new Set(productIds).size) return errorResponse("Um ou mais produtos não existem.", 400);
    const items = parsed.data.items.map((item) => ({
      ...item,
      description: productMap.get(item.productId)!.name,
      subtotal: item.quantity * item.unitCost,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const purchase = await prisma.purchase.create({
      data: {
        purchaseNumber: purchaseNumber(),
        supplierId: parsed.data.supplierId ?? null,
        currency: parsed.data.currency,
        subtotal,
        total: subtotal,
        transactionDate: parsed.data.transactionDate || new Date(),
        dueDate: parsed.data.dueDate ?? null,
        reference: parsed.data.reference?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        createdBy: actor,
        updatedBy: actor,
        items: { create: items },
        events: { create: { actorExternalId: actor, eventType: "CREATED", payload: { subtotal, total: subtotal, currency: parsed.data.currency, items } } },
      },
      include: { supplier: true, items: { include: { product: true } }, events: true },
    });
    return Response.json({ data: purchase }, { status: 201 });
  } catch (error) {
    console.error("Unable to create purchase:", error);
    return errorResponse("Unable to create purchase transaction", 503);
  }
}
