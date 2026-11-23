import type { FeatureId } from '../../core/FeatureUnlocks';
import { getLanguage, t } from '../../i18n/i18n';
import { round } from '../../render/StickerArt';
import {
  BTN_STYLES,
  PALETTE,
  drawButton,
  drawHinokiBoard,
  drawIvorySlab,
  drawMatchaSignboard,
  drawSpriteContain,
  drawText,
  drawWrappedText,
  type UiHitManager,
} from './CanvasUI';

const FEATURE_ICON: Record<FeatureId, string> = {
  armory: 'ui_weapon_fragment',
  speed2x: 'ui_horn_continue',
  market: 'ui_shop_bag',
  endless: 'ui_endless_emblem',
  village: 'ui_village_gate',
  kitchen: 'ui_kitchen_pot',
  medallions: 'ui_endless_crest',
  speed3x: 'ui_horn_continue',
};

const FEATURE_PEEK: Record<FeatureId, string> = {
  armory: 'ui_armory_peek_capy',
  speed2x: 'ui_tutorial_capy',
  market: 'ui_market_peek_raccoon',
  endless: 'ui_medallion_peek_capy',
  village: 'ui_village_peek_capy',
  kitchen: 'ui_kitchen_peek_capy',
  medallions: 'ui_medallion_peek_capy',
  speed3x: 'ui_tutorial_capy',
};

const FEATURE_GIFT_SUMMARY: Record<FeatureId, { zh: string; en: string }> = {
  armory: { zh: '赠礼：塑料苍蝇拍碎片 ×2（可直接佩戴！）', en: 'Starter Gift: Fly Swatter Fragments ×2 (Ready to equip!)' },
  speed2x: { zh: '战斗右上角可随时切换 1× / 2× 加速！', en: 'Toggle 1× / 2× speed anytime at top-right!' },
  market: { zh: '赠礼：强力粘鼠板 ×1 + 免费扭蛋券 ×1', en: 'Starter Gift: Super Glue Trap ×1 + Free Gacha Ticket ×1' },
  endless: { zh: '守住第 10 波后即可开启无尽模式与觉醒突破！', en: 'Clear Wave 10 to unlock Endless Mode & Awakening!' },
  village: { zh: '赠礼：温泉木料 ×10 + 柚子精粹 ×3（立刻开建！）', en: 'Starter Gift: Onsen Wood ×10 + Yuzu Essence ×3!' },
  kitchen: { zh: '赠礼：黄金柚子 ×4（立刻熬制第一锅汤底！）', en: 'Starter Gift: Golden Yuzu ×4 (Brew your first broth!)' },
  medallions: { zh: '赠礼：无尽星徽 ×10 + 金币 ×20（立刻强化！）', en: 'Starter Gift: Endless Crests ×10 + 20 Coins!' },
  speed3x: { zh: '战斗右上角现支持 1× → 2× → 3× 极速切换！', en: 'Top-right speed now cycles 1× → 2× → 3×!' },
};

