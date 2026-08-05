-- Version 1 grants every existing non-Pro account a fresh three-search allocation.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "freeSearchQuotaVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET
  "searchesRemaining" = 3,
  "freeSearchQuotaVersion" = 1
WHERE LOWER(BTRIM("plan")) <> 'pro'
  AND "freeSearchQuotaVersion" < 1;

ALTER TABLE "User"
ALTER COLUMN "searchesRemaining" SET DEFAULT 3,
ALTER COLUMN "freeSearchQuotaVersion" SET DEFAULT 1;
