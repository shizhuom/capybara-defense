import { STAGE } from '../config/maps';
import type { SafeAreaInsets, StageBounds, ViewportMetrics } from './types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export interface MenuButtonRect {
  left: number;
  right?: number;
  top?: number;
  bottom?: number;
  width?: number;
  height?: number;
}

/**
 * Full-bleed adaptive viewport mapping for all mobile & tablet aspect ratios:
 * - Scales the canonical 1280×720 gameplay stage to fill the FULL screen height (wide phones 19.5:9–22:9)
 *   or FULL screen width (tablets/foldables 4:3–16:10) with ZERO black letterbox bars!
 * - Exposes `visible` (full screen in stage coordinates) for edge-to-edge full-bleed scenery,
 *   plus `safeStage` and `capsuleStageLeft` so HUD controls clear Dynamic Island, punch-holes,
 *   Home Indicator, and the WeChat/Bilibili floating capsule on every device model.
 */
export function computeViewport(
  rawWidth: number,
  rawHeight: number,
  rawDpr = 1,
  safeArea?: Partial<SafeAreaInsets>,
  isTouch = false,
  menuButton?: MenuButtonRect | null,
): ViewportMetrics {
  const screenWidth = Math.max(1, Number.isFinite(rawWidth) ? rawWidth : STAGE.width);
  const screenHeight = Math.max(1, Number.isFinite(rawHeight) ? rawHeight : STAGE.height);
  const dpr = clamp(Number.isFinite(rawDpr) ? rawDpr : 1, 1, 2.5);
  const safe: SafeAreaInsets = {
    top: Math.max(0, safeArea?.top ?? 0),
    bottom: Math.max(0, safeArea?.bottom ?? 0),
    left: Math.max(0, safeArea?.left ?? 0),
    right: Math.max(0, safeArea?.right ?? 0),
  };

  // Scale against full physical screen so wide phones (19.5:9/20:9/21:9) never get shrunk by black margins.
  const cssScale = Math.min(screenWidth / STAGE.width, screenHeight / STAGE.height);
  const stageCssWidth = STAGE.width * cssScale;
  const stageCssHeight = STAGE.height * cssScale;
  const stageCssX = (screenWidth - stageCssWidth) / 2;
  const stageCssY = (screenHeight - stageCssHeight) / 2;

  const visibleLeft = -stageCssX / cssScale;
  const visibleRight = (screenWidth - stageCssX) / cssScale;
  const visibleTop = -stageCssY / cssScale;
  const visibleBottom = (screenHeight - stageCssY) / cssScale;
  const visible: StageBounds = {
    left: visibleLeft,
    right: visibleRight,
    top: visibleTop,
    bottom: visibleBottom,
    width: visibleRight - visibleLeft,
    height: visibleBottom - visibleTop,
  };

  const safeLeft = clamp((safe.left - stageCssX) / cssScale, visibleLeft, visibleRight);
  const safeRight = clamp((screenWidth - safe.right - stageCssX) / cssScale, safeLeft, visibleRight);
  const safeTop = clamp((safe.top - stageCssY) / cssScale, visibleTop, visibleBottom);
  const safeBottom = clamp((screenHeight - safe.bottom - stageCssY) / cssScale, safeTop, visibleBottom);
  const safeStage: StageBounds = {
    left: safeLeft,
    right: safeRight,
    top: safeTop,
    bottom: safeBottom,
    width: safeRight - safeLeft,
    height: safeBottom - safeTop,
  };

  const capsuleStageLeft =
    menuButton && Number.isFinite(menuButton.left) && menuButton.left > 0
      ? (menuButton.left - stageCssX) / cssScale
      : undefined;

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
    visible,
    safeStage,
    capsuleStageLeft,
    isTouch,
  };
}

/** Converts a logical screen touch/pointer coordinate into 1280×720 stage coordinates. */
export function screenToStage(screenX: number, screenY: number, vp: ViewportMetrics): { stageX: number; stageY: number } {
  const stageX = vp.stageCssWidth > 0 ? ((screenX - vp.stageCssX) / vp.stageCssWidth) * STAGE.width : 0;
  const stageY = vp.stageCssHeight > 0 ? ((screenY - vp.stageCssY) / vp.stageCssHeight) * STAGE.height : 0;
  return { stageX, stageY };
}
