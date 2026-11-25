import { HEROES } from '../../config/heroes';
import { INGREDIENT_IDS, isIngredientId, type IngredientId } from '../../config/kitchen';
import { STANDARD_VICTORY_CRESTS } from '../../config/medallions';
import { RANKS, getRank } from '../../config/ranks';
import { VILLAGE_RESOURCE_IDS, type VillageResourceId } from '../../config/village';
import { WEAPONS } from '../../config/weapons';
import { computeNextGoalHook, isFeatureUnlocked, type FeatureId, type NextGoalHook } from '../../core/FeatureUnlocks';
import {
  STAMINA_COST_PER_BATTLE,
  STAMINA_REFILL_AMOUNT,
  STAMINA_REFILL_COIN_COST,
  formatStaminaCountdown,
  getStaminaStatus,
} from '../../core/Stamina';
import { formatCompactNumber } from '../../core/formatNumber';
import type { BattleState, Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import type { ViewportMetrics } from '../../platform/types';
import { INK, round } from '../../render/StickerArt';
import type { BattleLessonKey, DialogGuideStep } from '../../ui/OnboardingGuide';
import {
  PALETTE,
  ScrollRegion,
  drawHinokiBoard,
  drawIconLabel,
  drawIvorySlab,
  drawMatchaSignboard,
  drawPillButton,
  drawProgressBar,
  drawSpriteContain,
  drawSunburst,
  drawText,
  drawWrappedText,
  drawYuzuCloseButton,
  formatClock,
  type UiHitManager,
} from './CanvasUI';
import { drawCompendiumModal, type CompendiumTab, type CompendiumUiState } from './MetaCompendium';
import { drawArmoryModal, drawMarketModal, type ArmoryState, type MarketState } from './MetaArmoryMarket';
import { drawKitchenModal, drawVillageModal, type KitchenUiState, type VillageUiState } from './MetaVillageKitchen';
import { drawMedallionsModal, drawProfileHubModal, type LeaderboardUiState, type ProfileHubTab } from './MetaMedallionsRanks';
import { drawBattleLessonModal, drawOnboardingUnlockModal } from './OnboardingModals';
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
  | 'endless-board'
  | 'profile'
  | 'onboard'
  | 'battle-lesson'
  | 'stamina'
  | 'dev';

export type { CompendiumTab };

export interface SettlementMeta {
  savedResult: boolean;
  resultStars: number;
  previousRank: number;
  newWeapons: readonly string[];
  newAvatars: readonly string[];
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
  compendium: CompendiumUiState;
  scroll: ScrollRegion;
  armory: ArmoryState;
  market: MarketState;
  village: VillageUiState;
  kitchen: KitchenUiState;
  leaderboard: LeaderboardUiState;
  onboardingFeature: FeatureId | null;
  battleLesson: BattleLessonKey | null;
  dialogGuideStep: DialogGuideStep | null;
  devUnlocked: boolean;
  isTestSave: boolean;
  adStaminaAvailable?: boolean;
  elapsed: number;
  viewport: ViewportMetrics;
}

export interface ModalLayoutInfo {
  scrollViewport?: { x: number; y: number; w: number; h: number };
  musicSlider?: { x: number; y: number; w: number; h: number };
  soundSlider?: { x: number; y: number; w: number; h: number };
}

/** Draws the active 1:1 Web Storybook modal over an adaptive backdrop and registers all hit targets. */
export function drawActiveModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  ctx: ModalDrawContext,
): ModalLayoutInfo {
  const { left, top, width, height } = ctx.viewport.visible;
  // Courtyard welcome & battle lesson cards stay lightweight over the live scene (exact `p19_03` / `p19_06`!)
  const lightBackdrop = ctx.modal === 'onboard' || ctx.modal === 'battle-lesson';
  c.fillStyle = lightBackdrop ? 'rgba(20,12,6,0.22)' : 'rgba(22,12,5,0.64)';
  c.fillRect(left - 2, top - 2, width + 4, height + 4);
  hits.add({ id: 'modal:backdrop', x: left, y: top, w: width, h: height });

  const inBattle = Boolean(ctx.state);
  const preparation = Boolean(ctx.state && ctx.state.wave === 1 && ctx.state.spawned === 0);

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
      return drawCompendiumModal(c, hits, ctx.profile, ctx.compendium, ctx.scroll, ctx.isTestSave);
    case 'armory':
      return drawArmoryModal(c, hits, ctx.profile, ctx.armory, ctx.scroll, {
        inBattle,
        preparation,
        canSwitchMarket: isFeatureUnlocked(ctx.profile, 'market'),
        guideStep: ctx.dialogGuideStep,
        elapsed: ctx.elapsed,
      });
    case 'market':
      return drawMarketModal(c, hits, ctx.profile, ctx.market, ctx.scroll, {
        inBattle,
        preparation,
        canSwitchArmory: isFeatureUnlocked(ctx.profile, 'armory'),
        guideStep: ctx.dialogGuideStep,
        elapsed: ctx.elapsed,
      });
    case 'village':
      return drawVillageModal(c, hits, ctx.profile, ctx.village, ctx.scroll, {
        inBattle,
        preparation,
        guideStep: ctx.dialogGuideStep,
      });
    case 'kitchen':
      return drawKitchenModal(c, hits, ctx.profile, ctx.kitchen, ctx.scroll, {
        inBattle,
        preparation,
        guideStep: ctx.dialogGuideStep,
        elapsed: ctx.elapsed,
      });
    case 'medallions':
      return drawMedallionsModal(c, hits, ctx.profile, ctx.leaderboard, ctx.scroll, {
        inBattle,
        preparation,
        guideStep: ctx.dialogGuideStep,
        elapsed: ctx.elapsed,
      });
    case 'leaderboard':
    case 'endless-board':
    case 'profile':
    case 'settings':
      return drawProfileHubModal(c, hits, ctx.modal as ProfileHubTab, ctx.profile, ctx.leaderboard, ctx.scroll, {
        inBattle,
        devUnlocked: ctx.devUnlocked,
      });
    case 'dev':
      drawDevToolsModal(c, hits, ctx.profile, ctx.state, ctx.isTestSave);
      return {};
    case 'stamina':
      drawStaminaModal(c, hits, ctx.profile, Boolean(ctx.adStaminaAvailable));
      return {};
    case 'onboard':
      if (ctx.onboardingFeature) drawOnboardingUnlockModal(c, hits, ctx.onboardingFeature);
      return {};
    case 'battle-lesson':
      if (ctx.battleLesson) drawBattleLessonModal(c, hits, ctx.battleLesson);
      return {};
  }
}

