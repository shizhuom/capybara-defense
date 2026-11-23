import { HEROES } from '../../config/heroes';
import { INGREDIENT_IDS, isIngredientId, type IngredientId } from '../../config/kitchen';
import { STANDARD_VICTORY_CRESTS } from '../../config/medallions';
import { RANKS, getRank } from '../../config/ranks';
import { RECIPES } from '../../config/recipes';
import { VILLAGE_RESOURCE_IDS, type VillageResourceId } from '../../config/village';
import { WEAPONS } from '../../config/weapons';
import { computeNextGoalHook, type NextGoalHook } from '../../core/FeatureUnlocks';
import { getBaseUnitStats } from '../../core/UnitStats';
import { formatCompactNumber } from '../../core/formatNumber';
import type { BattleState, Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import { round } from '../../render/StickerArt';
import {
  BTN_STYLES,
  PALETTE,
  ScrollRegion,
  drawButton,
  drawProgressBar,
  drawSpriteContain,
  drawText,
  drawWoodPanel,
  drawWrappedText,
  formatClock,
  type UiHitManager,
} from './CanvasUI';

export type MinigameModalKind =
  | null
  | 'pause'
  | 'endless-offer'
  | 'result'
  | 'recipes'
  | 'settings';

export interface SettlementMeta {
  savedResult: boolean;
  resultStars: number;
  previousRank: number;
  newWeapons: readonly string[];
  ticketAwarded: boolean;
  statsOpen: boolean;
}

export interface ModalDrawContext {
  modal: Exclude<MinigameModalKind, null>;
  profile: Profile;
  state: BattleState | null;
  settlement: SettlementMeta;
  recipesTab: 'heroes' | 'basics';
  scroll: ScrollRegion;
}

export interface ModalLayoutInfo {
  scrollViewport?: { x: number; y: number; w: number; h: number };
  musicSlider?: { x: number; y: number; w: number; h: number };
  soundSlider?: { x: number; y: number; w: number; h: number };
}

/** Draws the active Canvas modal over a dimmed backdrop and registers all hit targets. */
export function drawActiveModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  ctx: ModalDrawContext,
): ModalLayoutInfo {
  // Dim backdrop
  c.fillStyle = 'rgba(26,16,8,0.64)';
  c.fillRect(0, 0, 1280, 720);
  // Backdrop click-catcher (closes non-blocking modals like settings/recipes/pause)
  hits.add({ id: 'modal:backdrop', x: 0, y: 0, w: 1280, h: 720 });

  switch (ctx.modal) {
    case 'pause':
      if (ctx.state) drawPauseModal(c, hits, ctx.state);
      return {};
    case 'endless-offer':
      if (ctx.state) drawEndlessOfferModal(c, hits, ctx.state, ctx.settlement);
      return {};
    case 'result':
      if (ctx.state) drawResultModal(c, hits, ctx.state, ctx.profile, ctx.settlement);
      return {};
    case 'recipes':
      return drawRecipesModal(c, hits, ctx.recipesTab, ctx.scroll);
    case 'settings':
      return drawSettingsModal(c, hits, ctx.profile, !!ctx.state);
  }
}

