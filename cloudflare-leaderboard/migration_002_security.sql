-- P17.1 security & unique-nickname migration for existing Cloudflare D1 databases.
-- Run once against remote D1:
--   npx wrangler d1 execute capybara-endless-db --remote --file=./migration_002_security.sql

ALTER TABLE endless_scores ADD COLUMN secret_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE endless_scores ADD COLUMN nickname_norm TEXT NOT NULL DEFAULT '';

-- Backfill normalized nicknames for existing rows; if any duplicates already existed,
-- keep the highest-ranked holder's nickname_norm and suffix later duplicates with their short id.
UPDATE endless_scores
SET nickname_norm = LOWER(TRIM(nickname))
WHERE nickname_norm = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_endless_nickname_norm
  ON endless_scores (nickname_norm) WHERE nickname_norm != '';
