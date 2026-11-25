import { BROTHS, BROTH_IDS, isBrothId } from '../../config/kitchen';
import { MAP_IDS } from '../../config/maps';
import { getRank } from '../../config/ranks';
import { VILLAGE_MAX_STARS } from '../../config/village';
import {
  isFeatureUnlocked,
  isRankHubUnlocked,
  nextLockedFeature,
  type FeatureId,
} from '../../core/FeatureUnlocks';
import { canBrewOrUpgradeAnyBroth, getBrothLevel } from '../../core/KitchenProgression';
import { upgradeableMedallions } from '../../core/MedallionProgression';
import { getMapUnlockRequirement, getUnlockedMaps } from '../../core/PlayerProgression';
import { villageBadge, villageStars } from '../../core/VillageProgression';
import {
  STAMINA_COST_PER_BATTLE,
  getStaminaStatus,
} from '../../core/Stamina';
import { formatCompactNumber } from '../../core/formatNumber';
import type { MapId, Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import type { ViewportMetrics } from '../../platform/types';
import { assets } from '../../render/AssetRegistry';
import { INK, round } from '../../render/StickerArt';
import {
  BTN_STYLES,
  PALETTE,
  UI_FONT,
  drawButton,
  drawIconLabel,
  drawSpriteContain,
  drawText,
  type UiHitManager,
} from './CanvasUI';

export interface MenuRenderContext {
  profile: Profile;
  elapsed: number;
  muted: boolean;
  topRightEdge: number;
  viewport: ViewportMetrics;
  highlightFeature?: FeatureId | null;
}

interface MedallionDockItem {
  id: string;
  icon: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  badgeIcon?: string;
  locked?: boolean;
  lockTag?: string;
  highlight?: boolean;
}

/**
 * 1:1 Web Storybook Courtyard Start Screen (`CourtyardView.ts` + `p18-garden-wood.css`),
 * tuned with larger, ultra-legible mobile typography and unobstructed soaking capybara panorama.
 */
export function drawMenuScreen(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  ctx: MenuRenderContext,
): void {
  const { profile, elapsed, muted, topRightEdge, viewport: vp, highlightFeature } = ctx;
  const lang = getLanguage();
  const zh = lang === 'zh-CN';
  const hasRank = isRankHubUnlocked(profile);
  const rank = getRank(profile.stars);

  const widePhone = vp.visible.right > 1320;
  // Adaptive horizontal anchors: wide phones expand cleanly into safe bleed; 16:9 stays strictly inside 0..1280.
  const leftAnchor = vp.visible.left < -10
    ? Math.round(Math.min(14, Math.max(vp.safeStage.left + 12, Math.max(-42, vp.visible.left + 26))))
    : Math.round(Math.min(60, Math.max(16, vp.safeStage.left + 12)));
  const bottomRightAnchor = vp.visible.right > 1290
    ? Math.round(Math.max(1260, Math.min(vp.safeStage.right - 12, Math.min(1322, vp.visible.right - 26))))
    : Math.round(Math.max(1196, Math.min(1264, vp.safeStage.right - 12)));

  // Subtle top vignette spans full phone/tablet width (zero edge cutoff!)
  const topGrad = c.createLinearGradient(0, vp.visible.top, 0, 120);
  topGrad.addColorStop(0, 'rgba(36,22,10,0.38)');
  topGrad.addColorStop(1, 'rgba(36,22,10,0)');
  c.fillStyle = topGrad;
  c.fillRect(vp.visible.left - 2, vp.visible.top - 2, vp.visible.width + 4, 122 - vp.visible.top);

  // ── 1. TOP-LEFT ENLARGED KEEPER PASSPORT PILL ────────────────────────────
  if (hasRank) {
    const px = leftAnchor, py = 12, pw = 344, ph = 92;
    round(c, px, py + 5, pw, ph, 46, 'rgba(46,26,10,0.36)', 'transparent', 0);
    round(c, px, py, pw, ph, 46, 'rgba(255,248,232,0.96)', '#5c3b1e', 3.4);

    // Circular avatar seal
    round(c, px + 8, py + 8, 76, 76, 38, '#f6e0b3', '#5c3b1e', 3);
    if (!drawSpriteContain(c, `avatar_${profile.avatarId}`, px + 12, py + 12, 68, 68)) {
      drawSpriteContain(c, 'avatar_capybara', px + 12, py + 12, 68, 68);
    }

    drawText(c, t(`rank.${rank.index}`), px + 94, py + 31, 27, PALETTE.ink, 'left', 900);
    const coinsW = drawIconLabel(c, 'ui_coin_gold', String(profile.coins), px + 92, py + 65, 28, 25, PALETTE.ink);
    drawIconLabel(c, 'ui_star_rank', String(profile.stars), px + 92 + coinsW + 18, py + 65, 28, 25, PALETTE.ink);
    hits.add({ id: 'menu:profile', x: px, y: py, w: pw, h: ph });
  }

  // ── 2. RIGHT-SIDE SYSTEM CONTROLS (2×2 GIANT BLOCK STRICTLY BELOW WECHAT [🎮][···|◉]!) ─
  // Placing controls below y=104 clears BOTH WeChat floating buttons (even on Dynamic Island iPhones!) AND the giant Title Logo!
  void topRightEdge;
  const ctrlRight = bottomRightAnchor;
  const ctrlY = 104;
  const rowGap = 12;
  const colGap = 12;
  const sqW = 92;
  const wideW = 112;
  const btnH = 66;
  const rightColX = ctrlRight - sqW;
  const leftColX = rightColX - colGap - wideW;

  // Row 1: [中 | EN] + [⚙]
  round(c, leftColX, ctrlY + 4, wideW, btnH, 18, '#b89464', '#5c3b1e', 2.4);
  round(c, leftColX, ctrlY, wideW, btnH, 18, '#fff8e8', '#5c3b1e', 3.2);
  const activeHalfX = zh ? leftColX + 5 : leftColX + wideW / 2;
  round(c, activeHalfX, ctrlY + 5, wideW / 2 - 5, btnH - 10, 13, '#6a4526', 'transparent', 0);
  drawText(c, '中', leftColX + wideW * 0.25 + 1, ctrlY + btnH / 2 + 1, 25, zh ? '#fffdf6' : '#5a3a1e', 'center', 900);
  drawText(c, 'EN', leftColX + wideW * 0.75 - 1, ctrlY + btnH / 2 + 1, 23, zh ? '#5a3a1e' : '#fffdf6', 'center', 900);
  hits.add({ id: 'menu:lang', x: leftColX, y: ctrlY, w: wideW, h: btnH });

  drawButton(c, hits, 'menu:settings', rightColX, ctrlY, sqW, btnH, '⚙', {
    ...BTN_STYLES.cream,
    radius: 18,
    fontSize: 34,
  });

  // Row 2: [Mute] + [Share]
  const row2Y = ctrlY + btnH + rowGap;
  drawButton(c, hits, 'menu:mute', leftColX, row2Y, wideW, btnH, '', { ...BTN_STYLES.cream, radius: 18 });
  drawVectorSpeaker(c, leftColX + wideW / 2, row2Y + btnH / 2 + (hits.isPressed('menu:mute') ? 3 : 0), muted);

  drawButton(c, hits, 'menu:share', rightColX, row2Y, sqW, btnH, '', { ...BTN_STYLES.cream, radius: 18 });
  drawVectorShare(c, rightColX + sqW / 2, row2Y + btnH / 2 + (hits.isPressed('menu:share') ? 3 : 0));

  // ── 3. GIANT POSTER-SIZED TITLE LOGO (+38% LARGER FOR PHONE CLARITY!) ────
  const logoId = zh ? 'title_logo_zh' : 'title_logo_en';
  const logo = assets.get(logoId);
  const bob = Math.sin(elapsed * 2.1) * 4;
  if (logo) {
    const iw = logo.naturalWidth || logo.width || 960;
    const ih = logo.naturalHeight || logo.height || 320;
    const w = widePhone ? 840 : 728;
    const h = w * (ih / iw);
    const logoShift = widePhone ? 30 : 12;
    c.drawImage(logo, (1280 - w) / 2 + logoShift, -12 + bob, w, h);
  } else {
    drawText(c, t('app.title'), 640, 128 + bob, 76, '#fff7dc', 'center', 900, INK, 10);
  }

  // ── 3B. CLEAN STAMINA PILL (⚡ xx/30 + — no progress bar!) ────────────────
  const stamina = getStaminaStatus(profile, Date.now());
  drawStaminaBar(c, hits, leftAnchor, hasRank ? 112 : 16, stamina);

  // ── 4. GIANT ILLUSTRATED START BUTTON (+37% LARGER!) ─────────────────────
  const startW = 456;
  const startH = 180;
  const startX = (1280 - startW) / 2;
  const startY = hasRank ? 416 : 444;
  const pressedStart = hits.isPressed('menu:start');
  const pulse = pressedStart ? 0.96 : 1 + Math.sin(elapsed * 2.6) * 0.02;

  hits.add({ id: 'menu:start', x: startX, y: startY, w: startW, h: startH });
  const startArt = assets.get(zh ? 'ui_btn_start_zh' : 'ui_btn_start_en');
  c.save();
  c.translate(startX + startW / 2, startY + startH / 2 + (pressedStart ? 3 : 0));
  c.scale(pulse, pulse);
  if (startArt) {
    c.drawImage(startArt, -startW / 2, -startH / 2, startW, startH);
  } else {
    round(c, -210, -64, 420, 128, 34, '#f4c855', PALETTE.woodDark, 5);
    drawText(c, t('menu.start'), 0, 2, 42, PALETTE.ink, 'center', 900);
  }
  c.restore();

  // ── 5. ENLARGED BOTTOM-CENTER MAP SIGNPOST BAR ───────────────────────────
  if (hasRank) {
    drawCompactMapBar(c, hits, profile, 622, widePhone);
  }

  // ── 6. BOTTOM-LEFT & BOTTOM-RIGHT CIRCULAR MEDALLION DOCKS (matches Web!) ─
  const hasArmory = isFeatureUnlocked(profile, 'armory');
  const hasMarket = isFeatureUnlocked(profile, 'market');
  const hasVillage = isFeatureUnlocked(profile, 'village');
  const hasKitchen = isFeatureUnlocked(profile, 'kitchen');
  const hasMedallions = isFeatureUnlocked(profile, 'medallions');
  const nextDock = nextLockedFeature(profile, true);
  const lockText = nextDock
    ? (nextDock.requiresMatchOnly ? t('p19.lockMatch') : t('p19.lockStars', { stars: nextDock.targetStars }))
    : '';

  const leftDock: MedallionDockItem[] = [
    { id: 'menu:recipes', icon: 'ui_compendium_book', label: t('p3.guide') },
  ];
  if (hasArmory) {
    leftDock.push({
      id: 'menu:hub:armory',
      icon: 'weapon_m10_bamboo_staff',
      label: t('p3.armory'),
      badge: `${profile.unlockedWeapons.length}/36`,
      badgeColor: '#fff8e8',
      highlight: highlightFeature === 'armory',
    });
  } else if (nextDock?.id === 'armory') {
    leftDock.push({ id: 'menu:locked:armory', icon: 'weapon_m10_bamboo_staff', label: t('p3.armory'), locked: true, lockTag: lockText });
  }
  if (hasKitchen) {
    const brewable = canBrewOrUpgradeAnyBroth(profile).brewable.length > 0;
    const unlocked = (profile.unlockedBroths ?? []).filter(isBrothId).length;
    leftDock.push({
      id: 'menu:hub:kitchen',
      icon: 'ui_kitchen_pot',
      label: t('p14.dock'),
      badge: brewable ? t('p14.brewBadge') : `${unlocked}/${BROTH_IDS.length}`,
      badgeColor: brewable ? '#79be43' : '#fff8e8',
      highlight: highlightFeature === 'kitchen',
    });
  } else if (nextDock?.id === 'kitchen') {
    leftDock.push({ id: 'menu:locked:kitchen', icon: 'ui_kitchen_pot', label: t('p14.dock'), locked: true, lockTag: lockText });
  }

  const rightDock: MedallionDockItem[] = [];
  if (hasVillage) {
    const vb = villageBadge(profile, Date.now());
    rightDock.push({
      id: 'menu:hub:village',
      icon: 'ui_village_gate',
      label: t('p16.dock'),
      badge: vb === 'harvest' ? t('p16.harvestBadge') : vb === 'build' ? t('p16.buildBadge') : `★${villageStars(profile)}/${VILLAGE_MAX_STARS}`,
      badgeColor: vb === 'harvest' ? '#e59226' : vb === 'build' ? '#79be43' : '#fff8e8',
      highlight: highlightFeature === 'village',
    });
  } else if (nextDock?.id === 'village') {
    rightDock.push({ id: 'menu:locked:village', icon: 'ui_village_gate', label: t('p16.dock'), locked: true, lockTag: lockText });
  }
  if (hasMarket) {
    rightDock.push({
      id: 'menu:hub:market',
      icon: 'ui_shop_bag',
      label: t('p3.shop'),
      badge: profile.freeLotteryTickets > 0 ? String(profile.freeLotteryTickets) : undefined,
      badgeIcon: profile.freeLotteryTickets > 0 ? 'ui_ticket_gacha' : undefined,
      badgeColor: '#d95443',
      highlight: highlightFeature === 'market',
    });
  } else if (nextDock?.id === 'market') {
    rightDock.push({ id: 'menu:locked:market', icon: 'ui_shop_bag', label: t('p3.shop'), locked: true, lockTag: lockText });
  }
  if (hasRank) {
    rightDock.push({ id: 'menu:hub:leaderboard', icon: 'ui_trophy_rank', label: t('p3.rank') });
  }

  // Draw ENLARGED Left & Right Circular Medallions (106px on wide phones, 94px on 16:9!)
  const medSize = widePhone ? 106 : 94;
  const dockY = widePhone ? 554 : 566;
  const dockLeftX = leftAnchor + 2;
  drawMedallionRow(c, hits, leftDock, dockLeftX, dockY, false, elapsed, medSize);
  if (rightDock.length > 0) {
    drawMedallionRow(c, hits, rightDock, bottomRightAnchor, dockY, true, elapsed, medSize);
  }

  // Floating Active Broth Pill (above left dock when Kitchen unlocked & broth active)
  // Raised well clear of dock top badges (`3/36`, `领收成!`, `🔒xx星解锁` at dockY - 22)
  const floatingPillY = dockY - 124;
  if (hasKitchen && profile.activeBrothId && isBrothId(profile.activeBrothId)) {
    const lv = getBrothLevel(profile, profile.activeBrothId);
    if (lv > 0) {
      drawFloatingCornerPill(
        c,
        hits,
        'menu:hub:kitchen',
        dockLeftX,
        floatingPillY,
        profile.activeBrothId,
        `${t(`broth.${profile.activeBrothId}`)} Lv.${lv}`,
        BROTHS[profile.activeBrothId].bathColor,
      );
    }
  }

  // Floating Endless Medallion Hall Pill (above right dock when unlocked or next preview!)
  if (hasMedallions) {
    const ready = upgradeableMedallions(profile).length > 0;
    const crests = formatCompactNumber(profile.endlessCrests ?? 0);
    const waveTag = (profile.bestEndlessWave ?? 0) >= 11 ? ` · W${profile.bestEndlessWave}` : '';
    const label = `${t('p17.hallPill')}${waveTag} · ${ready ? t('p17.canUpgrade') : `×${crests}`}`;
    drawFloatingCornerPill(c, hits, 'menu:hub:medallions', bottomRightAnchor, floatingPillY, 'ui_endless_crest', label, ready ? '#f6cf59' : '#efe3fa', true);
  } else if (nextDock?.id === 'medallions') {
    drawFloatingCornerPill(c, hits, 'menu:locked:medallions', bottomRightAnchor, floatingPillY, 'ui_endless_crest', `${t('p17.hallPill')} 🔒${lockText}`, '#d8ccb8', true);
  }
}

function drawMedallionRow(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  items: readonly MedallionDockItem[],
  anchorX: number,
  topY: number,
  alignRight: boolean,
  elapsed: number,
  size = 104,
): void {
  const gap = size >= 100 ? 16 : 12;
  const totalW = items.length * size + (items.length - 1) * gap;
  const startX = alignRight ? anchorX - totalW : anchorX;

  items.forEach((item, idx) => {
    const x = startX + idx * (size + gap);
    const cx = x + size / 2;
    const cy = topY + size / 2;
    const pressed = hits.isPressed(item.id);
    const dy = pressed ? 3 : 0;

    hits.add({ id: item.id, x: x - 4, y: topY - 14, w: size + 8, h: size + 48, data: item });

    // Golden P19 onboarding spotlight ring
    if (item.highlight) {
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.2);
      c.save();
      c.beginPath();
      c.arc(cx, cy + dy, size / 2 + 8 + pulse * 5, 0, Math.PI * 2);
      c.strokeStyle = `rgba(255,212,68,${(0.65 + pulse * 0.32).toFixed(2)})`;
      c.lineWidth = 6;
      c.stroke();
      c.restore();
    }

    // Circle shadow & warm ivory medallion ring
    if (!pressed) {
      c.fillStyle = 'rgba(42,22,8,0.44)';
      c.beginPath();
      c.arc(cx, cy + 6, size / 2, 0, Math.PI * 2);
      c.fill();
    }

    const grad = c.createLinearGradient(x, topY + dy, x, topY + dy + size);
    if (item.locked) {
      grad.addColorStop(0, '#c8c3b8');
      grad.addColorStop(1, '#9b9588');
    } else {
      grad.addColorStop(0, '#fffdf6');
      grad.addColorStop(1, '#f4e1b8');
    }
    c.beginPath();
    c.arc(cx, cy + dy, size / 2, 0, Math.PI * 2);
    c.fillStyle = grad;
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = item.locked ? '#6b6254' : '#58371c';
    c.stroke();

    // Inner bright highlight rim
    c.beginPath();
    c.arc(cx, cy + dy, size / 2 - 4, 0, Math.PI * 2);
    c.lineWidth = 1.8;
    c.strokeStyle = 'rgba(255,255,255,0.68)';
    c.stroke();

    const iconS = Math.round(size * 0.72);
    drawSpriteContain(c, item.icon, cx - iconS / 2, cy + dy - iconS / 2, iconS, iconS, item.locked ? 0.45 : 1);

    // Enlarged Top badge pill (BIG `🔒xx星解锁` & BIG `36/36` / `14/14`!)
    if (item.locked && item.lockTag) {
      const lockStr = `🔒${item.lockTag}`;
      c.font = `900 22px ${UI_FONT}`;
      const bw = Math.max(136, Math.ceil(c.measureText(lockStr).width) + 26);
      const bh = 40;
      round(c, cx - bw / 2, topY + dy - 22, bw, bh, 20, '#4f341f', '#ffd978', 2.8);
      drawText(c, lockStr, cx, topY + dy - 1, 22, '#fff6d6', 'center', 900);
    } else if (item.badge) {
      const isDark = item.badgeColor && item.badgeColor !== '#fff8e8';
      c.font = `900 22px ${UI_FONT}`;
      const bw = Math.max(82, Math.ceil(c.measureText(item.badge).width) + (item.badgeIcon ? 46 : 26));
      const bh = 38;
      const bx = cx - bw / 2 + 10;
      const by = topY + dy - 20;
      round(c, bx, by, bw, bh, 19, item.badgeColor ?? '#fff8e8', '#58371c', 2.8);
      if (item.badgeIcon) {
        drawSpriteContain(c, item.badgeIcon, bx + 7, by + 6, 26, 26);
        drawText(c, item.badge, bx + 36 + (bw - 42) / 2, by + 20, 22, isDark ? '#fffdf5' : '#4a2b14', 'center', 900);
      } else {
        drawText(c, item.badge, bx + bw / 2, by + 20, 22, isDark ? '#fffdf5' : '#4a2b14', 'center', 900);
      }
    }

    // GIANT bold white outlined label underneath medallion (super legible on phones!)
    drawText(c, item.label, cx, topY + size + 24, 29, item.locked ? '#e3d8c4' : '#fffdf4', 'center', 900, '#442610', 6.5);
  });
}

