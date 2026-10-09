import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, readJson, userSubject } from "@/lib/server/api";
import { createNotificationIfAllowed } from "@/lib/server/notifications";
import { logger } from "@/lib/server/logger";
import { issueInvoiceForPaidOrder } from "@/lib/server/finance/issueInvoiceForPaidOrder";
import { issueCreditNoteForSucceededRefund } from "@/lib/server/finance/issueCreditNoteForSucceededRefund";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.number().int().positive(),
  amount: z.number().positive().max(1_000_000_000_000),
  reason: z.string().trim().min(8).max(500),
  returnRequestId: z.number().int().positive().optional(),
});

const manualReconciliationSchema = z.object({
  refundId: z.number().int().positive(),
  action: z.enum(["CONFIRM_SUCCEEDED", "MARK_FAILED"]),
  providerReference: z.string().trim().min(4).max(160).optional(),
  note: z.string().trim().min(5).max(500),
}).superRefine((value, context) => {
  if (value.action === "CONFIRM_SUCCEEDED" && !value.providerReference) {
    context.addIssue({ code: "custom", path: ["providerReference"], message: "Indique a referência real do reembolso externo." });
  }
});

async function admin(request: Request) {
  const user = await authenticate(request);
  if (!user) return { error: errorResponse("Authentication required", 401), user: null };
  if (!isAdmin(user)) return { error: errorResponse("Administrator access required", 403), user: null };
  return { error: null, user };
}

function sameRequest(refund: { orderId: number; amountEUR: unknown; amountKZ: unknown; reason: string; returnRequestId: number | null }, orderId: number, amount: number, reason: string, returnRequestId: number | null) {
  return refund.orderId === orderId &&
    Math.abs(Number(refund.amountEUR) + Number(refund.amountKZ) - amount) < 0.000001 &&
    refund.reason === reason &&
    refund.returnRequestId === returnRequestId;
}

async function notifyRefund(input: {
  userId: number;
  orderId: number;
  orderNumber: string;
  refundId: number;
  status: string;
}) {
  await createNotificationIfAllowed({
    userId: input.userId,
    channel: "orderUpdates",
    type: input.status === "SUCCEEDED" ? "REFUND_PROCESSED" : "REFUND_REQUESTED",
    title: input.status === "SUCCEEDED" ? "Reembolso processado" : "Reembolso registado",
    message: input.status === "SUCCEEDED"
      ? "O reembolso da encomenda " + input.orderNumber + " foi confirmado."
      : "O reembolso da encomenda " + input.orderNumber + " foi registado e aguarda confirmação.",
    link: "/account/orders/" + input.orderId,
    dedupeKey: "refund:" + input.refundId + ":status:" + input.status,
  }).catch(() => undefined);
}

