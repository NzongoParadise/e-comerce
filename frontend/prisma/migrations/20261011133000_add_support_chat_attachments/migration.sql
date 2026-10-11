ALTER TABLE "SupportMessage"
ADD COLUMN "attachmentName" TEXT,
ADD COLUMN "attachmentType" TEXT,
ADD COLUMN "attachmentSize" INTEGER,
ADD COLUMN "attachmentData" BYTEA;
