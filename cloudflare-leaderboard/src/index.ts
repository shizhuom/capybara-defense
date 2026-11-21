/**
 * Capybara: Chill Defense · global leaderboards (Cloudflare Workers + D1, zero dependencies).
 *
 *   GET  /api/health                                → { ok, service }
 *   GET  /api/geo                                   → { ok, location }
 *   GET  /api/nickname?name=&playerId=              → { ok, available }
 *   GET  /api/leaderboard?playerId=&limit=100       → { ok, totalPlayers, entries, me }
 *   POST /api/score                                 → { ok, rank, totalPlayers, bestWave, improved }
 *   GET  /api/rank-leaderboard?playerId=&limit=100  → { ok, totalPlayers, entries, me }
 *   POST /api/rank                                  → { ok, rank, totalPlayers, stars, improved }
 *
 * Security & fairness guarantees:
 *   1. Public leaderboard entries NEVER expose any player's raw `player_id` (only `isMe: boolean`).
 *   2. Every record is bound to a per-device `writeSecret` (stored salted & SHA-256 hashed in `secret_hash`)
 *      across BOTH endless and rank boards.
 *   3. Nicknames are strictly unique across BOTH leaderboards (case- & width-insensitive via `nickname_norm`).
 *      Attempting to claim another player's nickname returns 409 `nickname_taken`.
 *   4. Non-improving metadata updates (renaming / changing avatar / changing location) preserve the original
 *      `updated_at` so tie-breaker order is never demoted, and sync automatically between both boards.
 */

// ───────────────────────── Minimal D1 surface (no @cloudflare/workers-types needed) ─────────────────────────
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}
export interface D1Database { prepare(query: string): D1PreparedStatement }
export interface Env { DB: D1Database; ALLOWED_ORIGINS?: string }
interface CfGeo { city?: unknown; region?: unknown; country?: unknown }

export const SERVICE = 'capybara-endless-leaderboard';
export const MIN_WAVE = 11;
export const MAX_WAVE = 120;
export const MAX_ELAPSED = 86_400;
export const MAX_STARS = 10_000;
export const MAX_MATCHES = 100_000;
export const MAX_LIMIT = 100;
export const RATE_LIMIT = 20;
export const RATE_WINDOW_MS = 60_000;
export const MAX_BODY_BYTES = 2048;
export const AVATAR_IDS = ['capybara', 'hamster', 'squirrel', 'bee', 'cat_swordsman', 'doge_agent', 'goose_bully', 'kungfu_panda', 'rooster_star', 'frog_king', 'market_coon', 'salted_fish', 'bamboo_master', 'sakura_capy', 'corgi_crown', 'zen_capy'] as const;
export const HERO_IDS = ['kungfu_po', 'bamboo_mafia', 'zen_master', 'puss_in_hat', 'meowfia', 'purrcerer', 'samurai_doge', 'doge_wick', 'ronin_goose', 'ballin_rooster', 'rocket_coon', 'pepe_king'] as const;

/** One stored endless row (D1 column names). */
export interface ScoreRow {
  player_id: string; secret_hash: string; nickname: string; nickname_norm: string; avatar_id: string; location_label: string;
  best_wave: number; elapsed_seconds: number; mvp_kind: string; mvp_awakened: number;
  awakened_count: number; medallion_total: number; updated_at: number;
}
export type ScoreInput = Omit<ScoreRow, 'updated_at' | 'secret_hash'> & { write_secret?: string };

/** One stored global rank row (D1 column names). */
export interface RankRow {
  player_id: string; secret_hash: string; nickname: string; nickname_norm: string; avatar_id: string; location_label: string;
  stars: number; highest_stars: number; wins: number; matches: number; best_win_streak: number; updated_at: number;
}
export type RankInput = Omit<RankRow, 'updated_at' | 'secret_hash'> & { write_secret?: string };

