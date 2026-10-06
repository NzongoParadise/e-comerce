import { prisma } from "@/lib/server/prisma";

export type CommunicationChannel = "promotions" | "newProducts" | "orderUpdates";

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

  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      dedupeKey: input.dedupeKey,
    },
  });
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
  const users = await prisma.user.findMany({
    where: {
      communicationPreference: { is: { [field]: true } },
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
  });

  return result.count;
}