function drawPauseModal(c: CanvasRenderingContext2D, hits: UiHitManager, state: BattleState): void {
  const pw = 620, ph = 470;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;
  drawWoodPanel(c, px, py, pw, ph, 24, PALETTE.cream, PALETTE.woodDark);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Peeking capybara mascot + title
  drawSpriteContain(c, 'ui_pause_peek_capy', px + 26, py - 24, 88, 88);
  drawText(c, t('p12.pauseTitle'), px + 122, py + 38, 28, PALETTE.ink, 'left', 900);
  drawButton(c, hits, 'modal:resume', px + pw - 56, py + 18, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // Status strip
  const sy = py + 76;
  round(c, px + 26, sy, pw - 52, 78, 16, '#f3e2be', PALETTE.woodLight, 2);
  drawSpriteContain(c, 'ui_map_sign', px + 38, sy + 12, 54, 54);
  drawText(c, t(`map.${state.mapId}`), px + 104, sy + 26, 18, PALETTE.ink, 'left', 900);
  const waveStr = state.endless ? t('p13.endlessWave', { wave: state.wave }) : t('p12.pauseWave', { wave: state.wave });
  const statLine = `${waveStr}   ·   ${t('p12.pauseTime', { time: formatClock(state.time) })}   ·   🍊 ×${state.sides.player.oranges}`;
  drawText(c, statLine, px + 104, sy + 54, 14, PALETTE.inkSoft, 'left', 800);

  // Collected Loot Summary
  const ly = sy + 94;
  round(c, px + 26, ly, pw - 52, 184, 16, '#fff7e5', PALETTE.woodLight, 1.8);
  drawText(c, `🎒 ${t('p12.pauseLoot')}`, px + 42, ly + 24, 15, PALETTE.ink, 'left', 900);

  const items = collectShelfChips(state.sides.player.loot, state.sides.player.ingredientLoot, state.sides.player.villageLoot, state.sides.player.endlessCrests);
  if (items.length === 0) {
    drawText(c, t('p12.pauseEmpty'), px + pw / 2, ly + 102, 15, PALETTE.muted, 'center', 700);
  } else {
    drawChipGrid(c, items.slice(0, 8), px + 40, ly + 46, pw - 80, 4);
  }

  // Footer Actions
  const fy = py + ph - 82;
  drawButton(c, hits, 'modal:resume', px + 28, fy, 240, 56, `▶ ${t('p12.resume')}`, {
    ...BTN_STYLES.teal,
    radius: 16,
    fontSize: 18,
  });
  drawButton(c, hits, 'modal:open-settings', px + 282, fy, 128, 56, `⚙ ${t('p12.settings')}`, {
    ...BTN_STYLES.cream,
    radius: 16,
    fontSize: 16,
  });
  drawButton(c, hits, 'modal:surrender', px + 424, fy, 168, 56, t(state.endless ? 'p13.settleEndless' : 'p12.surrender'), {
    ...BTN_STYLES.coral,
    radius: 16,
    fontSize: 15,
  });
}

function drawEndlessOfferModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  settlement: SettlementMeta,
): void {
  const result = state.standardResult ?? state.result;
  const pw = 640, ph = 474;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;
  drawWoodPanel(c, px, py, pw, ph, 26, '#fff8e8', '#70441e');
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Emblem
  drawSpriteContain(c, 'ui_endless_crest', px + pw / 2 - 52, py - 38, 104, 104);
  drawText(c, t('p13.endlessOfferTitle'), px + pw / 2, py + 88, 25, '#6a2e8c', 'center', 900);

  // Banked badge
  round(c, px + 88, py + 114, pw - 176, 32, 16, '#dff5d8', '#3c8532', 1.8);
  drawText(c, `✓ ${t('p13.endlessBanked')}`, px + pw / 2, py + 131, 13, '#265c1f', 'center', 800);

  // Story box
  round(c, px + 36, py + 160, pw - 72, 118, 16, '#f6e7c7', PALETTE.woodLight, 1.8);
  drawWrappedText(c, t('p13.endlessOfferBody'), px + 54, py + 174, pw - 108, 14, 21, PALETTE.inkSoft, 'left', 700, 3);
  round(c, px + 140, py + 236, pw - 280, 30, 15, '#593373', 'transparent', 0);
  drawText(c, '×1.25  →  ×1.56  →  ×1.95  →  …', px + pw / 2, py + 252, 14, '#ffe9a3', 'center', 900);

  // Banked Reward Strip
  const crests = result?.endlessCrests ?? STANDARD_VICTORY_CRESTS;
  const pills = [
    `★ ${t('p13.rankBanked')}`,
    `🪙 +${result?.coins ?? 0}`,
    ...(settlement.ticketAwarded ? ['🎟️ +1'] : []),
    ...(crests > 0 ? [`✨ +${crests}`] : []),
  ];
  const rw = Math.floor((pw - 72 - (pills.length - 1) * 10) / pills.length);
  pills.forEach((label, i) => {
    const x = px + 36 + i * (rw + 10);
    round(c, x, py + 296, rw, 48, 14, '#fff2d2', PALETTE.woodMid, 1.8);
    drawText(c, label, x + rw / 2, py + 321, 14, PALETTE.ink, 'center', 900);
  });

  // Buttons
  const fy = py + ph - 84;
  drawButton(c, hits, 'modal:decline-endless', px + 40, fy, 266, 58, t('p13.declineEndless'), {
    ...BTN_STYLES.cream,
    radius: 16,
    fontSize: 17,
  });
  drawButton(c, hits, 'modal:enter-endless', px + pw - 306, fy, 266, 58, `♾️ ${t('p13.enterEndless')}`, {
    ...BTN_STYLES.gold,
    radius: 16,
    fontSize: 18,
  });
}

function drawResultModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  profile: Profile,
  settlement: SettlementMeta,
): void {
  const result = state.result;
  if (!result) return;
  const endless = Boolean(result.endless);
  const won = endless || result.winner === 'player';
  const rank = getRank(profile.stars);
  const coins = won
    ? (endless && state.standardResult ? state.standardResult.coins + (result.endlessCoins ?? 0) : result.coins)
    : 0;
  const loot = won
    ? (endless && state.standardResult ? [...state.standardResult.loot, ...(result.endlessLoot ?? [])] : result.loot)
    : [];
  const crests = won
    ? (endless && state.standardResult ? (state.standardResult.endlessCrests ?? 0) + (result.endlessCrests ?? 0) : (result.endlessCrests ?? 0))
    : 0;
  const guardianStars = endless ? 3 : won ? Math.min(3, Math.max(1, Math.floor(state.sides.player.oranges))) : 0;

  const pw = 760, ph = 590;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2 + 10;
  drawWoodPanel(c, px, py, pw, ph, 26, PALETTE.cream, won ? '#66431d' : '#5e352c');
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Winged Shield Header
  const shieldId = won ? 'ui_victory_shield_wings' : 'ui_defeat_shield_wings';
  drawSpriteContain(c, shieldId, px + pw / 2 - 120, py - 58, 240, 114);
  const headline = endless ? t('p13.endlessVictory') : won ? t('p12.victory') : t('p12.defeat');
  drawText(c, headline, px + pw / 2, py + 62, 30, won ? '#2e763f' : '#b23e2f', 'center', 900);

  // 3 Guardian Stars
  for (let i = 0; i < 3; i++) {
    const lit = i < guardianStars;
    const sx = px + pw / 2 - 64 + i * 44;
    if (!drawSpriteContain(c, lit ? 'ui_victory_star_lit' : 'ui_victory_star_dim', sx, py + 82, 40, 40)) {
      drawText(c, lit ? '★' : '☆', sx + 20, py + 102, 28, lit ? '#f0b429' : '#c9bca5', 'center', 900);
    }
  }

  // Rank & Progress Strip
  const ry = py + 132;
  round(c, px + 32, ry, pw - 64, 58, 16, '#f3e2be', PALETTE.woodLight, 1.8);
  const deltaStr = settlement.resultStars > 0
    ? `+${settlement.resultStars}★`
    : settlement.resultStars < 0
      ? `${settlement.resultStars}★`
      : '🛡️ 0★';
  drawText(c, `${t(`rank.${rank.index}`)}  (${profile.stars}★)`, px + 50, ry + 20, 16, PALETTE.ink, 'left', 900);
  drawText(c, deltaStr, px + pw - 50, ry + 20, 18, settlement.resultStars > 0 ? '#2f7a42' : PALETTE.inkSoft, 'right', 900);

  const nextRank = RANKS[rank.index + 1];
  const progressMax = nextRank ? nextRank.minStars - rank.minStars : 1;
  const progress = nextRank ? Math.min(progressMax, Math.max(0, profile.stars - rank.minStars)) : 1;
  drawProgressBar(c, px + 50, ry + 36, pw - 220, 12, progress / Math.max(1, progressMax), '#f2b838', 'rgba(72,46,24,0.18)', PALETTE.woodDark);
  drawText(c, nextRank ? `${progress}/${progressMax}★` : 'MAX', px + pw - 50, ry + 42, 12, PALETTE.inkSoft, 'right', 800);

  // Middle Body: Battle Report toggle OR Rewards + MVP
  const bodyY = ry + 70;
  const bodyH = 224;
  if (settlement.statsOpen) {
    round(c, px + 32, bodyY, pw - 64, bodyH, 16, '#fff7e5', PALETTE.woodLight, 1.8);
    drawText(c, `📊 ${t('p12.report')}`, px + 50, bodyY + 24, 17, PALETTE.ink, 'left', 900);
    const boardCount = state.units.filter(u => u.side === 'player' && u.location.zone === 'board').length;
    const rows: Array<[string, string]> = [
      [t('p6.time'), formatClock(result.elapsed)],
      [t('p13.damage'), formatCompactNumber(state.sides.player.damage)],
      [t('p13.kills'), String(state.sides.player.kills)],
      [t('p6.lineup', { count: boardCount }), `${t(`map.${state.mapId}`)}`],
      ...(endless ? [[t('p13.endlessWave', { wave: result.endlessWave ?? state.wave }), `${t('p13.endlessRecord', { wave: result.endlessWave ?? state.wave, best: Math.max(result.endlessWave ?? state.wave, profile.bestEndlessWave ?? 0) })}`] as [string, string]] : []),
    ];
    rows.forEach(([k, v], i) => {
      const rowY = bodyY + 54 + i * 32;
      drawText(c, k, px + 56, rowY, 14, PALETTE.inkSoft, 'left', 800);
      drawText(c, v, px + pw - 56, rowY, 15, PALETTE.ink, 'right', 900);
    });
  } else {
    // Left half: Rewards Shelf
    const leftW = 424;
    round(c, px + 32, bodyY, leftW, bodyH, 16, '#fff7e5', PALETTE.woodLight, 1.8);
    drawText(c, `🎁 ${t('p13.treasureShelf')}`, px + 48, bodyY + 22, 15, PALETTE.ink, 'left', 900);

    const chips: ShelfChip[] = [
      { icon: 'ui_coin_gold', label: t('profile.coins'), count: `+${coins}` },
      ...(settlement.ticketAwarded ? [{ icon: 'ui_ticket_gacha', label: t('p5.tickets'), count: '+1' }] : []),
      ...collectShelfChips(loot, result.ingredientLoot, result.villageLoot, crests),
    ];
    drawChipGrid(c, chips.slice(0, 6), px + 44, bodyY + 42, leftW - 24, 3);

    // Right half: MVP Spotlight
    const mx = px + 32 + leftW + 14;
    const mw = pw - 64 - leftW - 14;
    round(c, mx, bodyY, mw, bodyH, 16, '#fff4d6', PALETTE.goldDark, 2);
    drawSpriteContain(c, 'ui_mvp_crown', mx + mw / 2 - 20, bodyY + 8, 40, 34);
    drawText(c, t('p6.mvp'), mx + mw / 2, bodyY + 52, 14, '#8a4c10', 'center', 900);
    if (result.mvp) {
      const mvpSprite = result.mvp.awakened ? `${result.mvp.kind}_awakened` : result.mvp.kind;
      if (!drawSpriteContain(c, mvpSprite, mx + mw / 2 - 38, bodyY + 66, 76, 76)) {
        drawSpriteContain(c, result.mvp.kind, mx + mw / 2 - 38, bodyY + 66, 76, 76);
      }
      const mvpName = t(`${HEROES[result.mvp.kind] ? 'hero' : 'unit'}.${result.mvp.kind}`);
      drawText(c, `${mvpName} Lv.${result.mvp.level}`, mx + mw / 2, bodyY + 158, 15, PALETTE.ink, 'center', 900);
      drawText(c, `⚔️ ${formatCompactNumber(result.mvp.damage)}   ·   🎯 ${result.mvp.kills}`, mx + mw / 2, bodyY + 184, 13, PALETTE.inkSoft, 'center', 800);
    } else {
      drawText(c, t('p6.noMvp'), mx + mw / 2, bodyY + 132, 13, PALETTE.muted, 'center', 700);
    }
  }

  // Zeigarnik Next-Goal Hook Bar
  const hook = computeNextGoalHook(profile);
  const hy = bodyY + bodyH + 14;
  if (hook) {
    round(c, px + 32, hy, pw - 64, 54, 14, '#f8ebd0', '#c78c36', 2);
    drawText(c, formatNextGoalText(hook), px + 48, hy + 19, 13.5, '#6b3b0e', 'left', 800);
    drawProgressBar(c, px + 48, hy + 34, pw - 96, 10, Math.max(0.06, hook.percent / 100), '#f2b838', 'rgba(72,46,24,0.16)', PALETTE.woodDark);
  }

  // Footer Actions
  const fy = py + ph - 76;
  drawButton(c, hits, 'modal:toggle-stats', px + 32, fy, 136, 54, settlement.statsOpen ? t('p12.closeStats') : `📊 ${t('p12.stats')}`, {
    ...BTN_STYLES.cream,
    radius: 15,
    fontSize: 15,
  });
  drawButton(c, hits, 'modal:menu', px + 184, fy, 240, 54, t('p12.return'), {
    ...BTN_STYLES.cream,
    radius: 15,
    fontSize: 17,
  });
  drawButton(c, hits, 'modal:again', px + pw - 32 - 280, fy, 280, 54, won ? t('p12.continue') : t('p12.retry'), {
    ...BTN_STYLES.green,
    radius: 15,
    fontSize: 19,
  });
}

function drawRecipesModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  tab: 'heroes' | 'basics',
  scroll: ScrollRegion,
): ModalLayoutInfo {
  const lang = getLanguage();
  const pw = 880, ph = 590;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;
  drawWoodPanel(c, px, py, pw, ph, 24, PALETTE.cream, PALETTE.woodDark);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Header
  drawSpriteContain(c, 'ui_compendium_book', px + 24, py + 16, 46, 46);
  drawText(c, t('p5.page.compendium'), px + 80, py + 32, 24, PALETTE.ink, 'left', 900);
  drawText(c, t('recipe.subtitle'), px + 80, py + 56, 13, PALETTE.inkSoft, 'left', 700);
  drawButton(c, hits, 'modal:close', px + pw - 56, py + 18, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // Tabs
  const ty = py + 80;
  drawButton(c, hits, 'modal:recipes-tab:heroes', px + 28, ty, 200, 42, lang === 'zh-CN' ? '🦸 12 位英雄配方' : '🦸 12 Hero Recipes', {
    ...(tab === 'heroes' ? BTN_STYLES.gold : BTN_STYLES.cream),
    radius: 13,
    fontSize: 15,
  });
  drawButton(c, hits, 'modal:recipes-tab:basics', px + 240, ty, 200, 42, lang === 'zh-CN' ? '🐾 5 位基础萌宠' : '🐾 5 Basic Pets', {
    ...(tab === 'basics' ? BTN_STYLES.gold : BTN_STYLES.cream),
    radius: 13,
    fontSize: 15,
  });
  if (tab === 'heroes') {
    drawText(c, lang === 'zh-CN' ? '↕ 上下滑动查看全部 12 位英雄' : '↕ Scroll to view all 12 heroes', px + pw - 30, ty + 22, 13, PALETTE.inkSoft, 'right', 700);
  }

  // Scrollable Viewport
  const vx = px + 26, vy = ty + 54, vw = pw - 52, vh = ph - 158;
  round(c, vx, vy, vw, vh, 16, '#fff8ea', PALETTE.woodLight, 1.8);

  c.save();
  c.beginPath();
  c.rect(vx + 2, vy + 2, vw - 4, vh - 4);
  c.clip();

  let contentH = 0;
  if (tab === 'heroes') {
    const cols = 2;
    const gap = 12;
    const cw = Math.floor((vw - 24 - gap) / cols);
    const ch = 104;
    RECIPES.forEach((r, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const rx = vx + 12 + col * (cw + gap);
      const ry = vy + 12 + row * (ch + gap) - scroll.offset;
      if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

      round(c, rx, ry, cw, ch, 14, '#f7ebd1', PALETTE.woodLight, 1.6);
      // Equation: part0 + part1 -> hero
      drawSpriteContain(c, r.parts[0], rx + 10, ry + 10, 42, 42);
      drawText(c, '+', rx + 58, ry + 32, 16, PALETTE.inkSoft, 'center', 900);
      drawSpriteContain(c, r.parts[1], rx + 66, ry + 10, 42, 42);
      drawText(c, '→', rx + 116, ry + 32, 16, PALETTE.inkSoft, 'center', 900);
      drawSpriteContain(c, r.hero, rx + 126, ry + 6, 50, 50);

      const st = getBaseUnitStats(r.hero, 1);
      drawText(c, t(`hero.${r.hero}`), rx + 184, ry + 22, 16, PALETTE.ink, 'left', 900);
      drawText(c, `⚔️${Math.round(st.damage)}  ⚡${Number(st.rate.toFixed(2))}/s  🎯${st.range}`, rx + 184, ry + 44, 12, PALETTE.inkSoft, 'left', 800);
      drawWrappedText(c, `★ ${t(`skill.${r.hero}`)}: ${t(`skill.${r.hero}.desc`, { charge: st.charge })}`, rx + 14, ry + 62, cw - 28, 11, 14.5, PALETTE.inkSoft, 'left', 600, 2);
    });
    const rows = Math.ceil(RECIPES.length / cols);
    contentH = 24 + rows * (ch + gap);
  } else {
    const basicIds = ['hamster', 'squirrel', 'hedgehog', 'corgi', 'bee'];
    const ch = 84;
    const gap = 10;
    basicIds.forEach((id, idx) => {
      const rx = vx + 14;
      const ry = vy + 14 + idx * (ch + gap) - scroll.offset;
      round(c, rx, ry, vw - 28, ch, 14, '#f7ebd1', PALETTE.woodLight, 1.6);
      drawSpriteContain(c, id, rx + 14, ry + 12, 60, 60);
      drawText(c, t(`unit.${id}`), rx + 88, ry + 28, 17, PALETTE.ink, 'left', 900);
      if (id === 'bee') {
        drawText(c, t('inspect.bee', { time: 7, amount: 5 }), rx + 88, ry + 54, 13, PALETTE.inkSoft, 'left', 700);
      } else {
        const lv1 = getBaseUnitStats(id, 1);
        const lv3 = getBaseUnitStats(id, 3);
        drawText(
          c,
          `Lv.1: ⚔️${Math.round(lv1.damage)} ⚡${Number(lv1.rate.toFixed(2))}/s 🎯${lv1.range}    →    Lv.3: ⚔️${Math.round(lv3.damage)} ⚡${Number(lv3.rate.toFixed(2))}/s`,
          rx + 88,
          ry + 54,
          13,
          PALETTE.inkSoft,
          'left',
          700,
        );
      }
    });
    contentH = 28 + basicIds.length * (ch + gap);
  }

  c.restore();
  scroll.setContentBounds(contentH, vh);

  // Scrollbar thumb when scrollable
  if (scroll.maxOffset > 4) {
    const trackH = vh - 24;
    const thumbH = Math.max(36, trackH * (vh / contentH));
    const thumbY = vy + 12 + (scroll.offset / scroll.maxOffset) * (trackH - thumbH);
    round(c, vx + vw - 10, thumbY, 6, thumbH, 3, 'rgba(122,82,48,0.45)', 'transparent', 0);
  }

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

function drawSettingsModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  inBattle: boolean,
): ModalLayoutInfo {
  const lang = getLanguage();
  const pw = 560, ph = 456;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;
  drawWoodPanel(c, px, py, pw, ph, 24, PALETTE.cream, PALETTE.woodDark);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  drawText(c, `⚙ ${t('p5.page.settings')}`, px + 32, py + 38, 25, PALETTE.ink, 'left', 900);
  drawButton(c, hits, 'modal:close', px + pw - 56, py + 18, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // Music volume slider
  const sx = px + 180, sw = pw - 236, sh = 26;
  const my = py + 94;
  drawText(c, lang === 'zh-CN' ? '🎵 背景音乐' : '🎵 Music', px + 36, my + 13, 16, PALETTE.ink, 'left', 800);
  drawSlider(c, sx, my, sw, sh, profile.settings.musicVolume);
  drawText(c, `${Math.round(profile.settings.musicVolume * 100)}%`, sx + sw + 34, my + 13, 14, PALETTE.inkSoft, 'center', 800);
  hits.add({ id: 'settings:music', x: sx - 10, y: my - 10, w: sw + 20, h: sh + 20 });

  // Sound FX volume slider
  const sfxY = py + 152;
  drawText(c, lang === 'zh-CN' ? '🔊 游戏音效' : '🔊 Sound FX', px + 36, sfxY + 13, 16, PALETTE.ink, 'left', 800);
  drawSlider(c, sx, sfxY, sw, sh, profile.settings.soundVolume);
  drawText(c, `${Math.round(profile.settings.soundVolume * 100)}%`, sx + sw + 34, sfxY + 13, 14, PALETTE.inkSoft, 'center', 800);
  hits.add({ id: 'settings:sound', x: sx - 10, y: sfxY - 10, w: sw + 20, h: sh + 20 });

  // Damage Numbers toggle
  const dmgY = py + 216;
  drawText(c, lang === 'zh-CN' ? '💥 伤害浮字' : '💥 Damage Numbers', px + 36, dmgY + 20, 16, PALETTE.ink, 'left', 800);
  const dmgOn = profile.settings.showDamageNumbers;
  drawButton(c, hits, 'settings:damage', px + pw - 148, dmgY, 114, 42, dmgOn ? (lang === 'zh-CN' ? '已开启' : 'ON') : (lang === 'zh-CN' ? '已关闭' : 'OFF'), {
    ...(dmgOn ? BTN_STYLES.green : BTN_STYLES.muted),
    radius: 14,
    fontSize: 15,
  });

  // Language switch
  const langY = py + 278;
  drawText(c, lang === 'zh-CN' ? '🌐 显示语言' : '🌐 Language', px + 36, langY + 20, 16, PALETTE.ink, 'left', 800);
  drawButton(c, hits, 'settings:lang', px + pw - 178, langY, 144, 42, lang === 'zh-CN' ? '简体中文 ⇄ EN' : 'English ⇄ 中文', {
    ...BTN_STYLES.cream,
    radius: 14,
    fontSize: 14,
  });

  // Replay Tutorial button (outside battle)
  const botY = py + ph - 82;
  if (!inBattle) {
    drawButton(c, hits, 'settings:replay-tutorial', px + 36, botY, 240, 52, lang === 'zh-CN' ? '🎓 重玩新手教学' : '🎓 Replay Tutorial', {
      ...BTN_STYLES.gold,
      radius: 15,
      fontSize: 16,
    });
  }
  drawButton(c, hits, 'modal:close', px + pw - 180, botY, 146, 52, lang === 'zh-CN' ? '完成' : 'Done', {
    ...BTN_STYLES.teal,
    radius: 15,
    fontSize: 17,
  });

  return {
    musicSlider: { x: sx, y: my, w: sw, h: sh },
    soundSlider: { x: sx, y: sfxY, w: sw, h: sh },
  };
}

function drawSlider(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number): void {
  const v = Math.max(0, Math.min(1, value));
  drawProgressBar(c, x, y + h / 2 - 6, w, 12, v, '#5fb098', 'rgba(72,46,24,0.18)', PALETTE.woodDark);
  const kx = x + v * w;
  round(c, kx - 13, y + h / 2 - 13, 26, 26, 13, '#fff6df', PALETTE.woodDark, 2.5);
}

interface ShelfChip {
  icon: string;
  label: string;
  count: string;
}

function collectShelfChips(
  loot: readonly string[] | undefined,
  ingredients: readonly string[] | undefined,
  village: readonly string[] | undefined,
  crests: number | undefined,
): ShelfChip[] {
  const chips: ShelfChip[] = [];
  if (crests && crests > 0) {
    chips.push({ icon: 'ui_endless_crest', label: t('p17.crests'), count: `×${crests}` });
  }
  const fragMap = new Map<string, number>();
  for (const id of loot ?? []) fragMap.set(id, (fragMap.get(id) ?? 0) + 1);
  for (const [id, n] of fragMap) {
    chips.push({ icon: WEAPONS[id] ? `weapon_${id}` : 'ui_weapon_fragment', label: t(`fragment.${id}`), count: `×${n}` });
  }
  for (const id of VILLAGE_RESOURCE_IDS) {
    const n = (village ?? []).filter(v => v === id).length;
    if (n > 0) chips.push({ icon: id as VillageResourceId, label: t(id === 'res_onsen_wood' ? 'p16.wood' : 'p16.essence'), count: `×${n}` });
  }
  const ingCounts = new Map<IngredientId, number>();
  for (const id of ingredients ?? []) if (isIngredientId(id)) ingCounts.set(id, (ingCounts.get(id) ?? 0) + 1);
  for (const id of INGREDIENT_IDS) {
    const n = ingCounts.get(id) ?? 0;
    if (n > 0) chips.push({ icon: id, label: t(`ingredient.${id}`), count: `×${n}` });
  }
  return chips;
}

function drawChipGrid(c: CanvasRenderingContext2D, chips: readonly ShelfChip[], x: number, y: number, w: number, cols: number): void {
  const gap = 8;
  const cw = Math.floor((w - (cols - 1) * gap) / cols);
  const ch = 74;
  chips.forEach((chip, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = x + col * (cw + gap);
    const cy = y + row * (ch + gap);
    round(c, cx, cy, cw, ch, 12, '#f6e7c8', PALETTE.woodLight, 1.4);
    if (!drawSpriteContain(c, chip.icon, cx + (cw - 36) / 2, cy + 6, 36, 36)) {
      drawSpriteContain(c, 'ui_weapon_fragment', cx + (cw - 36) / 2, cy + 6, 36, 36);
    }
    drawText(c, chip.count, cx + cw / 2, cy + 52, 13, '#80410e', 'center', 900);
    const shortLabel = chip.label.length > 6 ? `${chip.label.slice(0, 6)}…` : chip.label;
    drawText(c, shortLabel, cx + cw / 2, cy + 66, 10, PALETTE.inkSoft, 'center', 700);
  });
}

function formatNextGoalText(hook: NextGoalHook): string {
  if (hook.kind === 'feature') {
    const name = t(`p19.feature.${hook.id}`);
    return hook.target === 1 && hook.current === 0
      ? t('p19.hook.featureMatch', { name })
      : t('p19.hook.featureStars', { name, need: Math.max(1, hook.target - hook.current), current: hook.current, target: hook.target });
  }
  if (hook.kind === 'gacha_ticket') return t('p19.hook.gacha');
  if (hook.kind === 'weapon') {
    return t('p19.hook.weapon', { name: t(`weapon.${hook.id}`), need: Math.max(1, hook.target - hook.current), current: hook.current, target: hook.target });
  }
  if (hook.kind === 'village') {
    return t('p19.hook.village', { name: t(`facility.${hook.id}`), pct: hook.percent });
  }
  return t('p19.hook.kitchen', { name: t(`broth.${hook.id}`), pct: hook.percent });
}
