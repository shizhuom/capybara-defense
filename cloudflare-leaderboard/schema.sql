CREATE TABLE IF NOT EXISTS endless_scores (
  player_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL,
  nickname_norm TEXT NOT NULL DEFAULT '',
  avatar_id TEXT NOT NULL DEFAULT 'capybara',
  location_label TEXT NOT NULL DEFAULT '',
  best_wave INTEGER NOT NULL,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  mvp_kind TEXT NOT NULL DEFAULT 'kungfu_po',
  mvp_awakened INTEGER NOT NULL DEFAULT 0,
  awakened_count INTEGER NOT NULL DEFAULT 0,
  medallion_total INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_endless_rank
  ON endless_scores (best_wave DESC, elapsed_seconds ASC, updated_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_endless_nickname_norm
  ON endless_scores (nickname_norm) WHERE nickname_norm != '';

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

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL
);