export async function GET(request: Request) {
  const auth = await admin(request);
  if (auth.error) return auth.error;

  const orderValue = new URL(request.url).searchParams.get("orderId");
  if (orderValue && (!Number.isInteger(Number(orderValue)) || Number(orderValue) <= 0)) {
    return errorResponse("orderId inválido.", 400);
  }

  const refunds = await prisma.refund.findMany({
    where: orderValue ? { orderId: Number(orderValue) } : undefined,
    include: {
      order: { select: { orderNumber: true, status: true } },
      payment: { select: { provider: true, method: true, currency: true, status: true } },
      returnRequest: { select: { id: true, requestNumber: true, status: true } },
      creditNote: { select: { id: true, creditNoteNumber: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json({ data: refunds });
}

export async function POST(request: Request) {
  const auth = await admin(request);
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Dados de reembolso inválidos.", 400, parsed.error.flatten().fieldErrors);

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 255) {
    return errorResponse("Envie um cabeçalho Idempotency-Key com 16 a 255 caracteres.", 400);
  }

  const amount = Math.round(parsed.data.amount * 100) / 100;
  const reason = parsed.data.reason.trim();
  let refund = await prisma.refund.findUnique({
    where: { idempotencyKey },
    include: {
      order: { select: { id: true, orderNumber: true, userId: true, status: true } },
      payment: { select: { id: true, provider: true, reference: true, currency: true, amountEUR: true, amountKZ: true, status: true, userId: true } },
    },
  });

  if (refund) {
    if (!sameRequest(refund, parsed.data.orderId, amount, reason, parsed.data.returnRequestId ?? null)) {
      return errorResponse("A Idempotency-Key já foi utilizada para outro pedido de reembolso.", 409);
    }
    if (refund.status !== "PROCESSING" || refund.provider !== "stripe") {
      return Response.json({ data: refund, idempotent: true });
    }
  } else {
    try {
      refund = await prisma.$transaction(async (tx) => {
        const existing = await tx.refund.findUnique({
          where: { idempotencyKey },
          include: {
            order: { select: { id: true, orderNumber: true, userId: true, status: true } },
            payment: { select: { id: true, provider: true, reference: true, currency: true, amountEUR: true, amountKZ: true, status: true, userId: true } },
          },
        });
        if (existing) {
          if (!sameRequest(existing, parsed.data.orderId, amount, reason, parsed.data.returnRequestId ?? null)) throw new Error("IDEMPOTENCY_CONFLICT");
          return existing;
        }

        const payment = await tx.payment.findFirst({
          where: { orderId: parsed.data.orderId, status: "PAID" },
          include: {
            order: { select: { id: true, orderNumber: true, userId: true, status: true, totalEUR: true, totalKZ: true, currency: true } },
          },
        });
        if (!payment) throw new Error("PAID_PAYMENT_REQUIRED");

        if (parsed.data.returnRequestId) {
          const returnRequest = await tx.returnRequest.findUnique({
            where: { id: parsed.data.returnRequestId },
            select: { id: true, orderId: true, userId: true, type: true, status: true },
          });
          if (!returnRequest) throw new Error("RETURN_REQUEST_NOT_FOUND");
          if (
            returnRequest.orderId !== payment.orderId ||
            returnRequest.userId !== payment.userId ||
            returnRequest.type !== "RETURN" ||
            !["ITEM_RECEIVED", "REFUND_PROCESSING"].includes(returnRequest.status)
          ) throw new Error("RETURN_REQUEST_MISMATCH");
        }

        const previous = await tx.refund.aggregate({
          where: {
            paymentId: payment.id,
            status: { in: ["REQUESTED", "PROCESSING", "SUCCEEDED"] },
          },
          _sum: { amountEUR: true, amountKZ: true },
        });
        const already = payment.currency === "EUR"
          ? Number(previous._sum.amountEUR || 0)
          : Number(previous._sum.amountKZ || 0);
        const original = payment.currency === "EUR" ? Number(payment.amountEUR) : Number(payment.amountKZ);
        if (amount > original - already + 0.000001) throw new Error("REFUND_AMOUNT_EXCEEDED");

        return tx.refund.create({
          data: {
            orderId: payment.orderId,
            paymentId: payment.id,
            userId: payment.userId,
            amountEUR: payment.currency === "EUR" ? amount : 0,
            amountKZ: payment.currency === "AOA" ? amount : 0,
            currency: payment.currency,
            reason,
            returnRequestId: parsed.data.returnRequestId ?? null,
            provider: payment.provider,
            requestedBy: userSubject(auth.user) || "admin",
            status: payment.provider === "stripe" ? "PROCESSING" : "REQUESTED",
            idempotencyKey,
          },
          include: {
            order: { select: { id: true, orderNumber: true, userId: true, status: true } },
            payment: { select: { id: true, provider: true, reference: true, currency: true, amountEUR: true, amountKZ: true, status: true, userId: true } },
          },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "IDEMPOTENCY_CONFLICT") return errorResponse("A Idempotency-Key já foi utilizada para outro pedido de reembolso.", 409);
      if (code === "PAID_PAYMENT_REQUIRED") return errorResponse("A encomenda não possui um pagamento confirmado.", 409);
      if (code === "REFUND_AMOUNT_EXCEEDED") return errorResponse("O valor ultrapassa o saldo disponível para reembolso.", 422);
      if (code === "RETURN_REQUEST_NOT_FOUND") return errorResponse("Solicitação de devolução não encontrada.", 404);
      if (code === "RETURN_REQUEST_MISMATCH") return errorResponse("A devolução não pertence à encomenda paga, já não está na etapa elegível ou não é uma devolução.", 409);
      if ((error as { code?: string })?.code === "P2034") return errorResponse("Outro reembolso foi registado em simultâneo. Atualize os dados e tente novamente.", 409);
      if ((error as { code?: string })?.code === "P2002") {
        const duplicate = await prisma.refund.findUnique({
          where: { idempotencyKey },
          include: {
            order: { select: { id: true, orderNumber: true, userId: true, status: true } },
            payment: { select: { id: true, provider: true, reference: true, currency: true, amountEUR: true, amountKZ: true, status: true, userId: true } },
          },
        });
        if (duplicate && sameRequest(duplicate, parsed.data.orderId, amount, reason, parsed.data.returnRequestId ?? null)) return Response.json({ data: duplicate, idempotent: true });
      }
      logger.error("Unable to create refund record", { orderId: parsed.data.orderId, error: error instanceof Error ? error.message : error });
      return errorResponse("Não foi possível registar o reembolso.", 503);
    }
  }

  if (refund.provider !== "stripe") {
    await notifyRefund({
      userId: refund.userId,
      orderId: refund.orderId,
      orderNumber: refund.order.orderNumber,
      refundId: refund.id,
      status: refund.status,
    });
    return Response.json({ data: refund, idempotent: false }, { status: 201 });
  }

  if (refund.currency !== "EUR") {
    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: "FAILED", failureReason: "Stripe só pode executar este reembolso quando a moeda for EUR." },
    });
    return errorResponse("O reembolso Stripe requer uma transação em EUR.", 422);
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: "FAILED", failureReason: "Stripe não configurado." },
    });
    return errorResponse("Stripe não está configurado.", 503);
  }

  let stripeRefundRequestStarted = false;
  let stripeRefundResponseStatus: number | null = null;
  let stripeRefundResponseParsed = false;

  try {
    const reference = refund.payment.reference;
    if (!reference) throw new Error("CHECKOUT_SESSION_MISSING");

    const sessionResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(reference) + "?expand[]=payment_intent",
      { headers: { Authorization: "Bearer " + secret }, cache: "no-store" },
    );
    const session = await sessionResponse.json() as {
      payment_intent?: { id?: string } | string;
      error?: { message?: string };
    };
    if (!sessionResponse.ok) throw new Error(session.error?.message || "STRIPE_SESSION_LOOKUP_FAILED");

    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
    if (!paymentIntentId) throw new Error("PAYMENT_INTENT_MISSING");

    const body = new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(Math.round(amount * 100)),
      metadata: JSON.stringify({
        orderId: String(refund.orderId),
        refundId: String(refund.id),
        idempotencyKey,
      }),
    });

    stripeRefundRequestStarted = true;
    const stripeResponse = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secret,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": "refund-" + refund.id,
      },
      body,
      cache: "no-store",
    });
    stripeRefundResponseStatus = stripeResponse.status;
    const stripeRefund = await stripeResponse.json() as {
      id?: string;
      status?: string;
      failure_reason?: string;
      error?: { message?: string };
    };
    stripeRefundResponseParsed = true;
    if (!stripeResponse.ok || !stripeRefund.id) throw new Error(stripeRefund.error?.message || "STRIPE_REFUND_FAILED");

    const succeeded = stripeRefund.status === "succeeded";
    const operation = await prisma.$transaction(async (tx) => {
      const saved = await tx.refund.update({
        where: { id: refund!.id },
        data: {
          providerRefundId: stripeRefund.id,
          status: succeeded ? "SUCCEEDED" : "PROCESSING",
          processedBy: userSubject(auth.user) || "admin",
          processedAt: succeeded ? new Date() : null,
          failureReason: null,
        },
      });

      if (succeeded) {
        const totals = await tx.refund.aggregate({
          where: { paymentId: refund!.paymentId, status: "SUCCEEDED" },
          _sum: { amountEUR: true, amountKZ: true },
        });
        const refunded = refund!.currency === "EUR"
          ? Number(totals._sum.amountEUR || 0)
          : Number(totals._sum.amountKZ || 0);
        const original = refund!.currency === "EUR"
          ? Number(refund!.payment.amountEUR)
          : Number(refund!.payment.amountKZ);
        await tx.order.update({
          where: { id: refund!.orderId },
          data: { status: refunded + 0.000001 >= original ? "REFUNDED" : "PARTIALLY_REFUNDED" },
        });
      }

      let completedReturn: { id: number; requestNumber: string; userId: number; orderNumber: string } | null = null;
      if (succeeded && refund!.returnRequestId) {
        const returnRequest = await tx.returnRequest.findUnique({
          where: { id: refund!.returnRequestId },
          include: {
            user: { select: { id: true } },
            order: { select: { orderNumber: true } },
          },
        });
        if (
          returnRequest &&
          returnRequest.type === "RETURN" &&
          returnRequest.orderId === refund!.orderId &&
          returnRequest.status === "REFUND_PROCESSING"
        ) {
          const completed = await tx.returnRequest.update({
            where: { id: returnRequest.id },
            data: { status: "COMPLETED" },
          });
          await tx.returnRequestEvent.create({
            data: {
              returnRequestId: completed.id,
              previousStatus: "REFUND_PROCESSING",
              nextStatus: "COMPLETED",
              actorExternalId: userSubject(auth.user) || "admin",
              note: "Stripe confirmou o reembolso " + stripeRefund.id + ".",
            },
          });
          completedReturn = {
            id: completed.id,
            requestNumber: completed.requestNumber,
            userId: returnRequest.user.id,
            orderNumber: returnRequest.order.orderNumber,
          };
        }
      }

      return { refund: saved, completedReturn };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });

    let creditNotePending = false;
    if (succeeded) {
      await notifyRefund({
        userId: refund.userId,
        orderId: refund.orderId,
        orderNumber: refund.order.orderNumber,
        refundId: operation.refund.id,
        status: "SUCCEEDED",
      });
      if (operation.completedReturn) {
        await createNotificationIfAllowed({
          userId: operation.completedReturn.userId,
          channel: "orderUpdates",
          type: "RETURN_STATUS_CHANGED",
          title: "Devolução concluída",
          message: "A solicitação " + operation.completedReturn.requestNumber + " da encomenda " + operation.completedReturn.orderNumber + " foi concluída após confirmação do reembolso.",
          link: "/account/returns",
          dedupeKey: "return:" + operation.completedReturn.id + ":status:COMPLETED",
        }).catch(() => undefined);
      }
      try {
        await issueCreditNoteForSucceededRefund(operation.refund.id, userSubject(auth.user) || "admin");
      } catch (creditNoteError) {
        creditNotePending = true;
        logger.error("Refund succeeded but credit note issuance is pending", {
          refundId: operation.refund.id,
          orderId: refund.orderId,
          error: creditNoteError instanceof Error ? creditNoteError.message : creditNoteError,
        });
      }
    }

    return Response.json({ data: operation.refund, idempotent: false, creditNotePending, returnCompleted: Boolean(operation.completedReturn) }, { status: 201 });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "STRIPE_REFUND_FAILED";
    // A network failure or a 5xx response after the POST may mean Stripe created the refund
    // but the response was lost. Keep that result pending so the same provider idempotency
    // key can be retried safely; never report an uncertain transfer as definitively failed.
    const outcomeUncertain = stripeRefundRequestStarted && (
      stripeRefundResponseStatus === null ||
      stripeRefundResponseStatus >= 500 ||
      (stripeRefundResponseStatus < 400 && !stripeRefundResponseParsed)
    );
    const updated = await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: outcomeUncertain ? "PROCESSING" : "FAILED",
        failureReason: outcomeUncertain
          ? "Resultado incerto no gateway. Aguarda reconciliação através da mesma chave de idempotência e confirmação do Stripe."
          : failureReason,
        processedBy: userSubject(auth.user) || "admin",
        processedAt: outcomeUncertain ? null : new Date(),
      },
    });
    logger.error(outcomeUncertain ? "Stripe refund outcome is uncertain and requires reconciliation" : "Stripe refund creation failed", {
      refundId: refund.id,
      orderId: refund.orderId,
      httpStatus: stripeRefundResponseStatus,
      error: failureReason,
    });
    return Response.json({
      data: updated,
      error: outcomeUncertain
        ? "O Stripe não confirmou o resultado. O pedido foi mantido em processamento para evitar um reembolso duplicado; aguarde o webhook ou a reconciliação."
        : "O reembolso não foi concluído. O estado foi registado para auditoria.",
    }, { status: outcomeUncertain ? 202 : 502 });
  }
}


