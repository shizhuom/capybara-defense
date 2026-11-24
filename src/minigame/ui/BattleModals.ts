import { ENEMIES } from '../../config/enemies';
import { HEROES } from '../../config/heroes';
import { INGREDIENT_IDS, isIngredientId, type IngredientId } from '../../config/kitchen';
import { STANDARD_VICTORY_CRESTS } from '../../config/medallions';
import { RANKS, getRank } from '../../config/ranks';
import { RECIPES } from '../../config/recipes';
import { VILLAGE_RESOURCE_IDS, type VillageResourceId } from '../../config/village';
import { WEAPONS } from '../../config/weapons';
import { computeNextGoalHook, type FeatureId, type NextGoalHook } from '../../core/FeatureUnlocks';
import { getBaseUnitStats } from '../../core/UnitStats';
import { formatCompactNumber } from '../../core/formatNumber';
import type { BattleState, Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import type { ViewportMetrics } from '../../platform/types';
import { INK, round } from '../../render/StickerArt';
import {
  BTN_STYLES,
  PALETTE,
  ScrollRegion,
  drawButton,
  drawHinokiBoard,
  drawHoneyOakTab,
  drawIconLabel,
  drawIvorySlab,
  drawMatchaSignboard,
  drawProgressBar,
  drawSpriteContain,
  drawSunburst,
  drawText,
  drawWrappedText,
  drawYuzuCloseButton,
  formatClock,
  type UiHitManager,
} from './CanvasUI';
import {
  drawArmoryModal,
  drawMarketModal,
  drawScrollbar,
  type ArmoryState,
  type MarketState,
} from './MetaArmoryMarket';
import {
  drawKitchenModal,
  drawVillageModal,
  type KitchenUiState,
  type VillageUiState,
} from './MetaVillageKitchen';
import {
  drawLeaderboardModal,
  drawMedallionsModal,
  drawProfileModal,
  type LeaderboardUiState,
} from './MetaMedallionsRanks';
import {
  drawBattleLessonModal,
  drawOnboardingUnlockModal,
} from './OnboardingModals';
import { drawDevToolsModal } from './DevToolsModal';

export type MinigameModalKind =
  | null
  | 'pause'
  | 'endless-offer'
  | 'result'
  | 'recipes'
  | 'settings'
  | 'armory'
  | 'market'
  | 'village'
  | 'kitchen'
  | 'medallions'
  | 'leaderboard'
  | 'profile'
  | 'onboard'
  | 'battle-lesson'
  | 'dev';

export type CompendiumTab = 'heroes' | 'basics' | 'enemies' | 'rules';

export interface SettlementMeta {
  savedResult: boolean;
  resultStars: number;
  previousRank: number;
  newWeapons: readonly string[];
  ticketAwarded: boolean;
  statsOpen: boolean;
  adDoubleCoinsAvailable: boolean;
  adDoubleClaimed: boolean;
  adReviveAvailable: boolean;
}

export interface ModalDrawContext {
  modal: Exclude<MinigameModalKind, null>;
  profile: Profile;
  state: BattleState | null;
  settlement: SettlementMeta;
  recipesTab: CompendiumTab;
  scroll: ScrollRegion;
  armory: ArmoryState;
  market: MarketState;
  village: VillageUiState;
  kitchen: KitchenUiState;
  leaderboard: LeaderboardUiState;
  onboardingFeature: FeatureId | null;
  battleLesson: 'prop_battle' | 'endless_battle' | null;
  devUnlocked: boolean;
  isTestSave: boolean;
  elapsed: number;
  viewport: ViewportMetrics;
}

export interface ModalLayoutInfo {
  scrollViewport?: { x: number; y: number; w: number; h: number };
  musicSlider?: { x: number; y: number; w: number; h: number };
  soundSlider?: { x: number; y: number; w: number; h: number };
}

/** Draws the active P18 Canvas modal over a dimmed backdrop and registers all hit targets. */
export function drawActiveModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  ctx: ModalDrawContext,
): ModalLayoutInfo {
  const { left, top, width, height } = ctx.viewport.visible;
  c.fillStyle = 'rgba(22,12,5,0.68)';
  c.fillRect(left - 2, top - 2, width + 4, height + 4);
  hits.add({ id: 'modal:backdrop', x: left, y: top, w: width, h: height });

  switch (ctx.modal) {
    case 'pause':
      if (ctx.state) drawPauseModal(c, hits, ctx.state);
      return {};
    case 'endless-offer':
      if (ctx.state) drawEndlessOfferModal(c, hits, ctx.state, ctx.settlement, ctx.elapsed);
      return {};
    case 'result':
      if (ctx.state) drawResultModal(c, hits, ctx.state, ctx.profile, ctx.settlement, ctx.elapsed);
      return {};
    case 'recipes':
      return drawRecipesModal(c, hits, ctx.recipesTab, ctx.scroll);
    case 'settings':
      return drawSettingsModal(c, hits, ctx.profile, !!ctx.state, ctx.devUnlocked);
    case 'dev':
      drawDevToolsModal(c, hits, ctx.profile, ctx.state, ctx.isTestSave);
      return {};
    case 'armory':
      return drawArmoryModal(c, hits, ctx.profile, ctx.armory, ctx.scroll);
    case 'market':
      return drawMarketModal(c, hits, ctx.profile, ctx.market, ctx.scroll);
    case 'village':
      return drawVillageModal(c, hits, ctx.profile, ctx.village, ctx.scroll);
    case 'kitchen':
      return drawKitchenModal(c, hits, ctx.profile, ctx.kitchen, ctx.scroll);
    case 'medallions':
      drawMedallionsModal(c, hits, ctx.profile);
      return {};
    case 'leaderboard':
      return drawLeaderboardModal(c, hits, ctx.profile, ctx.leaderboard, ctx.scroll);
    case 'profile':
      return drawProfileModal(c, hits, ctx.profile, ctx.scroll);
    case 'onboard':
      if (ctx.onboardingFeature) drawOnboardingUnlockModal(c, hits, ctx.onboardingFeature);
      return {};
    case 'battle-lesson':
      if (ctx.battleLesson) drawBattleLessonModal(c, hits, ctx.battleLesson);
      return {};
  }
}