// ───────────────────────── Validation & Crypto ─────────────────────────
export const isValidPlayerId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id);
export const isValidWriteSecret = (secret: unknown): secret is string => typeof secret === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(secret);
/** Same word list as the game's wholesome-copy test, stored as escapes so this file itself stays clean. */
const BLOCKED = /\u6da9\u6da9|\u8272\u8272|\u4e0d\u8bb8\u6da9|\u7edd\u80b2|\u7eff\u8336|\u75af\u6279|\u8214\u72d7|\u9e21\u4f60\u592a|\u0062\u006f\u006e\u006b/i;
const STRIP = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/g;
export function sanitizeNickname(raw: unknown): { ok: boolean; value: string; error?: string } {
  const value = (typeof raw === 'string' ? raw : '').replace(STRIP, '').replace(/\s+/g, ' ').trim();
  const length = Array.from(value).length;
  if (length < 2 || length > 14) return { ok: false, value, error: 'invalid_nickname' };
  if (BLOCKED.test(value.normalize('NFKC').replace(/[\s._\-*·]/g, ''))) return { ok: false, value, error: 'invalid_nickname' };
  return { ok: true, value };
}
/** Case- and width-insensitive unique key so full-width/mixed-case lookalikes cannot impersonate another player. */
export const normalizeNicknameKey = (nickname: string): string => nickname.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

/** Accepts either a preset fictional token (`fictional:<slug>`) or a short wholesome city/region display label. */
export function sanitizeLocation(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.replace(STRIP, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('fictional:')) return /^fictional:[a-z0-9_]{2,32}$/.test(cleaned) ? cleaned : '';
  const clipped = Array.from(cleaned).slice(0, 28).join('').trim();
  if (!clipped || BLOCKED.test(clipped.normalize('NFKC').replace(/[\s._\-*·]/g, ''))) return '';
  return clipped;
}

/** Formats Cloudflare's native edge geo metadata (`request.cf`) into a city-level display string. */
export function formatCfGeo(cf: CfGeo | undefined): string | null {
  if (!cf || typeof cf !== 'object') return null;
  const pick = (v: unknown) => typeof v === 'string' ? v.trim() : '';
  const city = pick(cf.city), region = pick(cf.region), country = pick(cf.country).toUpperCase();
  const place = city || region;
  const combined = place && country && country.length === 2 ? `${place}, ${country}` : place || country;
  const clean = sanitizeLocation(combined);
  return clean || null;
}

const int = (value: unknown, min: number, max: number): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
/** Lower bound on real play time: at least a minute, and at least 6 s per endless wave. */
export const minimumElapsed = (wave: number): number => Math.max(60, (wave - 10) * 6);

