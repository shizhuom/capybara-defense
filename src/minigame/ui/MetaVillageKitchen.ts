import {
  BROTHS,
  BROTH_IDS,
  INGREDIENTS,
  INGREDIENT_BASKET_PRICE,
  INGREDIENT_BASKET_SIZE,
  INGREDIENT_IDS,
  getKitchenCollectionAura,
  isBrothId,
  type BrothId,
  type BrothLevel,
  type IngredientId,
} from '../../config/kitchen';
import {
  FACILITIES,
  FACILITY_IDS,
  PET_TAP_DAILY_LIMIT,
  VILLAGE_MAX_LEVEL,
  VILLAGE_MAX_STARS,
  VILLAGE_OFFLINE_CAP_MS,
  type FacilityId,
} from '../../config/village';
import {
  canAffordIngredients,
  getBrothLevel,
  getBrothUpgradeCost,
} from '../../core/KitchenProgression';
import {
  canAffordVillage,
  computeOfflineHarvest,
  facilityUpgradeCost,
  getVillageResidents,
  hasHarvest,
  localDay,
  petTapsLeft,
  residentCapacity,
  villageLevel,
  villageStars,
} from '../../core/VillageProgression';
import type { Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import { assets } from '../../render/AssetRegistry';
import { round } from '../../render/StickerArt';
import { brothEffectText, kitchenAuraText } from '../../ui/KitchenScreen';
import { facilityLines } from '../../ui/VillageScreen';
import type { DialogGuideStep } from '../../ui/OnboardingGuide';
import {
  PALETTE,
  ScrollRegion,
  drawDetailNavBar,
  drawIconLabel,
  drawIvorySlab,
  drawLedgerShell,
  drawPillButton,
  drawProgressBar,
  drawScrollbar,
  drawSpriteContain,
  drawText,
  drawWrappedText,
  type UiHitManager,
} from './CanvasUI';

export interface VillageUiState {
  tab: 'courtyard' | 'build';
  focusFacilityId: FacilityId | null;
  elapsed: number;
  nowMs: number;
  petFeedback: { petIndex: number; quote: string; coins: number; until: number } | null;
  interacted: boolean;
  adDoubleHarvestAvailable: boolean;
}

export interface KitchenUiState {
  tab: 'broths' | 'pantry';
  detailBrothId: BrothId | null;
  lastBasketGained: IngredientId[];
}

const RESIDENT_OFFSETS: Record<FacilityId, readonly [number, number][]> = {
  fac_bamboo_pool: [[-5, 1], [5, 2], [0, 5]],
  fac_fish_stall: [[-12, 9], [12, 8], [0, 13]],
  fac_yuzu_tree: [[11, 8], [-12, 9], [0, 13]],
  fac_cat_nap: [[7, 1], [-9, 6], [1, 9]],
  fac_sakura_pavilion: [[-11, 9], [11, 6], [0, 12]],
};

function formatOfflineClock(ms: number): string {
  const mins = Math.floor(Math.max(0, ms) / 60_000);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/**
 * Strict 1:1 Web Storybook Capybara Onsen Village (`VillageScreen.ts` + `p18_preview_d08_village_courtyard.png`):
 * - 2 equal Honey-Oak tabs: 温泉庭院 / 设施建造
 * - Panoramic diorama with `Lv.x` badges, dashed empty spots, `ui_sleep_zzz`, `ui_pet_heart` + quote speech bubbles,
 *   bottom-left `入驻萌宠 X/Y` & bottom-right `今日零花钱 X/10` pills!
 * - Bottom Offline Harvest Basket Bar with golden progress bar (`已积攒 HH:MM / 12:00`), preview icons, and golden `一键收菜` pill!
 * - Facilities Build tab with single-column cards, current output/buffs, next-level preview & resource chips!
 */
export function drawVillageModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  villageUi: VillageUiState,
  scroll: ScrollRegion,
  opts?: { inBattle?: boolean; preparation?: boolean; guideStep?: DialogGuideStep | null },
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const stars = villageStars(profile);
  const pulseSel = opts?.guideStep?.pulseSelector;

  const body = drawLedgerShell(c, hits, {
    title: t('p16.title'),
    mascot: 'ui_village_peek_capy',
    badgeSegments: [
      { icon: 'res_onsen_wood', text: `×${profile.village.wood}` },
      { text: '·' },
      { icon: 'res_yuzu_essence', text: `×${profile.village.essence}` },
      { text: `· ★${stars}/${VILLAGE_MAX_STARS}` },
    ],
    tabs: [
      { id: 'village:tab:courtyard', label: t('p16.tab.courtyard'), active: villageUi.tab === 'courtyard', pulse: pulseSel === '[data-action="village-tab:courtyard"]' },
      { id: 'village:tab:build', label: t('p16.tab.build'), active: villageUi.tab === 'build', pulse: pulseSel === '[data-action="village-tab:build"]' },
    ],
    footer1: t('p16.footer1'),
    footer2: opts?.inBattle ? t(opts.preparation ? 'p16.footerPreparation' : 'p16.footerNextBattle') : t('p16.footer2'),
    guideStep: opts?.guideStep,
    elapsed: villageUi.elapsed,
  });

  // ── TAB 1: COURTYARD DIORAMA (`温泉庭院` — Widescreen 2-Column Balanced Layout with BIG Mobile Fonts!) ──
  if (villageUi.tab === 'courtyard') {
    const compact = body.h < 410;
    const gap = 14;
    const panelW = 398;
    const sx = body.x + 2;
    const sy = body.y + 2;
    const sw = body.w - panelW - gap - 4;
    const sh = body.h - 4;

    // LEFT COLUMN: Full-Height Natural-Aspect Courtyard Diorama (~780 × 468 = ~1.67:1, zero vertical squishing!)
    round(c, sx, sy, sw, sh, 18, '#d4e2bd', '#5a361a', 2.8);

    const bg = assets.get('bg_onsen_village');
    c.save();
    c.beginPath();
    c.roundRect(sx + 2, sy + 2, sw - 4, sh - 4, 16);
    c.clip();
    if (bg) {
      c.drawImage(bg, sx + 2, sy + 2, sw - 4, sh - 4);
    } else {
      const grad = c.createLinearGradient(sx, sy, sx, sy + sh);
      grad.addColorStop(0, '#c8dfb3');
      grad.addColorStop(1, '#a9c98f');
      c.fillStyle = grad;
      c.fillRect(sx, sy, sw, sh);
    }

    // 1. Facilities (or BIG readable dashed empty build spots!)
    for (const facId of FACILITY_IDS) {
      const def = FACILITIES[facId];
      const lv = villageLevel(profile, facId);
      const fx = sx + (def.spot.left / 100) * sw;
      const fy = sy + (def.spot.top / 100) * sh;
      if (lv > 0) {
        const size = facId === 'fac_bamboo_pool' ? (compact ? 118 : 138) : (compact ? 106 : 124);
        drawSpriteContain(c, facId, fx - size / 2, fy - size / 2, size, size);
        hits.add({ id: `village:focus:${facId}`, x: fx - size * 0.44, y: fy - size * 0.44, w: size * 0.88, h: size * 0.88 });
      } else {
        const label = `+ ${t(`facility.${facId}`)}`;
        c.font = '900 19.5px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
        const bw = Math.min(208, Math.max(156, Math.ceil(c.measureText(label).width) + 28));
        const bh = 44;
        const clampedX = Math.max(sx + bw / 2 + 8, Math.min(sx + sw - bw / 2 - 8, fx));
        hits.add({ id: `village:focus:${facId}`, x: clampedX - bw / 2, y: fy - bh / 2, w: bw, h: bh });
        c.save();
        c.setLineDash([6, 4]);
        round(c, clampedX - bw / 2, fy - bh / 2, bw, bh, 22, 'rgba(255,250,236,0.94)', '#4c803b', 2.4);
        c.restore();
        drawText(c, label, clampedX, fy + 1, 19.5, '#2d5720', 'center', 900);
      }
    }

    // 2. Floating ENLARGED Lv.x pill tags
    for (const facId of FACILITY_IDS) {
      const def = FACILITIES[facId];
      const lv = villageLevel(profile, facId);
      if (lv <= 0) continue;
      const fx = sx + (def.spot.left / 100) * sw;
      const fy = sy + ((def.spot.top + 9) / 100) * sh;
      round(c, fx - 34, fy - 16, 68, 32, 16, 'rgba(255,250,238,0.96)', '#6e4926', 2.2);
      drawText(c, `Lv.${lv}`, fx, fy + 1, 19, PALETTE.ink, 'center', 900);
    }

    // 3. Interactive Residents (enlarged sprites & BIG quote bubbles!)
    const residents = getVillageResidents(profile);
    const activeFb = villageUi.petFeedback && villageUi.elapsed < villageUi.petFeedback.until ? villageUi.petFeedback : null;
    const pulseStep3 = pulseSel === '.village-pet, .village-harvest-btn:not(:disabled)';

    residents.forEach((res, idx) => {
      const spot = FACILITIES[res.facility].spot;
      const [ox, oy] = RESIDENT_OFFSETS[res.facility][Math.min(2, res.slot)];
      const px = sx + ((spot.left + ox) / 100) * sw;
      const py = sy + ((spot.top + oy) / 100) * sh;
      const happy = activeFb?.petIndex === idx;
      const bob = happy ? -Math.abs(Math.sin(villageUi.elapsed * 16)) * 10 : Math.sin(villageUi.elapsed * 2.4 + idx * 1.1) * 3;
      const petSz = compact ? 58 : 66;

      if (pulseStep3) {
        const gPulse = 0.5 + 0.5 * Math.sin(villageUi.elapsed * 6 + idx);
        c.save();
        c.beginPath();
        c.arc(px, py + bob, petSz / 2 + 5 + gPulse * 4, 0, Math.PI * 2);
        c.strokeStyle = `rgba(255,212,56,${(0.65 + gPulse * 0.35).toFixed(2)})`;
        c.lineWidth = 4.5;
        c.stroke();
        c.restore();
      }
      drawSpriteContain(c, res.id, px - petSz / 2, py - petSz / 2 + bob, petSz, petSz);
      hits.add({ id: `village:pet:${idx}`, x: px - petSz / 2 - 4, y: py - petSz / 2 - 4, w: petSz + 8, h: petSz + 8 });

      if (res.pose === 'nap') {
        const zBob = Math.sin(villageUi.elapsed * 2.2 + idx) * 4;
        drawSpriteContain(c, 'ui_sleep_zzz', px + 16, py - petSz / 2 - 12 + zBob, 32, 32);
      }
      if (happy && activeFb) {
        const bw = 248, bh = 54;
        const bx = Math.max(sx + 10, Math.min(sx + sw - bw - 10, px - bw / 2));
        const by = Math.max(sy + 10, py - 84);
        round(c, bx, by, bw, bh, 18, 'rgba(255,252,242,0.97)', '#c96240', 2.4);
        drawSpriteContain(c, 'ui_pet_heart', bx + 10, by + 11, 32, 32);
        const q = activeFb.quote.length > 7 ? `${activeFb.quote.slice(0, 7)}…` : activeFb.quote;
        drawText(c, activeFb.coins > 0 ? `${q} +${activeFb.coins}` : q, bx + 48, by + 28, 19.5, '#7d3015', 'left', 900);
      }
    });

    c.restore();

    // RIGHT COLUMN: Big-Font Village Overview & Offline Harvest Control Panel!
    const rx = sx + sw + gap;
    const rw = panelW;
    const dayStr = localDay(new Date(villageUi.nowMs));
    const tapsUsed = PET_TAP_DAILY_LIMIT - petTapsLeft(profile, dayStr);
    const cap = residentCapacity(profile);

    // Card 1: Residents & Daily Pocket Money Status (replaces tiny 13.5px diorama corner pills!)
    const statH = compact ? 112 : 146;
    drawIvorySlab(c, rx, sy, rw, statH, 18, '#fffdf8', '#f6e8cb', '#7a5230', 2.4);

    // Row 1: Residents
    const r1y = sy + (compact ? 14 : 18);
    round(c, rx + 14, r1y, rw - 28, compact ? 38 : 44, 14, '#eef7e2', '#6a9452', 1.8);
    drawSpriteContain(c, 'ui_village_peek_capy', rx + 22, r1y + (compact ? 4 : 6), compact ? 30 : 32, compact ? 30 : 32);
    drawText(c, zh ? '入驻萌宠' : 'Residents', rx + 62, r1y + (compact ? 20 : 23), compact ? 20 : 21.5, PALETTE.ink, 'left', 900);
    drawText(c, `${residents.length} / ${cap}`, rx + rw - 26, r1y + (compact ? 20 : 23), compact ? 21 : 23, '#2b6b28', 'right', 900);

    // Row 2: Daily Pet Pocket Money
    const r2y = r1y + (compact ? 46 : 52);
    round(c, rx + 14, r2y, rw - 28, compact ? 38 : 44, 14, '#fff4d8', '#b88234', 1.8);
    drawSpriteContain(c, 'ui_pet_heart', rx + 22, r2y + (compact ? 4 : 6), compact ? 30 : 32, compact ? 30 : 32);
    drawText(c, zh ? '今日零花钱' : 'Pocket Money', rx + 62, r2y + (compact ? 20 : 23), compact ? 20 : 21.5, PALETTE.ink, 'left', 900);
    drawText(c, `${tapsUsed} / ${PET_TAP_DAILY_LIMIT}`, rx + rw - 26, r2y + (compact ? 20 : 23), compact ? 21 : 23, '#8c4408', 'right', 900);

    if (!compact) {
      drawText(c, zh ? '点点左侧院子里的萌宠可领零花钱' : 'Tap pets in the courtyard for coins!', rx + rw / 2, sy + statH - 15, 17.5, PALETTE.inkSoft, 'center', 800);
    }

    // Card 2: Offline Harvest Basket (fills remaining height cleanly with GIANT fonts!)
    const hy = sy + statH + 12;
    const hh = sy + sh - hy;
    const harvest = computeOfflineHarvest(profile, villageUi.nowMs);
    const ripe = hasHarvest(harvest);
    const frac = Math.min(1, harvest.elapsedMs / VILLAGE_OFFLINE_CAP_MS);

    drawIvorySlab(c, rx, hy, rw, hh, 18, '#fffdf8', '#f6e8cb', '#7a5230', 2.4);

    // Header: Basket icon + Title + Elapsed Time
    const iconS = compact ? 52 : 62;
    round(c, rx + 14, hy + 14, iconS, iconS, 14, '#fff3d4', '#8a5d32', 2);
    drawSpriteContain(c, 'ui_harvest_basket', rx + 18, hy + 18, iconS - 8, iconS - 8);
    drawText(c, t('p16.harvestTitle'), rx + 26 + iconS, hy + (compact ? 28 : 32), compact ? 22.5 : 25, PALETTE.ink, 'left', 900);
    const timeLabel = harvest.full ? t('p16.harvestFull') : t('p16.harvestElapsed', { time: formatOfflineClock(harvest.elapsedMs) });
    drawText(c, timeLabel, rx + 26 + iconS, hy + (compact ? 54 : 62), compact ? 18.5 : 20, harvest.full ? '#2d7a26' : PALETTE.inkSoft, 'left', 800);

    // Thick Golden Progress Bar
    const barY = hy + iconS + (compact ? 22 : 26);
    drawProgressBar(c, rx + 16, barY, rw - 32, 14, frac, '#e8b43c', '#e8dcc4', '#8c6239');

    // Big 2×2 Preview Loot Chips
    const previewChips: Array<{ icon: string; val: string; color: string }> = [
      { icon: 'ui_coin_gold', val: `+${harvest.coins}`, color: '#7c3f08' },
      ...(harvest.fragments > 0 ? [{ icon: 'ui_weapon_fragment', val: `×${harvest.fragments}`, color: '#7c3f08' }] : []),
      ...(harvest.yuzu > 0 ? [{ icon: 'ing_yuzu', val: `×${harvest.yuzu}`, color: '#7c3f08' }] : []),
      ...(harvest.tickets > 0 ? [{ icon: 'ui_ticket_gacha', val: `×${harvest.tickets}`, color: '#c23a2b' }] : []),
    ];
    const chipStartY = barY + (compact ? 24 : 28);
    const chipCols = Math.min(2, Math.max(1, previewChips.length));
    const chipGap = 10;
    const chipW = Math.floor((rw - 32 - chipGap * (chipCols - 1)) / chipCols);
    const chipH = compact ? 42 : 48;
    previewChips.forEach((pc, i) => {
      const col = i % chipCols;
      const row = Math.floor(i / chipCols);
      const px = rx + 16 + col * (chipW + chipGap);
      const py = chipStartY + row * (chipH + 8);
      round(c, px, py, chipW, chipH, 14, '#fff5dc', '#b88c52', 1.8);
      drawSpriteContain(c, pc.icon, px + 10, py + Math.round((chipH - 30) / 2), 30, 30);
      drawText(c, pc.val, px + 48, py + chipH / 2 + 1, compact ? 20.5 : 22.5, pc.color, 'left', 900);
    });

    // Bottom Giant Harvest Claim Button(s)
    const btnH = compact ? 52 : 58;
    const btnY = hy + hh - btnH - 14;
    const claimLabel = t(ripe ? 'p16.harvestClaim' : 'p16.harvestWaiting').replace(/^🧺\s*/u, '');
    const showAdDouble = villageUi.adDoubleHarvestAvailable && ripe;
    const claimW = showAdDouble ? Math.floor((rw - 42) * 0.58) : rw - 32;
    const claimX = rx + 16;

    if (pulseStep3 && ripe) {
      const gPulse = 0.5 + 0.5 * Math.sin(villageUi.elapsed * 6);
      round(c, claimX - 4, btnY - 4, claimW + 8, btnH + 8, (btnH + 8) / 2, 'transparent', `rgba(255,212,56,${(0.65 + gPulse * 0.35).toFixed(2)})`, 4.5);
    }
    drawPillButton(c, hits, 'village:harvest', claimX, btnY, claimW, btnH, claimLabel, ripe ? 'gold' : 'muted', {
      fontSize: compact ? 21 : 23,
      icon: 'ui_harvest_basket',
      disabled: !ripe,
    });
    if (showAdDouble) {
      const adX = claimX + claimW + 10;
      const adW = rx + rw - 16 - adX;
      drawPillButton(c, hits, 'village:ad-harvest', adX, btnY, adW, btnH, zh ? '🎬 双倍' : '🎬 2×', 'green', { fontSize: compact ? 20 : 21.5 });
    }
    return {};
  }

  // ── TAB 2: 2-COLUMN GIANT FACILITY CARDS (`设施建造`) ───────────────────────
  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const cols = 2, gapX = 16, gapY = 14;
  const cardW = Math.floor((vw - 16 - gapX) / cols);
  const cardH = 232;
  const pulsePool = pulseSel === '[data-action="village-build:fac_bamboo_pool"]';

  FACILITY_IDS.forEach((facId, idx) => {
    const col = idx % cols, row = Math.floor(idx / cols);
    const rx = vx + 4 + col * (cardW + gapX);
    const ry = vy + 4 + row * (cardH + gapY) - scroll.offset;
    if (ry + cardH < vy - 20 || ry > vy + vh + 20) return;

    const lv = villageLevel(profile, facId);
    const cost = facilityUpgradeCost(facId, lv);
    const afford = Boolean(cost && canAffordVillage(profile, cost));
    const focused = villageUi.focusFacilityId === facId;
    const shouldPulse = pulsePool && facId === 'fac_bamboo_pool';
    const curLines = facilityLines(facId, lv || 1);

    drawIvorySlab(
      c,
      rx,
      ry,
      cardW,
      cardH,
      20,
      shouldPulse || focused ? '#fff8d4' : lv > 0 ? '#fffdf8' : '#f2eadc',
      shouldPulse || focused ? '#f8e094' : lv > 0 ? '#f6e8cb' : '#e4dac7',
      shouldPulse ? '#e08b19' : focused ? '#4a997e' : '#7e5530',
      shouldPulse || focused ? 3.6 : 2.4,
    );

    round(c, rx + 16, ry + 18, 102, 102, 18, '#eef7e2', '#7a5230', 2.4);
    drawSpriteContain(c, facId, rx + 22, ry + 24, 90, 90, lv > 0 ? 1 : 0.55);

    const tx = rx + 132;
    const name = t(`facility.${facId}`);
    drawText(c, name, tx, ry + 34, 26, PALETTE.ink, 'left', 900);
    round(c, rx + cardW - 108, ry + 16, 92, 34, 17, lv > 0 ? '#dff5d6' : '#e5dac7', lv > 0 ? '#3d8633' : '#8a7a64', 2);
    drawText(c, lv > 0 ? `Lv.${lv}` : t('p16.notBuilt'), rx + cardW - 62, ry + 34, 19.5, lv > 0 ? '#235c1c' : PALETTE.inkSoft, 'center', 900);

    drawWrappedText(c, curLines.output.join(' · '), tx, ry + 60, cardW - 148, 20, 24, PALETTE.inkSoft, 'left', 800, 2);
    drawWrappedText(c, curLines.buffs.join(' · '), tx, ry + 110, cardW - 148, 20.5, 25, '#2b6b56', 'left', 900, 2);

    // Bottom Cost Chips + Giant Build/Upgrade Button
    const footY = ry + cardH - 40;
    if (cost) {
      let cx = rx + 18;
      if (cost.wood > 0) cx += drawIconLabel(c, 'res_onsen_wood', `${profile.village.wood}/${cost.wood}`, cx, footY, 28, 20.5, profile.village.wood >= cost.wood ? '#2c763d' : '#b83c2c') + 18;
      if (cost.essence > 0) cx += drawIconLabel(c, 'res_yuzu_essence', `${profile.village.essence}/${cost.essence}`, cx, footY, 28, 20.5, profile.village.essence >= cost.essence ? '#2c763d' : '#b83c2c') + 18;
      if (cost.coins > 0) drawIconLabel(c, 'ui_coin_gold', `${cost.coins}`, cx, footY, 28, 20.5, profile.coins >= cost.coins ? PALETTE.ink : '#b83c2c');
    } else {
      drawText(c, `★ ${t('p16.maxed')}`, rx + 20, footY, 22, '#8a4c10', 'left', 900);
    }

    if (ry + cardH > vy && ry < vy + vh) {
      if (cost) {
        const lbl = lv === 0 ? t('p16.build', { level: 1 }) : t('p16.upgradeTo', { level: lv + 1 });
        drawPillButton(c, hits, `village:build:${facId}`, rx + cardW - 174, ry + cardH - 68, 158, 54, lbl, afford ? (lv === 0 ? 'green' : 'gold') : 'muted', {
          fontSize: 21.5,
          disabled: !afford,
        });
      }
    }
  });

  const contentH = 12 + Math.ceil(FACILITY_IDS.length / cols) * (cardH + gapY);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

/**
 * Strict 1:1 Web Storybook Onsen Kitchen (`KitchenScreen.ts` + `p18_preview_d06_kitchen_broths.png` & `p19_07_kitchen_tier4_broths.png`):
 * - 2 equal Honey-Oak tabs: 汤浴配方 / 食材储藏室
 * - Tab 1: Top 「今日泡汤汤底」 Active Strip Card (with 卸下 pill!) + single-column full-description Broth cards
 *   + Dish Detail Sub-Page (Lv.1–3 growth ladder with `ui_storybook_check` + ingredient drop sources!)
 * - Tab 2: Single-column 6-ingredient Pantry + 「食材盲盒菜篮」 Basket Card!
 */
export function drawKitchenModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  kitchen: KitchenUiState,
  scroll: ScrollRegion,
  opts?: { inBattle?: boolean; preparation?: boolean; guideStep?: DialogGuideStep | null; elapsed?: number },
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const pulseSel = opts?.guideStep?.pulseSelector;
  const body = drawLedgerShell(c, hits, {
    title: t('p14.title'),
    mascot: 'ui_kitchen_peek_capy',
    badgeSegments: [{ icon: 'ui_kitchen_pot', text: kitchenAuraText(profile) }],
    tabs: [
      { id: 'kitchen:tab:broths', label: t('p14.tab.broths'), active: kitchen.tab === 'broths' },
      { id: 'kitchen:tab:pantry', label: t('p14.tab.pantry'), active: kitchen.tab === 'pantry' },
    ],
    footer1: t('p14.footer1'),
    footer2: opts?.inBattle ? t(opts.preparation ? 'p14.footerPreparation' : 'p14.footerNextBattle') : t('p14.footer2'),
    guideStep: opts?.guideStep,
    elapsed: opts?.elapsed,
  });

  // ── TAB 2: INGREDIENT PANTRY (`食材储藏室`) ────────────────────────────────
  if (kitchen.tab === 'pantry') {
    const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
    c.save();
    c.beginPath();
    c.rect(vx, vy, vw, vh);
    c.clip();

    const cols = 3, gapX = 16, gapY = 14;
    const cardW = Math.floor((vw - 16 - gapX * (cols - 1)) / cols);
    const ingCardH = 164;
    const rowW = vw - 16;
    let y = vy + 4 - scroll.offset;

    INGREDIENT_IDS.forEach((ingId, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const rx = vx + 4 + col * (cardW + gapX);
      const ry = y + row * (ingCardH + gapY);
      const count = profile.ingredients?.[ingId] ?? 0;
      if (ry + ingCardH >= vy - 20 && ry <= vy + vh + 20) {
        drawIvorySlab(c, rx, ry, cardW, ingCardH, 18, count > 0 ? '#fffdf8' : '#f2eadc', count > 0 ? '#f6e8cb' : '#e4dac7', '#7e5530', 2.2);
        round(c, rx + 14, ry + 16, 86, 86, 16, '#fff8e6', '#8a5d32', 2);
        drawSpriteContain(c, ingId, rx + 20, ry + 22, 74, 74, count > 0 ? 1 : 0.42);
        drawText(c, t(`ingredient.${ingId}`), rx + 112, ry + 36, 24, PALETTE.ink, 'left', 900);
        drawText(c, `×${count}`, rx + cardW - 16, ry + 36, 28, count > 0 ? '#7c3f08' : PALETTE.muted, 'right', 900);
        drawWrappedText(c, t(`ingredient.${ingId}.source`), rx + 112, ry + 64, cardW - 126, 18.5, 24, '#7d5b32', 'left', 700, 3);
      }
    });
    y += Math.ceil(INGREDIENT_IDS.length / cols) * (ingCardH + gapY) + 6;

    // Bottom Ingredient Basket Card
    const hasGained = kitchen.lastBasketGained.length > 0;
    const cardH = hasGained ? 228 : 160;
    if (y + cardH >= vy - 20 && y <= vy + vh + 20) {
      drawIvorySlab(c, vx + 4, y, rowW, cardH, 18, '#fffaf0', '#f5e2ba', '#b37a32', 2.4);
      round(c, vx + 18, y + 16, 68, 68, 16, '#fff3d4', '#8a5d32', 2);
      drawSpriteContain(c, 'ui_kitchen_pot', vx + 24, y + 22, 56, 56);
      drawText(c, t('p14.basketTitle'), vx + 102, y + 34, 21, PALETTE.ink, 'left', 900);
      drawWrappedText(c, t('p14.basketBody'), vx + 102, y + 54, rowW - 126, 15, 20, PALETTE.inkSoft, 'left', 700, 2);

      if (hasGained) {
        round(c, vx + 18, y + 96, rowW - 36, 56, 14, '#e6f8de', '#3d8633', 1.8);
        drawText(c, t('p14.basketGot'), vx + 32, y + 124, 15, '#22591b', 'left', 900);
        kitchen.lastBasketGained.slice(0, 3).forEach((gid, gi) => {
          const gx = vx + 166 + gi * 176;
          drawSpriteContain(c, gid, gx, y + 106, 36, 36);
          drawText(c, t(`ingredient.${gid}`), gx + 42, y + 124, 15, PALETTE.ink, 'left', 800);
        });
      }

      const buyY = y + cardH - 58;
      const afford = profile.coins >= INGREDIENT_BASKET_PRICE;
      if (buyY + 46 > vy && buyY < vy + vh) {
        drawPillButton(
          c,
          hits,
          'kitchen:basket',
          vx + 22,
          buyY,
          310,
          46,
          t('p14.basketBuy', { price: INGREDIENT_BASKET_PRICE, count: INGREDIENT_BASKET_SIZE }),
          afford ? 'gold' : 'muted',
          { fontSize: 16.5, icon: 'ui_coin_gold', disabled: !afford },
        );
      }
      drawIconLabel(c, 'ui_coin_gold', t('p14.coins', { coins: profile.coins }), vx + 350, buyY + 23, 22, 16, PALETTE.inkSoft);
    }
    y += cardH + 10;

    const contentH = Math.max(vh, y + scroll.offset - vy);
    c.restore();
    scroll.setContentBounds(contentH, vh);
    drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
    return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
  }

  // ── TAB 1 SUB-PAGE: DISH DETAIL SHEET (`kitchen-detail-sheet`) ────────────
  if (kitchen.detailBrothId) {
    const id = kitchen.detailBrothId;
    const def = BROTHS[id];
    const lv = getBrothLevel(profile, id);
    const active = profile.activeBrothId === id;
    const idx = BROTH_IDS.indexOf(id);

    const navH = drawDetailNavBar(c, hits, 'kitchen:back', 'kitchen:prev', 'kitchen:next', `${idx + 1} / ${BROTH_IDS.length}`, body.x, body.y, body.w, t('p14.back'));
    const vx = body.x, vy = body.y + navH + 8, vw = body.w, vh = body.h - navH - 8;
    c.save();
    c.beginPath();
    c.rect(vx, vy, vw, vh);
    c.clip();

    const cx = vx + 4, cw = vw - 14;
    let y = vy + 2 - scroll.offset;

    // Compact top showcase card so the primary CTA buttons stay visible above initial scroll fold!
    drawIvorySlab(c, cx, y, cw, 128, 16);
    round(c, cx + 16, y + 14, 98, 98, 18, def.bathColor, active ? '#3d8633' : '#7a5230', active ? 3 : 2.2);
    drawSpriteContain(c, id, cx + 22, y + 20, 86, 86, lv > 0 ? 1 : 0.65);
    drawText(c, t(`broth.${id}`), cx + 130, y + 28, 23, PALETTE.ink, 'left', 900);
    drawText(c, `${t('p14.tier', { tier: def.tier })} · ${t(`broth.${id}.style`)} · ${lv > 0 ? `Lv.${lv}` : t('p14.locked')}`, cx + 130, y + 54, 14.5, '#7c4e1a', 'left', 800);
    drawWrappedText(c, t(`broth.${id}.story`), cx + 130, y + 70, cw - 148, 14.5, 19, PALETTE.inkSoft, 'left', 700, 3);
    y += 136;

    // Compact 3-Tier Growth Ladder (Lv.1 / Lv.2 / Lv.3)
    const ladderH = 34 + 3 * 54;
    drawIvorySlab(c, cx, y, cw, ladderH, 16);
    drawText(c, t('p14.ladder'), cx + 18, y + 19, 15.5, PALETTE.inkSoft, 'left', 900);
    ([1, 2, 3] as const).forEach((step, si) => {
      const ly = y + 32 + si * 53;
      const reached = lv >= step;
      round(c, cx + 14, ly, cw - 28, 47, 12, reached ? '#eef9e6' : '#f8efdc', reached ? '#4b923c' : '#c7ad82', 1.6);
      drawText(c, `Lv.${step} ${t(`p14.level.${step}`)}`, cx + 26, ly + 15, 14.5, reached ? '#235c1c' : PALETTE.ink, 'left', 900);
      if (reached) drawSpriteContain(c, 'ui_storybook_check', cx + 162, ly + 5, 20, 20);
      drawText(c, brothEffectText(id, step), cx + 26, ly + 35, 14, PALETTE.inkSoft, 'left', 800);
      if (!reached) {
        drawCostChipsInline(c, profile, def.costs[step - 1], cx + cw - 22, ly + 23, true);
      }
    });
    y += ladderH + 10;

    // Primary Action Row
    const cost = getBrothUpgradeCost(id, lv);
    const afford = Boolean(cost && canAffordIngredients(profile, cost));
    if (y + 52 > vy && y < vy + vh) {
      if (lv === 0) {
        drawPillButton(c, hits, `kitchen:brew:${id}`, cx + cw / 2 - 140, y, 280, 48, t('p14.brew'), afford ? 'green' : 'muted', { fontSize: 18, disabled: !afford });
      } else {
        if (cost) {
          drawPillButton(c, hits, `kitchen:upgrade:${id}`, cx + 18, y, cw / 2 - 26, 48, t('p14.upgradeTo', { level: lv + 1 }), afford ? 'green' : 'muted', { fontSize: 17, disabled: !afford });
        }
        drawPillButton(
          c,
          hits,
          `kitchen:equip:${id}`,
          cost ? cx + cw / 2 + 8 : cx + cw / 2 - 140,
          y,
          cost ? cw / 2 - 26 : 280,
          48,
          t(active ? 'p14.currentActive' : 'p14.equipToday'),
          active ? 'green' : 'gold',
          { fontSize: 17 },
        );
      }
    }
    y += 62;

    // Missing Ingredient Source Hints
    const missing = cost ? (Object.entries(cost) as [IngredientId, number][]).filter(([ing, need]) => (profile.ingredients?.[ing] ?? 0) < need).map(([ing]) => ing) : [];
    if (missing.length > 0) {
      const sh = 38 + missing.length * 46;
      drawIvorySlab(c, cx, y, cw, sh, 16, '#fff8e8', '#f5e2ba', '#b37a32', 1.8);
      drawText(c, t('p14.sourceHint'), cx + 20, y + 22, 16, '#7c3f08', 'left', 900);
      missing.forEach((ing, mi) => {
        const my = y + 38 + mi * 44;
        drawSpriteContain(c, ing, cx + 20, my + 2, 34, 34);
        drawText(c, `${t(`ingredient.${ing}`)} — ${t(`ingredient.${ing}.source`)}`, cx + 62, my + 20, 15, PALETTE.inkSoft, 'left', 700);
      });
      y += sh + 12;
    }

    const contentH = Math.max(vh, y + scroll.offset - vy + 10);
    c.restore();
    scroll.setContentBounds(contentH, vh);
    drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
    return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
  }

  // ── TAB 1: BROTHS LIST (`汤浴配方` — EXACT `p18_preview_d06_kitchen_broths.png`!) ──
  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // 1. Top "Today's Active Broth" Strip Card (`kitchen-active-strip`)
  const activeId = profile.activeBrothId && isBrothId(profile.activeBrothId) ? profile.activeBrothId : null;
  const activeLv = activeId ? getBrothLevel(profile, activeId) : 0;
  const activeH = 96;
  if (y + activeH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, activeH, 18, '#fffef8', '#f6e9cc', '#7a5230', 2.2);
    if (activeId && activeLv > 0) {
      drawSpriteContain(c, activeId, vx + 20, y + 18, 60, 60);
      drawText(c, t('p14.activeTitle'), vx + 94, y + 22, 14, PALETTE.inkSoft, 'left', 800);
      const nm = t(`broth.${activeId}`);
      drawText(c, nm, vx + 94, y + 48, 21.5, PALETTE.ink, 'left', 900);
      c.font = '900 21.5px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
      const nw = c.measureText(nm).width;
      round(c, vx + 104 + nw, y + 36, 54, 24, 12, '#dff5d6', '#3d8633', 1.4);
      drawText(c, `Lv.${activeLv}`, vx + 131 + nw, y + 49, 13.5, '#22591b', 'center', 900);
      drawText(c, brothEffectText(activeId, activeLv as BrothLevel), vx + 94, y + 76, 15.5, PALETTE.inkSoft, 'left', 800);
      if (y + activeH > vy && y < vy + vh) {
        drawPillButton(c, hits, 'kitchen:unequip', vx + 4 + rowW - 108, y + 26, 92, 42, t('p14.unequip'), 'cream', { fontSize: 16 });
      }
    } else {
      drawSpriteContain(c, 'ui_kitchen_pot', vx + 20, y + 18, 60, 60);
      drawText(c, t('p14.activeTitle'), vx + 94, y + 30, 15, PALETTE.inkSoft, 'left', 800);
      drawText(c, t('p14.activeEmpty'), vx + 94, y + 60, 17, PALETTE.muted, 'left', 700);
    }
  }
  y += activeH + 12;

  // 2. 2-Column GIANT Broth Cards (all 14 broths!)
  const pulseYuzu = pulseSel === '[data-action="kitchen-brew:dish_yuzu_bath"]';
  const cols = 2, gapX = 16, gapY = 14;
  const cardW = Math.floor((vw - 16 - gapX) / cols);
  const cardH = 212;

  BROTH_IDS.forEach((brothId, idx) => {
    const col = idx % cols, row = Math.floor(idx / cols);
    const rx = vx + 4 + col * (cardW + gapX);
    const ry = y + row * (cardH + gapY);
    const def = BROTHS[brothId];
    const lv = getBrothLevel(profile, brothId);
    const isActive = profile.activeBrothId === brothId;
    const cost = getBrothUpgradeCost(brothId, lv);
    const afford = Boolean(cost && canAffordIngredients(profile, cost));
    const shouldPulse = pulseYuzu && brothId === 'dish_yuzu_bath';

    if (ry + cardH >= vy - 20 && ry <= vy + vh + 20) {
      drawIvorySlab(
        c,
        rx,
        ry,
        cardW,
        cardH,
        20,
        shouldPulse ? '#fff9d6' : isActive ? '#f3fde9' : lv > 0 ? '#fffdf8' : '#f4ecde',
        shouldPulse ? '#fae292' : isActive ? '#e3f7d0' : lv > 0 ? '#f6e8cb' : '#e7dcc8',
        shouldPulse ? '#e08b19' : isActive ? '#4a9938' : '#7e5530',
        shouldPulse ? 3.8 : isActive ? 3 : 2.2,
      );

      // Left open-detail tap zone
      if (ry + cardH > vy && ry < vy + vh) {
        hits.add({ id: `kitchen:dish:${brothId}`, x: rx, y: Math.max(vy, ry), w: cardW - 168, h: Math.min(ry + cardH, vy + vh) - Math.max(vy, ry) });
      }

      round(c, rx + 16, ry + 18, 98, 98, 18, def.bathColor, isActive ? '#3d8633' : '#7a5230', isActive ? 3 : 2.2);
      drawSpriteContain(c, brothId, rx + 22, ry + 24, 86, 86, lv > 0 ? 1 : 0.72);

      const tx = rx + 128;
      const nm = t(`broth.${brothId}`);
      drawText(c, nm, tx, ry + 34, 25, PALETTE.ink, 'left', 900);
      round(c, rx + cardW - 92, ry + 18, 76, 30, 15, lv > 0 ? '#dff5d6' : '#e6dac5', lv > 0 ? '#3d8633' : '#8a7a64', 1.8);
      drawText(c, lv > 0 ? `Lv.${lv}` : t('p14.locked'), rx + cardW - 54, ry + 34, 17, lv > 0 ? '#22591b' : PALETTE.inkSoft, 'center', 900);

      drawText(c, `${t('p14.tier', { tier: def.tier })} · ${t(`broth.${brothId}.style`)}`, tx, ry + 64, 18, '#7a5c3c', 'left', 800);
      drawWrappedText(c, brothEffectText(brothId, (lv || 1) as BrothLevel), tx, ry + 82, cardW - 144, 19, 25, PALETTE.ink, 'left', 800, 2);

      if (cost) {
        drawCostChipsInline(c, profile, cost, rx + 16, ry + cardH - 36, false);
      } else {
        drawText(c, `★ ${t('p14.mastered')}`, rx + 18, ry + cardH - 36, 19.5, '#8c5310', 'left', 900);
      }

      // Bottom-Right Action Pill Button
      if (ry + cardH > vy && ry < vy + vh) {
        const bx = rx + cardW - 156;
        if (lv === 0) {
          if (afford) {
            drawPillButton(c, hits, `kitchen:brew:${brothId}`, bx, ry + cardH - 60, 142, 48, t('p14.brew'), 'green', { fontSize: 19.5 });
          } else {
            round(c, bx + 12, ry + cardH - 56, 128, 42, 21, '#e8dfd0', '#b3a38c', 1.8);
            drawText(c, t('p14.missing'), bx + 76, ry + cardH - 34, 18.5, '#7c6e5b', 'center', 800);
          }
        } else {
          drawPillButton(
            c,
            hits,
            `kitchen:equip:${brothId}`,
            bx,
            ry + cardH - 60,
            142,
            48,
            t(isActive ? 'p14.active' : 'p14.equip'),
            isActive ? 'green' : 'cream',
            { fontSize: 19.5 },
          );
        }
      }
    }
  });
  y += Math.ceil(BROTH_IDS.length / cols) * (cardH + gapY);

  const contentH = Math.max(vh, y + scroll.offset - vy + 10);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

function drawCostChipsInline(
  c: CanvasRenderingContext2D,
  profile: Profile,
  cost: Partial<Record<IngredientId, number>>,
  anchorX: number,
  centerY: number,
  alignRight: boolean,
): void {
  const entries = Object.entries(cost) as [IngredientId, number][];
  const compact = entries.length > 4;
  const chipW = compact ? 68 : 78;
  const gap = compact ? 4 : 6;
  const totalW = entries.length * chipW + Math.max(0, entries.length - 1) * gap;
  let cx = alignRight ? anchorX - totalW : anchorX;
  for (const [ingId, need] of entries) {
    const have = profile.ingredients?.[ingId] ?? 0;
    const ok = have >= need;
    round(c, cx, centerY - 13, chipW, 26, 13, ok ? '#e4f7dc' : '#fceae6', ok ? '#49913b' : '#c96c5a', 1.4);
    drawSpriteContain(c, ingId, cx + (compact ? 4 : 5), centerY - 9, 18, 18);
    drawText(c, `${have}/${need}`, cx + (compact ? 24 : 27), centerY + 1, compact ? 12 : 13.5, ok ? '#23591b' : '#9c3222', 'left', 900);
    cx += chipW + gap;
  }
}

export { getKitchenCollectionAura };
