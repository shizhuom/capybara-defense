import { describe, expect, it } from 'vitest';
import {
  META_PRICES,
  PROPS,
  PROP_RARITY_RULES,
  PROP_TRIAL_DURATION_MS,
  propBlueprintGoal,
  rollPropBlueprint,
} from '../src/config/props';
import {
  buyProp,
  createProfile,
  equipProp,
  getPropBlueprintCount,
  getPropTrialRemainingMs,
  grantPropBlueprints,
  isPropPermanent,
  isPropUsable,
  pruneExpiredTrials,
  refreshShop,
  rollShopProp,
} from '../src/core/MetaProgression';
import { BattleEngine } from '../src/core/BattleEngine';
import { villageLoadout } from '../src/core/VillageProgression';
import { computeNextGoalHook } from '../src/core/FeatureUnlocks';
import { awardBattle, awardEndless } from '../src/ui/storage';

describe('Prop trial & blueprint permanent unlock system (Plan B)', () => {
  it('enforces exact new rarity tiers across all 8 active and 12 passive props', () => {
    const byRarity = (type: 'active' | 'passive', rarity: 1 | 2 | 3 | 4) =>
      Object.values(PROPS).filter(p => p.type === type && p.rarity === rarity).map(p => p.id).sort();

    expect(byRarity('active', 1)).toEqual(['expired_can', 'glue_trap']);
    expect(byRarity('active', 2)).toEqual(['recycle_bin', 'whistle']);
    expect(byRarity('active', 3)).toEqual(['catnip', 'milk_bottle']);
    expect(byRarity('active', 4)).toEqual(['clay', 'washer']);

    expect(byRarity('passive', 1)).toEqual(['extra_oranges', 'hyper_party', 'promo_badge']);
    expect(byRarity('passive', 2)).toEqual(['banana_peel', 'bee_overtime', 'shared_oranges', 'tall_perch']);
    expect(byRarity('passive', 3)).toEqual(['auto_shovel', 'giant_orange_cat', 'gold_doge']);
    expect(byRarity('passive', 4)).toEqual(['emp_jammer', 'vip_poster']);

    // All 20 props are single-level and match rarity trial prices & refresh cost
    expect(META_PRICES.shopRefresh).toBe(15);
    for (const p of Object.values(PROPS)) {
      expect(p.maxLevel).toBe(1);
      expect(p.price).toBe(PROP_RARITY_RULES[p.rarity].trialPrice);
    }
  });

  it('activates a 24h equippable trial on purchase, snapshots it into battle, and prunes cleanly on expiry', () => {
    const t0 = 1_750_000_000_000;
    const base = { ...createProfile(), coins: 500, shop: { day: '2026-11-26', offers: ['washer', 'shared_oranges', 'glue_trap'] } };
    const bought = buyProp(base, 'washer', t0);
    expect(bought.ok).toBe(true);
    expect(bought.profile.coins).toBe(400);
    expect(isPropPermanent(bought.profile, 'washer')).toBe(false);
    expect(isPropUsable(bought.profile, 'washer', t0)).toBe(true);
    expect(getPropTrialRemainingMs(bought.profile, 'washer', t0)).toBe(PROP_TRIAL_DURATION_MS);
    expect(getPropBlueprintCount(bought.profile, 'washer')).toBe(1);

    // Equip the trial prop & verify battle loadout includes it as usable
    const equipped = equipProp(bought.profile, 'washer', t0 + 1000);
    expect(equipped.ok).toBe(true);
    expect(equipped.profile.equippedActiveProps).toEqual(['washer']);
    const battleLoadout = villageLoadout(equipped.profile, t0 + PROP_TRIAL_DURATION_MS - 1000);
    expect(battleLoadout.ownedProps.washer).toBe(1);
    expect(battleLoadout.equippedActiveProps).toEqual(['washer']);

    // Refreshing the shelf allows re-renting to extend trial by +24h and add +1 blueprint
    const refreshed = refreshShop(equipped.profile, '2026-11-26', () => 0.99, t0 + 1000);
    expect(refreshed.ok).toBe(true);
    expect(refreshed.profile.coins).toBe(400 - 15);
    const extended = buyProp({ ...refreshed.profile, shop: { day: '2026-11-26', offers: ['washer'] } }, 'washer', t0 + 3600_000);
    expect(extended.ok).toBe(true);
    expect(extended.profile.propBlueprints?.washer).toBe(2);
    expect(extended.profile.trialProps?.washer).toBe(t0 + 2 * PROP_TRIAL_DURATION_MS);

    // Once past expiry, trial is automatically pruned and unequipped
    const expired = pruneExpiredTrials(equipped.profile, t0 + PROP_TRIAL_DURATION_MS + 1);
    expect(isPropUsable(expired, 'washer', t0 + PROP_TRIAL_DURATION_MS + 1)).toBe(false);
    expect(expired.equippedActiveProps).toEqual([]);
    expect(expired.trialProps?.washer).toBeUndefined();
  });

  it('rolls Daily Deals strictly at 4:3:2:1 across Green:Blue:Purple:Orange', () => {
    const pool = Object.values(PROPS);
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let i = 0; i < 10_000; i++) {
      let step = 0;
      const picked = rollShopProp(pool, () => (step++ === 0 ? (i + 0.5) / 10_000 : 0.2))!;
      counts[picked.rarity]++;
    }
    expect(counts).toEqual({ 1: 4000, 2: 3000, 3: 2000, 4: 1000 });
  });

  it('paces battle blueprint drops smoothly through Green+Blue -> Purple -> Orange and converts overflow to coins', () => {
    // 1. Fresh market profile: rolls mostly Green/Blue while previewing Purple/Orange
    const countsEarly: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let i = 0; i < 1000; i++) {
      let step = 0;
      const id = rollPropBlueprint(() => (step++ === 0 ? (i + 0.5) / 1000 : 0), { glue_trap: 1 }, {}, 'standard');
      expect(id).not.toBe('glue_trap'); // never wastes drops on permanent props while locked props exist
      countsEarly[PROPS[id].rarity]++;
    }
    expect(countsEarly[1] + countsEarly[2]).toBe(820);
    expect(countsEarly[3]).toBe(130);
    expect(countsEarly[4]).toBe(50);

    // 2. Once all Green + Blue are permanent, rolls only Purple (82%) & Orange (18%)
    const greenBlueDone = Object.fromEntries(Object.values(PROPS).filter(p => p.rarity <= 2).map(p => [p.id, 1]));
    const countsMid: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let i = 0; i < 1000; i++) {
      let step = 0;
      const id = rollPropBlueprint(() => (step++ === 0 ? (i + 0.5) / 1000 : 0), greenBlueDone, {}, 'standard');
      countsMid[PROPS[id].rarity]++;
    }
    expect(countsMid[1] + countsMid[2]).toBe(0);
    expect(countsMid[3]).toBe(820);
    expect(countsMid[4]).toBe(180);

    // 3. Once Purple is also permanent, 100% of drops go to remaining Orange props
    const purpleDone = Object.fromEntries(Object.values(PROPS).filter(p => p.rarity <= 3).map(p => [p.id, 1]));
    for (let i = 0; i < 20; i++) {
      const id = rollPropBlueprint(() => i / 20, purpleDone, {}, 'standard');
      expect(PROPS[id].rarity).toBe(4);
    }

    // 4. Overflow blueprints convert cleanly to coins once a prop is already permanent
    const allPerm = { ...createProfile(), ownedProps: Object.fromEntries(Object.values(PROPS).map(p => [p.id, 1])) };
    const overflow = grantPropBlueprints(allPerm, ['glue_trap', 'washer']);
    expect(overflow.newProps).toEqual([]);
    expect(overflow.overflowCoins).toBe(PROP_RARITY_RULES[1].blueprintOverflowCoins + PROP_RARITY_RULES[4].blueprintOverflowCoins);
    expect(overflow.profile.coins).toBe(overflow.overflowCoins);
  });

  it('drops prop blueprints on standard W10 victory and endless W15/W20 milestones, and banks them atomically', () => {
    const engine = new BattleEngine({
      seed: 42,
      autoWaves: false,
      featureDrops: { armory: true, market: true, village: true, kitchen: true, medallions: true },
      permanentProps: { glue_trap: 1 },
    });
    engine.start();
    engine.state.wave = 10;
    engine.skipWave();
    expect(engine.state.result?.winner).toBe('player');
    expect(engine.state.result?.propLoot).toHaveLength(1);
    const stdProp = engine.state.result!.propLoot![0];
    expect(Object.hasOwn(PROPS, stdProp)).toBe(true);

    // Award standard battle -> prop blueprint banked
    const startProfile = { ...createProfile(), stars: 5, highestStars: 5, ownedProps: { glue_trap: 1 }, propBlueprints: { [stdProp]: propBlueprintGoal(stdProp) - 1 } };
    const settled = awardBattle(startProfile, 'b-prop-1', engine.state.result!);
    expect(settled.awarded).toBe(true);
    expect(settled.newProps).toEqual([stdProp]);
    expect(settled.profile.ownedProps[stdProp]).toBe(1);

    // Endless milestone receipt awards endlessPropLoot atomically
    const endlessSettled = awardEndless(settled.profile, 'b-prop-1', {
      winner: 'player',
      reason: 'oranges',
      loot: [],
      playerLoot: [],
      aiLoot: [],
      coins: 150,
      elapsed: 600,
      endless: true,
      endlessWave: 15,
      endlessCoins: 100,
      endlessLoot: [],
      endlessPropLoot: ['clay'],
    });
    expect(endlessSettled.awarded).toBe(true);
    expect(endlessSettled.profile.propBlueprints?.clay).toBe(1);
  });

  it('surfaces a Zeigarnik next-goal hook when a prop is 1-2 blueprints away from permanent unlock', () => {
    const p = {
      ...createProfile(),
      matches: 40,
      stars: 40,
      highestStars: 40,
      ownedProps: { glue_trap: 1 },
      propBlueprints: { washer: propBlueprintGoal('washer') - 1 },
    };
    const hook = computeNextGoalHook(p);
    expect(hook).toMatchObject({ kind: 'prop', id: 'washer', current: propBlueprintGoal('washer') - 1, target: propBlueprintGoal('washer') });
  });
});