export async function PATCH(request: Request) {
  const auth = await admin(request);
  if (auth.error) return auth.error;

  const parsed = manualReconciliationSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("Dados de reconciliação inválidos.", 400, parsed.error.flatten().fieldErrors);

  const actor = userSubject(auth.user) || "admin";
  const succeeded = parsed.data.action === "CONFIRM_SUCCEEDED";
  const providerReference = parsed.data.providerReference?.trim();

  const existing = await prisma.refund.findUnique({
    where: { id: parsed.data.refundId },
    include: {
      order: { select: { id: true, orderNumber: true, status: true, companyId: true } },
      payment: { select: { id: true, amountEUR: true, amountKZ: true, currency: true, provider: true, status: true } },
      returnRequest: {
        include: {
          user: { select: { id: true } },
          order: { select: { orderNumber: true } },
        },
      },
    },
  });
  if (!existing) return errorResponse("Reembolso não encontrado.", 404);
  if (existing.provider === "stripe") return errorResponse("Os reembolsos Stripe são atualizados pelo webhook assinado; não altere o estado manualmente.", 409);
  if (!["REQUESTED", "PROCESSING"].includes(existing.status)) {
    return errorResponse("Este reembolso já foi processado e não aceita novas transições.", 409);
  }

  if (succeeded) {
    try {
      const invoice = await issueInvoiceForPaidOrder(existing.orderId, actor);
      if (!invoice) return errorResponse("A encomenda não está num estado válido para processar o reembolso. Reveja a reconciliação.", 409);
    } catch (error) {
      logger.error("Unable to ensure invoice before confirming manual refund", {
        refundId: existing.id,
        orderId: existing.orderId,
        error: error instanceof Error ? error.message : error,
      });
      return errorResponse("Não foi possível confirmar a fatura original antes do reembolso.", 503);
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const saved = await tx.refund.update({
        where: { id: existing.id },
        data: {
          status: succeeded ? "SUCCEEDED" : "FAILED",
          providerRefundId: succeeded ? providerReference! : null,
          processedBy: actor,
          processedAt: new Date(),
          failureReason: succeeded ? null : parsed.data.note.trim(),
        },
      });

      if (succeeded) {
        const totals = await tx.refund.aggregate({
          where: { paymentId: existing.paymentId, status: "SUCCEEDED" },
          _sum: { amountEUR: true, amountKZ: true },
        });
        const refundedTotal = existing.payment.currency === "EUR"
          ? Number(totals._sum.amountEUR || 0)
          : Number(totals._sum.amountKZ || 0);
        const originalTotal = existing.payment.currency === "EUR"
          ? Number(existing.payment.amountEUR)
          : Number(existing.payment.amountKZ);
        await tx.order.update({
          where: { id: existing.orderId },
          data: { status: refundedTotal + 0.000001 >= originalTotal ? "REFUNDED" : "PARTIALLY_REFUNDED" },
        });
      }

      let completedReturn: { id: number; requestNumber: string; userId: number; orderNumber: string } | null = null;
      if (succeeded && existing.returnRequestId) {
        const returnRequest = await tx.returnRequest.findUnique({
          where: { id: existing.returnRequestId },
          include: {
            user: { select: { id: true } },
            order: { select: { orderNumber: true } },
          },
        });
        if (returnRequest && returnRequest.type === "RETURN" && returnRequest.orderId === existing.orderId && returnRequest.status === "REFUND_PROCESSING") {
          const completed = await tx.returnRequest.update({
            where: { id: returnRequest.id },
            data: { status: "COMPLETED" },
          });
          await tx.returnRequestEvent.create({
            data: {
              returnRequestId: completed.id,
              previousStatus: "REFUND_PROCESSING",
              nextStatus: "COMPLETED",
              actorExternalId: actor,
              note: "Reembolso externo confirmado. Referência: " + providerReference + ". " + parsed.data.note.trim(),
            },
          });
          completedReturn = {
            id: completed.id,
            requestNumber: completed.requestNumber,
            userId: returnRequest.user.id,
            orderNumber: returnRequest.order.orderNumber,
          };
        }
      }

      return { refund: saved, completedReturn };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });

    let creditNotePending = false;
    if (succeeded) {
      try {
        await issueCreditNoteForSucceededRefund(result.refund.id, actor);
      } catch (error) {
        creditNotePending = true;
        logger.error("Manual refund succeeded but credit note issuance is pending", {
          refundId: result.refund.id,
          orderId: existing.orderId,
          error: error instanceof Error ? error.message : error,
        });
      }
      await notifyRefund({
        userId: existing.userId,
        orderId: existing.orderId,
        orderNumber: existing.order.orderNumber,
        refundId: result.refund.id,
        status: "SUCCEEDED",
      });
    } else {
      await createNotificationIfAllowed({
        userId: existing.userId,
        channel: "orderUpdates",
        type: "REFUND_FAILED",
        title: "Reembolso não concluído",
        message: "O reembolso da encomenda " + existing.order.orderNumber + " foi marcado como falhado. Motivo: " + parsed.data.note.trim(),
        link: existing.order.companyId ? "/b2b/financeiro" : "/account/invoices",
        dedupeKey: "refund:" + result.refund.id + ":status:FAILED",
      }).catch(() => undefined);
    }

    if (result.completedReturn) {
      await createNotificationIfAllowed({
        userId: result.completedReturn.userId,
        channel: "orderUpdates",
        type: "RETURN_STATUS_CHANGED",
        title: "Devolução concluída",
        message: "A solicitação " + result.completedReturn.requestNumber + " da encomenda " + result.completedReturn.orderNumber + " foi concluída após confirmação do reembolso.",
        link: "/account/returns",
        dedupeKey: "return:" + result.completedReturn.id + ":status:COMPLETED",
      }).catch(() => undefined);
    }

    return Response.json({ data: result.refund, creditNotePending, returnCompleted: Boolean(result.completedReturn) });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") return errorResponse("A referência externa já está associada a outro reembolso.", 409);
    if ((error as { code?: string })?.code === "P2034") return errorResponse("O estado do reembolso mudou em paralelo. Atualize a lista antes de tentar novamente.", 409);
    logger.error("Manual refund reconciliation failed", {
      refundId: existing.id,
      error: error instanceof Error ? error.message : error,
    });
    return errorResponse("Não foi possível reconciliar o reembolso.", 503);
  }
}
