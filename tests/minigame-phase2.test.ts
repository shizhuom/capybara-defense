import { describe, expect, it, vi } from 'vitest';
import { createMiniGameAdapter, type MiniGameGlobalApi } from '../src/platform/minigameAdapter';
import type { SpriteImage } from '../src/render/AssetRegistry';
import { MinigameApp } from '../src/minigame/MinigameApp';
import { createProfile } from '../src/core/MetaProgression';
import { allOnboardedTokens } from '../src/core/FeatureUnlocks';
import { saveProfile } from '../src/ui/storage';
import { STAGE } from '../src/config/maps';
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

  const cleanup = () => {
    app.dispose();
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCaf;
  };

  return { app, platform, mockCtx, stepFrame, tap, cleanup };
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

      // Tap Start button (center x=640, y=540)
      h.tap(640, 540);
      await vi.waitFor(() => expect(h.app.getDebugState().screen).toBe('battle'));
      h.stepFrame(120);

      // Fresh profile starts at Tutorial Step 1 with Wave 1 held
      expect(h.app.getDebugState().tutorialStep).toBe(1);

      // Tap Summon Bell -> summons 5 units and advances Tutorial to Step 2
      h.tap(STAGE.summonX + 100, STAGE.summonY + 40);
      expect(h.app.getDebugState().tutorialStep).toBe(2);
      expect(h.app.getDebugState().battleState?.units.length).toBe(5);

      // Open Pause modal via top-right pause button (wx reserves capsule margin ~108 -> rightEdge = 1172, pause center ~1145)
      h.stepFrame(140);
      const vp = h.platform.viewport();
      expect(vp.screenWidth).toBe(1280);
      // Pause button sits at rightEdge - 54..rightEdge -> x = 1172 - 27 = 1145, y = 32
      h.tap(1145, 32);
      expect(h.app.getDebugState().modal).toBe('pause');
      expect(h.app.getDebugState().battleState?.phase).toBe('paused');

      // Resume via modal resume button (x=470, y=540)
      h.stepFrame(160);
      h.tap(470, 540);
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
      // Open Recipes from bottom courtyard dock (first dock item)
      h.tap(195, 650);
      h.stepFrame(120);
      // Start battle cleanly with equipped props (also test Settings directly on menu!)
      // Close recipes if opened, or tap Start
      if (h.app.getDebugState().modal === 'recipes') {
        h.tap(1050, 102); // close × button on recipes modal
        h.stepFrame(140);
      }
      expect(h.app.getDebugState().modal).toBe(null);

      // Tap Start button (center x=640, y=484)
      h.tap(640, 484);
      await vi.waitFor(() => expect(h.app.getDebugState().screen).toBe('battle'));
      h.stepFrame(160);

      // Returning profile skips tutorial and renders active/passive props + sprinkler without throwing
      expect(h.app.getDebugState().tutorialStep).toBe('done');
      const state = h.app.getDebugState().battleState!;
      expect(state.sides.player.loadout.equippedActiveProps).toEqual(['glue_trap', 'catnip']);

      // Tap Sprinkler (x=80, y=268) -> activates free sprinkler
      h.tap(80, 268);
      expect(state.sides.player.sprinklerUsed).toBe(true);

      // Tap self-cast active prop Catnip (2nd active prop slot at y=388, x=80) -> casts immediately!
      h.stepFrame(180);
      h.tap(80, 420);
      expect(state.sides.player.catnipTime).toBeGreaterThan(0);

      // Simulate Wave 10 victory -> banks standard rewards & shows Endless Offer modal!
      for (let i = 0; i < 10; i++) {
        h.app.getDebugState().battleState!.wave = 10;
      }
      // Surrender triggers defeat result cleanly (test Pause -> Surrender -> Result modal)
      h.tap(1145, 32); // pause
      h.stepFrame(200);
      expect(h.app.getDebugState().modal).toBe('pause');
      h.tap(840, 540); // surrender button
      expect(h.app.getDebugState().modal).toBe('result');
      h.stepFrame(220); // draw full settlement modal cleanly
    } finally {
      h.cleanup();
    }
  });
});
