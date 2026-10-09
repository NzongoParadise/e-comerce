import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { authenticate, errorResponse, isAdmin, prismaErrorCode, readJson, userSubject } from '@/lib/server/api';
import { z } from 'zod';
import { createNotificationsForChannel } from '@/lib/server/notifications';

export const runtime = 'nodejs';

const priceSchema = z.object({
  market: z.enum(['PT', 'AO']),
  currency: z.string().trim().min(1).max(8),
  amount: z.coerce.number().nonnegative(),
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(2000).nullable().optional(),
  basePrice: z.coerce.number().nonnegative(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  stock: z.coerce.number().int().nonnegative(),
  categoryId: z.coerce.number().int().positive(),
  brandId: z.coerce.number().int().positive(),
  prices: z.array(priceSchema).max(10).optional(),
  attributes: z.array(z.object({ name: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(160) })).max(40).superRefine((attributes, context) => {
    const uniqueAttributes = new Set<string>();
    attributes.forEach((attribute, index) => {
      const key = `${attribute.name.toLocaleLowerCase()}\u0000${attribute.value.toLocaleLowerCase()}`;
      if (uniqueAttributes.has(key)) context.addIssue({ code: 'custom', path: [index], message: 'Atributos duplicados não são permitidos' });
      uniqueAttributes.add(key);
    });
  }).optional(),
});

const querySchema = z.object({
  category: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(120).optional(),
  market: z.enum(['PT', 'AO']).optional(),
  stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
  inStockOnly: z.coerce.boolean().default(false),
  search: z.string().trim().max(160).optional(),
  minPrice: z.coerce.number().finite().nonnegative().optional(),
  maxPrice: z.coerce.number().finite().nonnegative().optional(),
  sort: z.enum(['relevance', 'price-low', 'price-high', 'name', 'newest']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
}).superRefine((data, context) => {
  if (data.minPrice !== undefined && data.maxPrice !== undefined && data.minPrice > data.maxPrice) {
    context.addIssue({ code: 'custom', path: ['maxPrice'], message: 'O preço máximo tem de ser superior ou igual ao mínimo.' });
  }
});


const reviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(["recent", "highest", "lowest"]).default("recent"),
});
const reviewSchema = z.object({
  orderId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(10).max(2000),
});

function pathParts(request: Request) {
  return new URL(request.url).pathname.split("/").filter(Boolean);
}

function productSegment(request: Request) {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return parts.length === 3 ? parts[2] : null;
}

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);
  return null;
}

