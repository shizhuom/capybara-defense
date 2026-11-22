import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BattleEngine } from '../src/core/BattleEngine';
import {
  buildDebugStageProfile,
  claimFeatureStarterGift,
  computeNextGoalHook,
  isFeatureUnlocked,
  isRankHubUnlocked,
  markOnboarded,
  maxBattleSpeed,
  nextLockedFeature,
  pendingMenuOnboarding,
} from '../src/core/FeatureUnlocks';
import { createProfile, equipProp, equipWeapon, grantWeaponFragments } from '../src/core/MetaProgression';
import { buildFacility } from '../src/core/VillageProgression';
import { brewBroth } from '../src/core/KitchenProgression';
import { upgradeMedallion } from '../src/core/MedallionProgression';
import { hiddenLegendaryFocus, RARITY_RULES, rollWeapon, WEAPONS } from '../src/config/weapons';
import { BROTHS, BROTH_IDS } from '../src/config/kitchen';
import { FACILITIES, FACILITY_IDS } from '../src/config/village';
import { Random } from '../src/core/Random';
import { awardBattle } from '../src/ui/storage';
import { courtyardMarkup } from '../src/ui/CourtyardView';
import { ledgerTabs } from '../src/ui/LedgerView';
import { nextBattleSpeed } from '../src/ui/P13HUD';
import { computeDialogGuideStep, dialogGuideBannerMarkup, menuWelcomeMarkup, nextBattleLesson, battleLessonMarkup } from '../src/ui/OnboardingGuide';
import { p19En, p19Zh } from '../src/i18n/p19';
import { setLanguage, t } from '../src/i18n/i18n';
import type { BattleLoadout, BattleResult } from '../src/core/types';

afterEach(() => setLanguage('zh-CN'));

