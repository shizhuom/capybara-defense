import { FRAGMENTS } from '../config/enemies';
import { HERO_FAMILIES, RARITY_RULES, WEAPONS, rollWeapon } from '../config/weapons';
import {
  PROPS,
  META_PRICES,
  PROP_RARITY_RULES,
  PROP_TRIAL_DURATION_MS,
  propBlueprintGoal,
  type PropDefinition,
  type PropRarity,
} from '../config/props';
import { HEROES } from '../config/heroes';
import { AVATARS, DEFAULT_AVATARS } from '../config/avatars';
import { BROTH_IDS, INGREDIENT_IDS, INGREDIENT_STACK_LIMIT, clampBrothLevel, isBrothId, isIngredientId } from '../config/kitchen';
import { FACILITY_IDS } from '../config/village';
import { copyVillage, createVillage, normalizeVillage } from './VillageState';
import { MEDALLION_IDS, MEDALLION_MAX_LEVEL } from '../config/medallions';
import { normalizeMedallions } from './MedallionProgression';
import { SESSION_PLAYER_ID, SESSION_WRITE_SECRET, normalizePlayerId, normalizeWriteSecret, validateNickname } from './PlayerIdentity';
import { isFictionalLocation, sanitizeLocation } from './Location';
import { HEROES as HERO_TABLE } from '../config/heroes';
import { DEFAULT_SETTINGS, getUnlockedMaps, unlockAchievements, updateSettings } from './PlayerProgression';
import { allOnboardedTokens, sanitizeOnboardedFeatures } from './FeatureUnlocks';
import type { Profile } from './types';

export interface MetaResult {
  profile: Profile;
  ok: boolean;
  key: string;
  amount?: number;
  newWeapons?: string[];
  newProps?: string[];
  convertedCoins?: number;
  trialExpiresAt?: number;
}
export type LotteryRarity = 0 | 1 | 2 | 3 | 4;
export interface LotteryPrize { type: 'prop' | 'coins' | 'fragment'; id?: string; amount: number }

/**
 * 8-slot gacha wheel rarity patterns (total weight = 12.5):
 *  - Pattern 1 (2.5 / 12.5 = 20%): 3 White, 3 Green, 2 Blue
 *  - Pattern 2 (9.0 / 12.5 = 72%): 3 White, 2 Green, 2 Blue, 1 Purple
 *  - Pattern 3 (1.0 / 12.5 =  8%): 2 White, 2 Green, 2 Blue, 1 Purple, 1 Orange
 * Each of the 8 slots wins with uniform 1/8 probability on spin.
 */
export const LOTTERY_PATTERNS: readonly {
  readonly id: 'common' | 'epic' | 'legendary';
  readonly weight: number;
  readonly rarities: readonly LotteryRarity[];
}[] = [
  { id: 'common', weight: 2.5, rarities: [0, 0, 0, 1, 1, 1, 2, 2] },
  { id: 'epic', weight: 9, rarities: [0, 0, 0, 1, 1, 2, 2, 3] },
  { id: 'legendary', weight: 1, rarities: [0, 0, 1, 1, 2, 2, 3, 4] },
];
export const LOTTERY_TOTAL_WEIGHT = 12.5;

export function getLotteryPrizeRarity(prize: LotteryPrize): LotteryRarity {
  if (prize.type === 'prop' && prize.id && has(PROPS, prize.id)) {
    return Math.max(0, Math.min(4, PROPS[prize.id].rarity)) as LotteryRarity;
  }
  if (prize.type === 'fragment' && prize.id && has(WEAPONS, prize.id)) {
    return Math.max(0, Math.min(4, WEAPONS[prize.id].rarity)) as LotteryRarity;
  }
  if (prize.type === 'coins') {
    return prize.amount >= 160 ? 2 : prize.amount >= 80 ? 1 : 0;
  }
  return 0;
}

export function rollLotteryPattern(random: () => number) {
  let roll = sample(random) * LOTTERY_TOTAL_WEIGHT;
  for (const pat of LOTTERY_PATTERNS) {
    roll -= pat.weight;
    if (roll < 0) return pat;
  }
  return LOTTERY_PATTERNS[LOTTERY_PATTERNS.length - 1];
}

const has = (object: object, key: string) => Object.hasOwn(object, key);
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
const unique = (ids: string[]) => [...new Set(ids)];
const sample = (random: () => number) => Math.max(0, Math.min(0.999999999999, Number(random()) || 0));
const choose = <T>(pool: T[], random: () => number): T => pool[Math.floor(sample(random) * pool.length)];

export function isPropPermanent(profile: Pick<Profile, 'ownedProps'>, id: string): boolean {
  return has(PROPS, id) && (profile.ownedProps[id] ?? 0) >= PROPS[id].maxLevel;
}

export function getPropTrialRemainingMs(profile: Pick<Profile, 'ownedProps' | 'trialProps'>, id: string, now = Date.now()): number {
  if (!has(PROPS, id) || isPropPermanent(profile, id)) return 0;
  const expiresAt = profile.trialProps?.[id] ?? 0;
  return Number.isFinite(expiresAt) && expiresAt > now ? Math.trunc(expiresAt - now) : 0;
}

