import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse("Authentication required", 401) };
  if (!isAdmin(user)) return { error: errorResponse("Administrator access required", 403) };
  return { user };
}
function idFromUrl(request: Request) {
  const value = Number(new URL(request.url).pathname.split("/").filter(Boolean).at(-1));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = idFromUrl(request);
  if (!id) return errorResponse("Invalid purchase id", 400);
  const purchase = await prisma.purchase.findUnique({ where: { id }, include: { supplier: true, items: { include: { product: true } }, financeEntry: { include: { events: { orderBy: { createdAt: "desc" } } } }, events: { orderBy: { createdAt: "desc" } } } });
  if (!purchase) return errorResponse("Purchase not found", 404);
  return Response.json({ data: purchase });
}

