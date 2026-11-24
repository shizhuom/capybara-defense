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
  const pw = 620, ph = 224;
  const px = (1280 - pw) / 2, py = 398;

  // Soft outer shadow + warm cream parchment card (NO heavy dark wood frame obscuring the courtyard!)
  round(c, px, py + 8, pw, ph, 24, 'rgba(30,16,6,0.34)', 'transparent', 0);
  drawIvorySlab(c, px, py, pw, ph, 24, '#fffdf7', '#f7ead0', '#70461e', 3.4);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Left peeking mascot
  if (!drawSpriteContain(c, FEATURE_MASCOT[feature], px + 22, py + (ph - 104) / 2, 104, 104)) {
    drawSpriteContain(c, 'ui_tutorial_capy', px + 22, py + (ph - 104) / 2, 104, 104);
  }

  const cx = px + 142;
  const cw = pw - 166;

  // Bright green pill badge `新功能解锁`
  round(c, cx, py + 18, 108, 28, 14, '#79bd3c', '#3d6e19', 1.8);
  drawText(c, t('p19.guideTag'), cx + 54, py + 33, 14, '#fffdf5', 'center', 900);

  // Title & readable body
  drawText(c, t(`p19.onboard.${feature}.title`), cx, py + 66, 23, PALETTE.ink, 'left', 900);
  drawWrappedText(c, t(`p19.onboard.${feature}.body`), cx, py + 86, cw, 16.5, 23, PALETTE.inkSoft, 'left', 700, 3);

  // Pill CTA Row (exact `p19_03` order: green primary left, cream skip right!)
  const fy = py + ph - 58;
  const isMenuHub = feature === 'armory' || feature === 'market' || feature === 'village' || feature === 'kitchen' || feature === 'medallions';
  if (isMenuHub) {
    drawPillButton(c, hits, `onboard:go:${feature}`, cx, fy, 198, 44, t('p19.guideGo'), 'green', { fontSize: 17.5 });
    drawPillButton(c, hits, `onboard:dismiss:${feature}`, cx + 212, fy, 134, 44, t('p19.guideSkip'), 'cream', { fontSize: 16 });
  } else {
    drawPillButton(c, hits, `onboard:dismiss:${feature}`, cx, fy, 224, 44, t('p19.guideGotIt'), 'green', { fontSize: 17.5 });
  }
}

/**
 * Strict 1:1 Web In-Battle Coaching Card (`OnboardingGuide.ts` + `p19_06_battle_prop_lesson.png`):
 * - Anchored right beside the relevant HUD control (left-prop for `prop_battle`, top-right for `speed2x`/`speed3x`, center for `endless_battle`)
 * - Warm cream storybook card with peeking mascot, green `新功能解锁` tag, crisp body, and green `太棒了，知道了！` pill button!
 */
export function drawBattleLessonModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  lesson: BattleLessonKey,
): void {
  const pw = 500, ph = 250;
  let px = (1280 - pw) / 2;
  let py = (720 - ph) / 2;
  if (lesson === 'prop_battle') {
    px = 148;
    py = 224;
  } else if (lesson === 'speed2x' || lesson === 'speed3x') {
    px = 680;
    py = 76;
  }

  round(c, px, py + 8, pw, ph, 22, 'rgba(28,14,4,0.34)', 'transparent', 0);
  drawIvorySlab(c, px, py, pw, ph, 22, '#fffdf7', '#f7ead0', '#70461e', 3.4);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  const mascot = lesson === 'endless_battle' ? 'ui_endless_emblem' : lesson === 'prop_battle' ? 'ui_market_peek_raccoon' : 'ui_tutorial_capy';
  drawSpriteContain(c, mascot, px + 22, py + 18, 68, 68);

  // Green tag + Title
  round(c, px + 102, py + 20, 104, 26, 13, '#79bd3c', '#3d6e19', 1.6);
  drawText(c, t('p19.guideTag'), px + 154, py + 34, 13.5, '#fffdf5', 'center', 900);
  drawText(c, t(`p19.onboard.${lesson}.title`), px + 102, py + 66, 22, PALETTE.ink, 'left', 900);

  // Body
  drawWrappedText(c, t(`p19.onboard.${lesson}.body`), px + 24, py + 98, pw - 48, 16.5, 23.5, PALETTE.inkSoft, 'left', 700, 4);

  // Bottom green Got-It pill button
  drawPillButton(c, hits, `lesson:ok:${lesson}`, px + pw / 2 - 110, py + ph - 56, 220, 44, t('p19.guideGotIt'), 'green', { fontSize: 17.5 });
}
