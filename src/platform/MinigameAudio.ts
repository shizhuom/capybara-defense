import type { MinigameAudioController, MinigameCue, MinigameMusicMode } from './types';

interface MinimalAudioContext {
  state?: string;
  currentTime: number;
  destination: AudioNode;
  resume?: () => Promise<void> | void;
  suspend?: () => Promise<void> | void;
  createOscillator: () => OscillatorNode;
  createGain: () => GainNode;
}

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

/**
 * Lightweight standalone audio & BGM synthesizer for WeChat/Bilibili mini-game builds.
 * Completely independent from Web's SoundManager / MusicTracks / AudioGestures.
 */
export class MinigameAudio implements MinigameAudioController {
  private ctx: MinimalAudioContext | null = null;
  private soundVolume = 0.75;
  private musicVolume = 0.5;
  private paused = false;
  private unlocked = false;
  private musicMode: MinigameMusicMode = 'menu';
  private musicStep = 0;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly factory?: () => MinimalAudioContext | null) {}

  unlock(): void {
    this.unlocked = true;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      try { void ctx.resume?.(); } catch { /* ignore */ }
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
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    this.musicStep = 0;
    this.syncMusicLoop();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.syncMusicLoop();
    if (!this.ctx) return;
    try {
      if (paused) void this.ctx.suspend?.();
      else void this.ctx.resume?.();
    } catch { /* ignore */ }
  }

  private stopMusicTimer(): void {
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private syncMusicLoop(): void {
    if (!this.unlocked || this.paused || this.musicVolume <= 0.005) {
      this.stopMusicTimer();
      return;
    }
    if (this.musicTimer !== null) return;
    this.scheduleMusicBeat();
  }

  private scheduleMusicBeat(): void {
    if (!this.unlocked || this.paused || this.musicVolume <= 0.005) {
      this.stopMusicTimer();
      return;
    }
    const ctx = this.ensureContext();
    const quarter = 60 / TEMPOS[this.musicMode];
    if (ctx) {
      this.playMusicQuarter(ctx, this.musicMode, this.musicStep, quarter);
      this.musicStep = (this.musicStep + 1) % 64;
    }
    this.musicTimer = setTimeout(() => {
      this.musicTimer = null;
      this.scheduleMusicBeat();
    }, Math.max(120, Math.round(quarter * 1000)));
  }

  private playMusicQuarter(ctx: MinimalAudioContext, mode: MinigameMusicMode, step: number, quarter: number): void {
    const bar = Math.floor(step / 4) % 16;
    const beat = step % 4;
    const eighth = quarter / 2;
    const now = ctx.currentTime;
    const baseVol = this.musicVolume * 0.085;

    if (mode === 'menu') {
      const root = MENU_ROOTS[bar];
      const melody = PASTORAL[bar];
      this.tone(ctx, midiHz(melody[beat * 2]), now, eighth * 0.88, baseVol * 0.85, 'triangle');
      this.tone(ctx, midiHz(melody[beat * 2 + 1]), now + eighth, eighth * 0.8, baseVol * 0.72, 'triangle');
      this.tone(ctx, midiHz(root + (beat % 2 ? 7 : 0)), now, quarter * 0.65, baseVol * 0.68, 'sine');
      if (beat % 2 === 0) this.tone(ctx, midiHz(melody[beat * 2] + 12), now, 0.2, baseVol * 0.28, 'sine');
      return;
    }

    const boss = mode === 'boss';
    const root = (boss ? BOSS_ROOTS : BATTLE_ROOTS)[bar];
    const melody = (boss ? SHOWDOWN : TACTICAL)[bar];
    const leadType: OscillatorType = boss ? 'sawtooth' : 'triangle';
    this.tone(ctx, midiHz(melody[beat * 2]), now, eighth * 0.72, baseVol * (boss ? 0.58 : 0.82), leadType);
    this.tone(ctx, midiHz(melody[beat * 2 + 1]), now + eighth, eighth * 0.68, baseVol * (boss ? 0.48 : 0.7), leadType);
    this.tone(ctx, midiHz(root), now, eighth * 0.76, baseVol * 0.75, 'triangle');
    this.tone(ctx, midiHz(root + (beat % 2 ? 7 : 12)), now + eighth, eighth * 0.68, baseVol * 0.56, 'triangle');
  }

  private tone(ctx: MinimalAudioContext, freq: number, start: number, dur: number, vol: number, type: OscillatorType): void {
    if (vol <= 0.0002) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.025);
    } catch { /* ignore unsupported runtime node errors */ }
  }

  play(cue: MinigameCue): void {
    if (this.paused || this.soundVolume <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = this.soundVolume * 0.16;
    const notes: ReadonlyArray<[number, number, number, OscillatorType]> =
      cue === 'click' ? [[520, 0, 0.055, 'triangle']]
      : cue === 'summon' ? [[440, 0, 0.07, 'triangle'], [587, 0.05, 0.09, 'triangle']]
      : cue === 'shovel' ? [[210, 0, 0.08, 'sine'], [310, 0.04, 0.06, 'triangle']]
      : cue === 'merge_upgrade' ? [[523, 0, 0.08, 'triangle'], [659, 0.07, 0.11, 'triangle']]
      : cue === 'merge_hero' || cue === 'hero_ult' ? [[523, 0, 0.09, 'triangle'], [659, 0.08, 0.09, 'triangle'], [784, 0.16, 0.18, 'sine']]
      : cue === 'coin' || cue === 'gacha_win' ? [[880, 0, 0.06, 'sine'], [1174, 0.055, 0.1, 'sine']]
      : cue === 'hit_melee' ? [[280, 0, 0.04, 'triangle']]
      : cue === 'hit_ranged' ? [[620, 0, 0.038, 'sine']]
      : cue === 'hit_magic' ? [[760, 0, 0.05, 'sine'], [980, 0.03, 0.05, 'sine']]
      : cue === 'hit_heavy' ? [[180, 0, 0.07, 'triangle']]
      : cue === 'enemy_defeat' ? [[480, 0, 0.04, 'triangle'], [640, 0.03, 0.05, 'sine']]
      : cue === 'wave_start' ? [[392, 0, 0.08, 'triangle'], [523, 0.08, 0.12, 'triangle']]
      : cue === 'boss_arrive' ? [[196, 0, 0.12, 'sawtooth'], [165, 0.12, 0.18, 'sawtooth']]
      : cue === 'orange_loss' ? [[330, 0, 0.09, 'triangle'], [220, 0.09, 0.14, 'triangle']]
      : cue === 'orange_gain' ? [[587, 0, 0.07, 'sine'], [880, 0.07, 0.1, 'sine']]
      : cue === 'sprinkler' ? [[520, 0, 0.07, 'sine'], [740, 0.05, 0.08, 'sine'], [980, 0.1, 0.12, 'sine']]
      : cue === 'giant_cat' ? [[150, 0, 0.14, 'triangle'], [240, 0.08, 0.12, 'sine']]
      : cue === 'prop_use' ? [[494, 0, 0.06, 'triangle'], [740, 0.06, 0.1, 'sine']]
      : cue === 'victory' ? [[523, 0, 0.11, 'triangle'], [659, 0.1, 0.11, 'triangle'], [784, 0.2, 0.13, 'triangle'], [1046, 0.32, 0.24, 'sine']]
      : [[330, 0, 0.12, 'triangle'], [277, 0.12, 0.14, 'triangle'], [220, 0.26, 0.22, 'sine']];

    for (const [freq, offset, dur, type] of notes) {
      this.tone(ctx, freq, now + offset, dur, vol, type);
    }
  }

  private ensureContext(): MinimalAudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      if (this.factory) {
        this.ctx = this.factory();
        return this.ctx;
      }
      const Ctor = (globalThis as { AudioContext?: new () => MinimalAudioContext; webkitAudioContext?: new () => MinimalAudioContext }).AudioContext
        ?? (globalThis as { webkitAudioContext?: new () => MinimalAudioContext }).webkitAudioContext;
      this.ctx = Ctor ? new Ctor() : null;
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }
}
