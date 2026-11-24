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

  // ── TAB 1: COURTYARD DIORAMA (`温泉庭院` — EXACT `p18_preview_d08_village_courtyard.png`!) ──
  if (villageUi.tab === 'courtyard') {
    const harvestH = 92;
    const sx = body.x + 2, sy = body.y + 2, sw = body.w - 4, sh = body.h - harvestH - 12;
    round(c, sx, sy, sw, sh, 16, '#d4e2bd', '#5a361a', 2.8);

    const bg = assets.get('bg_onsen_village');
    c.save();
    c.beginPath();
    c.roundRect(sx + 2, sy + 2, sw - 4, sh - 4, 14);
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

    // 1. Facilities (or dashed empty build spots)
    for (const facId of FACILITY_IDS) {
      const def = FACILITIES[facId];
      const lv = villageLevel(profile, facId);
      const fx = sx + (def.spot.left / 100) * sw;
      const fy = sy + (def.spot.top / 100) * sh;
      if (lv > 0) {
        const size = facId === 'fac_bamboo_pool' ? 128 : 114;
        drawSpriteContain(c, facId, fx - size / 2, fy - size / 2, size, size);
        hits.add({ id: `village:focus:${facId}`, x: fx - size * 0.42, y: fy - size * 0.42, w: size * 0.84, h: size * 0.84 });
      } else {
        const bw = 132, bh = 36;
        hits.add({ id: `village:focus:${facId}`, x: fx - bw / 2, y: fy - bh / 2, w: bw, h: bh });
        c.save();
        c.setLineDash([6, 4]);
        round(c, fx - bw / 2, fy - bh / 2, bw, bh, 18, 'rgba(255,248,232,0.92)', '#5d8a4b', 2);
        c.restore();
        drawText(c, `+ ${t(`facility.${facId}`)}`, fx, fy + 1, 14.5, '#3b612c', 'center', 900);
      }
    }

    // 2. Floating Lv.x white pill tags on their own layer (exact Web `village-level-tag`!)
    for (const facId of FACILITY_IDS) {
      const def = FACILITIES[facId];
      const lv = villageLevel(profile, facId);
      if (lv <= 0) continue;
      const fx = sx + (def.spot.left / 100) * sw;
      const fy = sy + ((def.spot.top + 8) / 100) * sh;
      round(c, fx - 26, fy - 12, 52, 24, 12, 'rgba(255,250,238,0.95)', '#6e4926', 1.8);
      drawText(c, `Lv.${lv}`, fx, fy + 1, 13.5, PALETTE.ink, 'center', 900);
    }

    // 3. Interactive Residents (with `ui_sleep_zzz` when napping & `ui_pet_heart` + quote bubble when patted!)
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

      if (pulseStep3) {
        const gPulse = 0.5 + 0.5 * Math.sin(villageUi.elapsed * 6 + idx);
        c.save();
        c.beginPath();
        c.arc(px, py + bob, 31 + gPulse * 4, 0, Math.PI * 2);
        c.strokeStyle = `rgba(255,212,56,${(0.65 + gPulse * 0.35).toFixed(2)})`;
        c.lineWidth = 4;
        c.stroke();
        c.restore();
      }
      drawSpriteContain(c, res.id, px - 28, py - 28 + bob, 56, 56);
      hits.add({ id: `village:pet:${idx}`, x: px - 30, y: py - 30, w: 60, h: 60 });

      if (res.pose === 'nap') {
        const zBob = Math.sin(villageUi.elapsed * 2.2 + idx) * 4;
        drawSpriteContain(c, 'ui_sleep_zzz', px + 14, py - 38 + zBob, 28, 28);
      }
      if (happy && activeFb) {
        const bw = 176, bh = 44;
        const bx = Math.max(sx + 8, Math.min(sx + sw - bw - 8, px - bw / 2));
        const by = Math.max(sy + 8, py - 74);
        round(c, bx, by, bw, bh, 16, 'rgba(255,252,242,0.96)', '#c96240', 2);
        drawSpriteContain(c, 'ui_pet_heart', bx + 8, by + 8, 28, 28);
        const q = activeFb.quote.length > 7 ? `${activeFb.quote.slice(0, 7)}…` : activeFb.quote;
        drawText(c, activeFb.coins > 0 ? `${q} +${activeFb.coins}` : q, bx + 40, by + 23, 14, '#7d3015', 'left', 900);
      }
    });

    // 4. Bottom-Left & Bottom-Right Status Pills right inside Diorama corners (EXACT `p18_preview_d08`!)
    const dayStr = localDay(new Date(villageUi.nowMs));
    const tapsUsed = PET_TAP_DAILY_LIMIT - petTapsLeft(profile, dayStr);
    const leftPillText = t('p16.residents', { count: residents.length, max: residentCapacity(profile) });
    const rightPillText = t('p16.petAllowance', { count: tapsUsed });

    round(c, sx + 10, sy + sh - 34, 128, 26, 13, 'rgba(255,250,238,0.94)', '#7c5330', 1.6);
    drawText(c, leftPillText, sx + 74, sy + sh - 20, 13.5, PALETTE.ink, 'center', 900);

    round(c, sx + sw - 150, sy + sh - 34, 140, 26, 13, 'rgba(255,250,238,0.94)', '#7c5330', 1.6);
    drawText(c, rightPillText, sx + sw - 80, sy + sh - 20, 13.5, PALETTE.ink, 'center', 900);

    c.restore();

    // 5. Bottom Offline Harvest Basket Strip with Golden Progress Bar (EXACT `p18_preview_d08`!)
    const hy = sy + sh + 10;
    const harvest = computeOfflineHarvest(profile, villageUi.nowMs);
    const ripe = hasHarvest(harvest);
    const frac = Math.min(1, harvest.elapsedMs / VILLAGE_OFFLINE_CAP_MS);

    drawIvorySlab(c, sx, hy, sw, harvestH, 16, '#fffdf8', '#f6e8cb', '#7a5230', 2.2);
    drawSpriteContain(c, 'ui_harvest_basket', sx + 14, hy + 16, 60, 60);

    const tx = sx + 86;
    drawText(c, t('p16.harvestTitle'), tx, hy + 24, 19, PALETTE.ink, 'left', 900);
    const timeLabel = harvest.full ? t('p16.harvestFull') : t('p16.harvestElapsed', { time: formatOfflineClock(harvest.elapsedMs) });
    drawText(c, timeLabel, tx + 114, hy + 25, 15, PALETTE.inkSoft, 'left', 800);

    const btnAreaW = villageUi.adDoubleHarvestAvailable && ripe ? 302 : 168;
    drawProgressBar(c, tx, hy + 42, sw - (tx - sx) - btnAreaW - 20, 10, frac, '#e8b43c', '#e8dcc4', '#8c6239');

    // Preview Loot Chips
    let cx = tx;
    cx += drawIconLabel(c, 'ui_coin_gold', `+${harvest.coins}`, cx, hy + 72, 22, 16.5, '#7c3f08') + 16;
    if (harvest.fragments > 0) cx += drawIconLabel(c, 'ui_weapon_fragment', `×${harvest.fragments}`, cx, hy + 72, 22, 16.5, '#7c3f08') + 16;
    if (harvest.yuzu > 0) cx += drawIconLabel(c, 'ing_yuzu', `×${harvest.yuzu}`, cx, hy + 72, 22, 16.5, '#7c3f08') + 16;
    if (harvest.tickets > 0) drawIconLabel(c, 'ui_ticket_gacha', `×${harvest.tickets}`, cx, hy + 72, 22, 16.5, '#c23a2b');

    const claimW = 152;
    const claimLabel = t(ripe ? 'p16.harvestClaim' : 'p16.harvestWaiting').replace(/^🧺\s*/u, '');
    if (pulseStep3 && ripe) {
      const gPulse = 0.5 + 0.5 * Math.sin(villageUi.elapsed * 6);
      round(c, sx + sw - claimW - 18, hy + 17, claimW + 8, 58, 29, 'transparent', `rgba(255,212,56,${(0.65 + gPulse * 0.35).toFixed(2)})`, 4);
    }
    drawPillButton(c, hits, 'village:harvest', sx + sw - claimW - 14, hy + 21, claimW, 50, claimLabel, ripe ? 'gold' : 'muted', {
      fontSize: 17.5,
      icon: 'ui_harvest_basket',
      disabled: !ripe,
    });
    if (villageUi.adDoubleHarvestAvailable && ripe) {
      drawPillButton(c, hits, 'village:ad-harvest', sx + sw - claimW - 148, hy + 21, 126, 50, zh ? '🎬 双倍' : '🎬 2×', 'green', { fontSize: 16 });
    }
    return {};
  }

  // ── TAB 2: 5 FACILITIES BUILD & UPGRADE (`设施建造`) ────────────────────────
  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const rowH = 148, gap = 12, rowW = vw - 14;
  const pulsePool = pulseSel === '[data-action="village-build:fac_bamboo_pool"]';

  FACILITY_IDS.forEach((facId, idx) => {
    const ry = vy + 4 + idx * (rowH + gap) - scroll.offset;
    if (ry + rowH < vy - 20 || ry > vy + vh + 20) return;

    const lv = villageLevel(profile, facId);
    const cost = facilityUpgradeCost(facId, lv);
    const afford = Boolean(cost && canAffordVillage(profile, cost));
    const focused = villageUi.focusFacilityId === facId;
    const shouldPulse = pulsePool && facId === 'fac_bamboo_pool';
    const curLines = facilityLines(facId, lv || 1);
    const nextLines = lv > 0 && lv < VILLAGE_MAX_LEVEL ? facilityLines(facId, lv + 1) : null;

    drawIvorySlab(
      c,
      vx + 4,
      ry,
      rowW,
      rowH,
      18,
      shouldPulse || focused ? '#fff8d4' : lv > 0 ? '#fffdf8' : '#f2eadc',
      shouldPulse || focused ? '#f8e094' : lv > 0 ? '#f6e8cb' : '#e4dac7',
      shouldPulse ? '#e08b19' : focused ? '#4a997e' : '#7e5530',
      shouldPulse || focused ? 3.2 : 2,
    );

    round(c, vx + 18, ry + 30, 86, 86, 16, '#eef7e2', '#7a5230', 2);
    drawSpriteContain(c, facId, vx + 23, ry + 35, 76, 76, lv > 0 ? 1 : 0.55);

    const tx = vx + 118;
    const name = t(`facility.${facId}`);
    drawText(c, name, tx, ry + 24, 20.5, PALETTE.ink, 'left', 900);
    c.font = '900 20.5px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
    const nw = c.measureText(name).width;
    round(c, tx + nw + 10, ry + 12, lv > 0 ? 58 : 70, 24, 12, lv > 0 ? '#dff5d6' : '#e5dac7', lv > 0 ? '#3d8633' : '#8a7a64', 1.4);
    drawText(c, lv > 0 ? `Lv.${lv}` : t('p16.notBuilt'), tx + nw + (lv > 0 ? 39 : 45), ry + 25, 13.5, lv > 0 ? '#235c1c' : PALETTE.inkSoft, 'center', 900);

    drawText(c, curLines.output.join(' · '), tx, ry + 50, 14.5, PALETTE.inkSoft, 'left', 800);
    drawText(c, curLines.buffs.join(' · '), tx, ry + 73, 15, '#2b6b56', 'left', 900);

    if (nextLines) {
      const nextSummary = [...nextLines.output.slice(0, 1), ...nextLines.buffs]
        .join(' · ')
        .replace(/🪙\s*/gu, '');
      const nxtStr = `${t('p16.nextLevel')}: ${nextSummary}`;
      drawText(c, nxtStr.length > 36 ? `${nxtStr.slice(0, 36)}…` : nxtStr, tx, ry + 96, 13.5, '#8c5a22', 'left', 700);
    }

    if (cost) {
      const costY = nextLines ? ry + 124 : ry + 108;
      let cx = tx;
      if (cost.wood > 0) cx += drawIconLabel(c, 'res_onsen_wood', `${profile.village.wood}/${cost.wood}`, cx, costY, 22, 15, profile.village.wood >= cost.wood ? '#2c763d' : '#b83c2c') + 18;
      if (cost.essence > 0) cx += drawIconLabel(c, 'res_yuzu_essence', `${profile.village.essence}/${cost.essence}`, cx, costY, 22, 15, profile.village.essence >= cost.essence ? '#2c763d' : '#b83c2c') + 18;
      if (cost.coins > 0) drawIconLabel(c, 'ui_coin_gold', `${cost.coins}`, cx, costY, 22, 15, profile.coins >= cost.coins ? PALETTE.ink : '#b83c2c');
    } else {
      drawText(c, `★ ${t('p16.maxed')}`, tx, ry + 114, 15.5, '#8a4c10', 'left', 900);
    }

    if (ry + rowH > vy && ry < vy + vh) {
      if (cost) {
        const lbl = lv === 0 ? t('p16.build', { level: 1 }) : t('p16.upgradeTo', { level: lv + 1 });
        drawPillButton(c, hits, `village:build:${facId}`, vx + 4 + rowW - 144, ry + 51, 130, 46, lbl, afford ? (lv === 0 ? 'green' : 'gold') : 'muted', {
          fontSize: 16.5,
          disabled: !afford,
        });
      } else {
        drawText(c, t('p16.maxed'), vx + 4 + rowW - 76, ry + 74, 16, '#8a4c10', 'center', 900);
      }
    }
  });

  const contentH = 8 + FACILITY_IDS.length * (rowH + gap);
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

    const rowW = vw - 14;
    const rowH = 92, gap = 10;
    let y = vy + 4 - scroll.offset;

    INGREDIENT_IDS.forEach(ingId => {
      const count = profile.ingredients?.[ingId] ?? 0;
      if (y + rowH >= vy - 20 && y <= vy + vh + 20) {
        drawIvorySlab(c, vx + 4, y, rowW, rowH, 16, count > 0 ? '#fffdf8' : '#f2eadc', count > 0 ? '#f6e8cb' : '#e4dac7', '#7e5530', 2);
        round(c, vx + 18, y + 12, 68, 68, 14, '#fff8e6', '#8a5d32', 1.8);
        drawSpriteContain(c, ingId, vx + 23, y + 17, 58, 58, count > 0 ? 1 : 0.42);
        drawText(c, t(`ingredient.${ingId}`), vx + 102, y + 26, 20, PALETTE.ink, 'left', 900);
        drawText(c, t(`ingredient.${ingId}.flavor`), vx + 102, y + 52, 15, PALETTE.inkSoft, 'left', 700);
        drawText(c, t(`ingredient.${ingId}.source`), vx + 102, y + 74, 14, '#7d5b32', 'left', 700);

        drawText(c, t('p14.stock'), vx + 4 + rowW - 44, y + 32, 14, PALETTE.inkSoft, 'center', 800);
        drawText(c, `×${count}`, vx + 4 + rowW - 44, y + 60, 22, count > 0 ? '#7c3f08' : PALETTE.muted, 'center', 900);
      }
      y += rowH + gap;
    });

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

  // 2. Single-Column Full-Description Broth Cards (all 14 broths!)
  const pulseYuzu = pulseSel === '[data-action="kitchen-brew:dish_yuzu_bath"]';
  const rowH = 136, gap = 12;

  for (const brothId of BROTH_IDS) {
    const def = BROTHS[brothId];
    const lv = getBrothLevel(profile, brothId);
    const isActive = profile.activeBrothId === brothId;
    const cost = getBrothUpgradeCost(brothId, lv);
    const afford = Boolean(cost && canAffordIngredients(profile, cost));
    const shouldPulse = pulseYuzu && brothId === 'dish_yuzu_bath';

    if (y + rowH >= vy - 20 && y <= vy + vh + 20) {
      drawIvorySlab(
        c,
        vx + 4,
        y,
        rowW,
        rowH,
        18,
        shouldPulse ? '#fff9d6' : isActive ? '#f3fde9' : lv > 0 ? '#fffdf8' : '#f4ecde',
        shouldPulse ? '#fae292' : isActive ? '#e3f7d0' : lv > 0 ? '#f6e8cb' : '#e7dcc8',
        shouldPulse ? '#e08b19' : isActive ? '#4a9938' : '#7e5530',
        shouldPulse ? 3.5 : isActive ? 2.6 : 2,
      );

      // Left open-detail tap zone
      if (y + rowH > vy && y < vy + vh) {
        hits.add({ id: `kitchen:dish:${brothId}`, x: vx + 4, y: Math.max(vy, y), w: rowW - 156, h: Math.min(y + rowH, vy + vh) - Math.max(vy, y) });
      }

      round(c, vx + 18, y + 24, 86, 86, 18, def.bathColor, isActive ? '#3d8633' : '#7a5230', isActive ? 2.6 : 2);
      drawSpriteContain(c, brothId, vx + 24, y + 30, 74, 74, lv > 0 ? 1 : 0.72);

      const tx = vx + 118;
      const nm = t(`broth.${brothId}`);
      drawText(c, nm, tx, y + 26, 21, PALETTE.ink, 'left', 900);
      c.font = '900 21px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
      const nw = c.measureText(nm).width;
      round(c, tx + nw + 10, y + 14, lv > 0 ? 54 : 66, 24, 12, lv > 0 ? '#dff5d6' : '#e6dac5', lv > 0 ? '#3d8633' : '#8a7a64', 1.4);
      drawText(c, lv > 0 ? `Lv.${lv}` : t('p14.locked'), tx + nw + (lv > 0 ? 37 : 43), y + 27, 13.5, lv > 0 ? '#22591b' : PALETTE.inkSoft, 'center', 900);

      drawText(c, `${t('p14.tier', { tier: def.tier })} · ${t(`broth.${brothId}.style`)}`, tx, y + 52, 14.5, '#7a5c3c', 'left', 800);
      drawWrappedText(c, brothEffectText(brothId, (lv || 1) as BrothLevel), tx, y + 66, rowW - 284, 16, 21, PALETTE.ink, 'left', 800, 2);

      if (cost) {
        drawCostChipsInline(c, profile, cost, tx, y + 112, false);
      } else {
        drawText(c, `★ ${t('p14.mastered')}`, tx, y + 114, 15, '#8c5310', 'left', 900);
      }

      // Right Action Column (exact `✓ 使用中` / `设为汤底` / `熬制解锁` / `食材不足` + `可升级`!)
      if (y + rowH > vy && y < vy + vh) {
        const bx = vx + 4 + rowW - 144;
        if (lv === 0) {
          if (afford) {
            drawPillButton(c, hits, `kitchen:brew:${brothId}`, bx, y + 45, 130, 46, t('p14.brew'), 'green', { fontSize: 16.5 });
          } else {
            round(c, bx + 10, y + 48, 112, 40, 20, '#e8dfd0', '#b3a38c', 1.6);
            drawText(c, t('p14.missing'), bx + 66, y + 69, 15.5, '#7c6e5b', 'center', 800);
          }
        } else {
          drawPillButton(
            c,
            hits,
            `kitchen:equip:${brothId}`,
            bx,
            afford ? y + 26 : y + 45,
            130,
            44,
            t(isActive ? 'p14.active' : 'p14.equip'),
            isActive ? 'green' : 'cream',
            { fontSize: 16.5 },
          );
          if (afford) {
            drawPillButton(c, hits, `kitchen:dish:${brothId}`, bx + 14, y + 80, 102, 32, t('p14.canUpgrade'), 'gold', { fontSize: 14 });
          }
        }
      }
    }
    y += rowH + gap;
  }

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
