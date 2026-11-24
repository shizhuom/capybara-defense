import type { SpriteImage } from '../render/AssetRegistry';

export type PlatformKind = 'web' | 'wx' | 'bl';
export type SubpackageName = 'maps' | 'meta';
export type RewardedAdOutcome = 'completed' | 'skipped' | 'unavailable';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface StageBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ViewportMetrics {
  /** Logical CSS / screen points. */
  screenWidth: number;
  screenHeight: number;
  /** Physical pixel ratio clamped to [1, 2.5]. */
  dpr: number;
  /** Safe-area insets in logical points. */
  safe: SafeAreaInsets;
  /** 1280×720 stage mapping in physical canvas pixels (`setTransform(stageScale, 0, 0, stageScale, stageOffsetX, stageOffsetY)`). */
  stageScale: number;
  stageOffsetX: number;
  stageOffsetY: number;
  /** 1280×720 stage box in logical screen coordinates (for touch hit conversion). */
  stageCssX: number;
  stageCssY: number;
  stageCssWidth: number;
  stageCssHeight: number;
  /** Full visible screen expressed in stage coordinates (extends beyond 0..1280 on wide phones and beyond 0..720 on tablets). */
  visible: StageBounds;
  /** Safe interactive screen bounds in stage coordinates (inside hardware notch/Dynamic Island/Home Indicator). */
  safeStage: StageBounds;
  /** Left edge of the WeChat/Bilibili top-right floating capsule button in stage coordinates, when known. */
  capsuleStageLeft?: number;
  isTouch: boolean;
}

export interface TouchEventData {
  id: number;
  screenX: number;
  screenY: number;
  stageX: number;
  stageY: number;
  pointerType: 'touch' | 'mouse';
}

export interface TouchHandlers {
  start?: (point: TouchEventData) => void;
  move?: (point: TouchEventData) => void;
  end?: (point: TouchEventData) => void;
  cancel?: (point: TouchEventData) => void;
}

export interface KeyboardPromptOptions {
  value: string;
  maxLength: number;
  placeholder?: string;
  confirmText?: string;
}

export interface ShareOptions {
  title: string;
  imageUrl?: string;
  query?: string;
}

export type MinigameCue =
  | 'click'
  | 'summon'
  | 'shovel'
  | 'merge_hero'
  | 'merge_upgrade'
  | 'victory'
  | 'defeat'
  | 'coin'
  | 'hit_melee'
  | 'hit_ranged'
  | 'hit_magic'
  | 'hit_heavy'
  | 'enemy_defeat'
  | 'boss_arrive'
  | 'wave_start'
  | 'orange_loss'
  | 'orange_gain'
  | 'sprinkler'
  | 'giant_cat'
  | 'prop_use'
  | 'hero_ult'
  | 'gacha_win';

export type MinigameMusicMode = 'menu' | 'battle' | 'boss';

export interface MinigameAudioController {
  unlock(): void;
  setSettings(settings: { musicVolume?: number; soundVolume?: number }): void;
  play(cue: MinigameCue): void;
  setMusicMode?(mode: MinigameMusicMode): void;
  setPaused(paused: boolean): void;
}

export interface PlatformAdapter {
  readonly kind: PlatformKind;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly storage: Storage;
  readonly fetch: typeof fetch;
  readonly audio: MinigameAudioController;
  viewport(): ViewportMetrics;
  onResize(callback: (vp: ViewportMetrics) => void): () => void;
  onTouch(handlers: TouchHandlers): () => void;
  createImage(): SpriteImage;
  loadSubpackage(name: SubpackageName): Promise<boolean>;
  resolveAssetPath(relativePath: string): string;
  showKeyboard(options: KeyboardPromptOptions): Promise<string | null>;
  showRewardedAd(adUnitId?: string): Promise<RewardedAdOutcome>;
  share(options: ShareOptions): void;
  now(): number;
  requestFrame(callback: (timestampMs: number) => void): number;
  cancelFrame(id: number): void;
  onShow(callback: () => void): () => void;
  onHide(callback: () => void): () => void;
  dispose(): void;
}
