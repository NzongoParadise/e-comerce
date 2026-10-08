ALTER TABLE "SupportConversation"
  ALTER COLUMN "customerId" DROP NOT NULL,
  ADD COLUMN "guestName" TEXT,
  ADD COLUMN "guestEmail" TEXT,
  ADD COLUMN "guestSessionHash" TEXT;

ALTER TABLE "SupportConversation"
  DROP CONSTRAINT "SupportConversation_customerId_fkey",
  ADD CONSTRAINT "SupportConversation_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SupportConversation_guestSessionHash_status_updatedAt_idx"
  ON "SupportConversation"("guestSessionHash", "status", "updatedAt");

ALTER TABLE "SupportMessage"
  ALTER COLUMN "senderId" DROP NOT NULL,
  DROP CONSTRAINT "SupportMessage_senderId_fkey",
  ADD CONSTRAINT "SupportMessage_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