export async function hashSecret(playerId: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`capy-secret:${playerId}:${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Validates an endless score submission. Rejections carry a stable error code for the client. */
export function validateScore(body: unknown): { ok: true; score: ScoreInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad_request' };
  const b = body as Record<string, unknown>;
  if (!isValidPlayerId(b.playerId)) return { ok: false, error: 'invalid_player' };
  if (b.writeSecret !== undefined && !isValidWriteSecret(b.writeSecret)) return { ok: false, error: 'invalid_secret' };
  const nickname = sanitizeNickname(b.nickname);
  if (!nickname.ok) return { ok: false, error: 'invalid_nickname' };
  const wave = int(b.bestWave, MIN_WAVE, MAX_WAVE);
  if (wave === null) return { ok: false, error: 'invalid_score' };
  const elapsed = int(b.elapsedSeconds, minimumElapsed(wave), MAX_ELAPSED);
  const medallions = int(b.medallionTotal, 0, 300), awakened = int(b.awakenedCount, 0, 12);
  if (elapsed === null || medallions === null || awakened === null) return { ok: false, error: 'invalid_score' };
  // Plausible power: deep waves need medallion levels or at least one awakened hero.
  if (wave >= 45 && medallions < 30 && awakened < 1) return { ok: false, error: 'implausible_score' };
  const avatar = typeof b.avatarId === 'string' && (AVATAR_IDS as readonly string[]).includes(b.avatarId) ? b.avatarId : 'capybara';
  const mvp = typeof b.mvpKind === 'string' && (HERO_IDS as readonly string[]).includes(b.mvpKind) ? b.mvpKind : 'kungfu_po';
  const location = sanitizeLocation(b.location);
  return { ok: true, score: { player_id: b.playerId, nickname: nickname.value, nickname_norm: normalizeNicknameKey(nickname.value),
    avatar_id: avatar, location_label: location, best_wave: wave, elapsed_seconds: elapsed, mvp_kind: mvp, mvp_awakened: b.mvpAwakened === true ? 1 : 0,
    awakened_count: awakened, medallion_total: medallions, ...(typeof b.writeSecret === 'string' ? { write_secret: b.writeSecret } : {}) } };
}

/** Validates a global rank-board submission (stars / wins / matches). */
export function validateRank(body: unknown): { ok: true; rank: RankInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad_request' };
  const b = body as Record<string, unknown>;
  if (!isValidPlayerId(b.playerId)) return { ok: false, error: 'invalid_player' };
  if (b.writeSecret !== undefined && !isValidWriteSecret(b.writeSecret)) return { ok: false, error: 'invalid_secret' };
  const nickname = sanitizeNickname(b.nickname);
  if (!nickname.ok) return { ok: false, error: 'invalid_nickname' };
  const stars = int(b.stars, 0, MAX_STARS);
  const matches = int(b.matches, 0, MAX_MATCHES);
  const wins = int(b.wins, 0, MAX_MATCHES);
  const highestStars = int(b.highestStars ?? b.stars, 0, MAX_STARS);
  const bestWinStreak = int(b.bestWinStreak ?? 0, 0, MAX_MATCHES);
  if (stars === null || matches === null || wins === null || highestStars === null || bestWinStreak === null) return { ok: false, error: 'invalid_score' };
  if (wins > matches || bestWinStreak > wins || highestStars < stars) return { ok: false, error: 'invalid_score' };
  if (matches < 1 && stars < 1) return { ok: false, error: 'invalid_score' };
  // Each win awards at most +2 stars (3+ streak); reject developer-mode instant star jumps with no battles played.
  if (stars > matches * 2 + 2 || highestStars > matches * 2 + 2) return { ok: false, error: 'implausible_score' };
  const avatar = typeof b.avatarId === 'string' && (AVATAR_IDS as readonly string[]).includes(b.avatarId) ? b.avatarId : 'capybara';
  const location = sanitizeLocation(b.location);
  return { ok: true, rank: { player_id: b.playerId, nickname: nickname.value, nickname_norm: normalizeNicknameKey(nickname.value),
    avatar_id: avatar, location_label: location, stars, highest_stars: highestStars, wins, matches, best_win_streak: bestWinStreak,
    ...(typeof b.writeSecret === 'string' ? { write_secret: b.writeSecret } : {}) } };
}

// ───────────────────────── Ranking ─────────────────────────
/** Higher wave first, then less time, then whoever got there first. */
export function compareRows(a: Pick<ScoreRow, 'best_wave' | 'elapsed_seconds' | 'updated_at'>, b: Pick<ScoreRow, 'best_wave' | 'elapsed_seconds' | 'updated_at'>): number {
  return b.best_wave - a.best_wave || a.elapsed_seconds - b.elapsed_seconds || a.updated_at - b.updated_at;
}
/** Higher stars first, then peak stars, then total wins, then whoever reached it first. */
export function compareRankRows(a: Pick<RankRow, 'stars' | 'highest_stars' | 'wins' | 'updated_at'>, b: Pick<RankRow, 'stars' | 'highest_stars' | 'wins' | 'updated_at'>): number {
  return b.stars - a.stars || b.highest_stars - a.highest_stars || b.wins - a.wins || a.updated_at - b.updated_at;
}
const better = (a: Pick<ScoreRow, 'best_wave' | 'elapsed_seconds'>, b: Pick<ScoreRow, 'best_wave' | 'elapsed_seconds'>) => a.best_wave > b.best_wave || (a.best_wave === b.best_wave && a.elapsed_seconds < b.elapsed_seconds);
/**
 * Monotone best-score upsert: a better run replaces the record and sets `updated_at = now`;
 * non-improving metadata edits (nickname/avatar/location) preserve the original `updated_at` so tie-breaker rank never drops.
 */
export function mergeScore(existing: ScoreRow | null, incoming: Omit<ScoreRow, 'updated_at'>, now: number): { row: ScoreRow; improved: boolean } {
  const loc = incoming.location_label || existing?.location_label || '';
  if (!existing || better(incoming, existing)) {
    return { row: { ...incoming, secret_hash: existing?.secret_hash || incoming.secret_hash, location_label: loc, updated_at: now }, improved: true };
  }
  return { row: { ...existing, secret_hash: existing.secret_hash || incoming.secret_hash, nickname: incoming.nickname, nickname_norm: incoming.nickname_norm, avatar_id: incoming.avatar_id, location_label: loc }, improved: false };
}
/**
 * Rank upsert: tracks live stars whenever matches advance (stars can go down by 1 on high-rank defeats);
 * metadata-only updates (nickname/avatar/location) preserve `updated_at` so tie-breaker rank never drops.
 */
export function mergeRank(existing: RankRow | null, incoming: Omit<RankRow, 'updated_at'>, now: number): { row: RankRow; improved: boolean } {
  const loc = incoming.location_label || existing?.location_label || '';
  if (!existing) {
    return { row: { ...incoming, location_label: loc, updated_at: now }, improved: true };
  }
  const progressed = incoming.matches > existing.matches
    || (incoming.matches === existing.matches && (incoming.stars > existing.stars || incoming.highest_stars > existing.highest_stars || incoming.wins > existing.wins));
  if (progressed) {
    const improved = incoming.stars > existing.stars || incoming.highest_stars > existing.highest_stars;
    const rankChanged = incoming.stars !== existing.stars || incoming.highest_stars !== existing.highest_stars || incoming.wins !== existing.wins;
    return {
      row: {
        ...incoming,
        secret_hash: existing.secret_hash || incoming.secret_hash,
        location_label: loc,
        highest_stars: Math.max(existing.highest_stars, incoming.highest_stars, incoming.stars),
        wins: Math.max(existing.wins, incoming.wins),
        matches: Math.max(existing.matches, incoming.matches),
        best_win_streak: Math.max(existing.best_win_streak, incoming.best_win_streak),
        updated_at: rankChanged ? now : existing.updated_at,
      },
      improved,
    };
  }
  return {
    row: { ...existing, secret_hash: existing.secret_hash || incoming.secret_hash, nickname: incoming.nickname, nickname_norm: incoming.nickname_norm, avatar_id: incoming.avatar_id, location_label: loc },
    improved: false,
  };
}

/** Public projection: NEVER leaks any player's raw `player_id`; marks the caller's own row via `isMe`. */
export function toEntry(row: ScoreRow, rank: number, requesterPlayerId?: string | null) {
  return { rank, isMe: Boolean(requesterPlayerId && row.player_id === requesterPlayerId), nickname: row.nickname, avatarId: row.avatar_id,
    location: row.location_label || '', bestWave: row.best_wave, elapsedSeconds: row.elapsed_seconds, mvpKind: row.mvp_kind, mvpAwakened: row.mvp_awakened === 1,
    awakenedCount: row.awakened_count, medallionTotal: row.medallion_total, updatedAt: row.updated_at };
}
export function toRankEntry(row: RankRow, rank: number, requesterPlayerId?: string | null) {
  return { rank, isMe: Boolean(requesterPlayerId && row.player_id === requesterPlayerId), nickname: row.nickname, avatarId: row.avatar_id,
    location: row.location_label || '', stars: row.stars, highestStars: row.highest_stars, wins: row.wins, matches: row.matches,
    bestWinStreak: row.best_win_streak, updatedAt: row.updated_at };
}
/** Fixed-window limiter: at most `limit` writes per `windowMs` per key. */
export function rateLimitDecision(current: { window_start: number; hits: number } | null, now: number, limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS) {
  if (!current || now - current.window_start >= windowMs) return { allowed: true, windowStart: now, hits: 1 };
  return { allowed: current.hits < limit, windowStart: current.window_start, hits: current.hits + 1 };
}
export const parseLimit = (raw: string | null): number => { const n = Number(raw ?? MAX_LIMIT); return Number.isInteger(n) ? Math.max(1, Math.min(MAX_LIMIT, n)) : MAX_LIMIT; };

// ───────────────────────── CORS ─────────────────────────
export const parseAllowedOrigins = (value: string | undefined): string[] => (value ?? '').split(',').map(origin => origin.trim().replace(/\/+$/, '')).filter(Boolean);
export function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (origin && allowed.includes(origin)) Object.assign(headers, {
    'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400',
  });
  return headers;
}

// ───────────────────────── Storage (D1 in production, memory in tests) ─────────────────────────
export interface ProfileMetaPatch { secret_hash: string; nickname: string; nickname_norm: string; avatar_id: string; location_label: string }
export interface ScoreStore {
  get(playerId: string): Promise<ScoreRow | null>;
  getRank(playerId: string): Promise<RankRow | null>;
  findByNickname(nicknameNorm: string): Promise<{ player_id: string } | null>;
  findSecretHash(playerId: string): Promise<string | null>;
  put(row: ScoreRow): Promise<void>;
  putRank(row: RankRow): Promise<void>;
  syncProfileMetadata(playerId: string, meta: ProfileMetaPatch): Promise<void>;
  top(limit: number): Promise<ScoreRow[]>;
  count(): Promise<number>;
  rankOf(row: ScoreRow): Promise<number>;
  topRanks(limit: number): Promise<RankRow[]>;
  countRanks(): Promise<number>;
  rankOrderOf(row: RankRow): Promise<number>;
  rate(key: string): Promise<{ window_start: number; hits: number } | null>;
  setRate(key: string, windowStart: number, hits: number): Promise<void>;
}
const ENDLESS_COLS = 'player_id, secret_hash, nickname, nickname_norm, avatar_id, location_label, best_wave, elapsed_seconds, mvp_kind, mvp_awakened, awakened_count, medallion_total, updated_at';
const RANK_COLS = 'player_id, secret_hash, nickname, nickname_norm, avatar_id, location_label, stars, highest_stars, wins, matches, best_win_streak, updated_at';

export function d1Store(db: D1Database): ScoreStore {
  return {
    get: id => db.prepare(`SELECT ${ENDLESS_COLS} FROM endless_scores WHERE player_id = ?1`).bind(id).first<ScoreRow>(),
    getRank: id => db.prepare(`SELECT ${RANK_COLS} FROM rank_scores WHERE player_id = ?1`).bind(id).first<RankRow>(),
    findByNickname: async norm => {
      const endless = await db.prepare('SELECT player_id FROM endless_scores WHERE nickname_norm = ?1 OR LOWER(TRIM(nickname)) = ?1 LIMIT 1').bind(norm).first<{ player_id: string }>();
      if (endless) return endless;
      return db.prepare('SELECT player_id FROM rank_scores WHERE nickname_norm = ?1 OR LOWER(TRIM(nickname)) = ?1 LIMIT 1').bind(norm).first<{ player_id: string }>();
    },
    findSecretHash: async id => {
      const a = await db.prepare('SELECT secret_hash FROM endless_scores WHERE player_id = ?1').bind(id).first<{ secret_hash: string }>();
      if (a?.secret_hash) return a.secret_hash;
      const b = await db.prepare('SELECT secret_hash FROM rank_scores WHERE player_id = ?1').bind(id).first<{ secret_hash: string }>();
      return b?.secret_hash || null;
    },
    put: async row => { await db.prepare(`INSERT INTO endless_scores (${ENDLESS_COLS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
      ON CONFLICT(player_id) DO UPDATE SET secret_hash = excluded.secret_hash, nickname = excluded.nickname, nickname_norm = excluded.nickname_norm,
      avatar_id = excluded.avatar_id, location_label = excluded.location_label, best_wave = excluded.best_wave, elapsed_seconds = excluded.elapsed_seconds,
      mvp_kind = excluded.mvp_kind, mvp_awakened = excluded.mvp_awakened, awakened_count = excluded.awakened_count, medallion_total = excluded.medallion_total, updated_at = excluded.updated_at`)
      .bind(row.player_id, row.secret_hash, row.nickname, row.nickname_norm, row.avatar_id, row.location_label, row.best_wave, row.elapsed_seconds, row.mvp_kind, row.mvp_awakened, row.awakened_count, row.medallion_total, row.updated_at).run(); },
    putRank: async row => { await db.prepare(`INSERT INTO rank_scores (${RANK_COLS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
      ON CONFLICT(player_id) DO UPDATE SET secret_hash = excluded.secret_hash, nickname = excluded.nickname, nickname_norm = excluded.nickname_norm,
      avatar_id = excluded.avatar_id, location_label = excluded.location_label, stars = excluded.stars, highest_stars = excluded.highest_stars,
      wins = excluded.wins, matches = excluded.matches, best_win_streak = excluded.best_win_streak, updated_at = excluded.updated_at`)
      .bind(row.player_id, row.secret_hash, row.nickname, row.nickname_norm, row.avatar_id, row.location_label, row.stars, row.highest_stars, row.wins, row.matches, row.best_win_streak, row.updated_at).run(); },
    syncProfileMetadata: async (playerId, meta) => {
      await Promise.all([
        db.prepare(`UPDATE endless_scores SET secret_hash = CASE WHEN secret_hash = '' THEN ?2 ELSE secret_hash END,
          nickname = ?3, nickname_norm = ?4, avatar_id = ?5, location_label = CASE WHEN ?6 != '' THEN ?6 ELSE location_label END WHERE player_id = ?1`)
          .bind(playerId, meta.secret_hash, meta.nickname, meta.nickname_norm, meta.avatar_id, meta.location_label).run(),
        db.prepare(`UPDATE rank_scores SET secret_hash = CASE WHEN secret_hash = '' THEN ?2 ELSE secret_hash END,
          nickname = ?3, nickname_norm = ?4, avatar_id = ?5, location_label = CASE WHEN ?6 != '' THEN ?6 ELSE location_label END WHERE player_id = ?1`)
          .bind(playerId, meta.secret_hash, meta.nickname, meta.nickname_norm, meta.avatar_id, meta.location_label).run(),
      ]);
    },
    top: async limit => (await db.prepare(`SELECT ${ENDLESS_COLS} FROM endless_scores ORDER BY best_wave DESC, elapsed_seconds ASC, updated_at ASC LIMIT ?1`).bind(limit).all<ScoreRow>()).results ?? [],
    count: async () => Number((await db.prepare('SELECT COUNT(*) AS total FROM endless_scores').first<{ total: number }>())?.total ?? 0),
    rankOf: async row => 1 + Number((await db.prepare(`SELECT COUNT(*) AS ahead FROM endless_scores WHERE best_wave > ?1
      OR (best_wave = ?1 AND elapsed_seconds < ?2) OR (best_wave = ?1 AND elapsed_seconds = ?2 AND updated_at < ?3)`)
      .bind(row.best_wave, row.elapsed_seconds, row.updated_at).first<{ ahead: number }>())?.ahead ?? 0),
    topRanks: async limit => (await db.prepare(`SELECT ${RANK_COLS} FROM rank_scores ORDER BY stars DESC, highest_stars DESC, wins DESC, updated_at ASC LIMIT ?1`).bind(limit).all<RankRow>()).results ?? [],
    countRanks: async () => Number((await db.prepare('SELECT COUNT(*) AS total FROM rank_scores').first<{ total: number }>())?.total ?? 0),
    rankOrderOf: async row => 1 + Number((await db.prepare(`SELECT COUNT(*) AS ahead FROM rank_scores WHERE stars > ?1
      OR (stars = ?1 AND highest_stars > ?2) OR (stars = ?1 AND highest_stars = ?2 AND wins > ?3)
      OR (stars = ?1 AND highest_stars = ?2 AND wins = ?3 AND updated_at < ?4)`)
      .bind(row.stars, row.highest_stars, row.wins, row.updated_at).first<{ ahead: number }>())?.ahead ?? 0),
    rate: key => db.prepare('SELECT window_start, hits FROM rate_limits WHERE ip_key = ?1').bind(key).first<{ window_start: number; hits: number }>(),
    setRate: async (key, windowStart, hits) => { await db.prepare(`INSERT INTO rate_limits (ip_key, window_start, hits) VALUES (?1, ?2, ?3)
      ON CONFLICT(ip_key) DO UPDATE SET window_start = excluded.window_start, hits = excluded.hits`).bind(key, windowStart, hits).run(); },
  };
}
/** In-memory store with identical semantics (tests and `wrangler dev` experiments). */
export function memoryStore(): ScoreStore & { rows: Map<string, ScoreRow>; rankRows: Map<string, RankRow> } {
  const rows = new Map<string, ScoreRow>(), rankRows = new Map<string, RankRow>(), rates = new Map<string, { window_start: number; hits: number }>();
  const assertUnique = (map: Map<string, { player_id: string; nickname: string; nickname_norm: string }>, playerId: string, norm: string, table: string) => {
    for (const other of map.values()) {
      if (other.player_id !== playerId && (other.nickname_norm || normalizeNicknameKey(other.nickname)) === norm) {
        throw new Error(`UNIQUE constraint failed: ${table}.nickname_norm`);
      }
    }
  };
  return {
    rows, rankRows,
    get: async id => rows.get(id) ?? null,
    getRank: async id => rankRows.get(id) ?? null,
    findByNickname: async norm => {
      const a = [...rows.values()].find(r => (r.nickname_norm || normalizeNicknameKey(r.nickname)) === norm);
      if (a) return { player_id: a.player_id };
      const b = [...rankRows.values()].find(r => (r.nickname_norm || normalizeNicknameKey(r.nickname)) === norm);
      return b ? { player_id: b.player_id } : null;
    },
    findSecretHash: async id => rows.get(id)?.secret_hash || rankRows.get(id)?.secret_hash || null,
    put: async row => { assertUnique(rows, row.player_id, row.nickname_norm, 'endless_scores'); rows.set(row.player_id, { ...row }); },
    putRank: async row => { assertUnique(rankRows, row.player_id, row.nickname_norm, 'rank_scores'); rankRows.set(row.player_id, { ...row }); },
    syncProfileMetadata: async (playerId, meta) => {
      const endless = rows.get(playerId);
      if (endless) {
        assertUnique(rows, playerId, meta.nickname_norm, 'endless_scores');
        rows.set(playerId, { ...endless, secret_hash: endless.secret_hash || meta.secret_hash, nickname: meta.nickname, nickname_norm: meta.nickname_norm, avatar_id: meta.avatar_id, location_label: meta.location_label || endless.location_label });
      }
      const rank = rankRows.get(playerId);
      if (rank) {
        assertUnique(rankRows, playerId, meta.nickname_norm, 'rank_scores');
        rankRows.set(playerId, { ...rank, secret_hash: rank.secret_hash || meta.secret_hash, nickname: meta.nickname, nickname_norm: meta.nickname_norm, avatar_id: meta.avatar_id, location_label: meta.location_label || rank.location_label });
      }
    },
    top: async limit => [...rows.values()].sort(compareRows).slice(0, limit),
    count: async () => rows.size,
    rankOf: async row => 1 + [...rows.values()].filter(other => compareRows(other, row) < 0).length,
    topRanks: async limit => [...rankRows.values()].sort(compareRankRows).slice(0, limit),
    countRanks: async () => rankRows.size,
    rankOrderOf: async row => 1 + [...rankRows.values()].filter(other => compareRankRows(other, row) < 0).length,
    rate: async key => rates.get(key) ?? null,
    setRate: async (key, window_start, hits) => { rates.set(key, { window_start, hits }); },
  };
}

/** IPs are never stored raw: only a salted SHA-256 prefix is kept for the per-minute counter. */
export async function ipKey(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`capy-endless:${ip}`), digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest).slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
}

// ───────────────────────── HTTP ─────────────────────────
const json = (body: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export interface HandlerOptions { store?: ScoreStore; now?: () => number; cf?: CfGeo }
export async function handleRequest(request: Request, env: Env, options: HandlerOptions = {}): Promise<Response> {
  const url = new URL(request.url), origin = request.headers.get('Origin'), allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const cors = corsHeaders(origin, allowed), now = options.now?.() ?? Date.now();
  const originAllowed = !origin || allowed.includes(origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: originAllowed ? 204 : 403, headers: cors });
  if (!originAllowed) return json({ ok: false, error: 'forbidden_origin' }, 403, cors);
  try {
    const store = options.store ?? d1Store(env.DB);
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, service: SERVICE }, 200, cors);
    if (request.method === 'GET' && url.pathname === '/api/geo') {
      const cf = options.cf ?? (request as Request & { cf?: CfGeo }).cf;
      return json({ ok: true, location: formatCfGeo(cf) }, 200, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/nickname') {
      const check = sanitizeNickname(url.searchParams.get('name'));
      if (!check.ok) return json({ ok: false, available: false, error: 'invalid_nickname' }, 400, cors);
      const playerId = url.searchParams.get('playerId');
      const owner = await store.findByNickname(normalizeNicknameKey(check.value));
      const available = !owner || (isValidPlayerId(playerId) && owner.player_id === playerId);
      return json({ ok: true, available }, 200, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
      const limit = parseLimit(url.searchParams.get('limit')), playerId = url.searchParams.get('playerId');
      const validPlayer = isValidPlayerId(playerId) ? playerId : null;
      const [rows, totalPlayers] = await Promise.all([store.top(limit), store.count()]);
      const mine = validPlayer ? await store.get(validPlayer) : null;
      const me = mine ? toEntry(mine, await store.rankOf(mine), validPlayer) : null;
      return json({ ok: true, totalPlayers, entries: rows.map((row, i) => toEntry(row, i + 1, validPlayer)), me }, 200, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/rank-leaderboard') {
      const limit = parseLimit(url.searchParams.get('limit')), playerId = url.searchParams.get('playerId');
      const validPlayer = isValidPlayerId(playerId) ? playerId : null;
      const [rows, totalPlayers] = await Promise.all([store.topRanks(limit), store.countRanks()]);
      const mine = validPlayer ? await store.getRank(validPlayer) : null;
      const me = mine ? toRankEntry(mine, await store.rankOrderOf(mine), validPlayer) : null;
      return json({ ok: true, totalPlayers, entries: rows.map((row, i) => toRankEntry(row, i + 1, validPlayer)), me }, 200, cors);
    }
    if (request.method === 'POST' && (url.pathname === '/api/score' || url.pathname === '/api/rank')) {
      const key = await ipKey(request.headers.get('CF-Connecting-IP') ?? 'unknown');
      const decision = rateLimitDecision(await store.rate(key), now);
      await store.setRate(key, decision.windowStart, decision.hits);
      if (!decision.allowed) return json({ ok: false, error: 'rate_limited' }, 429, { ...cors, 'Retry-After': '60' });
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'bad_request' }, 413, cors);
      let body: unknown; try { body = JSON.parse(text); } catch { return json({ ok: false, error: 'bad_request' }, 400, cors); }

      if (url.pathname === '/api/score') {
        const checked = validateScore(body);
        if (!checked.ok) return json({ ok: false, error: checked.error }, 400, cors);
        const { write_secret: rawSecret, ...cleanScore } = checked.score;
        if (!rawSecret) return json({ ok: false, error: 'invalid_secret' }, 400, cors);
        const secretHash = await hashSecret(cleanScore.player_id, rawSecret);
        const storedSecret = await store.findSecretHash(cleanScore.player_id);
        if (storedSecret && storedSecret !== secretHash) return json({ ok: false, error: 'forbidden_player' }, 403, cors);
        const nicknameOwner = await store.findByNickname(cleanScore.nickname_norm);
        if (nicknameOwner && nicknameOwner.player_id !== cleanScore.player_id) return json({ ok: false, error: 'nickname_taken' }, 409, cors);
        const existing = await store.get(cleanScore.player_id);
        const { row, improved } = mergeScore(existing, { ...cleanScore, secret_hash: secretHash }, now);
        try {
          await store.put(row);
          await store.syncProfileMetadata(row.player_id, { secret_hash: row.secret_hash, nickname: row.nickname, nickname_norm: row.nickname_norm, avatar_id: row.avatar_id, location_label: row.location_label });
        } catch (err) {
          if (err instanceof Error && /UNIQUE/i.test(err.message)) return json({ ok: false, error: 'nickname_taken' }, 409, cors);
          throw err;
        }
        const [rank, totalPlayers] = await Promise.all([store.rankOf(row), store.count()]);
        return json({ ok: true, rank, totalPlayers, bestWave: row.best_wave, improved }, 200, cors);
      }

      const checked = validateRank(body);
      if (!checked.ok) return json({ ok: false, error: checked.error }, 400, cors);
      const { write_secret: rawSecret, ...cleanRank } = checked.rank;
      if (!rawSecret) return json({ ok: false, error: 'invalid_secret' }, 400, cors);
      const secretHash = await hashSecret(cleanRank.player_id, rawSecret);
      const storedSecret = await store.findSecretHash(cleanRank.player_id);
      if (storedSecret && storedSecret !== secretHash) return json({ ok: false, error: 'forbidden_player' }, 403, cors);
      const nicknameOwner = await store.findByNickname(cleanRank.nickname_norm);
      if (nicknameOwner && nicknameOwner.player_id !== cleanRank.player_id) return json({ ok: false, error: 'nickname_taken' }, 409, cors);
      const existing = await store.getRank(cleanRank.player_id);
      const { row, improved } = mergeRank(existing, { ...cleanRank, secret_hash: secretHash }, now);
      try {
        await store.putRank(row);
        await store.syncProfileMetadata(row.player_id, { secret_hash: row.secret_hash, nickname: row.nickname, nickname_norm: row.nickname_norm, avatar_id: row.avatar_id, location_label: row.location_label });
      } catch (err) {
        if (err instanceof Error && /UNIQUE/i.test(err.message)) return json({ ok: false, error: 'nickname_taken' }, 409, cors);
        throw err;
      }
      const [rank, totalPlayers] = await Promise.all([store.rankOrderOf(row), store.countRanks()]);
      return json({ ok: true, rank, totalPlayers, stars: row.stars, improved }, 200, cors);
    }
    return json({ ok: false, error: 'not_found' }, 404, cors);
  } catch {
    return json({ ok: false, error: 'server_error' }, 500, cors);
  }
}

export default { fetch: (request: Request, env: Env) => handleRequest(request, env) };
