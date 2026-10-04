ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "stripeChargeId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "grossAmount" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "stripeFee" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "netAmount" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "failureCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "failureMessage" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_stripeChargeId_key" ON "Payment"("stripeChargeId");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "PaymentEvent_eventType_createdAt_idx" ON "PaymentEvent"("eventType", "createdAt");

CREATE TABLE IF NOT EXISTS "StripeRefund" (
  "id" SERIAL NOT NULL,
  "paymentId" INTEGER NOT NULL,
  "stripeRefundId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeRefund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StripeRefund_stripeRefundId_key" ON "StripeRefund"("stripeRefundId");
CREATE INDEX IF NOT EXISTS "StripeRefund_paymentId_createdAt_idx" ON "StripeRefund"("paymentId", "createdAt");
CREATE INDEX IF NOT EXISTS "StripeRefund_status_idx" ON "StripeRefund"("status");
DO $$ BEGIN
  ALTER TABLE "StripeRefund" ADD CONSTRAINT "StripeRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StripeDispute" (
  "id" SERIAL NOT NULL,
  "paymentId" INTEGER NOT NULL,
  "stripeDisputeId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "StripeDispute_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StripeDispute_stripeDisputeId_key" ON "StripeDispute"("stripeDisputeId");
CREATE INDEX IF NOT EXISTS "StripeDispute_paymentId_createdAt_idx" ON "StripeDispute"("paymentId", "createdAt");
CREATE INDEX IF NOT EXISTS "StripeDispute_status_idx" ON "StripeDispute"("status");
DO $$ BEGIN
  ALTER TABLE "StripeDispute" ADD CONSTRAINT "StripeDispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StripePayout" (
  "id" SERIAL NOT NULL,
  "stripePayoutId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "arrivalDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripePayout_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StripePayout_stripePayoutId_key" ON "StripePayout"("stripePayoutId");
CREATE INDEX IF NOT EXISTS "StripePayout_status_arrivalDate_idx" ON "StripePayout"("status", "arrivalDate");
CREATE INDEX IF NOT EXISTS "StripePayout_createdAt_idx" ON "StripePayout"("createdAt");
