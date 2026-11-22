import { BROTHS, BROTH_IDS, INGREDIENT_IDS, type IngredientId } from '../config/kitchen';
import { FACILITIES, FACILITY_IDS, type FacilityId } from '../config/village';
import { RARITY_RULES, WEAPONS } from '../config/weapons';
import { grantWeaponFragments } from './MetaProgression';
import type { Profile } from './types';

/**
 * P19 Progressive Feature Unlocks (star-gated across ~30 matches / ~2.7h + deep 3x speed),
 * one-time interactive starter gifts, Option-A next-preview metadata, and Zeigarnik settlement hooks.
 */
export type FeatureId =
  | 'armory'
  | 'speed2x'
  | 'market'
  | 'endless'
  | 'village'
  | 'kitchen'
  | 'medallions'
  | 'speed3x';

export type OnboardingKey =
  | FeatureId
  | 'prop_battle'
  | 'endless_battle';

export interface FeatureUnlockRule {
  id: FeatureId;
  /** Minimum monotonic highestStars required (`0` when gated purely by match count). */
  stars: number;
  /** Minimum matches played (`1` for armory right after Match 1). */
  matches?: number;
  /** Alternative endless-wave unlock (for deep-player `speed3x`). */
  endlessWave?: number;
  /** Whether this feature has a start-screen dock/pill icon for Option-A locked preview. */
  dockPreview?: boolean;
}

export const FEATURE_UNLOCK_RULES: readonly FeatureUnlockRule[] = [
  { id: 'armory', stars: 1, matches: 1, dockPreview: true },
  { id: 'speed2x', stars: 2, dockPreview: false },
  { id: 'market', stars: 5, dockPreview: true },
  { id: 'endless', stars: 10, dockPreview: false },
  { id: 'village', stars: 16, dockPreview: true },
  { id: 'kitchen', stars: 23, dockPreview: true },
  { id: 'medallions', stars: 32, dockPreview: true },
  { id: 'speed3x', stars: 60, endlessWave: 25, dockPreview: false },
] as const;

export const FEATURE_IDS = FEATURE_UNLOCK_RULES.map(r => r.id) as readonly FeatureId[];

const VALID_ONBOARD_TOKENS = new Set<string>([
  ...FEATURE_IDS.flatMap(id => [`gift:${id}`, `done:${id}`]),
  'done:prop_battle',
  'done:endless_battle',
]);

export function sanitizeOnboardedFeatures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((v): v is string => typeof v === 'string' && VALID_ONBOARD_TOKENS.has(v)))];
}

export function effectiveStars(profile: Pick<Profile, 'stars' | 'highestStars'>): number {
  return Math.max(profile.stars ?? 0, profile.highestStars ?? 0);
}

/** Monotonic unlock check driven strictly by match count / highestStars / bestEndlessWave. */
export function isFeatureUnlocked(
  profile: Pick<Profile, 'matches' | 'stars' | 'highestStars' | 'bestEndlessWave'>,
  feature: FeatureId,
): boolean {
  const bestStars = effectiveStars(profile);
  const matches = profile.matches ?? 0;
  const bestWave = profile.bestEndlessWave ?? 0;
  switch (feature) {
    case 'armory': return matches >= 1 || bestStars >= 1;
    case 'speed2x': return bestStars >= 2;
    case 'market': return bestStars >= 5;
    case 'endless': return bestStars >= 10;
    case 'village': return bestStars >= 16;
    case 'kitchen': return bestStars >= 23;
    case 'medallions': return bestStars >= 32;
    case 'speed3x': return bestStars >= 60 || bestWave >= 25;
  }
}

/** Rank & profile hub unlocks alongside Armory after finishing Match 1 (keeps Match 1 menu ultra clean). */
export function isRankHubUnlocked(profile: Pick<Profile, 'matches' | 'stars' | 'highestStars'>): boolean {
  return (profile.matches ?? 0) >= 1 || effectiveStars(profile) >= 1;
}