function drawFloatingCornerPill(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  id: string,
  anchorX: number,
  y: number,
  icon: string,
  text: string,
  fill: string,
  alignRight = false,
): void {
  c.font = `900 22px ${UI_FONT}`;
  const pw = Math.min(344, Math.max(194, Math.ceil(c.measureText(text).width) + 68));
  const ph = 56;
  const x = alignRight ? anchorX - pw : anchorX;
  const pressed = hits.isPressed(id);
  const dy = pressed ? 2 : 0;

  hits.add({ id, x, y, w: pw, h: ph });
  if (!pressed) round(c, x, y + 4, pw, ph, 28, 'rgba(46,26,10,0.40)', 'transparent', 0);
  round(c, x, y + dy, pw, ph, 28, fill, '#5a391e', 2.8);
  drawSpriteContain(c, icon, x + 10, y + dy + 9, 38, 38);
  drawText(c, text, x + 54, y + dy + ph / 2 + 1, 22, PALETTE.ink, 'left', 900);
}

function drawCompactMapBar(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  y: number,
  widePhone: boolean,
): void {
  const unlockedMaps = getUnlockedMaps(profile);
  const options: Array<{ id: 'auto' | MapId; label: string; locked: boolean; reqStars: number }> = [
    { id: 'auto', label: t('p3.auto'), locked: false, reqStars: 0 },
    ...MAP_IDS.map(id => ({
      id,
      label: t(`p3.map.${id}`),
      locked: !unlockedMaps.includes(id),
      reqStars: getMapUnlockRequirement(id).minStars,
    })),
  ];

  const chipW = widePhone ? 98 : 88;
  const gap = 8;
  const signW = 42;
  const barW = signW + 18 + options.length * chipW + (options.length - 1) * gap + 18;
  const barH = 70;
  const bx = (1280 - barW) / 2;

  round(c, bx, y + 4, barW, barH, 35, 'rgba(42,22,8,0.38)', 'transparent', 0);
  round(c, bx, y, barW, barH, 35, 'rgba(255,247,230,0.96)', '#6a4626', 3.2);
  drawSpriteContain(c, 'ui_map_sign', bx + 14, y + 14, 42, 42);

  let cx = bx + 62;
  for (const opt of options) {
    const selected = profile.selectedMap === opt.id;
    const pressed = hits.isPressed(`menu:map:${opt.id}`);
    const dy = pressed ? 2 : 0;
    hits.add({ id: `menu:map:${opt.id}`, x: cx, y: y + 7, w: chipW, h: barH - 14, data: opt });

    if (selected) {
      round(c, cx, y + 7 + dy, chipW, barH - 14, 24, '#f7d263', '#8c4e12', 2.8);
      drawText(c, opt.label, cx + chipW / 2, y + barH / 2 + dy + 1, 24, PALETTE.ink, 'center', 900);
    } else if (opt.locked) {
      round(c, cx, y + 7 + dy, chipW, barH - 14, 22, 'rgba(116,96,76,0.28)', '#8a6f52', 2.2);
      drawText(c, `${opt.label}🔒`, cx + chipW / 2, y + barH / 2 + dy + 1, 22, '#694e34', 'center', 900);
    } else {
      drawText(c, opt.label, cx + chipW / 2, y + barH / 2 + dy + 1, 24, '#59391e', 'center', 800);
    }
    cx += chipW + gap;
  }
}

