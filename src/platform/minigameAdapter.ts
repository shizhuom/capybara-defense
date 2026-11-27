import type { SpriteImage } from '../render/AssetRegistry';
import { MinigameAudio } from './MinigameAudio';
import { computeViewport, screenToStage } from './viewport';
import type {
  KeyboardPromptOptions,
  PlatformAdapter,
  PlatformKind,
  RewardedAdOutcome,
  ShareOptions,
  SubpackageName,
  TouchEventData,
  TouchHandlers,
  ViewportMetrics,
} from './types';

/** Minimal structural surface shared by both WeChat (`wx`) and Bilibili (`bl`) mini-game globals. */
export interface MiniGameGlobalApi {
  createCanvas(): HTMLCanvasElement;
  createImage(): SpriteImage;
  getWindowInfo?: () => { windowWidth: number; windowHeight: number; pixelRatio: number; safeArea?: { top: number; bottom: number; left: number; right: number } };
  getMenuButtonBoundingClientRect?: () => { left: number; right: number; top: number; bottom: number; width: number; height: number };
  getSystemInfoSync(): { windowWidth: number; windowHeight: number; pixelRatio: number; safeArea?: { top: number; bottom: number; left: number; right: number } };
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: string): void;
  removeStorageSync(key: string): void;
  clearStorageSync?: () => void;
  getStorageInfoSync?: () => { keys: string[] };
  request(opts: {
    url: string;
    method?: string;
    header?: Record<string, string>;
    data?: unknown;
    dataType?: string;
    timeout?: number;
    success?: (res: { statusCode: number; data: unknown; header?: Record<string, string> }) => void;
    fail?: (err: unknown) => void;
  }): { abort?: () => void } | void;
  loadSubpackage?: (opts: { name: string; success?: () => void; fail?: (err: unknown) => void }) => void;
  createWebAudioContext?: () => unknown;
  setInnerAudioOption?: (opts: { mixWithOther?: boolean; obeyMuteSwitch?: boolean; speakerOn?: boolean; success?: () => void; fail?: (err: unknown) => void }) => void;
  onAudioInterruptionBegin?: (cb: () => void) => void;
  offAudioInterruptionBegin?: (cb: () => void) => void;
  onAudioInterruptionEnd?: (cb: () => void) => void;
  offAudioInterruptionEnd?: (cb: () => void) => void;
  onTouchStart: (cb: (e: MiniTouchEvent) => void) => void;
  onTouchMove: (cb: (e: MiniTouchEvent) => void) => void;
  onTouchEnd: (cb: (e: MiniTouchEvent) => void) => void;
  onTouchCancel: (cb: (e: MiniTouchEvent) => void) => void;
  offTouchStart?: (cb: (e: MiniTouchEvent) => void) => void;
  offTouchMove?: (cb: (e: MiniTouchEvent) => void) => void;
  offTouchEnd?: (cb: (e: MiniTouchEvent) => void) => void;
  offTouchCancel?: (cb: (e: MiniTouchEvent) => void) => void;
  onWindowResize?: (cb: () => void) => void;
  offWindowResize?: (cb: () => void) => void;
  onDeviceOrientationChange?: (cb: () => void) => void;
  offDeviceOrientationChange?: (cb: () => void) => void;
  onShow?: (cb: () => void) => void;
  offShow?: (cb: () => void) => void;
  onHide?: (cb: () => void) => void;
  offHide?: (cb: () => void) => void;
  showKeyboard?: (opts: { defaultValue: string; maxLength: number; multiple: boolean; confirmHold: boolean; confirmType: string }) => void;
  onKeyboardConfirm?: (cb: (res: { value: string }) => void) => void;
  offKeyboardConfirm?: (cb: (res: { value: string }) => void) => void;
  onKeyboardComplete?: (cb: (res: { value: string }) => void) => void;
  offKeyboardComplete?: (cb: (res: { value: string }) => void) => void;
  createRewardedVideoAd?: (opts: { adUnitId: string }) => {
    load: () => Promise<void>;
    show: () => Promise<void>;
    onClose: (cb: (res: { isEnded?: boolean } | undefined) => void) => void;
    offClose?: (cb: (res: { isEnded?: boolean } | undefined) => void) => void;
    onError?: (cb: (err: unknown) => void) => void;
    offError?: (cb: (err: unknown) => void) => void;
  };
  shareAppMessage?: (opts: { title: string; imageUrl?: string; query?: string }) => void;
  showShareMenu?: (opts: { withShareTicket?: boolean; menus?: string[] }) => void;
  onShareAppMessage?: (cb: () => { title: string; imageUrl?: string; query?: string }) => void;
  setUserCloudStorage?: (opts: { KVDataList: Array<{ key: string; value: string }>; success?: () => void; fail?: (err: unknown) => void }) => void;
  getOpenDataContext?: () => { canvas: HTMLCanvasElement; postMessage: (msg: Record<string, unknown>) => void };
}