export function maxBattleSpeed(profile: Pick<Profile, 'matches' | 'stars' | 'highestStars' | 'bestEndlessWave'>): 1 | 2 | 3 {
  if (isFeatureUnlocked(profile, 'speed3x')) return 3;
  if (isFeatureUnlocked(profile, 'speed2x')) return 2;
  return 1;
}

export function hasOnboarded(profile: Pick<Profile, 'onboardedFeatures'>, key: OnboardingKey): boolean {
  return (profile.onboardedFeatures ?? []).includes(`done:${key}`);
}

export function hasClaimedFeatureGift(profile: Pick<Profile, 'onboardedFeatures'>, feature: FeatureId): boolean {
  return (profile.onboardedFeatures ?? []).includes(`gift:${feature}`);
}

export function markOnboarded(profile: Profile, key: OnboardingKey): Profile {
  const token = `done:${key}`;
  const current = profile.onboardedFeatures ?? [];
  if (current.includes(token)) return profile;
  return { ...profile, onboardedFeatures: [...current, token] };
}

export function allOnboardedTokens(): string[] {
  return [...VALID_ONBOARD_TOKENS];
}

export interface NextFeaturePreview {
  id: FeatureId;
  targetStars: number;
  currentStars: number;
  remainingStars: number;
  requiresMatchOnly: boolean;
  endlessWaveAlt?: number;
}

/** Returns the single next locked feature (or next locked dock feature for Option-A start screen). */
export function nextLockedFeature(
  profile: Pick<Profile, 'matches' | 'stars' | 'highestStars' | 'bestEndlessWave'>,
  dockOnly = false,
): NextFeaturePreview | null {
  const bestStars = effectiveStars(profile);
  const rule = FEATURE_UNLOCK_RULES.find(r => (!dockOnly || r.dockPreview) && !isFeatureUnlocked(profile, r.id));
  if (!rule) return null;
  return {
    id: rule.id,
    targetStars: rule.stars,
    currentStars: bestStars,
    remainingStars: Math.max(0, rule.stars - bestStars),
    requiresMatchOnly: rule.id === 'armory' && (profile.matches ?? 0) === 0,
    endlessWaveAlt: rule.endlessWave,
  };
}

/** First menu-based unlocked feature that still needs its interactive introduction on the courtyard. */
export function pendingMenuOnboarding(profile: Profile): FeatureId | null {
  const menuOrder: readonly FeatureId[] = ['armory', 'market', 'village', 'kitchen', 'medallions'];
  return menuOrder.find(id => isFeatureUnlocked(profile, id) && !hasOnboarded(profile, id)) ?? null;
}

/**
 * Grants the one-time starter gift for an unlocked feature so the player can immediately perform
 * their first forge / spin / equip / build / brew / medallion upgrade. Completely idempotent.
 */
