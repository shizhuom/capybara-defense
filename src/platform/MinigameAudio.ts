import type { MinigameAudioController, MinigameCue, MinigameMusicMode } from './types';

type WaveKind = 'sine' | 'triangle' | 'sawtooth';
type NoteSpec = readonly [freq: number, offset: number, dur: number, type: WaveKind, vol?: number];

interface MinimalAudioParam {
  value: number;
  cancelScheduledValues?: (cancelTime: number) => void;
  setValueAtTime?: (value: number, startTime: number) => void;
  linearRampToValueAtTime?: (value: number, endTime: number) => void;
  exponentialRampToValueAtTime?: (value: number, endTime: number) => void;
}

interface MinimalAudioBuffer {
  length: number;
  sampleRate?: number;
  getChannelData?: (channel: number) => Float32Array;
  copyToChannel?: (source: Float32Array, channelNumber: number) => void;
}

interface MinimalBufferSourceNode {
  buffer: MinimalAudioBuffer | null;
  loop?: boolean;
  onended?: (() => void) | null;
  connect: (destination: unknown) => void;
  disconnect?: () => void;
  start: (when?: number) => void;
  stop?: (when?: number) => void;
}

interface MinimalGainNode {
  gain: MinimalAudioParam;
  connect: (destination: unknown) => void;
  disconnect?: () => void;
}

interface MinimalOscillatorNode {
  type: OscillatorType;
  frequency: MinimalAudioParam;
  connect: (destination: unknown) => void;
  disconnect?: () => void;
  start: (when?: number) => void;
  stop: (when?: number) => void;
}

export interface MinimalAudioContext {
  state?: string;
  currentTime: number;
  sampleRate?: number;
  destination: unknown;
  onstatechange?: (() => void) | null;
  resume?: () => Promise<void> | void;
  suspend?: () => Promise<void> | void;
  createGain: () => MinimalGainNode;
  createBuffer?: (channels: number, length: number, sampleRate: number) => MinimalAudioBuffer;
  createBufferSource?: () => MinimalBufferSourceNode;
  decodeAudioData?: (
    audioData: ArrayBuffer,
    successCallback?: (buffer: MinimalAudioBuffer) => void,
    errorCallback?: (err: unknown) => void,
  ) => Promise<MinimalAudioBuffer> | void;
  createOscillator?: () => MinimalOscillatorNode;
}

