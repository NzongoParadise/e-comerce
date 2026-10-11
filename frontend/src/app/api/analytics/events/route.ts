import { z } from "zod";
import { errorResponse, rateLimit, readJson } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

const eventSchema = z.object({
  visitorId: z.string().uuid(),
  eventType: z.enum(["PAGE_VIEW", "PRODUCT_VIEW", "FAVORITE_ADD", "FAVORITE_REMOVE", "ADD_TO_CART", "CHECKOUT_START"]),
  path: z.string().regex(/^\/[\p{L}\p{N}._~/%-]*$/u).max(240).optional(),
  productId: z.number().int().positive().optional(),
}).strict();

export async function POST(request: Request) {
  const limited = rateLimit(request, "storefront-analytics", 120, 60_000);
  if (limited) return limited;

  const parsed = eventSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid analytics event", 400);

  try {
    if (parsed.data.productId !== undefined) {
      const product = await prisma.product.findUnique({
        where: { id: parsed.data.productId },
        select: { id: true },
      });
      if (!product) return errorResponse("Product not found", 404);
    }

    await prisma.storefrontEvent.create({ data: parsed.data });
    return Response.json({ data: { recorded: true } }, { status: 201 });
  } catch (error) {
    console.error("Unable to record storefront analytics event:", error);
    return errorResponse("Unable to record analytics event", 503);
  }
}