export function claimFeatureStarterGift(profile: Profile, feature: FeatureId, now = Date.now()): { profile: Profile; granted: boolean } {
  const token = `gift:${feature}`;
  const list = profile.onboardedFeatures ?? [];
  if (list.includes(token)) return { profile, granted: false };
  let next: Profile = { ...profile, onboardedFeatures: [...list, token] };
  switch (feature) {
    case 'armory': {
      // Enough fragments to forge and equip the Fly Swatter immediately (2 fragments).
      const need = Math.max(0, RARITY_RULES[0].fragments - (next.weaponFragments.m01_swatter ?? 0));
      if (need > 0) next = grantWeaponFragments(next, Array.from({ length: need }, () => 'm01_swatter')).profile;
      break;
    }
    case 'market': {
      // Gift 1 Super Glue Trap (active prop for hands-on battle tutorial) + 1 free gacha ticket.
      next = {
        ...next,
        ownedProps: { ...next.ownedProps, glue_trap: Math.max(1, next.ownedProps.glue_trap ?? 0) },
        freeLotteryTickets: (next.freeLotteryTickets ?? 0) + 1,
      };
      break;
    }
    case 'village': {
      // Exact materials to hand-build Bamboo Onsen Pool Lv.1 (10 wood, 3 essence) + fresh harvest anchor.
      const cost = FACILITIES.fac_bamboo_pool.costs[0]!;
      next = {
        ...next,
        village: {
          ...next.village,
          wood: (next.village?.wood ?? 0) + cost.wood,
          essence: (next.village?.essence ?? 0) + cost.essence,
          lastHarvestAt: now - 15 * 60_000,
        },
      };
      break;
    }
    case 'kitchen': {
      // Exact 4 Golden Yuzu to brew Yuzu Calm Soak Lv.1 immediately.
      next = {
        ...next,
        ingredients: { ...(next.ingredients ?? {}), ing_yuzu: (next.ingredients?.ing_yuzu ?? 0) + 4 },
      };
      break;
    }
    case 'medallions': {
      // Exact crests + coins (10 crests, 20 coins) to upgrade Ember Breakthrough to Lv.1.
      next = {
        ...next,
        endlessCrests: (next.endlessCrests ?? 0) + 10,
        coins: (next.coins ?? 0) + 20,
      };
      break;
    }
    default:
      break;
  }
  return { profile: next, granted: true };
}

export interface NextGoalHook {
  kind: 'feature' | 'gacha_ticket' | 'weapon' | 'village' | 'kitchen';
  id: string;
  current: number;
  target: number;
  percent: number;
}

/**
 * Zeigarnik "Almost there!" settlement hook: highlights the single closest tangible goal
 * to maximize the "just one more run" urge.
 */