export function isPropUsable(profile: Pick<Profile, 'ownedProps' | 'trialProps'>, id: string, now = Date.now()): boolean {
  return isPropPermanent(profile, id) || getPropTrialRemainingMs(profile, id, now) > 0;
}

export function getPropBlueprintCount(profile: Pick<Profile, 'ownedProps' | 'propBlueprints'>, id: string): number {
  if (!has(PROPS, id)) return 0;
  if (isPropPermanent(profile, id)) return propBlueprintGoal(id);
  return Math.min(propBlueprintGoal(id), count(profile.propBlueprints?.[id]));
}

/** Removes expired 24-hour trials and unequips any prop that is no longer usable. Returns the same reference when unchanged. */
export function pruneExpiredTrials(profile: Profile, now = Date.now()): Profile {
  const trials = profile.trialProps ?? {};
  let changed = false;
  const nextTrials: Record<string, number> = {};
  for (const [id, expiresAt] of Object.entries(trials)) {
    if (has(PROPS, id) && !isPropPermanent(profile, id) && Number.isFinite(expiresAt) && expiresAt > now) {
      nextTrials[id] = Math.trunc(expiresAt);
    } else {
      changed = true;
    }
  }
  const usable = (id: string) => isPropPermanent(profile, id) || (nextTrials[id] ?? 0) > now;
  const nextActive = profile.equippedActiveProps.filter(usable);
  const nextPassive = profile.equippedPassiveProps.filter(usable);
  if (nextActive.length !== profile.equippedActiveProps.length || nextPassive.length !== profile.equippedPassiveProps.length) {
    changed = true;
  }
  if (!changed) return profile;
  const p = copy(profile);
  p.trialProps = nextTrials;
  p.equippedActiveProps = nextActive;
  p.equippedPassiveProps = nextPassive;
  return p;
}

const copy = (profile: Profile): Profile => ({
  ...profile,
  fragments: [...profile.fragments],
  awardedBattles: [...profile.awardedBattles],
  weaponFragments: { ...profile.weaponFragments },
  unlockedWeapons: [...profile.unlockedWeapons],
  equippedWeapons: { ...profile.equippedWeapons },
  ownedProps: { ...profile.ownedProps },
  propBlueprints: { ...(profile.propBlueprints ?? {}) },
  trialProps: { ...(profile.trialProps ?? {}) },
  equippedActiveProps: [...profile.equippedActiveProps],
  equippedPassiveProps: [...profile.equippedPassiveProps],
  unlockedAvatars: [...profile.unlockedAvatars],
  mergedHeroes: [...profile.mergedHeroes],
  settings: { ...profile.settings },
  shop: profile.shop
    ? {
        day: profile.shop.day,
        offers: [...profile.shop.offers],
        ...(profile.shop.bought?.length ? { bought: [...profile.shop.bought] } : {}),
      }
    : null,
  lottery: profile.lottery ? { day: profile.lottery.day, prizes: profile.lottery.prizes.map(pr => ({ ...pr })) } : null,
  ingredients: { ...(profile.ingredients ?? {}) },
  unlockedBroths: [...(profile.unlockedBroths ?? [])],
  brothLevels: { ...(profile.brothLevels ?? {}) },
  activeBrothId: profile.activeBrothId ?? null,
  village: profile.village ? copyVillage(profile.village) : createVillage(),
  endlessMedallions: normalizeMedallions(profile.endlessMedallions),
  onboardedFeatures: [...(profile.onboardedFeatures ?? [])],
  gachaWinCounter: profile.gachaWinCounter ?? 0,
  ...(profile.stamina !== undefined ? { stamina: profile.stamina } : {}),
  ...(profile.staminaUpdatedAt !== undefined ? { staminaUpdatedAt: profile.staminaUpdatedAt } : {}),
  ...(profile.adDaily ? { adDaily: { day: profile.adDaily.day, counts: { ...profile.adDaily.counts } } } : {}),
});

const fail = (profile: Profile, key: string): MetaResult => ({ profile: copy(profile), ok: false, key });
const success = (profile: Profile, key: string, amount?: number): MetaResult => ({
  profile: unlockAchievements(profile),
  ok: true,
  key,
  ...(amount === undefined ? {} : { amount }),
});

export function createProfile(): Profile {
  return {
    coins: 0, wins: 0, matches: 0, fragments: [], awardedBattles: [], schemaVersion: 2,
    tutorialCompleted: false, tutorialRewardClaimed: false, earlyWaveTipSeen: false, bestEndlessWave: 0,
    weaponFragments: {}, unlockedWeapons: [], equippedWeapons: {},
    ownedProps: {}, propBlueprints: {}, trialProps: {},
    equippedActiveProps: [], equippedPassiveProps: [], freeLotteryTickets: 0, shop: null, lottery: null,
    stars: 0, highestStars: 0, winStreak: 0, bestWinStreak: 0, selectedMap: 'auto', avatarId: 'capybara',
    unlockedAvatars: [...DEFAULT_AVATARS], mergedHeroes: [], settings: { ...DEFAULT_SETTINGS },
    // P19: ingredients, village materials & crests are gifted on each system's unlock milestone.
    ingredients: { ...STARTER_INGREDIENTS }, unlockedBroths: [], brothLevels: {}, activeBrothId: null,
    village: createVillage(),
    endlessCrests: 0, endlessMedallions: normalizeMedallions(null),
    playerId: SESSION_PLAYER_ID, writeSecret: SESSION_WRITE_SECRET, nickname: '', locationMode: 'unset', locationLabel: '',
    onboardedFeatures: [], gachaWinCounter: 0,
  };
}

