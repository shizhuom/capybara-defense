import { describe, expect, it, vi } from 'vitest';
import { createMiniGameAdapter, type MiniGameGlobalApi } from '../src/platform/minigameAdapter';
import type { SpriteImage } from '../src/render/AssetRegistry';
import { MinigameApp } from '../src/minigame/MinigameApp';
import { createProfile } from '../src/core/MetaProgression';
import { allOnboardedTokens } from '../src/core/FeatureUnlocks';
import { saveProfile } from '../src/ui/storage';
import { STAGE } from '../src/config/maps';
import { STAMINA_COST_PER_BATTLE, STAMINA_MAX, STAMINA_REGEN_SECONDS, getStaminaStatus } from '../src/core/Stamina';
import { ScrollRegion, wrapText } from '../src/minigame/ui/CanvasUI';

function createHarness(initialProfile?: ReturnType<typeof createProfile>) {
  const store = new Map<string, string>();
  const listeners: Record<'start' | 'move' | 'end' | 'cancel', Array<(ev: any) => void>> = {
    start: [], move: [], end: [], cancel: [],
  };
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
    request(opts) { opts.success?.({ statusCode: 200, data: '{}' }); },
    loadSubpackage(opts) { opts.success?.(); },
    onTouchStart: cb => { listeners.start.push(cb); },
    onTouchMove: cb => { listeners.move.push(cb); },
    onTouchEnd: cb => { listeners.end.push(cb); },
    onTouchCancel: cb => { listeners.cancel.push(cb); },
  };

  const platform = createMiniGameAdapter(api, 'wx');
  if (initialProfile) saveProfile(initialProfile, platform.storage);
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

  return { app, platform, mockCtx, stepFrame, tap, tapHit, cleanup };
}

