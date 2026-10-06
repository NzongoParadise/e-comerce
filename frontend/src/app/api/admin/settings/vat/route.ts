import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse("Authentication required", 401) };
  if (!isAdmin(user)) return { error: errorResponse("Administrator access required", 403) };
  return { user };
}

const settingsSchema = z.object({
  vatEnabled: z.boolean(),
  vatRate: z.number().min(0.01).max(100).nullable(),
  vatIncluded: z.boolean(),
}).refine((settings) => !settings.vatEnabled || settings.vatRate !== null, {
  message: "A taxa de IVA é obrigatória quando o IVA está ativo.",
  path: ["vatRate"],
});

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const settings = await prisma.systemSetting.findUnique({ where: { id: "global" } });
  return Response.json({ data: settings || { id: "global", vatEnabled: false, vatRate: null, vatIncluded: true, vatConfiguredAt: null, vatConfiguredBy: null } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const parsed = settingsSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid VAT settings", 400, parsed.error.flatten().fieldErrors);

  try {
    const settings = await prisma.systemSetting.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        ...parsed.data,
        vatConfiguredAt: new Date(),
        vatConfiguredBy: userSubject(auth.user),
      },
      update: {
        ...parsed.data,
        vatConfiguredAt: new Date(),
        vatConfiguredBy: userSubject(auth.user),
      },
    });
    return Response.json({ data: settings });
  } catch (error) {
    console.error("Unable to update global VAT settings:", error);
    return errorResponse("Unable to update VAT settings", 503);
  }
}
