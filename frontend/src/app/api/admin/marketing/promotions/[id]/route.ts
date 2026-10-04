import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  code: z.string().trim().min(3).max(40).regex(/^[A-Z0-9_-]+$/).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().nullable().optional(),
  priority: z.coerce.number().int().min(0).max(10000).optional(),
  stackable: z.boolean().optional(),
  exclusive: z.boolean().optional(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  perCustomerLimit: z.coerce.number().int().positive().nullable().optional(),
  minOrderAOA: z.coerce.number().nonnegative().nullable().optional(),
  minOrderEUR: z.coerce.number().nonnegative().nullable().optional(),
  active: z.boolean().optional(),
});

async function admin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse("Authentication required", 401);
  if (!isAdmin(user)) return errorResponse("Administrator access required", 403);
  return null;
}

function idFrom(request: Request) {
  const id = Number(new URL(request.url).pathname.split("/").filter(Boolean).at(-1));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request) {
  const authError = await admin(request);
  if (authError) return authError;
  const id = idFrom(request);
  if (!id) return errorResponse("Invalid promotion id", 400);
  const promotion = await prisma.promotion.findUnique({
    where: { id },
    include: { rules: true, actions: true, products: true, categories: true, brands: true, _count: { select: { usages: true } } },
  });
  if (!promotion) return errorResponse("Promotion not found", 404);
  return Response.json({ data: promotion });
}

export async function PATCH(request: Request) {
  const authError = await admin(request);
  if (authError) return authError;
  const id = idFrom(request);
  if (!id) return errorResponse("Invalid promotion id", 400);
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid promotion data", 400, parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  const current = await prisma.promotion.findUnique({ where: { id } });
  if (!current) return errorResponse("Promotion not found", 404);
  if (data.startAt && data.endAt && data.endAt <= data.startAt) return errorResponse("A data final deve ser posterior à data inicial", 400);
  try {
    const promotion = await prisma.promotion.update({ where: { id }, data, include: { rules: true, actions: true } });
    return Response.json({ data: promotion });
  } catch (error) {
    console.error("Error updating promotion:", error);
    return errorResponse("Não foi possível atualizar a promoção", 409);
  }
}

export async function DELETE(request: Request) {
  const authError = await admin(request);
  if (authError) return authError;
  const id = idFrom(request);
  if (!id) return errorResponse("Invalid promotion id", 400);
  const promotion = await prisma.promotion.updateMany({ where: { id }, data: { active: false, status: "PAUSED" } });
  if (!promotion.count) return errorResponse("Promotion not found", 404);
  return Response.json({ data: { deactivated: true } });
}
