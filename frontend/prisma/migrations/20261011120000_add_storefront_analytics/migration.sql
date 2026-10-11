CREATE TABLE "StorefrontEvent" (
    "id" SERIAL NOT NULL,
    "visitorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "path" TEXT,
    "productId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorefrontEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontEvent_createdAt_eventType_idx" ON "StorefrontEvent"("createdAt", "eventType");
CREATE INDEX "StorefrontEvent_visitorId_createdAt_idx" ON "StorefrontEvent"("visitorId", "createdAt");
CREATE INDEX "StorefrontEvent_productId_eventType_createdAt_idx" ON "StorefrontEvent"("productId", "eventType", "createdAt");

ALTER TABLE "StorefrontEvent" ADD CONSTRAINT "StorefrontEvent_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