export async function GET(request: Request) {

  const routeParts = pathParts(request);
  if (routeParts.length === 4 && routeParts[3] === "reviews") {
    const slug = routeParts[2];
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) return errorResponse("Product not found", 404);

    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = reviewQuerySchema.safeParse(params);
    if (!parsed.success) return errorResponse("Filtros de avaliação inválidos.", 400);
    const { page, pageSize, rating, sort } = parsed.data;
    const where: Prisma.ProductReviewWhereInput = {
      productId: product.id,
      status: "APPROVED",
      ...(rating ? { rating } : {}),
    };
    const orderBy: Prisma.ProductReviewOrderByWithRelationInput =
      sort === "highest" ? { rating: "desc" } :
      sort === "lowest" ? { rating: "asc" } :
      { createdAt: "desc" };

    const [reviews, total, summary] = await prisma.$transaction([
      prisma.productReview.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: [orderBy, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.productReview.count({ where }),
      prisma.productReview.aggregate({
        where: { productId: product.id, status: "APPROVED" },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const distribution = await prisma.productReview.groupBy({
      by: ["rating"],
      where: { productId: product.id, status: "APPROVED" },
      _count: { rating: true },
    });

    return Response.json({
      data: reviews,
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) },
      summary: {
        averageRating: Number(summary._avg.rating || 0),
        count: summary._count._all,
        distribution: Object.fromEntries([1, 2, 3, 4, 5].map((value) => [
          value,
          distribution.find((row) => row.rating === value)?._count.rating || 0,
        ])),
      },
    });
  }

  const segment = productSegment(request);
  if (segment !== null) {
    try {
      const product = await prisma.product.findUnique({
        where: { slug: segment },
        include: { category: true, brand: true, prices: true, attributes: true },
      });
      if (!product) return errorResponse('Product not found', 404);
      return Response.json({ data: product });
    } catch (error) {
      console.error('Error fetching product details:', error);
      return errorResponse('Internal server error', 500);
    }
  }

  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) return errorResponse('Invalid query parameters', 400, parsed.error.issues);
    const {
      category, brand, market, stockStatus, inStockOnly, search,
      minPrice, maxPrice, sort, page, pageSize,
    } = parsed.data;
    const where: Prisma.ProductWhereInput = {};
    if (category) where.category = { slug: category };
    if (brand) where.brand = { slug: brand };

    const lowStockThreshold = Number.isInteger(Number(process.env.LOW_STOCK_THRESHOLD)) && Number(process.env.LOW_STOCK_THRESHOLD) > 0
      ? Number(process.env.LOW_STOCK_THRESHOLD)
      : 5;
    if (stockStatus === 'OUT_OF_STOCK') where.stock = 0;
    if (stockStatus === 'LOW_STOCK') where.stock = { gt: 0, lte: lowStockThreshold };
    if (stockStatus === 'IN_STOCK') where.stock = { gt: lowStockThreshold };
    if (inStockOnly) where.stock = { gt: 0 };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { category: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const selectedAttributes = new Map<string, Set<string>>();
    for (const raw of new URL(request.url).searchParams.getAll('attribute')) {
      try {
        const parsedAttribute = z.tuple([z.string().trim().min(1).max(80), z.string().trim().min(1).max(160)]).safeParse(JSON.parse(raw));
        if (!parsedAttribute.success) continue;
        const [name, value] = parsedAttribute.data;
        const values = selectedAttributes.get(name) || new Set<string>();
        values.add(value);
        selectedAttributes.set(name, values);
      } catch {
        continue;
      }
    }
    if (selectedAttributes.size) {
      where.AND = [
        ...Array.from(selectedAttributes.entries()).map(([name, values]) => ({
          attributes: { some: { name, value: { in: Array.from(values) } } },
        })),
      ];
    }

    const activeMarket = market || 'PT';
    const currency = activeMarket === 'PT' ? 'EUR' : 'AOA';
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.prices = {
        some: {
          market: activeMarket,
          currency,
          amount: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        },
      };
    }

    const productCount = await prisma.product.count({ where });
    const matchingForSort = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        createdAt: true,
        basePrice: true,
        prices: {
          where: { market: activeMarket, currency },
          select: { amount: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const sortPrice = (product: typeof matchingForSort[number]) => {
      const configuredPrice = product.prices[0]?.amount;
      if (activeMarket === 'AO' && configuredPrice === undefined) return Number.POSITIVE_INFINITY;
      return Number(configuredPrice ?? product.basePrice);
    };
    matchingForSort.sort((a, b) => {
      if (sort === 'price-low') return sortPrice(a) - sortPrice(b) || a.name.localeCompare(b.name, 'pt');
      if (sort === 'price-high') return sortPrice(b) - sortPrice(a) || a.name.localeCompare(b.name, 'pt');
      if (sort === 'newest') return b.createdAt.getTime() - a.createdAt.getTime();
      if (sort === 'name') return a.name.localeCompare(b.name, 'pt');
      return a.name.localeCompare(b.name, 'pt');
    });
    const pageProducts = matchingForSort.slice((page - 1) * pageSize, page * pageSize);
    const pageIds = pageProducts.map((product) => product.id);

    const [products, inStock, lowStock, outOfStock, categories, brands, attributeFacets] = await prisma.$transaction([
      prisma.product.findMany({
        where: { id: { in: pageIds } },
        include: {
          category: true,
          brand: true,
          prices: market ? { where: { market, currency } } : true,
          attributes: true,
        },
      }),
      prisma.product.count({ where: { stock: { gt: lowStockThreshold } } }),
      prisma.product.count({ where: { stock: { gt: 0, lte: lowStockThreshold } } }),
      prisma.product.count({ where: { stock: 0 } }),
      prisma.category.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }),
      prisma.brand.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }),
      prisma.productAttribute.findMany({
        distinct: ['name', 'value'],
        select: { name: true, value: true },
        orderBy: [{ name: 'asc' }, { value: 'asc' }],
      }),
    ]);

    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderedProducts = pageIds.map((id) => productMap.get(id)).filter((product): product is NonNullable<typeof product> => Boolean(product));
    const reviewGroups = orderedProducts.length
      ? await prisma.productReview.groupBy({
          by: ['productId'],
          where: { productId: { in: orderedProducts.map((product) => product.id) }, status: 'APPROVED' },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : [];
    const reviewMap = new Map(reviewGroups.map((row) => [row.productId, row]));
    const data = orderedProducts.map((product) => {
      const review = reviewMap.get(product.id);
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        basePrice: product.basePrice,
        imageUrl: product.imageUrl,
        stock: product.stock,
        category: { id: product.category.id, name: product.category.name, slug: product.category.slug },
        brand: { id: product.brand.id, name: product.brand.name, slug: product.brand.slug },
        prices: product.prices.map((price) => ({ market: price.market, currency: price.currency, amount: price.amount })),
        attributes: product.attributes,
        rating: Number(review?._avg.rating || 0),
        reviews: review?._count._all || 0,
      };
    });
    const groupedAttributes = attributeFacets.reduce<Record<string, string[]>>((result, attribute) => {
      (result[attribute.name] ||= []).push(attribute.value);
      return result;
    }, {});

    return Response.json({
      data,
      meta: {
        total: productCount,
        page,
        pageSize,
        pageCount: Math.ceil(productCount / pageSize),
        lowStockThreshold,
      },
      stats: {
        total: await prisma.product.count(),
        inStock,
        lowStock,
        outOfStock,
      },
      facets: { categories, brands, attributes: groupedAttributes },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function POST(request: Request) {

  const routeParts = pathParts(request);
  if (routeParts.length === 4 && routeParts[3] === "reviews") {
    const auth = await authenticate(request);
    const subject = userSubject(auth);
    if (!subject) return errorResponse("Inicie sessão para avaliar uma compra.", 401);

    const parsed = reviewSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorResponse("Dados da avaliação inválidos.", 400, parsed.error.flatten().fieldErrors);

    const user = await prisma.user.findUnique({
      where: { externalId: subject },
      select: { id: true },
    });
    if (!user) return errorResponse("Perfil de utilizador não encontrado.", 401);

    const product = await prisma.product.findUnique({
      where: { slug: routeParts[2] },
      select: { id: true, name: true },
    });
    if (!product) return errorResponse("Produto não encontrado.", 404);

    const eligibleOrder = await prisma.order.findFirst({
      where: {
        id: parsed.data.orderId,
        userId: user.id,
        payment: { is: { status: "PAID" } },
        items: { some: { productId: product.id } },
      },
      select: { id: true },
    });
    if (!eligibleOrder) {
      return errorResponse("Só pode avaliar um produto comprado numa encomenda sua com pagamento confirmado.", 403);
    }

    try {
      const review = await prisma.productReview.create({
        data: {
          productId: product.id,
          userId: user.id,
          orderId: eligibleOrder.id,
          rating: parsed.data.rating,
          title: parsed.data.title || null,
          comment: parsed.data.comment,
          status: "PENDING",
          verifiedPurchase: true,
        },
      });
      return Response.json({
        data: review,
        message: "Avaliação enviada para moderação. Só aparecerá publicamente depois de aprovada.",
      }, { status: 201 });
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        return errorResponse("Já enviou uma avaliação para este produto.", 409);
      }
      console.error("Unable to create product review:", error);
      return errorResponse("Não foi possível registar a avaliação.", 503);
    }
  }

  const authError = await requireAdmin(request);
  if (authError) return authError;
  const parsed = productSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid product data', 400, parsed.error.flatten().fieldErrors);
  const { prices, attributes, ...productData } = parsed.data;
  try {
    const product = await prisma.product.create({
      data: { ...productData, prices: prices ? { create: prices } : undefined, attributes: attributes ? { create: attributes } : undefined },
      include: { category: true, brand: true, prices: true, attributes: true },
    });

    await createNotificationsForChannel({
      channel: "newProducts",
      type: "NEW_PRODUCT",
      title: "Novo produto disponível",
      message: `${product.name} já está disponível na nossa loja.`,
      link: `/produto/${product.slug}`,
    }).catch((notificationError) => {
      console.error("Failed to create new-product notifications:", notificationError);
    });

    return Response.json({ data: product }, { status: 201 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Product slug already exists', 409);
    if (prismaErrorCode(error) === 'P2003') return errorResponse('Category or brand not found', 400);
    console.error('Error creating product:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const segment = productSegment(request);
  const id = Number(segment);
  if (!segment || !Number.isInteger(id)) return errorResponse('Invalid product id', 400);
  const parsed = productSchema.partial().safeParse(await readJson(request));
  if (!parsed.success || !Object.keys(parsed.data).length) return errorResponse('Invalid product data', 400);
  const { prices, attributes, ...productData } = parsed.data;

  try {
    const product = await prisma.$transaction(async (transaction) => {
      await transaction.product.update({ where: { id }, data: productData });
      if (prices) {
        await transaction.price.deleteMany({ where: { productId: id } });
        await transaction.price.createMany({ data: prices.map((price) => ({ ...price, productId: id })) });
      }
      if (attributes) {
        await transaction.productAttribute.deleteMany({ where: { productId: id } });
        await transaction.productAttribute.createMany({ data: attributes.map((attribute) => ({ ...attribute, productId: id })) });
      }
      return transaction.product.findUnique({ where: { id }, include: { category: true, brand: true, prices: true, attributes: true } });
    });
    return Response.json({ data: product });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Product not found', 404);
    if (prismaErrorCode(error) === 'P2002') return errorResponse('Product slug already exists', 409);
    if (prismaErrorCode(error) === 'P2003') return errorResponse('Category or brand not found', 400);
    console.error('Error updating product:', error);
    return errorResponse('Internal server error', 500);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const segment = productSegment(request);
  const id = Number(segment);
  if (!segment || !Number.isInteger(id)) return errorResponse('Invalid product id', 400);
  try {
    await prisma.product.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return errorResponse('Product not found', 404);
    if (prismaErrorCode(error) === 'P2003') return errorResponse('Cannot delete a product referenced by an order or quote', 409);
    console.error('Error deleting product:', error);
    return errorResponse('Internal server error', 500);
  }
}