function drawVectorSpeaker(c: CanvasRenderingContext2D, cx: number, cy: number, muted: boolean): void {
  c.save();
  c.translate(cx, cy);
  c.scale(1.38, 1.38);
  c.fillStyle = PALETTE.ink;
  c.strokeStyle = PALETTE.ink;
  c.lineWidth = 2.4;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  c.beginPath();
  c.moveTo(-10, -4);
  c.lineTo(-5, -4);
  c.lineTo(1, -9);
  c.lineTo(1, 9);
  c.lineTo(-5, 4);
  c.lineTo(-10, 4);
  c.closePath();
  c.fill();
  c.stroke();

  if (muted) {
    c.strokeStyle = '#c43e2d';
    c.lineWidth = 2.8;
    c.beginPath();
    c.moveTo(5, -5); c.lineTo(12, 5);
    c.moveTo(12, -5); c.lineTo(5, 5);
    c.stroke();
  } else {
    c.beginPath();
    c.arc(2, 0, 6.5, -0.75, 0.75);
    c.stroke();
    c.beginPath();
    c.arc(2, 0, 11, -0.75, 0.75);
    c.stroke();
  }
  c.restore();
}

function drawVectorShare(c: CanvasRenderingContext2D, cx: number, cy: number): void {
  c.save();
  c.translate(cx, cy);
  c.scale(1.38, 1.38);
  c.strokeStyle = PALETTE.ink;
  c.lineWidth = 2.6;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  c.beginPath();
  c.moveTo(-9, 1);
  c.lineTo(-9, 9);
  c.lineTo(9, 9);
  c.lineTo(9, 1);
  c.stroke();

  c.beginPath();
  c.moveTo(0, 4);
  c.lineTo(0, -10);
  c.moveTo(-5, -5);
  c.lineTo(0, -10);
  c.lineTo(5, -5);
  c.stroke();
  c.restore();
}

