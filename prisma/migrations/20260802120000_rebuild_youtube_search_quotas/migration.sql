ALTER TABLE "SearchCache"
ADD COLUMN "algorithmVersion" TEXT NOT NULL DEFAULT 'youtube-search-v3';

CREATE TABLE "SearchUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "SearchUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchLock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchUsage_requestId_key" ON "SearchUsage"("requestId");
CREATE INDEX "SearchUsage_userId_createdAt_idx" ON "SearchUsage"("userId", "createdAt");
CREATE INDEX "SearchUsage_userId_status_idx" ON "SearchUsage"("userId", "status");
CREATE UNIQUE INDEX "SearchLock_userId_key" ON "SearchLock"("userId");
CREATE UNIQUE INDEX "SearchLock_requestId_key" ON "SearchLock"("requestId");
CREATE UNIQUE INDEX "SearchLock_cacheKey_key" ON "SearchLock"("cacheKey");

ALTER TABLE "SearchUsage"
ADD CONSTRAINT "SearchUsage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
