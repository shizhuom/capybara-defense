import { STAGE } from '../config/maps';
import type { SafeAreaInsets, ViewportMetrics } from './types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Maps the canonical 1280×720 stage into any screen while keeping iPhone landscape
 * touch controls safely lifted above the iOS bottom Home Indicator swipe zone.
 */
export function computeViewport(
  rawWidth: number,
  rawHeight: number,
  rawDpr = 1,
  safeArea?: Partial<SafeAreaInsets>,
  isTouch = false,
): ViewportMetrics {
  const screenWidth = Math.max(1, Number.isFinite(rawWidth) ? rawWidth : STAGE.width);
  const screenHeight = Math.max(1, Number.isFinite(rawHeight) ? rawHeight : STAGE.height);
  const dpr = clamp(Number.isFinite(rawDpr) ? rawDpr : 1, 1, 2.5);
  const landscapePhone = isTouch && screenWidth > screenHeight && screenHeight <= 520;
  const rawBottom = Math.max(0, safeArea?.bottom ?? 0);
  const safe: SafeAreaInsets = {
    top: Math.max(0, safeArea?.top ?? 0),
    bottom: landscapePhone ? Math.max(28, rawBottom + 12) : rawBottom,
    left: Math.max(0, safeArea?.left ?? 0),
    right: Math.max(0, safeArea?.right ?? 0),
  };

  const availW = Math.max(1, screenWidth - safe.left - safe.right);
  const availH = Math.max(1, screenHeight - safe.top - safe.bottom);
  const cssScale = Math.min(availW / STAGE.width, availH / STAGE.height);
  const stageCssWidth = STAGE.width * cssScale;
  const stageCssHeight = STAGE.height * cssScale;
  const stageCssX = safe.left + (availW - stageCssWidth) / 2;
  // On landscape phones, align stage toward the top safe edge so bench nests stay far from the bottom glass edge.
  const stageCssY = landscapePhone ? safe.top : safe.top + (availH - stageCssHeight) / 2;

  return {
    screenWidth,
    screenHeight,
    dpr,
    safe,
    stageScale: cssScale * dpr,
    stageOffsetX: stageCssX * dpr,
    stageOffsetY: stageCssY * dpr,
    stageCssX,
    stageCssY,
    stageCssWidth,
    stageCssHeight,
    isTouch,
  };
}

/** Converts a logical screen touch/pointer coordinate into 1280×720 stage coordinates. */
export function screenToStage(screenX: number, screenY: number, vp: ViewportMetrics): { stageX: number; stageY: number } {
  const stageX = vp.stageCssWidth > 0 ? ((screenX - vp.stageCssX) / vp.stageCssWidth) * STAGE.width : 0;
  const stageY = vp.stageCssHeight > 0 ? ((screenY - vp.stageCssY) / vp.stageCssHeight) * STAGE.height : 0;
  return { stageX, stageY };
}