export function computeNextGoalHook(profile: Profile): NextGoalHook | null {
  // 1. Next locked feature (strongest pull through Match 1..30 and toward deep 3x speed)
  const nextFeat = nextLockedFeature(profile, false);
  if (nextFeat) {
    if (nextFeat.requiresMatchOnly) {
      return { kind: 'feature', id: nextFeat.id, current: 0, target: 1, percent: 0 };
    }
    // Only prioritize speed3x when within 15 stars, otherwise let mid-game crafting hooks shine!
    if (nextFeat.id !== 'speed3x' || nextFeat.remainingStars <= 15) {
      const pct = Math.min(99, Math.round((nextFeat.currentStars / Math.max(1, nextFeat.targetStars)) * 100));
      return { kind: 'feature', id: nextFeat.id, current: nextFeat.currentStars, target: nextFeat.targetStars, percent: pct };
    }
  }
  // 2. 2/3 wins toward next free gacha ticket
  if (isFeatureUnlocked(profile, 'market') && (profile.gachaWinCounter ?? 0) === 2) {
    return { kind: 'gacha_ticket', id: 'ticket', current: 2, target: 3, percent: 67 };
  }
  // 3. Any weapon within 1-2 fragments of unlocking (preferring higher rarity)
  if (isFeatureUnlocked(profile, 'armory')) {
    const closeWeapons = Object.values(WEAPONS)
      .filter(w => !profile.unlockedWeapons.includes(w.id))
      .map(w => {
        const target = RARITY_RULES[w.rarity].fragments;
        const current = profile.weaponFragments[w.id] ?? 0;
        return { w, current, target, missing: target - current };
      })
      .filter(x => x.current > 0 && x.missing > 0 && x.missing <= 2)
      .sort((a, b) => a.missing - b.missing || b.w.rarity - a.w.rarity);
    if (closeWeapons.length) {
      const best = closeWeapons[0];
      return { kind: 'weapon', id: best.w.id, current: best.current, target: best.target, percent: Math.round((best.current / best.target) * 100) };
    }
  }
  // 4. Any Lv.1 village facility >= 65% wood+essence progress
  if (isFeatureUnlocked(profile, 'village')) {
    const closeFac = FACILITY_IDS
      .filter(id => !(profile.village?.facilities?.[id] ?? 0))
      .map(id => {
        const cost = FACILITIES[id].costs[0]!;
        const pct = Math.min(
          100,
          Math.round(((Math.min(profile.village.wood, cost.wood) + Math.min(profile.village.essence, cost.essence)) / Math.max(1, cost.wood + cost.essence)) * 100),
        );
        return { id: id as FacilityId, pct, have: profile.village.wood, need: cost.wood };
      })
      .filter(x => x.pct >= 65)
      .sort((a, b) => b.pct - a.pct);
    if (closeFac.length) {
      const best = closeFac[0];
      return { kind: 'village', id: best.id, current: best.have, target: best.need, percent: best.pct };
    }
  }
  // 5. Any unbrewed broth >= 65% ingredients progress
  if (isFeatureUnlocked(profile, 'kitchen')) {
    const closeBroth = BROTH_IDS
      .filter(id => !(profile.unlockedBroths ?? []).includes(id))
      .map(id => {
        const cost = BROTHS[id].costs[0];
        let have = 0, need = 0;
        for (const ing of INGREDIENT_IDS) {
          const req = cost[ing as IngredientId] ?? 0;
          if (!req) continue;
          need += req;
          have += Math.min(profile.ingredients?.[ing] ?? 0, req);
        }
        return { id, have, need, pct: Math.round((have / Math.max(1, need)) * 100) };
      })
      .filter(x => x.pct >= 65)
      .sort((a, b) => b.pct - a.pct);
    if (closeBroth.length) {
      const best = closeBroth[0];
      return { kind: 'kitchen', id: best.id, current: best.have, target: best.need, percent: best.pct };
    }
  }
  // 6. Fallback: show deep 3x speed progress if still locked
  if (nextFeat && nextFeat.id === 'speed3x') {
    return { kind: 'feature', id: 'speed3x', current: nextFeat.currentStars, target: nextFeat.targetStars, percent: Math.min(99, Math.round((nextFeat.currentStars / nextFeat.targetStars) * 100)) };
  }
  return null;
}

/** Developer helper: jumps a profile cleanly to onboarding node 0..8 for QA testing of every tutorial. */
export function buildDebugStageProfile(base: Profile, stage: number): Profile {
  const s = Math.max(0, Math.min(8, Math.trunc(stage)));
  const starsTable = [0, 1, 2, 5, 10, 16, 23, 32, 60];
  const matchesTable = [0, 1, 3, 6, 10, 16, 23, 30, 65];
  const targetStars = starsTable[s];
  const targetMatches = matchesTable[s];
  const order: readonly FeatureId[] = ['armory', 'speed2x', 'market', 'endless', 'village', 'kitchen', 'medallions', 'speed3x'];
  // Mark strictly earlier nodes done; leave the target node itself un-onboarded so its intro triggers right away!
  const doneBefore = order.slice(0, Math.max(0, s - 1)).flatMap(id => [`gift:${id}`, `done:${id}`]);
  if (s > 3) doneBefore.push('done:prop_battle');
  if (s > 4) doneBefore.push('done:endless_battle');
  return {
    ...base,
    stars: targetStars,
    highestStars: targetStars,
    matches: targetMatches,
    wins: targetMatches,
    tutorialCompleted: s > 0,
    tutorialRewardClaimed: s > 0,
    onboardedFeatures: doneBefore,
    rankTainted: true,
    bestEndlessWave: s >= 8 ? 25 : s >= 7 ? 14 : 0,
    village: s > 5 ? { ...base.village, facilities: { ...base.village.facilities, fac_bamboo_pool: Math.max(1, base.village.facilities.fac_bamboo_pool ?? 0) } } : { ...base.village, wood: 0, essence: 0, facilities: {} },
  };
}
