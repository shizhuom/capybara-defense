import type { Profile } from './types';

export const STAMINA_MAX = 30;
export const STAMINA_COST_PER_BATTLE = 5;
export const STAMINA_REGEN_SECONDS = 300; // +1 stamina every 5 minutes
export const STAMINA_REFILL_AMOUNT = 15;
export const STAMINA_REFILL_COIN_COST = 60;
export const STAMINA_HARD_CAP = 99;

export interface StaminaStatus {
  current: number;
  max: number;
  /** Seconds remaining until the next +1 natural recovery (0 when current >= max). */
  nextRegenSeconds: number;
  updatedAt: number;
}

function clampRawStamina(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return STAMINA_MAX;
  return Math.max(0, Math.min(STAMINA_HARD_CAP, Math.trunc(value)));
}

function validStamp(value: unknown, nowMs: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return nowMs;
  return Math.min(nowMs, Math.trunc(value));
}

/** Computes current stamina including natural time-based recovery (1 per 5 min, up to 30). */
export function getStaminaStatus(profile: Pick<Profile, 'stamina' | 'staminaUpdatedAt'>, nowMs = Date.now()): StaminaStatus {
  const base = clampRawStamina(profile.stamina);
  if (base >= STAMINA_MAX) {
    return { current: base, max: STAMINA_MAX, nextRegenSeconds: 0, updatedAt: nowMs };
  }
  const stamp = validStamp(profile.staminaUpdatedAt, nowMs);
  const elapsedSec = Math.max(0, Math.floor((nowMs - stamp) / 1000));
  const gained = Math.floor(elapsedSec / STAMINA_REGEN_SECONDS);
  const current = Math.min(STAMINA_MAX, base + gained);
  if (current >= STAMINA_MAX) {
    return { current, max: STAMINA_MAX, nextRegenSeconds: 0, updatedAt: nowMs };
  }
  const remainder = elapsedSec % STAMINA_REGEN_SECONDS;
  const nextRegenSeconds = Math.max(1, STAMINA_REGEN_SECONDS - remainder);
  const updatedAt = stamp + gained * STAMINA_REGEN_SECONDS * 1000;
  return { current, max: STAMINA_MAX, nextRegenSeconds, updatedAt };
}

/** Returns a profile with natural stamina recovery settled cleanly. */
export function settleStamina(profile: Profile, nowMs = Date.now()): Profile {
  const st = getStaminaStatus(profile, nowMs);
  if (profile.stamina === st.current && profile.staminaUpdatedAt === st.updatedAt) return profile;
  return { ...profile, stamina: st.current, staminaUpdatedAt: st.updatedAt };
}

export function canAffordBattleStamina(profile: Pick<Profile, 'stamina' | 'staminaUpdatedAt'>, nowMs = Date.now()): boolean {
  return getStaminaStatus(profile, nowMs).current >= STAMINA_COST_PER_BATTLE;
}

/** Deducts stamina for starting a battle (default 5). Starts regen clock when dropping below 30. */
export function spendStamina(
  profile: Profile,
  cost = STAMINA_COST_PER_BATTLE,
  nowMs = Date.now(),
): { ok: boolean; profile: Profile; remaining: number } {
  const settled = settleStamina(profile, nowMs);
  const cur = clampRawStamina(settled.stamina);
  if (cur < cost) {
    return { ok: false, profile: settled, remaining: cur };
  }
  const next = cur - cost;
  // When crossing from >= max to < max, anchor regen timer at nowMs; otherwise preserve existing partial progress.
  const updatedAt = cur >= STAMINA_MAX ? nowMs : validStamp(settled.staminaUpdatedAt, nowMs);
  return {
    ok: true,
    remaining: next,
    profile: { ...settled, stamina: next, staminaUpdatedAt: updatedAt },
  };
}

/** Grants stamina (e.g. from coin tea-break refill or rewarded video). Preserves overflow up to STAMINA_HARD_CAP. */
export function grantStamina(profile: Profile, amount: number, nowMs = Date.now()): Profile {
  const settled = settleStamina(profile, nowMs);
  const cur = clampRawStamina(settled.stamina);
  const next = Math.min(STAMINA_HARD_CAP, cur + Math.max(0, Math.trunc(amount)));
  const updatedAt = next >= STAMINA_MAX ? nowMs : validStamp(settled.staminaUpdatedAt, nowMs);
  return { ...settled, stamina: next, staminaUpdatedAt: updatedAt };
}

/** Spends 60 coins for +15 stamina (cozy onsen tea break). */
export function buyStaminaWithCoins(
  profile: Profile,
  nowMs = Date.now(),
): { ok: boolean; profile: Profile; reason?: 'no_coins' | 'full' } {
  const settled = settleStamina(profile, nowMs);
  const cur = clampRawStamina(settled.stamina);
  if (cur >= STAMINA_HARD_CAP) return { ok: false, profile: settled, reason: 'full' };
  if (settled.coins < STAMINA_REFILL_COIN_COST) return { ok: false, profile: settled, reason: 'no_coins' };
  const refilled = grantStamina({ ...settled, coins: settled.coins - STAMINA_REFILL_COIN_COST }, STAMINA_REFILL_AMOUNT, nowMs);
  return { ok: true, profile: refilled };
}

export function formatStaminaCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}