/**
 * Strict 1:1 Web Storybook Pause Modal (`SettlementView.ts` + `p18_preview_d20_battle_pause.png`):
 * - Centered compact carved hinoki wood shell (`pw = 620`), peeking `ui_pause_peek_capy`, Matcha Signboard `泡汤小憩`, Yuzu `×`
 * - Stacked ivory cards: Map/Wave status strip + separate Fragments / Crests / Village Materials / Ingredients sections!
 * - Below the wood board: Full-width bright green pill `▶ 继续保卫澡盆`, followed by 3 equal pill buttons `[名片] [设置] [放弃本局]`!
 */
function drawPauseModal(c: CanvasRenderingContext2D, hits: UiHitManager, state: BattleState): void {
  const fragments = state.sides.player.loot;
  const crestsSoFar = (state.endless ? (state.standardResult?.endlessCrests ?? 0) : 0) + (state.sides.player.endlessCrests ?? 0);
  const villageLoot = state.sides.player.villageLoot ?? [];
  const ingredientLoot = state.sides.player.ingredientLoot ?? [];

  // Build dynamic loot sections BEFORE sizing board so Wave-1 Pause is snug with zero empty wood void!
  const fragMap = new Map<string, number>();
  for (const id of fragments) fragMap.set(id, (fragMap.get(id) ?? 0) + 1);
  const fragChips: Array<{ icon: string; label: string; count: string }> = [...fragMap].map(([id, n]) => ({
    icon: WEAPONS[id] ? `weapon_${id}` : 'ui_weapon_fragment',
    label: t(`fragment.${id}`),
    count: `×${n}`,
  }));

  const extraSections: Array<{ icon: string; title: string; chips: Array<{ icon: string; label: string; count: string }> }> = [];
  if (state.endless || crestsSoFar > 0) {
    extraSections.push({
      icon: 'ui_endless_crest',
      title: t('p17.pauseCrests'),
      chips: [{ icon: 'ui_endless_crest', label: t('p17.crests'), count: `×${crestsSoFar}` }],
    });
  }
  if (villageLoot.length > 0) {
    const vChips: Array<{ icon: string; label: string; count: string }> = [];
    for (const vid of VILLAGE_RESOURCE_IDS) {
      const n = villageLoot.filter(v => v === vid).length;
      if (n > 0) vChips.push({ icon: vid, label: t(vid === 'res_onsen_wood' ? 'p16.wood' : 'p16.essence'), count: `×${n}` });
    }
    if (vChips.length > 0) extraSections.push({ icon: 'ui_village_gate', title: t('p16.pauseMaterials'), chips: vChips });
  }
  if (ingredientLoot.length > 0) {
    const iMap = new Map<IngredientId, number>();
    for (const iid of ingredientLoot) if (isIngredientId(iid)) iMap.set(iid, (iMap.get(iid) ?? 0) + 1);
    const iChips: Array<{ icon: string; label: string; count: string }> = [];
    for (const iid of INGREDIENT_IDS) {
      const n = iMap.get(iid) ?? 0;
      if (n > 0) iChips.push({ icon: iid, label: t(`ingredient.${iid}`), count: `×${n}` });
    }
    if (iChips.length > 0) extraSections.push({ icon: 'ui_kitchen_pot', title: t('p14.pauseIngredients'), chips: iChips });
  }

  const secCount = 1 + extraSections.length;
  const secH = secCount === 1 ? 132 : secCount === 2 ? 116 : secCount === 3 ? 100 : 88;
  const pw = 840;
  const px = (1280 - pw) / 2;
  const ph = Math.min(454, 178 + secCount * secH + (secCount - 1) * 10);
  const py = Math.max(76, Math.round((528 - ph) / 2) + 22);

  drawHinokiBoard(c, px, py, pw, ph, 28);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Peeking towel capybara layered ON TOP of rim
  drawSpriteContain(c, 'ui_pause_peek_capy', px + 22, py - 86, 106, 106);
  drawMatchaSignboard(c, 640, py - 44, t('p12.pauseTitle'), undefined, 320);
  drawYuzuCloseButton(c, hits, 'modal:resume', Math.min(1084, px + pw - 16), py - 12, 30);

  // Stacked Inner Ivory Sections (GIANT readable phone fonts!)
  let cy = py + 42;
  const cw = pw - 48;
  const cx = px + 24;

  // 1. Map & Status Card
  drawIvorySlab(c, cx, cy, cw, 112, 20);
  round(c, cx + 16, cy + 14, 84, 84, 18, '#fff4dc', '#8a6239', 2.4);
  drawSpriteContain(c, 'ui_map_sign', cx + 24, cy + 22, 68, 68);
  drawText(c, t(`map.${state.mapId}`), cx + 116, cy + 36, 32, PALETTE.ink, 'left', 900);
  const waveStr = state.endless ? t('p13.endlessWave', { wave: state.wave }) : t('p12.pauseWave', { wave: state.wave });
  const statLine = `${waveStr}  ·  ${t('p12.pauseTime', { time: formatClock(state.time) })}  ·  ${t('p12.pauseOranges', { count: state.sides.player.oranges })}`;
  drawText(c, statLine, cx + 116, cy + 78, 24, PALETTE.inkSoft, 'left', 900);
  cy += 122;

  drawPauseLootSection(c, cx, cy, cw, secH, 'ui_weapon_fragment', t('p12.pauseLoot'), fragChips, t('p12.pauseEmpty'));
  cy += secH + 10;

  for (const sec of extraSections) {
    drawPauseLootSection(c, cx, cy, cw, secH, sec.icon, sec.title, sec.chips, '');
    cy += secH + 10;
  }

  // GIANT Footer BELOW the wooden board (HUGE 28px/25px bold buttons!)
  const f1y = py + ph + 14;
  drawPillButton(c, hits, 'modal:resume', px, f1y, pw, 64, `▶ ${t('p12.resume')}`, 'green', { fontSize: 28 });

  const f2y = f1y + 74;
  const subGap = 14;
  const subW = Math.floor((pw - subGap * 2) / 3);
  drawPillButton(c, hits, 'modal:open-profile', px, f2y, subW, 58, t('p12.profile'), 'cream', { fontSize: 25 });
  drawPillButton(c, hits, 'modal:open-settings', px + subW + subGap, f2y, subW, 58, t('p12.settings'), 'cream', { fontSize: 25 });
  drawPillButton(
    c,
    hits,
    'modal:surrender',
    px + (subW + subGap) * 2,
    f2y,
    subW,
    58,
    t(state.endless ? 'p13.settleEndless' : 'p12.surrender'),
    'coral',
    { fontSize: 24, icon: state.endless ? 'ui_endless_emblem' : undefined },
  );
}

