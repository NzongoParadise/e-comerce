import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin } from "@/lib/server/api";

export const runtime = "nodejs";

function idFromUrl(request: Request) {
  const value = Number(new URL(request.url).pathname.split("/").filter(Boolean).at(-1));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse("Authentication required", 401);
  if (!isAdmin(user)) return errorResponse("Administrator access required", 403);
  const id = idFromUrl(request);
  if (!id) return errorResponse("Invalid purchase id", 400);

  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, taxId: true, country: true, phone: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, stock: true } }, receipts: true } },
        receipts: { include: { items: true }, orderBy: { receivedAt: "desc" } },
        payments: { orderBy: { paidAt: "desc" } },
        financeEntry: { include: { events: { orderBy: { createdAt: "desc" } } } },
        events: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!purchase) return errorResponse("Purchase not found", 404);
    return Response.json({ data: purchase });
  } catch (error) {
    console.error("Unable to load purchase detail:", error);
    return errorResponse("Unable to load purchase", 503);
  }
}