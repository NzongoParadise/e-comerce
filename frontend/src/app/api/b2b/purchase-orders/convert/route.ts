import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";

function companyMarket(country: string): "AO" | "PT" {
  return /^(pt|portugal)$/i.test(country.trim()) ? "PT" : "AO";
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  const subject = userSubject(auth);
  if (!subject) return errorResponse("Não autenticado.", 401);

  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true },
  });
  if (!user) return errorResponse("Utilizador não encontrado.", 404);

  const membership = await prisma.companyMember.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      company: { status: "ACTIVE" },
    },
    select: {
      companyId: true,
      role: true,
      company: { select: { country: true } },
    },
  });

  if (!membership) return errorResponse("A empresa ainda não está ativa.", 403);
  if (!["OWNER", "APPROVER"].includes(membership.role)) {
    return errorResponse("Apenas OWNER ou APPROVER pode aprovar compras.", 403);
  }

  const poId = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(poId) || poId <= 0) return errorResponse("Purchase Order inválido.", 400);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: poId, companyId: membership.companyId },
        include: {
          quote: {
            include: {
              items: {
                include: {
                  product: {
                    select: { id: true, name: true, slug: true, imageUrl: true, stock: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!po) throw new Error("PO_NOT_FOUND");
      if (po.status !== "APPROVED") throw new Error("PO_NOT_APPROVED");

      if (po.orderId) {
        const existing = await tx.order.findUnique({
          where: { id: po.orderId },
          include: { items: true },
        });
        return { order: existing, po };
      }

      const quote = po.quote;
      if (!quote || quote.companyId !== membership.companyId) throw new Error("QUOTE_REQUIRED");

      const market = companyMarket(membership.company.country);
      const currency = market === "PT" ? "EUR" : "AOA";
      const total = quote.items.reduce((sum, item) => sum + Number(item.subtotal), 0);

      const requestedByProduct = new Map<number, { quantity: number; stock: number; name: string }>();
      for (const item of quote.items) {
        const current = requestedByProduct.get(item.productId);
        requestedByProduct.set(item.productId, {
          quantity: (current?.quantity ?? 0) + item.quantity,
          stock: item.product.stock,
          name: item.product.name,
        });
      }
      for (const requested of requestedByProduct.values()) {
        if (requested.quantity > requested.stock) throw new Error(`STOCK:${requested.name}`);
      }

      const orderNumber = `B2B-${new Date().getFullYear()}-${String(po.id).padStart(6, "0")}-${Date.now().toString(36).toUpperCase()}`;
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: quote.userId,
          companyId: membership.companyId,
          status: "PENDING",
          inventoryReserved: false,
          inventoryReservationExpiresAt: null,
          deliveryMode: "DELIVERY",
          shippingMethod: "STANDARD",
          paymentMethod: market === "PT" ? "STRIPE" : "TRANSFER",
          country: market,
          currency,
          billingName: quote.companyName,
          billingEmail: quote.email,
          billingTaxId: quote.companyNif,
          address: quote.address,
          phone: quote.phone,
          totalEUR: market === "PT" ? total : 0,
          totalKZ: market === "AO" ? total : 0,
          items: {
            create: quote.items.map((item) => ({
              productId: item.product.id,
              name: item.name,
              slug: item.product.slug,
              imageUrl: item.product.imageUrl,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
          trackingEvents: {
            create: {
              status: "PENDING",
              location: quote.address || "Armazém",
              description: "Compra empresarial aprovada e encomenda criada.",
            },
          },
        },
        include: { items: true },
      });

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { orderId: order.id, status: "CONVERTED" },
      });

      return { order, po };
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "PO_NOT_FOUND") return errorResponse("Purchase Order não encontrado.", 404);
    if (code === "PO_NOT_APPROVED") return errorResponse("O Purchase Order ainda não está aprovado.", 409);
    if (code === "QUOTE_REQUIRED") return errorResponse("A cotação associada não é válida.", 409);
    if (code.startsWith("STOCK:")) return errorResponse(`Stock insuficiente: ${code.slice(6)}`, 409);
    if ((error as { code?: string })?.code === "P2034") return errorResponse("A operação concorreu com outra compra. Tente novamente.", 409);
    console.error("B2B purchase order conversion failed:", error);
    return errorResponse("Não foi possível converter a compra empresarial.", 503);
  }
}