interface MiniTouchEvent {
  changedTouches?: Array<{ identifier?: number; clientX: number; clientY: number }>;
  touches?: Array<{ identifier?: number; clientX: number; clientY: number }>;
}

function normalizeRoundRectRadii(
  radii: number | DOMPointInit | Iterable<number | DOMPointInit> | undefined,
): [number, number, number, number] {
  if (radii === undefined) return [0, 0, 0, 0];
  if (typeof radii === 'number') {
    const r = Number.isFinite(radii) && radii > 0 ? radii : 0;
    return [r, r, r, r];
  }
  if (typeof radii === 'object' && radii !== null && Symbol.iterator in radii) {
    const arr = Array.from(radii as Iterable<number | DOMPointInit>, v => {
      const n = typeof v === 'number' ? v : (v?.x ?? 0);
      return Number.isFinite(n) && n > 0 ? n : 0;
    });
    if (arr.length === 0) return [0, 0, 0, 0];
    if (arr.length === 1) return [arr[0], arr[0], arr[0], arr[0]];
    if (arr.length === 2) return [arr[0], arr[1], arr[0], arr[1]];
    if (arr.length === 3) return [arr[0], arr[1], arr[2], arr[1]];
    return [arr[0], arr[1], arr[2], arr[3]];
  }
  const n = (radii as DOMPointInit)?.x ?? 0;
  const r = Number.isFinite(n) && n > 0 ? n : 0;
  return [r, r, r, r];
}

/**
 * Replaces `ctx.roundRect` with a universal `moveTo`/`arcTo` path implementation.
 * WeChat DevTools (Chromium 99) rejects a bare numeric radius (`cannot be converted to a sequence`),
 * and older iOS/Android mini-game WebViews omit `roundRect` altogether.
 */
export function patchMiniCanvasContext(ctx: CanvasRenderingContext2D): void {
  const existing = (ctx as unknown as { roundRect?: { __capyPatched?: boolean } }).roundRect;
  if (existing?.__capyPatched) return;

  const safeRoundRect = Object.assign(
    function (
      this: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      radii?: number | DOMPointInit | Iterable<number | DOMPointInit>,
    ): void {
      const rx = w < 0 ? x + w : x;
      const ry = h < 0 ? y + h : y;
      const rw = Math.abs(w);
      const rh = Math.abs(h);
      const [r0, r1, r2, r3] = normalizeRoundRectRadii(radii);
      const scale = Math.min(
        1,
        r0 + r1 > 0 ? rw / (r0 + r1) : 1,
        r2 + r3 > 0 ? rw / (r2 + r3) : 1,
        r0 + r3 > 0 ? rh / (r0 + r3) : 1,
        r1 + r2 > 0 ? rh / (r1 + r2) : 1,
      );
      const tl = r0 * scale;
      const tr = r1 * scale;
      const br = r2 * scale;
      const bl = r3 * scale;
      this.moveTo(rx + tl, ry);
      this.lineTo(rx + rw - tr, ry);
      if (tr > 0) this.arcTo(rx + rw, ry, rx + rw, ry + tr, tr);
      this.lineTo(rx + rw, ry + rh - br);
      if (br > 0) this.arcTo(rx + rw, ry + rh, rx + rw - br, ry + rh, br);
      this.lineTo(rx + bl, ry + rh);
      if (bl > 0) this.arcTo(rx, ry + rh, rx, ry + rh - bl, bl);
      this.lineTo(rx, ry + tl);
      if (tl > 0) this.arcTo(rx, ry, rx + tl, ry, tl);
      this.closePath();
    },
    { __capyPatched: true },
  );

  try {
    Object.defineProperty(ctx, 'roundRect', {
      value: safeRoundRect,
      configurable: true,
      writable: true,
    });
  } catch {
    (ctx as unknown as Record<string, unknown>).roundRect = safeRoundRect;
  }
}