describe('P19 progressive star-gated unlock timeline & Option-A preview', () => {
  it('starts fresh 0★ save clean with only Guide + 1 locked Armory preview and speed locked at 1×', () => {
    const fresh = createProfile();
    expect(isRankHubUnlocked(fresh)).toBe(false);
    expect(isFeatureUnlocked(fresh, 'armory')).toBe(false);
    expect(isFeatureUnlocked(fresh, 'speed2x')).toBe(false);
    expect(isFeatureUnlocked(fresh, 'market')).toBe(false);
    expect(isFeatureUnlocked(fresh, 'endless')).toBe(false);
    expect(isFeatureUnlocked(fresh, 'village')).toBe(false);
    expect(isFeatureUnlocked(fresh, 'kitchen')).toBe(false);
    expect(isFeatureUnlocked(fresh, 'medallions')).toBe(false);
    expect(isFeatureUnlocked(fresh, 'speed3x')).toBe(false);
    expect(maxBattleSpeed(fresh)).toBe(1);
    expect(nextLockedFeature(fresh, true)).toMatchObject({ id: 'armory', requiresMatchOnly: true });

    const html = courtyardMarkup(fresh);
    expect(html).toContain('data-action="recipes"');
    expect(html).toContain('data-action="locked-feature:armory"');
    expect(html.match(/data-action="locked-feature:/g)).toHaveLength(1);
    expect(html).not.toContain('data-action="armory"');
    expect(html).not.toContain('data-action="market"');
    expect(html).not.toContain('data-action="village"');
    expect(html).not.toContain('data-action="kitchen"');
    expect(html).not.toContain('data-action="medallions"');
    expect(html).not.toContain('class="profile-pill"');
    expect(html).not.toContain('class="map-chips"');
  });

  it('unlocks every system on its Fibonacci star milestone and reveals exactly 1 next locked dock preview', () => {
    const after1 = { ...createProfile(), matches: 1 };
    expect(isFeatureUnlocked(after1, 'armory')).toBe(true);
    expect(isRankHubUnlocked(after1)).toBe(true);
    expect(maxBattleSpeed(after1)).toBe(1);
    expect(courtyardMarkup(after1)).toContain('data-action="armory"');
    expect(courtyardMarkup(after1)).toContain('data-action="locked-feature:market"');
    expect(courtyardMarkup(after1).match(/data-action="locked-feature:/g)).toHaveLength(1);

    const s2 = { ...after1, stars: 2, highestStars: 2 };
    expect(maxBattleSpeed(s2)).toBe(2);
    expect(nextBattleSpeed(1, 1)).toBe(1);
    expect([nextBattleSpeed(1, 2), nextBattleSpeed(2, 2)]).toEqual([2, 1]);
    expect([nextBattleSpeed(1, 3), nextBattleSpeed(2, 3), nextBattleSpeed(3, 3)]).toEqual([2, 3, 1]);

    const s5 = { ...s2, stars: 5, highestStars: 5 };
    expect(isFeatureUnlocked(s5, 'market')).toBe(true);
    expect(isFeatureUnlocked(s5, 'endless')).toBe(false);
    expect(ledgerTabs('leaderboard', s5)).not.toContain('endless-board');
    expect(courtyardMarkup(s5)).toContain('data-action="locked-feature:village"');

    const s10 = { ...s5, stars: 10, highestStars: 10 };
    expect(isFeatureUnlocked(s10, 'endless')).toBe(true);
    expect(ledgerTabs('leaderboard', s10)).toContain('endless-board');

    const s16 = { ...s10, stars: 16, highestStars: 16 };
    expect(isFeatureUnlocked(s16, 'village')).toBe(true);
    expect(courtyardMarkup(s16)).toContain('data-action="locked-feature:kitchen"');

    const s23 = { ...s16, stars: 23, highestStars: 23 };
    expect(isFeatureUnlocked(s23, 'kitchen')).toBe(true);
    expect(courtyardMarkup(s23)).toContain('data-action="locked-feature:medallions"');

    const s32 = { ...s23, stars: 32, highestStars: 32 };
    expect(isFeatureUnlocked(s32, 'medallions')).toBe(true);
    expect(courtyardMarkup(s32)).not.toContain('locked-feature:');
    expect(maxBattleSpeed(s32)).toBe(2);

    // 3x speed unlocks at 60★ OR Endless Wave 25
    expect(maxBattleSpeed({ ...s32, stars: 60, highestStars: 60 })).toBe(3);
    expect(maxBattleSpeed({ ...s32, bestEndlessWave: 25 })).toBe(3);
  });
});

describe('P19 interactive onboarding starter gifts, step flows & stage jump', () => {
  it('grants idempotent starter gifts that afford every first guided action immediately', () => {
    // 1. Armory -> unlocks m01_swatter (2 fragments) -> equip on kungfu_po
    const p1 = buildDebugStageProfile(createProfile(), 1);
    expect(pendingMenuOnboarding(p1)).toBe('armory');
    const g1 = claimFeatureStarterGift(p1, 'armory');
    expect(g1.granted).toBe(true);
    expect(g1.profile.unlockedWeapons).toContain('m01_swatter');
    expect(claimFeatureStarterGift(g1.profile, 'armory').granted).toBe(false);
    expect(computeDialogGuideStep('armory', g1.profile, { dialogKind: 'armory', detailWeaponId: null, marketTab: 'shop', marketSpun: false, villageTab: 'courtyard', villageInteracted: false })?.pulseSelector).toBe('[data-action="meta-weapon:m01_swatter"]');
    const equipped = equipWeapon(g1.profile, 'kungfu_po', 'm01_swatter').profile;
    expect(computeDialogGuideStep('armory', equipped, { dialogKind: 'armory', detailWeaponId: 'm01_swatter', marketTab: 'shop', marketSpun: false, villageTab: 'courtyard', villageInteracted: false })?.done).toBe(true);

    // 3. Market -> glue_trap + 1 free ticket -> spin & equip
    const p3 = buildDebugStageProfile(createProfile(), 3);
    expect(pendingMenuOnboarding(p3)).toBe('market');
    const g3 = claimFeatureStarterGift(p3, 'market');
    expect(g3.profile.ownedProps.glue_trap).toBe(1);
    expect(g3.profile.freeLotteryTickets).toBe(1);
    const slotted = equipProp({ ...g3.profile, freeLotteryTickets: 0 }, 'glue_trap').profile;
    expect(computeDialogGuideStep('market', slotted, { dialogKind: 'market', detailWeaponId: null, marketTab: 'backpack', marketSpun: true, villageTab: 'courtyard', villageInteracted: false })?.done).toBe(true);

    // 5. Village -> exact materials for fac_bamboo_pool Lv.1
    const p5 = buildDebugStageProfile(createProfile(), 5);
    expect(pendingMenuOnboarding(p5)).toBe('village');
    const g5 = claimFeatureStarterGift(p5, 'village');
    const built = buildFacility(g5.profile, 'fac_bamboo_pool');
    expect(built.ok).toBe(true);
    expect(built.profile.village.facilities.fac_bamboo_pool).toBe(1);
    expect(computeDialogGuideStep('village', built.profile, { dialogKind: 'village', detailWeaponId: null, marketTab: 'shop', marketSpun: false, villageTab: 'courtyard', villageInteracted: true })?.done).toBe(true);

    // 6. Kitchen -> exact 4 ing_yuzu for dish_yuzu_bath Lv.1
    const p6 = buildDebugStageProfile(createProfile(), 6);
    expect(pendingMenuOnboarding(p6)).toBe('kitchen');
    const g6 = claimFeatureStarterGift(p6, 'kitchen');
    const brewed = brewBroth(g6.profile, 'dish_yuzu_bath');
    expect(brewed.ok).toBe(true);
    expect(brewed.profile.activeBrothId).toBe('dish_yuzu_bath');
    expect(computeDialogGuideStep('kitchen', brewed.profile, { dialogKind: 'kitchen', detailWeaponId: null, marketTab: 'shop', marketSpun: false, villageTab: 'courtyard', villageInteracted: false })?.done).toBe(true);

    // 7. Medallions -> 10 crests + 20 coins for med_breakthrough_atk Lv.1
    const p7 = buildDebugStageProfile(createProfile(), 7);
    expect(pendingMenuOnboarding(p7)).toBe('medallions');
    const g7 = claimFeatureStarterGift(p7, 'medallions');
    const upgraded = upgradeMedallion(g7.profile, 'med_breakthrough_atk');
    expect(upgraded.ok).toBe(true);
    expect(upgraded.profile.endlessMedallions.med_breakthrough_atk).toBe(1);
    expect(computeDialogGuideStep('medallions', upgraded.profile, { dialogKind: 'medallions', detailWeaponId: null, marketTab: 'shop', marketSpun: false, villageTab: 'courtyard', villageInteracted: false })?.done).toBe(true);
  });

  it('triggers in-battle one-time lessons and renders localized onboarding cards with no raw keys', () => {
    const s2 = buildDebugStageProfile(createProfile(), 2);
    expect(nextBattleLesson(s2, { endless: false, hasActiveProp: false })).toBe('speed2x');
    expect(nextBattleLesson(markOnboarded(s2, 'speed2x'), { endless: false, hasActiveProp: false })).toBeNull();

    const s3 = buildDebugStageProfile(createProfile(), 3);
    expect(nextBattleLesson(s3, { endless: false, hasActiveProp: true })).toBe('prop_battle');

    const s4 = buildDebugStageProfile(createProfile(), 4);
    expect(nextBattleLesson(s4, { endless: true, hasActiveProp: false })).toBe('endless_battle');

    const s8 = buildDebugStageProfile(createProfile(), 8);
    expect(nextBattleLesson(s8, { endless: false, hasActiveProp: false })).toBe('speed3x');

    for (const lang of ['zh-CN', 'en'] as const) {
      setLanguage(lang);
      expect(menuWelcomeMarkup('armory')).not.toContain('p19.');
      expect(dialogGuideBannerMarkup({ feature: 'kitchen', textKey: 'p19.onboard.kitchen.step1', done: false })).not.toContain('p19.');
      expect(battleLessonMarkup('endless_battle')).not.toContain('p19.');
    }
    expect(Object.keys(p19Zh).sort()).toEqual(Object.keys(p19En).sort());
  });
});

describe('P19 Tier-4 broths, hidden legendary focus, 3-win tickets & battle drop gating', () => {
  const empty: BattleLoadout = { ownedProps: {}, equippedWeapons: {}, equippedActiveProps: [], equippedPassiveProps: [] };

  it('ships 3 Tier-4 broths (14 total) with real Starlight Spring & Golden Orchard battle mechanics', () => {
    expect(BROTH_IDS).toHaveLength(14);
    expect(BROTH_IDS.filter(id => BROTHS[id].tier === 4)).toEqual([
      'dish_imperial_onsen',
      'dish_starlight_spring',
      'dish_golden_orchard',
    ]);
    for (const id of ['dish_starlight_spring', 'dish_golden_orchard']) {
      const png = readFileSync(`public/assets/sprites/${id}.png`);
      expect([png.readUInt32BE(16), png.readUInt32BE(20), png[25]]).toEqual([256, 256, 6]);
    }

    // Starlight Celestial Spring: charge reduction + boss damage + momentum bonus
    const starLoadout: BattleLoadout = {
      ...empty,
      unlockedBroths: ['dish_starlight_spring'],
      brothLevels: { dish_starlight_spring: 3 },
      activeBrothId: 'dish_starlight_spring',
    };
    const plainLoadout: BattleLoadout = { ...starLoadout, activeBrothId: null };
    const on = new BattleEngine({ seed: 11, autoWaves: false, loadouts: { player: starLoadout } });
    const off = new BattleEngine({ seed: 11, autoWaves: false, loadouts: { player: plainLoadout } });
    on.start(); off.start();
    const rOn = on.grant('kungfu_po'), rOff = off.grant('kungfu_po');
    const hOn = on.state.units.find(u => u.id === rOn.unitId)!;
    const hOff = off.state.units.find(u => u.id === rOff.unitId)!;
    expect(on.getUnitStats(hOn).charge).toBe(off.getUnitStats(hOff).charge - 2);
    const bOn = on.spawnEnemy('husky_wrecker', 'player'); const hpOn = bOn.hp; on.hurt(bOn, 100, hOn);
    const bOff = off.spawnEnemy('husky_wrecker', 'player'); const hpOff = bOff.hp; off.hurt(bOff, 100, hOff);
    expect((hpOn - bOn.hp) / (hpOff - bOff.hp)).toBeCloseTo(1.5, 6);
    on.hurt(on.spawnEnemy('rat', 'player'), 1e9, hOn, false, false, true);
    off.hurt(off.spawnEnemy('rat', 'player'), 1e9, hOff, false, false, true);
    expect(on.getUnitMomentum(hOn) / off.getUnitMomentum(hOff)).toBeCloseTo(1.6, 6);

    // Hundred-Fruit Golden Spring: +22 startFood, +7 waveIncome, +70% coins
    const orchardLoadout: BattleLoadout = {
      ...empty,
      unlockedBroths: ['dish_golden_orchard'],
      brothLevels: { dish_golden_orchard: 3 },
      activeBrothId: 'dish_golden_orchard',
    };
    const g = new BattleEngine({ seed: 12, autoWaves: false, loadouts: { player: orchardLoadout } });
    g.start();
    expect(g.state.sides.player.food).toBe(22 + 22);
    g.skipWave(); const before = g.state.sides.player.food; g.skipWave();
    expect(g.state.sides.player.food - before).toBe(3 + 7);
  });

  it('internally focuses legendary rolls melee → ranged → magic without any UI selector', () => {
    const meleeLegs = Object.values(WEAPONS).filter(w => w.rarity === 4 && w.family === 'melee').map(w => w.id);
    const rangedLegs = Object.values(WEAPONS).filter(w => w.rarity === 4 && w.family === 'ranged').map(w => w.id);
    const magicLegs = Object.values(WEAPONS).filter(w => w.rarity === 4 && w.family === 'magic').map(w => w.id);

    expect(hiddenLegendaryFocus([])).toBe('melee');
    expect(hiddenLegendaryFocus(meleeLegs)).toBe('ranged');
    expect(hiddenLegendaryFocus([...meleeLegs, ...rangedLegs])).toBe('magic');
    expect(hiddenLegendaryFocus([...meleeLegs, ...rangedLegs, ...magicLegs])).toBeNull();

    const rng = new Random(2026);
    let meleeCount = 0;
    for (let i = 0; i < 600; i++) {
      if (WEAPONS[rollWeapon(() => rng.next(), [4], 1, [])].family === 'melee') meleeCount++;
    }
    expect(meleeCount / 600).toBeGreaterThan(0.58);

    let rangedCount = 0;
    for (let i = 0; i < 600; i++) {
      if (WEAPONS[rollWeapon(() => rng.next(), [4], 1, meleeLegs)].family === 'ranged') rangedCount++;
    }
    expect(rangedCount / 600).toBeGreaterThan(0.58);
  });

  it('suppresses locked feature drops in Match 1 and pays 1 free ticket every 3 wins after 5★', () => {
    const e = new BattleEngine({
      seed: 9,
      featureDrops: { armory: false, village: false, kitchen: false, medallions: false },
    });
    e.start();
    while (e.state.phase !== 'finished') e.skipWave();
    expect(e.state.result?.loot).toEqual([]);
    expect(e.state.result?.ingredientLoot).toEqual([]);
    expect(e.state.result?.villageLoot).toEqual([]);
    expect(e.state.result?.endlessCrests).toBeUndefined();

    // 3-win gacha ticket counter & Zeigarnik 2/3 hook
    const winResult: BattleResult = { winner: 'player', reason: 'waves', loot: [], playerLoot: [], aiLoot: [], coins: 65, elapsed: 200 };
    let p = { ...createProfile(), stars: 32, highestStars: 32, matches: 30, bestEndlessWave: 25 };
    const r1 = awardBattle(p, 'w1', winResult); expect(r1.ticketAwarded).toBe(false); expect(r1.profile.gachaWinCounter).toBe(1);
    const r2 = awardBattle(r1.profile, 'w2', winResult); expect(r2.ticketAwarded).toBe(false); expect(r2.profile.gachaWinCounter).toBe(2);
    expect(computeNextGoalHook(r2.profile)).toMatchObject({ kind: 'gacha_ticket', current: 2, target: 3 });
    const r3 = awardBattle(r2.profile, 'w3', winResult); expect(r3.ticketAwarded).toBe(true); expect(r3.profile.freeLotteryTickets).toBe(1); expect(r3.profile.gachaWinCounter).toBe(0);
  });

  it('hits the 10h / 30h / 50h long-term progression targets in a deterministic Monte-Carlo run', () => {
    // 10h ≈ 115 matches (~2.6 frags/match avg including gacha + pavilion) -> all 24 non-legendaries
    // 30h ≈ 300 matches -> all 4 melee legendaries + all 5 Lv.1 village facilities (450w/140e/2550c after starter)
    // 50h ≈ 500 matches -> all 36 weapons!
    const rng = new Random(777);
    let p = createProfile();
    const nonLegCount = (unlocked: readonly string[]) => unlocked.filter(id => WEAPONS[id].rarity < 4).length;
    const meleeLegCount = (unlocked: readonly string[]) => unlocked.filter(id => WEAPONS[id].rarity === 4 && WEAPONS[id].family === 'melee').length;

    let at10hNonLeg = 0;
    let at30hMeleeLeg = 0;
    let at50hTotal = 0;

    for (let match = 1; match <= 500; match++) {
      // Average 2.5 frags/match early (0-10h), 3.3 frags/match mid-late (bosses + endless W15-30 + gacha + pavilion)
      const count = match <= 120 ? (rng.next() < 0.5 ? 2 : 3) : (rng.next() < 0.3 ? 4 : 3);
      const epicMult = match > 260 ? 1.75 : match > 160 ? 1.5 : match > 100 ? 1.3 : 1;
      const frags: string[] = [];
      for (let k = 0; k < count; k++) {
        frags.push(rollWeapon(() => rng.next(), undefined, epicMult, p.unlockedWeapons));
      }
      // 5% Boss Lucky Crit Legendary Drop (~1/match W10 + ~2/match in Endless)
      const luckyChecks = match > 120 ? 3 : 1;
      for (let c = 0; c < luckyChecks; c++) {
        if (rng.next() < 0.05) frags.push(rollWeapon(() => rng.next(), [4], epicMult, p.unlockedWeapons));
      }
      p = grantWeaponFragments(p, frags).profile;
      if (match === 120) at10hNonLeg = nonLegCount(p.unlockedWeapons);
      if (match === 300) at30hMeleeLeg = meleeLegCount(p.unlockedWeapons);
      if (match === 500) at50hTotal = p.unlockedWeapons.length;
    }

    expect(at10hNonLeg).toBeGreaterThanOrEqual(22); // ~24 non-legendaries around 10h
    expect(at30hMeleeLeg).toBe(4);                  // All 4 melee legendaries by 30h via hidden focus
    expect(at50hTotal).toBe(36);                    // Full 36/36 armory by 50h

    // Village Lv.1 totals (excluding starter pool gifted at 16★): 450 wood, 140 essence, 2550 coins
    const lv1AfterStarter = FACILITY_IDS.slice(1).reduce(
      (acc, id) => {
        const c = FACILITIES[id].costs[0]!;
        return { wood: acc.wood + c.wood, essence: acc.essence + c.essence, coins: acc.coins + c.coins };
      },
      { wood: 0, essence: 0, coins: 0 },
    );
    expect(lv1AfterStarter).toEqual({ wood: 450, essence: 140, coins: 2550 });
  });
});