function drawStaminaBar(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  x: number,
  y: number,
  stamina: ReturnType<typeof getStaminaStatus>,
): void {
  const w = 236;
  const h = 60;
  const pressed = hits.isPressed('menu:stamina');
  const dy = pressed ? 2 : 0;
  hits.add({ id: 'menu:stamina', x, y, w, h });

  if (!pressed) {
    round(c, x, y + 4, w, h, 30, 'rgba(46,26,10,0.36)', 'transparent', 0);
  }
  round(c, x, y + dy, w, h, 30, 'rgba(255,248,232,0.96)', '#5c3b1e', 3.2);

  // Warm golden lightning seal on the left
  round(c, x + 6, y + dy + 6, 48, 48, 24, '#ffe594', '#5c3b1e', 2.6);
  drawVectorLightning(c, x + 30, y + dy + 30, 1.25, '#eb8a12');

  // Crisp bold `xx/30` centered cleanly between lightning icon and `+`
  const low = stamina.current < STAMINA_COST_PER_BATTLE;
  drawText(c, `${stamina.current}/${stamina.max}`, x + 118, y + dy + h / 2 + 1, 29, low ? '#b83224' : PALETTE.ink, 'center', 900);

  // Plump green `+` button on the right to open Stamina countdown / future ad modal
  const plusCx = x + w - 28;
  const plusCy = y + dy + h / 2;
  c.beginPath();
  c.arc(plusCx, plusCy, 20, 0, Math.PI * 2);
  c.fillStyle = '#7ac443';
  c.fill();
  c.lineWidth = 2.6;
  c.strokeStyle = '#335c18';
  c.stroke();
  drawText(c, '+', plusCx, plusCy + 1, 28, '#fffdf5', 'center', 900);
}

function drawVectorLightning(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale = 1,
  fill = '#f2a318',
): void {
  c.save();
  c.translate(cx, cy);
  c.scale(scale, scale);
  c.beginPath();
  c.moveTo(2, -13);
  c.lineTo(-9, 1);
  c.lineTo(-1, 1);
  c.lineTo(-3, 13);
  c.lineTo(9, -2);
  c.lineTo(1, -2);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = '#5c320d';
  c.lineJoin = 'round';
  c.stroke();
  c.restore();
}
