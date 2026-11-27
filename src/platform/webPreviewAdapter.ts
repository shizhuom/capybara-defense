import type { SpriteImage } from '../render/AssetRegistry';
import { MinigameAudio } from './MinigameAudio';
import { computeViewport, screenToStage } from './viewport';
import type {
  KeyboardPromptOptions,
  PlatformAdapter,
  RewardedAdOutcome,
  ShareOptions,
  SubpackageName,
  TouchEventData,
  TouchHandlers,
  ViewportMetrics,
} from './types';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear() { data.clear(); },
    getItem: k => data.get(k) ?? null,
    key: i => [...data.keys()][i] ?? null,
    removeItem: k => { data.delete(k); },
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

export interface WebPreviewOptions {
  host?: HTMLElement;
  assetBase?: string;
}

/**
 * Browser preview adapter powering `minigame.html` so we can visually inspect, play,
 * and Playwright-test the exact same Canvas UI code that ships to WeChat and Bilibili.
 */
export function createWebPreviewAdapter(options: WebPreviewOptions = {}): PlatformAdapter {
  const host = options.host ?? document.getElementById('minigame-root') ?? document.body;
  const canvas = document.createElement('canvas');
  canvas.id = 'minigame-canvas';
  canvas.style.cssText = 'display:block;width:100vw;height:100dvh;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;';
  host.innerHTML = '';
  host.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is required for mini-game preview.');

  const assetBase = options.assetBase ?? `${import.meta.env.BASE_URL || './'}`;
  const disposers: Array<() => void> = [];
  const isTouchDevice = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

  function measure(): ViewportMetrics {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    const dpr = window.devicePixelRatio || 1;
    return computeViewport(w, h, dpr, { top: 0, bottom: 0, left: 0, right: 0 }, isTouchDevice());
  }

  function syncCanvasSize(vp: ViewportMetrics): void {
    const pw = Math.max(1, Math.round(vp.screenWidth * vp.dpr));
    const ph = Math.max(1, Math.round(vp.screenHeight * vp.dpr));
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  let cachedViewport = measure();
  syncCanvasSize(cachedViewport);

  const audio = new MinigameAudio();
  const onVisChange = () => {
    if (document.hidden) {
      audio.setPaused(true);
    } else {
      audio.setPaused(false);
    }
  };
  document.addEventListener('visibilitychange', onVisChange);
  disposers.push(() => document.removeEventListener('visibilitychange', onVisChange));
  let storage: Storage;
  try { storage = window.localStorage; } catch { storage = memoryStorage(); }

  const mapPointer = (event: PointerEvent): TouchEventData => {
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const { stageX, stageY } = screenToStage(sx, sy, cachedViewport);
    return {
      id: event.pointerId,
      screenX: sx,
      screenY: sy,
      stageX,
      stageY,
      pointerType: event.pointerType === 'touch' ? 'touch' : 'mouse',
    };
  };

  return {
    kind: 'web',
    canvas,
    ctx,
    storage,
    fetch: (input, init) => globalThis.fetch(input, init),
    audio,
    viewport: () => cachedViewport,
    onResize(callback) {
      const handler = () => {
        cachedViewport = measure();
        syncCanvasSize(cachedViewport);
        callback(cachedViewport);
      };
      window.addEventListener('resize', handler);
      const off = () => window.removeEventListener('resize', handler);
      disposers.push(off);
      return off;
    },
    onTouch(handlers: TouchHandlers) {
      let activeId: number | null = null;
      const onDown = (event: PointerEvent) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        audio.unlock();
        activeId = event.pointerId;
        try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
        handlers.start?.(mapPointer(event));
      };
      const onMove = (event: PointerEvent) => {
        if (activeId !== event.pointerId) return;
        event.preventDefault();
        handlers.move?.(mapPointer(event));
      };
      const onUp = (event: PointerEvent) => {
        if (activeId !== event.pointerId) return;
        activeId = null;
        try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
        handlers.end?.(mapPointer(event));
      };
      const onCancel = (event: PointerEvent) => {
        if (activeId !== event.pointerId) return;
        activeId = null;
        handlers.cancel?.(mapPointer(event));
      };
      const preventTouchScroll = (event: TouchEvent) => { event.preventDefault(); };
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onCancel);
      canvas.addEventListener('touchmove', preventTouchScroll, { passive: false });
      const off = () => {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onCancel);
        canvas.removeEventListener('touchmove', preventTouchScroll);
      };
      disposers.push(off);
      return off;
    },
    createImage: () => new Image() as SpriteImage,
    loadSubpackage: async (_name: SubpackageName) => true,
    resolveAssetPath: (relativePath: string) => `${assetBase.replace(/\/$/, '')}/${relativePath.replace(/^\.?\//, '')}`,
    showKeyboard(opts: KeyboardPromptOptions): Promise<string | null> {
      const result = typeof window.prompt === 'function' ? window.prompt(opts.placeholder ?? '', opts.value) : null;
      return Promise.resolve(result === null ? null : result.slice(0, opts.maxLength));
    },
    showRewardedAd(_adUnitId?: string): Promise<RewardedAdOutcome> {
      // Preview mode completes instantly when explicitly tested, or returns unavailable if no id.
      return Promise.resolve(_adUnitId ? 'completed' : 'unavailable');
    },
    share(_options: ShareOptions): void { /* no-op in browser preview */ },
    now: () => performance.now(),
    requestFrame: cb => window.requestAnimationFrame(cb),
    cancelFrame: id => window.cancelAnimationFrame(id),
    onShow(callback) {
      const handler = () => { if (!document.hidden) { audio.setPaused(false); callback(); } };
      document.addEventListener('visibilitychange', handler);
      const off = () => document.removeEventListener('visibilitychange', handler);
      disposers.push(off);
      return off;
    },
    onHide(callback) {
      const handler = () => { if (document.hidden) { audio.setPaused(true); callback(); } };
      document.addEventListener('visibilitychange', handler);
      const off = () => document.removeEventListener('visibilitychange', handler);
      disposers.push(off);
      return off;
    },
    dispose() {
      for (const off of disposers.splice(0)) { try { off(); } catch { /* ignore */ } }
    },
  };
}
