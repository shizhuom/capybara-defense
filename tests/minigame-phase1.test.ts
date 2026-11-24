import { describe, expect, it, vi } from 'vitest';
import { computeViewport, screenToStage } from '../src/platform/viewport';
import { createMiniGameAdapter, type MiniGameGlobalApi } from '../src/platform/minigameAdapter';
import { AssetRegistry, type SpriteImage } from '../src/render/AssetRegistry';
import { StickerRenderer } from '../src/render/StickerRenderer';
import { STAGE } from '../src/config/maps';
import { classifySprite, spriteRelativePath } from '../src/minigame/assetPack';
import { loadProfile, saveProfile } from '../src/ui/storage';
import { createProfile } from '../src/core/MetaProgression';
import manifest from '../public/assets/sprites/manifest.json';

function mockMiniApi() {
  const store = new Map<string, string>();
  const touchListeners: Record<string, Array<(ev: any) => void>> = { start: [], move: [], end: [], cancel: [] };
  const kbConfirm: Array<(res: { value: string }) => void> = [];
  const subpackagesLoaded: string[] = [];
  const shared: unknown[] = [];

  const setTransform = vi.fn();
  const mockCtx = new Proxy({
    setTransform,
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
    createImage: () => ({ width: 0, height: 0, src: '', onload: null, onerror: null }) as unknown as SpriteImage,
    getWindowInfo: () => ({ windowWidth: 852, windowHeight: 393, pixelRatio: 3, safeArea: { top: 0, bottom: 372, left: 59, right: 793 } }),
    getSystemInfoSync: () => ({ windowWidth: 852, windowHeight: 393, pixelRatio: 3 }),
    getStorageSync: key => store.get(key) ?? '',
    setStorageSync: (key, val) => { store.set(key, val); },
    removeStorageSync: key => { store.delete(key); },
    clearStorageSync: () => { store.clear(); },
    getStorageInfoSync: () => ({ keys: [...store.keys()] }),
    request(opts) {
      opts.success?.({ statusCode: 200, data: JSON.stringify({ ok: true, method: opts.method, url: opts.url }), header: { 'content-type': 'application/json' } });
    },
    loadSubpackage(opts) {
      subpackagesLoaded.push(opts.name);
      opts.success?.();
    },
    onTouchStart: cb => { touchListeners.start.push(cb); },
    onTouchMove: cb => { touchListeners.move.push(cb); },
    onTouchEnd: cb => { touchListeners.end.push(cb); },
    onTouchCancel: cb => { touchListeners.cancel.push(cb); },
    showKeyboard: () => { queueMicrotask(() => kbConfirm.forEach(fn => fn({ value: '水豚侠' }))); },
    onKeyboardConfirm: cb => { kbConfirm.push(cb); },
    offKeyboardConfirm: cb => { const i = kbConfirm.indexOf(cb); if (i >= 0) kbConfirm.splice(i, 1); },
    createRewardedVideoAd: () => ({
      load: async () => {},
      show: async () => {},
      onClose: cb => { queueMicrotask(() => cb({ isEnded: true })); },
    }),
    shareAppMessage: opts => { shared.push(opts); },
  };

  return { api, store, touchListeners, subpackagesLoaded, shared, mockCanvas, mockCtx };
}

describe('Mini-Game Phase 1: Platform layer, Viewport safe-area, Assets & Subpackages', () => {
  it('fills full screen without bottom or side black bars across 19.5:9 iPhones, 21:9 Androids, 4:3 iPads & desktops while tracking safe areas and capsule', () => {
    // iPhone 15 Pro landscape (852×393) with 21px Home Indicator, 59px Dynamic Island & WeChat capsule at left=748
    const phone = computeViewport(852, 393, 3, { top: 0, bottom: 21, left: 59, right: 59 }, true, { left: 748 });
    expect(phone.dpr).toBe(2.5); // clamped
    expect(phone.stageCssHeight).toBeCloseTo(393, 4); // full height — zero bottom black bar!
    expect(phone.stageCssY).toBeCloseTo(0, 4);
    expect(phone.visible.left).toBeLessThan(-130); // full-bleed extends seamlessly left
    expect(phone.visible.right).toBeGreaterThan(1410); // and right
    expect(phone.safeStage.left).toBeGreaterThan(phone.visible.left); // respects Dynamic Island
    expect(phone.capsuleStageLeft).toBeGreaterThan(1200); // exact WeChat capsule coordinate
    const center = screenToStage(phone.stageCssX + phone.stageCssWidth / 2, phone.stageCssY + phone.stageCssHeight / 2, phone);
    expect(center.stageX).toBeCloseTo(STAGE.width / 2, 4);
    expect(center.stageY).toBeCloseTo(STAGE.height / 2, 4);

    // 21:9 Android landscape (926×393): full height + wider horizontal bleed
    const android21 = computeViewport(926, 393, 2.5, { top: 0, bottom: 0, left: 42, right: 0 }, true);
    expect(android21.stageCssHeight).toBeCloseTo(393, 4);
    expect(android21.visible.left).toBeLessThan(-200);
    expect(android21.visible.right).toBeGreaterThan(1480);

    // iPad 4:3 (1024×768): full width + vertical bleed top & bottom (zero black bars!)
    const ipad = computeViewport(1024, 768, 2, undefined, true);
    expect(ipad.stageCssWidth).toBeCloseTo(1024, 4);
    expect(ipad.visible.top).toBeCloseTo(-120, 4);
    expect(ipad.visible.bottom).toBeCloseTo(840, 4);

    // Desktop 1440×900 (16:10): full width + subtle vertical bleed
    const desktop = computeViewport(1440, 900, 1, undefined, false);
    expect(desktop.stageCssWidth).toBeCloseTo(1440, 4);
    expect(desktop.stageCssY).toBeCloseTo((900 - 810) / 2, 4);
  });

  it('adapts both wx and bl runtimes cleanly for storage, fetch, touch mapping, subpackages, keyboard and ads', async () => {
    for (const kind of ['wx', 'bl'] as const) {
      const { api, touchListeners, subpackagesLoaded, shared } = mockMiniApi();
      const platform = createMiniGameAdapter(api, kind);
      expect(platform.kind).toBe(kind);

      // Profile save/load works zero-diff through createMiniStorage
      const p = { ...createProfile(), coins: 777, stars: 24 };
      expect(saveProfile(p, platform.storage)).toBe(true);
      expect(loadProfile(platform.storage)).toMatchObject({ coins: 777, stars: 24 });

      // wx.request / bl.request works as fetch
      const res = await platform.fetch('https://example.com/api/health', { method: 'GET' });
      expect(res.ok).toBe(true);
      expect(await res.json()).toMatchObject({ ok: true, method: 'GET' });

      // Subpackages deduplicate calls
      expect(await platform.loadSubpackage('maps')).toBe(true);
      expect(await platform.loadSubpackage('maps')).toBe(true);
      expect(subpackagesLoaded).toEqual(['maps']);

      // Touch event maps into 1280×720 stage coords
      const received: Array<{ stageX: number; stageY: number }> = [];
      platform.onTouch({ start: pt => received.push({ stageX: pt.stageX, stageY: pt.stageY }) });
      const vp = platform.viewport();
      touchListeners.start[0]({ changedTouches: [{ identifier: 1, clientX: vp.stageCssX + vp.stageCssWidth / 2, clientY: vp.stageCssY + vp.stageCssHeight / 2 }] });
      expect(received[0].stageX).toBeCloseTo(STAGE.width / 2, 2);
      expect(received[0].stageY).toBeCloseTo(STAGE.height / 2, 2);

      // Keyboard prompt, rewarded ad and share
      expect(await platform.showKeyboard({ value: '', maxLength: 10 })).toBe('水豚侠');
      expect(await platform.showRewardedAd('adunit-123')).toBe('completed');
      expect(await platform.showRewardedAd()).toBe('unavailable');
      platform.share({ title: '温泉守卫战' });
      expect(shared).toHaveLength(1);
    }
  });

  it('supports mini-game images with width/height (without naturalWidth), lazy loading, and unloading in AssetRegistry', async () => {
    const reg = new AssetRegistry('./assets/sprites/', { autoLoad: false });
    const created: Array<{ src: string }> = [];
    reg.configureLoader({
      createImage: () => {
        const img: Record<string, unknown> = { width: 128, height: 128, onload: null, onerror: null };
        Object.defineProperty(img, 'src', {
          set(val: string) {
            created.push({ src: val });
            if (val) queueMicrotask(() => (img.onload as (() => void) | null)?.());
          },
          get() { return created.at(-1)?.src ?? ''; },
        });
        return img as unknown as SpriteImage;
      },
    });
    expect(await reg.loadSprite('panda', 'assets/sprites/panda.webp')).toBe(true);
    expect(reg.has('panda')).toBe(true);
    expect(reg.url('panda')).toBe('assets/sprites/panda.webp');
    expect(reg.unloadSprites(id => id === 'panda')).toBe(1);
    expect(reg.has('panda')).toBe(false);
  });

  it('respects managedViewport in StickerRenderer without resizing host canvas', () => {
    const { mockCanvas, mockCtx } = mockMiniApi();
    mockCanvas.width = 2130;
    mockCanvas.height = 983;
    const renderer = new StickerRenderer(mockCanvas, { managedViewport: true });
    renderer.setViewportTransform(1.5, 100, 20);
    renderer.drawPreview('sunny_backyard', 1.2, 3);
    expect(mockCanvas.width).toBe(2130);
    expect(mockCanvas.height).toBe(983);
    expect(mockCtx.setTransform).toHaveBeenCalledWith(1.5, 0, 0, 1.5, 100, 20);
  });

  it('patches Chromium 99 / WeChat DevTools roundRect so numeric radii never throw during rendering', () => {
    const { api, mockCtx } = mockMiniApi();
    const arcTo = vi.fn();
    mockCtx.arcTo = arcTo;
    // Simulate Chromium 99 (WeChat DevTools 1.06.x), which throws TypeError on bare numeric radius
    mockCtx.roundRect = (_x: number, _y: number, _w: number, _h: number, radii: unknown) => {
      if (typeof radii === 'number') {
        throw new TypeError("Failed to execute 'roundRect' on 'CanvasRenderingContext2D': The provided value cannot be converted to a sequence.");
      }
    };
    const platform = createMiniGameAdapter(api, 'wx');
    const renderer = new StickerRenderer(platform.canvas, { managedViewport: true });
    expect(() => renderer.drawPreview('sunny_backyard', 0.5, 3)).not.toThrow();
    expect(() => platform.ctx.roundRect(10, 20, 120, 48, 12)).not.toThrow();
    expect(() => platform.ctx.roundRect(10, 20, 120, 48, [8, 12, 8, 12])).not.toThrow();
    expect(arcTo).toHaveBeenCalled();
  });

  it('classifies every sprite in manifest.json cleanly across main, maps and meta packages', () => {
    const counts = { main: 0, maps: 0, meta: 0, omitted: 0 };
    for (const id of manifest as string[]) {
      const rule = classifySprite(id);
      if (rule.omit) { counts.omitted++; continue; }
      counts[rule.pkg]++;
      const rel = spriteRelativePath(id);
      expect(rel).toMatch(/^assets\/sprites\/.+\.(jpg|webp)$/);
    }
    expect(counts.main).toBeGreaterThan(60);
    expect(counts.maps).toBeGreaterThanOrEqual(10);
    expect(counts.meta).toBeGreaterThan(100);
    expect(counts.omitted).toBe(1); // unused legacy menu_banner
  });
});