const SYNTH_SAMPLE_RATE = 22050;
const MAX_CONCURRENT_SFX = 12;
const BGM_RECOVERY_THROTTLE_MS = 1200;
const TEMPOS: Record<MinigameMusicMode, number> = { menu: 116, battle: 124, boss: 138 };
const midiHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// Same 16-bar cozy pastoral (menu), tactical (battle), and showdown (boss) melodies as Web MusicTracks.
const PASTORAL: readonly (readonly number[])[] = [
  [74, 71, 67, 69, 71, 74, 79, 76], [74, 72, 71, 69, 67, 71, 74, 71],
  [76, 74, 72, 71, 69, 72, 76, 79], [78, 76, 74, 72, 71, 69, 66, 69],
  [71, 74, 79, 78, 76, 74, 71, 67], [69, 71, 72, 76, 74, 72, 69, 66],
  [67, 71, 74, 79, 81, 79, 76, 74], [72, 71, 69, 66, 67, 69, 71, 74],
  [79, 78, 76, 74, 76, 79, 83, 81], [79, 76, 74, 71, 72, 74, 76, 79],
  [81, 79, 76, 72, 74, 76, 79, 76], [78, 74, 71, 69, 66, 69, 74, 78],
  [79, 74, 71, 67, 69, 71, 74, 79], [76, 72, 69, 66, 69, 72, 76, 74],
  [71, 74, 79, 76, 74, 71, 69, 66], [67, 71, 74, 79, 78, 74, 71, 67],
];
const TACTICAL: readonly (readonly number[])[] = [
  [62, 69, 65, 67, 69, 72, 71, 69], [62, 65, 69, 74, 72, 69, 67, 65],
  [60, 67, 64, 65, 67, 71, 69, 67], [57, 64, 60, 62, 64, 67, 65, 64],
  [62, 65, 69, 65, 67, 69, 72, 74], [65, 69, 72, 76, 74, 72, 69, 67],
  [67, 71, 74, 72, 71, 69, 67, 64], [69, 67, 65, 64, 62, 64, 65, 69],
  [74, 72, 69, 67, 65, 69, 72, 74], [76, 74, 72, 69, 67, 69, 72, 76],
  [72, 71, 67, 64, 65, 67, 71, 74], [69, 65, 64, 60, 62, 64, 67, 69],
  [74, 69, 65, 62, 65, 69, 72, 71], [65, 67, 69, 72, 74, 76, 74, 72],
  [71, 74, 77, 76, 74, 71, 69, 67], [69, 65, 64, 62, 60, 64, 65, 62],
];
const SHOWDOWN: readonly (readonly number[])[] = [
  [60, 67, 72, 71, 70, 67, 63, 62], [61, 68, 73, 72, 71, 68, 64, 63],
  [62, 69, 74, 73, 72, 69, 65, 64], [59, 66, 71, 70, 69, 66, 62, 61],
  [60, 63, 67, 72, 75, 74, 73, 72], [65, 68, 72, 77, 76, 75, 72, 68],
  [66, 69, 73, 78, 77, 76, 73, 69], [67, 70, 74, 79, 78, 77, 74, 70],
  [72, 79, 84, 83, 82, 79, 75, 74], [73, 80, 85, 84, 83, 80, 76, 75],
  [74, 81, 86, 85, 84, 81, 77, 76], [71, 78, 83, 82, 81, 78, 74, 73],
  [72, 75, 79, 84, 83, 82, 79, 75], [77, 76, 75, 72, 68, 69, 70, 71],
  [78, 77, 76, 73, 69, 70, 71, 72], [79, 78, 77, 74, 70, 67, 63, 60],
];
const MENU_ROOTS = [43, 40, 48, 38, 43, 45, 40, 38, 43, 40, 48, 38, 43, 45, 38, 43] as const;
const BATTLE_ROOTS = [38, 38, 36, 33, 38, 41, 43, 33, 38, 41, 36, 33, 38, 41, 43, 38] as const;
const BOSS_ROOTS = [36, 37, 38, 35, 36, 41, 42, 43, 36, 37, 38, 35, 36, 41, 42, 43] as const;

function cueNotes(cue: MinigameCue): ReadonlyArray<NoteSpec> {
  return cue === 'click' ? [[520, 0, 0.055, 'triangle', 0.85]]
    : cue === 'summon' ? [[440, 0, 0.07, 'triangle', 0.9], [587, 0.05, 0.09, 'triangle', 0.95]]
    : cue === 'shovel' ? [[210, 0, 0.08, 'sine', 0.95], [310, 0.04, 0.06, 'triangle', 0.85]]
    : cue === 'merge_upgrade' ? [[523, 0, 0.08, 'triangle', 0.9], [659, 0.07, 0.11, 'triangle', 0.95]]
    : cue === 'merge_hero' || cue === 'hero_ult' ? [[523, 0, 0.09, 'triangle', 0.9], [659, 0.08, 0.09, 'triangle', 0.95], [784, 0.16, 0.18, 'sine', 1]]
    : cue === 'coin' || cue === 'gacha_win' ? [[880, 0, 0.06, 'sine', 0.9], [1174, 0.055, 0.1, 'sine', 1]]
    : cue === 'hit_melee' ? [[280, 0, 0.042, 'triangle', 0.78]]
    : cue === 'hit_ranged' ? [[620, 0, 0.04, 'sine', 0.72]]
    : cue === 'hit_magic' ? [[760, 0, 0.05, 'sine', 0.72], [980, 0.03, 0.05, 'sine', 0.68]]
    : cue === 'hit_heavy' ? [[180, 0, 0.075, 'triangle', 0.92]]
    : cue === 'enemy_defeat' ? [[480, 0, 0.045, 'triangle', 0.75], [640, 0.03, 0.055, 'sine', 0.75]]
    : cue === 'wave_start' ? [[392, 0, 0.085, 'triangle', 0.88], [523, 0.08, 0.13, 'triangle', 0.92]]
    : cue === 'boss_arrive' ? [[196, 0, 0.13, 'sawtooth', 0.95], [165, 0.12, 0.2, 'sawtooth', 1]]
    : cue === 'orange_loss' ? [[330, 0, 0.095, 'triangle', 0.95], [220, 0.09, 0.15, 'triangle', 1]]
    : cue === 'orange_gain' ? [[587, 0, 0.075, 'sine', 0.9], [880, 0.07, 0.11, 'sine', 0.95]]
    : cue === 'sprinkler' ? [[520, 0, 0.075, 'sine', 0.85], [740, 0.05, 0.085, 'sine', 0.9], [980, 0.1, 0.13, 'sine', 0.95]]
    : cue === 'giant_cat' ? [[150, 0, 0.15, 'triangle', 1], [240, 0.08, 0.13, 'sine', 0.9]]
    : cue === 'prop_use' ? [[494, 0, 0.065, 'triangle', 0.88], [740, 0.06, 0.11, 'sine', 0.92]]
    : cue === 'victory' ? [[523, 0, 0.11, 'triangle', 0.9], [659, 0.1, 0.11, 'triangle', 0.92], [784, 0.2, 0.13, 'triangle', 0.95], [1046, 0.32, 0.24, 'sine', 1]]
    : [[330, 0, 0.12, 'triangle', 0.9], [277, 0.12, 0.14, 'triangle', 0.92], [220, 0.26, 0.22, 'sine', 0.95]];
}

