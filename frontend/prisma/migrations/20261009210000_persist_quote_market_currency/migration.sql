ALTER TABLE "Quote"
  ADD COLUMN "market" TEXT NOT NULL DEFAULT 'AO',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'AOA';

-- Recover the historical market from the linked company wherever that
-- relationship exists. Legacy personal quotes remain in the AO/AOA default.
UPDATE "Quote" AS q
SET "market" = 'PT', "currency" = 'EUR'
FROM "Company" AS c
WHERE q."companyId" = c."id"
  AND LOWER(TRIM(c."country")) IN ('pt', 'portugal');
