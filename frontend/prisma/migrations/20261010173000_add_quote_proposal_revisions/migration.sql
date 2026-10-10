ALTER TABLE "Quote"
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "validUntil" TIMESTAMP(3),
    ADD COLUMN "issuedAt" TIMESTAMP(3),
    ADD COLUMN "acceptedAt" TIMESTAMP(3),
    ADD COLUMN "acceptedVersion" INTEGER;

ALTER TABLE "QuoteItem"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "imageUrl" TEXT;

CREATE TABLE "QuoteRevision" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteEvent" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "revisionId" INTEGER,
    "version" INTEGER NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteRevision_quoteId_version_key"
    ON "QuoteRevision"("quoteId", "version");
CREATE INDEX "QuoteRevision_quoteId_createdAt_idx"
    ON "QuoteRevision"("quoteId", "createdAt");
CREATE INDEX "QuoteEvent_quoteId_createdAt_idx"
    ON "QuoteEvent"("quoteId", "createdAt");
CREATE INDEX "QuoteEvent_actorUserId_createdAt_idx"
    ON "QuoteEvent"("actorUserId", "createdAt");

ALTER TABLE "QuoteRevision"
    ADD CONSTRAINT "QuoteRevision_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteRevision"
    ADD CONSTRAINT "QuoteRevision_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteEvent"
    ADD CONSTRAINT "QuoteEvent_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteEvent"
    ADD CONSTRAINT "QuoteEvent_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "QuoteRevision"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteEvent"
    ADD CONSTRAINT "QuoteEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
