import type { FeatureId } from '../../core/FeatureUnlocks';
import { getLanguage, t } from '../../i18n/i18n';
import { round } from '../../render/StickerArt';
import {
  BTN_STYLES,
  PALETTE,
  drawButton,
  drawSpriteContain,
  drawText,
  drawWoodPanel,
  drawWrappedText,
  type UiHitManager,
} from './CanvasUI';

const FEATURE_ICON: Record<FeatureId, string> = {
  armory: 'ui_weapon_fragment',
  speed2x: 'ui_horn_continue',
  market: 'ui_shop_bag',
  endless: 'ui_endless_crest',
  village: 'ui_village_gate',
  kitchen: 'ui_kitchen_pot',
  medallions: 'ui_endless_crest',
  speed3x: 'ui_horn_continue',
};

const FEATURE_GIFT_SUMMARY: Record<FeatureId, { zh: string; en: string }> = {
  armory: { zh: '🎁 赠礼：塑料苍蝇拍碎片 ×2（可直接佩戴！）', en: '🎁 Starter Gift: Fly Swatter Fragments ×2 (Ready to equip!)' },
  speed2x: { zh: '⚡ 战斗右上角可随时切换 1× / 2× 加速！', en: '⚡ Toggle 1× / 2× speed anytime at top-right!' },
  market: { zh: '🎁 赠礼：强力粘鼠板 ×1 + 免费扭蛋券 ×1', en: '🎁 Starter Gift: Super Glue Trap ×1 + Free Gacha Ticket ×1' },
  endless: { zh: '♾️ 守住第 10 波后即可开启无尽模式与觉醒突破！', en: '♾️ Clear Wave 10 to unlock Endless Mode & Awakening!' },
  village: { zh: '🎁 赠礼：温泉木料 ×10 + 柚子精粹 ×3（立刻开建！）', en: '🎁 Starter Gift: Onsen Wood ×10 + Yuzu Essence ×3!' },
  kitchen: { zh: '🎁 赠礼：黄金柚子 ×4（立刻熬制第一锅汤底！）', en: '🎁 Starter Gift: Golden Yuzu ×4 (Brew your first broth!)' },
  medallions: { zh: '🎁 赠礼：无尽星徽 ×10 + 金币 ×20（立刻强化！）', en: '🎁 Starter Gift: Endless Crests ×10 + 20 Coins!' },
  speed3x: { zh: '🚀 战斗右上角现支持 1× → 2× → 3× 极速切换！', en: '🚀 Top-right speed now cycles 1× → 2× → 3×!' },
};

/** P19 New-Feature Unlock Celebration & Starter-Gift Modal rendered purely on Canvas. */
export function drawOnboardingUnlockModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  feature: FeatureId,
): void {
  const zh = getLanguage() === 'zh-CN';
  const pw = 580, ph = 396;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;

  drawWoodPanel(c, px, py, pw, ph, 26, '#fff8e8', '#6b421c');
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Top "NEW FEATURE" ribbon
  round(c, px + pw / 2 - 86, py - 18, 172, 34, 17, '#e2882b', '#fff7e6', 2.5);
  drawText(c, `✨ ${t('p19.guideTag')}`, px + pw / 2, py, 14, '#fffdf5', 'center', 900);

  // Mascot + Feature icon badge
  drawSpriteContain(c, 'ui_tutorial_capy', px + 34, py + 32, 86, 86);
  round(c, px + pw - 116, py + 34, 78, 78, 20, '#f4e1b8', PALETTE.woodMid, 2);
  drawSpriteContain(c, FEATURE_ICON[feature], px + pw - 108, py + 42, 62, 62);

  drawText(c, t(`p19.onboard.${feature}.title`), px + pw / 2, py + 74, 24, '#7d3a0d', 'center', 900);

  // Description card
  round(c, px + 34, py + 132, pw - 68, 114, 16, '#f6e7c7', PALETTE.woodLight, 1.8);
  drawWrappedText(c, t(`p19.onboard.${feature}.body`), px + 52, py + 148, pw - 104, 15, 22, PALETTE.ink, 'left', 700, 4);

  // Starter gift highlight pill
  const gift = FEATURE_GIFT_SUMMARY[feature];
  round(c, px + 34, py + 258, pw - 68, 42, 14, '#dff5d8', '#3c8532', 1.8);
  drawText(c, zh ? gift.zh : gift.en, px + pw / 2, py + 280, 14, '#24591d', 'center', 900);

  // Buttons
  const fy = py + ph - 76;
  const isMenuHub = feature === 'armory' || feature === 'market' || feature === 'village' || feature === 'kitchen' || feature === 'medallions';
  if (isMenuHub) {
    drawButton(c, hits, `onboard:dismiss:${feature}`, px + 36, fy, 176, 52, t('p19.guideSkip'), {
      ...BTN_STYLES.cream,
      radius: 15,
      fontSize: 15,
    });
    drawButton(c, hits, `onboard:go:${feature}`, px + 228, fy, pw - 264, 52, t('p19.guideGo'), {
      ...BTN_STYLES.green,
      radius: 15,
      fontSize: 18,
    });
  } else {
    drawButton(c, hits, `onboard:dismiss:${feature}`, px + pw / 2 - 140, fy, 280, 52, t('p19.guideGotIt'), {
      ...BTN_STYLES.gold,
      radius: 15,
      fontSize: 18,
    });
  }
}

/** One-time compact battle lesson modal for Active Props (after Market) or Endless Wave 11 Awakening. */
export function drawBattleLessonModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  lesson: 'prop_battle' | 'endless_battle',
): void {
  const pw = 560, ph = 330;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;

  drawWoodPanel(c, px, py, pw, ph, 24, '#fff8e8', '#6b421c');
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  drawSpriteContain(c, lesson === 'endless_battle' ? 'ui_endless_crest' : 'ui_tutorial_capy', px + 30, py + 24, 72, 72);
  drawText(c, t(`p19.onboard.${lesson}.title`), px + 114, py + 58, 22, '#7d3a0d', 'left', 900);

  round(c, px + 30, py + 108, pw - 60, 128, 16, '#f6e7c7', PALETTE.woodLight, 1.8);
  drawWrappedText(c, t(`p19.onboard.${lesson}.body`), px + 46, py + 122, pw - 92, 14.5, 22, PALETTE.ink, 'left', 700, 5);

  drawButton(c, hits, `lesson:ok:${lesson}`, px + pw / 2 - 130, py + ph - 74, 260, 50, t('p19.guideGotIt'), {
    ...BTN_STYLES.teal,
    radius: 15,
    fontSize: 17,
  });
}
