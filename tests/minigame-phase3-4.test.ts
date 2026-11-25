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
  const tapHit = (id: string) => {
    const box = app.findHitBox(id);
    expect(box, `expected hitbox '${id}'`).toBeTruthy();
    tap(box!.x + box!.w / 2, box!.y + box!.h / 2);
  };
  const cleanup = () => {
    app.dispose();
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCaf;
  };

  return { app, platform, shared, subpackages, stepFrame, tap, tapHit, cleanup };
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

      // Tap "Try it now" green pill button on lightweight courtyard welcome card
      h.tapHit('onboard:go:armory');
      expect(h.app.getDebugState().modal).toBe('armory');
      // Starter gift granted 2 Fly Swatter fragments and unlocked m01_swatter!
      expect(h.app.getDebugState().profile.unlockedWeapons).toContain('m01_swatter');

      // Render Armory with live P19 in-dialog guide strip -> tap Fly Swatter big card to open Weapon Detail Sheet
      h.stepFrame(120);
      h.tapHit('armory:open:m01_swatter');
      expect(h.app.getDebugState().armory.detailWeaponId).toBe('m01_swatter');

      // Render Weapon Detail Sheet -> tap 1st horizontal hero card (kungfu_po) to equip!
      h.stepFrame(140);
      h.tapHit('armory:equip:kungfu_po:m01_swatter');
      expect(h.app.getDebugState().profile.equippedWeapons.kungfu_po).toBe('m01_swatter');
    } finally {
      h.cleanup();
    }
  });

  it('renders and operates Market (Shop/Backpack/Gacha), Onsen Village (Build/Pet/Harvest), Kitchen (Broths/Detail/Pantry), Medallions, 4-Tab Profile Hub & 6-Tab Compendium', async () => {
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
      // 1. Market: switch to Tab 3 (Lucky Gacha) & spin center button using free ticket (verifying chase animation!)
      h.app.openHub('market');
      h.stepFrame(100);
      h.tapHit('market:tab:lottery');
      h.stepFrame(120);
      expect(h.app.getDebugState().marketTab).toBe('lottery');
      h.tapHit('market:spin:auto');
      expect(h.app.getDebugState().profile.freeLotteryTickets).toBe(1);
      // Advance frames so the clockwise chase animation completes cleanly
      for (let t = 180; t <= 4000; t += 60) h.stepFrame(t);

      // 2. Village: collect offline harvest + switch to Build tab
      const coinsBeforeHarvest = h.app.getDebugState().profile.coins;
      h.app.openHub('village');
      h.stepFrame(140);
      h.tapHit('village:harvest');
      expect(h.app.getDebugState().profile.coins).toBeGreaterThan(coinsBeforeHarvest);
      h.tapHit('village:tab:build');
      h.stepFrame(160);
      expect(h.app.getDebugState().villageTab).toBe('build');

      // 3. Kitchen: brew Yuzu Calm Soak Lv.1 & verify auto-equip + open Pantry tab
      h.app.openHub('kitchen');
      h.stepFrame(180);
      h.tapHit('kitchen:brew:dish_yuzu_bath');
      expect(h.app.getDebugState().profile.unlockedBroths).toContain('dish_yuzu_bath');
      expect(h.app.getDebugState().profile.activeBrothId).toBe('dish_yuzu_bath');
      h.stepFrame(190);
      h.tapHit('kitchen:tab:pantry');
      h.stepFrame(195);
      expect(h.app.getDebugState().kitchenTab).toBe('pantry');

      // 4. Medallions: upgrade Ember Breakthrough to Lv.1
      h.app.openHub('medallions');
      h.stepFrame(200);
      h.tapHit('medallion:up:med_breakthrough_atk');
      expect(h.app.getDebugState().profile.endlessMedallions.med_breakthrough_atk).toBe(1);

      // 5. Unified 4-Tab Profile Wood Book: Rank Board -> Rename via wx.showKeyboard -> Endless Board -> Keeper Passport -> Settings
      h.app.openHub('leaderboard');
      h.stepFrame(220);
      await vi.waitFor(() => expect(h.app.getDebugState().modal).toBe('leaderboard'));
      h.tapHit('lb:rename');
      await vi.waitFor(() => expect(h.app.getDebugState().profile.nickname).toBe('温泉水豚王'));
      h.tapHit('profilehub:tab:endless-board');
      h.stepFrame(240);
      expect(h.app.getDebugState().modal).toBe('endless-board');
      expect(h.app.getDebugState().leaderboardTab).toBe('endless');

      // 6. Keeper Passport tab (Tab 3) -> shares card via wx.shareAppMessage
      h.tapHit('profilehub:tab:profile');
      h.stepFrame(260);
      expect(h.app.getDebugState().modal).toBe('profile');
      h.tapHit('profile:share');
      expect(h.shared.length).toBeGreaterThanOrEqual(1);

      // 7. 6-Tab Compendium -> open Bosses tab + Boss Detail Sheet cleanly
      h.app.openHub('recipes');
      h.stepFrame(280);
      h.tapHit('compendium:tab:bosses');
      h.stepFrame(300);
      expect(h.app.getDebugState().compendium.tab).toBe('bosses');
      h.tapHit('compendium:entry:rat');
      h.stepFrame(310);
      expect(h.app.getDebugState().compendium.detailId).toBeTruthy();

      // Share payload builder sanity check
      expect(buildSharePayload(h.app.getDebugState().profile, 'endless', 25).title).toContain('25');

      // 8. Developer QA API & 5-tap Settings signboard unlock
      h.app.openHub('settings');
      h.stepFrame(320);
      for (let i = 0; i < 5; i++) h.tapHit('settings:title-tap');
      expect(h.app.getDebugState().modal).toBe('dev');
      h.stepFrame(330);
      expect(h.app.findHitBox('dev:refill-stamina')).toBeTruthy();

      // Jumping to Stage 3 triggers Market onboarding cleanly & restores full stamina
      h.app.getDevApi().stage(3);
      expect(h.app.getDebugState().profile.stars).toBe(5);
      expect(h.app.getDebugState().profile.stamina).toBe(30);
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