function drawPauseLootSection(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  icon: string,
  title: string,
  chips: readonly { icon: string; label: string; count: string }[],
  emptyText: string,
): void {
  drawIvorySlab(c, x, y, w, h, 18, '#fffdf8', '#f6e8cb', '#7e5530', 2.2);
  drawIconLabel(c, icon, title, x + 20, y + 28, 30, 23, PALETTE.ink);
  if (chips.length === 0) {
    drawText(c, emptyText, x + w / 2, y + h / 2 + 16, 22, PALETTE.inkSoft, 'center', 800);
    return;
  }
  let cx = x + 20;
  const pillY = y + 52;
  for (const ch of chips.slice(0, 3)) {
    const labelStr = `${ch.label.slice(0, 7)} ${ch.count}`;
    c.font = '900 20px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
    const pw = Math.min(248, Math.max(140, Math.ceil(c.measureText(labelStr).width) + 56));
    if (cx + pw > x + w - 16) break;
    round(c, cx, pillY, pw, 48, 24, '#fff7e6', '#a87f4e', 2);
    drawSpriteContain(c, ch.icon, cx + 10, pillY + 6, 36, 36);
    drawText(c, labelStr, cx + 52, pillY + 25, 20, PALETTE.ink, 'left', 900);
    cx += pw + 10;
  }
}

