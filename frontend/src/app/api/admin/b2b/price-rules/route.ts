import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

const writeSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  companyId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  minQuantity: z.coerce.number().int().min(1).max(1000000),
  unitPrice: z.coerce.number().positive().max(1000000000),
  currency: z.enum(["AOA", "EUR"]),
  active: z.boolean().optional(),
});

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse("Authentication required", 401) };
  if (!isAdmin(user)) return { error: errorResponse("Administrator access required", 403) };
  return { error: null };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const params = new URL(request.url).searchParams;
  const companyId = params.get("companyId");
  const productId = params.get("productId");

  try {
    const rules = await prisma.b2BPriceRule.findMany({
      where: {
        ...(companyId ? { companyId: Number(companyId) } : {}),
        ...(productId ? { productId: Number(productId) } : {}),
      },
      include: {
        company: { select: { id: true, legalName: true, tradeName: true, nif: true, status: true } },
        product: { select: { id: true, name: true, slug: true, basePrice: true } },
      },
      orderBy: [{ companyId: "asc" }, { productId: "asc" }, { minQuantity: "asc" }],
      take: 500,
    });
    return Response.json({ data: rules });
  } catch (error) {
    console.error("Unable to load B2B price rules:", error);
    return errorResponse("Unable to load B2B price rules", 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = writeSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid B2B price rule", 400, parsed.error.flatten().fieldErrors);

  try {
    const { companyId, productId, minQuantity, unitPrice, currency, active = true } = parsed.data;
    const [company, product] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }),
      prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
    ]);
    if (!company) return errorResponse("Empresa não encontrada.", 404);
    if (!product) return errorResponse("Produto não encontrado.", 404);

    const data = await prisma.b2BPriceRule.upsert({
      where: { companyId_productId_minQuantity: { companyId, productId, minQuantity } },
      create: { companyId, productId, minQuantity, unitPrice, currency, active },
      update: { unitPrice, currency, active },
      include: { product: { select: { id: true, name: true } } },
    });
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Unable to save B2B price rule:", error);
    return errorResponse("Não foi possível guardar o preço empresarial.", 503);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = writeSchema.extend({ id: z.coerce.number().int().positive() }).safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid B2B price rule", 400, parsed.error.flatten().fieldErrors);

  const { id, minQuantity, unitPrice, currency, active } = parsed.data;
  try {
    const data = await prisma.b2BPriceRule.update({
      where: { id },
      data: { minQuantity, unitPrice, currency, ...(active === undefined ? {} : { active }) },
      include: { company: { select: { id: true, legalName: true } }, product: { select: { id: true, name: true } } },
    });
    return Response.json({ data });
  } catch (error) {
    console.error("Unable to update B2B price rule:", error);
    return errorResponse("Não foi possível atualizar o preço empresarial.", 503);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return errorResponse("Invalid rule id", 400);
  try {
    await prisma.b2BPriceRule.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Unable to delete B2B price rule:", error);
    return errorResponse("Não foi possível remover o preço empresarial.", 503);
  }
}
