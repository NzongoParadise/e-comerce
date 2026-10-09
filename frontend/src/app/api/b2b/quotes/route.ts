import { z } from "zod";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive().max(100000),
      })
    )
    .min(1),
  notes: z.string().trim().max(2000).optional(),
});

async function getContext(request: Request) {
  const auth = await authenticate(request);
  const subject = userSubject(auth);
  if (!subject) return null;

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, accountType: true },
  });
  if (!user || user.accountType !== "B2B") return null;

  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE", company: { status: "ACTIVE" } },
    select: {
      companyId: true,
      role: true,
      company: {
        select: {
          id: true,
          legalName: true,
          nif: true,
          phone: true,
          email: true,
          address: true,
          country: true,
        },
      },
    },
  });

  return { user, membership };
}

function companyMarket(country: string): "AO" | "PT" {
  return /^(pt|portugal)$/i.test(country.trim()) ? "PT" : "AO";
}

export async function GET(request: Request) {
  const context = await getContext(request);
  if (!context?.membership) return errorResponse("Conta empresarial não configurada.", 403);

  const quotes = await prisma.quote.findMany({
    where: { companyId: context.membership.companyId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ data: quotes });
}

export async function POST(request: Request) {
  const context = await getContext(request);
  if (!context?.membership?.company) return errorResponse("Conta empresarial não configurada.", 403);
  if (!["OWNER", "BUYER"].includes(context.membership.role)) {
    return errorResponse("Sem permissão para criar cotações.", 403);
  }

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Itens da cotação inválidos.", 400);

  const aggregatedItems = Array.from(parsed.data.items.reduce((map, item) => map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity), new Map<number, number>()).entries()).map(([productId, quantity]) => ({ productId, quantity }));
  const productIds = aggregatedItems.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { prices: true },
  });
  if (products.length !== productIds.length) return errorResponse("Um ou mais produtos não existem.", 400);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const market = companyMarket(context.membership.company.country);
  const currency = market === "PT" ? "EUR" : "AOA";

  const rules = await prisma.b2BPriceRule.findMany({
    where: {
      companyId: context.membership.companyId,
      productId: { in: productIds },
      active: true,
      currency,
    },
    orderBy: { minQuantity: "asc" },
  });

  const ruleMap = new Map<number, typeof rules>();
  for (const rule of rules) {
    const current = ruleMap.get(rule.productId) ?? [];
    current.push(rule);
    ruleMap.set(rule.productId, current);
  }

  const calculatedItems = [];
  for (const requested of aggregatedItems) {
    const product = productMap.get(requested.productId);
    if (!product) return errorResponse("Um ou mais produtos não existem.", 400);
    if (requested.quantity > product.stock) {
      return errorResponse(`Stock insuficiente para ${product.name}. Disponível: ${product.stock}.`, 409);
    }

    const matchingRule = (ruleMap.get(product.id) ?? [])
      .filter((rule) => rule.minQuantity <= requested.quantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];

    const marketPrice = product.prices.find((price) => price.market === market && price.currency === currency)?.amount;
    if (!matchingRule && !marketPrice) {
      return errorResponse(`Preço empresarial não configurado para ${product.name} no mercado ${market}.`, 422);
    }
    const unitPrice = matchingRule?.unitPrice ?? marketPrice!;

    calculatedItems.push({
      productId: product.id,
      name: product.name,
      unitPrice,
      quantity: requested.quantity,
      subtotal: unitPrice.mul(requested.quantity),
    });
  }

  const number = `COT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: number,
      userId: context.user.id,
      companyId: context.membership.company.id,
      status: "SUBMITTED",
      companyName: context.membership.company.legalName,
      companyNif: context.membership.company.nif,
      phone: context.membership.company.phone || "",
      email: context.membership.company.email || "",
      address: context.membership.company.address,
      notes: parsed.data.notes || undefined,
      items: { create: calculatedItems },
    },
    include: { items: true },
  });

  return Response.json({ data: quote, market, currency }, { status: 201 });
}
