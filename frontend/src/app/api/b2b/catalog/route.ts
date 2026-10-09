import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse("Authentication required", 401);
  if (user.accountType !== "B2B") return errorResponse("B2B account required", 403);

  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || 1);
  const pageSize = Number(params.get("pageSize") || 24);
  const search = (params.get("search") || "").trim();
  const category = (params.get("category") || "").trim();
  const sort = params.get("sort") || "RELEVANCE";
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) {
    return errorResponse("Parâmetros de paginação inválidos.", 400);
  }
  if (search.length > 160 || category.length > 120 || !["RELEVANCE", "PRICE_ASC", "PRICE_DESC"].includes(sort)) {
    return errorResponse("Filtros do catálogo empresarial inválidos.", 400);
  }

  try {
    if (!user.sub) return errorResponse("User identity unavailable", 401);
    const profile = await prisma.user.findUnique({ where: { externalId: user.sub }, select: { id: true } });
    if (!profile) return errorResponse("User profile not found", 404);
    const membership = await prisma.companyMember.findFirst({
      where: { userId: profile.id, status: "ACTIVE", company: { status: "ACTIVE" } },
      select: { companyId: true },
    });
    if (!membership) {
      return Response.json({
        data: [],
        meta: { total: 0, page, pageSize, pageCount: 0 },
        facets: { categories: [] },
        company: null,
        companyMarket: null,
        message: "A empresa ainda aguarda aprovação.",
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: membership.companyId },
      select: { id: true, legalName: true, tradeName: true, nif: true, status: true, country: true },
    });
    if (!company) return errorResponse("Empresa não encontrada.", 404);

    const companyMarket = /^(pt|portugal)$/i.test(company.country.trim()) ? "PT" : "AO";
    const currency = companyMarket === "PT" ? "EUR" : "AOA";
    const where: Prisma.ProductWhereInput = {};
    if (category) where.category = { slug: category };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { brand: { is: { name: { contains: search, mode: "insensitive" } } } },
        { category: { is: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [total, categories, matchingProducts] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.category.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          prices: true,
          b2bPriceRules: {
            where: { companyId: membership.companyId, active: true },
            orderBy: { minQuantity: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const marketPrice = (product: typeof matchingProducts[number]) => {
      const rules = product.b2bPriceRules
        .filter((rule) => rule.currency === currency)
        .sort((a, b) => a.unitPrice.toNumber() - b.unitPrice.toNumber());
      if (rules.length) return rules[0].unitPrice.toNumber();

      const configured = product.prices.find((price) => price.market === companyMarket && price.currency === currency)?.amount;
      if (configured !== undefined) return Number(configured);
      return companyMarket === "PT" ? Number(product.basePrice) : Number.POSITIVE_INFINITY;
    };

    const sortedProducts = [...matchingProducts].sort((a, b) => {
      if (sort === "PRICE_ASC") {
        const left = marketPrice(a);
        const right = marketPrice(b);
        return left === right ? a.name.localeCompare(b.name, "pt") : left < right ? -1 : 1;
      }
      if (sort === "PRICE_DESC") {
        const left = marketPrice(a);
        const right = marketPrice(b);
        return left === right ? a.name.localeCompare(b.name, "pt") : left > right ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "pt");
    });

    const pageProducts = sortedProducts.slice((page - 1) * pageSize, page * pageSize);
    return Response.json({
      company,
      companyMarket,
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) },
      facets: { categories },
      data: pageProducts.map((product) => ({
        ...product,
        b2bPriceRules: product.b2bPriceRules.map((rule) => ({
          id: rule.id,
          minQuantity: rule.minQuantity,
          unitPrice: Number(rule.unitPrice),
          currency: rule.currency,
        })),
      })),
    });
  } catch (error) {
    console.error("Unable to load B2B catalog:", error);
    return errorResponse("Unable to load B2B catalog", 503);
  }
}