/** Creates a Storage-compatible wrapper over `wx.*StorageSync` / `bl.*StorageSync`. */
export function createMiniStorage(api: MiniGameGlobalApi): Storage {
  return {
    get length(): number {
      try { return api.getStorageInfoSync?.().keys.length ?? 0; } catch { return 0; }
    },
    clear(): void {
      try { api.clearStorageSync?.(); } catch { /* ignore */ }
    },
    getItem(key: string): string | null {
      try {
        const value = api.getStorageSync(key);
        return typeof value === 'string' && value.length > 0 ? value : null;
      } catch { return null; }
    },
    key(index: number): string | null {
      try { return api.getStorageInfoSync?.().keys[index] ?? null; } catch { return null; }
    },
    removeItem(key: string): void {
      try { api.removeStorageSync(key); } catch { /* ignore */ }
    },
    setItem(key: string, value: string): void {
      api.setStorageSync(key, String(value));
    },
  };
}

/** Creates a Fetch-compatible wrapper over `wx.request` / `bl.request` for EndlessLeaderboardClient. */
export function createMiniFetch(api: MiniGameGlobalApi): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string'
      ? input
      : (typeof URL === 'function' && input instanceof URL)
        ? input.toString()
        : (input as { url?: string }).url ?? String(input);
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (typeof Headers === 'function' && init.headers instanceof Headers) init.headers.forEach((v, k) => { headers[k] = v; });
      else if (Array.isArray(init.headers)) for (const [k, v] of init.headers) headers[k] = v;
      else Object.assign(headers, init.headers);
    }
    return new Promise<Response>((resolve, reject) => {
      const task = api.request({
        url,
        method: (init?.method ?? 'GET').toUpperCase(),
        header: headers,
        data: init?.body,
        dataType: 'text',
        success(res) {
          const status = Number(res.statusCode) || 0;
          const rawText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? null);
          const response = {
            ok: status >= 200 && status < 300,
            status,
            statusText: String(status),
            headers: { get: (name: string) => res.header?.[name] ?? res.header?.[name.toLowerCase()] ?? null },
            text: async () => rawText,
            json: async () => (typeof res.data === 'string' ? JSON.parse(res.data) : res.data),
          } as unknown as Response;
          resolve(response);
        },
        fail(err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      });
      if (init?.signal && task && typeof task.abort === 'function') {
        if (init.signal.aborted) task.abort();
        else init.signal.addEventListener('abort', () => task.abort?.(), { once: true });
      }
    });
  }) as typeof fetch;
}

