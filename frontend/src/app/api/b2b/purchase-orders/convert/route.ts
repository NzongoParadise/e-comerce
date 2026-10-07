import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, userSubject } from "@/lib/server/api";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authenticate(request); const subject = userSubject(auth);
  if (!subject) return errorResponse("Não autenticado.", 401);
  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true } });
  if (!user) return errorResponse("Utilizador não encontrado.", 404);
  const membership = await prisma.companyMember.findFirst({ where: { userId: user.id, status: "ACTIVE", company: { status: "ACTIVE" } } });
  if (!membership) return errorResponse("A empresa ainda não está ativa.", 403);
  if (!["OWNER", "APPROVER"].includes(membership.role)) return errorResponse("Apenas OWNER ou APPROVER pode aprovar compras.", 403);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: Number(new URL(request.url).searchParams.get("id")), companyId: membership.companyId },
        include: { quote: { include: { items: true } } },
      });
      if (!po) throw new Error("PO_NOT_FOUND");
      if (po.status !== "APPROVED") throw new Error("PO_NOT_APPROVED");

      if (po.orderId) {
        const existing = await tx.order.findUnique({ where: { id: po.orderId }, include: { items: true } });
        return { order: existing, po };
      }

      const quote = po.quote;
      if (!quote || quote.companyId !== membership.companyId) throw new Error("QUOTE_REQUIRED");

      const orderNumber = `B2B-${new Date().getFullYear()}-${String(po.id).padStart(7, "0")}`;
      const totalEUR = quote.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: quote.userId,
          companyId: membership.companyId,
          status: "PENDING",
          deliveryMode: "DELIVERY",
          shippingMethod: "STANDARD",
          paymentMethod: "STRIPE",
          country: "ANGOLA",
          currency: "EUR",
          billingName: quote.companyName,
          billingEmail: quote.email,
          billingTaxId: quote.companyNif,
          address: quote.address,
          phone: quote.phone,
          totalEUR,
          totalKZ: 0,
          items: { create: quote.items.map((item) => ({ productId: item.productId, name: item.name, slug: `b2b-${item.productId}`, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal })) },
        },
        include: { items: true },
      });
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { orderId: order.id, status: "CONVERTED" } });
      return { order, po };
    });
    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "PO_NOT_FOUND") return errorResponse("Purchase Order não encontrado.", 404);
    if (code === "PO_NOT_APPROVED") return errorResponse("O Purchase Order ainda não está aprovado.", 409);
    if (code === "QUOTE_REQUIRED") return errorResponse("A cotação associada não é válida.", 409);
    console.error("B2B purchase order conversion failed:", error);
    return errorResponse("Não foi possível converter a compra empresarial.", 503);
  }
}
