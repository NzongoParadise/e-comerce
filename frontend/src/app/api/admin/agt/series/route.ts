import { authenticate, errorResponse, isAdmin } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { requestAgtSeries, storeAgtSeries } from "@/lib/server/agt";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!isAdmin(user)) return errorResponse("Admin access required", 403);

  try {
    const result = await requestAgtSeries();
    const series = await storeAgtSeries(prisma, result);
    return Response.json({ data: { result, series } }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "AGT series request failed", 502);
  }
}