/** Shared adapter for both WeChat Mini Game (`wx`) and Bilibili Mini Game (`bl`). */
export function createMiniGameAdapter(api: MiniGameGlobalApi, kind: Exclude<PlatformKind, 'web'>): PlatformAdapter {
  const canvas = api.createCanvas();
  const rawGetContext = canvas.getContext.bind(canvas);
  const ctx = rawGetContext('2d');
  if (!ctx) throw new Error(`${kind} Canvas 2D context is unavailable.`);
  patchMiniCanvasContext(ctx);
  try {
    Object.defineProperty(canvas, 'getContext', {
      value: (...args: Parameters<HTMLCanvasElement['getContext']>) => {
        const result = rawGetContext(...args);
        if (args[0] === '2d' && result) patchMiniCanvasContext(result as CanvasRenderingContext2D);
        return result;
      },
      configurable: true,
      writable: true,
    });
  } catch { /* host canvas getContext may be non-configurable; ctx is already patched above */ }

  const subpackagePromises = new Map<SubpackageName, Promise<boolean>>();
  const disposers: Array<() => void> = [];
  let lastLoggedVpSig = '';
  let cachedViewport = measure();
  syncCanvasSize(cachedViewport);

  try {
    api.showShareMenu?.({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
    api.onShareAppMessage?.(() => ({ title: '卡皮巴拉别慌！一起来泡温泉守卫浴池 🍊' }));
  } catch { /* optional */ }

  function sanitizeSafeArea(
    w: number,
    h: number,
    sa: { top: number; bottom: number; left: number; right: number } | undefined,
  ): { top: number; bottom: number; left: number; right: number } {
    const wide = w > h && w / h >= 1.85;
    const fallback = wide
      ? { top: 0, bottom: 21, left: Math.round(Math.min(54, w * 0.055)), right: Math.round(Math.min(54, w * 0.055)) }
      : { top: 0, bottom: 0, left: 0, right: 0 };
    if (!sa) return { top: 0, bottom: 0, left: 0, right: 0 };
    const { top, bottom, left, right } = sa;
    if (![top, bottom, left, right].every(Number.isFinite)) return fallback;
    // Detect portrait-stale safeArea reported by iOS WeChat on landscape startup (e.g. right=393, bottom=818 on 852×393).
    if (
      right > w + 8
      || bottom > h + 8
      || right - left < w * 0.65
      || bottom - top < h * 0.65
      || left > w * 0.16
      || w - right > w * 0.16
      || top > h * 0.16
      || h - bottom > h * 0.16
    ) {
      return fallback;
    }
    return {
      top: Math.max(0, top),
      bottom: Math.max(0, h - bottom),
      left: Math.max(0, left),
      right: Math.max(0, w - right),
    };
  }

  function measure(): ViewportMetrics {
    const info = api.getWindowInfo?.() ?? api.getSystemInfoSync();
    const w = info.windowWidth || 1280;
    const h = info.windowHeight || 720;
    const dpr = info.pixelRatio || 1;
    const safe = sanitizeSafeArea(w, h, info.safeArea);
    let rawMenuBtn: { left: number; right?: number; top?: number; bottom?: number; width?: number; height?: number } | null = null;
    let menuBtn: { left: number; right?: number; top?: number; bottom?: number; width?: number; height?: number } | null = null;
    try {
      const rect = api.getMenuButtonBoundingClientRect?.();
      if (rect) rawMenuBtn = rect;
      if (
        rect
        && Number.isFinite(rect.left)
        && rect.left >= w * 0.72
        && rect.left < w - 36
        && (!Number.isFinite(rect.right) || (rect.right >= w * 0.80 && rect.right <= w + 12))
        && (!Number.isFinite(rect.width) || (rect.width >= 40 && rect.width <= 180))
      ) {
        menuBtn = rect;
      }
    } catch { /* optional on older runtimes */ }
    const vp = computeViewport(w, h, dpr, safe, true, menuBtn);
    if (__ENABLE_DEV_TOOLS__) {
      const sig = `${w}x${h}@${dpr}|${Math.round(vp.safeStage.left)}..${Math.round(vp.safeStage.right)}|cap=${vp.capsuleStageLeft !== undefined ? Math.round(vp.capsuleStageLeft) : 'none'}`;
      if (sig !== lastLoggedVpSig) {
        lastLoggedVpSig = sig;
        try {
          console.log('[CapyVP]', sig, 'rawSA=', info.safeArea ?? null, 'rawCap=', rawMenuBtn);
        } catch { /* ignore */ }
      }
    }
    return vp;
  }

  function syncCanvasSize(vp: ViewportMetrics): void {
    const pw = Math.max(1, Math.round(vp.screenWidth * vp.dpr));
    const ph = Math.max(1, Math.round(vp.screenHeight * vp.dpr));
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  // Allow game sound even when iOS physical silent switch is on, and recover cleanly from system audio interruptions & lifecycle changes.
  const applyAudioOption = () => {
    try {
      api.setInnerAudioOption?.({ obeyMuteSwitch: false, mixWithOther: true });
    } catch { /* optional on older runtimes */ }
  };
  applyAudioOption();

  const audio = new MinigameAudio(() => (api.createWebAudioContext?.() as never) ?? null);
  const onAudioIntBegin = () => { audio.setPaused(true); };
  const onAudioIntEnd = () => { applyAudioOption(); audio.setPaused(false); };
  const onLifecycleShow = () => {
    cachedViewport = measure();
    syncCanvasSize(cachedViewport);
    applyAudioOption();
    audio.setPaused(false);
  };
  const onLifecycleHide = () => { audio.setPaused(true); };
  try {
    api.onAudioInterruptionBegin?.(onAudioIntBegin);
    api.onAudioInterruptionEnd?.(onAudioIntEnd);
    api.onShow?.(onLifecycleShow);
    api.onHide?.(onLifecycleHide);
    disposers.push(() => {
      try { api.offAudioInterruptionBegin?.(onAudioIntBegin); } catch { /* ignore */ }
      try { api.offAudioInterruptionEnd?.(onAudioIntEnd); } catch { /* ignore */ }
      try { api.offShow?.(onLifecycleShow); } catch { /* ignore */ }
      try { api.offHide?.(onLifecycleHide); } catch { /* ignore */ }
    });
  } catch { /* optional */ }
  const storage = createMiniStorage(api);
  const miniFetch = createMiniFetch(api);
  let cachedOpenDataContext: ReturnType<NonNullable<MiniGameGlobalApi['getOpenDataContext']>> | null = null;
  const getOdc = () => {
    if (cachedOpenDataContext) return cachedOpenDataContext;
    if (kind !== 'wx' || typeof api.getOpenDataContext !== 'function') return null;
    try {
      cachedOpenDataContext = api.getOpenDataContext() ?? null;
      return cachedOpenDataContext;
    } catch {
      return null;
    }
  };

  const toTouchData = (ev: MiniTouchEvent): TouchEventData | null => {
    const touch = ev.changedTouches?.[0] ?? ev.touches?.[0];
    if (!touch) return null;
    const mapped = screenToStage(touch.clientX, touch.clientY, cachedViewport);
    return {
      id: touch.identifier ?? 0,
      screenX: touch.clientX,
      screenY: touch.clientY,
      stageX: mapped.stageX,
      stageY: mapped.stageY,
      pointerType: 'touch',
    };
  };

  return {
    kind,
    canvas,
    ctx,
    storage,
    fetch: miniFetch,
    audio,
    viewport: () => cachedViewport,
    onResize(callback) {
      const handler = () => {
        cachedViewport = measure();
        syncCanvasSize(cachedViewport);
        callback(cachedViewport);
      };
      api.onWindowResize?.(handler);
      api.onDeviceOrientationChange?.(handler);
      // iOS WeChat sometimes finishes rotating window/capsule metrics 150-800ms after landscape startup.
      const timers = [setTimeout(handler, 250), setTimeout(handler, 900)];
      const off = () => {
        timers.forEach(clearTimeout);
        api.offWindowResize?.(handler);
        api.offDeviceOrientationChange?.(handler);
      };
      disposers.push(off);
      return off;
    },
    onTouch(handlers: TouchHandlers) {
      const onStart = (ev: MiniTouchEvent) => { audio.unlock(); const p = toTouchData(ev); if (p) handlers.start?.(p); };
      const onMove = (ev: MiniTouchEvent) => { const p = toTouchData(ev); if (p) handlers.move?.(p); };
      const onEnd = (ev: MiniTouchEvent) => { const p = toTouchData(ev); if (p) handlers.end?.(p); };
      const onCancel = (ev: MiniTouchEvent) => { const p = toTouchData(ev); if (p) handlers.cancel?.(p); };
      api.onTouchStart(onStart);
      api.onTouchMove(onMove);
      api.onTouchEnd(onEnd);
      api.onTouchCancel(onCancel);
      const off = () => {
        api.offTouchStart?.(onStart);
        api.offTouchMove?.(onMove);
        api.offTouchEnd?.(onEnd);
        api.offTouchCancel?.(onCancel);
      };
      disposers.push(off);
      return off;
    },
    createImage: () => api.createImage(),
    loadSubpackage(name: SubpackageName): Promise<boolean> {
      const existing = subpackagePromises.get(name);
      if (existing) return existing;
      if (typeof api.loadSubpackage !== 'function') return Promise.resolve(true);
      const promise = new Promise<boolean>(resolve => {
        api.loadSubpackage!({
          name,
          success: () => resolve(true),
          fail: () => { subpackagePromises.delete(name); resolve(false); },
        });
      });
      subpackagePromises.set(name, promise);
      return promise;
    },
    resolveAssetPath: (relativePath: string) => relativePath.replace(/^\.?\//, ''),
    showKeyboard(options: KeyboardPromptOptions): Promise<string | null> {
      if (typeof api.showKeyboard !== 'function') return Promise.resolve(null);
      return new Promise<string | null>(resolve => {
        let settled = false;
        const finish = (value: string | null) => {
          if (settled) return;
          settled = true;
          api.offKeyboardConfirm?.(onConfirm);
          api.offKeyboardComplete?.(onComplete);
          resolve(value);
        };
        const onConfirm = (res: { value: string }) => finish(typeof res?.value === 'string' ? res.value : null);
        const onComplete = (res: { value: string }) => finish(typeof res?.value === 'string' ? res.value : null);
        api.onKeyboardConfirm?.(onConfirm);
        api.onKeyboardComplete?.(onComplete);
        try {
          api.showKeyboard!({
            defaultValue: options.value,
            maxLength: options.maxLength,
            multiple: false,
            confirmHold: false,
            confirmType: 'done',
            fail: () => finish(null),
          } as Parameters<NonNullable<MiniGameGlobalApi['showKeyboard']>>[0]);
        } catch {
          finish(null);
        }
      });
    },
    showRewardedAd(adUnitId?: string): Promise<RewardedAdOutcome> {
      if (!adUnitId || typeof api.createRewardedVideoAd !== 'function') return Promise.resolve('unavailable');
      return new Promise<RewardedAdOutcome>(resolve => {
        try {
          const ad = api.createRewardedVideoAd!({ adUnitId });
          let settled = false;
          const done = (outcome: RewardedAdOutcome) => {
            if (settled) return;
            settled = true;
            ad.offClose?.(onClose);
            ad.offError?.(onError);
            // Rewarded video ads take over the OS audio session on iOS/Android; always restore options & resume BGM cleanly.
            applyAudioOption();
            audio.setPaused(false);
            resolve(outcome);
          };
          // Strict completion check: ONLY grant reward when WeChat/Bilibili explicitly reports `isEnded === true`.
          // Early close (`isEnded === false`) or missing/aborted payloads NEVER grant rewards.
          const onClose = (res: { isEnded?: boolean } | undefined) => done(res?.isEnded === true ? 'completed' : 'skipped');
          const onError = () => done('unavailable');
          ad.onClose(onClose);
          ad.onError?.(onError);
          audio.setPaused(true);
          ad.show().catch(() => ad.load().then(() => ad.show()).catch(() => done('unavailable')));
        } catch {
          applyAudioOption();
          audio.setPaused(false);
          resolve('unavailable');
        }
      });
    },
    share(options: ShareOptions): void {
      try { api.shareAppMessage?.({ title: options.title, imageUrl: options.imageUrl, query: options.query }); } catch { /* ignore */ }
    },
    setFriendCloudStorage(entries: ReadonlyArray<{ key: string; value: string }>): void {
      if (kind !== 'wx' || !entries.length || typeof api.setUserCloudStorage !== 'function') return;
      try {
        api.setUserCloudStorage({
          KVDataList: entries.map(e => ({ key: e.key, value: e.value })),
        });
      } catch { /* ignore in unsupported simulator states */ }
    },
    getFriendLeaderboardCanvas(): HTMLCanvasElement | null {
      const odc = getOdc();
      return odc && odc.canvas ? odc.canvas : null;
    },
    postFriendLeaderboardMessage(message: Record<string, unknown>): void {
      try {
        getOdc()?.postMessage(message);
      } catch { /* ignore */ }
    },
    now: () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()),
    requestFrame: (callback) => globalThis.requestAnimationFrame(callback),
    cancelFrame: (id) => globalThis.cancelAnimationFrame?.(id),
    onShow(callback) {
      const handler = () => {
        cachedViewport = measure();
        syncCanvasSize(cachedViewport);
        applyAudioOption();
        audio.setPaused(false);
        callback();
      };
      api.onShow?.(handler);
      const off = () => api.offShow?.(handler);
      disposers.push(off);
      return off;
    },
    onHide(callback) {
      const handler = () => { audio.setPaused(true); callback(); };
      api.onHide?.(handler);
      const off = () => api.offHide?.(handler);
      disposers.push(off);
      return off;
    },
    dispose() {
      for (const off of disposers.splice(0)) { try { off(); } catch { /* ignore */ } }
    },
  };
}
