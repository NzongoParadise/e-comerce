CREATE TABLE "FinanceEntry" (
  "id" SERIAL NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AOA',
  "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reference" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceEntry_type_status_transactionDate_idx" ON "FinanceEntry"("type", "status", "transactionDate");
CREATE INDEX "FinanceEntry_category_idx" ON "FinanceEntry"("category");

CREATE TABLE "FinanceEntryEvent" (
  "id" SERIAL NOT NULL,
  "entryId" INTEGER NOT NULL,
  "actorExternalId" TEXT,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceEntryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceEntryEvent_entryId_createdAt_idx" ON "FinanceEntryEvent"("entryId", "createdAt");
ALTER TABLE "FinanceEntryEvent" ADD CONSTRAINT "FinanceEntryEvent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;