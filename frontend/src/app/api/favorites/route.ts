import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";

async function currentUser(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return null;
  return prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true },
  });
}

const schema = z.object({
  productId: z.number().int().positive(),
});

function mapFavorite(item: {
  productId: number;
  createdAt: Date;
  product: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    basePrice: unknown;
    stock: number;
    prices: Array<{ market: string; currency: string; amount: unknown }>;
    category: { name: string };
    brand: { name: string };
  };
}, rating?: { average: number; count: number }) {
  const euro = item.product.prices.find((price) => price.market === "PT" && price.currency === "EUR")?.amount;
  const category = item.product.category.name;
  const description = item.product.description || "";
  return {
    id: item.product.id,
    name: item.product.name,
    slug: item.product.slug,
    category,
    specs: description,
    priceEUR: Number(euro ?? item.product.basePrice),
    priceKZ: (() => {
      const amount = item.product.prices.find((price) => price.market === "AO" && price.currency === "AOA")?.amount;
      return amount === undefined ? undefined : Number(amount);
    })(),
    stock: item.product.stock,
    imageUrl: item.product.imageUrl || undefined,
    rating: rating?.count ? rating.average : undefined,
    reviews: rating?.count || 0,
    brand: item.product.brand.name,
    createdAt: item.createdAt,
  };
}

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: user.id },
    include: {
      product: {
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true } },
          prices: { select: { market: true, currency: true, amount: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const productIds = favorites.map((item) => item.productId);
  const ratings = productIds.length
    ? await prisma.productReview.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, status: "APPROVED" },
        _avg: { rating: true },
        _count: { rating: true },
      })
    : [];
  const ratingByProduct = new Map(ratings.map((rating) => [
    rating.productId,
    { average: Number(rating._avg.rating || 0), count: rating._count.rating },
  ]));

  return Response.json({
    data: favorites.map((item) => mapFavorite(item, ratingByProduct.get(item.productId))),
  });
}

export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Produto favorito inválido.", 400);

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, stock: true },
  });
  if (!product) return errorResponse("O produto já não existe.", 404);

  await prisma.userFavorite.upsert({
    where: { userId_productId: { userId: user.id, productId: product.id } },
    create: { userId: user.id, productId: product.id },
    update: {},
  });

  return Response.json({ data: { productId: product.id, favorite: true } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);

  const productId = Number(new URL(request.url).searchParams.get("productId"));
  if (!Number.isInteger(productId) || productId <= 0) return errorResponse("Produto favorito inválido.", 400);

  await prisma.userFavorite.deleteMany({
    where: { userId: user.id, productId },
  });

  return Response.json({ data: { productId, favorite: false } });
}
