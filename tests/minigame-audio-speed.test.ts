import { describe, expect, it, vi } from 'vitest';
import { MinigameAudio, encodePcmToWav, type MinimalAudioContext } from '../src/platform/MinigameAudio';
import { createMiniGameAdapter, type MiniGameGlobalApi } from '../src/platform/minigameAdapter';
import { BattleAudioBridge } from '../src/minigame/BattleAudioBridge';
import { MinigameApp } from '../src/minigame/MinigameApp';
import { SoundManager } from '../src/ui/SoundManager';
import { BattleEngine } from '../src/core/BattleEngine';
import { getMap } from '../src/config/maps';
import { BATTLE_SPEED_BASELINE, nextBattleSpeed } from '../src/ui/P13HUD';
import type { SpriteImage } from '../src/render/AssetRegistry';

function makeWeChatWebAudioContext(opts: { supportCreateBuffer: boolean }) {
  const startedSources: Array<{
    loop?: boolean;
    length: number;
    stopped: boolean;
    disconnected: boolean;
    triggerEnded: () => void;
  }> = [];
  const gainNodes: Array<{ gain: { value: number } }> = [];
  let decodeCalls = 0;
  let resumed = 0;
  let suspended = 0;

  // Deliberately OMIT `createOscillator` — matches real WeChat Mini-Game `wx.createWebAudioContext()`!
  const ctx: MinimalAudioContext = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 44100,
    destination: { kind: 'destination' },
    onstatechange: null,
    resume: () => {
      resumed++;
      ctx.state = 'running';
      return Promise.resolve();
    },
    suspend: () => {
      suspended++;
      ctx.state = 'suspended';
      return Promise.resolve();
    },
    createGain: () => {
      const g = {
        gain: {
          value: 1,
          cancelScheduledValues() {},
          setValueAtTime(v: number) { this.value = v; },
          linearRampToValueAtTime(v: number) { this.value = v; },
        },
        connect: () => {},
        disconnect: () => {},
      };
      gainNodes.push(g);
      return g;
    },
    createBufferSource: () => {
      const node = {
        buffer: null as { length: number } | null,
        loop: false,
        onended: null as (() => void) | null,
        connect: () => {},
        disconnect: () => { record.disconnected = true; },
        start() {
          record.loop = this.loop;
          record.length = this.buffer?.length ?? 0;
          startedSources.push(record);
        },
        stop: () => { record.stopped = true; },
      };
      const record = {
        loop: false as boolean | undefined,
        length: 0,
        stopped: false,
        disconnected: false,
        triggerEnded: () => { node.onended?.(); },
      };
      return node;
    },
    ...(opts.supportCreateBuffer
      ? {
          createBuffer: (_ch: number, length: number, sampleRate: number) => {
            const data = new Float32Array(length);
            return {
              length,
              sampleRate,
              getChannelData: () => data,
              copyToChannel: (src: Float32Array) => { data.set(src); },
            };
          },
        }
      : {
          decodeAudioData: (wav: ArrayBuffer, ok?: (buf: { length: number }) => void) => {
            decodeCalls++;
            // Verify valid RIFF/WAVE header
            const view = new DataView(wav);
            expect(view.getUint32(0, false)).toBe(0x52494646); // 'RIFF'
            expect(view.getUint32(8, false)).toBe(0x57415645); // 'WAVE'
            const samples = (wav.byteLength - 44) / 2;
            const buf = { length: samples };
            ok?.(buf);
          },
        }),
  };

  return { ctx, startedSources, gainNodes, getStats: () => ({ decodeCalls, resumed, suspended }) };
}