/** P19: starter kitchen ingredients are granted interactively when Kitchen unlocks at 23★. */
export const STARTER_INGREDIENTS: Readonly<Record<string, number>> = Object.freeze({});

function normalizeKitchen(p: Profile, data: Record<string, unknown>): void {
  if (has(data, 'ingredients')) {
    const stock = Object.entries(object(data.ingredients)).filter(([id, n]) => isIngredientId(id) && count(n) > 0);
    p.ingredients = Object.fromEntries(stock.map(([id, n]) => [id, Math.min(INGREDIENT_STACK_LIMIT, count(n))]));
  }
  p.unlockedBroths = unique(strings(data.unlockedBroths).filter(isBrothId));
  const levels = object(data.brothLevels);
  p.brothLevels = Object.fromEntries(p.unlockedBroths.map(id => [id, clampBrothLevel(levels[id])]));
  p.activeBrothId = typeof data.activeBrothId === 'string' && p.unlockedBroths.includes(data.activeBrothId) ? data.activeBrothId : null;
}

/** P17 fields are optional in old saves: zero crests, Lv.0 medallions, a fresh id/secret and the default nickname. */
function normalizeEndless(p: Profile, data: Record<string, unknown>): void {
  p.endlessCrests = count(data.endlessCrests);
  p.endlessMedallions = normalizeMedallions(data.endlessMedallions);
  p.playerId = normalizePlayerId(data.playerId);
  p.writeSecret = normalizeWriteSecret(data.writeSecret);
  const name = validateNickname(data.nickname); p.nickname = name.ok ? name.value : '';
  const loc = sanitizeLocation(data.locationLabel);
  if (data.locationMode === 'real' && loc && !isFictionalLocation(loc)) { p.locationMode = 'real'; p.locationLabel = loc; }
  else if (data.locationMode === 'fictional') { p.locationMode = 'fictional'; p.locationLabel = isFictionalLocation(loc) ? loc : ''; }
  else { p.locationMode = 'unset'; p.locationLabel = ''; }
  if (data.rankTainted === true) p.rankTainted = true;
  if ((p.bestEndlessWave ?? 0) >= 11) {
    const time = data.bestEndlessTime, awakened = data.bestEndlessAwakened, mvp = data.bestEndlessMvp;
    if (typeof time === 'number' && Number.isSafeInteger(time) && time >= 0 && time <= 864_000) p.bestEndlessTime = time;
    if (typeof mvp === 'string' && has(HERO_TABLE, mvp)) p.bestEndlessMvp = mvp;
    if (p.bestEndlessMvp && data.bestEndlessMvpAwakened === true) p.bestEndlessMvpAwakened = true;
    if (typeof awakened === 'number' && Number.isSafeInteger(awakened) && awakened >= 0 && awakened <= 40) p.bestEndlessAwakened = awakened;
  }
}

