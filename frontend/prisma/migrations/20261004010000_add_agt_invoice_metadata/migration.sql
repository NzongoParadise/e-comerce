ALTER TABLE "Order"
  ADD COLUMN "agtDocumentNo" TEXT,
  ADD COLUMN "agtStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN "agtRequestId" TEXT,
  ADD COLUMN "agtJwsDocumentSignature" TEXT,
  ADD COLUMN "agtQrUrl" TEXT,
  ADD COLUMN "agtSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "agtValidatedAt" TIMESTAMP(3),
  ADD COLUMN "agtError" JSONB;

CREATE UNIQUE INDEX "Order_agtDocumentNo_key" ON "Order"("agtDocumentNo");
CREATE INDEX "Order_agtStatus_idx" ON "Order"("agtStatus");
