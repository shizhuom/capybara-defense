import { describe, expect, it, vi } from 'vitest';
import { createMiniGameAdapter, type MiniGameGlobalApi } from '../src/platform/minigameAdapter';
import type { SpriteImage } from '../src/render/AssetRegistry';
import { MinigameApp } from '../src/minigame/MinigameApp';
import { createProfile, unlockAllProfile } from '../src/core/MetaProgression';
import { saveProfile } from '../src/ui/storage';
import { STAGE } from '../src/config/maps';
import { buildSharePayload } from '../src/minigame/adConfig';
import type { Profile } from '../src/core/types';

function createFullHarness(initialProfile: Profile) {
  const store = new Map<string, string>();
  const listeners: Record<'start' | 'move' | 'end' | 'cancel', Array<(ev: any) => void>> = {
    start: [], move: [], end: [], cancel: [],
  };
  const kbConfirm: Array<(res: { value: string }) => void> = [];
  const shared: unknown[] = [];
  const subpackages: string[] = [];
  const frames: Array<(ts: number) => void> = [];
  const origRaf = globalThis.requestAnimationFrame;
  const origCaf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { frames.push(cb); return frames.length; }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;

  const mockCtx = new Proxy({
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    measureText: (s: string) => ({ width: s.length * 10 }),
  } as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return () => {};
    },
  });
  const mockCanvas = { width: 0, height: 0, getContext: () => mockCtx } as unknown as HTMLCanvasElement;

  const api: MiniGameGlobalApi = {
    createCanvas: () => mockCanvas,
    createImage: () => {
      const img: Record<string, unknown> = { width: 64, height: 64, onload: null, onerror: null };
      let currentSrc = '';
      Object.defineProperty(img, 'src', {
        set(val: string) {
          currentSrc = val;
          if (val) queueMicrotask(() => (img.onload as (() => void) | null)?.());
        },
        get() { return currentSrc; },
      });
      return img as unknown as SpriteImage;
    },
    getWindowInfo: () => ({ windowWidth: 1280, windowHeight: 720, pixelRatio: 1 }),
    getSystemInfoSync: () => ({ windowWidth: 1280, windowHeight: 720, pixelRatio: 1 }),
    getStorageSync: key => store.get(key) ?? '',
    setStorageSync: (key, val) => { store.set(key, val); },
    removeStorageSync: key => { store.delete(key); },
    clearStorageSync: () => { store.clear(); },
    getStorageInfoSync: () => ({ keys: [...store.keys()] }),
    request(opts) {
      opts.success?.({
        statusCode: 200,
        data: JSON.stringify({
          ok: true,
          totalPlayers: 2,
          entries: [
            { rank: 1, nickname: '泡澡宗师', avatarId: 'zen_capy', stars: 168, highestStars: 168, wins: 120, matches: 140, bestWinStreak: 18, bestWave: 42, elapsedSeconds: 900, mvpKind: 'kungfu_po', mvpAwakened: true, awakenedCount: 4, medallionTotal: 120 },
          ],
          me: null,
        }),
      });
    },
    loadSubpackage(opts) {
      subpackages.push(opts.name);
      opts.success?.();
    },
    onTouchStart: cb => { listeners.start.push(cb); },
    onTouchMove: cb => { listeners.move.push(cb); },
    onTouchEnd: cb => { listeners.end.push(cb); },
    onTouchCancel: cb => { listeners.cancel.push(cb); },
    showKeyboard: () => { queueMicrotask(() => kbConfirm.forEach(fn => fn({ value: '温泉水豚王' }))); },
    onKeyboardConfirm: cb => { kbConfirm.push(cb); },
    offKeyboardConfirm: cb => { const i = kbConfirm.indexOf(cb); if (i >= 0) kbConfirm.splice(i, 1); },
    shareAppMessage: opts => { shared.push(opts); },
  };

  const platform = createMiniGameAdapter(api, 'wx');
  saveProfile(initialProfile, platform.storage);
  const app = new MinigameApp(platform);

  const stepFrame = (ts: number) => {
    const cb = frames.shift();
    if (cb) cb(ts);
  };
  const tap = (stageX: number, stageY: number) => {
    const vp = platform.viewport();
    const clientX = vp.stageCssX + (stageX / STAGE.width) * vp.stageCssWidth;
    const clientY = vp.stageCssY + (stageY / STAGE.height) * vp.stageCssHeight;
    const ev = { changedTouches: [{ identifier: 1, clientX, clientY }] };
    listeners.start.forEach(fn => fn(ev));
    listeners.end.forEach(fn => fn(ev));
  };
  const cleanup = () => {
    app.dispose();
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCaf;
  };

  return { app, platform, shared, subpackages, stepFrame, tap, cleanup };
}