/** Cozy Hinoki-Wood Stamina Refill Modal (`温泉茶歇 · 体力补充`). */
function drawStaminaModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  adAvailable: boolean,
): void {
  const zh = getLanguage() === 'zh-CN';
  const st = getStaminaStatus(profile, Date.now());
  const pw = 760, ph = adAvailable ? 464 : 400;
  const px = (1280 - pw) / 2;
  const py = Math.round((720 - ph) / 2) + 14;

  drawHinokiBoard(c, px, py, pw, ph, 28);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });
  drawSpriteContain(c, 'ui_pause_peek_capy', px + 22, py - 84, 102, 102);
  drawMatchaSignboard(c, 640, py - 44, zh ? '温泉茶歇 · 体力' : 'Onsen Tea · Energy', undefined, 340);
  drawYuzuCloseButton(c, hits, 'modal:close', Math.min(1084, px + pw - 18), py - 12, 30);

  const cx = px + 28, cw = pw - 56;
  let cy = py + 44;

  // Stamina status slab
  drawIvorySlab(c, cx, cy, cw, 152, 20);
  const low = st.current < STAMINA_COST_PER_BATTLE;
  drawText(
    c,
    zh ? `当前体力：${st.current} / ${st.max}` : `Energy: ${st.current} / ${st.max}`,
    cx + cw / 2,
    cy + 34,
    31,
    low ? '#b83224' : PALETTE.ink,
    'center',
    900,
  );
  drawProgressBar(c, cx + 36, cy + 62, cw - 72, 22, Math.min(1, st.current / st.max), low ? '#e25c48' : '#f4b52c', '#e6d6b5', '#785028');
  const ruleLine = zh
    ? `每局守护消耗 ${STAMINA_COST_PER_BATTLE} 点体力 · 每 5 分钟自动恢复 1 点`
    : `Each battle costs ${STAMINA_COST_PER_BATTLE} Energy · Recovers +1 every 5 min`;
  drawText(c, ruleLine, cx + cw / 2, cy + 104, 21, PALETTE.inkSoft, 'center', 800);
  const timerLine = st.nextRegenSeconds > 0
    ? (zh ? `距离下次恢复 +1 体力：${formatStaminaCountdown(st.nextRegenSeconds)}` : `Next +1 Energy in ${formatStaminaCountdown(st.nextRegenSeconds)}`)
    : (zh ? '✦ 体力已满，随时可以出发守护澡盆！' : '✦ Full Energy! Ready to defend the tub!');
  drawText(c, timerLine, cx + cw / 2, cy + 134, 21, st.nextRegenSeconds > 0 ? '#9c5612' : '#2c763d', 'center', 900);
  cy += 168;

  // Refill with Coins (+15 Energy for 60 Coins)
  const canBuy = profile.coins >= STAMINA_REFILL_COIN_COST;
  drawPillButton(
    c,
    hits,
    'stamina:buy',
    cx,
    cy,
    cw,
    64,
    zh
      ? `喝橘子茶补充 +${STAMINA_REFILL_AMOUNT} 体力（${STAMINA_REFILL_COIN_COST} 金币）`
      : `Yuzu Tea +${STAMINA_REFILL_AMOUNT} Energy (${STAMINA_REFILL_COIN_COST} Coins)`,
    canBuy ? 'gold' : 'muted',
    { fontSize: 24, icon: 'ui_coin_gold', disabled: !canBuy },
  );
  cy += 76;

  if (adAvailable) {
    drawPillButton(
      c,
      hits,
      'stamina:ad',
      cx,
      cy,
      cw,
      62,
      zh ? `🎬 看视频免费补充 +${STAMINA_REFILL_AMOUNT} 体力` : `🎬 Watch Ad for +${STAMINA_REFILL_AMOUNT} Energy`,
      'green',
      { fontSize: 24 },
    );
    cy += 74;
  }

  drawPillButton(c, hits, 'modal:close', cx + (cw - 260) / 2, cy + 4, 260, 56, zh ? '返回庭院' : 'Back', 'cream', { fontSize: 24 });
}

function drawEndlessOfferModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  settlement: SettlementMeta,
  elapsed: number,
): void {
  const result = state.standardResult ?? state.result;
  const pw = 680, ph = 504;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2 + 20;

  drawSunburst(c, 640, py + 12, 320, elapsed, 'rgba(218,162,255,0.26)');
  drawHinokiBoard(c, px, py, pw, ph, 26);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  if (!drawSpriteContain(c, 'ui_endless_emblem', px + pw / 2 - 64, py - 58, 128, 128)) {
    drawSpriteContain(c, 'ui_endless_crest', px + pw / 2 - 56, py - 50, 112, 112);
  }

  drawIvorySlab(c, px + 22, py + 56, pw - 44, ph - 144, 20);
  drawText(c, t('p13.endlessOfferTitle'), px + pw / 2, py + 90, 26, '#5f2685', 'center', 900);

  round(c, px + 76, py + 116, pw - 152, 36, 18, '#dff5d8', '#3c8532', 2);
  drawText(c, `✓ ${t('p13.endlessBanked')}`, px + pw / 2, py + 135, 15.5, '#23591c', 'center', 900);

  round(c, px + 40, py + 164, pw - 80, 130, 16, '#f6e7c7', PALETTE.woodLight, 2);
  drawWrappedText(c, t('p13.endlessOfferBody'), px + 58, py + 178, pw - 116, 16.5, 23.5, PALETTE.ink, 'left', 700, 3);
  round(c, px + 140, py + 252, pw - 280, 32, 16, '#593373', '#c89cf0', 2);
  drawText(c, '×1.25  →  ×1.56  →  ×1.95  →  …', px + pw / 2, py + 269, 16, '#ffe9a3', 'center', 900);

  const crests = result?.endlessCrests ?? STANDARD_VICTORY_CRESTS;
  const pills: Array<{ icon: string; text: string }> = [
    { icon: 'ui_star_rank', text: t('p13.rankBanked') },
    { icon: 'ui_coin_gold', text: `+${result?.coins ?? 0}` },
    ...(settlement.ticketAwarded ? [{ icon: 'ui_ticket_gacha', text: '+1' }] : []),
    ...(crests > 0 ? [{ icon: 'ui_endless_crest', text: `+${crests}` }] : []),
  ];
  const rw = Math.floor((pw - 80 - (pills.length - 1) * 10) / pills.length);
  pills.forEach((p, i) => {
    const x = px + 40 + i * (rw + 10);
    round(c, x, py + 308, rw, 52, 15, '#fff5dc', '#8a5d2e', 2);
    drawSpriteContain(c, p.icon, x + 8, py + 320, 30, 30);
    drawText(c, p.text, x + 42 + (rw - 48) / 2, py + 335, 16.5, PALETTE.ink, 'center', 900);
  });

  const fy = py + ph - 72;
  drawPillButton(c, hits, 'modal:decline-endless', px + 26, fy, 296, 54, t('p13.declineEndless'), 'cream', { fontSize: 18.5, icon: 'ui_trophy_rank' });
  drawPillButton(c, hits, 'modal:enter-endless', px + pw - 322, fy, 296, 54, t('p13.enterEndless'), 'gold', { fontSize: 19.5, icon: 'ui_endless_emblem' });
}

