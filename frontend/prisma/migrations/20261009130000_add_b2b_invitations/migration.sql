CREATE TABLE "B2BInvitation" (
  "id" SERIAL NOT NULL,
  "companyId" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'BUYER',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "tokenHash" TEXT NOT NULL,
  "invitedByUserId" INTEGER NOT NULL,
  "acceptedByUserId" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "B2BInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "B2BInvitation_tokenHash_key" ON "B2BInvitation"("tokenHash");
CREATE INDEX "B2BInvitation_companyId_status_expiresAt_idx" ON "B2BInvitation"("companyId", "status", "expiresAt");
CREATE INDEX "B2BInvitation_email_status_expiresAt_idx" ON "B2BInvitation"("email", "status", "expiresAt");
CREATE INDEX "B2BInvitation_companyId_email_idx" ON "B2BInvitation"("companyId", "email");

ALTER TABLE "B2BInvitation"
  ADD CONSTRAINT "B2BInvitation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "B2BInvitation"
  ADD CONSTRAINT "B2BInvitation_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "B2BInvitation"
  ADD CONSTRAINT "B2BInvitation_acceptedByUserId_fkey"
  FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
