ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "sourceId" INTEGER;
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "FinanceEntry_idempotencyKey_key" ON "FinanceEntry"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "FinanceEntry_sourceType_sourceId_key" ON "FinanceEntry"("sourceType","sourceId");

CREATE TABLE IF NOT EXISTS "PurchaseReceipt" (
  "id" SERIAL NOT NULL,
  "purchaseId" INTEGER NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedBy" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseReceipt_receiptNumber_key" ON "PurchaseReceipt"("receiptNumber");
CREATE INDEX IF NOT EXISTS "PurchaseReceipt_purchaseId_receivedAt_idx" ON "PurchaseReceipt"("purchaseId","receivedAt");

CREATE TABLE IF NOT EXISTS "PurchaseReceiptItem" (
  "id" SERIAL NOT NULL,
  "receiptId" INTEGER NOT NULL,
  "purchaseItemId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "PurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseReceiptItem_receiptId_purchaseItemId_key" ON "PurchaseReceiptItem"("receiptId","purchaseItemId");
CREATE INDEX IF NOT EXISTS "PurchaseReceiptItem_purchaseItemId_idx" ON "PurchaseReceiptItem"("purchaseItemId");

CREATE TABLE IF NOT EXISTS "PurchasePayment" (
  "id" SERIAL NOT NULL,
  "purchaseId" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "reference" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidBy" TEXT,
  "notes" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchasePayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PurchasePayment_idempotencyKey_key" ON "PurchasePayment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PurchasePayment_purchaseId_paidAt_idx" ON "PurchasePayment"("purchaseId","paidAt");

DO $$ BEGIN
 ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
 ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
 ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
 ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;