export function normalizeProfile(raw: unknown): Profile {
  const data = object(raw);
  const p = createProfile();
  p.coins = count(data.coins);
  p.matches = count(data.matches);
  p.wins = Math.min(count(data.wins), p.matches);
  p.tutorialCompleted = typeof data.tutorialCompleted === 'boolean' ? data.tutorialCompleted : p.matches > 0;
  p.tutorialRewardClaimed = typeof data.tutorialRewardClaimed === 'boolean' ? data.tutorialRewardClaimed : p.matches > 0 || p.tutorialCompleted;
  p.earlyWaveTipSeen = data.earlyWaveTipSeen === true;
  p.bestEndlessWave = count(data.bestEndlessWave) >= 11 ? count(data.bestEndlessWave) : 0;
  p.stars = has(data, 'stars') ? count(data.stars) : p.wins;
  p.highestStars = Math.max(p.stars, count(data.highestStars));
  p.winStreak = count(data.winStreak);
  p.bestWinStreak = Math.max(p.winStreak, count(data.bestWinStreak));
  p.unlockedAvatars = unique([...DEFAULT_AVATARS, ...strings(data.unlockedAvatars).filter(id => has(AVATARS, id))]);
  p.avatarId = typeof data.avatarId === 'string' ? data.avatarId : 'capybara';
  p.mergedHeroes = unique(strings(data.mergedHeroes).filter(id => has(HEROES, id)));
  p.settings = updateSettings(p, object(data.settings)).settings;
  const selectedMap = data.selectedMap;
  if (selectedMap === 'auto' || getUnlockedMaps(p).some(id => id === selectedMap)) p.selectedMap = selectedMap as Profile['selectedMap'];
  const validLegacy = new Set<string>(FRAGMENTS);
  p.fragments = strings(data.fragments).filter(id => validLegacy.has(id));
  p.awardedBattles = unique(strings(data.awardedBattles).filter(id => id.length > 0 && id.length < 200)).slice(-200);
  p.weaponFragments = Object.fromEntries(Object.entries(object(data.weaponFragments)).filter(([id, n]) => has(WEAPONS, id) && count(n) > 0).map(([id, n]) => [id, count(n)]));
  if (data.schemaVersion !== 2 && p.fragments.length) p.weaponFragments.m01_swatter = (p.weaponFragments.m01_swatter ?? 0) + p.fragments.length;
  p.unlockedWeapons = unique(strings(data.unlockedWeapons).filter(id => has(WEAPONS, id)));
  for (const weapon of Object.values(WEAPONS)) {
    if ((p.weaponFragments[weapon.id] ?? 0) >= RARITY_RULES[weapon.rarity].fragments && !p.unlockedWeapons.includes(weapon.id)) p.unlockedWeapons.push(weapon.id);
  }
  const used = new Set<string>();
  for (const [hero, id] of Object.entries(object(data.equippedWeapons))) {
    if (typeof id === 'string' && has(HERO_FAMILIES, hero) && has(WEAPONS, id) && p.unlockedWeapons.includes(id) && WEAPONS[id].family === HERO_FAMILIES[hero] && !used.has(id)) {
      p.equippedWeapons[hero] = id; used.add(id);
    }
  }
  p.ownedProps = Object.fromEntries(
    Object.entries(object(data.ownedProps))
      .filter(([id, n]) => has(PROPS, id) && count(n) > 0)
      .map(([id, n]) => [id, Math.min(count(n), PROPS[id].maxLevel)]),
  );
  const rawBlueprints = object(data.propBlueprints);
  const blueprints: Record<string, number> = {};
  for (const [id, n] of Object.entries(rawBlueprints)) {
    if (!has(PROPS, id)) continue;
    const c = count(n);
    if (c <= 0) continue;
    const goal = propBlueprintGoal(id);
    blueprints[id] = Math.min(c, goal);
    if (c >= goal && (p.ownedProps[id] ?? 0) < PROPS[id].maxLevel) {
      p.ownedProps[id] = PROPS[id].maxLevel;
    }
  }
  p.propBlueprints = blueprints;

  const rawTrials = object(data.trialProps);
  const trials: Record<string, number> = {};
  for (const [id, ts] of Object.entries(rawTrials)) {
    if (!has(PROPS, id) || isPropPermanent(p, id)) continue;
    if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) {
      trials[id] = Math.trunc(ts);
    }
  }
  p.trialProps = trials;

  const hasOwnedOrTrial = (id: string) => (p.ownedProps[id] ?? 0) > 0 || (p.trialProps?.[id] ?? 0) > 0;
  const slots = (value: unknown, type: 'active' | 'passive', max: number) =>
    unique(strings(value)).filter(id => has(PROPS, id) && PROPS[id].type === type && hasOwnedOrTrial(id)).slice(0, max);
  p.equippedActiveProps = slots(data.equippedActiveProps, 'active', 2);
  p.equippedPassiveProps = slots(data.equippedPassiveProps, 'passive', 6);
  p.freeLotteryTickets = count(data.freeLotteryTickets);

  const shop = object(data.shop);
  if (typeof shop.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(shop.day)) {
    const offers = unique(strings(shop.offers).filter(id => has(PROPS, id) && !isPropPermanent(p, id))).slice(0, 3);
    const bought = unique(strings(shop.bought).filter(id => offers.includes(id)));
    p.shop = { day: shop.day, offers, ...(bought.length ? { bought } : {}) };
  }
  const lot = object(data.lottery);
  if (typeof lot.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lot.day) && Array.isArray(lot.prizes) && lot.prizes.length === 8) {
    const parsed = lot.prizes.map(item => {
      const o = object(item);
      const type = o.type === 'prop' || o.type === 'coins' || o.type === 'fragment' ? o.type : null;
      const amount = count(o.amount);
      const id = typeof o.id === 'string' ? o.id : undefined;
      return type ? ({ type, ...(id !== undefined ? { id } : {}), amount } as LotteryPrize) : null;
    });
    if (parsed.every((pr): pr is LotteryPrize => Boolean(pr && isValidLotteryPrize(pr)))) {
      p.lottery = { day: lot.day, prizes: parsed };
    }
  }
  normalizeKitchen(p, data);
  p.village = normalizeVillage(data.village);
  normalizeEndless(p, data);
  p.onboardedFeatures = sanitizeOnboardedFeatures(data.onboardedFeatures);
  if (data.onboardedFeatures === undefined) {
    const backfilled = new Set(p.onboardedFeatures);
    if (Object.keys(p.equippedWeapons).length > 0) { backfilled.add('gift:armory'); backfilled.add('done:armory'); }
    if (Object.keys(p.ownedProps).length > 0) { backfilled.add('gift:market'); backfilled.add('done:market'); backfilled.add('done:prop_battle'); }
    if (Object.keys(p.village.facilities).length > 0) { backfilled.add('gift:village'); backfilled.add('done:village'); }
    if (p.unlockedBroths.length > 0) { backfilled.add('gift:kitchen'); backfilled.add('done:kitchen'); }
    if (Object.values(p.endlessMedallions).some(lv => lv > 0) || p.endlessCrests > 0) { backfilled.add('gift:medallions'); backfilled.add('done:medallions'); }
    if ((p.bestEndlessWave ?? 0) >= 11) { backfilled.add('done:endless'); backfilled.add('done:endless_battle'); }
    p.onboardedFeatures = [...backfilled];
  }
  p.gachaWinCounter = Math.min(2, count(data.gachaWinCounter));
  if (has(data, 'stamina') && typeof data.stamina === 'number' && Number.isFinite(data.stamina) && data.stamina >= 0) {
    p.stamina = Math.min(99, Math.trunc(data.stamina));
  }
  if (has(data, 'staminaUpdatedAt') && typeof data.staminaUpdatedAt === 'number' && Number.isFinite(data.staminaUpdatedAt) && data.staminaUpdatedAt > 0) {
    p.staminaUpdatedAt = Math.trunc(data.staminaUpdatedAt);
  }
  const adDaily = object(data.adDaily);
  if (typeof adDaily.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(adDaily.day)) {
    const rawCounts = object(adDaily.counts);
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawCounts)) {
      if (/^[a-z0-9_]{1,32}$/.test(k) && count(v) > 0) counts[k] = Math.min(99, count(v));
    }
    p.adDaily = { day: adDaily.day, counts };
  }
  return unlockAchievements(p);
}

