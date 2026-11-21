-- Migration 003: add player location_label to endless_scores and create real global rank_scores table.
-- Safe to run once against an existing remote D1 database (preserves all existing endless_scores rows).

ALTER TABLE endless_scores ADD COLUMN location_label TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS rank_scores (
  player_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL,
  nickname_norm TEXT NOT NULL DEFAULT '',
  avatar_id TEXT NOT NULL DEFAULT 'capybara',
  location_label TEXT NOT NULL DEFAULT '',
  stars INTEGER NOT NULL DEFAULT 0,
  highest_stars INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  matches INTEGER NOT NULL DEFAULT 0,
  best_win_streak INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rank_board
  ON rank_scores (stars DESC, highest_stars DESC, wins DESC, updated_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rank_nickname_norm
  ON rank_scores (nickname_norm) WHERE nickname_norm != '';
