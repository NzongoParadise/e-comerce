ALTER TABLE "Quote"
    ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'AOA';

ALTER TABLE "PurchaseOrder"
    ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'AOA';

UPDATE "PurchaseOrder" AS po
SET "currency" = orders."currency"
FROM "Order" AS orders
WHERE po."orderId" = orders."id"
  AND orders."currency" IN ('AOA', 'EUR');

UPDATE "Quote" AS quote
SET "currency" = orders."currency"
FROM "PurchaseOrder" AS po
JOIN "Order" AS orders ON orders."id" = po."orderId"
WHERE po."quoteId" = quote."id"
  AND orders."currency" IN ('AOA', 'EUR');