function sampleWave(cycles: number, type: WaveKind): number {
  const frac = cycles - Math.floor(cycles);
  if (type === 'triangle') return 1 - 4 * Math.abs(frac - 0.5);
  const rad = frac * Math.PI * 2;
  if (type === 'sine') return Math.sin(rad);
  // Warm band-limited sawtooth (1st + 2nd + 3rd harmonics) that sounds cozy on small phone speakers.
  return 0.65 * Math.sin(rad) + 0.25 * Math.sin(rad * 2) + 0.1 * Math.sin(rad * 3);
}

/** Synthesizes a list of timed notes into a normalized mono PCM Float32Array (zero clicks/pops). */
function renderNotesToPcm(notes: ReadonlyArray<NoteSpec>, totalDuration: number, sampleRate = SYNTH_SAMPLE_RATE): Float32Array {
  const totalSamples = Math.max(64, Math.ceil(totalDuration * sampleRate));
  const pcm = new Float32Array(totalSamples);
  for (let i = 0; i < notes.length; i++) {
    const [freq, offset, dur, type, amp = 1] = notes[i];
    if (amp <= 0.0005 || dur <= 0.002) continue;
    const startIdx = Math.max(0, Math.floor(offset * sampleRate));
    const len = Math.max(1, Math.floor(dur * sampleRate));
    const endIdx = Math.min(totalSamples, startIdx + len);
    const attack = Math.max(1, Math.min(Math.floor(0.012 * sampleRate), Math.floor(len * 0.25)));
    const phaseStep = freq / sampleRate;
    for (let s = startIdx; s < endIdx; s++) {
      const local = s - startIdx;
      const env = local < attack
        ? local / attack
        : Math.pow(1 - (local - attack) / Math.max(1, len - attack), 1.45);
      pcm[s] += sampleWave(local * phaseStep, type) * env * amp;
    }
  }
  for (let i = 0; i < totalSamples; i++) {
    pcm[i] = Math.tanh(pcm[i] * 0.92);
  }
  return pcm;
}

/** Pre-renders a complete seamless 16-bar BGM loop for the requested mode. */
function renderBgmPcm(mode: MinigameMusicMode, sampleRate = SYNTH_SAMPLE_RATE): Float32Array {
  const quarter = 60 / TEMPOS[mode];
  const eighth = quarter / 2;
  const notes: NoteSpec[] = [];
  for (let step = 0; step < 64; step++) {
    const bar = Math.floor(step / 4) % 16;
    const beat = step % 4;
    const t0 = step * quarter;
    if (mode === 'menu') {
      const root = MENU_ROOTS[bar];
      const melody = PASTORAL[bar];
      notes.push([midiHz(melody[beat * 2]), t0, eighth * 0.9, 'triangle', 0.44]);
      notes.push([midiHz(melody[beat * 2 + 1]), t0 + eighth, eighth * 0.84, 'triangle', 0.36]);
      notes.push([midiHz(root + (beat % 2 ? 7 : 0)), t0, quarter * 0.72, 'sine', 0.36]);
      if (beat % 2 === 0) notes.push([midiHz(melody[beat * 2] + 12), t0, 0.22, 'sine', 0.16]);
    } else {
      const boss = mode === 'boss';
      const root = (boss ? BOSS_ROOTS : BATTLE_ROOTS)[bar];
      const melody = (boss ? SHOWDOWN : TACTICAL)[bar];
      const leadType: WaveKind = boss ? 'sawtooth' : 'triangle';
      notes.push([midiHz(melody[beat * 2]), t0, eighth * 0.76, leadType, boss ? 0.34 : 0.44]);
      notes.push([midiHz(melody[beat * 2 + 1]), t0 + eighth, eighth * 0.72, leadType, boss ? 0.28 : 0.38]);
      notes.push([midiHz(root), t0, eighth * 0.8, 'triangle', 0.38]);
      notes.push([midiHz(root + (beat % 2 ? 7 : 12)), t0 + eighth, eighth * 0.72, 'triangle', 0.3]);
    }
  }
  return renderNotesToPcm(notes, 64 * quarter, sampleRate);
}

