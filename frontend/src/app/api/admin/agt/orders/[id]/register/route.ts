import { authenticate, errorResponse, isAdmin } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { getAgtStatus, registerAgtOrder } from "@/lib/server/agt";

export const runtime = "nodejs";

function getId(request: Request) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  return Number(parts[parts.length - 2]);
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!isAdmin(user)) return errorResponse("Admin access required", 403);
  const id = getId(request);
  if (!Number.isInteger(id)) return errorResponse("Order not found", 404);
  try {
    return Response.json({ data: await registerAgtOrder(prisma, id) }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "AGT registration failed", 502);
  }
}