function drawPauseModal(c: CanvasRenderingContext2D, hits: UiHitManager, state: BattleState): void {
  const pw = 748, ph = 524;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2 + 16;

  // Peeking pause mascot above hinoki board
  drawSpriteContain(c, 'ui_pause_peek_capy', px + 26, py - 66, 114, 114);
  drawHinokiBoard(c, px, py, pw, ph, 26);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  drawMatchaSignboard(c, 640, py - 32, t('p12.pauseTitle'), undefined, 280);
  drawYuzuCloseButton(c, hits, 'modal:resume', px + pw - 20, py - 2, 26);

  // Map & Battle Status ivory slab
  const sy = py + 44;
  drawIvorySlab(c, px + 26, sy, pw - 52, 92, 18);
  drawSpriteContain(c, 'ui_map_sign', px + 40, sy + 14, 64, 64);
  drawText(c, t(`map.${state.mapId}`), px + 116, sy + 30, 22, PALETTE.ink, 'left', 900);
  const waveStr = state.endless ? t('p13.endlessWave', { wave: state.wave }) : t('p12.pauseWave', { wave: state.wave });
  let statX = px + 116;
  statX += drawIconLabel(c, state.endless ? 'ui_endless_emblem' : 'ui_wave_horn', waveStr, statX, sy + 64, 24, 17, PALETTE.inkSoft) + 20;
  statX += drawIconLabel(c, 'ui_clock_sand', formatClock(state.time), statX, sy + 64, 22, 17, PALETTE.inkSoft) + 20;
  drawIconLabel(c, 'orange', `×${state.sides.player.oranges}`, statX, sy + 64, 24, 18, '#a64d0c');

  // Loot Shelf ivory slab
  const ly = sy + 106;
  drawIvorySlab(c, px + 26, ly, pw - 52, 268, 18, '#fffdf7', '#f7e9cb');
  drawIconLabel(c, 'ui_harvest_basket', t('p12.pauseLoot'), px + 44, ly + 28, 28, 19, PALETTE.ink);

  const items = collectShelfChips(state.sides.player.loot, state.sides.player.ingredientLoot, state.sides.player.villageLoot, state.sides.player.endlessCrests);
  if (items.length === 0) {
    drawText(c, t('p12.pauseEmpty'), px + pw / 2, ly + 150, 18, PALETTE.muted, 'center', 700);
  } else {
    drawChipGrid(c, items.slice(0, 8), px + 42, ly + 52, pw - 84, 4);
  }

  // Footer action buttons
  const fy = py + ph - 82;
  drawButton(c, hits, 'modal:resume', px + 26, fy, 246, 60, `▶ ${t('p12.resume')}`, {
    ...BTN_STYLES.teal,
    radius: 16,
    fontSize: 20,
  });
  drawButton(c, hits, 'modal:open-profile', px + 284, fy, 122, 60, t('p12.profile'), {
    ...BTN_STYLES.cream,
    radius: 16,
    fontSize: 18,
  });
  drawButton(c, hits, 'modal:open-settings', px + 418, fy, 122, 60, t('p12.settings'), {
    ...BTN_STYLES.cream,
    radius: 16,
    fontSize: 18,
  });
  drawButton(c, hits, 'modal:surrender', px + 552, fy, 170, 60, t(state.endless ? 'p13.settleEndless' : 'p12.surrender'), {
    ...BTN_STYLES.coral,
    radius: 16,
    fontSize: 18,
  });
}

function drawEndlessOfferModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  settlement: SettlementMeta,
  elapsed: number,
): void {
  const result = state.standardResult ?? state.result;
  const pw = 740, ph = 524;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2 + 18;

  drawSunburst(c, 640, py + 12, 320, elapsed, 'rgba(218,162,255,0.24)');
  drawHinokiBoard(c, px, py, pw, ph, 26);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  if (!drawSpriteContain(c, 'ui_endless_emblem', px + pw / 2 - 64, py - 56, 128, 128)) {
    drawSpriteContain(c, 'ui_endless_crest', px + pw / 2 - 56, py - 48, 112, 112);
  }

  // Inner warm ivory card
  drawIvorySlab(c, px + 24, py + 58, pw - 48, ph - 152, 20);
  drawText(c, t('p13.endlessOfferTitle'), px + pw / 2, py + 94, 28, '#5f2685', 'center', 900);

  round(c, px + 76, py + 122, pw - 152, 38, 19, '#dff5d8', '#3c8532', 2);
  drawText(c, `✓ ${t('p13.endlessBanked')}`, px + pw / 2, py + 142, 16, '#23591c', 'center', 900);

  round(c, px + 44, py + 174, pw - 88, 134, 16, '#f6e7c7', PALETTE.woodLight, 2);
  drawWrappedText(c, t('p13.endlessOfferBody'), px + 62, py + 188, pw - 124, 17, 24, PALETTE.ink, 'left', 700, 3);
  round(c, px + 148, py + 266, pw - 296, 34, 17, '#593373', '#c89cf0', 2);
  drawText(c, '×1.25  →  ×1.56  →  ×1.95  →  …', px + pw / 2, py + 284, 16.5, '#ffe9a3', 'center', 900);

  const crests = result?.endlessCrests ?? STANDARD_VICTORY_CRESTS;
  const pills: Array<{ icon: string; text: string }> = [
    { icon: 'ui_star_rank', text: t('p13.rankBanked') },
    { icon: 'ui_coin_gold', text: `+${result?.coins ?? 0}` },
    ...(settlement.ticketAwarded ? [{ icon: 'ui_ticket_gacha', text: '+1' }] : []),
    ...(crests > 0 ? [{ icon: 'ui_endless_crest', text: `+${crests}` }] : []),
  ];
  const rw = Math.floor((pw - 88 - (pills.length - 1) * 10) / pills.length);
  pills.forEach((p, i) => {
    const x = px + 44 + i * (rw + 10);
    round(c, x, py + 324, rw, 56, 15, '#fff5dc', '#8a5d2e', 2);
    drawSpriteContain(c, p.icon, x + 10, py + 336, 32, 32);
    drawText(c, p.text, x + 46 + (rw - 52) / 2, py + 353, 17, PALETTE.ink, 'center', 900);
  });

  const fy = py + ph - 78;
  drawButton(c, hits, 'modal:decline-endless', px + 30, fy, 320, 60, t('p13.declineEndless'), {
    ...BTN_STYLES.cream,
    radius: 16,
    fontSize: 20,
  });
  drawButton(c, hits, 'modal:enter-endless', px + pw - 350, fy, 320, 60, t('p13.enterEndless'), {
    ...BTN_STYLES.gold,
    radius: 16,
    fontSize: 21,
    icon: 'ui_endless_emblem',
  });
}

function drawResultModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  profile: Profile,
  settlement: SettlementMeta,
  elapsed: number,
): void {
  const result = state.result;
  if (!result) return;
  const zh = getLanguage() === 'zh-CN';
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

  const pw = 884, ph = 612;
  const px = (1280 - pw) / 2, py = 86;

  // Radial victory sunburst rays behind shield & board!
  if (won) {
    drawSunburst(c, 640, py + 10, 380, elapsed, 'rgba(255,222,110,0.30)');
  }

  drawHinokiBoard(c, px, py, pw, ph, 26);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Winged Victory / Defeat Shield straddling top edge
  const shieldId = won ? 'ui_victory_shield_wings' : 'ui_defeat_shield_wings';
  drawSpriteContain(c, shieldId, px + pw / 2 - 134, py - 74, 268, 116);
  const headline = endless ? t('p13.endlessVictory') : won ? t('p12.victory') : t('p12.defeat');
  drawText(c, headline, px + pw / 2, py + 62, 32, won ? '#fff9d6' : '#ffd5cc', 'center', 900, INK, 6);

  // Share Victory button at top-right of board
  if (won) {
    drawButton(c, hits, 'result:share', px + pw - 168, py + 18, 142, 42, zh ? '炫耀战绩' : 'Share', {
      ...BTN_STYLES.gold,
      radius: 14,
      fontSize: 16.5,
      icon: 'ui_star_rank',
    });
  }

  // 3 Guardian Stars
  for (let i = 0; i < 3; i++) {
    const lit = i < guardianStars;
    const sx = px + pw / 2 - 78 + i * 56;
    if (!drawSpriteContain(c, lit ? 'ui_victory_star_lit' : 'ui_victory_star_dim', sx, py + 82, 46, 46)) {
      drawText(c, lit ? '★' : '☆', sx + 23, py + 105, 34, lit ? '#ffd449' : '#b89f82', 'center', 900);
    }
  }

  // Rank & Star progress ivory slab
  const ry = py + 136;
  drawIvorySlab(c, px + 26, ry, pw - 52, 68, 16);
  drawIconLabel(c, 'ui_star_rank', `${t(`rank.${rank.index}`)}  (${profile.stars}★)`, px + 42, ry + 24, 26, 20, PALETTE.ink);

  if (settlement.resultStars === 0) {
    drawSpriteContain(c, 'ui_rank_protect_shield', px + pw - 118, ry + 9, 28, 28);
    drawText(c, '0★', px + pw - 44, ry + 24, 22, PALETTE.inkSoft, 'right', 900);
  } else {
    const deltaStr = settlement.resultStars > 0 ? `+${settlement.resultStars}★` : `${settlement.resultStars}★`;
    drawText(c, deltaStr, px + pw - 44, ry + 24, 23, settlement.resultStars > 0 ? '#2b7a3d' : '#b43c2e', 'right', 900);
  }

  const nextRank = RANKS[rank.index + 1];
  const progressMax = nextRank ? nextRank.minStars - rank.minStars : 1;
  const progress = nextRank ? Math.min(progressMax, Math.max(0, profile.stars - rank.minStars)) : 1;
  drawProgressBar(c, px + 44, ry + 44, pw - 188, 14, progress / Math.max(1, progressMax), '#f2b838', 'rgba(72,46,24,0.2)', PALETTE.woodDark);
  drawText(c, nextRank ? `${progress}/${progressMax}★` : 'MAX', px + pw - 44, ry + 51, 15, PALETTE.inkSoft, 'right', 900);

  // Body: Treasure Shelf + MVP OR Detailed Stats Report
  const bodyY = ry + 80;
  const bodyH = 238;
  if (settlement.statsOpen) {
    drawIvorySlab(c, px + 26, bodyY, pw - 52, bodyH, 18);
    drawIconLabel(c, 'ui_stat_damage_burst', t('p12.report'), px + 44, bodyY + 28, 26, 20, PALETTE.ink);
    const boardCount = state.units.filter(u => u.side === 'player' && u.location.zone === 'board').length;
    const rows: Array<[string, string, string]> = [
      ['ui_clock_sand', t('p6.time'), formatClock(result.elapsed)],
      ['ui_stat_damage_burst', t('p13.damage'), formatCompactNumber(state.sides.player.damage)],
      ['ui_stat_ko_skull', t('p13.kills'), String(state.sides.player.kills)],
      ['ui_map_sign', t('p6.lineup', { count: boardCount }), `${t(`map.${state.mapId}`)}`],
      ...(endless
        ? [['ui_endless_emblem', t('p13.endlessWave', { wave: result.endlessWave ?? state.wave }), t('p13.endlessRecord', { wave: result.endlessWave ?? state.wave, best: Math.max(result.endlessWave ?? state.wave, profile.bestEndlessWave ?? 0) })] as [string, string, string]]
        : []),
    ];
    rows.forEach(([icon, k, v], i) => {
      const rowY = bodyY + 66 + i * 35;
      drawIconLabel(c, icon, k, px + 50, rowY, 24, 17, PALETTE.inkSoft);
      drawText(c, v, px + pw - 50, rowY, 18.5, PALETTE.ink, 'right', 900);
    });
  } else {
    const leftW = 516;
    drawIvorySlab(c, px + 26, bodyY, leftW, bodyH, 18);
    drawIconLabel(c, 'ui_harvest_basket', t('p13.treasureShelf'), px + 42, bodyY + 26, 26, 18.5, PALETTE.ink);

    if (won && coins > 0 && settlement.adDoubleCoinsAvailable && !settlement.adDoubleClaimed) {
      drawButton(c, hits, 'result:ad-double', px + 26 + leftW - 186, bodyY + 8, 174, 36, zh ? `🎬 双倍 (+${coins})` : `🎬 2× (+${coins})`, {
        ...BTN_STYLES.gold,
        radius: 12,
        fontSize: 15,
      });
    }

    const chips: ShelfChip[] = [
      { icon: 'ui_coin_gold', label: t('profile.coins'), count: `+${coins * (settlement.adDoubleClaimed ? 2 : 1)}` },
      ...(settlement.ticketAwarded ? [{ icon: 'ui_ticket_gacha', label: t('p5.tickets'), count: '+1' }] : []),
      ...collectShelfChips(loot, result.ingredientLoot, result.villageLoot, crests),
    ];
    drawChipGrid(c, chips.slice(0, 6), px + 40, bodyY + 50, leftW - 28, 3);

    // MVP Hero Card
    const mx = px + 26 + leftW + 14;
    const mw = pw - 52 - leftW - 14;
    drawIvorySlab(c, mx, bodyY, mw, bodyH, 18, '#fff7dc', '#f5dca4', PALETTE.goldDark, 2.4);
    drawSpriteContain(c, 'ui_mvp_crown', mx + mw / 2 - 22, bodyY + 8, 44, 36);
    drawText(c, t('p6.mvp'), mx + mw / 2, bodyY + 56, 17, '#7c3f08', 'center', 900);
    if (result.mvp) {
      const mvpSprite = result.mvp.awakened ? `${result.mvp.kind}_awakened` : result.mvp.kind;
      if (!drawSpriteContain(c, mvpSprite, mx + mw / 2 - 44, bodyY + 68, 88, 88)) {
        drawSpriteContain(c, result.mvp.kind, mx + mw / 2 - 44, bodyY + 68, 88, 88);
      }
      const mvpName = t(`${HEROES[result.mvp.kind] ? 'hero' : 'unit'}.${result.mvp.kind}`);
      drawText(c, `${mvpName} Lv.${result.mvp.level}`, mx + mw / 2, bodyY + 174, 18.5, PALETTE.ink, 'center', 900);
      drawIconLabel(c, 'ui_stat_damage_burst', formatCompactNumber(result.mvp.damage), mx + 26, bodyY + 208, 22, 16, PALETTE.inkSoft);
      drawIconLabel(c, 'ui_stat_ko_skull', String(result.mvp.kills), mx + mw / 2 + 26, bodyY + 208, 22, 16, PALETTE.inkSoft);
    } else {
      drawText(c, t('p6.noMvp'), mx + mw / 2, bodyY + 140, 16, PALETTE.muted, 'center', 700);
    }
  }

  // Next Goal Progress Hook
  const hook = computeNextGoalHook(profile);
  const hy = bodyY + bodyH + 12;
  if (hook) {
    drawIvorySlab(c, px + 26, hy, pw - 52, 60, 15, '#fff8e2', '#f3dfb4', '#c1852e', 2);
    drawText(c, formatNextGoalText(hook), px + 44, hy + 21, 16.5, '#68360b', 'left', 900);
    drawProgressBar(c, px + 44, hy + 38, pw - 88, 12, Math.max(0.06, hook.percent / 100), '#f2b838', 'rgba(72,46,24,0.18)', PALETTE.woodDark);
  }

  // Footer CTA Row
  const fy = py + ph - 76;
  drawButton(c, hits, 'modal:toggle-stats', px + 26, fy, 148, 58, settlement.statsOpen ? t('p12.closeStats') : t('p12.stats'), {
    ...BTN_STYLES.cream,
    radius: 16,
    fontSize: 18,
    icon: 'ui_stat_damage_burst',
  });

  if (!won && result.reason === 'oranges' && settlement.adReviveAvailable) {
    drawButton(c, hits, 'result:ad-revive', px + 186, fy, 240, 58, zh ? '🎬 看视频复活 (+2)' : '🎬 Ad Revive (+2)', {
      ...BTN_STYLES.gold,
      radius: 16,
      fontSize: 18,
    });
    drawButton(c, hits, 'modal:menu', px + 438, fy, 198, 58, t('p12.return'), {
      ...BTN_STYLES.cream,
      radius: 16,
      fontSize: 18.5,
    });
    drawButton(c, hits, 'modal:again', px + pw - 26 - 210, fy, 210, 58, t('p12.retry'), {
      ...BTN_STYLES.green,
      radius: 16,
      fontSize: 20,
    });
  } else {
    drawButton(c, hits, 'modal:menu', px + 190, fy, 300, 58, t('p12.return'), {
      ...BTN_STYLES.cream,
      radius: 16,
      fontSize: 20,
    });
    drawButton(c, hits, 'modal:again', px + pw - 26 - 348, fy, 348, 58, won ? t('p12.continue') : t('p12.retry'), {
      ...BTN_STYLES.green,
      radius: 16,
      fontSize: 22,
    });
  }
}

function drawRecipesModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  tab: CompendiumTab,
  scroll: ScrollRegion,
): ModalLayoutInfo {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1080, ph = 532;
  const px = (1280 - pw) / 2, py = 158;

  drawMatchaSignboard(c, 640, 18, t('p5.page.compendium'), t('recipe.subtitle'), 310);
  drawYuzuCloseButton(c, hits, 'modal:close', px + pw - 22, 52);

  // 4 Carved Honey-Oak Bookmark Tabs perched above the hinoki wood rim (unified with Armory/Market/Kitchen!)
  const tabY = py - 44;
  const tabs: Array<{ id: CompendiumTab; label: string }> = [
    { id: 'heroes', label: zh ? '12 位英雄' : '12 Heroes' },
    { id: 'basics', label: zh ? '5 位萌宠' : '5 Basics' },
    { id: 'enemies', label: zh ? '害虫与首领' : 'Pests & Bosses' },
    { id: 'rules', label: zh ? '规则速查' : 'Rules' },
  ];
  tabs.forEach((tb, i) => {
    drawHoneyOakTab(c, hits, `modal:recipes-tab:${tb.id}`, px + 118 + i * 194, tabY, 186, 48, tb.label, tab === tb.id);
  });
  if (tab === 'heroes' || tab === 'enemies') {
    drawText(c, zh ? '↕ 上下滑动' : '↕ Scroll', px + pw - 20, tabY + 24, 15.5, '#fff5dc', 'right', 900, INK, 3);
  }

  // Peeking Compendium Capybara perched right beside Tab 1!
  drawSpriteContain(c, 'ui_compendium_peek_capy', px + 10, tabY - 38, 102, 102);

  drawHinokiBoard(c, px, py, pw, ph, 24);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  const vx = px + 22, vy = py + 16, vw = pw - 44, vh = ph - 32;
  drawIvorySlab(c, vx, vy, vw, vh, 18, '#fffdf7', '#f5e4c2', '#5b3719', 2.4);

  c.save();
  c.beginPath();
  c.rect(vx + 3, vy + 3, vw - 6, vh - 6);
  c.clip();

  let contentH = 0;
  if (tab === 'heroes') {
    const cols = 2, gap = 14, cw = Math.floor((vw - 30 - gap) / cols), ch = 132;
    RECIPES.forEach((r, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const rx = vx + 15 + col * (cw + gap);
      const ry = vy + 14 + row * (ch + gap) - scroll.offset;
      if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

      drawIvorySlab(c, rx, ry, cw, ch, 15, '#fffdf8', '#f6e7c7', '#8a5d32', 2);
      drawSpriteContain(c, r.parts[0], rx + 12, ry + 12, 50, 50);
      drawText(c, '+', rx + 70, ry + 38, 20, PALETTE.inkSoft, 'center', 900);
      drawSpriteContain(c, r.parts[1], rx + 80, ry + 12, 50, 50);
      drawText(c, '→', rx + 140, ry + 38, 20, PALETTE.inkSoft, 'center', 900);
      drawSpriteContain(c, r.hero, rx + 152, ry + 8, 58, 58);

      const st = getBaseUnitStats(r.hero, 1);
      drawText(c, t(`hero.${r.hero}`), rx + 220, ry + 26, 19.5, PALETTE.ink, 'left', 900);
      drawText(c, `⚔️${Math.round(st.damage)}  ⚡${Number(st.rate.toFixed(2))}/s  🎯${st.range}`, rx + 220, ry + 52, 15, PALETTE.inkSoft, 'left', 800);
      drawWrappedText(c, `★ ${t(`skill.${r.hero}`)}: ${t(`skill.${r.hero}.desc`, { charge: st.charge })}`, rx + 16, ry + 76, cw - 32, 14.5, 20, PALETTE.inkSoft, 'left', 700, 2);
    });
    contentH = 28 + Math.ceil(RECIPES.length / cols) * (ch + gap);
  } else if (tab === 'basics') {
    const basicIds = ['hamster', 'squirrel', 'hedgehog', 'corgi', 'bee'];
    const ch = 96, gap = 12;
    basicIds.forEach((id, idx) => {
      const rx = vx + 16, ry = vy + 14 + idx * (ch + gap) - scroll.offset;
      drawIvorySlab(c, rx, ry, vw - 32, ch, 15, '#fffdf8', '#f6e7c7', '#8a5d32', 2);
      drawSpriteContain(c, id, rx + 16, ry + 12, 72, 72);
      drawText(c, t(`unit.${id}`), rx + 104, ry + 32, 21, PALETTE.ink, 'left', 900);
      if (id === 'bee') {
        drawText(c, t('inspect.bee', { time: 7, amount: 5 }), rx + 104, ry + 64, 16.5, PALETTE.inkSoft, 'left', 800);
      } else {
        const lv1 = getBaseUnitStats(id, 1), lv3 = getBaseUnitStats(id, 3);
        drawText(
          c,
          `Lv.1: ⚔️${Math.round(lv1.damage)}  ⚡${Number(lv1.rate.toFixed(2))}/s  🎯${lv1.range}    →    Lv.3: ⚔️${Math.round(lv3.damage)}  ⚡${Number(lv3.rate.toFixed(2))}/s`,
          rx + 104,
          ry + 64,
          16.5,
          PALETTE.inkSoft,
          'left',
          800,
        );
      }
    });
    contentH = 28 + basicIds.length * (ch + gap);
  } else if (tab === 'enemies') {
    const enemyList = Object.values(ENEMIES);
    const cols = 2, gap = 12, cw = Math.floor((vw - 30 - gap) / cols), ch = 120;
    enemyList.forEach((en, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const rx = vx + 15 + col * (cw + gap);
      const ry = vy + 14 + row * (ch + gap) - scroll.offset;
      if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

      drawIvorySlab(
        c,
        rx,
        ry,
        cw,
        ch,
        15,
        en.boss ? '#fff3ec' : '#fffdf8',
        en.boss ? '#fadad0' : '#f6e7c7',
        en.boss ? '#bf4f3a' : '#8a5d32',
        en.boss ? 2.4 : 2,
      );
      drawSpriteContain(c, en.id, rx + 12, ry + 20, 74, 74);
      const name = t(`${en.boss ? 'boss' : 'enemy'}.${en.id}`);
      drawText(c, `${en.boss ? '👑 ' : ''}${name}`, rx + 96, ry + 26, 18.5, en.boss ? '#9e2e1f' : PALETTE.ink, 'left', 900);
      drawText(c, `HP ${en.hp}  ·  ${zh ? '速' : 'SPD'} ${en.speed}${en.armor ? `  ·  护甲${Math.round(en.armor * 100)}%` : ''}`, rx + 96, ry + 50, 14.5, PALETTE.inkSoft, 'left', 800);
      const tipKey = en.boss ? `p1.boss.${en.id}.tip` : `p9.alert.${en.id}`;
      const tip = t(tipKey);
      drawWrappedText(
        c,
        tip === tipKey ? (zh ? '普通/精英害虫，注意集火阻截！' : 'Lane pest — focus fire before it reaches the tub!') : tip,
        rx + 96,
        ry + 68,
        cw - 110,
        14.5,
        20,
        PALETTE.inkSoft,
        'left',
        700,
        2,
      );
    });
    contentH = 28 + Math.ceil(enemyList.length / cols) * (ch + gap);
  } else {
    const sections = zh
      ? [
          ['摇铃与合成', '点击底部摇铃消耗小鱼干抽 5 只伙伴（10→12→14… 递增）。同种同星可合并升星；宠物 + 对应头饰合成传奇英雄，英雄可继续喂食散件升至 Lv.5，合成还能立刻解除纸箱封印与淋湿！'],
          ['铁锹与洒水器', '铁锹可铲开绿草坪增加白色阵位，或 2 步修好烂沙发；每局左侧配有 1 次免费【洒水器】全路冲退减速救急。'],
          ['无尽模式与觉醒突破', '10★ 解锁无尽模式！通关第 10 波先安全入账升星与奖励，可自愿挑战第 11 波+。无尽中将 Lv.5 英雄再喂 1 次散件（或同款 Lv.5）可掷骰【觉醒突破】，前 10 波战意提高成功率，失败零损失且每次保底 +5%！'],
          ['升段零惩罚', '全 54 阶怪物血量、移速与首领技能冷却恒定 1×，升段只提升通关金币、神兵碎片倍率与新地图解锁！'],
        ]
      : [
          ['Bell & Merging', 'Ring the bell to draw 5 friends (cost rises 10→12→14…). Merge matching pets to star up; combine Pet + Gear for Legendary Heroes! Heroes feed on parts up to Lv.5, and merging cleanses seals & wet debuffs.'],
          ['Shovels & Sprinkler', 'Use shovels to clear grass into paw pads or repair craters in 2 steps. Your free Sprinkler on the left pushes back the whole lane once per match!'],
          ['Endless & Awakening', 'Unlock Endless at 10★! Wave-10 rewards bank safely first. From Wave 11+, feed a Lv.5 hero one more part (or Lv.5 twin) to roll Awakening Breakthrough — pre-wave-10 Momentum boosts odds, and misses add +5% pity!'],
          ['Zero Rank Penalty', 'Enemy HP, speed & boss cooldowns stay 1× across all 54 ranks — climbing only boosts coins, fragment rates, and new map unlocks!'],
        ];
    let ry = vy + 14 - scroll.offset;
    for (const [title, body] of sections) {
      drawIvorySlab(c, vx + 16, ry, vw - 32, 112, 15, '#fffdf8', '#f6e7c7', '#8a5d32', 2);
      drawText(c, title, vx + 34, ry + 26, 19.5, PALETTE.ink, 'left', 900);
      drawWrappedText(c, body, vx + 34, ry + 46, vw - 68, 16, 22, PALETTE.inkSoft, 'left', 700, 3);
      ry += 124;
    }
    contentH = 28 + sections.length * 124;
  }

  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

function drawSettingsModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  inBattle: boolean,
  devUnlocked: boolean,
): ModalLayoutInfo {
  const lang = getLanguage();
  const zh = lang === 'zh-CN';
  const pw = 668, ph = devUnlocked ? 548 : 488;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2 + 16;

  drawHinokiBoard(c, px, py, pw, ph, 26);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  drawMatchaSignboard(c, 640, py - 32, t('p5.page.settings'), undefined, 290);
  // Hidden QA gesture: 5 rapid taps on the Settings signboard unlocks Developer Debug Tools!
  hits.add({ id: 'settings:title-tap', x: 640 - 165, y: py - 36, w: 330, h: 68 });
  drawYuzuCloseButton(c, hits, 'modal:close', px + pw - 20, py - 2, 26);

  // Inner sculpted ivory settings card
  const ix = px + 26, iy = py + 44, iw = pw - 52, ih = ph - (devUnlocked ? 196 : 138);
  drawIvorySlab(c, ix, iy, iw, ih, 18);

  const sx = ix + 186, sw = iw - 266, sh = 30;
  const my = iy + 32;
  drawText(c, zh ? '背景音乐' : 'Music', ix + 24, my + 15, 20, PALETTE.ink, 'left', 900);
  drawSlider(c, sx, my, sw, sh, profile.settings.musicVolume);
  drawText(c, `${Math.round(profile.settings.musicVolume * 100)}%`, sx + sw + 42, my + 15, 17.5, PALETTE.inkSoft, 'center', 900);
  hits.add({ id: 'settings:music', x: sx - 12, y: my - 12, w: sw + 24, h: sh + 24 });

  const sfxY = iy + 102;
  drawText(c, zh ? '游戏音效' : 'Sound FX', ix + 24, sfxY + 15, 20, PALETTE.ink, 'left', 900);
  drawSlider(c, sx, sfxY, sw, sh, profile.settings.soundVolume);
  drawText(c, `${Math.round(profile.settings.soundVolume * 100)}%`, sx + sw + 42, sfxY + 15, 17.5, PALETTE.inkSoft, 'center', 900);
  hits.add({ id: 'settings:sound', x: sx - 12, y: sfxY - 12, w: sw + 24, h: sh + 24 });

  const dmgY = iy + 174;
  drawText(c, zh ? '伤害浮字' : 'Damage Numbers', ix + 24, dmgY + 24, 20, PALETTE.ink, 'left', 900);
  const dmgOn = profile.settings.showDamageNumbers;
  drawButton(c, hits, 'settings:damage', ix + iw - 156, dmgY, 134, 48, dmgOn ? (zh ? '已开启' : 'ON') : (zh ? '已关闭' : 'OFF'), {
    ...(dmgOn ? BTN_STYLES.green : BTN_STYLES.muted),
    radius: 15,
    fontSize: 18,
  });

  const langY = iy + 244;
  drawText(c, zh ? '显示语言' : 'Language', ix + 24, langY + 24, 20, PALETTE.ink, 'left', 900);
  drawButton(c, hits, 'settings:lang', ix + iw - 196, langY, 174, 48, zh ? '简体中文 ⇄ EN' : 'English ⇄ 中文', {
    ...BTN_STYLES.cream,
    radius: 15,
    fontSize: 17,
  });

  const botY = py + ph - 78;
  if (devUnlocked) {
    drawButton(c, hits, 'settings:open-dev', px + 26, botY - 62, pw - 52, 50, zh ? '打开开发者调试 & 新手节点预览' : 'Open Developer QA & Stage Preview', {
      ...BTN_STYLES.coral,
      radius: 15,
      fontSize: 18,
    });
  }
  if (!inBattle) {
    drawButton(c, hits, 'settings:replay-tutorial', px + 26, botY, 274, 58, zh ? '重玩新手教学' : 'Replay Tutorial', {
      ...BTN_STYLES.gold,
      radius: 16,
      fontSize: 19,
      icon: 'ui_tutorial_capy',
    });
  }
  drawButton(c, hits, 'modal:close', px + pw - 216, botY, 190, 58, zh ? '完成' : 'Done', {
    ...BTN_STYLES.teal,
    radius: 16,
    fontSize: 20,
  });

  return {
    musicSlider: { x: sx, y: my, w: sw, h: sh },
    soundSlider: { x: sx, y: sfxY, w: sw, h: sh },
  };
}

