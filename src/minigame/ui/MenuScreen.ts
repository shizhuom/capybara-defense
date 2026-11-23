import { MAP_IDS } from '../../config/maps';
import { getRank } from '../../config/ranks';
import {
  isFeatureUnlocked,
  isRankHubUnlocked,
  nextLockedFeature,
  type FeatureId,
} from '../../core/FeatureUnlocks';
import { getMapUnlockRequirement, getUnlockedMaps } from '../../core/PlayerProgression';
import type { MapId, Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import { assets } from '../../render/AssetRegistry';
import { INK, round } from '../../render/StickerArt';
import {
  BTN_STYLES,
  PALETTE,
  drawButton,
  drawSpriteContain,
  drawText,
  type UiHitManager,
} from './CanvasUI';

export interface MenuRenderContext {
  profile: Profile;
  elapsed: number;
  muted: boolean;
  /** Top-right safe reserve (in stage px) so buttons never sit underneath WeChat's floating capsule. */
  capsuleRightMargin: number;
}

interface DockItem {
  id: string;
  icon: string;
  label: string;
  feature?: FeatureId;
  locked?: boolean;
  lockTag?: string;
  badge?: string;
}

/**
 * Full Courtyard Menu rendered directly on Canvas over the live animated garden preview.
 * Follows P19 progressive visibility: Fresh Start stays ultra clean; Match 1+ opens map selector & feature dock.
 */
export function drawMenuScreen(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  ctx: MenuRenderContext,
): void {
  const { profile, elapsed, muted, capsuleRightMargin } = ctx;
  const lang = getLanguage();
  const isFreshStart = (profile.matches ?? 0) === 0 && (profile.stars ?? 0) === 0;
  const rank = getRank(profile.stars);

  // Subtle warm top vignette so HUD pills stay super legible over bright foliage
  const topGrad = c.createLinearGradient(0, 0, 0, 110);
  topGrad.addColorStop(0, 'rgba(38,24,12,0.42)');
  topGrad.addColorStop(1, 'rgba(38,24,12,0)');
  c.fillStyle = topGrad;
  c.fillRect(0, 0, 1280, 110);

  // ── 1. TOP-LEFT KEEPER PASSPORT / RANK & COINS PILL ───────────────────────
  if (isRankHubUnlocked(profile)) {
    const pillX = 20, pillY = 16, pillW = 356, pillH = 56;
    round(c, pillX, pillY + 3, pillW, pillH, 28, 'rgba(54,34,16,0.34)', 'transparent', 0);
    round(c, pillX, pillY, pillW, pillH, 28, 'rgba(255,246,225,0.94)', PALETTE.woodDark, 2.5);
    // Avatar circle
    round(c, pillX + 6, pillY + 6, 44, 44, 22, '#f2d9a2', PALETTE.woodDark, 2);
    if (!drawSpriteContain(c, `avatar_${profile.avatarId}`, pillX + 8, pillY + 8, 40, 40)) {
      drawSpriteContain(c, 'avatar_capybara', pillX + 8, pillY + 8, 40, 40);
    }
    drawText(c, t(`rank.${rank.index}`), pillX + 62, pillY + 20, 16, PALETTE.ink, 'left', 900);
    const sub = `★ ${profile.stars}   🪙 ${profile.coins}${profile.winStreak >= 2 ? `   🔥${profile.winStreak}` : ''}`;
    drawText(c, sub, pillX + 62, pillY + 41, 14, PALETTE.inkSoft, 'left', 800);
    hits.add({ id: 'menu:profile', x: pillX, y: pillY, w: pillW, h: pillH });
  } else {
    // Minimal cozy badge on Match 0
    round(c, 20, 16, 204, 44, 22, 'rgba(255,246,225,0.9)', PALETTE.woodDark, 2);
    drawText(c, `🍊 ${t('menu.new')}`, 122, 39, 15, PALETTE.ink, 'center', 800);
  }

  // ── 2. TOP-RIGHT UTILITY BAR (respects WeChat capsule margin!) ────────────
  const rightEdge = 1280 - Math.max(20, capsuleRightMargin);
  const langW = 86;
  const setW = 50;
  const muteW = 50;
  const btnH = 44;
  const btnY = 16;

  drawButton(c, hits, 'menu:lang', rightEdge - langW, btnY, langW, btnH, lang === 'zh-CN' ? 'EN' : '中文', {
    ...BTN_STYLES.cream,
    radius: 14,
    fontSize: 16,
  });
  drawButton(c, hits, 'menu:settings', rightEdge - langW - 10 - setW, btnY, setW, btnH, '⚙', {
    ...BTN_STYLES.cream,
    radius: 14,
    fontSize: 21,
  });
  drawButton(c, hits, 'menu:mute', rightEdge - langW - 20 - setW - muteW, btnY, muteW, btnH, muted ? '🔇' : '🔊', {
    ...BTN_STYLES.cream,
    radius: 14,
    fontSize: 19,
  });

  // ── 3. TITLE LOGO (CENTER TOP) ────────────────────────────────────────────
  const logoId = lang === 'zh-CN' ? 'title_logo_zh' : 'title_logo_en';
  const logo = assets.get(logoId);
  const logoY = isFreshStart ? 78 : 24;
  const bob = Math.sin(elapsed * 2.1) * 4;
  if (logo) {
    const iw = logo.naturalWidth || logo.width || 960;
    const ih = logo.naturalHeight || logo.height || 320;
    const w = isFreshStart ? 590 : 490;
    const h = w * (ih / iw);
    c.drawImage(logo, (1280 - w) / 2, logoY + bob, w, h);
  } else {
    drawText(c, t('app.title'), 640, logoY + 84 + bob, 56, '#fff7dc', 'center', 900, INK, 8);
  }

  // Primary Start Button (sits cleanly below the soaking capybara)
  const startW = isFreshStart ? 350 : 288;
  const startH = isFreshStart ? 140 : 108;
  const startX = (1280 - startW) / 2;
  const startY = isFreshStart ? 470 : 430;
  const pressedStart = hits.isPressed('menu:start');
  const pulse = pressedStart ? 0.96 : 1 + Math.sin(elapsed * 2.6) * 0.02;

  hits.add({ id: 'menu:start', x: startX, y: startY, w: startW, h: startH });
  const startArt = assets.get(lang === 'zh-CN' ? 'ui_btn_start_zh' : 'ui_btn_start_en');
  c.save();
  c.translate(startX + startW / 2, startY + startH / 2 + (pressedStart ? 3 : 0));
  c.scale(pulse, pulse);
  if (startArt) {
    c.drawImage(startArt, -startW / 2, -startH / 2, startW, startH);
  } else {
    round(c, -150, -46, 300, 92, 28, '#f4c855', PALETTE.woodDark, 4);
    drawText(c, t('menu.start'), 0, 2, 30, PALETTE.ink, 'center', 900);
  }
  c.restore();

  // Map Selector Strip (compact single-row bar below Start, leaving capybara 100% visible)
  const unlockedMaps = getUnlockedMaps(profile);
  if (!isFreshStart) {
    drawMapSelector(c, hits, profile, unlockedMaps, 546);
  }

  // ── 6. BOTTOM COURTYARD FEATURE DOCK (P19 Progressive Unlocks) ────────────
  if (!isFreshStart) {
    drawCourtyardDock(c, hits, profile, 608);
  } else {
    // On Fresh Start: subtle cozy tagline pill
    round(c, (1280 - 410) / 2, 636, 410, 38, 19, 'rgba(56,36,18,0.74)', 'rgba(244,210,136,0.7)', 1.5);
    drawText(c, t('app.subtitle'), 640, 656, 15, '#fff6df', 'center', 700);
  }
}

function drawMapSelector(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  unlockedMaps: readonly MapId[],
  y: number,
): void {
  const options: Array<{ id: 'auto' | MapId; label: string; locked: boolean; reqStars: number }> = [
    { id: 'auto', label: getLanguage() === 'zh-CN' ? '🎲 随机地图' : '🎲 Random', locked: false, reqStars: 0 },
    ...MAP_IDS.map(id => {
      const unlocked = unlockedMaps.includes(id);
      const req = getMapUnlockRequirement(id);
      return { id, label: t(`map.${id}`), locked: !unlocked, reqStars: req.minStars };
    }),
  ];

  const cardW = 152;
  const gap = 10;
  const totalW = options.length * cardW + (options.length - 1) * gap;
  const startX = (1280 - totalW) / 2;
  const h = 44;

  // Backing sleek wooden pill rail
  round(c, startX - 12, y - 6, totalW + 24, h + 12, 18, 'rgba(66,42,20,0.72)', 'rgba(245,216,154,0.62)', 1.8);

  options.forEach((opt, idx) => {
    const x = startX + idx * (cardW + gap);
    const selected = profile.selectedMap === opt.id;
    const pressed = hits.isPressed(`menu:map:${opt.id}`);
    const dy = pressed ? 2 : 0;

    hits.add({ id: `menu:map:${opt.id}`, x, y, w: cardW, h, data: opt });

    if (opt.locked) {
      round(c, x, y + dy, cardW, h, 12, 'rgba(72,58,44,0.88)', 'rgba(182,160,132,0.68)', 1.8);
      drawText(c, `🔒${opt.reqStars}★ ${opt.label}`, x + cardW / 2, y + dy + h / 2 + 1, 12.5, '#dfd0b8', 'center', 800);
    } else {
      const fill = selected ? '#f9d771' : '#fff4dc';
      const stroke = selected ? '#8f4c12' : '#7b5835';
      if (!pressed) round(c, x, y + 3, cardW, h, 12, selected ? '#b8781d' : '#b7976c', stroke, 1.5);
      round(c, x, y + dy, cardW, h, 12, fill, stroke, selected ? 2.6 : 1.8);
      drawText(c, `${selected ? '✓ ' : ''}${opt.label}`, x + cardW / 2, y + dy + h / 2 + 1, 13.5, PALETTE.ink, 'center', 900);
    }
  });
}

function drawCourtyardDock(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  y: number,
): void {
  const lang = getLanguage();
  const items: DockItem[] = [
    { id: 'menu:recipes', icon: 'ui_compendium_book', label: lang === 'zh-CN' ? '图鉴配方' : 'Guide' },
  ];

  const featureDefs: Array<{ id: FeatureId; icon: string; zh: string; en: string; badge?: string }> = [
    { id: 'armory', icon: 'ui_weapon_fragment', zh: '神兵坊', en: 'Armory' },
    { id: 'market', icon: 'ui_shop_bag', zh: '浣熊黑市', en: 'Market', badge: profile.freeLotteryTickets > 0 ? `🎟️${profile.freeLotteryTickets}` : undefined },
    { id: 'village', icon: 'ui_village_gate', zh: '温泉山庄', en: 'Village' },
    { id: 'kitchen', icon: 'ui_kitchen_pot', zh: '料理屋', en: 'Kitchen' },
    { id: 'medallions', icon: 'ui_endless_crest', zh: '无尽勋章', en: 'Medals' },
  ];

  for (const def of featureDefs) {
    if (isFeatureUnlocked(profile, def.id)) {
      items.push({
        id: `menu:hub:${def.id}`,
        icon: def.icon,
        label: lang === 'zh-CN' ? def.zh : def.en,
        feature: def.id,
        badge: def.badge,
      });
    }
  }

  if (isRankHubUnlocked(profile)) {
    items.push({ id: 'menu:hub:leaderboard', icon: 'ui_trophy_rank', label: lang === 'zh-CN' ? '风云榜' : 'Ranks' });
  }

  // Option-A single next locked dock preview (P19 design)
  const nextDock = nextLockedFeature(profile, true);
  if (nextDock) {
    const def = featureDefs.find(d => d.id === nextDock.id);
    if (def) {
      items.push({
        id: `menu:locked:${nextDock.id}`,
        icon: def.icon,
        label: lang === 'zh-CN' ? def.zh : def.en,
        feature: nextDock.id,
        locked: true,
        lockTag: nextDock.requiresMatchOnly ? t('p19.lockMatch') : t('p19.lockStars', { stars: nextDock.targetStars }),
      });
    }
  }

  const itemW = Math.min(132, Math.floor(1140 / Math.max(items.length, 1)) - 10);
  const gap = 12;
  const h = 88;
  const totalW = items.length * itemW + (items.length - 1) * gap;
  const startX = (1280 - totalW) / 2;

  // Cozy wooden shelf strip
  round(c, startX - 18, y - 6, totalW + 36, h + 12, 24, 'rgba(66,42,20,0.72)', 'rgba(244,212,146,0.68)', 2);

  items.forEach((item, i) => {
    const x = startX + i * (itemW + gap);
    const pressed = hits.isPressed(item.id);
    const dy = pressed ? 3 : 0;
    hits.add({ id: item.id, x, y, w: itemW, h, data: item });

    if (item.locked) {
      round(c, x, y + dy, itemW, h, 16, 'rgba(84,68,52,0.88)', 'rgba(196,174,142,0.68)', 2);
      drawSpriteContain(c, item.icon, x + (itemW - 40) / 2, y + dy + 8, 40, 40, 0.45);
      drawText(c, `🔒 ${item.lockTag ?? ''}`, x + itemW / 2, y + dy + 32, 13, '#fff0cc', 'center', 900, INK, 3);
      drawText(c, item.label, x + itemW / 2, y + dy + 68, 13, '#d7c6ab', 'center', 800);
    } else {
      if (!pressed) round(c, x, y + 3, itemW, h, 16, '#b7976b', PALETTE.woodDark, 1.5);
      round(c, x, y + dy, itemW, h, 16, '#fff5dd', PALETTE.woodDark, 2.2);
      drawSpriteContain(c, item.icon, x + (itemW - 44) / 2, y + dy + 8, 44, 44);
      drawText(c, item.label, x + itemW / 2, y + dy + 68, 14, PALETTE.ink, 'center', 900);
      if (item.badge) {
        round(c, x + itemW - 46, y + dy - 6, 50, 22, 11, '#d95342', '#fff7e8', 2);
        drawText(c, item.badge, x + itemW - 21, y + dy + 6, 12, '#fffdf5', 'center', 900);
      }
    }
  });
}
