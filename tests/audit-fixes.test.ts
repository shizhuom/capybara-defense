import { describe, expect, it, vi } from 'vitest';
import { BattleEngine } from '../src/core/BattleEngine';
import { ENEMIES } from '../src/config/enemies';
import {
  ENDLESS_BASE_HP_SCALE,
  ENDLESS_BASE_SPEED_SCALE,
  WAVES,
  getEndlessBossScaling,
  getStandardMinionPressure,
  getWaveConfig,
} from '../src/config/waves';
import { FACILITY_IDS } from '../src/config/village';
import { claimFeatureStarterGift } from '../src/core/FeatureUnlocks';
import { createProfile, normalizeProfile, unlockAllProfile } from '../src/core/MetaProgression';
import { isValidPropUnit } from '../src/core/PropTargets';
import { STAMINA_MAX, settleStamina } from '../src/core/Stamina';
import { claimOfflineHarvest, computeOfflineHarvest } from '../src/core/VillageProgression';
import { awardBattle } from '../src/ui/storage';
import type { Profile, Unit } from '../src/core/types';
import { BattleAudioBridge } from '../src/minigame/BattleAudioBridge';
import { MinigameAssetManager } from '../src/minigame/MinigameAssetManager';
import { UiHitManager } from '../src/minigame/ui/CanvasUI';
import { MinigameAudio, type MinimalAudioContext } from '../src/platform/MinigameAudio';
import type { MinigameAudioController, MinigameCue, PlatformAdapter, SubpackageName } from '../src/platform/types';

const HOUR = 3_600_000;

function placeUnit(engine: BattleEngine, kind: string, col: number, row: number, level = 1, awakened = false): Unit {
  const unit: Unit = {
    id: engine.state.units.length + 100,
    kind,
    side: 'player',
    level,
    awakened,
    location: { zone: 'board', col, row },
    statuses: {},
    energy: 0,
    cooldown: 0,
    production: 0,
    buffTime: 0,
    empowered: 0,
    animation: 0,
  };
  engine.state.units.push(unit);
  return unit;
}