export function grantWeaponFragments(profile: Profile, ids: string[]): { profile: Profile; newWeapons: string[] } {
  const p = copy(profile);
  const newWeapons: string[] = [];
  for (const id of ids) {
    if (!has(WEAPONS, id)) continue;
    p.weaponFragments[id] = (p.weaponFragments[id] ?? 0) + 1;
    if (!p.unlockedWeapons.includes(id) && p.weaponFragments[id] >= RARITY_RULES[WEAPONS[id].rarity].fragments) {
      p.unlockedWeapons.push(id);
      newWeapons.push(id);
    }
  }
  return { profile: unlockAchievements(p), newWeapons };
}

/**
 * Grants prop blueprints toward permanent unlock (`ownedProps[id] = 1`).
 * Reaching a prop's blueprint goal immediately unlocks it permanently, clears any trial timer,
 * and replaces it if it was sitting on today's Daily Deals shelf.
 * Overflow blueprints beyond permanent ownership automatically convert into coins.
 */
export function grantPropBlueprints(
  profile: Profile,
  ids: readonly string[],
): { profile: Profile; newProps: string[]; overflowCoins: number } {
  const p = copy(profile);
  const newProps: string[] = [];
  let overflowCoins = 0;
  for (const id of ids) {
    if (!has(PROPS, id)) continue;
    const def = PROPS[id];
    const rule = PROP_RARITY_RULES[def.rarity];
    if (isPropPermanent(p, id)) {
      overflowCoins += rule.blueprintOverflowCoins;
      p.coins += rule.blueprintOverflowCoins;
      continue;
    }
    const nextCount = (p.propBlueprints![id] ?? 0) + 1;
    if (nextCount >= rule.blueprints) {
      p.propBlueprints![id] = rule.blueprints;
      p.ownedProps[id] = def.maxLevel;
      delete p.trialProps![id];
      if (!newProps.includes(id)) newProps.push(id);
      replaceCappedShopOffer(p, id);
    } else {
      p.propBlueprints![id] = nextCount;
    }
  }
  return { profile: unlockAchievements(p), newProps, overflowCoins };
}

export function equipWeapon(profile: Profile, heroId: string, weaponId: string | null): MetaResult {
  if (!has(HERO_FAMILIES, heroId)) return fail(profile, 'meta.invalidHero');
  if (weaponId === null) { const p = copy(profile); delete p.equippedWeapons[heroId]; return success(p, 'meta.unequipped'); }
  if (!has(WEAPONS, weaponId)) return fail(profile, 'meta.invalidWeapon');
  if (!profile.unlockedWeapons.includes(weaponId)) return fail(profile, 'meta.weaponLocked');
  if (WEAPONS[weaponId].family !== HERO_FAMILIES[heroId]) return fail(profile, 'meta.wrongFamily');
  const p = copy(profile);
  for (const [hero, id] of Object.entries(p.equippedWeapons)) if (id === weaponId) delete p.equippedWeapons[hero];
  p.equippedWeapons[heroId] = weaponId;
  return success(p, 'meta.equipped');
}

export function recycleFragments(profile: Profile, rarities: number[]): MetaResult {
  const p = copy(profile);
  let amount = 0;
  for (const id of p.unlockedWeapons) {
    const weapon = WEAPONS[id]; if (!weapon || !rarities.includes(weapon.rarity)) continue;
    const rule = RARITY_RULES[weapon.rarity]; const surplus = Math.max(0, (p.weaponFragments[id] ?? 0) - rule.fragments);
    if (surplus) { amount += surplus * rule.recycle; p.weaponFragments[id] -= surplus; }
  }
  if (!amount) return fail(profile, 'meta.noFragments');
  p.coins += amount;
  return success(p, 'meta.recycled', amount);
}

