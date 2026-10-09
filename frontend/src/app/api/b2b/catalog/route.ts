import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse("Authentication required", 401);
  if (user.accountType !== "B2B") return errorResponse("B2B account required", 403);

  try {
    if (!user.sub) return errorResponse("User identity unavailable", 401);
    const profile = await prisma.user.findUnique({ where: { externalId: user.sub }, select: { id: true } });
    if (!profile) return errorResponse("User profile not found", 404);
    const membership = await prisma.companyMember.findFirst({
      where: { userId: profile.id, status: "ACTIVE", company: { status: "ACTIVE" } },
      select: { companyId: true },
    });
    if (!membership) return Response.json({ data: [], company: null, companyMarket: null, message: "A empresa ainda aguarda aprovação." });

    const company = await prisma.company.findUnique({
      where: { id: membership.companyId },
      select: { id: true, legalName: true, tradeName: true, nif: true, status: true, country: true },
    });
    const products = await prisma.product.findMany({
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
      take: 100,
    });

    const companyMarket = company && /^(pt|portugal)$/i.test(company.country.trim()) ? "PT" : "AO";
    return Response.json({
      company,
      companyMarket,
      data: products.map((product) => ({
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
