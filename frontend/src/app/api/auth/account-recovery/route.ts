import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { errorResponse, rateLimit, readJson } from "@/lib/server/api";
import { securityEvent } from "@/lib/server/security";
import { passwordResetEmailConfigured, sendPasswordResetEmail } from "@/lib/server/passwordResetEmail";

export const runtime = "nodejs";

const requestSchema = z.object({
  mode: z.literal("request"),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
});

const updateSchema = z.object({
  mode: z.literal("update"),
  token: z.string().min(32).max(256),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const body = await readJson(request) as Record<string, unknown> | undefined;

  if (body?.mode === "request") {
    const limited = rateLimit(request, "auth:recovery-request", 5, 15 * 60_000);
    if (limited) return limited;

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Introduza um endereço de e-mail válido.", 400);

    if (process.env.NODE_ENV === "production" && !passwordResetEmailConfigured()) {
      console.error("Account recovery email service is not configured");
      return errorResponse("O serviço de recuperação está temporariamente indisponível.", 503);
    }

    const genericMessage = "Se existir uma conta para esse endereço, serão enviadas instruções de recuperação.";
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, name: true, passwordHash: true },
    });

    if (!user?.passwordHash || !user.email) return Response.json({ data: { message: genericMessage } });

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60_000);

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: { tokenHash, userId: user.id, expiresAt },
      }),
    ]);

    try {
      await sendPasswordResetEmail({ email: user.email, name: user.name, token: rawToken });
    } catch (error) {
      await prisma.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null },
        data: { usedAt: new Date() },
      });
      console.error("Unable to deliver account recovery email:", error);
      return Response.json({ data: { message: genericMessage } });
    }

    return Response.json({ data: { message: genericMessage } });
  }

  if (body?.mode === "update") {
    const limited = rateLimit(request, "auth:recovery-update", 10, 15 * 60_000);
    if (limited) return limited;

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return errorResponse("O link de recuperação é inválido ou expirou.", 400);

    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

    try {
      const userId = await prisma.$transaction(async (transaction) => {
        const record = await transaction.passwordResetToken.findUnique({ where: { tokenHash } });
        if (!record || record.usedAt || record.expiresAt <= new Date()) return null;

        const claimed = await transaction.passwordResetToken.updateMany({
          where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        if (!claimed.count) return null;

        const passwordHash = await bcrypt.hash(parsed.data.password, 12);
        await transaction.user.update({
          where: { id: record.userId },
          data: { passwordHash, lastLoginAt: new Date() },
        });

        await transaction.passwordResetToken.updateMany({
          where: { userId: record.userId, usedAt: null },
          data: { usedAt: new Date() },
        });

        await transaction.securitySession.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        return record.userId;
      });

      if (!userId) return errorResponse("O link de recuperação é inválido ou expirou.", 400);
      await securityEvent(userId, "PASSWORD_RESET", request);
      return Response.json({ message: "Palavra-passe atualizada com sucesso." });
    } catch (error) {
      console.error("Account recovery update failed:", error);
      return errorResponse("Não foi possível atualizar a palavra-passe. Tente novamente mais tarde.", 503);
    }
  }

  return errorResponse("Pedido inválido.", 400);
}
