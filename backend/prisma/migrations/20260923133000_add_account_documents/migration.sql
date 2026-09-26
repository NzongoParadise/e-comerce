-- AlterTable
ALTER TABLE "User" ADD COLUMN "companyDocumentPath" TEXT;
ALTER TABLE "User" ADD COLUMN "personalDocumentPath" TEXT;

-- New accounts are retail by default; existing business accounts keep their type.
ALTER TABLE "User" ALTER COLUMN "accountType" SET DEFAULT 'B2C';