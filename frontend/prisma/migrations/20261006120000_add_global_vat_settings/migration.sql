CREATE TABLE "SystemSetting" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
  "vatRate" DECIMAL(5,2),
  "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
  "vatConfiguredAt" TIMESTAMP(3),
  "vatConfiguredBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);
