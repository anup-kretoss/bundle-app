-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "collectionTitle" TEXT NOT NULL,
    "rules" TEXT NOT NULL,
    "discountCodes" JSONB,
    "shopifyDiscountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "ruleIndex" INTEGER NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "discountNodeId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_shop_isOnline_key" ON "Session"("shop", "isOnline");

-- CreateIndex
CREATE INDEX "Bundle_collectionId_idx" ON "Bundle"("collectionId");

-- CreateIndex
CREATE INDEX "Bundle_createdAt_idx" ON "Bundle"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "DiscountCode_bundleId_ruleIndex_idx" ON "DiscountCode"("bundleId", "ruleIndex");

-- CreateIndex
CREATE INDEX "DiscountCode_customerId_idx" ON "DiscountCode"("customerId");

-- CreateIndex
CREATE INDEX "DiscountCode_sessionId_idx" ON "DiscountCode"("sessionId");

-- CreateIndex
CREATE INDEX "DiscountCode_used_idx" ON "DiscountCode"("used");

-- CreateIndex
CREATE INDEX "DiscountCode_createdAt_idx" ON "DiscountCode"("createdAt");

-- CreateIndex
CREATE INDEX "DiscountCode_bundleId_ruleIndex_customerId_sessionId_idx" ON "DiscountCode"("bundleId", "ruleIndex", "customerId", "sessionId");
