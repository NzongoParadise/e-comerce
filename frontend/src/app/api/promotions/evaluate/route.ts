import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { evaluateOrderPromotions } from "@/lib/server/promotions/engine";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) })).min(1).max(100),
  market: z.enum(["AO", "PT"]),
  channel: z.enum(["ONLINE", "POS", "WHATSAPP"]).default("ONLINE"),
  shippingCost: z.coerce.number().nonnegative().default(0),
  couponCode: z.string().trim().max(40).optional().nullable(),
});

export async function POST(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Authentication required", 401);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid promotion evaluation request", 400);
  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true } });
  if (!user) return errorResponse("User profile not found", 401);
  const products = await prisma.product.findMany({ where: { id: { in: parsed.data.items.map((item) => item.productId) } }, include: { prices: true } });
  if (products.length !== new Set(parsed.data.items.map((item) => item.productId)).size) return errorResponse("Um ou mais produtos não existem", 400);
  const currency = parsed.data.market === "AO" ? "AOA" : "EUR";
  const items = parsed.data.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)!;
    const price = Number(product.prices.find((entry) => entry.market === parsed.data.market)?.amount ?? product.basePrice);
    return { productId: product.id, quantity: item.quantity, unitPrice: price, categoryId: product.categoryId, brandId: product.brandId };
  });
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const result = await evaluateOrderPromotions({ userId: user.id, market: parsed.data.market, currency, channel: parsed.data.channel, subtotal, items, shippingCost: parsed.data.shippingCost, couponCode: parsed.data.couponCode });
  return Response.json({ data: result });
}