export function setPropSlots(profile: Profile, active: string[], passive: string[], now = Date.now()): MetaResult {
  const cleaned = pruneExpiredTrials(profile, now);
  const valid = (ids: string[], type: 'active' | 'passive', max: number) =>
    ids.length <= max && unique(ids).length === ids.length && ids.every(id => has(PROPS, id) && PROPS[id].type === type && isPropUsable(cleaned, id, now));
  if (!valid(active, 'active', 2) || !valid(passive, 'passive', 6)) return fail(profile, 'meta.invalidSlots');
  const p = copy(cleaned);
  p.equippedActiveProps = [...active];
  p.equippedPassiveProps = [...passive];
  return success(p, 'meta.equipped');
}

export function equipProp(profile: Profile, id: string, now = Date.now()): MetaResult {
  if (!has(PROPS, id)) return fail(profile, 'meta.invalidProp');
  const cleaned = pruneExpiredTrials(profile, now);
  if (!isPropUsable(cleaned, id, now)) return fail(cleaned, 'meta.propNotOwned');
  const key = PROPS[id].type === 'active' ? 'equippedActiveProps' : 'equippedPassiveProps';
  const max = PROPS[id].type === 'active' ? 2 : 6;
  const p = copy(cleaned);
  const equipped = p[key].includes(id);
  if (equipped) p[key] = p[key].filter(item => item !== id);
  else if (p[key].length >= max) return fail(cleaned, 'meta.slotsFull');
  else p[key].push(id);
  return success(p, equipped ? 'meta.unequipped' : 'meta.equipped');
}

/** Picks one prop from `pool` weighted by rarity (Green 4 : Blue 3 : Purple 2 : Orange 1). */
export function rollShopProp(pool: readonly PropDefinition[], random: () => number): PropDefinition | null {
  if (!pool.length) return null;
  const buckets: Record<PropRarity, PropDefinition[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const prop of pool) buckets[prop.rarity].push(prop);
  const rarities = ([1, 2, 3, 4] as const).filter(r => buckets[r].length > 0);
  const totalWeight = rarities.reduce((sum, r) => sum + PROP_RARITY_RULES[r].shopWeight, 0);
  let roll = sample(random) * totalWeight;
  let chosenRarity = rarities[rarities.length - 1];
  for (const r of rarities) {
    roll -= PROP_RARITY_RULES[r].shopWeight;
    if (roll < 0) {
      chosenRarity = r;
      break;
    }
  }
  return choose(buckets[chosenRarity], random);
}

function shopOffers(profile: Profile, random: () => number): string[] {
  let pool = Object.values(PROPS).filter(p => !isPropPermanent(profile, p.id));
  const offers: string[] = [];
  while (pool.length && offers.length < 3) {
    const picked = rollShopProp(pool, random);
    if (!picked) break;
    offers.push(picked.id);
    pool = pool.filter(p => p.id !== picked.id);
  }
  return offers;
}

export function ensureDailyShop(profile: Profile, day: string, random: () => number, now = Date.now()): Profile {
  const p = copy(pruneExpiredTrials(profile, now));
  if (p.shop?.day === day) return unlockAchievements(p);
  p.shop = { day, offers: shopOffers(p, random) };
  return unlockAchievements(p);
}

export function refreshShop(profile: Profile, day: string, random: () => number, now = Date.now()): MetaResult {
  if (profile.coins < META_PRICES.shopRefresh) return fail(profile, 'meta.insufficientCoins');
  if (!Object.values(PROPS).some(p => !isPropPermanent(profile, p.id))) return fail(profile, 'meta.shopEmpty');
  const p = copy(pruneExpiredTrials(profile, now));
  p.coins -= META_PRICES.shopRefresh;
  p.shop = { day, offers: shopOffers(p, random) };
  return success(p, 'meta.shopRefreshed', -META_PRICES.shopRefresh);
}

/** Replace one newly permanently-unlocked item without rerolling the other shelf slots. */
function replaceCappedShopOffer(profile: Profile, id: string): void {
  const shop = profile.shop;
  if (!shop || !isPropPermanent(profile, id) || !shop.offers.includes(id)) return;
  const replacement = Object.values(PROPS).find(prop => !isPropPermanent(profile, prop.id) && !shop.offers.includes(prop.id));
  shop.offers = shop.offers.flatMap(offer => offer === id ? (replacement ? [replacement.id] : []) : [offer]);
  if (shop.bought) {
    const nextBought = shop.bought.filter(item => item !== id && shop.offers.includes(item));
    if (nextBought.length) shop.bought = nextBought;
    else delete shop.bought;
  }
}

/**
 * Purchases a 24-hour trial from today's Daily Deals shelf (+1 blueprint toward permanent unlock).
 * Completing the blueprint threshold permanently unlocks the prop and refills that shelf slot.
 */