/** 1:1 P18/P19 New-Feature Unlock Celebration & Starter-Gift Modal with crisp mobile-scaled fonts. */
export function drawOnboardingUnlockModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  feature: FeatureId,
): void {
  const zh = getLanguage() === 'zh-CN';
  const pw = 688, ph = 466;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2 + 16;

  // Peeking mascot perched atop carved hinoki board
  if (!drawSpriteContain(c, FEATURE_PEEK[feature], px + 26, py - 62, 108, 108)) {
    drawSpriteContain(c, 'ui_tutorial_capy', px + 26, py - 62, 108, 108);
  }
  drawHinokiBoard(c, px, py, pw, ph, 26);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Top Matcha-Bamboo Signboard
  drawMatchaSignboard(c, 640, py - 32, t('p19.guideTag'), undefined, 250);

  // Inner sculpted warm parchment body
  const ix = px + 24, iy = py + 44, iw = pw - 48, ih = ph - 134;
  drawIvorySlab(c, ix, iy, iw, ih, 18, '#fffdf7', '#f5e4c2', '#6f4826', 2.4);

  // Feature icon medallion at top-right of inner slab
  round(c, ix + iw - 96, iy + 14, 78, 78, 22, '#fff5dc', '#7d5027', 2.4);
  if (!drawSpriteContain(c, FEATURE_ICON[feature], ix + iw - 88, iy + 22, 62, 62)) {
    drawSpriteContain(c, 'ui_weapon_fragment', ix + iw - 88, iy + 22, 62, 62);
  }

  // Big bold title + body
  drawText(c, t(`p19.onboard.${feature}.title`), ix + 24, iy + 48, 26, '#7a370a', 'left', 900);
  drawWrappedText(
    c,
    t(`p19.onboard.${feature}.body`),
    ix + 24,
    iy + 102,
    iw - 48,
    18.5,
    27,
    PALETTE.ink,
    'left',
    700,
    4,
  );

  // Starter gift highlight banner
  const gift = FEATURE_GIFT_SUMMARY[feature];
  const gy = iy + ih - 62;
  round(c, ix + 18, gy, iw - 36, 48, 15, '#dff6d6', '#3d8633', 2.2);
  drawSpriteContain(c, FEATURE_ICON[feature], ix + 28, gy + 8, 32, 32);
  drawText(c, zh ? gift.zh : gift.en, ix + 68, gy + 25, 17, '#205519', 'left', 900);

  // Action buttons
  const fy = py + ph - 74;
  const isMenuHub = feature === 'armory' || feature === 'market' || feature === 'village' || feature === 'kitchen' || feature === 'medallions';
  if (isMenuHub) {
    drawButton(c, hits, `onboard:dismiss:${feature}`, px + 28, fy, 206, 56, t('p19.guideSkip'), {
      ...BTN_STYLES.cream,
      radius: 16,
      fontSize: 18,
    });
    drawButton(c, hits, `onboard:go:${feature}`, px + 248, fy, pw - 276, 56, t('p19.guideGo'), {
      ...BTN_STYLES.green,
      radius: 16,
      fontSize: 21,
    });
  } else {
    drawButton(c, hits, `onboard:dismiss:${feature}`, px + pw / 2 - 156, fy, 312, 56, t('p19.guideGotIt'), {
      ...BTN_STYLES.gold,
      radius: 16,
      fontSize: 21,
    });
  }
}

/** One-time compact P18 battle lesson modal for Active Props or Endless Wave 11 Awakening. */
export function drawBattleLessonModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  lesson: 'prop_battle' | 'endless_battle',
): void {
  const pw = 664, ph = 398;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2 + 12;

  drawHinokiBoard(c, px, py, pw, ph, 26);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });
  drawMatchaSignboard(c, 640, py - 32, t('p19.guideTag'), undefined, 240);

  const ix = px + 24, iy = py + 44, iw = pw - 48, ih = ph - 134;
  drawIvorySlab(c, ix, iy, iw, ih, 18, '#fffdf7', '#f5e4c2', '#6f4826', 2.4);

  drawSpriteContain(c, lesson === 'endless_battle' ? 'ui_endless_emblem' : 'ui_tutorial_capy', ix + 20, iy + 18, 76, 76);
  drawText(c, t(`p19.onboard.${lesson}.title`), ix + 110, iy + 54, 24, '#7a370a', 'left', 900);
  drawWrappedText(
    c,
    t(`p19.onboard.${lesson}.body`),
    ix + 24,
    iy + 106,
    iw - 48,
    18.5,
    27,
    PALETTE.ink,
    'left',
    700,
    5,
  );

  drawButton(c, hits, `lesson:ok:${lesson}`, px + pw / 2 - 150, py + ph - 74, 300, 56, t('p19.guideGotIt'), {
    ...BTN_STYLES.teal,
    radius: 16,
    fontSize: 20,
  });
}
