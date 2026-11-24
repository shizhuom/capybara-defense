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
  const rawTop = Math.max(0, Number.isFinite(safeArea?.top) ? safeArea!.top! : 0);
  const rawBottom = Math.max(0, Number.isFinite(safeArea?.bottom) ? safeArea!.bottom! : 0);
  const rawLeft = Math.max(0, Number.isFinite(safeArea?.left) ? safeArea!.left! : 0);
  const rawRight = Math.max(0, Number.isFinite(safeArea?.right) ? safeArea!.right! : 0);
  // Guard against stale portrait safe-area insets on landscape mobile runtimes (e.g. iOS WeChat returning right=459 on 852px screen).
  const maxXInset = Math.min(96, screenWidth * 0.16);
  const maxYInset = Math.min(64, screenHeight * 0.16);
  const bogusHorizontal = rawLeft > maxXInset || rawRight > maxXInset || rawLeft + rawRight > screenWidth * 0.30;
  const bogusVertical = rawTop > maxYInset || rawBottom > maxYInset || rawTop + rawBottom > screenHeight * 0.30;
  const wideNotchFallback = screenWidth / screenHeight >= 1.85 ? Math.round(Math.min(54, screenWidth * 0.055)) : 0;
  const safe: SafeAreaInsets = {
    top: bogusVertical ? 0 : rawTop,
    bottom: bogusVertical ? (screenWidth / screenHeight >= 1.85 ? 21 : 0) : rawBottom,
    left: bogusHorizontal ? wideNotchFallback : rawLeft,
    right: bogusHorizontal ? wideNotchFallback : rawRight,
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

  // Accept floating capsule rect ONLY when it lies genuinely near the top-right corner of the current orientation
  // (rejects stale portrait coordinates like left=299/right=386 on an 852px landscape iPhone, or wide transient banners).
  const validMenuButton = Boolean(
    menuButton
      && Number.isFinite(menuButton.left)
      && menuButton.left >= screenWidth * 0.72
      && menuButton.left < screenWidth - 36
      && (menuButton.right === undefined || !Number.isFinite(menuButton.right) || (menuButton.right >= screenWidth * 0.80 && menuButton.right <= screenWidth + 12))
      && (menuButton.width === undefined || !Number.isFinite(menuButton.width) || (menuButton.width >= 40 && menuButton.width <= 180)),
  );
  const capsuleStageLeft = validMenuButton
    ? (menuButton!.left - stageCssX) / cssScale
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
