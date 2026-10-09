ALTER TABLE "Order"
  ADD COLUMN "inventoryReserved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "inventoryReservationExpiresAt" TIMESTAMP(3);

-- Preserve inventory reservations already held by in-flight B2C checkouts.
UPDATE "Order" AS o
SET
  "inventoryReserved" = true,
  "inventoryReservationExpiresAt" = COALESCE(p."expiresAt", CURRENT_TIMESTAMP + INTERVAL '30 minutes')
FROM "Payment" AS p
WHERE p."orderId" = o."id"
  AND o."status" = 'AWAITING_PAYMENT'
  AND p."status" <> 'PAID';

-- Legacy B2B conversion deducted stock before the buyer initiated a payment.
-- Give these existing orders a short migration grace period so the first payment
-- attempt can finish or the scheduled cleanup can release the inventory safely.
UPDATE "Order" AS o
SET
  "inventoryReserved" = true,
  "inventoryReservationExpiresAt" = CURRENT_TIMESTAMP + INTERVAL '1 hour'
WHERE o."companyId" IS NOT NULL
  AND o."status" = 'PENDING'
  AND NOT EXISTS (
    SELECT 1
    FROM "Payment" AS p
    WHERE p."orderId" = o."id"
      AND p."status" = 'PAID'
  );

CREATE INDEX "Order_inventoryReserved_inventoryReservationExpiresAt_idx"
  ON "Order"("inventoryReserved", "inventoryReservationExpiresAt");
