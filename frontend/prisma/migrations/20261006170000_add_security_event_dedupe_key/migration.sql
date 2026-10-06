ALTER TABLE "SecurityEvent" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "SecurityEvent_userId_dedupeKey_key" ON "SecurityEvent"("userId","dedupeKey");