/**
 * Strict 1:1 Web Storybook Victory / Defeat Crest Stage + Visual Battle Report Drawer (`SettlementView.ts`):
 * - Main Crest Stage: Top-left `ui_btn_return_arrow`, sunburst rays, 3 arcing Guardian Stars, winged Shield emblem,
 *   centered Rank & Visual Reward Plaque, Next-Goal progress bar, and bottom corner `ui_stats_scroll` (战报) + `ui_horn_continue` (继续/再战)!
 * - Report Drawer (`statsOpen === true`): Carved hinoki report sheet with `ui_stats_scroll`, MVP Crown Showcase + `ui_stat_damage_burst` & `ui_stat_ko_skull` medals,
 *   Visual Treasure Shelf, `ui_unlock_chest` New Unlocks ribbon, and bottom Footprint Strip!
 */
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

  // ── VISUAL BATTLE REPORT DRAWER (`statsOpen === true`) ────────────────────
  if (settlement.statsOpen) {
    const pw = 804, ph = 548;
    const px = (1280 - pw) / 2, py = 104;
    drawHinokiBoard(c, px, py, pw, ph, 24);
    hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });
    drawMatchaSignboard(c, 640, py - 38, t('p12.report'), undefined, 280);
    drawYuzuCloseButton(c, hits, 'modal:toggle-stats', px + pw - 16, py - 12, 25);

    const cx = px + 22, cw = pw - 44;
    let cy = py + 34;

    // 1. MVP Stage Card (MVP Crown + Big Portrait + Visual Damage/KO Medals!)
    const mvpH = 162;
    drawIvorySlab(c, cx, cy, cw, mvpH, 18, '#fff7dc', '#f6e0aa', PALETTE.goldDark, 2.2);
    if (result.mvp) {
      drawSpriteContain(c, 'ui_mvp_crown', cx + 52, cy + 8, 44, 34);
      const spr = result.mvp.awakened ? `${result.mvp.kind}_awakened` : result.mvp.kind;
      if (!drawSpriteContain(c, spr, cx + 28, cy + 34, 92, 92)) {
        drawSpriteContain(c, result.mvp.kind, cx + 28, cy + 34, 92, 92);
      }
      const mvpName = t(`${HEROES[result.mvp.kind] ? 'hero' : 'unit'}.${result.mvp.kind}`);
      drawText(c, `MVP · ${mvpName}`, cx + 136, cy + 44, 22, '#7c3c08', 'left', 900);
      round(c, cx + 136, cy + 64, 92, 26, 13, '#f3d47c', '#9c6216', 1.6);
      drawText(c, `Lv.${result.mvp.level}${result.mvp.awakened ? ' ★' : ''}`, cx + 182, cy + 78, 14.5, '#592c08', 'center', 900);

      // Two Big Visual Stat Medals (`ui_stat_damage_burst` & `ui_stat_ko_skull`)
      const m1x = cx + cw - 332;
      drawIvorySlab(c, m1x, cy + 20, 152, 122, 16, '#fffdf8', '#f6e8cb', '#8a5d32', 1.8);
      drawSpriteContain(c, 'ui_stat_damage_burst', m1x + 48, cy + 30, 56, 56);
      drawText(c, formatCompactNumber(result.mvp.damage), m1x + 76, cy + 104, 21, PALETTE.ink, 'center', 900);
      drawText(c, t('p13.damage'), m1x + 76, cy + 128, 13.5, PALETTE.inkSoft, 'center', 800);

      const m2x = m1x + 164;
      drawIvorySlab(c, m2x, cy + 20, 152, 122, 16, '#fffdf8', '#f6e8cb', '#8a5d32', 1.8);
      drawSpriteContain(c, 'ui_stat_ko_skull', m2x + 48, cy + 30, 56, 56);
      drawText(c, `×${result.mvp.kills}`, m2x + 76, cy + 104, 21, PALETTE.ink, 'center', 900);
      drawText(c, t('p13.kills'), m2x + 76, cy + 128, 13.5, PALETTE.inkSoft, 'center', 800);
    } else {
      drawSpriteContain(c, 'ui_tutorial_capy', cx + 32, cy + 34, 94, 94);
      drawText(c, t('p6.noMvp'), cx + 144, cy + 68, 20, PALETTE.ink, 'left', 900);
      const boardCount = state.units.filter(u => u.side === 'player' && u.location.zone === 'board').length;
      drawText(c, t('p6.lineup', { count: boardCount }), cx + 144, cy + 102, 16, PALETTE.inkSoft, 'left', 700);
    }
    cy += mvpH + 12;

    // 2. Visual Treasure Shelf
    const hasUnlocks = settlement.newWeapons.length + settlement.newAvatars.length > 0;
    const shelfH = hasUnlocks ? 142 : 210;
    drawIvorySlab(c, cx, cy, cw, shelfH, 18);
    drawIconLabel(c, 'ui_harvest_basket', t('p13.treasureShelf'), cx + 18, cy + 24, 24, 17, PALETTE.ink);
    const chips: ShelfChip[] = [
      { icon: 'ui_coin_gold', label: t('profile.coins'), count: `+${coins * (settlement.adDoubleClaimed ? 2 : 1)}` },
      ...(settlement.ticketAwarded ? [{ icon: 'ui_ticket_gacha', label: t('p5.tickets'), count: '+1' }] : []),
      ...collectShelfChips(loot, result.ingredientLoot, result.villageLoot, crests),
    ];
    drawChipRow(c, chips.slice(0, 6), cx + 18, cy + 44, cw - 36);
    cy += shelfH + 12;

    // 3. New Unlocks Chest Ribbon (`ui_unlock_chest` + NEW!)
    if (hasUnlocks) {
      drawIvorySlab(c, cx, cy, cw, 82, 16, '#eefbe6', '#d6f2c4', '#3d8633', 2);
      drawSpriteContain(c, 'ui_unlock_chest', cx + 16, cy + 10, 62, 62);
      drawText(c, t('p6.unlock'), cx + 88, cy + 24, 16, '#22591b', 'left', 900);
      const unlockSprites = [
        ...settlement.newWeapons.map(id => `weapon_${id}`),
        ...settlement.newAvatars.map(id => `avatar_${id}`),
      ];
      unlockSprites.slice(0, 6).forEach((sp, i) => {
        const ux = cx + 88 + i * 74;
        round(c, ux, cy + 36, 42, 42, 10, '#fffdf7', '#49913b', 1.6);
        drawSpriteContain(c, sp, ux + 4, cy + 40, 34, 34);
      });
      cy += 92;
    }

    // 4. Bottom Footprint Strip (`ui_map_sign` · `ui_wave_horn` · `ui_clock_sand` · `orange`)
    const footY = py + ph - 66;
    drawIvorySlab(c, cx, footY, cw, 50, 15, '#fffdf8', '#f5e4c2', '#8a5d32', 1.8);
    const fItems: Array<[string, string]> = [
      ['ui_map_sign', t(`map.${state.mapId}`)],
      [endless ? 'ui_endless_emblem' : 'ui_wave_horn', endless ? `W${result.endlessWave ?? state.wave}` : `${state.wave}/10`],
      ['ui_clock_sand', formatClock(result.elapsed)],
      ['orange', `×${state.sides.player.oranges}`],
    ];
    const fw = cw / fItems.length;
    fItems.forEach(([ic, val], i) => {
      drawIconLabel(c, ic, val, cx + i * fw + 22, footY + 25, 26, 17, PALETTE.ink);
    });
    return;
  }

  // ── MAIN CREST STAGE (Strict 1:1 Web `SettlementView.ts` + `p13-settlement.css`!) ──
  if (won) {
    drawSunburst(c, 640, 290, 440, elapsed, 'rgba(255,222,110,0.28)');
  }

  // Top-left floating Return Arrow button (`ui_btn_return_arrow`, Battle HUD hidden behind scrim so zero overlap!)
  const retX = 34, retY = 26;
  hits.add({ id: 'modal:menu', x: retX - 4, y: retY - 4, w: 72, h: 72 });
  round(c, retX, retY + 3, 64, 64, 32, 'rgba(42,22,8,0.4)', 'transparent', 0);
  round(c, retX, retY, 64, 64, 32, '#fff8e8', '#5c3612', 3);
  if (!drawSpriteContain(c, 'ui_btn_return_arrow', retX + 9, retY + 9, 46, 46)) {
    drawText(c, '←', retX + 32, retY + 33, 28, PALETTE.ink, 'center', 900);
  }

  // Top-right Share Victory pill button on Win (strictly LEFT of WeChat [🎮][···|◉]!)
  if (won) {
    drawPillButton(c, hits, 'result:share', 930, 26, 178, 52, zh ? '炫耀战绩' : 'Share', 'gold', { fontSize: 21, icon: 'ui_star_rank' });
  }

  // Huge 512×512 Winged Shield Plaque (EXACT Web `crest-emblem-art`: ribbon + cream interior holds rank & rewards!)
  const sSize = 512;
  const sx = 640 - sSize / 2;
  const sy = 24;
  const shieldId = won ? 'ui_victory_shield_wings' : 'ui_defeat_shield_wings';
  drawSpriteContain(c, shieldId, sx, sy, sSize, sSize);
  hits.add({ id: 'modal:card', x: sx + 90, y: sy + 90, w: sSize - 180, h: sSize - 140 });

  // 3 Arcing Guardian Stars perched directly over the shield crown
  for (let i = 0; i < 3; i++) {
    const lit = i < guardianStars;
    const starCx = 640 + (i - 1) * 90;
    const starY = i === 1 ? 10 : 28;
    const sz = i === 1 ? 82 : 68;
    if (!drawSpriteContain(c, lit ? 'ui_victory_star_lit' : 'ui_victory_star_dim', starCx - sz / 2, starY, sz, sz)) {
      drawText(c, lit ? '★' : '☆', starCx, starY + sz / 2, 46, lit ? '#ffd449' : '#b89f82', 'center', 900);
    }
  }

  // Bold Ribbon Title centered cleanly across the Winged Shield's top banner ribbon (`top: 34%`)
  const headline = endless ? t('p13.endlessVictory') : won ? t('p13.victory') : t('p12.defeat');
  drawText(
    c,
    headline,
    640,
    sy + Math.round(sSize * 0.315),
    36,
    won ? '#ffe869' : '#f4ede6',
    'center',
    900,
    won ? '#4a210b' : '#352728',
    6.5,
  );

  // Inside the Shield Plaque (`left: 26%..right: 26%`, `top: 47.5%..82%`)
  const pLeft = 640 - 122;
  const pW = 244;

  // 1. Rank Name + Star Delta (exact Web `crest-rank-line`)
  const rankY = sy + 278;
  const dStr = settlement.resultStars === 0 && !won
    ? '0★'
    : settlement.resultStars > 0
      ? `+${settlement.resultStars}★`
      : `${settlement.resultStars}★`;
  drawText(c, t(`rank.${rank.index}`), 640 - 26, rankY, 21, '#fff4b8', 'center', 900, '#2b1b14', 4.5);
  drawText(
    c,
    dStr,
    640 + 82,
    rankY,
    18.5,
    settlement.resultStars > 0 ? '#9ff584' : settlement.resultStars < 0 ? '#ff9d8f' : '#efe3cc',
    'center',
    900,
    '#2b1b14',
    4,
  );

  // 2. Golden EXP Progress Bar + `progress/max`
  const nextRank = RANKS[rank.index + 1];
  const progressMax = nextRank ? nextRank.minStars - rank.minStars : 1;
  const progress = nextRank ? Math.min(progressMax, Math.max(0, profile.stars - rank.minStars)) : 1;
  drawProgressBar(c, pLeft + 16, rankY + 20, pW - 32, 13, progress / Math.max(1, progressMax), '#ffd242', '#e6dac4', '#4a2912');
  drawText(c, nextRank ? `${progress}/${progressMax}` : 'MAX', 640, rankY + 46, 15, '#4a2912', 'center', 900);

  // 3. Core Visual Rewards Strip right inside the lower shield plaque (`crest-core-rewards`)
  const coreChips: Array<{ icon: string; val: string }> = [
    { icon: 'ui_coin_gold', val: `+${coins * (settlement.adDoubleClaimed ? 2 : 1)}` },
    ...(won && settlement.ticketAwarded ? [{ icon: 'ui_ticket_gacha', val: '+1' }] : []),
    ...(crests > 0 ? [{ icon: 'ui_endless_crest', val: `+${crests}` }] : []),
    ...(loot.length > 0 ? [{ icon: 'ui_weapon_fragment', val: `+${loot.length}` }] : []),
    ...((result.ingredientLoot?.length ?? 0) > 0 ? [{ icon: 'ui_kitchen_pot', val: `+${result.ingredientLoot!.length}` }] : []),
  ];
  const rw = Math.min(78, Math.floor((pW + 12) / Math.max(1, coreChips.length)));
  const rStartX = 640 - (rw * coreChips.length) / 2;
  const rewY = rankY + 68;
  coreChips.forEach((rc, i) => {
    const rcx = rStartX + i * rw;
    const isCoin = i === 0;
    const sz = isCoin ? 50 : 38;
    drawSpriteContain(c, rc.icon, rcx + (rw - sz) / 2, rewY + (50 - sz) / 2, sz, sz);
    drawText(c, rc.val, rcx + rw / 2, rewY + 64, isCoin ? 21 : 16, '#5c2d08', 'center', 900);
  });

  if (won && coins > 0 && settlement.adDoubleCoinsAvailable && !settlement.adDoubleClaimed) {
    drawPillButton(c, hits, 'result:ad-double', 914, rewY + 12, 174, 46, zh ? `🎬 双倍 (+${coins})` : `🎬 2× (+${coins})`, 'gold', { fontSize: 15.5 });
  }

  // 4. Next-Goal Zeigarnik Progress Pill cleanly below the Winged Shield (`y = 532`, real sprite icon — ZERO flat emoji box!)
  const hook = computeNextGoalHook(profile);
  if (hook) {
    const hw = 540, hh = 64, hx = 640 - hw / 2, hy = 530;
    drawIvorySlab(c, hx, hy, hw, hh, 18, '#fffaf0', '#f4e0b6', '#b87a24', 2.4);
    const hookSprite = hookIconSprite(hook);
    const cleanText = formatNextGoalText(hook).replace(/^[\p{Emoji}\uFE0F\s]+/u, '');
    drawIconLabel(c, hookSprite, cleanText, hx + 18, hy + 22, 24, 15.5, '#68360b');
    drawProgressBar(c, hx + 18, hy + 42, hw - 36, 11, Math.max(0.06, hook.percent / 100), '#f2b838', 'rgba(72,46,24,0.18)', PALETTE.woodDark);
  }

  // Bottom Corner Action Buttons (ENLARGED for phone readability!)
  const fy = 610;
  drawPillButton(c, hits, 'modal:toggle-stats', 44, fy, 224, 64, t('p15.report'), 'cream', { fontSize: 22, icon: 'ui_stats_scroll' });
  if (!won && result.reason === 'oranges' && settlement.adReviveAvailable) {
    drawPillButton(c, hits, 'result:ad-revive', 640 - 148, fy, 296, 64, zh ? '🎬 看视频复活 (+2)' : '🎬 Ad Revive (+2)', 'gold', { fontSize: 21 });
  }
  drawPillButton(c, hits, 'modal:again', 1280 - 44 - 258, fy, 258, 64, t(won ? 'p15.continue' : 'p15.again'), 'green', { fontSize: 23, icon: 'ui_horn_continue' });
}

