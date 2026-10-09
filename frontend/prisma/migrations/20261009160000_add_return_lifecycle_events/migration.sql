CREATE TABLE "ReturnRequestEvent" (
  "id" SERIAL NOT NULL,
  "returnRequestId" INTEGER NOT NULL,
  "previousStatus" TEXT,
  "nextStatus" TEXT NOT NULL,
  "actorExternalId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnRequestEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReturnRequest_status_createdAt_idx" ON "ReturnRequest"("status", "createdAt");
CREATE INDEX "ReturnRequest_userId_createdAt_idx" ON "ReturnRequest"("userId", "createdAt");
CREATE INDEX "ReturnRequestEvent_returnRequestId_createdAt_idx" ON "ReturnRequestEvent"("returnRequestId", "createdAt");
ALTER TABLE "ReturnRequestEvent" ADD CONSTRAINT "ReturnRequestEvent_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
