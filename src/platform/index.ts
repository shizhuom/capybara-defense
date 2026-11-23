import { createMiniGameAdapter, type MiniGameGlobalApi } from './minigameAdapter';
import { createWebPreviewAdapter, type WebPreviewOptions } from './webPreviewAdapter';
import type { PlatformAdapter, PlatformKind } from './types';

export * from './types';
export { computeViewport, screenToStage } from './viewport';
export { MinigameAudio } from './MinigameAudio';
export { createMiniGameAdapter, createMiniFetch, createMiniStorage, type MiniGameGlobalApi } from './minigameAdapter';
export { createWebPreviewAdapter, type WebPreviewOptions } from './webPreviewAdapter';

declare global {
  // Injected at runtime by WeChat (`wx`) or Bilibili (`bl`) mini-game containers.
  // eslint-disable-next-line no-var
  var wx: MiniGameGlobalApi | undefined;
  // eslint-disable-next-line no-var
  var bl: MiniGameGlobalApi | undefined;
}

export function detectPlatform(): PlatformKind {
  if (typeof globalThis.bl === 'object' && globalThis.bl !== null && typeof globalThis.bl.createCanvas === 'function') return 'bl';
  if (typeof globalThis.wx === 'object' && globalThis.wx !== null && typeof globalThis.wx.createCanvas === 'function') return 'wx';
  return 'web';
}

export function createPlatform(options: WebPreviewOptions = {}): PlatformAdapter {
  const kind = detectPlatform();
  if (kind === 'bl' && globalThis.bl) return createMiniGameAdapter(globalThis.bl, 'bl');
  if (kind === 'wx' && globalThis.wx) return createMiniGameAdapter(globalThis.wx, 'wx');
  return createWebPreviewAdapter(options);
}
