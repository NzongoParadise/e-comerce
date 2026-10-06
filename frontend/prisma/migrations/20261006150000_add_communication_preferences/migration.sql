CREATE TABLE "CommunicationPreference" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "promotions" BOOLEAN NOT NULL DEFAULT true,
  "newProducts" BOOLEAN NOT NULL DEFAULT false,
  "orderUpdates" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunicationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationPreference_userId_key" ON "CommunicationPreference"("userId");
CREATE INDEX "CommunicationPreference_userId_idx" ON "CommunicationPreference"("userId");

ALTER TABLE "CommunicationPreference"
ADD CONSTRAINT "CommunicationPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
