/**
 * P17.2 player location helpers: privacy-safe city display + cute fictional Capybara Onsen locations
 * when players decline browser location permission or play offline.
 */
export interface FictionalLocation {
  id: string;
  zh: string;
  en: string;
}

export const FICTIONAL_PREFIX = 'fictional:';
export const LOCATION_MAX_LENGTH = 28;

export const FICTIONAL_LOCATIONS: readonly FictionalLocation[] = [
  { id: 'yuzu_town', zh: '柚子温泉镇', en: 'Yuzu Onsen Town' },
  { id: 'bamboo_hill', zh: '暖雾竹林坡', en: 'Misty Bamboo Hill' },
  { id: 'sakura_bay', zh: '樱花木桶湾', en: 'Sakura Tub Bay' },
  { id: 'tangerine_isle', zh: '橘子漂流岛', en: 'Tangerine Drift Isle' },
  { id: 'fish_alley', zh: '烤鱼干小巷', en: 'Fish-Snack Alley' },
  { id: 'cloud_valley', zh: '云朵泡汤谷', en: 'Cloud Soak Valley' },
  { id: 'acorn_tea', zh: '松果茶水铺', en: 'Acorn Teahouse' },
  { id: 'moss_garden', zh: '青苔石阶院', en: 'Mossy Stone Yard' },
  { id: 'honey_creek', zh: '桂花蜜溪边', en: 'Honey Creek' },
  { id: 'melon_porch', zh: '西瓜凉亭角', en: 'Melon Porch' },
  { id: 'steam_ridge', zh: '雾气松木岭', en: 'Pine Steam Ridge' },
  { id: 'lotus_pond', zh: '荷风午睡池', en: 'Lotus Nap Pond' },
] as const;

const FICTIONAL_MAP = new Map<string, FictionalLocation>(FICTIONAL_LOCATIONS.map(item => [item.id, item]));
const BLOCKED = /\u6da9\u6da9|\u8272\u8272|\u4e0d\u8bb8\u6da9|\u7edd\u80b2|\u7eff\u8336|\u75af\u6279|\u8214\u72d7|\u9e21\u4f60\u592a|\u0062\u006f\u006e\u006b/i;
const STRIP = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/g;

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic cute fictional location token (`fictional:<id>`) for a player or seed string. */
export function fictionalLocationToken(seed: string): string {
  const index = hashSeed(seed || 'capy') % FICTIONAL_LOCATIONS.length;
  return `${FICTIONAL_PREFIX}${FICTIONAL_LOCATIONS[index].id}`;
}

/** Cycles to the next cute fictional location token so players can re-roll their cozy hometown. */
export function nextFictionalLocationToken(current: string | undefined, seed: string): string {
  const activeId = current?.startsWith(FICTIONAL_PREFIX) ? current.slice(FICTIONAL_PREFIX.length) : '';
  const currentIndex = FICTIONAL_LOCATIONS.findIndex(item => item.id === activeId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % FICTIONAL_LOCATIONS.length : (hashSeed(seed || 'capy') + 1) % FICTIONAL_LOCATIONS.length;
  return `${FICTIONAL_PREFIX}${FICTIONAL_LOCATIONS[nextIndex].id}`;
}

export function isFictionalLocation(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.startsWith(FICTIONAL_PREFIX) && FICTIONAL_MAP.has(raw.slice(FICTIONAL_PREFIX.length));
}

/** Sanitizes a city/region display label or fictional token; returns empty string when unusable. */
export function sanitizeLocation(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.replace(STRIP, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith(FICTIONAL_PREFIX)) {
    const id = cleaned.slice(FICTIONAL_PREFIX.length);
    return FICTIONAL_MAP.has(id) ? `${FICTIONAL_PREFIX}${id}` : '';
  }
  const clipped = Array.from(cleaned).slice(0, LOCATION_MAX_LENGTH).join('').trim();
  if (!clipped || BLOCKED.test(clipped.normalize('NFKC').replace(/[\s._\-*·]/g, ''))) return '';
  return clipped;
}

/** Returns the stored token/city to upload for a profile (always a valid cute fallback if unset). */
export function effectiveLocationToken(profile: { playerId: string; locationMode?: string; locationLabel?: string }): string {
  const clean = sanitizeLocation(profile.locationLabel);
  if (clean && (profile.locationMode === 'real' || isFictionalLocation(clean))) return clean;
  return fictionalLocationToken(profile.playerId);
}

/** Renders a location token or real city name in the active UI language. */
export function formatLocation(raw: string | undefined, language: 'zh-CN' | 'en', fallbackSeed = 'capy'): string {
  const clean = sanitizeLocation(raw);
  const token = clean || fictionalLocationToken(fallbackSeed);
  if (token.startsWith(FICTIONAL_PREFIX)) {
    const entry = FICTIONAL_MAP.get(token.slice(FICTIONAL_PREFIX.length)) ?? FICTIONAL_LOCATIONS[0];
    return language === 'en' ? entry.en : entry.zh;
  }
  return token;
}
