import { prisma } from "@/lib/server/prisma";
import { Prisma } from "@prisma/client";

export type CommunicationChannel = "promotions" | "newProducts" | "orderUpdates";

export function notificationMessagePreview(content: string) {
  const normalizedContent = content.replace(/\s+/g, " ").trim();
  return normalizedContent.length > 180
    ? `${normalizedContent.slice(0, 177)}...`
    : normalizedContent;
}

const preferenceField: Record<CommunicationChannel, "promotions" | "newProducts" | "orderUpdates"> = {
  promotions: "promotions",
  newProducts: "newProducts",
  orderUpdates: "orderUpdates",
};

export async function createNotificationIfAllowed(input: {
  userId: number;
  channel: CommunicationChannel;
  type: string;
  title: string;
  message: string;
  link?: string;
  dedupeKey?: string;
}) {
  const field = preferenceField[input.channel];
  const preference = await prisma.communicationPreference.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId },
    update: {},
    select: { promotions: true, newProducts: true, orderUpdates: true },
  });

  if (!preference[field]) return null;

  try {
    return await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        dedupeKey: input.dedupeKey,
      },
    });
  } catch (error) {
    if (input.dedupeKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}

export async function createNotificationsForChannel(input: {
  channel: CommunicationChannel;
  type: string;
  title: string;
  message: string;
  link?: string;
  dedupeKey?: string;
}) {
  const field = preferenceField[input.channel];
  const enabledByDefault = input.channel === "promotions" || input.channel === "orderUpdates";
  const users = await prisma.user.findMany({
    where: {
      accessRole: "CUSTOMER",
      status: "ACTIVE",
      OR: [
        { communicationPreference: { is: { [field]: true } } },
        ...(enabledByDefault ? [{ communicationPreference: { is: null } }] : []),
      ],
    },
    select: { id: true },
  });

  if (!users.length) return 0;

  const result = await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      dedupeKey: input.dedupeKey,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

export async function createStaffNotification(input: {
  type: string;
  title: string;
  message: string;
  link?: string;
  dedupeKey: string;
  accessRoles?: string[];
}) {
  const staff = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      accessRole: { in: input.accessRoles || ["ADMIN", "SALES", "SUPPORT", "MARKETING"] },
    },
    select: { id: true },
  });
  if (!staff.length) return 0;

  const result = await prisma.notification.createMany({
    data: staff.map(({ id }) => ({
      userId: id,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      dedupeKey: input.dedupeKey,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
