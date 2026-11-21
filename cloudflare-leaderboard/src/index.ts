/**
 * Capybara: Chill Defense · global endless leaderboard (Cloudflare Workers + D1, zero dependencies).
 *
 *   GET  /api/health                          → { ok, service }
 *   GET  /api/leaderboard?playerId=&limit=100 → { ok, totalPlayers, entries, me }
 *   POST /api/score                           → { ok, rank, totalPlayers, bestWave, improved }
 *
 * Every validation, scoring and ranking rule is a pure exported function so the game's Vitest suite can test it.
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

export const SERVICE = 'capybara-endless-leaderboard';
export const MIN_WAVE = 11;
export const MAX_WAVE = 120;
export const MAX_ELAPSED = 86_400;
export const MAX_LIMIT = 100;
export const RATE_LIMIT = 20;
export const RATE_WINDOW_MS = 60_000;
export const MAX_BODY_BYTES = 2048;
export const AVATAR_IDS = ['capybara', 'hamster', 'squirrel', 'bee', 'cat_swordsman', 'doge_agent', 'goose_bully', 'kungfu_panda', 'rooster_star', 'frog_king', 'market_coon', 'salted_fish', 'bamboo_master', 'sakura_capy', 'corgi_crown', 'zen_capy'] as const;
export const HERO_IDS = ['kungfu_po', 'bamboo_mafia', 'zen_master', 'puss_in_hat', 'meowfia', 'purrcerer', 'samurai_doge', 'doge_wick', 'ronin_goose', 'ballin_rooster', 'rocket_coon', 'pepe_king'] as const;

/** One stored row (D1 column names). */
export interface ScoreRow {
  player_id: string; nickname: string; avatar_id: string; best_wave: number; elapsed_seconds: number;
  mvp_kind: string; mvp_awakened: number; awakened_count: number; medallion_total: number; updated_at: number;
}
export type ScoreInput = Omit<ScoreRow, 'updated_at'>;

// ───────────────────────── Validation ─────────────────────────
export const isValidPlayerId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id);
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
const int = (value: unknown, min: number, max: number): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
/** Lower bound on real play time: at least a minute, and at least 6 s per endless wave. */
export const minimumElapsed = (wave: number): number => Math.max(60, (wave - 10) * 6);

/** Validates a score submission. Rejections carry a stable error code for the client. */
export function validateScore(body: unknown): { ok: true; score: ScoreInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad_request' };
  const b = body as Record<string, unknown>;
  if (!isValidPlayerId(b.playerId)) return { ok: false, error: 'invalid_player' };
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
  return { ok: true, score: { player_id: b.playerId, nickname: nickname.value, avatar_id: avatar, best_wave: wave, elapsed_seconds: elapsed,
    mvp_kind: mvp, mvp_awakened: b.mvpAwakened === true ? 1 : 0, awakened_count: awakened, medallion_total: medallions } };
}

// ───────────────────────── Ranking ─────────────────────────
/** Higher wave first, then less time, then whoever got there first. */
export function compareRows(a: Pick<ScoreRow, 'best_wave' | 'elapsed_seconds' | 'updated_at'>, b: Pick<ScoreRow, 'best_wave' | 'elapsed_seconds' | 'updated_at'>): number {
  return b.best_wave - a.best_wave || a.elapsed_seconds - b.elapsed_seconds || a.updated_at - b.updated_at;
}
const better = (a: Pick<ScoreRow, 'best_wave' | 'elapsed_seconds'>, b: Pick<ScoreRow, 'best_wave' | 'elapsed_seconds'>) => a.best_wave > b.best_wave || (a.best_wave === b.best_wave && a.elapsed_seconds < b.elapsed_seconds);
/**
 * Monotone best-score upsert: a better run replaces the record; anything else keeps the historic best and only
 * refreshes nickname, avatar and `updated_at` (so a rename shows up immediately without lowering the record).
 */
