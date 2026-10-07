import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse("Authentication required", 401);
  if (user.accountType !== "B2B") return errorResponse("B2B account required", 403);

  try {
    const membership = await prisma.companyMember.findFirst({
      where: { userId: user.id, status: "ACTIVE", company: { status: "ACTIVE" } },
      select: { companyId: true },
    });
    if (!membership) return Response.json({ data: [], company: null, message: "A empresa ainda aguarda aprovação." });

    const company = await prisma.company.findUnique({
      where: { id: membership.companyId },
      select: { id: true, legalName: true, tradeName: true, nif: true, status: true },
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

    return Response.json({
      company,
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
