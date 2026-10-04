CREATE TABLE "AgtSeries" (
  "id" SERIAL NOT NULL,
  "seriesCode" TEXT NOT NULL,
  "seriesYear" INTEGER NOT NULL,
  "documentType" TEXT NOT NULL,
  "establishmentNumber" TEXT NOT NULL,
  "firstDocumentApproved" TEXT NOT NULL,
  "lastDocumentApproved" TEXT NOT NULL,
  "nextDocumentNumber" INTEGER NOT NULL,
  "seriesStatus" TEXT NOT NULL DEFAULT 'A',
  "invoicingMethod" TEXT,
  "seriesContingencyIndicator" TEXT NOT NULL DEFAULT 'N',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgtSeries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgtSeries_seriesCode_key" ON "AgtSeries"("seriesCode");
CREATE INDEX "AgtSeries_seriesYear_documentType_seriesStatus_idx" ON "AgtSeries"("seriesYear", "documentType", "seriesStatus");