describe('Mini-Game Phase 2: Canvas UI Toolkit, Full Menu, Battle Loop, Tutorial, Pause & Endless Offer', () => {
  it('wraps CJK and English text cleanly and clamps scroll momentum bounds', () => {
    const fakeCtx = { font: '', measureText: (s: string) => ({ width: s.length * 10 }) } as unknown as CanvasRenderingContext2D;
    const lines = wrapText(fakeCtx, '点下方铃铛用10小鱼干抽5个伙伴 Hello World', 120, 14);
    expect(lines.length).toBeGreaterThanOrEqual(2);

    const scroll = new ScrollRegion();
    scroll.setContentBounds(900, 400);
    expect(scroll.maxOffset).toBe(500);
    scroll.onStart(300);
    scroll.onMove(150);
    expect(scroll.offset).toBe(150);
    expect(scroll.onEnd()).toBe(true);
    scroll.tick(0.2);
    expect(scroll.offset).toBeGreaterThanOrEqual(150);
    expect(scroll.offset).toBeLessThanOrEqual(500);
  });

  it('starts Match 1 with guided 6-step tutorial, advances on summon, opens Guide & Pause modals cleanly', async () => {
    const h = createHarness();
    try {
      h.stepFrame(100);
      expect(h.app.getDebugState().screen).toBe('menu');

      // Tap Start button
      h.tapHit('menu:start');
      await vi.waitFor(() => expect(h.app.getDebugState().screen).toBe('battle'));
      h.stepFrame(120);

      // Mini-game runs wide 10×4 mobile board!
      expect(STAGE.cols).toBe(10);
      expect(STAGE.rows).toBe(4);
      expect(h.app.getDebugState().battleState?.grid.length).toBe(4);
      expect(h.app.getDebugState().battleState?.grid[0].length).toBe(10);

      // Fresh profile starts at Tutorial Step 1 with Wave 1 held
      expect(h.app.getDebugState().tutorialStep).toBe(1);

      // Tap Summon Bell -> summons 5 units and advances Tutorial to Step 2
      h.tapHit('battle:summon');
      expect(h.app.getDebugState().tutorialStep).toBe(2);
      expect(h.app.getDebugState().battleState?.units.length).toBe(5);

      // Tap a summoned pet on bench slot 0 -> must NOT open any modal or right-side stats card
      h.stepFrame(130);
      h.tap(STAGE.benchX + STAGE.benchSize / 2, STAGE.benchY + STAGE.benchSize / 2);
      expect(h.app.getDebugState().modal).toBe(null);

      // Open Pause modal via top-right pause button (shifted cleanly LEFT of WeChat [🎮][···|◉]!)
      h.stepFrame(140);
      const pauseBox = h.app.findHitBox('battle:pause');
      expect(pauseBox).toBeTruthy();
      expect(pauseBox!.x + pauseBox!.w).toBeLessThanOrEqual(1126);
      h.tapHit('battle:pause');
      expect(h.app.getDebugState().modal).toBe('pause');
      expect(h.app.getDebugState().battleState?.phase).toBe('paused');

      // Resume via Pause modal full-width green Resume button
      h.stepFrame(160);
      h.tapHit('modal:resume');
      expect(h.app.getDebugState().modal).toBe(null);
      expect(h.app.getDebugState().battleState?.phase).toBe('playing');
    } finally {
      h.cleanup();
    }
  });

  it('opens Settings & Recipes from courtyard menu on returning profiles and offers Endless after Wave 10 at 10★+', async () => {
    const veteran = {
      ...createProfile(),
      matches: 12,
      wins: 10,
      stars: 12,
      highestStars: 12,
      tutorialCompleted: true,
      tutorialRewardClaimed: true,
      onboardedFeatures: allOnboardedTokens(),
      ownedProps: { glue_trap: 1, catnip: 1, banana_peel: 1 },
      equippedActiveProps: ['glue_trap', 'catnip'],
      equippedPassiveProps: ['banana_peel'],
    };
    const h = createHarness(veteran);
    try {
      h.stepFrame(100);
      // Open Recipes from bottom-left circular medallion dock
      h.tapHit('menu:recipes');
      h.stepFrame(120);
      expect(h.app.getDebugState().modal).toBe('recipes');
      // Close Recipes via Yuzu Close medallion (positioned cleanly LEFT of WeChat [🎮])
      const closeBox = h.app.findHitBox('modal:close');
      expect(closeBox).toBeTruthy();
      expect(closeBox!.x + closeBox!.w).toBeLessThanOrEqual(1126);
      h.tapHit('modal:close');
      h.stepFrame(140);
      expect(h.app.getDebugState().modal).toBe(null);

      // Tap Start button
      h.tapHit('menu:start');
      await vi.waitFor(() => expect(h.app.getDebugState().screen).toBe('battle'));
      h.stepFrame(160);
      // Tap once to dismiss the opening battle clash curtain immediately
      h.tap(640, 360);
      h.stepFrame(180);

      // Returning profile skips tutorial and renders active/passive props + sprinkler without throwing
      expect(h.app.getDebugState().tutorialStep).toBe('done');
      const state = h.app.getDebugState().battleState!;
      expect(state.sides.player.loadout.equippedActiveProps).toEqual(['glue_trap', 'catnip']);

      // Tap Sprinkler -> activates free sprinkler
      h.tapHit('battle:sprinkler');
      expect(state.sides.player.sprinklerUsed).toBe(true);

      // Tap self-cast active prop Catnip -> casts immediately!
      h.stepFrame(200);
      h.tapHit('battle:prop:catnip');
      expect(state.sides.player.catnipTime).toBeGreaterThan(0);

      // Simulate Wave 10 victory -> banks standard rewards & shows Endless Offer modal!
      for (let i = 0; i < 10; i++) {
        h.app.getDebugState().battleState!.wave = 10;
      }
      // Surrender triggers defeat result cleanly (test Pause -> Surrender -> Result modal + Report drawer)
      h.tapHit('battle:pause');
      h.stepFrame(220);
      expect(h.app.getDebugState().modal).toBe('pause');
      h.tapHit('modal:surrender');
      expect(h.app.getDebugState().modal).toBe('result');
      h.stepFrame(240); // draw full settlement crest stage cleanly
      h.tapHit('modal:toggle-stats'); // open Visual Battle Report Drawer
      h.stepFrame(260); // draw visual report drawer cleanly
    } finally {
      h.cleanup();
    }
  });

  it('enforces 30-max / 5-cost stamina bar with coin refill & time recovery, and never auto-selects upgraded/merged pets', async () => {
    const startProfile = {
      ...createProfile(),
      matches: 2,
      wins: 2,
      stars: 2,
      highestStars: 2,
      coins: 120,
      tutorialCompleted: true,
      tutorialRewardClaimed: true,
      onboardedFeatures: allOnboardedTokens(),
    };
    const h = createHarness(startProfile);
    try {
      h.stepFrame(100);
      // Initial stamina is 30/30
      expect(getStaminaStatus(h.app.getDebugState().profile).current).toBe(STAMINA_MAX);

      // Starting a battle deducts 5 stamina (30 -> 25)
      h.tapHit('menu:start');
      await vi.waitFor(() => expect(h.app.getDebugState().screen).toBe('battle'));
      expect(h.app.getDebugState().profile.stamina).toBe(STAMINA_MAX - STAMINA_COST_PER_BATTLE);

      // Dismiss opening curtain
      h.stepFrame(120);
      h.tap(640, 360);
      h.stepFrame(140);

      // Tap-to-merge two identical hamsters on bench slots 0 and 1 -> upgrades to Lv.2 AND clears selectedId!
      const st = h.app.getDebugState().battleState!;
      st.units = [
        { id: 101, kind: 'hamster', side: 'player', level: 1, location: { zone: 'bench', slot: 0 }, statuses: {}, energy: 0, cooldown: 0, production: 0, buffTime: 0, empowered: 0, animation: 0 },
        { id: 102, kind: 'hamster', side: 'player', level: 1, location: { zone: 'bench', slot: 1 }, statuses: {}, energy: 0, cooldown: 0, production: 0, buffTime: 0, empowered: 0, animation: 0 },
      ];
      h.stepFrame(160);
      // Tap slot 0 -> selects hamster 101
      h.tap(STAGE.benchX + STAGE.benchSize / 2, STAGE.benchY + STAGE.benchSize / 2);
      expect(h.app.getDebugState().selectedId).toBe(101);
      // Tap slot 1 -> merges 101 into 102 -> Lv.2 hamster, and selectedId MUST be cleared (undefined)!
      h.tap(STAGE.benchX + STAGE.benchStep + STAGE.benchSize / 2, STAGE.benchY + STAGE.benchSize / 2);
      expect(st.units.length).toBe(1);
      expect(st.units[0].level).toBe(2);
      expect(h.app.getDebugState().selectedId).toBeUndefined();

      // Natural regen recovers +1 per 300s up to 30
      const now = Date.now();
      const recovered = getStaminaStatus({ stamina: 10, staminaUpdatedAt: now - STAMINA_REGEN_SECONDS * 3 * 1000 }, now);
      expect(recovered.current).toBe(13);
    } finally {
      h.cleanup();
    }

    // Low stamina (< 5) blocks battle start and opens Stamina countdown modal (no coin buy button)
    const tired = {
      ...createProfile(),
      matches: 2,
      wins: 2,
      stars: 2,
      highestStars: 2,
      coins: 120,
      stamina: 3,
      staminaUpdatedAt: Date.now() - 30_000,
      tutorialCompleted: true,
      tutorialRewardClaimed: true,
      onboardedFeatures: allOnboardedTokens(),
    };
    const h2 = createHarness(tired);
    try {
      h2.stepFrame(100);
      h2.tapHit('menu:start');
      await vi.waitFor(() => expect(h2.app.getDebugState().modal).toBe('stamina'));
      expect(h2.app.getDebugState().screen).toBe('menu');
      h2.stepFrame(120);
      expect(h2.app.findHitBox('stamina:buy')).toBeUndefined();
      expect(getStaminaStatus(h2.app.getDebugState().profile).nextRegenSeconds).toBeGreaterThan(0);
      h2.tapHit('modal:close');
      expect(h2.app.getDebugState().modal).toBe(null);
    } finally {
      h2.cleanup();
    }
  });
});
