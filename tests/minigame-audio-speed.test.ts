import { describe, expect, it, vi } from 'vitest';
import { MinigameAudio, encodePcmToWav, type MinimalAudioContext } from '../src/platform/MinigameAudio';
import { createMiniGameAdapter, type MiniGameGlobalApi } from '../src/platform/minigameAdapter';
import { BATTLE_SPEED_BASELINE, nextBattleSpeed } from '../src/ui/P13HUD';
import type { SpriteImage } from '../src/render/AssetRegistry';

function makeWeChatWebAudioContext(opts: { supportCreateBuffer: boolean }) {
  const startedSources: Array<{ loop?: boolean; length: number; stopped: boolean; disconnected: boolean }> = [];
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
      const record = { loop: false as boolean | undefined, length: 0, stopped: false, disconnected: false };
      return {
        buffer: null,
        loop: false,
        onended: null,
        connect: () => {},
        disconnect: () => { record.disconnected = true; },
        start() {
          record.loop = this.loop;
          record.length = this.buffer?.length ?? 0;
          startedSources.push(record);
        },
        stop: () => { record.stopped = true; },
      };
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
});
