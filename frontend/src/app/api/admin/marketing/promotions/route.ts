import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

const actionSchema = z.object({
  type: z.enum(["PERCENTAGE", "FIXED", "FIXED_PRICE", "FREE_SHIPPING"]),
  value: z.coerce.number().nonnegative().optional(),
  maxDiscount: z.coerce.number().positive().optional().nullable(),
});

const ruleSchema = z.object({
  kind: z.enum(["MARKET", "CHANNEL", "CUSTOMER_TIER", "FIRST_ORDER", "MIN_ORDER"]),
  operator: z.enum(["EQ", "NEQ", "IN", "GTE", "GT", "LTE", "LT"]).default("EQ"),
  value: z.string().min(1).max(200),
});

const promotionSchema = z.object({
  name: z.string().trim().min(3).max(160),
  slug: z.string().trim().min(3).max(160).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(1000).optional().nullable(),
  code: z.string().trim().min(3).max(40).regex(/^[A-Z0-9_-]+$/).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).default("DRAFT"),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional().nullable(),
  priority: z.coerce.number().int().min(0).max(10000).default(0),
  stackable: z.boolean().default(false),
  exclusive: z.boolean().default(false),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  perCustomerLimit: z.coerce.number().int().positive().optional().nullable(),
  minOrderAOA: z.coerce.number().nonnegative().optional().nullable(),
  minOrderEUR: z.coerce.number().nonnegative().optional().nullable(),
  active: z.boolean().default(true),
  rules: z.array(ruleSchema).max(20).default([]),
  actions: z.array(actionSchema).min(1).max(5),
  productIds: z.array(z.coerce.number().int().positive()).max(500).default([]),
  categoryIds: z.array(z.coerce.number().int().positive()).max(100).default([]),
  brandIds: z.array(z.coerce.number().int().positive()).max(100).default([]),
});

async function admin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse("Authentication required", 401);
  if (!isAdmin(user)) return errorResponse("Administrator access required", 403);
  return null;
}

export async function GET(request: Request) {
  const authError = await admin(request);
  if (authError) return authError;
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim();
  const status = url.searchParams.get("status");
  const promotions = await prisma.promotion.findMany({
    where: {
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }] } : {}),
      ...(status && ["DRAFT", "ACTIVE", "PAUSED", "ENDED"].includes(status) ? { status } : {}),
    },
    include: { actions: true, rules: true, _count: { select: { usages: true } } },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
  });
  return Response.json({ data: promotions });
}

export async function POST(request: Request) {
  const authError = await admin(request);
  if (authError) return authError;
  const parsed = promotionSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid promotion data", 400, parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  if (data.endAt && data.endAt <= data.startAt) return errorResponse("A data final deve ser posterior à data inicial", 400);
  if (data.actions.some((action) => action.type !== "FREE_SHIPPING" && (!action.value || action.value <= 0))) return errorResponse("As ações de desconto devem ter um valor positivo", 400);
  if (data.actions.some((action) => action.type === "PERCENTAGE" && Number(action.value) > 100)) return errorResponse("Percentagem não pode exceder 100%", 400);
  try {
    const promotion = await prisma.promotion.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        code: data.code?.toUpperCase() || null,
        status: data.status,
        startAt: data.startAt,
        endAt: data.endAt,
        priority: data.priority,
        stackable: data.stackable,
        exclusive: data.exclusive,
        usageLimit: data.usageLimit,
        perCustomerLimit: data.perCustomerLimit,
        minOrderAOA: data.minOrderAOA,
        minOrderEUR: data.minOrderEUR,
        active: data.active,
        rules: { create: data.rules },
        actions: { create: data.actions.map((action) => ({ type: action.type, value: action.value, maxDiscount: action.maxDiscount })) },
        products: { create: data.productIds.map((productId) => ({ productId })) },
        categories: { create: data.categoryIds.map((categoryId) => ({ categoryId })) },
        brands: { create: data.brandIds.map((brandId) => ({ brandId })) },
      },
      include: { rules: true, actions: true },
    });
    return Response.json({ data: promotion }, { status: 201 });
  } catch (error) {
    console.error("Error creating promotion:", error);
    return errorResponse("Não foi possível criar a promoção", 409);
  }
}