export function buyProp(profile: Profile, id: string, now = Date.now()): MetaResult {
  if (!has(PROPS, id)) return fail(profile, 'meta.invalidProp');
  const definition = PROPS[id];
  if (isPropPermanent(profile, id)) return fail(profile, 'meta.propMaxLevel');
  if (!profile.shop?.offers.includes(id)) return fail(profile, 'meta.propNotOffered');
  if (profile.shop.bought?.includes(id)) return fail(profile, 'meta.trialAlreadyBought');
  if (profile.coins < definition.price) return fail(profile, 'meta.insufficientCoins');

  let p = copy(pruneExpiredTrials(profile, now));
  p.coins -= definition.price;

  // Grant +1 blueprint toward permanent unlock first.
  const granted = grantPropBlueprints(p, [id]);
  p = granted.profile;
  if (granted.newProps.includes(id)) {
    return {
      ...success(p, 'meta.propUnlocked', -definition.price),
      newProps: [id],
    };
  }

  // Still collecting blueprints: activate/extend 24-hour trial & mark this shelf offer as claimed.
  const baseExpiry = Math.max(now, p.trialProps![id] ?? 0);
  const expiresAt = baseExpiry + PROP_TRIAL_DURATION_MS;
  p.trialProps![id] = expiresAt;
  if (p.shop) {
    p.shop.bought = unique([...(p.shop.bought ?? []), id]);
  }
  return {
    ...success(p, 'meta.trialPurchased', -definition.price),
    newProps: [],
    trialExpiresAt: expiresAt,
  };
}

export function createLotteryPrizes(profile: Profile, random: () => number): LotteryPrize[] {
  const pattern = rollLotteryPattern(random);
  const usedProps = new Set<string>(), usedWeapons = new Set<string>(), usedCoins = new Set<number>();
  const seen = [0, 0, 0, 0, 0];
  const pickProp = (rarity: PropRarity): LotteryPrize | undefined => {
    const pool = Object.values(PROPS).filter(p => p.rarity === rarity && !usedProps.has(p.id)).map(p => p.id);
    if (!pool.length) return undefined;
    const id = choose(pool, random);
    usedProps.add(id);
    return { type: 'prop', id, amount: PROP_RARITY_RULES[rarity].lotteryBlueprints };
  };
  const pickWeapon = (rarity: number): string => {
    const rolled = rollWeapon(random, [rarity], 1, profile.unlockedWeapons);
    if (!usedWeapons.has(rolled)) { usedWeapons.add(rolled); return rolled; }
    const pool = Object.values(WEAPONS).filter(w => w.rarity === rarity && !usedWeapons.has(w.id)).map(w => w.id);
    const id = pool.length ? choose(pool, random) : rolled;
    usedWeapons.add(id);
    return id;
  };
  const prizes: LotteryPrize[] = pattern.rarities.map(rarity => {
    const nth = seen[rarity]++;
    if (rarity === 0) {
      if (nth >= 2 && !usedCoins.has(40)) { usedCoins.add(40); return { type: 'coins', amount: 40 }; }
      if (nth === 1 && !usedCoins.has(40) && pattern.id === 'legendary' && sample(random) < 0.6) { usedCoins.add(40); return { type: 'coins', amount: 40 }; }
      return { type: 'fragment', id: pickWeapon(0), amount: 1 };
    }
    if (rarity === 1) {
      if (nth === 0) { const pr = pickProp(1); if (pr) return pr; }
      if (!usedCoins.has(80) && (nth === 1 ? sample(random) < 0.55 : sample(random) < 0.45)) { usedCoins.add(80); return { type: 'coins', amount: 80 }; }
      if (sample(random) < 0.5) { const pr = pickProp(1); if (pr) return pr; }
      return { type: 'fragment', id: pickWeapon(1), amount: 1 };
    }
    if (rarity === 2) {
      if (nth === 0) { const pr = pickProp(2); if (pr) return pr; }
      if (!usedCoins.has(160) && sample(random) < 0.5) { usedCoins.add(160); return { type: 'coins', amount: 160 }; }
      return { type: 'fragment', id: pickWeapon(2), amount: 1 };
    }
    if (rarity === 3) {
      if (sample(random) < 0.5) { const pr = pickProp(3); if (pr) return pr; }
      return { type: 'fragment', id: pickWeapon(3), amount: 1 };
    }
    // rarity === 4 (Orange Legendary)
    if (sample(random) < 0.35) { const pr = pickProp(4); if (pr) return pr; }
    return { type: 'fragment', id: pickWeapon(4), amount: 1 };
  });
  for (let i = prizes.length - 1; i > 0; i--) {
    const j = Math.floor(sample(random) * (i + 1));
    const tmp = prizes[i]; prizes[i] = prizes[j]; prizes[j] = tmp;
  }
  return prizes;
}

export function isValidLotteryPrize(prize: LotteryPrize): boolean {
  return Boolean(prize) && Number.isSafeInteger(prize.amount) && prize.amount > 0 &&
    (prize.type === 'coins'
      ? [40, 80, 160].includes(prize.amount)
      : prize.type === 'prop'
        ? typeof prize.id === 'string' && has(PROPS, prize.id) && prize.amount >= 1 && prize.amount <= 5
        : prize.type === 'fragment' && typeof prize.id === 'string' && has(WEAPONS, prize.id) && prize.amount === 1);
}

/** Persists the current 8-slot wheel across restarts/actions; resets automatically once per new calendar day. */
export function ensureDailyLottery(profile: Profile, day: string, random: () => number): Profile {
  if (profile.lottery && profile.lottery.day === day && profile.lottery.prizes.length === 8 && profile.lottery.prizes.every(isValidLotteryPrize)) {
    return unlockAchievements(copy(profile));
  }
  const p = copy(profile);
  p.lottery = { day, prizes: createLotteryPrizes(p, random) };
  return unlockAchievements(p);
}

