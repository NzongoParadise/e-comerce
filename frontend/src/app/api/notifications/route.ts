import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, userSubject } from "@/lib/server/api";

export const runtime = "nodejs";

async function currentUser(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return null;
  return prisma.user.findUnique({ where: { externalId: subject }, select: { id: true } });
}

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json({
    data: notifications,
    meta: {
      unread: notifications.filter((notification) => !notification.readAt).length,
    },
  });
}

export async function PATCH(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);

  const body = await request.json().catch(() => null) as { id?: unknown; all?: unknown } | null;

  if (body?.all === true) {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return Response.json({ data: { updated: true } });
  }

  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return errorResponse("Invalid notification id", 400);

  const result = await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  if (!result.count) return errorResponse("Notification not found", 404);
  return Response.json({ data: { updated: true } });
}