export function mergeScore(existing: ScoreRow | null, incoming: ScoreInput, now: number): { row: ScoreRow; improved: boolean } {
  if (!existing || better(incoming, existing)) return { row: { ...incoming, updated_at: now }, improved: true };
  return { row: { ...existing, nickname: incoming.nickname, avatar_id: incoming.avatar_id, updated_at: now }, improved: false };
}
export function toEntry(row: ScoreRow, rank: number) {
  return { rank, playerId: row.player_id, nickname: row.nickname, avatarId: row.avatar_id, bestWave: row.best_wave, elapsedSeconds: row.elapsed_seconds,
    mvpKind: row.mvp_kind, mvpAwakened: row.mvp_awakened === 1, awakenedCount: row.awakened_count, medallionTotal: row.medallion_total, updatedAt: row.updated_at };
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
export interface ScoreStore {
  get(playerId: string): Promise<ScoreRow | null>;
  put(row: ScoreRow): Promise<void>;
  top(limit: number): Promise<ScoreRow[]>;
  count(): Promise<number>;
  rankOf(row: ScoreRow): Promise<number>;
  rate(key: string): Promise<{ window_start: number; hits: number } | null>;
  setRate(key: string, windowStart: number, hits: number): Promise<void>;
}
const COLUMNS = 'player_id, nickname, avatar_id, best_wave, elapsed_seconds, mvp_kind, mvp_awakened, awakened_count, medallion_total, updated_at';
export function d1Store(db: D1Database): ScoreStore {
  return {
    get: id => db.prepare(`SELECT ${COLUMNS} FROM endless_scores WHERE player_id = ?1`).bind(id).first<ScoreRow>(),
    put: async row => { await db.prepare(`INSERT INTO endless_scores (${COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      ON CONFLICT(player_id) DO UPDATE SET nickname = excluded.nickname, avatar_id = excluded.avatar_id, best_wave = excluded.best_wave,
      elapsed_seconds = excluded.elapsed_seconds, mvp_kind = excluded.mvp_kind, mvp_awakened = excluded.mvp_awakened,
      awakened_count = excluded.awakened_count, medallion_total = excluded.medallion_total, updated_at = excluded.updated_at`)
      .bind(row.player_id, row.nickname, row.avatar_id, row.best_wave, row.elapsed_seconds, row.mvp_kind, row.mvp_awakened, row.awakened_count, row.medallion_total, row.updated_at).run(); },
    top: async limit => (await db.prepare(`SELECT ${COLUMNS} FROM endless_scores ORDER BY best_wave DESC, elapsed_seconds ASC, updated_at ASC LIMIT ?1`).bind(limit).all<ScoreRow>()).results ?? [],
    count: async () => Number((await db.prepare('SELECT COUNT(*) AS total FROM endless_scores').first<{ total: number }>())?.total ?? 0),
    rankOf: async row => 1 + Number((await db.prepare(`SELECT COUNT(*) AS ahead FROM endless_scores WHERE best_wave > ?1
      OR (best_wave = ?1 AND elapsed_seconds < ?2) OR (best_wave = ?1 AND elapsed_seconds = ?2 AND updated_at < ?3)`)
      .bind(row.best_wave, row.elapsed_seconds, row.updated_at).first<{ ahead: number }>())?.ahead ?? 0),
    rate: key => db.prepare('SELECT window_start, hits FROM rate_limits WHERE ip_key = ?1').bind(key).first<{ window_start: number; hits: number }>(),
    setRate: async (key, windowStart, hits) => { await db.prepare(`INSERT INTO rate_limits (ip_key, window_start, hits) VALUES (?1, ?2, ?3)
      ON CONFLICT(ip_key) DO UPDATE SET window_start = excluded.window_start, hits = excluded.hits`).bind(key, windowStart, hits).run(); },
  };
}
/** In-memory store with identical semantics (tests and `wrangler dev` experiments). */
export function memoryStore(): ScoreStore & { rows: Map<string, ScoreRow> } {
  const rows = new Map<string, ScoreRow>(), rates = new Map<string, { window_start: number; hits: number }>();
  return {
    rows,
    get: async id => rows.get(id) ?? null,
    put: async row => { rows.set(row.player_id, { ...row }); },
    top: async limit => [...rows.values()].sort(compareRows).slice(0, limit),
    count: async () => rows.size,
    rankOf: async row => 1 + [...rows.values()].filter(other => compareRows(other, row) < 0).length,
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
export interface HandlerOptions { store?: ScoreStore; now?: () => number }
export async function handleRequest(request: Request, env: Env, options: HandlerOptions = {}): Promise<Response> {
  const url = new URL(request.url), origin = request.headers.get('Origin'), allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const cors = corsHeaders(origin, allowed), now = options.now?.() ?? Date.now();
  const originAllowed = !origin || allowed.includes(origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: originAllowed ? 204 : 403, headers: cors });
  if (!originAllowed) return json({ ok: false, error: 'forbidden_origin' }, 403, cors);
  try {
    const store = options.store ?? d1Store(env.DB);
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, service: SERVICE }, 200, cors);
    if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
      const limit = parseLimit(url.searchParams.get('limit')), playerId = url.searchParams.get('playerId');
      const [rows, totalPlayers] = await Promise.all([store.top(limit), store.count()]);
      const mine = isValidPlayerId(playerId) ? await store.get(playerId) : null;
      const me = mine ? toEntry(mine, await store.rankOf(mine)) : null;
      return json({ ok: true, totalPlayers, entries: rows.map((row, i) => toEntry(row, i + 1)), me }, 200, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/score') {
      const key = await ipKey(request.headers.get('CF-Connecting-IP') ?? 'unknown');
      const decision = rateLimitDecision(await store.rate(key), now);
      await store.setRate(key, decision.windowStart, decision.hits);
      if (!decision.allowed) return json({ ok: false, error: 'rate_limited' }, 429, { ...cors, 'Retry-After': '60' });
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'bad_request' }, 413, cors);
      let body: unknown; try { body = JSON.parse(text); } catch { return json({ ok: false, error: 'bad_request' }, 400, cors); }
      const checked = validateScore(body);
      if (!checked.ok) return json({ ok: false, error: checked.error }, 400, cors);
      const { row, improved } = mergeScore(await store.get(checked.score.player_id), checked.score, now);
      await store.put(row);
      const [rank, totalPlayers] = await Promise.all([store.rankOf(row), store.count()]);
      return json({ ok: true, rank, totalPlayers, bestWave: row.best_wave, improved }, 200, cors);
    }
    return json({ ok: false, error: 'not_found' }, 404, cors);
  } catch {
    return json({ ok: false, error: 'server_error' }, 500, cors);
  }
}

export default { fetch: (request: Request, env: Env) => handleRequest(request, env) };
