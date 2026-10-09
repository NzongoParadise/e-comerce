ALTER TABLE "Refund"
ADD COLUMN "returnRequestId" INTEGER;

CREATE INDEX "Refund_returnRequestId_status_idx"
ON "Refund"("returnRequestId", "status");

ALTER TABLE "Refund"
ADD CONSTRAINT "Refund_returnRequestId_fkey"
FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
