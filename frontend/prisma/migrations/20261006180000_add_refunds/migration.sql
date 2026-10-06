CREATE TABLE "Refund" ("id" SERIAL NOT NULL,"orderId" INTEGER NOT NULL,"paymentId" INTEGER NOT NULL,"userId" INTEGER NOT NULL,"amountEUR" DECIMAL(10,2) NOT NULL,"amountKZ" DECIMAL(12,2) NOT NULL,"currency" TEXT NOT NULL,"reason" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'REQUESTED',"providerRefundId" TEXT,"provider" TEXT NOT NULL,"requestedBy" TEXT,"processedBy" TEXT,"failureReason" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"processedAt" TIMESTAMP(3),CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");
CREATE INDEX "Refund_orderId_createdAt_idx" ON "Refund"("orderId","createdAt");
CREATE INDEX "Refund_paymentId_status_idx" ON "Refund"("paymentId","status");
CREATE INDEX "Refund_userId_createdAt_idx" ON "Refund"("userId","createdAt");
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