export type LotteryPayment = 'auto' | 'ticket' | 'coins';

export function spinLottery(
  profile: Profile,
  prizes: LotteryPrize[],
  random: () => number,
  payment: LotteryPayment = 'auto',
  day?: string,
  now = Date.now(),
): MetaResult & { prize?: LotteryPrize; index?: number } {
  if (prizes.length !== 8 || !prizes.every(isValidLotteryPrize)) return fail(profile, 'meta.invalidPrizes');
  const useTicket = payment === 'ticket' || (payment === 'auto' && profile.freeLotteryTickets > 0);
  if (useTicket && profile.freeLotteryTickets <= 0) return fail(profile, 'p9.noTickets');
  if (!useTicket && profile.coins < META_PRICES.lottery) return fail(profile, 'meta.insufficientCoins');
  let p = copy(pruneExpiredTrials(profile, now));
  if (useTicket) p.freeLotteryTickets--; else p.coins -= META_PRICES.lottery;
  const index = Math.floor(sample(random) * prizes.length);
  const prize = { ...prizes[index] };
  let newWeapons: string[] = [];
  let newProps: string[] = [];
  let convertedCoins: number | undefined;
  let trialExpiresAt: number | undefined;

  if (prize.type === 'coins') {
    p.coins += prize.amount;
  } else if (prize.type === 'prop') {
    const id = prize.id!;
    const rule = PROP_RARITY_RULES[PROPS[id].rarity];
    if (isPropPermanent(p, id)) {
      convertedCoins = rule.lotteryOverflowCoins;
      p.coins += convertedCoins;
    } else {
      const granted = grantPropBlueprints(p, Array.from({ length: prize.amount }, () => id));
      p = granted.profile;
      newProps = granted.newProps;
      if (granted.overflowCoins > 0) convertedCoins = granted.overflowCoins;
      if (!isPropPermanent(p, id)) {
        const baseExpiry = Math.max(now, p.trialProps![id] ?? 0);
        trialExpiresAt = baseExpiry + PROP_TRIAL_DURATION_MS;
        p.trialProps![id] = trialExpiresAt;
      }
    }
  } else {
    const granted = grantWeaponFragments(p, [prize.id!]);
    p = granted.profile;
    newWeapons = granted.newWeapons;
  }
  const nextDay = day ?? p.lottery?.day;
  if (nextDay) p.lottery = { day: nextDay, prizes: createLotteryPrizes(p, random) };
  return {
    ...success(p, 'meta.lotteryWon'),
    prize,
    index,
    newWeapons,
    newProps,
    ...(convertedCoins !== undefined ? { convertedCoins } : {}),
    ...(trialExpiresAt !== undefined ? { trialExpiresAt } : {}),
  };
}

export function unlockAllProfile(profile: Profile): Profile {
  const p = copy(profile);
  p.coins = 9999;
  p.unlockedWeapons = Object.keys(WEAPONS);
  p.tutorialCompleted = true;
  p.tutorialRewardClaimed = true;
  p.rankTainted = true;
  p.stars = Math.max(180, p.stars);
  p.highestStars = Math.max(p.highestStars, p.stars);
  p.matches = Math.max(30, p.matches);
  p.onboardedFeatures = allOnboardedTokens();
  p.unlockedAvatars = Object.keys(AVATARS);
  p.mergedHeroes = Object.keys(HEROES);
  p.equippedWeapons = {};
  for (const weapon of Object.values(WEAPONS)) {
    p.weaponFragments[weapon.id] = Math.max(p.weaponFragments[weapon.id] ?? 0, RARITY_RULES[weapon.rarity].fragments);
    if (weapon.signatureHero) p.equippedWeapons[weapon.signatureHero] = weapon.id;
  }
  p.ownedProps = Object.fromEntries(Object.values(PROPS).map(prop => [prop.id, prop.maxLevel]));
  p.propBlueprints = Object.fromEntries(Object.values(PROPS).map(prop => [prop.id, propBlueprintGoal(prop.id)]));
  p.trialProps = {};
  p.equippedActiveProps = ['washer', 'clay'];
  p.equippedPassiveProps = ['gold_doge', 'auto_shovel', 'giant_orange_cat', 'vip_poster', 'extra_oranges', 'promo_badge'];
  if (p.shop) p.shop.offers = [];
  p.unlockedBroths = [...BROTH_IDS];
  p.brothLevels = Object.fromEntries(BROTH_IDS.map(id => [id, 3]));
  p.ingredients = Object.fromEntries(INGREDIENT_IDS.map(id => [id, 99]));
  p.activeBrothId = profile.activeBrothId ?? null;
  p.village = { ...p.village, wood: 99, essence: 99, facilities: Object.fromEntries(FACILITY_IDS.map(id => [id, 3])), lastHarvestAt: Date.now() - 6 * 3600_000 };
  p.endlessMedallions = Object.fromEntries(MEDALLION_IDS.map(id => [id, MEDALLION_MAX_LEVEL]));
  p.endlessCrests = Math.max(99_999, p.endlessCrests);
  return unlockAchievements(p);
}