describe('Mini-Game Phases 3 & 4: All 7 Meta Hubs, P19 Onboarding, Online Leaderboard, Keyboard Rename & Share', () => {
  it('triggers P19 progressive onboarding after Match 1, claims Fly Swatter starter gift, and opens Armory', () => {
    const postMatch1: Profile = {
      ...createProfile(),
      matches: 1,
      wins: 1,
      stars: 1,
      highestStars: 1,
      tutorialCompleted: true,
      tutorialRewardClaimed: true,
      onboardedFeatures: [],
    };
    const h = createFullHarness(postMatch1);
    try {
      h.stepFrame(100);
      expect(h.app.getDebugState().modal).toBe('onboard');

      // Tap "Try it now" button (px=296, pw=688, button at x=544..956, y=535..591)
      h.tap(750, 563);
      expect(h.app.getDebugState().modal).toBe('armory');
      // Starter gift granted 2 Fly Swatter fragments and unlocked m01_swatter!
      expect(h.app.getDebugState().profile.unlockedWeapons).toContain('m01_swatter');
      expect(h.subpackages).toContain('meta');

      // Render Armory and equip m01_swatter on Kung-Fu Po (1st hero card at right panel)
      h.stepFrame(120);
      h.tap(820, 524);
      expect(h.app.getDebugState().profile.equippedWeapons.kungfu_po).toBe('m01_swatter');
    } finally {
      h.cleanup();
    }
  });

  it('renders and operates Market (Shop/Gacha/Backpack), Onsen Village (Build/Pet/Harvest), Kitchen, Medallions, Leaderboard & Profile', async () => {
    const rich = {
      ...unlockAllProfile(createProfile()),
      endlessMedallions: {
        med_breakthrough_atk: 0,
        med_luck_rate: 0,
        med_momentum: 0,
        med_boss_resist: 0,
        med_boss_slayer: 0,
        med_capy_shield: 0,
      },
      unlockedBroths: [],
      brothLevels: {},
      activeBrothId: null,
      freeLotteryTickets: 2,
      village: {
        wood: 200,
        essence: 80,
        facilities: { fac_bamboo_pool: 1 },
        lastHarvestAt: Date.now() - 3 * 3600_000,
        petTapDay: '',
        petTapCount: 0,
      },
    };
    const h = createFullHarness(rich);
    try {
      // 1. Market: switch to Gacha & spin using free ticket
      h.app.openHub('market');
      h.stepFrame(100);
      h.tap(554, 138); // Honey-Oak Gacha tab
      h.stepFrame(120);
      expect(h.app.getDebugState().marketTab).toBe('gacha');
      h.tap(416, 424); // center Spin button
      expect(h.app.getDebugState().profile.freeLotteryTickets).toBe(1);

      // 2. Village: collect offline harvest + switch to Build tab + upgrade Bamboo Pool
      const coinsBeforeHarvest = h.app.getDebugState().profile.coins;
      h.app.openHub('village');
      h.stepFrame(140);
      expect(h.subpackages).toContain('maps');
      h.tap(1020, 626); // Harvest Collect button
      expect(h.app.getDebugState().profile.coins).toBeGreaterThan(coinsBeforeHarvest);
      h.tap(549, 138); // Honey-Oak Facilities tab
      h.stepFrame(160);
      expect(h.app.getDebugState().villageTab).toBe('build');

      // 3. Kitchen: brew Yuzu Calm Soak Lv.1 & verify auto-equip
      h.app.openHub('kitchen');
      h.stepFrame(180);
      h.tap(554, 364); // Brew Lv.1 on 1st card (dish_yuzu_bath)
      expect(h.app.getDebugState().profile.unlockedBroths).toContain('dish_yuzu_bath');
      expect(h.app.getDebugState().profile.activeBrothId).toBe('dish_yuzu_bath');

      // 4. Medallions: upgrade Ember Breakthrough to Lv.1
      h.app.openHub('medallions');
      h.stepFrame(200);
      h.tap(535, 288); // Upgrade button on 1st medallion card
      expect(h.app.getDebugState().profile.endlessMedallions.med_breakthrough_atk).toBe(1);

      // 5. Leaderboard: syncs via wx.request, switches to Endless & 54-Rank Ladder, renames via wx.showKeyboard, and shares
      h.app.openHub('leaderboard');
      h.stepFrame(220);
      await vi.waitFor(() => expect(h.app.getDebugState().modal).toBe('leaderboard'));
      h.tap(945, 51); // Rename button -> triggers wx.showKeyboard -> sets '温泉水豚王'
      await vi.waitFor(() => expect(h.app.getDebugState().profile.nickname).toBe('温泉水豚王'));
      h.tap(756, 138); // Honey-Oak 54-Rank Ladder tab
      h.stepFrame(240);
      expect(h.app.getDebugState().leaderboardTab).toBe('ladder');

      // 6. Keeper Profile: renders 16-avatar wall and shares card via wx.shareAppMessage
      h.app.openHub('profile');
      h.stepFrame(260);
      h.tap(1042, 242); // Share card button
      expect(h.shared.length).toBeGreaterThanOrEqual(1);

      // 7. Full 4-tab Compendium renders Enemies & Rules cleanly without throwing
      h.app.openHub('recipes');
      h.stepFrame(280);
      h.tap(699, 138); // Honey-Oak Enemies tab
      h.stepFrame(300);
      h.tap(893, 138); // Honey-Oak Rules tab
      h.stepFrame(320);

      // Share payload builder sanity check
      expect(buildSharePayload(h.app.getDebugState().profile, 'endless', 25).title).toContain('25');

      // 8. Developer QA API: jumping to Stage 3 triggers Market onboarding cleanly
      h.app.getDevApi().stage(3);
      expect(h.app.getDebugState().profile.stars).toBe(5);
      expect(h.app.getDebugState().modal).toBe('onboard');
    } finally {
      h.cleanup();
    }
  });

  it('installs MiniURLSearchParams polyfill cleanly when global URLSearchParams is absent (WeChat Mini Game runtime)', async () => {
    const { MiniURLSearchParams, installMiniPolyfills } = await import('../src/platform/polyfills');
    const g = globalThis as unknown as Record<string, unknown>;
    const orig = g.URLSearchParams;
    try {
      delete g.URLSearchParams;
      installMiniPolyfills();
      expect(g.URLSearchParams).toBe(MiniURLSearchParams);
      const q = new (g.URLSearchParams as typeof MiniURLSearchParams)({ limit: '100', playerId: 'capy_test1234' });
      q.set('name', '水豚');
      expect(q.toString()).toContain('limit=100');
      expect(q.toString()).toContain('playerId=capy_test1234');
      expect(q.get('name')).toBe('水豚');
    } finally {
      g.URLSearchParams = orig;
    }
  });
});