/** Packs mono Float32 PCM into a standard 16-bit PCM RIFF WAV ArrayBuffer for `decodeAudioData` fallback. */
export function encodePcmToWav(pcm: Float32Array, sampleRate = SYNTH_SAMPLE_RATE): ArrayBuffer {
  const dataBytes = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < pcm.length; i++) {
    const clamped = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767), true);
  }
  return buf;
}

/**
 * WeChat / Bilibili / Web standalone audio & BGM synthesizer.
 *
 * Uses pure PCM AudioBuffer synthesis + `AudioBufferSourceNode` (with automatic `decodeAudioData`
 * WAV fallback) because WeChat Mini-Game's `wx.createWebAudioContext()` does NOT implement
 * `createOscillator()`. Completely independent from Web's SoundManager / MusicTracks / AudioGestures.
 */
export class MinigameAudio implements MinigameAudioController {
  private ctx: MinimalAudioContext | null = null;
  private soundVolume = 0.75;
  private musicVolume = 0.5;
  private paused = false;
  private unlocked = false;
  private musicMode: MinigameMusicMode = 'menu';

  private bufferCache = new Map<string, MinimalAudioBuffer>();
  private pendingDecode = new Set<string>();
  private musicGain: MinimalGainNode | null = null;
  private sfxGain: MinimalGainNode | null = null;
  private bgmSource: MinimalBufferSourceNode | null = null;
  private bgmPlayingMode: MinigameMusicMode | null = null;
  private bgmRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private activeSfx = new Set<{ src: MinimalBufferSourceNode; timer: ReturnType<typeof setTimeout> | null }>();
  private lastRecoveryAt = 0;
  private oscMusicStep = 0;
  private oscMusicTimer: ReturnType<typeof setTimeout> | null = null;
  private diagLogged = false;

  constructor(private readonly factory?: () => MinimalAudioContext | null) {}

  private isSuspended(ctx: MinimalAudioContext): boolean {
    const st = ctx.state as string | undefined;
    return st === 'suspended' || st === 'interrupted';
  }

  private resetContextState(): void {
    this.stopBgmSource();
    this.stopOscTimer();
    this.clearActiveSfx();
    try { this.musicGain?.disconnect?.(); } catch { /* ignore */ }
    try { this.sfxGain?.disconnect?.(); } catch { /* ignore */ }
    if (this.ctx) {
      try { this.ctx.onstatechange = null; } catch { /* ignore */ }
    }
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.bufferCache.clear();
    this.pendingDecode.clear();
    this.diagLogged = false;
  }

  private clearActiveSfx(): void {
    for (const entry of this.activeSfx) {
      if (entry.timer !== null) clearTimeout(entry.timer);
      try { entry.src.onended = null; } catch { /* ignore */ }
      try { entry.src.stop?.(); } catch { /* ignore */ }
      try { entry.src.disconnect?.(); } catch { /* ignore */ }
    }
    this.activeSfx.clear();
  }