describe('r20: Baseline 2× speed & WeChat PCM WebAudio engine', () => {
  it('promotes previous 2× speed to baseline 1× so HUD 1×/2×/3× run at 2×/4×/6× engine pace', () => {
    expect(BATTLE_SPEED_BASELINE).toBe(2);
    expect([1, 2, 3].map(s => s * BATTLE_SPEED_BASELINE)).toEqual([2, 4, 6]);
    expect([nextBattleSpeed(1, 3), nextBattleSpeed(2, 3), nextBattleSpeed(3, 3)]).toEqual([2, 3, 1]);
  });

  it('plays BGM loops and SFX on WeChat WebAudioContext WITHOUT createOscillator (Tier 1 createBuffer)', () => {
    const mock = makeWeChatWebAudioContext({ supportCreateBuffer: true });
    const audio = new MinigameAudio(() => mock.ctx);

    // First user tap unlocks audio & starts seamless looping menu BGM
    audio.unlock();
    expect(mock.getStats().resumed).toBe(1);
    expect(mock.startedSources).toHaveLength(1);
    expect(mock.startedSources[0].loop).toBe(true);
    expect(mock.startedSources[0].length).toBeGreaterThan(22050 * 20); // full 16-bar track

    // SFX cues play immediately via cached AudioBufferSourceNodes
    audio.play('click');
    audio.play('merge_hero');
    audio.play('click'); // cached hit
    expect(mock.startedSources).toHaveLength(4);
    expect(mock.startedSources[1].loop).toBe(false);
    expect(mock.startedSources[1].length).toBeGreaterThan(500);

    // Switching music mode stops previous looping BGM cleanly and starts new mode
    audio.setMusicMode('battle');
    expect(mock.startedSources[0].stopped).toBe(true);
    expect(mock.startedSources[0].disconnected).toBe(true);
    expect(mock.startedSources).toHaveLength(5);
    expect(mock.startedSources[4].loop).toBe(true);

    // Pause / resume (backgrounding or audio interruption) cleanly stops & restarts BGM
    audio.setPaused(true);
    expect(mock.startedSources[4].stopped).toBe(true);
    audio.setPaused(false);
    expect(mock.startedSources).toHaveLength(6);
    expect(mock.startedSources[5].loop).toBe(true);
  });

  it('falls back cleanly to 16-bit PCM WAV decodeAudioData when createBuffer is unavailable', () => {
    const mock = makeWeChatWebAudioContext({ supportCreateBuffer: false });
    const audio = new MinigameAudio(() => mock.ctx);

    audio.unlock();
    audio.play('summon');
    audio.play('summon'); // served from cache, no redundant decode

    expect(mock.getStats().decodeCalls).toBe(2); // 1 BGM + 1 SFX
    expect(mock.startedSources).toHaveLength(3); // 1 looping BGM + 2 SFX plays
    expect(mock.startedSources[0].loop).toBe(true);
    expect(mock.startedSources[1].loop).toBe(false);

    // Sanity check WAV encoder output size & non-zero PCM payload
    const wav = encodePcmToWav(new Float32Array([0, 0.5, -0.5, 1]), 22050);
    expect(wav.byteLength).toBe(44 + 8);
  });

  it('configures wx.setInnerAudioOption({ obeyMuteSwitch: false }) and audio interruption hooks in minigameAdapter', () => {
    const innerOpts: unknown[] = [];
    let intBegin: (() => void) | undefined;
    let intEnd: (() => void) | undefined;
    const mock = makeWeChatWebAudioContext({ supportCreateBuffer: true });

    const mockCtx2d = new Proxy({}, { get: () => () => {} });
    const api: MiniGameGlobalApi = {
      createCanvas: () => ({ width: 0, height: 0, getContext: () => mockCtx2d }) as unknown as HTMLCanvasElement,
      createImage: () => ({ width: 0, height: 0, src: '' }) as unknown as SpriteImage,
      getSystemInfoSync: () => ({ windowWidth: 852, windowHeight: 393, pixelRatio: 2 }),
      getStorageSync: () => '',
      setStorageSync: () => {},
      removeStorageSync: () => {},
      request: () => {},
      createWebAudioContext: () => mock.ctx,
      setInnerAudioOption: opts => { innerOpts.push(opts); },
      onAudioInterruptionBegin: cb => { intBegin = cb; },
      onAudioInterruptionEnd: cb => { intEnd = cb; },
      onTouchStart: () => {},
      onTouchMove: () => {},
      onTouchEnd: () => {},
      onTouchCancel: () => {},
    };

    const adapter = createMiniGameAdapter(api, 'wx');
    expect(innerOpts).toEqual([{ obeyMuteSwitch: false, mixWithOther: true }]);
    adapter.audio.unlock();
    expect(mock.startedSources).toHaveLength(1);

    intBegin?.();
    expect(mock.startedSources[0].stopped).toBe(true);
    intEnd?.();
    expect(mock.startedSources).toHaveLength(2);
    expect(mock.startedSources[1].loop).toBe(true);
  });

  it('plays orange_gain audio in BattleAudioBridge when Capybara Bubble Shield blocks an Endless leak & syncs in Wave-1 prep', () => {
    const e = new BattleEngine({ seed: 77 });
    e.start();
    // Upgrade med_capy_shield during Wave-1 preparation and sync loadout
    expect(e.canSyncPreparationLoadout()).toBe(true);
    expect(e.syncPreparationLoadout({ endlessMedallions: { med_capy_shield: 10 } }).ok).toBe(true);
    // Clear standard waves 1-10 -> enter Endless Wave 11
    while (e.state.phase !== 'finished') e.skipWave();
    expect(e.enterEndless().ok).toBe(true);
    expect(e.state.sides.player.capyShieldReady).toBe(true);

    const bridge = new BattleAudioBridge();
    bridge.reset(e.state.id);
    const played: string[] = [];
    const fakeAudio = { unlock: () => {}, setSettings: () => {}, setPaused: () => {}, play: (c: string) => played.push(c) };

    const orangesBefore = e.state.sides.player.oranges;
    const boss = e.spawnEnemy('husky_wrecker', 'player');
    boss.progress = getMap(e.state.mapId).paths.player.length - 1.001;
    e.tick(0.05);

    expect(e.state.sides.player.oranges).toBe(orangesBefore); // Boss 2-orange theft completely blocked!
    expect(e.state.sides.player.capyShieldReady).toBe(false);
    bridge.observe(e.state, fakeAudio as never, 1000);
    expect(played).toContain('orange_gain');
  });
});