function hookIconSprite(hook: NextGoalHook): string {
  if (hook.kind === 'gacha_ticket') return 'ui_ticket_gacha';
  if (hook.kind === 'weapon') return WEAPONS[hook.id] ? `weapon_${hook.id}` : 'ui_weapon_fragment';
  if (hook.kind === 'village') return 'ui_village_gate';
  if (hook.kind === 'kitchen') return 'ui_kitchen_pot';
  return 'ui_star_rank';
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

function drawChipRow(c: CanvasRenderingContext2D, chips: readonly ShelfChip[], x: number, y: number, w: number): void {
  const gap = 10;
  const cols = Math.min(6, Math.max(3, chips.length));
  const cw = Math.min(116, Math.floor((w - (cols - 1) * gap) / cols));
  const ch = 84;
  chips.forEach((chip, i) => {
    const cx = x + i * (cw + gap);
    round(c, cx, y, cw, ch, 14, '#f8ebd0', '#8d6235', 1.6);
    if (!drawSpriteContain(c, chip.icon, cx + (cw - 42) / 2, y + 6, 42, 42)) {
      drawSpriteContain(c, 'ui_weapon_fragment', cx + (cw - 42) / 2, y + 6, 42, 42);
    }
    drawText(c, chip.count, cx + cw / 2, y + 58, 16, '#7e3d0a', 'center', 900);
    const shortLabel = chip.label.length > 6 ? `${chip.label.slice(0, 6)}…` : chip.label;
    drawText(c, shortLabel, cx + cw / 2, y + 74, 12, PALETTE.inkSoft, 'center', 800);
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
