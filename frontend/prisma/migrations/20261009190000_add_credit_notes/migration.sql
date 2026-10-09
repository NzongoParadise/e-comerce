CREATE TABLE "CreditNote" (
  "id" SERIAL NOT NULL,
  "creditNoteNumber" TEXT NOT NULL,
  "verificationCode" TEXT NOT NULL,
  "invoiceId" INTEGER NOT NULL,
  "orderId" INTEGER NOT NULL,
  "refundId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "companyId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "currency" TEXT NOT NULL,
  "amountEUR" DECIMAL(10,2) NOT NULL,
  "amountKZ" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "sellerName" TEXT NOT NULL,
  "sellerTaxId" TEXT,
  "sellerAddress" TEXT,
  "buyerName" TEXT,
  "buyerTaxId" TEXT,
  "buyerAddress" TEXT,
  "issuedBy" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON "CreditNote"("creditNoteNumber");
CREATE UNIQUE INDEX "CreditNote_verificationCode_key" ON "CreditNote"("verificationCode");
CREATE UNIQUE INDEX "CreditNote_refundId_key" ON "CreditNote"("refundId");
CREATE INDEX "CreditNote_companyId_issuedAt_idx" ON "CreditNote"("companyId", "issuedAt");
CREATE INDEX "CreditNote_userId_issuedAt_idx" ON "CreditNote"("userId", "issuedAt");
CREATE INDEX "CreditNote_invoiceId_issuedAt_idx" ON "CreditNote"("invoiceId", "issuedAt");

ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_refundId_fkey"
  FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
