import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { isStripeCurrencySupported, toStripeMinorUnits } from "@/lib/server/payments/stripeAmounts";

export const runtime = "nodejs";

const schema = z.object({ poId: z.number().int().positive(), idempotencyKey: z.string().min(16).max(128) });

async function stripeRequest(path: string, body: URLSearchParams, idempotencyKey: string) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body,
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "object" && data.error && "message" in data.error ? String((data.error as {message?:unknown}).message) : "STRIPE_REQUEST_FAILED");
  return data;
}

export async function POST(request: Request) {
  const subject = userSubject(await authenticate(request));
  if (!subject) return errorResponse("Authentication required", 401);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Dados de pagamento inválidos.", 400);

  const user = await prisma.user.findUnique({ where: { externalId: subject }, select: { id: true, accountType: true, stripeCustomerId: true } });
  if (!user || user.accountType !== "B2B") return errorResponse("Esta operação requer uma conta empresarial.", 403);

  const membership = await prisma.companyMember.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { companyId: true, role: true } });
  if (!membership) return errorResponse("Empresa não encontrada.", 404);

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: parsed.data.poId, companyId: membership.companyId },
    include: { company: true, order: { include: { items: true, payment: true } } },
  });
  if (!po || !po.order) return errorResponse("Purchase Order convertido em encomenda não encontrado.", 404);
  if (!["OWNER", "APPROVER"].includes(membership.role)) return errorResponse("Apenas OWNER ou APPROVER pode iniciar o pagamento.", 403);
  if (po.status !== "CONVERTED") return errorResponse("O Purchase Order ainda não está convertido em encomenda.", 409);
  if (po.order.currency !== "EUR" || !isStripeCurrencySupported(po.order.currency)) return errorResponse("O pagamento B2B via Stripe requer uma encomenda em EUR.", 422);
  if (po.order.payment?.status === "PAID") return errorResponse("A encomenda já está paga.", 409);

  const existingAttempt = await prisma.paymentAttempt.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey }, include: { payment: true } });
  if (existingAttempt) {
    return Response.json({ data: { payment: existingAttempt.payment, checkoutUrl: existingAttempt.payment.reference && existingAttempt.payment.status === "AWAITING_PAYMENT" ? existingAttempt.payment.reference : null, idempotent: true } });
  }

  const amount = Number(po.order.totalEUR);
  if (!Number.isFinite(amount) || amount <= 0) return errorResponse("Valor da encomenda inválido.", 422);

  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL;
  if (!frontendUrl) return errorResponse("FRONTEND_URL/APP_URL não configurado.", 503);
  const baseUrl = frontendUrl.replace(/\/$/, "");
  const payment = await prisma.payment.create({
    data: {
      orderId: po.order.id,
      userId: user.id,
      provider: "stripe",
      method: "STRIPE_CHECKOUT",
      status: "CREATED",
      currency: "EUR",
      amountEUR: amount,
      amountKZ: Number(po.order.totalKZ || 0),
    },
  });

  const attempt = await prisma.paymentAttempt.create({
    data: { paymentId: payment.id, idempotencyKey: parsed.data.idempotencyKey, status: "PROCESSING" },
  });

  try {
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", `${baseUrl}/b2b/encomendas?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    body.set("cancel_url", `${baseUrl}/b2b/encomendas?payment=cancelled&po=${po.id}`);
    body.set("metadata[orderId]", String(po.order.id));
    body.set("metadata[companyId]", String(po.companyId));
    body.set("metadata[poId]", String(po.id));
    body.set("metadata[userId]", String(user.id));
    body.set("payment_method_types[0]", "card");
    if (user.stripeCustomerId) body.set("customer", user.stripeCustomerId);
    po.order.items.forEach((item, index) => {
      body.set(`line_items[${index}][price_data][currency]`, "eur");
      body.set(`line_items[${index}][price_data][product_data][name]`, item.name.slice(0, 250));
      body.set(`line_items[${index}][price_data][unit_amount]`, String(toStripeMinorUnits(Number(item.unitPrice))));
      body.set(`line_items[${index}][quantity]`, String(item.quantity));
    });

    const session = await stripeRequest("checkout/sessions", body, `b2b-${parsed.data.idempotencyKey}`);
    const sessionId = typeof session.id === "string" ? session.id : "";
    const sessionUrl = typeof session.url === "string" ? session.url : "";
    if (!sessionId || !sessionUrl) throw new Error("STRIPE_SESSION_INVALID");

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "AWAITING_PAYMENT", providerPaymentId: sessionId, reference: sessionUrl },
    });
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { providerPaymentId: sessionId, status: "CREATED" } });
    await prisma.order.update({ where: { id: po.order.id }, data: { status: "AWAITING_PAYMENT", paymentMethod: "STRIPE_CHECKOUT" } });

    return Response.json({ data: { payment: updated, checkoutUrl: sessionUrl, sessionId } }, { status: 201 });
  } catch (error) {
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED" } });
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failedAt: new Date() } });
    if (error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED") return errorResponse("Stripe não está configurado no ambiente.", 503);
    return errorResponse("Não foi possível criar o checkout Stripe B2B.", 502);
  }
}