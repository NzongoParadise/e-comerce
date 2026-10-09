CREATE TABLE "Invoice" (
  "id" SERIAL NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "verificationCode" TEXT NOT NULL,
  "orderId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "companyId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "currency" TEXT NOT NULL,
  "totalEUR" DECIMAL(10,2) NOT NULL,
  "totalKZ" DECIMAL(12,2) NOT NULL,
  "discountTotalEUR" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discountTotalKZ" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sellerName" TEXT NOT NULL,
  "sellerTaxId" TEXT,
  "sellerAddress" TEXT,
  "buyerName" TEXT,
  "buyerEmail" TEXT,
  "buyerTaxId" TEXT,
  "buyerAddress" TEXT,
  "issuedBy" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_verificationCode_key" ON "Invoice"("verificationCode");
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");
CREATE INDEX "Invoice_companyId_issuedAt_idx" ON "Invoice"("companyId", "issuedAt");
CREATE INDEX "Invoice_userId_issuedAt_idx" ON "Invoice"("userId", "issuedAt");
CREATE INDEX "Invoice_status_issuedAt_idx" ON "Invoice"("status", "issuedAt");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
