import type { FeatureId } from '../../core/FeatureUnlocks';
import { t } from '../../i18n/i18n';
import { round } from '../../render/StickerArt';
import type { BattleLessonKey } from '../../ui/OnboardingGuide';
import {
  PALETTE,
  drawIvorySlab,
  drawPillButton,
  drawSpriteContain,
  drawText,
  drawWrappedText,
  type UiHitManager,
} from './CanvasUI';

const FEATURE_MASCOT: Record<FeatureId, string> = {
  armory: 'ui_armory_peek_capy',
  speed2x: 'ui_tutorial_capy',
  market: 'ui_market_peek_raccoon',
  endless: 'ui_endless_emblem',
  village: 'ui_village_peek_capy',
  kitchen: 'ui_kitchen_peek_capy',
  medallions: 'ui_medallion_peek_capy',
  speed3x: 'ui_tutorial_capy',
};

/**
 * Strict 1:1 Web Courtyard New-Feature Welcome Card (`OnboardingGuide.ts` + `p19_03_stage1_armory_welcome.png`):
 * - Lightweight warm-cream rounded card floating gracefully above the wooden dock (so the soaking capybara & pets remain visible!)
 * - Left peeking feature mascot (`92×92`), bright green pill badge `新功能解锁`, bold title, crisp mobile-readable body,
 *   and side-by-side rounded pill buttons (`立刻去体验 →` bright green + `跳过指引` cream)!
 */
export function drawOnboardingUnlockModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  feature: FeatureId,
): void {
  const pw = 720, ph = 258;
  const px = (1280 - pw) / 2, py = 368;

  // Soft outer shadow + warm cream parchment card
  round(c, px, py + 8, pw, ph, 26, 'rgba(30,16,6,0.36)', 'transparent', 0);
  drawIvorySlab(c, px, py, pw, ph, 26, '#fffdf7', '#f7ead0', '#70461e', 3.8);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Left peeking mascot
  if (!drawSpriteContain(c, FEATURE_MASCOT[feature], px + 24, py + (ph - 120) / 2, 120, 120)) {
    drawSpriteContain(c, 'ui_tutorial_capy', px + 24, py + (ph - 120) / 2, 120, 120);
  }

  const cx = px + 162;
  const cw = pw - 188;

  // Bright green pill badge `新功能解锁`
  round(c, cx, py + 20, 134, 34, 17, '#79bd3c', '#3d6e19', 2);
  drawText(c, t('p19.guideTag'), cx + 67, py + 38, 18, '#fffdf5', 'center', 900);

  // Title & readable body
  drawText(c, t(`p19.onboard.${feature}.title`), cx, py + 78, 28, PALETTE.ink, 'left', 900);
  drawWrappedText(c, t(`p19.onboard.${feature}.body`), cx, py + 102, cw, 20.5, 28, PALETTE.inkSoft, 'left', 700, 3);

  // Pill CTA Row
  const fy = py + ph - 66;
  const isMenuHub = feature === 'armory' || feature === 'market' || feature === 'village' || feature === 'kitchen' || feature === 'medallions';
  if (isMenuHub) {
    drawPillButton(c, hits, `onboard:go:${feature}`, cx, fy, 232, 52, t('p19.guideGo'), 'green', { fontSize: 22 });
    drawPillButton(c, hits, `onboard:dismiss:${feature}`, cx + 248, fy, 156, 52, t('p19.guideSkip'), 'cream', { fontSize: 20 });
  } else {
    drawPillButton(c, hits, `onboard:dismiss:${feature}`, cx, fy, 260, 52, t('p19.guideGotIt'), 'green', { fontSize: 22 });
  }
}

export function drawBattleLessonModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  lesson: BattleLessonKey,
): void {
  const pw = 590, ph = 288;
  let px = (1280 - pw) / 2;
  let py = (720 - ph) / 2;
  if (lesson === 'prop_battle') {
    px = 148;
    py = 212;
  } else if (lesson === 'speed2x' || lesson === 'speed3x') {
    px = 580;
    py = 88;
  }

  round(c, px, py + 8, pw, ph, 24, 'rgba(28,14,4,0.36)', 'transparent', 0);
  drawIvorySlab(c, px, py, pw, ph, 24, '#fffdf7', '#f7ead0', '#70461e', 3.8);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  const mascot = lesson === 'endless_battle' ? 'ui_endless_emblem' : lesson === 'prop_battle' ? 'ui_market_peek_raccoon' : 'ui_tutorial_capy';
  drawSpriteContain(c, mascot, px + 24, py + 18, 78, 78);

  // Green tag + Title
  round(c, px + 116, py + 20, 128, 32, 16, '#79bd3c', '#3d6e19', 2);
  drawText(c, t('p19.guideTag'), px + 180, py + 37, 17, '#fffdf5', 'center', 900);
  drawText(c, t(`p19.onboard.${lesson}.title`), px + 116, py + 74, 27, PALETTE.ink, 'left', 900);

  // Body
  drawWrappedText(c, t(`p19.onboard.${lesson}.body`), px + 28, py + 110, pw - 56, 21, 29, PALETTE.inkSoft, 'left', 700, 4);

  // Bottom green Got-It pill button
  drawPillButton(c, hits, `lesson:ok:${lesson}`, px + pw / 2 - 134, py + ph - 66, 268, 52, t('p19.guideGotIt'), 'green', { fontSize: 22 });
}