  unlock(): void {
    this.unlocked = true;
    // Receiving an active foreground unlock/touch clears any stale pause left by a missed
    // onShow or unbalanced iOS onAudioInterruptionBegin event.
    if (this.paused) {
      this.paused = false;
      this.stopBgmSource();
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.logDiagOnce(ctx);
    if (this.isSuspended(ctx) && typeof ctx.resume === 'function') {
      if (this.bgmSource) this.stopBgmSource();
      try {
        const res = ctx.resume();
        if (res && typeof (res as Promise<void>).then === 'function') {
          (res as Promise<void>).then(() => this.syncMusicLoop(), () => { /* ignore */ });
          if (this.isSuspended(ctx)) return;
        }
      } catch { /* ignore */ }
    }
    this.syncMusicLoop();
  }

  setSettings(settings: { musicVolume?: number; soundVolume?: number }): void {
    if (typeof settings.musicVolume === 'number' && Number.isFinite(settings.musicVolume)) {
      this.musicVolume = Math.max(0, Math.min(1, settings.musicVolume));
    }
    if (typeof settings.soundVolume === 'number' && Number.isFinite(settings.soundVolume)) {
      this.soundVolume = Math.max(0, Math.min(1, settings.soundVolume));
    }
    this.syncMusicLoop();
  }

  setMusicMode(mode: MinigameMusicMode): void {
    if (this.musicMode === mode) {
      // Self-heal if BGM unexpectedly stopped (e.g. WeChat loop=true ended) or ctx silently suspended/closed.
      const ctxNeedsRecovery = this.ctx !== null && (this.isSuspended(this.ctx) || this.ctx.state === 'closed');
      if (this.unlocked && !this.paused && this.musicVolume > 0.005 && ((!this.bgmSource && this.oscMusicTimer === null) || ctxNeedsRecovery)) {
        const now = Date.now();
        if (now - this.lastRecoveryAt >= BGM_RECOVERY_THROTTLE_MS) {
          this.lastRecoveryAt = now;
          this.syncMusicLoop();
        }
      }
      return;
    }
    this.musicMode = mode;
    this.oscMusicStep = 0;
    this.syncMusicLoop();
  }

  setPaused(paused: boolean): void {
    const wasPaused = this.paused;
    this.paused = paused;
    if (paused) {
      this.stopBgmSource();
      this.stopOscTimer();
      this.clearActiveSfx();
      if (this.ctx && typeof this.ctx.suspend === 'function') {
        try { void this.ctx.suspend(); } catch { /* ignore */ }
      }
      return;
    }
    // Don't prematurely construct an AudioContext on cold-boot onShow before the first user gesture.
    if (!this.unlocked) return;
    // After OS audio interruption, ad playback, or backgrounding on iOS WeChat, restart looping BGM cleanly once resumed.
    if (wasPaused) this.stopBgmSource();
    const ctx = this.ensureContext();
    if (ctx && typeof ctx.resume === 'function') {
      try {
        const res = ctx.resume();
        if (res && typeof (res as Promise<void>).then === 'function') {
          (res as Promise<void>).then(() => this.syncMusicLoop(), () => { /* ignore */ });
          if (this.isSuspended(ctx)) return;
        }
      } catch { /* ignore */ }
    }
    this.syncMusicLoop();
  }

  play(cue: MinigameCue): void {
    if (this.paused || this.soundVolume <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.isSuspended(ctx) && typeof ctx.resume === 'function') {
      if (this.bgmSource) this.stopBgmSource();
      try {
        const res = ctx.resume();
        if (res && typeof (res as Promise<void>).then === 'function') {
          (res as Promise<void>).then(() => this.syncMusicLoop(), () => { /* ignore */ });
        }
      } catch { /* ignore */ }
    }

    const gainVol = this.soundVolume * 0.46;
    if (typeof ctx.createBufferSource === 'function') {
      const key = `sfx:${cue}`;
      this.resolveBuffer(
        ctx,
        key,
        () => {
          const notes = cueNotes(cue);
          const totalDur = notes.reduce((m, n) => Math.max(m, n[1] + n[2]), 0.06) + 0.03;
          return renderNotesToPcm(notes, totalDur, SYNTH_SAMPLE_RATE);
        },
        buf => this.playOneShotBuffer(ctx, buf, gainVol),
      );
      return;
    }

    // Legacy fallback only for runtimes without createBufferSource (e.g. minimal oscillator mocks).
    if (typeof ctx.createOscillator === 'function') {
      const now = ctx.currentTime;
      for (const [freq, offset, dur, type, amp = 1] of cueNotes(cue)) {
        this.playOscTone(ctx, freq, now + offset, dur, gainVol * amp * 0.4, type);
      }
    }
  }

  private logDiagOnce(ctx: MinimalAudioContext): void {
    if (!__ENABLE_DEV_TOOLS__) return;
    if (this.diagLogged) return;
    this.diagLogged = true;
    const backend = typeof ctx.createBufferSource === 'function'
      ? (typeof ctx.createBuffer === 'function' ? 'pcm-buffer' : typeof ctx.decodeAudioData === 'function' ? 'wav-decode' : 'none')
      : (typeof ctx.createOscillator === 'function' ? 'oscillator' : 'none');
    try {
      console.log('[CapyAudio]', backend, 'state=', ctx.state ?? 'unknown', 'sr=', ctx.sampleRate ?? SYNTH_SAMPLE_RATE);
    } catch { /* ignore */ }
  }

  private resolveBuffer(
    ctx: MinimalAudioContext,
    key: string,
    makePcm: () => Float32Array,
    onReady: (buf: MinimalAudioBuffer) => void,
  ): void {
    const cached = this.bufferCache.get(key);
    if (cached) {
      onReady(cached);
      return;
    }

    // Tier 1: Synchronous AudioBuffer creation (supported by WeChat WebAudioContext 2.19+ & all browsers)
    if (typeof ctx.createBuffer === 'function') {
      try {
        const pcm = makePcm();
        const buf = ctx.createBuffer(1, pcm.length, SYNTH_SAMPLE_RATE);
        if (typeof buf.copyToChannel === 'function') {
          buf.copyToChannel(pcm, 0);
          this.bufferCache.set(key, buf);
          onReady(buf);
          return;
        }
        if (typeof buf.getChannelData === 'function') {
          buf.getChannelData(0).set(pcm);
          this.bufferCache.set(key, buf);
          onReady(buf);
          return;
        }
      } catch { /* fall through to WAV decodeAudioData */ }
    }

    // Tier 2: Async WAV ArrayBuffer decodeAudioData (universally supported on WeChat WebAudioContext)
    if (typeof ctx.decodeAudioData === 'function') {
      if (this.pendingDecode.has(key)) return;
      this.pendingDecode.add(key);
      try {
        const pcm = makePcm();
        const wav = encodePcmToWav(pcm, SYNTH_SAMPLE_RATE);
        let settled = false;
        let decodeGuard: ReturnType<typeof setTimeout> | null = null;
        const done = (decoded: MinimalAudioBuffer) => {
          if (settled || !decoded) return;
          settled = true;
          if (decodeGuard !== null) { clearTimeout(decodeGuard); decodeGuard = null; }
          this.pendingDecode.delete(key);
          this.bufferCache.set(key, decoded);
          onReady(decoded);
        };
        const fail = () => {
          if (settled) return;
          settled = true;
          if (decodeGuard !== null) { clearTimeout(decodeGuard); decodeGuard = null; }
          this.pendingDecode.delete(key);
        };
        decodeGuard = setTimeout(fail, 8000);
        (decodeGuard as unknown as { unref?: () => void })?.unref?.();
        const maybePromise = ctx.decodeAudioData(wav, done, fail);
        if (maybePromise && typeof (maybePromise as Promise<MinimalAudioBuffer>).then === 'function') {
          (maybePromise as Promise<MinimalAudioBuffer>).then(done, fail);
        }
      } catch {
        this.pendingDecode.delete(key);
      }
    }
  }

  private ensureSfxGain(ctx: MinimalAudioContext): MinimalGainNode | null {
    if (this.sfxGain) return this.sfxGain;
    try {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      this.sfxGain = gain;
      return gain;
    } catch {
      return null;
    }
  }

  private playOneShotBuffer(ctx: MinimalAudioContext, buf: MinimalAudioBuffer, vol: number): void {
    if (this.paused || vol <= 0.0005 || typeof ctx.createBufferSource !== 'function') return;
    // Evict oldest active SFX source if at concurrent cap so WeChat's native WebAudio graph never saturates.
    while (this.activeSfx.size >= MAX_CONCURRENT_SFX) {
      const oldest = this.activeSfx.values().next().value;
      if (!oldest) break;
      this.activeSfx.delete(oldest);
      if (oldest.timer !== null) clearTimeout(oldest.timer);
      try { oldest.src.onended = null; } catch { /* ignore */ }
      try { oldest.src.stop?.(); } catch { /* ignore */ }
      try { oldest.src.disconnect?.(); } catch { /* ignore */ }
    }
    let src: MinimalBufferSourceNode | null = null;
    try {
      const gain = this.ensureSfxGain(ctx);
      if (!gain) return;
      this.setGainValue(ctx, gain, vol, false);
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      const boundSrc = src;
      const entry: { src: MinimalBufferSourceNode; timer: ReturnType<typeof setTimeout> | null } = { src: boundSrc, timer: null };
      const cleanup = () => {
        if (!this.activeSfx.delete(entry)) return;
        if (entry.timer !== null) {
          clearTimeout(entry.timer);
          entry.timer = null;
        }
        try { boundSrc.onended = null; } catch { /* ignore */ }
        try { boundSrc.disconnect?.(); } catch { /* ignore */ }
      };
      boundSrc.onended = cleanup;
      this.activeSfx.add(entry);
      const durMs = Math.max(80, Math.ceil((buf.length / (buf.sampleRate || SYNTH_SAMPLE_RATE)) * 1000)) + 180;
      entry.timer = setTimeout(() => {
        try { boundSrc.stop?.(); } catch { /* ignore */ }
        cleanup();
      }, durMs);
      (entry.timer as unknown as { unref?: () => void })?.unref?.();
      boundSrc.start(0);
    } catch {
      try { src?.disconnect?.(); } catch { /* ignore */ }
    }
  }

  private setGainValue(ctx: MinimalAudioContext, node: MinimalGainNode, target: number, smooth: boolean): void {
    try {
      const now = ctx.currentTime;
      node.gain.cancelScheduledValues?.(now);
      if (smooth && typeof node.gain.setValueAtTime === 'function' && typeof node.gain.linearRampToValueAtTime === 'function') {
        node.gain.setValueAtTime(node.gain.value, now);
        node.gain.linearRampToValueAtTime(target, now + 0.04);
      } else {
        node.gain.setValueAtTime?.(target, now);
        node.gain.value = target;
      }
    } catch {
      try { node.gain.value = target; } catch { /* ignore */ }
    }
  }

  private ensureMusicGain(ctx: MinimalAudioContext): MinimalGainNode | null {
    if (this.musicGain) return this.musicGain;
    try {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      this.musicGain = gain;
      return gain;
    } catch {
      return null;
    }
  }

  private stopBgmSource(): void {
    if (this.bgmRestartTimer !== null) {
      clearTimeout(this.bgmRestartTimer);
      this.bgmRestartTimer = null;
    }
    const src = this.bgmSource;
    this.bgmSource = null;
    this.bgmPlayingMode = null;
    if (src) {
      try { src.onended = null; } catch { /* ignore */ }
      try { src.stop?.(); } catch { /* ignore */ }
      try { src.disconnect?.(); } catch { /* ignore */ }
    }
  }

  private stopOscTimer(): void {
    if (this.oscMusicTimer !== null) {
      clearTimeout(this.oscMusicTimer);
      this.oscMusicTimer = null;
    }
  }

  private syncMusicLoop(): void {
    if (!this.unlocked || this.paused || this.musicVolume <= 0.005) {
      this.stopBgmSource();
      this.stopOscTimer();
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Do not start or cache a looping BGM source while iOS/WeChat AudioContext is still suspended/interrupted;
    // drop any stale source and wait for resume() to resolve so the source actually plays instead of stalling.
    if (this.isSuspended(ctx)) {
      if (this.bgmSource) this.stopBgmSource();
      if (typeof ctx.resume === 'function') {
        try {
          const res = ctx.resume();
          if (res && typeof (res as Promise<void>).then === 'function') {
            (res as Promise<void>).then(() => {
              if (!this.isSuspended(ctx)) this.syncMusicLoop();
            }, () => { /* ignore */ });
          }
        } catch { /* ignore */ }
      }
      if (this.isSuspended(ctx)) return;
    }

    const targetGain = this.musicVolume * 0.34;
    if (typeof ctx.createBufferSource === 'function') {
      const mGain = this.ensureMusicGain(ctx);
      if (!mGain) return;
      this.setGainValue(ctx, mGain, targetGain, Boolean(this.bgmSource));
      if (this.bgmSource && this.bgmPlayingMode === this.musicMode) return;

      const wantedMode = this.musicMode;
      this.stopBgmSource();
      this.resolveBuffer(
        ctx,
        `bgm:${wantedMode}`,
        () => renderBgmPcm(wantedMode, SYNTH_SAMPLE_RATE),
        buf => {
          if (!this.unlocked || this.paused || this.musicVolume <= 0.005 || this.musicMode !== wantedMode || this.isSuspended(ctx)) return;
          if (this.bgmSource && this.bgmPlayingMode === wantedMode) return;
          try {
            const src = ctx.createBufferSource!();
            src.buffer = buf;
            src.loop = true;
            src.connect(mGain);
            src.onended = () => {
              const wasActive = this.bgmSource === src;
              if (wasActive) {
                this.bgmSource = null;
                this.bgmPlayingMode = null;
              }
              try { src.disconnect?.(); } catch { /* ignore */ }
              // Some WeChat base libraries stop `loop = true` after 1 full cycle (~30s) or on silent OS glitches;
              // automatically restart BGM cleanly if it ended unexpectedly while unpaused.
              if (wasActive && this.unlocked && !this.paused && this.musicVolume > 0.005) {
                if (this.bgmRestartTimer !== null) clearTimeout(this.bgmRestartTimer);
                this.bgmRestartTimer = setTimeout(() => {
                  this.bgmRestartTimer = null;
                  this.syncMusicLoop();
                }, 40);
              }
            };
            src.start(0);
            this.bgmSource = src;
            this.bgmPlayingMode = wantedMode;
          } catch { /* ignore */ }
        },
      );
      return;
    }

    // Legacy oscillator loop fallback only if createBufferSource does not exist.
    if (typeof ctx.createOscillator === 'function' && this.oscMusicTimer === null) {
      this.scheduleOscBeat();
    }
  }

  private scheduleOscBeat(): void {
    if (!this.unlocked || this.paused || this.musicVolume <= 0.005) {
      this.stopOscTimer();
      return;
    }
    const ctx = this.ensureContext();
    const quarter = 60 / TEMPOS[this.musicMode];
    if (ctx && typeof ctx.createOscillator === 'function') {
      const bar = Math.floor(this.oscMusicStep / 4) % 16;
      const beat = this.oscMusicStep % 4;
      const eighth = quarter / 2;
      const now = ctx.currentTime;
      const baseVol = this.musicVolume * 0.14;
      const boss = this.musicMode === 'boss';
      const melody = (this.musicMode === 'menu' ? PASTORAL : boss ? SHOWDOWN : TACTICAL)[bar];
      this.playOscTone(ctx, midiHz(melody[beat * 2]), now, eighth * 0.8, baseVol, boss ? 'sawtooth' : 'triangle');
      this.oscMusicStep = (this.oscMusicStep + 1) % 64;
    }
    this.oscMusicTimer = setTimeout(() => {
      this.oscMusicTimer = null;
      this.scheduleOscBeat();
    }, Math.max(120, Math.round(quarter * 1000)));
  }

  private playOscTone(ctx: MinimalAudioContext, freq: number, start: number, dur: number, vol: number, type: WaveKind): void {
    if (vol <= 0.0002 || typeof ctx.createOscillator !== 'function') return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime?.(freq, start);
      gain.gain.setValueAtTime?.(0.0001, start);
      gain.gain.exponentialRampToValueAtTime?.(vol, start + 0.014);
      gain.gain.exponentialRampToValueAtTime?.(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      (osc as unknown as { onended?: (() => void) | null }).onended = () => {
        try { (osc as unknown as { disconnect?: () => void }).disconnect?.(); } catch { /* ignore */ }
        try { gain.disconnect?.(); } catch { /* ignore */ }
      };
      osc.start(start);
      osc.stop(start + dur + 0.025);
    } catch { /* ignore unsupported runtime node errors */ }
  }

  private ensureContext(): MinimalAudioContext | null {
    if (this.ctx) {
      // Rebuild cleanly if the host closed our AudioContext (e.g. after a long iOS interruption/ad).
      if (this.ctx.state === 'closed') {
        this.resetContextState();
      } else {
        return this.ctx;
      }
    }
    try {
      if (this.factory) {
        this.ctx = this.factory();
      } else {
        const Ctor = (globalThis as { AudioContext?: new () => MinimalAudioContext; webkitAudioContext?: new () => MinimalAudioContext }).AudioContext
          ?? (globalThis as { webkitAudioContext?: new () => MinimalAudioContext }).webkitAudioContext;
        this.ctx = Ctor ? new Ctor() : null;
      }
      if (this.ctx) {
        const boundCtx = this.ctx;
        try {
          boundCtx.onstatechange = () => {
            if (this.ctx !== boundCtx) return;
            if (boundCtx.state === 'suspended' || boundCtx.state === 'interrupted') {
              this.stopBgmSource();
            } else if (boundCtx.state === 'running' && this.unlocked && !this.paused) {
              this.syncMusicLoop();
            } else if (boundCtx.state === 'closed') {
              this.resetContextState();
            }
          };
        } catch { /* host may expose read-only onstatechange */ }
      }
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }
}
