CREATE TABLE "CompanyStatusHistory" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyStatusHistory_companyId_createdAt_idx" ON "CompanyStatusHistory"("companyId", "createdAt");

ALTER TABLE "CompanyStatusHistory" ADD CONSTRAINT "CompanyStatusHistory_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyStatusHistory" ADD CONSTRAINT "CompanyStatusHistory_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
