-- Remove data used exclusively by the former server-side Gmail OAuth integration.
DROP TABLE IF EXISTS "GoogleAccount";
DROP TABLE IF EXISTS "EmailSent";

ALTER TABLE "CampaignProspect"
  DROP COLUMN IF EXISTS "gmailMessageId",
  DROP COLUMN IF EXISTS "sendError",
  DROP COLUMN IF EXISTS "sendStatus",
  DROP COLUMN IF EXISTS "sentAt";
