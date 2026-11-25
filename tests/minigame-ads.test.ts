import { describe, expect, it, vi } from 'vitest';
import { createMiniGameAdapter, type MiniGameGlobalApi } from '../src/platform/minigameAdapter';
import { computeViewport } from '../src/platform/viewport';
import { MinigameApp } from '../src/minigame/MinigameApp';
import { BattleEngine } from '../src/core/BattleEngine';
import { createProfile, normalizeProfile } from '../src/core/MetaProgression';
import { STAMINA_REFILL_AMOUNT, grantStamina } from '../src/core/Stamina';
import { allOnboardedTokens } from '../src/core/FeatureUnlocks';
import { localDay } from '../src/core/VillageProgression';
import {
  AD_DAILY_LIMITS,
  canUseAdToday,
  getAdRemainingToday,
  getAdUsedToday,
  recordAdUse,
} from '../src/minigame/adConfig';
import type { PlatformAdapter, RewardedAdOutcome } from '../src/platform/types';
import type { SpriteImage } from '../src/render/AssetRegistry';

function makeMiniApiWithAdResult(closePayload: { isEnded?: boolean } | undefined) {
  const store = new Map<string, string>();
  const mockCtx = new Proxy({
    measureText: (s: string) => ({ width: s.length * 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  } as Record<string, unknown>, {
    get(target, prop: string) {
      return prop in target ? target[prop] : () => {};
    },
  });
  const mockCanvas = { width: 0, height: 0, getContext: () => mockCtx } as unknown as HTMLCanvasElement;
  const api: MiniGameGlobalApi = {
    createCanvas: () => mockCanvas,
    createImage: () => ({ width: 0, height: 0, src: '', onload: null, onerror: null }) as unknown as SpriteImage,
    getSystemInfoSync: () => ({ windowWidth: 852, windowHeight: 393, pixelRatio: 2 }),
    getStorageSync: k => store.get(k) ?? '',
    setStorageSync: (k, v) => { store.set(k, v); },
    removeStorageSync: k => { store.delete(k); },
    request: () => {},
    onTouchStart: () => {},
    onTouchMove: () => {},
    onTouchEnd: () => {},
    onTouchCancel: () => {},
    createRewardedVideoAd: () => ({
      load: async () => {},
      show: async () => {},
      onClose: cb => { queueMicrotask(() => cb(closePayload)); },
    }),
  };
  return api;
}

describe('Rewarded Video Ads: Strict completion guard, daily quotas, +10 stamina & reviveCurrentWave', () => {
  it('strictly requires isEnded === true to report completed; early exit or undefined returns skipped', async () => {
    const completed = createMiniGameAdapter(makeMiniApiWithAdResult({ isEnded: true }), 'wx');
    expect(await completed.showRewardedAd('adunit-test')).toBe('completed');

    const earlyExit = createMiniGameAdapter(makeMiniApiWithAdResult({ isEnded: false }), 'wx');
    expect(await earlyExit.showRewardedAd('adunit-test')).toBe('skipped');

    const missingPayload = createMiniGameAdapter(makeMiniApiWithAdResult(undefined), 'wx');
    expect(await missingPayload.showRewardedAd('adunit-test')).toBe('skipped');

    const emptyPayload = createMiniGameAdapter(makeMiniApiWithAdResult({}), 'wx');
    expect(await emptyPayload.showRewardedAd('adunit-test')).toBe('skipped');
  });

  it('enforces exact daily limits (3 settlement, 3 gacha, 2 basket, 3 speed3x, 1 harvest) and resets on new day', () => {
    expect(AD_DAILY_LIMITS).toEqual({
      double_settlement: 3,
      free_gacha: 3,
      free_basket: 2,
      speed3x_trial: 3,
      double_harvest: 1,
    });

    const day1 = '2026-11-25';
    const day2 = '2026-11-26';
    let p = createProfile();

    // double_harvest: 1/day
    expect(getAdRemainingToday(p, 'double_harvest', day1)).toBe(1);
    expect(canUseAdToday(p, 'double_harvest', day1)).toBe(true);
    p = recordAdUse(p, 'double_harvest', day1);
    expect(getAdUsedToday(p, 'double_harvest', day1)).toBe(1);
    expect(getAdRemainingToday(p, 'double_harvest', day1)).toBe(0);
    expect(canUseAdToday(p, 'double_harvest', day1)).toBe(false);

    // free_basket: 2/day
    p = recordAdUse(p, 'free_basket', day1);
    expect(getAdRemainingToday(p, 'free_basket', day1)).toBe(1);
    p = recordAdUse(p, 'free_basket', day1);
    expect(canUseAdToday(p, 'free_basket', day1)).toBe(false);

    // double_settlement, free_gacha, speed3x_trial: 3/day
    for (const placement of ['double_settlement', 'free_gacha', 'speed3x_trial'] as const) {
      expect(getAdRemainingToday(p, placement, day1)).toBe(3);
      p = recordAdUse(recordAdUse(recordAdUse(p, placement, day1), placement, day1), placement, day1);
      expect(canUseAdToday(p, placement, day1)).toBe(false);
    }

    // stamina_refill & revive: unlimited per day
    expect(getAdRemainingToday(p, 'stamina_refill', day1)).toBe(Number.POSITIVE_INFINITY);
    expect(getAdRemainingToday(p, 'revive', day1)).toBe(Number.POSITIVE_INFINITY);

    // Persists cleanly through normalizeProfile serialization
    const reloaded = normalizeProfile(JSON.parse(JSON.stringify(p)));
    expect(getAdUsedToday(reloaded, 'double_harvest', day1)).toBe(1);
    expect(getAdUsedToday(reloaded, 'free_basket', day1)).toBe(2);
    expect(getAdUsedToday(reloaded, 'double_settlement', day1)).toBe(3);

    // Next calendar day resets all daily quotas cleanly
    expect(getAdRemainingToday(reloaded, 'double_harvest', day2)).toBe(1);
    expect(getAdRemainingToday(reloaded, 'free_basket', day2)).toBe(2);
    expect(getAdRemainingToday(reloaded, 'double_settlement', day2)).toBe(3);
    expect(getAdRemainingToday(reloaded, 'free_gacha', day2)).toBe(3);
    expect(getAdRemainingToday(reloaded, 'speed3x_trial', day2)).toBe(3);
  });

  it('refills exactly +10 stamina immediately after a completed stamina ad', () => {
    expect(STAMINA_REFILL_AMOUNT).toBe(10);
    const now = Date.now();
    const low = { ...createProfile(), stamina: 4, staminaUpdatedAt: now };
    const after = grantStamina(low, STAMINA_REFILL_AMOUNT, now);
    expect(after.stamina).toBe(14);
  });

  it('reviveCurrentWave restores 3 oranges, clears enemies & debuffs, and restarts the current wave cleanly', () => {
    const engine = new BattleEngine({ seed: 101 });
    engine.start();
    // Advance to Wave 4 (boss wave)
    engine.skipWave();
    engine.skipWave();
    engine.skipWave();
    expect(engine.state.wave).toBe(4);

    // Put a unit on board with debuffs and track fish food
    const uRes = engine.grant('hamster');
    const unit = engine.state.units.find(u => u.id === uRes.unitId)!;
    unit.location = { zone: 'board', col: 2, row: 1 };
    unit.statuses.SEALED = 5;
    unit.statuses.WET = 10;
    engine.state.sides.player.fog = 4;
    engine.tick(3);
    const foodBeforeDefeat = engine.state.sides.player.food;

    // Lose all oranges -> defeat
    engine.adjustOranges(-engine.state.sides.player.oranges);
    expect(engine.state.phase).toBe('finished');
    expect(engine.state.result?.winner).toBe('ai');
    expect(engine.state.result?.reason).toBe('oranges');

    // Revive restarts Wave 4 with 3 oranges, no stale debuffs, fresh spawn counter, and re-scheduled wave 4 boss
    const rev = engine.reviveCurrentWave(3);
    expect(rev.ok).toBe(true);
    expect(rev.value).toBe(4);
    expect(engine.state.phase).toBe('playing');
    expect(engine.state.result).toBeNull();
    expect(engine.state.wave).toBe(4);
    expect(engine.state.waveTime).toBe(0);
    expect(engine.state.spawned).toBe(0);
    expect(engine.state.sides.player.oranges).toBe(3);
    expect(engine.state.sides.player.fog).toBe(0);
    expect(engine.state.sides.player.food).toBe(foodBeforeDefeat); // no free wave-income farming
    expect(unit.statuses.SEALED).toBeUndefined();
    expect(unit.statuses.WET).toBeUndefined();
    // Wave 4 boss is freshly spawned at start of path
    const bosses = engine.state.enemies.filter(e => e.boss);
    expect(bosses.length).toBe(1);
    expect(bosses[0].progress).toBe(0);
    expect(vi.isFakeTimers()).toBe(false);
  });

  it('end-to-end MinigameApp: early-exit ads grant ZERO reward & consume ZERO quota; completed ads grant exact rewards and enforce daily limits', async () => {
    let nextAdOutcome: RewardedAdOutcome = 'skipped';
    let rafCb: FrameRequestCallback | null = null;
    const store = new Map<string, string>();
    const mockCtx = new Proxy({
      measureText: (s: string) => ({ width: s.length * 10 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
    } as Record<string, unknown>, {
      get(target, prop: string) {
        return prop in target ? target[prop] : () => {};
      },
    }) as unknown as CanvasRenderingContext2D;
    const mockCanvas = { width: 1280, height: 720, getContext: () => mockCtx } as unknown as HTMLCanvasElement;
    const platform: PlatformAdapter = {
      kind: 'wx',
      canvas: mockCanvas,
      ctx: mockCtx,
      storage: {
        get length() { return store.size; },
        clear: () => store.clear(),
        getItem: k => store.get(k) ?? null,
        key: i => [...store.keys()][i] ?? null,
        removeItem: k => { store.delete(k); },
        setItem: (k, v) => { store.set(k, v); },
      },
      audio: { unlock: () => {}, play: () => {}, setSettings: () => {}, setPaused: () => {}, setMusicMode: () => {} },
      fetch: vi.fn() as unknown as typeof fetch,
      viewport: () => computeViewport(1280, 720, 1, undefined, true),
      onResize: () => () => {},
      onTouch: () => () => {},
      createImage: () => {
        const img = {
          width: 64,
          height: 64,
          naturalWidth: 64,
          naturalHeight: 64,
          complete: true,
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          _src: '',
          get src() { return this._src; },
          set src(v: string) { this._src = v; queueMicrotask(() => this.onload?.()); },
        };
        return img as unknown as SpriteImage;
      },
      loadSubpackage: async () => true,
      resolveAssetPath: p => p,
      showKeyboard: async () => null,
      showRewardedAd: async () => nextAdOutcome,
      share: () => {},
      now: () => Date.now(),
      requestFrame: cb => { rafCb = cb; return 1; },
      cancelFrame: () => {},
      onShow: () => () => {},
      onHide: () => () => {},
      dispose: () => {},
    };

    const seedProfile = {
      ...createProfile(),
      matches: 20,
      wins: 18,
      stars: 24,
      highestStars: 24,
      coins: 500,
      stamina: 8,
      staminaUpdatedAt: Date.now(),
      tutorialCompleted: true,
      tutorialRewardClaimed: true,
      onboardedFeatures: allOnboardedTokens(),
      village: {
        wood: 20,
        essence: 10,
        facilities: { fac_bamboo_pool: 2, fac_yuzu_tree: 1 },
        lastHarvestAt: Date.now() - 12 * 3600_000,
        petTapDay: localDay(),
        petTapCount: 0,
      },
    };
    store.set('capybara_defense_v1:profile', JSON.stringify(seedProfile));

    const app = new MinigameApp(platform);
    const internals = app as unknown as {
      handleUiAction: (box: { id: string; x: number; y: number; w: number; h: number }) => void;
      profile: ReturnType<typeof createProfile>;
      engine: BattleEngine | null;
      speed: 1 | 2 | 3;
      speed3xTrialThisBattle: boolean;
      settlement: { adDoubleCoinsAvailable: boolean; adDoubleClaimed: boolean; adReviveAvailable: boolean };
      market: { spinAnim: unknown };
      handleBattleFinished: (state: BattleEngine['state']) => void;
    };
    const trigger = (id: string) => internals.handleUiAction({ id, x: 0, y: 0, w: 10, h: 10 });
    const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
    if (rafCb) (rafCb as FrameRequestCallback)(100);

    try {
      const today = localDay();

      // 6. Stamina Ad: skipped -> 0 stamina; completed -> +10 stamina immediately
      nextAdOutcome = 'skipped';
      trigger('stamina:ad');
      await flush();
      expect(internals.profile.stamina).toBe(8);
      nextAdOutcome = 'completed';
      trigger('stamina:ad');
      await flush();
      expect(internals.profile.stamina).toBe(18);

      // 3. Free Ingredient Basket (2/day): skipped -> 0 ing & 0 quota; completed x2 -> 6 ing, 3rd blocked
      const ingCount = () => Object.values(internals.profile.ingredients).reduce((a, b) => a + b, 0);
      nextAdOutcome = 'skipped';
      trigger('kitchen:ad-basket');
      await flush();
      expect(ingCount()).toBe(0);
      expect(getAdUsedToday(internals.profile, 'free_basket', today)).toBe(0);

      nextAdOutcome = 'completed';
      trigger('kitchen:ad-basket');
      await flush();
      trigger('kitchen:ad-basket');
      await flush();
      expect(ingCount()).toBe(6);
      expect(internals.profile.coins).toBe(500); // free!
      expect(getAdRemainingToday(internals.profile, 'free_basket', today)).toBe(0);
      trigger('kitchen:ad-basket'); // 3rd attempt blocked by daily limit
      await flush();
      expect(ingCount()).toBe(6);

      // 2. Free Gacha Spin (3/day): skipped -> 0 quota; completed -> spins & consumes quota (max 3)
      nextAdOutcome = 'skipped';
      trigger('market:ad-gacha');
      await flush();
      expect(getAdUsedToday(internals.profile, 'free_gacha', today)).toBe(0);
      nextAdOutcome = 'completed';
      for (let i = 0; i < 4; i++) {
        internals.market.spinAnim = null;
        trigger('market:ad-gacha');
        await flush();
      }
      expect(getAdUsedToday(internals.profile, 'free_gacha', today)).toBe(3);

      // 7. Village Double Harvest (1/day): skipped -> nothing harvested; completed -> 2× coins & 2× yuzu, 2nd blocked
      const coinsBeforeH = internals.profile.coins;
      const yuzuBeforeH = internals.profile.ingredients.ing_yuzu ?? 0;
      nextAdOutcome = 'skipped';
      trigger('village:ad-harvest');
      await flush();
      expect(internals.profile.coins).toBe(coinsBeforeH);
      expect(getAdUsedToday(internals.profile, 'double_harvest', today)).toBe(0);

      nextAdOutcome = 'completed';
      trigger('village:ad-harvest');
      await flush();
      // 12h harvest: fac_bamboo_pool Lv.2 (16/h) + fac_yuzu_tree Lv.1 (5/h) = 252 coins & 1 yuzu -> doubled = +504 coins & +2 yuzu!
      expect(internals.profile.coins).toBe(coinsBeforeH + 504);
      expect(internals.profile.ingredients.ing_yuzu).toBe(yuzuBeforeH + 2);
      expect(getAdRemainingToday(internals.profile, 'double_harvest', today)).toBe(0);

      // 5. 3× Speed Trial (3/day): skipped -> stays at max 2×; completed -> enables 3× for this battle only!
      trigger('menu:start');
      await vi.waitFor(() => expect(app.getDebugState().screen).toBe('battle'));
      nextAdOutcome = 'skipped';
      trigger('battle:ad-speed3x');
      await flush();
      expect(internals.speed3xTrialThisBattle).toBe(false);
      expect(getAdUsedToday(internals.profile, 'speed3x_trial', today)).toBe(0);

      nextAdOutcome = 'completed';
      trigger('battle:ad-speed3x');
      await flush();
      expect(internals.speed3xTrialThisBattle).toBe(true);
      expect(internals.speed).toBe(3);
      expect(getAdUsedToday(internals.profile, 'speed3x_trial', today)).toBe(1);

      // 4. Revive on defeat: skipped -> stays defeated; completed -> restores 3 oranges & restarts current wave!
      const eng = internals.engine!;
      eng.skipWave(); eng.skipWave(); // Wave 3
      eng.adjustOranges(-eng.state.sides.player.oranges);
      internals.handleBattleFinished(eng.state);
      expect(eng.state.phase).toBe('finished');
      nextAdOutcome = 'skipped';
      trigger('result:ad-revive');
      await flush();
      expect(eng.state.phase).toBe('finished');

      nextAdOutcome = 'completed';
      trigger('result:ad-revive');
      await flush();
      expect(eng.state.phase).toBe('playing');
      expect(eng.state.wave).toBe(3);
      expect(eng.state.sides.player.oranges).toBe(3);
      expect(eng.state.spawned).toBe(0);

      // 1. Strengthened Double Settlement (3/day): skipped -> no bonus; completed -> 2× coins + ingredients + wood + fragments!
      while (eng.state.phase !== 'finished') eng.skipWave();
      eng.state.result!.coins = 100;
      eng.state.result!.ingredientLoot = ['ing_yuzu', 'ing_honey'];
      eng.state.result!.villageLoot = ['res_onsen_wood', 'res_yuzu_essence'];
      eng.state.result!.loot = ['m02_slipper'];
      internals.handleBattleFinished(eng.state);
      internals.settlement.adDoubleCoinsAvailable = true;
      const beforeDblCoins = internals.profile.coins;
      const beforeDblWood = internals.profile.village.wood;
      const beforeDblHoney = internals.profile.ingredients.ing_honey ?? 0;

      nextAdOutcome = 'skipped';
      trigger('result:ad-double');
      await flush();
      expect(internals.settlement.adDoubleClaimed).toBe(false);
      expect(internals.profile.coins).toBe(beforeDblCoins);

      nextAdOutcome = 'completed';
      trigger('result:ad-double');
      await flush();
      expect(internals.settlement.adDoubleClaimed).toBe(true);
      expect(internals.profile.coins).toBe(beforeDblCoins + 100);
      expect(internals.profile.village.wood).toBe(beforeDblWood + 1);
      expect(internals.profile.ingredients.ing_honey).toBe(beforeDblHoney + 1);
      expect(getAdUsedToday(internals.profile, 'double_settlement', today)).toBe(1);
    } finally {
      app.dispose();
    }
  });
});
