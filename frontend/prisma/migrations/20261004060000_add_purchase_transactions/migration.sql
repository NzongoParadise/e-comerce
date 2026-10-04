CREATE TABLE "Purchase" (
  "id" SERIAL NOT NULL,
  "purchaseNumber" TEXT NOT NULL,
  "supplierId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "currency" TEXT NOT NULL DEFAULT 'AOA',
  "subtotal" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "reference" TEXT,
  "notes" TEXT,
  "financeEntryId" INTEGER,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Purchase_purchaseNumber_key" ON "Purchase"("purchaseNumber");
CREATE UNIQUE INDEX "Purchase_financeEntryId_key" ON "Purchase"("financeEntryId");
CREATE INDEX "Purchase_supplierId_transactionDate_idx" ON "Purchase"("supplierId","transactionDate");
CREATE INDEX "Purchase_status_paymentStatus_idx" ON "Purchase"("status","paymentStatus");

CREATE TABLE "PurchaseItem" (
  "id" SERIAL NOT NULL,
  "purchaseId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

CREATE TABLE "PurchaseEvent" (
  "id" SERIAL NOT NULL,
  "purchaseId" INTEGER NOT NULL,
  "actorExternalId" TEXT,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseEvent_purchaseId_createdAt_idx" ON "PurchaseEvent"("purchaseId","createdAt");

ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "FinanceEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON UPDATE CASCADE;
ALTER TABLE "PurchaseEvent" ADD CONSTRAINT "PurchaseEvent_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
