import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { z } from "zod";

export const runtime = "nodejs";
const readSchema = z.union([
  z.object({ all: z.literal(true) }).strict(),
  z.object({ id: z.number().int().positive() }).strict(),
]);

async function currentUser(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return null;
  return prisma.user.findUnique({ where: { externalId: subject }, select: { id: true } });
}

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);

  try {
    const [notifications, unread] = await prisma.$transaction([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          link: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    return Response.json({ data: notifications, meta: { unread } });
  } catch (error) {
    console.error("Unable to load notifications:", error);
    return errorResponse("Unable to load notifications", 503);
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);

  const parsed = readSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Invalid notification update", 400);

  try {
    if ("all" in parsed.data) {
      await prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return Response.json({ data: { updated: true } });
    }

    const result = await prisma.notification.updateMany({
      where: { id: parsed.data.id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (!result.count) {
      const existing = await prisma.notification.count({ where: { id: parsed.data.id, userId: user.id } });
      if (!existing) return errorResponse("Notification not found", 404);
    }
    return Response.json({ data: { updated: true } });
  } catch (error) {
    console.error("Unable to update notifications:", error);
    return errorResponse("Unable to update notifications", 503);
  }
}