describe('Audio sudden-silence recovery regressions', () => {
  function makeMockMiniApi(opts?: {
    audioCtxFactory?: () => MinimalAudioContext;
    rewardedAdFactory?: MiniGameGlobalApi['createRewardedVideoAd'];
  }) {
    const innerOpts: unknown[] = [];
    const showHandlers: Array<() => void> = [];
    const hideHandlers: Array<() => void> = [];
    const intBeginHandlers: Array<() => void> = [];
    const intEndHandlers: Array<() => void> = [];
    const store = new Map<string, string>();
    let webAudioCreateCount = 0;
    const defaultMock = makeWeChatWebAudioContext({ supportCreateBuffer: true });
    const mockCtx2d = new Proxy({
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      measureText: (s: string) => ({ width: s.length * 10 }),
    } as Record<string, unknown>, {
      get(target, prop: string) {
        if (prop in target) return target[prop];
        return () => {};
      },
    });
    const api: MiniGameGlobalApi = {
      createCanvas: () => ({ width: 0, height: 0, getContext: () => mockCtx2d }) as unknown as HTMLCanvasElement,
      createImage: () => ({ width: 64, height: 64, src: '' }) as unknown as SpriteImage,
      getSystemInfoSync: () => ({ windowWidth: 852, windowHeight: 393, pixelRatio: 2 }),
      getStorageSync: key => store.get(key) ?? '',
      setStorageSync: (key, val) => { store.set(key, val); },
      removeStorageSync: key => { store.delete(key); },
      request: () => {},
      createWebAudioContext: () => {
        webAudioCreateCount++;
        return opts?.audioCtxFactory ? opts.audioCtxFactory() : defaultMock.ctx;
      },
      setInnerAudioOption: o => { innerOpts.push(o); },
      onShow: cb => { showHandlers.push(cb); },
      offShow: cb => { const i = showHandlers.indexOf(cb); if (i >= 0) showHandlers.splice(i, 1); },
      onHide: cb => { hideHandlers.push(cb); },
      offHide: cb => { const i = hideHandlers.indexOf(cb); if (i >= 0) hideHandlers.splice(i, 1); },
      onAudioInterruptionBegin: cb => { intBeginHandlers.push(cb); },
      offAudioInterruptionBegin: cb => { const i = intBeginHandlers.indexOf(cb); if (i >= 0) intBeginHandlers.splice(i, 1); },
      onAudioInterruptionEnd: cb => { intEndHandlers.push(cb); },
      offAudioInterruptionEnd: cb => { const i = intEndHandlers.indexOf(cb); if (i >= 0) intEndHandlers.splice(i, 1); },
      createRewardedVideoAd: opts?.rewardedAdFactory,
      onTouchStart: () => {},
      onTouchMove: () => {},
      onTouchEnd: () => {},
      onTouchCancel: () => {},
    };
    return {
      api,
      mock: defaultMock,
      innerOpts,
      getWebAudioCreateCount: () => webAudioCreateCount,
      emitShow: () => showHandlers.slice().forEach(fn => fn()),
      emitHide: () => hideHandlers.slice().forEach(fn => fn()),
      emitIntBegin: () => intBeginHandlers.slice().forEach(fn => fn()),
      emitIntEnd: () => intEndHandlers.slice().forEach(fn => fn()),
    };
  }

  it('recovers BGM and SFX after onHide -> onShow automatically and wires MinigameApp.onShow without premature cold-boot AudioContext', () => {
    const env = makeMockMiniApi();
    const adapter = createMiniGameAdapter(env.api, 'wx');

    // Cold-boot onShow before first gesture should NOT prematurely construct WebAudioContext
    env.emitShow();
    expect(env.getWebAudioCreateCount()).toBe(0);

    // Mount MinigameApp and verify it subscribes to platform.onShow as well as onHide
    const origRaf = globalThis.requestAnimationFrame;
    const origCaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
    let app: MinigameApp | null = null;
    try {
      app = new MinigameApp(adapter);
      adapter.audio.unlock();
      expect(env.getWebAudioCreateCount()).toBe(1);
      expect(env.mock.startedSources).toHaveLength(1);
      expect(env.mock.startedSources[0].loop).toBe(true);

      // App goes to background: BGM stops & SFX muted while hidden
      env.emitHide();
      expect(env.mock.startedSources[0].stopped).toBe(true);
      adapter.audio.play('click');
      expect(env.mock.startedSources).toHaveLength(1);

      // App returns to foreground: setInnerAudioOption re-applied, BGM & SFX resume cleanly!
      const optsBeforeShow = env.innerOpts.length;
      env.emitShow();
      expect(env.innerOpts.length).toBeGreaterThan(optsBeforeShow);
      expect(env.mock.startedSources).toHaveLength(2);
      expect(env.mock.startedSources[1].loop).toBe(true);

      adapter.audio.play('click');
      expect(env.mock.startedSources).toHaveLength(3);
      expect(env.mock.startedSources[2].loop).toBe(false);
    } finally {
      app?.dispose();
      adapter.dispose();
      globalThis.requestAnimationFrame = origRaf;
      globalThis.cancelAnimationFrame = origCaf;
    }
  });

  it('clears stale paused state on next foreground unlock() when onAudioInterruptionEnd or onShow was missed', () => {
    const env = makeMockMiniApi();
    const adapter = createMiniGameAdapter(env.api, 'wx');
    try {
      adapter.audio.unlock();
      expect(env.mock.startedSources).toHaveLength(1);

      // Simulate iOS firing onAudioInterruptionBegin without ever delivering onAudioInterruptionEnd
      env.emitIntBegin();
      expect(env.mock.startedSources[0].stopped).toBe(true);
      adapter.audio.play('click');
      expect(env.mock.startedSources).toHaveLength(1);

      // Next user touch calls unlock() -> clears stale paused, restarts BGM & restores SFX
      adapter.audio.unlock();
      expect(env.mock.startedSources).toHaveLength(2);
      expect(env.mock.startedSources[1].loop).toBe(true);
      adapter.audio.play('click');
      expect(env.mock.startedSources).toHaveLength(3);
    } finally {
      adapter.dispose();
    }
  });

  it('auto-restarts BGM when WeChat loop=true fires onended unexpectedly and self-heals silently interrupted context via setMusicMode', () => {
    vi.useFakeTimers();
    try {
      const mock = makeWeChatWebAudioContext({ supportCreateBuffer: true });
      const audio = new MinigameAudio(() => mock.ctx);
      audio.unlock();
      expect(mock.startedSources).toHaveLength(1);

      // WeChat base library bug: loop=true BGM fires onended after ~30s
      mock.startedSources[0].triggerEnded();
      expect(mock.startedSources[0].disconnected).toBe(true);
      vi.advanceTimersByTime(50);
      expect(mock.startedSources).toHaveLength(2);
      expect(mock.startedSources[1].loop).toBe(true);

      // Silent OS interruption: ctx.state flips to 'interrupted' without onHide
      mock.ctx.state = 'interrupted';
      vi.advanceTimersByTime(1300);
      audio.setMusicMode('menu');
      expect(mock.startedSources[1].stopped).toBe(true);
      expect(mock.startedSources).toHaveLength(3);
      expect(mock.startedSources[2].loop).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses audio during Rewarded Video Ad and restores options + BGM on completed, skipped, and sync throw', async () => {
    let closeCb: ((res: { isEnded?: boolean } | undefined) => void) | undefined;
    let shouldThrowOnShow = false;
    const env = makeMockMiniApi({
      rewardedAdFactory: () => ({
        load: () => Promise.resolve(),
        show: () => {
          if (shouldThrowOnShow) throw new Error('ad show threw synchronously');
          return Promise.resolve();
        },
        onClose: cb => { closeCb = cb; },
        offClose: () => { closeCb = undefined; },
        onError: () => {},
        offError: () => {},
      }),
    });
    const adapter = createMiniGameAdapter(env.api, 'wx');
    try {
      adapter.audio.unlock();
      expect(env.mock.startedSources).toHaveLength(1);

      // 1. Completed ad
      const p1 = adapter.showRewardedAd('adunit-test');
      expect(env.mock.startedSources[0].stopped).toBe(true);
      closeCb?.({ isEnded: true });
      expect(await p1).toBe('completed');
      expect(env.mock.startedSources).toHaveLength(2);
      expect(env.mock.startedSources[1].loop).toBe(true);

      // 2. Skipped ad
      const p2 = adapter.showRewardedAd('adunit-test');
      expect(env.mock.startedSources[1].stopped).toBe(true);
      closeCb?.({ isEnded: false });
      expect(await p2).toBe('skipped');
      expect(env.mock.startedSources).toHaveLength(3);
      expect(env.mock.startedSources[2].loop).toBe(true);

      // 3. Synchronous throw inside show() must never leave audio stuck paused
      shouldThrowOnShow = true;
      expect(await adapter.showRewardedAd('adunit-test')).toBe('unavailable');
      expect(env.mock.startedSources).toHaveLength(4);
      expect(env.mock.startedSources[3].loop).toBe(true);
    } finally {
      adapter.dispose();
    }
  });

  it('caps concurrent SFX voices at 12, cleans up leaked nodes by fallback timer, and rebuilds closed AudioContext', () => {
    vi.useFakeTimers();
    try {
      const ctx1 = makeWeChatWebAudioContext({ supportCreateBuffer: true });
      const ctx2 = makeWeChatWebAudioContext({ supportCreateBuffer: true });
      let call = 0;
      const audio = new MinigameAudio(() => (call++ === 0 ? ctx1.ctx : ctx2.ctx));

      audio.unlock();
      expect(ctx1.startedSources).toHaveLength(1); // BGM

      // Burst 20 SFX without ever firing onended: oldest 8 must be evicted to enforce MAX_CONCURRENT_SFX=12
      for (let i = 0; i < 20; i++) audio.play('click');
      expect(ctx1.startedSources).toHaveLength(21);
      for (let i = 1; i <= 8; i++) {
        expect(ctx1.startedSources[i].stopped).toBe(true);
        expect(ctx1.startedSources[i].disconnected).toBe(true);
      }
      for (let i = 9; i <= 20; i++) {
        expect(ctx1.startedSources[i].disconnected).toBe(false);
      }

      // Fallback timer disconnects all remaining leaked SFX nodes after duration + 180ms
      vi.advanceTimersByTime(1000);
      for (let i = 9; i <= 20; i++) {
        expect(ctx1.startedSources[i].disconnected).toBe(true);
      }

      // Host closes AudioContext -> next unlock() rebuilds cleanly on ctx2
      ctx1.ctx.state = 'closed';
      audio.unlock();
      expect(ctx2.startedSources).toHaveLength(1);
      expect(ctx2.startedSources[0].loop).toBe(true);
      audio.play('summon');
      expect(ctx2.startedSources).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throttles rapid dash, orange, purge, and bubble bursts in BattleAudioBridge', () => {
    const bridge = new BattleAudioBridge();
    const played: string[] = [];
    const fakeAudio = { unlock: () => {}, setSettings: () => {}, setPaused: () => {}, play: (c: string) => played.push(c) };
    const events = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: i + 1, side: 'player' as const, type: 'dash' as const })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: i + 10, side: 'player' as const, type: 'orange' as const, value: -1 })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: i + 20, side: 'player' as const, type: 'purge' as const, effect: 'legendary' })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: i + 30, side: 'player' as const, type: 'bubble' as const, effect: 'resist_block' })),
    ];
    bridge.observe({ id: 'b1', events } as never, fakeAudio as never, 500);
    expect(played).toEqual(['hero_ult', 'orange_loss', 'hero_ult', 'hit_heavy']);
  });

  it('resumes a browser-suspended AudioContext in Web SoundManager when tab returns visible', async () => {
    let resumeCalls = 0;
    let visHandler: (() => void) | undefined;
    let isHidden = false;
    const fakeParam = () => ({
      value: 1,
      cancelScheduledValues: () => {},
      setValueAtTime: () => {},
      setTargetAtTime: () => {},
      linearRampToValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
    });
    const fakeGain = () => ({ gain: fakeParam(), connect: () => {}, disconnect: () => {} });
    const fakeCtx: Record<string, unknown> = {
      state: 'running',
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      resume: () => { resumeCalls++; fakeCtx.state = 'running'; return Promise.resolve(); },
      close: () => Promise.resolve(),
      createGain: fakeGain,
      createOscillator: () => ({ type: 'sine', frequency: fakeParam(), connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, onended: null }),
    };

    const origAudioCtx = (globalThis as Record<string, unknown>).AudioContext;
    const origDoc = (globalThis as Record<string, unknown>).document;
    (globalThis as Record<string, unknown>).AudioContext = function FakeAudioContext() { return fakeCtx; };
    (globalThis as Record<string, unknown>).document = {
      get hidden() { return isHidden; },
      addEventListener: (ev: string, fn: () => void) => { if (ev === 'visibilitychange') visHandler = fn; },
      removeEventListener: () => {},
    };
    const sm = new SoundManager();
    try {
      await sm.unlock();
      // Browser suspends AudioContext when tab goes hidden
      isHidden = true;
      fakeCtx.state = 'suspended';
      visHandler?.();
      expect(resumeCalls).toBe(0);

      // Tab returns visible -> SoundManager resumes AudioContext automatically
      isHidden = false;
      visHandler?.();
      expect(resumeCalls).toBe(1);
      expect(fakeCtx.state).toBe('running');
    } finally {
      sm.dispose();
      (globalThis as Record<string, unknown>).AudioContext = origAudioCtx;
      (globalThis as Record<string, unknown>).document = origDoc;
    }
  });
});
