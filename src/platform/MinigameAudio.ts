import type { MinigameAudioController, MinigameCue } from './types';

interface MinimalAudioContext {
  state?: string;
  currentTime: number;
  destination: AudioNode;
  resume?: () => Promise<void> | void;
  suspend?: () => Promise<void> | void;
  createOscillator: () => OscillatorNode;
  createGain: () => GainNode;
}

/**
 * Lightweight standalone audio synthesizer for WeChat/Bilibili mini-game builds.
 * Completely independent from Web's SoundManager / MusicTracks / AudioGestures.
 */
export class MinigameAudio implements MinigameAudioController {
  private ctx: MinimalAudioContext | null = null;
  private soundVolume = 0.75;
  private musicVolume = 0.5;
  private paused = false;

  constructor(private readonly factory?: () => MinimalAudioContext | null) {}

  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      try { void ctx.resume?.(); } catch { /* ignore */ }
    }
  }

  setSettings(settings: { musicVolume?: number; soundVolume?: number }): void {
    if (typeof settings.musicVolume === 'number' && Number.isFinite(settings.musicVolume)) {
      this.musicVolume = Math.max(0, Math.min(1, settings.musicVolume));
    }
    if (typeof settings.soundVolume === 'number' && Number.isFinite(settings.soundVolume)) {
      this.soundVolume = Math.max(0, Math.min(1, settings.soundVolume));
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.ctx) return;
    try {
      if (paused) void this.ctx.suspend?.();
      else void this.ctx.resume?.();
    } catch { /* ignore */ }
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
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(vol, now + offset + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + dur + 0.02);
      } catch { /* ignore unsupported runtime node errors */ }
    }
    void this.musicVolume;
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
