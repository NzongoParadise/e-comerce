import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const createSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["BUYER", "APPROVER"]).default("BUYER"),
});
const cancelSchema = z.object({
  invitationId: z.number().int().positive(),
  action: z.literal("CANCEL"),
});

async function context(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return null;
  const user = await prisma.user.findUnique({
    where: { externalId: subject },
    select: { id: true, email: true, name: true, accountType: true },
  });
  if (!user) return null;
  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id, status: "ACTIVE", company: { status: "ACTIVE" } },
    include: { company: { select: { id: true, legalName: true, tradeName: true, country: true } } },
  });
  if (!membership) return { user, membership: null };
  return { user, membership };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function publicInvitation(invitation: {
  id: number;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  invitedBy?: { name: string | null; email: string | null };
}) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    acceptedAt: invitation.acceptedAt,
    invitedBy: invitation.invitedBy || null,
  };
}

export async function GET(request: Request) {
  const ctx = await context(request);
  if (!ctx) return errorResponse("Não autenticado.", 401);
  if (!ctx.membership) return errorResponse("A empresa não está ativa ou não existe.", 403);

  await prisma.b2BInvitation.updateMany({
    where: { companyId: ctx.membership.companyId, status: "PENDING", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });

  const invitations = await prisma.b2BInvitation.findMany({
    where: { companyId: ctx.membership.companyId },
    include: { invitedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json({
    data: invitations.map(publicInvitation),
    currentRole: ctx.membership.role,
  });
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if (!ctx) return errorResponse("Não autenticado.", 401);
  if (!ctx.membership) return errorResponse("A empresa não está ativa ou não existe.", 403);
  if (ctx.membership.role !== "OWNER") return errorResponse("Apenas o proprietário pode convidar membros.", 403);

  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("E-mail ou função do convite inválidos.", 400, parsed.error.flatten().fieldErrors);

  const email = parsed.data.email.toLowerCase();
  if (ctx.user.email?.toLowerCase() === email) return errorResponse("Não pode convidar o próprio e-mail.", 409);

  const activeMember = await prisma.companyMember.findFirst({
    where: {
      companyId: ctx.membership.companyId,
      status: "ACTIVE",
      user: { email: { equals: email, mode: "insensitive" } },
    },
    select: { id: true },
  });
  if (activeMember) return errorResponse("Este e-mail já pertence a um membro ativo da empresa.", 409);

  const resendKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  const baseUrl = process.env.APP_URL || process.env.FRONTEND_URL;
  if (!resendKey || !emailFrom || !baseUrl) {
    return errorResponse("O envio de convites requer RESEND_API_KEY, EMAIL_FROM e APP_URL/FRONTEND_URL configurados.", 503);
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const companyName = ctx.membership.company.tradeName || ctx.membership.company.legalName;
  const roleLabel = parsed.data.role === "APPROVER" ? "Aprovador" : "Comprador";
  const invitationUrl = new URL("/convite-empresa", baseUrl);
  invitationUrl.searchParams.set("token", token);

  let invitation;
  try {
    invitation = await prisma.$transaction(async (tx) => {
      const existing = await tx.b2BInvitation.findFirst({
        where: {
          companyId: ctx.membership!.companyId,
          email,
          status: { in: ["PENDING", "DELIVERY_FAILED", "EXPIRED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        return tx.b2BInvitation.update({
          where: { id: existing.id },
          data: {
            role: parsed.data.role,
            status: "PENDING",
            tokenHash,
            invitedByUserId: ctx.user.id,
            acceptedByUserId: null,
            acceptedAt: null,
            expiresAt,
          },
        });
      }

      return tx.b2BInvitation.create({
        data: {
          companyId: ctx.membership!.companyId,
          email,
          role: parsed.data.role,
          tokenHash,
          invitedByUserId: ctx.user.id,
          expiresAt,
        },
      });
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });
  } catch (error) {
    logger.error("Unable to persist B2B invitation", {
      companyId: ctx.membership.companyId,
      error: error instanceof Error ? error.message : error,
    });
    return errorResponse("Não foi possível criar o convite. Atualize a página e tente novamente.", 503);
  }

  const html =
    '<div style="font-family:Arial,sans-serif;color:#132238;max-width:600px;margin:0 auto;padding:24px">' +
    '<p style="font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#1d6ac4">RUBRICA DILIGENTE · B2B</p>' +
    '<h1 style="font-size:24px">Convite para a equipa empresarial</h1>' +
    '<p>Foi convidado para integrar <strong>' + escapeHtml(companyName) + '</strong> como <strong>' + roleLabel + '</strong>.</p>' +
    '<p>Para aceitar, inicie sessão ou crie uma conta com este e-mail. O convite expira em sete dias e só pode ser usado pelo destinatário.</p>' +
    '<p style="margin:28px 0"><a href="' + escapeHtml(invitationUrl.toString()) + '" style="display:inline-block;background:#132238;color:#fff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:bold">Rever e aceitar convite</a></p>' +
    '<p style="font-size:12px;color:#64748b">Se não esperava este convite, ignore esta mensagem.</p></div>';

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + resendKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject: "Convite empresarial · " + companyName,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error("Resend rejected the invitation email: " + response.status + " " + details.slice(0, 300));
    }
  } catch (error) {
    await prisma.b2BInvitation.updateMany({
      where: { id: invitation.id, status: "PENDING" },
      data: { status: "DELIVERY_FAILED" },
    }).catch(() => undefined);
    logger.error("B2B invitation email delivery failed", {
      invitationId: invitation.id,
      companyId: ctx.membership.companyId,
      error: error instanceof Error ? error.message : error,
    });
    return errorResponse("O convite foi registado, mas o e-mail não foi entregue. Confirme o Resend e reenvie o convite.", 502);
  }

  return Response.json({
    data: publicInvitation({
      ...invitation,
      invitedBy: { name: ctx.user.name, email: ctx.user.email },
    }),
    message: "Convite enviado. O token de aceitação não é devolvido pela API.",
  }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ctx = await context(request);
  if (!ctx) return errorResponse("Não autenticado.", 401);
  if (!ctx.membership) return errorResponse("A empresa não está ativa ou não existe.", 403);
  if (ctx.membership.role !== "OWNER") return errorResponse("Apenas o proprietário pode cancelar convites.", 403);

  const parsed = cancelSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Pedido de cancelamento inválido.", 400);

  const cancelled = await prisma.b2BInvitation.updateMany({
    where: {
      id: parsed.data.invitationId,
      companyId: ctx.membership.companyId,
      status: { in: ["PENDING", "DELIVERY_FAILED"] },
    },
    data: { status: "CANCELLED", tokenHash: crypto.randomBytes(32).toString("hex") },
  });

  if (!cancelled.count) return errorResponse("Convite pendente não encontrado.", 404);
  return Response.json({ data: { cancelled: true } });
}