describe('Full-game audit P0/P1 regression tests', () => {
  it('P0-1: trash_coon boneShield absorbs the first incoming hit completely, then clears', () => {
    const engine = new BattleEngine({ seed: 11, autoWaves: false });
    engine.start();
    const attacker = placeUnit(engine, 'hamster', 2, 1, 1);
    const rat = engine.spawnEnemy('rat', 'player');
    rat.boneShield = true;
    const hpBefore = rat.hp;

    engine.hurt(rat, 50, attacker, false, false, true);
    expect(rat.hp).toBe(hpBefore);
    expect(rat.boneShield).toBe(false);
    expect(engine.state.events.some(ev => ev.type === 'burst' && ev.color === '#f3ebd2')).toBe(true);

    engine.hurt(rat, 10, attacker, false, false, true);
    expect(rat.hp).toBeLessThan(hpBefore);
  });

  it('P0-2: reviveCurrentWave clears retained orangeDeficit and prevents duplicate boss loot on revived waves', () => {
    const engine = new BattleEngine({
      seed: 19,
      autoWaves: false,
      loadouts: { player: { ownedProps: { extra_oranges: 1 }, equippedPassiveProps: ['extra_oranges'] } },
    });
    engine.start();
    engine.state.wave = 4;
    // Simulate a boss kill already awarded on wave 4 before defeat
    const attacker = placeUnit(engine, 'kungfu_po', 2, 1, 5);
    engine.spawnBoss('husky_wrecker');
    const b1 = engine.state.enemies.find(e => e.boss)!;
    engine.hurt(b1, b1.maxHp * 10, attacker, false, false, true);
    const lootAfterFirstKill = engine.state.sides.player.loot.length;
    expect(lootAfterFirstKill).toBeGreaterThan(0);

    // Drop oranges well below 0 via deficit, unequip passive, then defeat
    engine.adjustOranges(-6);
    engine.syncPreparationLoadout({ ownedProps: {}, equippedActiveProps: [], equippedPassiveProps: [], equippedWeapons: {} });
    engine.state.phase = 'finished';
    engine.state.result = { winner: 'ai', reason: 'oranges', loot: [], playerLoot: [], aiLoot: [], coins: 15, elapsed: 40 };

    const revived = engine.reviveCurrentWave(3);
    expect(revived.ok).toBe(true);
    expect(engine.state.sides.player.oranges).toBe(3);

    // Killing another boss on the same revived wave must NOT double-grant boss loot
    if (!engine.state.enemies.some(e => e.boss)) engine.spawnBoss('husky_wrecker');
    const b2 = engine.state.enemies.find(e => e.boss)!;
    engine.hurt(b2, b2.maxHp * 10, attacker, false, false, true);
    expect(engine.state.sides.player.loot.length).toBe(lootAfterFirstKill);
  });

  it('P0-3: high attack-rate Meowfia sustains full DPS at 3× speed (6× engine dt) without a 20/s step cap', () => {
    const runDps = (stepDt: number, totalTime: number) => {
      const e = new BattleEngine({ seed: 23, autoWaves: false });
      e.start();
      const meow = placeUnit(e, 'meowfia', 2, 1, 5, true);
      meow.buffTime = 30;
      e.state.sides.player.catnipTime = 30;
      const dummy = e.spawnEnemy('husky_wrecker', 'player', 1000);
      dummy.col = 3;
      dummy.row = 1;
      dummy.speed = 0;
      const steps = Math.round(totalTime / stepDt);
      for (let i = 0; i < steps; i++) e.tick(stepDt);
      return dummy.maxHp - dummy.hp;
    };

    const dmg1x = runDps(0.016, 4);
    const dmg3x = runDps(0.3, 4);
    expect(dmg3x / dmg1x).toBeGreaterThan(0.9);
    expect(dmg3x / dmg1x).toBeLessThan(1.1);
  });

  it('P0-4: stronger stun and stronger slow are never overwritten by weaker crowd control', () => {
    const e = new BattleEngine({ seed: 29, autoWaves: false });
    e.start();
    const target = e.spawnEnemy('husky_wrecker', 'player');
    e.applyStun(target, 2.0);
    e.applyStun(target, 0.4);
    expect(target.stun).toBeCloseTo(2.0, 5);

    e.applySlow(target, 3.0, 0.5);
    e.applySlow(target, 1.5, 0.75);
    expect(target.slowFactor).toBeCloseTo(0.5, 5);
    expect(target.slow).toBeCloseTo(3.0, 5);
  });

  it('P0-5: whistle rejects maxLevel=1 components, max-level basic pets, and awakened heroes', () => {
    const e = new BattleEngine({
      seed: 31,
      autoWaves: false,
      loadouts: { player: { ownedProps: { whistle: 1 }, equippedActiveProps: ['whistle'] } },
    });
    e.start();
    const component = placeUnit(e, 'panda', 1, 1, 1);
    const maxBasic = placeUnit(e, 'hamster', 2, 1, 5);
    const awakenedHero = placeUnit(e, 'kungfu_po', 3, 1, 5, true);
    const validHero = placeUnit(e, 'kungfu_po', 4, 1, 2, false);

    expect(isValidPropUnit(e.state, 'whistle', component)).toBe(false);
    expect(isValidPropUnit(e.state, 'whistle', maxBasic)).toBe(false);
    expect(isValidPropUnit(e.state, 'whistle', awakenedHero)).toBe(false);
    expect(isValidPropUnit(e.state, 'whistle', validHero)).toBe(true);
    expect(e.useProp('whistle', { unitId: component.id }).ok).toBe(false);
    expect(e.useProp('whistle', { unitId: awakenedHero.id }).ok).toBe(false);
    expect(e.useProp('whistle', { unitId: validHero.id }).ok).toBe(true);
  });

  it('P0-6 (Decision 2): W11 smoothly exceeds W10 HP/speed and Endless boss/minion pools are 100% identical across all ranks & maps', () => {
    const w10EffHp = WAVES[9].hpScale * getStandardMinionPressure(10, false).hpMult;
    const w10EffSpd = getStandardMinionPressure(10, false).speedMult;
    expect(ENDLESS_BASE_HP_SCALE).toBeCloseTo(w10EffHp, 6);
    expect(ENDLESS_BASE_SPEED_SCALE).toBeCloseTo(w10EffSpd, 6);
    expect(getWaveConfig(11).hpScale).toBeGreaterThan(w10EffHp);
    expect(getWaveConfig(11).speedScale).toBeGreaterThan(w10EffSpd);
    expect(ENEMIES.husky_wrecker.hp * getEndlessBossScaling(ENEMIES.husky_wrecker.hp, 11)).toBeGreaterThan(10200);

    const lowRank = new BattleEngine({ seed: 77, rankIndex: 0, progressionStars: 0, mapId: 'sunny_backyard' });
    const highRank = new BattleEngine({ seed: 77, rankIndex: 53, progressionStars: 53, mapId: 'cat_tower_maze' });
    lowRank.start();
    highRank.start();
    while (lowRank.state.phase !== 'finished') lowRank.skipWave();
    while (highRank.state.phase !== 'finished') highRank.skipWave();
    expect(lowRank.enterEndless().ok).toBe(true);
    expect(highRank.enterEndless().ok).toBe(true);

    for (let w = 11; w <= 17; w++) {
      expect(lowRank.getUpcomingWavePreview()).toEqual(highRank.getUpcomingWavePreview());
      const lowBosses = lowRank.state.enemies.filter(en => en.boss).map(en => en.kind);
      const highBosses = highRank.state.enemies.filter(en => en.boss).map(en => en.kind);
      expect(lowBosses).toEqual(highBosses);
      lowRank.skipWave();
      highRank.skipWave();
    }
  });

  it('P1-1: standard diva_kitty & hornet_queen boss summons scale with standard wave pressure', () => {
    const e = new BattleEngine({ seed: 41, autoWaves: false });
    e.start();
    e.state.wave = 10;
    placeUnit(e, 'hamster', 1, 1, 1);
    e.spawnBoss('diva_kitty');
    e.spawnBoss('hornet_queen');
    for (const b of e.state.enemies) b.abilityCooldown = 0.01;
    e.tick(0.05);
    const charmed = e.state.enemies.filter(en => en.kind === 'charmed_rat');
    const bees = e.state.enemies.filter(en => en.kind === 'killer_bee');
    expect(charmed.length).toBe(1);
    expect(bees.length).toBe(3);
    const expectedScale = getWaveConfig(10).hpScale * getStandardMinionPressure(10, false).hpMult;
    expect(charmed[0].maxHp).toBeCloseTo(ENEMIES.charmed_rat.hp * expectedScale, 4);
    expect(bees[0].maxHp).toBeCloseTo(ENEMIES.killer_bee.hp * expectedScale, 4);
  });

  it('P0-7 (Decision 1A): Village Lv.3 produces 12h gacha tickets & preserves partial rare-drop progress across early 6h+6h claims', () => {
    const t0 = 1_700_000_000_000;
    const fullVillage: Profile = {
      ...createProfile(),
      village: {
        ...createProfile().village,
        wood: 0,
        essence: 0,
        facilities: Object.fromEntries(FACILITY_IDS.map(id => [id, 3])),
        lastHarvestAt: t0,
      },
    };

    const h6 = computeOfflineHarvest(fullVillage, t0 + 6 * HOUR);
    expect(h6.tickets).toBe(0);
    expect(h6.yuzu).toBe(0);

    const claim1 = claimOfflineHarvest(fullVillage, t0 + 6 * HOUR, () => 0.3);
    expect(claim1.ok).toBe(true);
    expect(claim1.profile.village.rareProgressMs?.['fac_bamboo_pool:ticket']).toBe(6 * HOUR);

    const claim2 = claimOfflineHarvest(claim1.profile, t0 + 12 * HOUR, () => 0.3);
    expect(claim2.ok).toBe(true);
    expect(claim2.profile.freeLotteryTickets).toBe(fullVillage.freeLotteryTickets + 2);
    expect(claim2.profile.ingredients.ing_yuzu).toBe(1);
    expect(Object.values(claim2.profile.weaponFragments).reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('P0-8: full stamina settleStamina preserves staminaUpdatedAt and returns the same reference (no 60 FPS storage storm)', () => {
    const t0 = 1_700_000_000_000;
    const full: Profile = { ...createProfile(), stamina: STAMINA_MAX, staminaUpdatedAt: t0 };
    const settled = settleStamina(full, t0 + 60_000);
    expect(settled).toBe(full);
    expect(settled.staminaUpdatedAt).toBe(t0);
  });

  it('P0-9 & P1-2: pre-P19 upgrade preserves older lastHarvestAt, backfills owned features only, clears maxed glue_trap from shop, and caps awardedBattles at 200', () => {
    const oldHarvest = 1_690_000_000_000;
    const returningRaw = {
      matches: 12,
      wins: 10,
      stars: 20,
      highestStars: 20,
      awardedBattles: Array.from({ length: 260 }, (_, i) => `b-${i}`),
      equippedWeapons: { kungfu_po: 'm01_swatter' },
      unlockedWeapons: ['m01_swatter'],
      ownedProps: { catnip: 1 },
      village: { wood: 10, essence: 5, facilities: { fac_yuzu_tree: 1 }, lastHarvestAt: oldHarvest, petsToday: 0, petDay: '' },
    };
    const migrated = normalizeProfile(returningRaw);
    expect(migrated.awardedBattles).toHaveLength(200);
    expect(migrated.awardedBattles[0]).toBe('b-60');
    expect(migrated.onboardedFeatures).toContain('done:armory');
    expect(migrated.onboardedFeatures).toContain('done:market');
    expect(migrated.onboardedFeatures).toContain('done:village');
    expect(migrated.onboardedFeatures).not.toContain('done:medallions');

    const giftedVillage = claimFeatureStarterGift(migrated, 'village', oldHarvest + 12 * HOUR);
    expect(giftedVillage.profile.village.lastHarvestAt).toBe(oldHarvest);

    const shopProfile: Profile = {
      ...createProfile(),
      stars: 5,
      highestStars: 5,
      shop: { day: '2026-11-26', offers: ['glue_trap', 'catnip', 'milk_bottle'] },
    };
    const giftedMarket = claimFeatureStarterGift(shopProfile, 'market');
    expect(giftedMarket.profile.shop?.offers).not.toContain('glue_trap');

    expect(unlockAllProfile(createProfile()).rankTainted).toBe(true);
  });

  it('P1-3: Wave-1 prep caps distinct active prop casts at 2 so hot-swap cycling cannot fire 3+ actives', () => {
    const e = new BattleEngine({
      seed: 51,
      loadouts: { player: { ownedProps: { catnip: 1, glue_trap: 1, washer: 1 }, equippedActiveProps: ['catnip', 'glue_trap'] } },
    });
    e.start();
    const pet = placeUnit(e, 'hamster', 1, 1, 1);
    expect(e.useProp('catnip').ok).toBe(true);
    expect(e.useProp('glue_trap', { col: 1, row: 0 }).ok).toBe(true);
    expect(
      e.syncPreparationLoadout({
        ownedProps: { catnip: 1, glue_trap: 1, washer: 1 },
        equippedActiveProps: ['washer', 'catnip'],
        equippedPassiveProps: [],
        equippedWeapons: {},
      }).ok,
    ).toBe(true);
    expect(e.useProp('washer', { unitId: pet.id }).ok).toBe(false);
  });

  it('P0-10: MinigameAssetManager.releaseHeavyIdleSprites invalidates maps cache so bg_onsen_village reloads cleanly', async () => {
    const loadedPaths: string[] = [];
    const platform = {
      kind: 'wx',
      loadSubpackage: vi.fn(async (_name: SubpackageName) => true),
      resolveAssetPath: (p: string) => p,
      createImage: () => {
        const img = {
          width: 128,
          height: 128,
          naturalWidth: 128,
          naturalHeight: 128,
          complete: true,
          onload: null as null | (() => void),
          onerror: null as null | (() => void),
          _src: '',
          get src() { return this._src; },
          set src(val: string) {
            this._src = val;
            loadedPaths.push(val);
            queueMicrotask(() => this.onload?.());
          },
        };
        return img as unknown as HTMLImageElement;
      },
    } as unknown as PlatformAdapter;

    const mgr = new MinigameAssetManager(platform);
    await mgr.ensureSubpackage('maps');
    const countAfterFirst = loadedPaths.filter(p => p.includes('bg_onsen_village')).length;
    expect(countAfterFirst).toBe(1);

    mgr.releaseHeavyIdleSprites('sunny_backyard');
    await mgr.ensureSubpackage('maps');
    expect(loadedPaths.filter(p => p.includes('bg_onsen_village')).length).toBe(2);
  });

  it('P0-11: BattleAudioBridge dispatches hitCue (ranged/magic/heavy) on damage and orange_loss on clipped', () => {
    const played: MinigameCue[] = [];
    const mockAudio = {
      unlock() {},
      setSettings() {},
      setMusicMode() {},
      setPaused() {},
      play: (cue: MinigameCue) => { played.push(cue); },
      dispose() {},
    } as unknown as MinigameAudioController;
    const bridge = new BattleAudioBridge();
    const e = new BattleEngine({ seed: 61, autoWaves: false });
    e.start();
    const s = e.state;
    s.events.push({ id: 1, type: 'damage', side: 'player', col: 1, row: 1, value: 12, hitCue: 'hit_magic', age: 0, duration: 0.4 });
    bridge.observe(s, mockAudio, 1000);
    s.events.push(
      { id: 2, type: 'damage', side: 'player', col: 1, row: 1, value: 25, hitCue: 'hit_heavy', age: 0, duration: 0.4 },
      { id: 3, type: 'purge', side: 'player', col: 1, row: 1, effect: 'clipped', age: 0, duration: 0.4 },
    );
    bridge.observe(s, mockAudio, 1200);
    expect(played).toContain('hit_magic');
    expect(played).toContain('hit_heavy');
    expect(played).toContain('orange_loss');
    expect(played).not.toContain('merge_hero');
    expect(played).not.toContain('sprinkler');
  });

  it('P1-4: UiHitManager.pushClip/popClip clips scrolled-off modal hitboxes to the visible viewport', () => {
    const hits = new UiHitManager();
    hits.pushClip(100, 100, 200, 100);
    hits.add({ id: 'offscreen-top', x: 110, y: 20, w: 100, h: 60 });
    hits.add({ id: 'partial-visible', x: 110, y: 170, w: 100, h: 80 });
    hits.popClip();

    expect(hits.hit(150, 50)).toBeUndefined();
    expect(hits.hit(150, 185)?.id).toBe('partial-visible');
    expect(hits.hit(150, 220)).toBeUndefined();
  });

  it('P0-12: MinigameAudio waits for async resume() resolution before starting BGM on iOS WeChat', async () => {
    let resolveResume!: () => void;
    let bgmStarts = 0;
    const ctx: MinimalAudioContext = {
      state: 'suspended',
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      resume: () =>
        new Promise<void>(res => {
          resolveResume = () => {
            ctx.state = 'running';
            res();
          };
        }),
      createGain: () => ({
        gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      }),
      createBufferSource: () => ({
        buffer: null,
        loop: false,
        onended: null,
        connect() {},
        disconnect() {},
        start() { bgmStarts++; },
        stop() {},
      }),
      createBuffer: (_c, length, sampleRate) => {
        const data = new Float32Array(length);
        return { length, sampleRate, getChannelData: () => data, copyToChannel: src => data.set(src) };
      },
    };

    const audio = new MinigameAudio(() => ctx);
    audio.unlock();
    expect(bgmStarts).toBe(0); // Must NOT start while ctx is still suspended!
    resolveResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(bgmStarts).toBe(1);
  });

  it('Star progression rule: 3+ remaining oranges gives +2★, 1–2 oranges gives +1★, and win streaks never double stars', () => {
    const finishStandard = (oranges: number) => {
      const e = new BattleEngine({ seed: 91 });
      e.start();
      e.state.sides.player.oranges = oranges;
      while (e.state.phase !== 'finished') e.skipWave();
      return e.state;
    };

    let p = { ...createProfile(), winStreak: 4, bestWinStreak: 4 };
    const win2 = finishStandard(2);
    expect(win2.result?.remainingOranges).toBe(2);
    p = awardBattle(p, 'std-o2', win2.result!).profile;
    expect(p.stars).toBe(1);
    expect(p.winStreak).toBe(5);

    const win1 = finishStandard(1);
    expect(win1.result?.remainingOranges).toBe(1);
    p = awardBattle(p, 'std-o1', win1.result!).profile;
    expect(p.stars).toBe(2);

    const win3 = finishStandard(3);
    expect(win3.result?.remainingOranges).toBe(3);
    p = awardBattle({ ...p, winStreak: 0 }, 'std-o3', win3.result!).profile;
    expect(p.stars).toBe(4);

    const win6 = finishStandard(6);
    expect(win6.result?.remainingOranges).toBe(6);
    p = awardBattle(p, 'std-o6', win6.result!).profile;
    expect(p.stars).toBe(6);
  });
});
