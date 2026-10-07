import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from "@/lib/server/api";
import { createNotificationIfAllowed } from "@/lib/server/notifications";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.number().int().positive(),
  amount: z.number().positive(),
  reason: z.string().trim().min(8).max(500),
});

async function admin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse("Authentication required", 401) };
  if (!isAdmin(user)) return { error: errorResponse("Administrator access required", 403) };
  return { user };
}

export async function GET(request: Request) {
  const auth = await admin(request);
  if (auth.error) return auth.error;
  const orderId = new URL(request.url).searchParams.get("orderId");
  const refunds = await prisma.refund.findMany({
    where: orderId ? { orderId: Number(orderId) } : undefined,
    include: { order: { select: { orderNumber: true } }, payment: { select: { provider: true, method: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json({ data: refunds });
}

export async function POST(request: Request) {
  const auth = await admin(request);
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Dados de reembolso inválidos", 400, parsed.error.flatten().fieldErrors);
  const actor = userSubject(auth.user);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (idempotencyKey && (idempotencyKey.length < 16 || idempotencyKey.length > 255)) return errorResponse("Idempotency-Key inválida", 400);

  const payment = await prisma.payment.findFirst({
    where: { orderId: parsed.data.orderId, status: "PAID" },
    include: { order: { select: { id: true, orderNumber: true, userId: true, totalEUR: true, totalKZ: true, currency: true } } },
  });
  if (!payment) return errorResponse("A encomenda não possui um pagamento confirmado.", 409);

  const previous = await prisma.refund.aggregate({
    where: { paymentId: payment.id, status: { in: ["REQUESTED", "PROCESSING", "SUCCEEDED"] } },
    _sum: { amountEUR: true, amountKZ: true },
  });
  const alreadyEUR = Number(previous._sum.amountEUR || 0);
  const alreadyKZ = Number(previous._sum.amountKZ || 0);
  const total = payment.currency === "EUR" ? Number(payment.amountEUR) : Number(payment.amountKZ);
  if (parsed.data.amount > total - (payment.currency === "EUR" ? alreadyEUR : alreadyKZ) + 0.000001) {
    return errorResponse("O valor do reembolso excede o saldo reembolsável.", 422);
  }

  const refund = await prisma.refund.create({
    data: {
      orderId: payment.orderId,
      paymentId: payment.id,
      userId: payment.userId,
      amountEUR: payment.currency === "EUR" ? parsed.data.amount : 0,
      amountKZ: payment.currency === "AOA" ? parsed.data.amount : 0,
      currency: payment.currency,
      reason: parsed.data.reason,
      provider: payment.provider,
      requestedBy: actor,
      status: payment.provider === "stripe" ? "PROCESSING" : "REQUESTED",
    },
  });

  if (payment.provider !== "stripe") {
    await createNotificationIfAllowed({
      userId: payment.userId,
      channel: "orderUpdates",
      type: "REFUND_REQUESTED",
      title: "Reembolso solicitado",
      message: `O reembolso da encomenda ${payment.order.orderNumber} foi registado e aguarda processamento.`,
      link: `/account/orders/${payment.orderId}`,
      dedupeKey: `refund:${refund.id}:requested`,
    }).catch(() => undefined);
    return Response.json({ data: refund }, { status: 201 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    await prisma.refund.update({ where: { id: refund.id }, data: { status: "FAILED", failureReason: "Stripe não configurado." } });
    return errorResponse("Stripe não está configurado.", 503);
  }

  try {
    if (!payment.reference) throw new Error("CHECKOUT_SESSION_MISSING");
    const sessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(payment.reference)}?expand[]=payment_intent`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const session = await sessionResponse.json() as { payment_intent?: { id?: string } | string };
    if (!sessionResponse.ok) throw new Error("STRIPE_SESSION_LOOKUP_FAILED");
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntentId) throw new Error("PAYMENT_INTENT_MISSING");

    const amountMinor = Math.round(parsed.data.amount * 100);
    const body = new URLSearchParams({ payment_intent: paymentIntentId, amount: String(amountMinor), metadata: JSON.stringify({ orderId: String(payment.orderId), refundId: String(refund.id) }) });
    const stripeIdempotencyKey = idempotencyKey || `refund-${refund.id}`;
    const stripeResponse = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": stripeIdempotencyKey },
      body,
    });
    const stripeRefund = await stripeResponse.json() as { id?: string; status?: string; failure_reason?: string; error?: { message?: string } };
    if (!stripeResponse.ok || !stripeRefund.id) throw new Error(stripeRefund.error?.message || "STRIPE_REFUND_FAILED");

    const succeeded = stripeRefund.status === "succeeded";
    const updated = await prisma.refund.update({
      where: { id: refund.id },
      data: {
        providerRefundId: stripeRefund.id,
        status: succeeded ? "SUCCEEDED" : "PROCESSING",
        processedBy: actor,
        processedAt: succeeded ? new Date() : null,
      },
    });

    if (succeeded) {
      await prisma.order.update({ where: { id: payment.orderId }, data: { status: "REFUNDED" } });
      await createNotificationIfAllowed({
        userId: payment.userId,
        channel: "orderUpdates",
        type: "REFUND_PROCESSED",
        title: "Reembolso processado",
        message: `O reembolso da encomenda ${payment.order.orderNumber} foi processado com sucesso.`,
        link: `/account/orders/${payment.orderId}`,
        dedupeKey: `refund:${refund.id}:succeeded`,
      }).catch(() => undefined);
    }
    return Response.json({ data: updated }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "STRIPE_REFUND_FAILED";
    const updated = await prisma.refund.update({ where: { id: refund.id }, data: { status: "FAILED", failureReason: reason, processedBy: actor } });
    return Response.json({ data: updated, error: "O reembolso não foi concluído." }, { status: 502 });
  }
}
