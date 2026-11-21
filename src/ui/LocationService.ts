import { fictionalLocationToken, sanitizeLocation } from '../core/Location';

export type LocationResolution =
  | { ok: true; mode: 'real'; label: string; source: 'gps' | 'cf' }
  | { ok: false; mode: 'fictional'; label: string; reason: 'denied' | 'unsupported' | 'timeout' | 'unavailable' };

export interface GeolocationLike {
  getCurrentPosition(
    success: (pos: { coords: { latitude: number; longitude: number } }) => void,
    error: (err: { code?: number }) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ): void;
}

export interface ResolveLocationOptions {
  language: 'zh-CN' | 'en';
  playerId: string;
  geolocation?: GeolocationLike | null;
  fetcher?: typeof fetch;
  fallbackGeo?: () => Promise<string | null>;
  geoTimeoutMs?: number;
  reverseTimeoutMs?: number;
}

const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/** Coarsens coordinates to ~1 km before reverse geocoding so exact street coordinates never leave the device. */
export const coarsenCoord = (value: number): number => Math.round(value * 100) / 100;

/** Extracts a concise, cozy city-level label from BigDataCloud's free client reverse-geocode response. */
export function parseReverseGeocode(raw: unknown, language: 'zh-CN' | 'en'): string {
  if (!raw || typeof raw !== 'object') return '';
  const data = raw as Record<string, unknown>;
  const pick = (key: string) => typeof data[key] === 'string' ? data[key].trim() : '';
  const city = pick('city') || pick('locality') || pick('principalSubdivision');
  const countryCode = pick('countryCode').toUpperCase();
  const countryName = pick('countryName');
  const base = city || countryName;
  if (!base) return '';
  // Trim trailing "市" in Chinese city names when paired cleanly? Keep natural names like 上海市/北京市 or clean short names.
  const combined = language === 'en' && city && countryCode && countryCode.length === 2 && !city.toUpperCase().endsWith(countryCode)
    ? `${city}, ${countryCode}`
    : base;
  return sanitizeLocation(combined);
}

async function reverseGeocode(lat: number, lon: number, language: 'zh-CN' | 'en', fetcher: typeof fetch, timeoutMs: number): Promise<string> {
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    const query = new URLSearchParams({
      latitude: String(coarsenCoord(lat)),
      longitude: String(coarsenCoord(lon)),
      localityLanguage: language === 'en' ? 'en' : 'zh',
    });
    const res = await fetcher(`${REVERSE_GEOCODE_URL}?${query}`, { method: 'GET', signal: controller?.signal });
    if (!res.ok) return '';
    return parseReverseGeocode(await res.json().catch(() => null), language);
  } catch {
    return '';
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Prompts the browser's native location permission dialog (`navigator.geolocation`).
 * - Allowed: reverse-geocodes coarsened coords to a city name (unaffected by VPNs); if reverse-geocoding times out,
 *   falls back to Cloudflare's built-in city lookup (`/api/geo`).
 * - Denied / unavailable: returns a cute fictional Capybara Onsen location instead.
 */
export async function resolveBrowserLocation(options: ResolveLocationOptions): Promise<LocationResolution> {
  const fallback = fictionalLocationToken(options.playerId);
  const geo = options.geolocation !== undefined
    ? options.geolocation
    : (typeof navigator !== 'undefined' && navigator.geolocation ? navigator.geolocation : null);
  if (!geo || typeof geo.getCurrentPosition !== 'function') {
    return { ok: false, mode: 'fictional', label: fallback, reason: 'unsupported' };
  }
  const coords = await new Promise<{ ok: true; lat: number; lon: number } | { ok: false; reason: 'denied' | 'timeout' | 'unavailable' }>(resolve => {
    let settled = false;
    const done = (result: { ok: true; lat: number; lon: number } | { ok: false; reason: 'denied' | 'timeout' | 'unavailable' }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timeoutMs = options.geoTimeoutMs ?? 8000;
    const guard = setTimeout(() => done({ ok: false, reason: 'timeout' }), timeoutMs + 500);
    try {
      geo.getCurrentPosition(
        pos => { clearTimeout(guard); done({ ok: true, lat: pos.coords.latitude, lon: pos.coords.longitude }); },
        err => {
          clearTimeout(guard);
          done({ ok: false, reason: err?.code === 1 ? 'denied' : err?.code === 3 ? 'timeout' : 'unavailable' });
        },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 600_000 },
      );
    } catch {
      clearTimeout(guard);
      done({ ok: false, reason: 'unavailable' });
    }
  });
  if (!coords.ok) {
    return { ok: false, mode: 'fictional', label: fallback, reason: coords.reason };
  }
  const fetcher = options.fetcher ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
  if (fetcher) {
    const city = await reverseGeocode(coords.lat, coords.lon, options.language, fetcher, options.reverseTimeoutMs ?? 4000);
    if (city) return { ok: true, mode: 'real', label: city, source: 'gps' };
  }
  if (options.fallbackGeo) {
    const cfCity = sanitizeLocation(await options.fallbackGeo().catch(() => null));
    if (cfCity) return { ok: true, mode: 'real', label: cfCity, source: 'cf' };
  }
  return { ok: false, mode: 'fictional', label: fallback, reason: 'unavailable' };
}
