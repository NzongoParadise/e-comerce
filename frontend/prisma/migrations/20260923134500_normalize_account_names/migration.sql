-- Normalize labels used by the account profile.
UPDATE "User" SET "accountName" = 'Conta Grossista' WHERE "accountType" = 'B2B';
UPDATE "User" SET "accountName" = 'Conta Retalhista' WHERE "accountType" = 'B2C';
ALTER TABLE "User" ALTER COLUMN "accountName" SET DEFAULT 'Conta Retalhista';