function drawSlider(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number): void {
  const v = Math.max(0, Math.min(1, value));
  drawProgressBar(c, x, y + h / 2 - 7, w, 14, v, '#5fb098', 'rgba(72,46,24,0.2)', PALETTE.woodDark);
  const kx = x + v * w;
  round(c, kx - 15, y + h / 2 - 15, 30, 30, 15, '#fff6df', PALETTE.woodDark, 2.8);
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
  const gap = 10;
  const cw = Math.floor((w - (cols - 1) * gap) / cols);
  const ch = 84;
  chips.forEach((chip, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = x + col * (cw + gap);
    const cy = y + row * (ch + gap);
    round(c, cx, cy, cw, ch, 14, '#f8ebd0', '#8d6235', 1.8);
    if (!drawSpriteContain(c, chip.icon, cx + (cw - 40) / 2, cy + 5, 40, 40)) {
      drawSpriteContain(c, 'ui_weapon_fragment', cx + (cw - 40) / 2, cy + 5, 40, 40);
    }
    drawText(c, chip.count, cx + cw / 2, cy + 56, 16.5, '#7e3d0a', 'center', 900);
    const shortLabel = chip.label.length > 6 ? `${chip.label.slice(0, 6)}…` : chip.label;
    drawText(c, shortLabel, cx + cw / 2, cy + 74, 12.5, PALETTE.inkSoft, 'center', 800);
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
