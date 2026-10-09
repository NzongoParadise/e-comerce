ALTER TABLE "Refund" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");
