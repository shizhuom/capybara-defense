import { HEROES } from '../../config/heroes';
import { INGREDIENT_IDS, isIngredientId, type IngredientId } from '../../config/kitchen';
import { STANDARD_VICTORY_CRESTS } from '../../config/medallions';
import { RANKS, getRank } from '../../config/ranks';
import { VILLAGE_RESOURCE_IDS, type VillageResourceId } from '../../config/village';
import { WEAPONS } from '../../config/weapons';
import { computeNextGoalHook, isFeatureUnlocked, maxBattleSpeed, type FeatureId, type NextGoalHook } from '../../core/FeatureUnlocks';
import { localDay } from '../../core/VillageProgression';
import { AD_DAILY_LIMITS, getAdRemainingToday } from '../adConfig';
import {
  STAMINA_COST_PER_BATTLE,
  STAMINA_REFILL_AMOUNT,
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
  | 'speed3x-trial'
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
  adSpeed3xAvailable?: boolean;
  speed3xTrialActive?: boolean;
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
      if (ctx.state) {
        drawPauseModal(c, hits, ctx.state, ctx.profile, {
          adSpeed3xAvailable: Boolean(ctx.adSpeed3xAvailable),
          speed3xTrialActive: Boolean(ctx.speed3xTrialActive),
        });
      }
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
    case 'speed3x-trial':
      drawSpeed3xTrialModal(c, hits, ctx.profile);
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
function drawPauseModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  profile: Profile,
  opts?: { adSpeed3xAvailable?: boolean; speed3xTrialActive?: boolean },
): void {
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
  const zh = getLanguage() === 'zh-CN';
  const speed3xRem = getAdRemainingToday(profile, 'speed3x_trial', localDay());
  const speed3xMax = AD_DAILY_LIMITS.speed3x_trial ?? 3;
  const showSpeed3xBtn = maxBattleSpeed(profile) < 3 && !opts?.speed3xTrialActive && Boolean(opts?.adSpeed3xAvailable);
  if (showSpeed3xBtn) {
    const resumeW = Math.floor((pw - 14) * 0.54);
    const adW = pw - 14 - resumeW;
    drawPillButton(c, hits, 'modal:resume', px, f1y, resumeW, 64, `▶ ${t('p12.resume')}`, 'green', { fontSize: 26 });
    const canAd = speed3xRem > 0;
    drawPillButton(
      c,
      hits,
      'battle:ad-speed3x',
      px + resumeW + 14,
      f1y,
      adW,
      64,
      canAd ? (zh ? `🎬 本局3× (${speed3xRem}/${speed3xMax})` : `🎬 3× (${speed3xRem}/${speed3xMax})`) : (zh ? `🎬 3×已用完 (0/${speed3xMax})` : `🎬 3× (0/${speed3xMax})`),
      canAd ? 'gold' : 'muted',
      { fontSize: 22, disabled: !canAd },
    );
  } else {
    drawPillButton(c, hits, 'modal:resume', px, f1y, pw, 64, `▶ ${t('p12.resume')}`, 'green', { fontSize: 28 });
  }

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

/** Clean Hinoki-Wood Stamina Countdown Modal (no progress bar, no coin purchase; ready for future WeChat ad refill). */
function drawStaminaModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  adAvailable: boolean,
): void {
  const zh = getLanguage() === 'zh-CN';
  const st = getStaminaStatus(profile, Date.now());
  const pw = 760, ph = adAvailable ? 430 : 374;
  const px = (1280 - pw) / 2;
  const py = Math.round((720 - ph) / 2) + 14;

  drawHinokiBoard(c, px, py, pw, ph, 28);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });
  drawSpriteContain(c, 'ui_pause_peek_capy', px + 22, py - 84, 102, 102);
  drawMatchaSignboard(c, 640, py - 44, zh ? '体力恢复' : 'Energy', undefined, 300);
  drawYuzuCloseButton(c, hits, 'modal:close', Math.min(1084, px + pw - 18), py - 12, 30);

  const cx = px + 30, cw = pw - 60;
  let cy = py + 46;

  // Clean big-font stamina status & countdown card (NO progress bar!)
  drawIvorySlab(c, cx, cy, cw, 206, 20);
  const low = st.current < STAMINA_COST_PER_BATTLE;
  drawText(
    c,
    zh ? `当前体力：${st.current} / ${st.max}` : `Energy: ${st.current} / ${st.max}`,
    cx + cw / 2,
    cy + 46,
    36,
    low ? '#b83224' : PALETTE.ink,
    'center',
    900,
  );
  const ruleLine = zh
    ? `每局守护消耗 ${STAMINA_COST_PER_BATTLE} 点体力 · 每 5 分钟自动恢复 1 点`
    : `Each battle costs ${STAMINA_COST_PER_BATTLE} Energy · Recovers +1 every 5 min`;
  drawText(c, ruleLine, cx + cw / 2, cy + 100, 22, PALETTE.inkSoft, 'center', 800);

  // Prominent next-recovery countdown pill
  round(c, cx + 44, cy + 128, cw - 88, 56, 28, st.nextRegenSeconds > 0 ? '#fff2cf' : '#e4f7dc', st.nextRegenSeconds > 0 ? '#9c6218' : '#3d8633', 2.4);
  const timerLine = st.nextRegenSeconds > 0
    ? (zh ? `距离补充下 1 点体力还需：${formatStaminaCountdown(st.nextRegenSeconds)}` : `Next +1 Energy in ${formatStaminaCountdown(st.nextRegenSeconds)}`)
    : (zh ? '✦ 体力已满，随时可以出发守护澡盆！' : '✦ Full Energy! Ready to defend the tub!');
  drawText(c, timerLine, cx + cw / 2, cy + 157, 25, st.nextRegenSeconds > 0 ? '#7c3c08' : '#22591b', 'center', 900);
  cy += 224;

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
      { fontSize: 25 },
    );
    cy += 74;
  }

  drawPillButton(c, hits, 'modal:close', cx + (cw - 280) / 2, cy + 4, 280, 60, zh ? '返回庭院' : 'Back', 'cream', { fontSize: 26 });
}

/** Clean opt-in confirmation modal for watching a rewarded ad to unlock 3× speed for the current battle. */
function drawSpeed3xTrialModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
): void {
  const zh = getLanguage() === 'zh-CN';
  const rem = getAdRemainingToday(profile, 'speed3x_trial', localDay());
  const max = AD_DAILY_LIMITS.speed3x_trial ?? 3;
  const canAd = rem > 0;
  const pw = 740, ph = 396;
  const px = (1280 - pw) / 2;
  const py = Math.round((720 - ph) / 2) + 14;

  drawHinokiBoard(c, px, py, pw, ph, 28);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });
  drawSpriteContain(c, 'ui_pause_peek_capy', px + 22, py - 84, 102, 102);
  drawMatchaSignboard(c, 640, py - 44, zh ? '3× 极速试用' : '3× Speed Trial', undefined, 320);
  drawYuzuCloseButton(c, hits, 'modal:resume', Math.min(1084, px + pw - 18), py - 12, 30);

  const cx = px + 30, cw = pw - 60;
  let cy = py + 44;
  drawIvorySlab(c, cx, cy, cw, 186, 20);
  drawText(
    c,
    zh ? '⚡ 本局免费开启 3× 极速战斗' : '⚡ Unlock 3× Speed For This Battle',
    cx + cw / 2,
    cy + 46,
    30,
    PALETTE.ink,
    'center',
    900,
  );
  drawWrappedText(
    c,
    zh
      ? '观看完整激励视频后立即生效，本局可自由切换 1× / 2× / 3× 倍速。'
      : 'Watch a full rewarded video to unlock 3× battle speed for this entire run.',
    cx + 28,
    cy + 78,
    cw - 56,
    21,
    27,
    PALETTE.inkSoft,
    'center',
    800,
    2,
  );
  round(c, cx + 110, cy + 132, cw - 220, 42, 21, canAd ? '#e4f7dc' : '#eee3d0', canAd ? '#3d8633' : '#9c8a72', 2);
  drawText(
    c,
    zh ? `今日剩余试用次数：${rem} / ${max}` : `Daily trials left: ${rem} / ${max}`,
    cx + cw / 2,
    cy + 154,
    21,
    canAd ? '#22591b' : PALETTE.inkSoft,
    'center',
    900,
  );

  cy += 206;
  const gap = 16;
  const cancelW = 210;
  const adW = cw - cancelW - gap;
  drawPillButton(c, hits, 'modal:resume', cx, cy, cancelW, 64, zh ? '暂不需要' : 'Later', 'cream', { fontSize: 24 });
  drawPillButton(
    c,
    hits,
    'battle:ad-speed3x',
    cx + cancelW + gap,
    cy,
    adW,
    64,
    canAd ? (zh ? '🎬 看完整视频开启 3×' : '🎬 Watch Ad for 3×') : (zh ? '今日次数已用完' : 'Daily Limit Reached'),
    canAd ? 'green' : 'muted',
    { fontSize: 24, disabled: !canAd },
  );
}

function drawEndlessOfferModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  settlement: SettlementMeta,
  elapsed: number,
): void {
  const result = state.standardResult ?? state.result;
  const pw = 820, ph = 544;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2 + 16;

  drawSunburst(c, 640, py + 12, 340, elapsed, 'rgba(218,162,255,0.26)');
  drawHinokiBoard(c, px, py, pw, ph, 28);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  if (!drawSpriteContain(c, 'ui_endless_emblem', px + pw / 2 - 64, py - 58, 128, 128)) {
    drawSpriteContain(c, 'ui_endless_crest', px + pw / 2 - 56, py - 50, 112, 112);
  }

  drawIvorySlab(c, px + 24, py + 58, pw - 48, ph - 154, 22);
  drawText(c, t('p13.endlessOfferTitle'), px + pw / 2, py + 94, 32, '#5f2685', 'center', 900);

  round(c, px + 68, py + 124, pw - 136, 42, 21, '#dff5d8', '#3c8532', 2.2);
  drawText(c, `✓ ${t('p13.endlessBanked')}`, px + pw / 2, py + 146, 21, '#23591c', 'center', 900);

  round(c, px + 44, py + 178, pw - 88, 134, 18, '#f6e7c7', PALETTE.woodLight, 2.2);
  drawWrappedText(c, t('p13.endlessOfferBody'), px + 64, py + 190, pw - 128, 21, 28, PALETTE.ink, 'left', 800, 3);
  round(c, px + 140, py + 266, pw - 280, 36, 18, '#593373', '#c89cf0', 2);
  drawText(c, '×1.25  →  ×1.56  →  ×1.95  →  …', px + pw / 2, py + 285, 20, '#ffe9a3', 'center', 900);

  const crests = result?.endlessCrests ?? STANDARD_VICTORY_CRESTS;
  const pills: Array<{ icon: string; text: string }> = [
    { icon: 'ui_star_rank', text: t('p13.rankBanked') },
    { icon: 'ui_coin_gold', text: `+${result?.coins ?? 0}` },
    ...(settlement.ticketAwarded ? [{ icon: 'ui_ticket_gacha', text: '+1' }] : []),
    ...(crests > 0 ? [{ icon: 'ui_endless_crest', text: `+${crests}` }] : []),
  ];
  const rw = Math.floor((pw - 88 - (pills.length - 1) * 12) / pills.length);
  pills.forEach((p, i) => {
    const x = px + 44 + i * (rw + 12);
    round(c, x, py + 324, rw, 58, 16, '#fff5dc', '#8a5d2e', 2.2);
    drawSpriteContain(c, p.icon, x + 10, py + 335, 36, 36);
    drawText(c, p.text, x + 50 + (rw - 56) / 2, py + 354, 21, PALETTE.ink, 'center', 900);
  });

  const fy = py + ph - 78;
  drawPillButton(c, hits, 'modal:decline-endless', px + 36, fy, 356, 62, t('p13.declineEndless'), 'cream', { fontSize: 24, icon: 'ui_trophy_rank' });
  drawPillButton(c, hits, 'modal:enter-endless', px + pw - 392, fy, 356, 62, t('p13.enterEndless'), 'gold', { fontSize: 25, icon: 'ui_endless_emblem' });
}

/**
 * Mobile Big-Font Centered Settlement Stage + Enlarged Battle Report Drawer:
 * - Main Crest Stage: Centered Winged Shield + 3 Stars + BIG Rank & Reward numbers + BIG Next-Goal Bar
 *   + ALL action buttons (`返回庭院` / `战报` / `分享` / `再来一局`) grouped together right beneath the center emblem!
 * - Report Drawer (`statsOpen === true`): Wide 920px hinoki report sheet with big readable stats & treasure chips!
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
  const villageLoot = won
    ? (endless && state.standardResult ? [...(state.standardResult.villageLoot ?? []), ...(result.endlessVillageLoot ?? [])] : (result.villageLoot ?? []))
    : [];
  const ingredientLoot = won
    ? (endless && state.standardResult ? [...(state.standardResult.ingredientLoot ?? []), ...(result.endlessIngredientLoot ?? [])] : (result.ingredientLoot ?? []))
    : [];
  const guardianStars = endless ? 3 : won ? Math.min(3, Math.max(1, Math.floor(state.sides.player.oranges))) : 0;

  const dbl = settlement.adDoubleClaimed ? 2 : 1;
  const displayLoot = settlement.adDoubleClaimed ? [...loot, ...loot] : loot;
  const displayIngredients = settlement.adDoubleClaimed ? [...ingredientLoot, ...ingredientLoot] : ingredientLoot;
  const displayVillage = settlement.adDoubleClaimed ? [...villageLoot, ...villageLoot] : villageLoot;
  const allShelfChips: ShelfChip[] = [
    { icon: 'ui_coin_gold', label: t('profile.coins'), count: `+${coins * dbl}` },
    ...(won && settlement.ticketAwarded ? [{ icon: 'ui_ticket_gacha', label: t('p5.tickets'), count: '+1' }] : []),
    ...collectShelfChips(displayLoot, displayIngredients, displayVillage, crests * dbl),
  ];

  // ── VISUAL BATTLE REPORT DRAWER (`statsOpen === true`) ────────────────────
  if (settlement.statsOpen) {
    const pw = 960, ph = 606;
    const px = (1280 - pw) / 2, py = 74;
    drawHinokiBoard(c, px, py, pw, ph, 26);
    hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });
    drawMatchaSignboard(c, 640, py - 42, t('p12.report'), undefined, 310);
    drawYuzuCloseButton(c, hits, 'modal:toggle-stats', Math.min(1084, px + pw - 16), py - 12, 30);

    const cx = px + 26, cw = pw - 52;
    let cy = py + 34;

    // 1. MVP Stage Card (MVP Crown + Big Portrait + Visual Damage/KO Medals!)
    const mvpH = 148;
    drawIvorySlab(c, cx, cy, cw, mvpH, 20, '#fff7dc', '#f6e0aa', PALETTE.goldDark, 2.4);
    if (result.mvp) {
      drawSpriteContain(c, 'ui_mvp_crown', cx + 52, cy + 6, 44, 32);
      const spr = result.mvp.awakened ? `${result.mvp.kind}_awakened` : result.mvp.kind;
      if (!drawSpriteContain(c, spr, cx + 26, cy + 32, 96, 96)) {
        drawSpriteContain(c, result.mvp.kind, cx + 26, cy + 32, 96, 96);
      }
      const mvpName = t(`${HEROES[result.mvp.kind] ? 'hero' : 'unit'}.${result.mvp.kind}`);
      drawText(c, `MVP · ${mvpName}`, cx + 140, cy + 48, 29, '#7c3c08', 'left', 900);
      round(c, cx + 140, cy + 74, 118, 34, 17, '#f3d47c', '#9c6216', 2);
      drawText(c, `Lv.${result.mvp.level}${result.mvp.awakened ? ' ★' : ''}`, cx + 199, cy + 92, 20, '#592c08', 'center', 900);

      // Two Big Visual Stat Medals (`ui_stat_damage_burst` & `ui_stat_ko_skull`)
      const m1x = cx + cw - 372;
      drawIvorySlab(c, m1x, cy + 12, 172, 124, 18, '#fffdf8', '#f6e8cb', '#8a5d32', 2);
      drawSpriteContain(c, 'ui_stat_damage_burst', m1x + 62, cy + 18, 48, 48);
      drawText(c, formatCompactNumber(result.mvp.damage), m1x + 86, cy + 88, 25, PALETTE.ink, 'center', 900);
      drawText(c, t('p13.damage'), m1x + 86, cy + 116, 18, PALETTE.inkSoft, 'center', 900);

      const m2x = m1x + 186;
      drawIvorySlab(c, m2x, cy + 12, 172, 124, 18, '#fffdf8', '#f6e8cb', '#8a5d32', 2);
      drawSpriteContain(c, 'ui_stat_ko_skull', m2x + 62, cy + 18, 48, 48);
      drawText(c, `×${result.mvp.kills}`, m2x + 86, cy + 88, 25, PALETTE.ink, 'center', 900);
      drawText(c, t('p13.kills'), m2x + 86, cy + 116, 18, PALETTE.inkSoft, 'center', 900);
    } else {
      drawSpriteContain(c, 'ui_tutorial_capy', cx + 32, cy + 24, 96, 96);
      drawText(c, t('p6.noMvp'), cx + 146, cy + 56, 26, PALETTE.ink, 'left', 900);
      const boardCount = state.units.filter(u => u.side === 'player' && u.location.zone === 'board').length;
      drawText(c, t('p6.lineup', { count: boardCount }), cx + 146, cy + 96, 21, PALETTE.inkSoft, 'left', 800);
    }
    cy += mvpH + 12;

    // 2. Visual Treasure Shelf (up to 2 full rows × 6 columns = 12 distinct items — zero silent 6-item cutoff!)
    const hasUnlocks = settlement.newWeapons.length + settlement.newAvatars.length > 0;
    const multiRowShelf = allShelfChips.length > 6;
    const shelfH = hasUnlocks ? (multiRowShelf ? 248 : 196) : (multiRowShelf ? 286 : 254);
    drawIvorySlab(c, cx, cy, cw, shelfH, 20);
    drawIconLabel(
      c,
      'ui_harvest_basket',
      `${t('p13.treasureShelf')} (${allShelfChips.length})`,
      cx + 20,
      cy + 26,
      28,
      23,
      PALETTE.ink,
    );
    drawChipGrid(c, allShelfChips, cx + 18, cy + 48, cw - 36, shelfH - 58);
    cy += shelfH + 10;

    // 3. New Unlocks Chest Ribbon (`ui_unlock_chest` + NEW!)
    if (hasUnlocks) {
      drawIvorySlab(c, cx, cy, cw, 82, 18, '#eefbe6', '#d6f2c4', '#3d8633', 2.2);
      drawSpriteContain(c, 'ui_unlock_chest', cx + 16, cy + 9, 64, 64);
      drawText(c, t('p6.unlock'), cx + 92, cy + 23, 20, '#22591b', 'left', 900);
      const unlockSprites = [
        ...settlement.newWeapons.map(id => `weapon_${id}`),
        ...settlement.newAvatars.map(id => `avatar_${id}`),
      ];
      unlockSprites.slice(0, 8).forEach((sp, i) => {
        const ux = cx + 92 + i * 62;
        round(c, ux, cy + 36, 40, 40, 10, '#fffdf7', '#49913b', 1.8);
        drawSpriteContain(c, sp, ux + 4, cy + 40, 32, 32);
      });
    }

    // 4. Bottom Footprint Strip (`ui_map_sign` · `ui_wave_horn` · `ui_clock_sand` · `orange`)
    const footY = py + ph - 68;
    drawIvorySlab(c, cx, footY, cw, 54, 16, '#fffdf8', '#f5e4c2', '#8a5d32', 2);
    const fItems: Array<[string, string]> = [
      ['ui_map_sign', t(`map.${state.mapId}`)],
      [endless ? 'ui_endless_emblem' : 'ui_wave_horn', endless ? `W${result.endlessWave ?? state.wave}` : `${state.wave}/10`],
      ['ui_clock_sand', formatClock(result.elapsed)],
      ['orange', `×${state.sides.player.oranges}`],
    ];
    const fw = cw / fItems.length;
    fItems.forEach(([ic, val], i) => {
      drawIconLabel(c, ic, val, cx + i * fw + 22, footY + 27, 28, 22, PALETTE.ink);
    });
    return;
  }

  // ── MAIN CREST STAGE (BIG FONTS + ALL ACTION BUTTONS GROUPED TOGETHER IN THE CENTER!) ──
  if (won) {
    drawSunburst(c, 640, 260, 440, elapsed, 'rgba(255,222,110,0.28)');
  }

  // Winged Shield Plaque centered prominently (`y: 10..496`)
  const sSize = 486;
  const sx = 640 - sSize / 2;
  const sy = 10;
  const shieldId = won ? 'ui_victory_shield_wings' : 'ui_defeat_shield_wings';
  drawSpriteContain(c, shieldId, sx, sy, sSize, sSize);
  hits.add({ id: 'modal:card', x: sx + 84, y: sy + 80, w: sSize - 168, h: sSize - 120 });

  // 3 Arcing Guardian Stars perched directly over the shield crown
  for (let i = 0; i < 3; i++) {
    const lit = i < guardianStars;
    const starCx = 640 + (i - 1) * 88;
    const starY = i === 1 ? 2 : 20;
    const sz = i === 1 ? 82 : 68;
    if (!drawSpriteContain(c, lit ? 'ui_victory_star_lit' : 'ui_victory_star_dim', starCx - sz / 2, starY, sz, sz)) {
      drawText(c, lit ? '★' : '☆', starCx, starY + sz / 2, 46, lit ? '#ffd449' : '#b89f82', 'center', 900);
    }
  }

  // Bold Ribbon Title centered cleanly across the Winged Shield's top banner ribbon
  const headline = endless ? t('p13.endlessVictory') : won ? t('p13.victory') : t('p12.defeat');
  drawText(
    c,
    headline,
    640,
    sy + Math.round(sSize * 0.315),
    40,
    won ? '#ffe869' : '#f4ede6',
    'center',
    900,
    won ? '#4a210b' : '#352728',
    7,
  );

  // Build ALL core reward categories (Coins, Ticket, Endless Crests, Weapon Frags, Village Wood/Essence, Kitchen Ingredients)
  const coreChips: Array<{ icon: string; val: string }> = [
    { icon: 'ui_coin_gold', val: `+${coins * dbl}` },
    ...(won && settlement.ticketAwarded ? [{ icon: 'ui_ticket_gacha', val: '+1' }] : []),
    ...(crests > 0 ? [{ icon: 'ui_endless_crest', val: `+${crests * dbl}` }] : []),
    ...(loot.length > 0 ? [{ icon: 'ui_weapon_fragment', val: `+${loot.length * dbl}` }] : []),
    ...(villageLoot.length > 0 ? [{ icon: 'ui_village_gate', val: `+${villageLoot.length * dbl}` }] : []),
    ...(ingredientLoot.length > 0 ? [{ icon: 'ui_kitchen_pot', val: `+${ingredientLoot.length * dbl}` }] : []),
  ];
  const twoRows = coreChips.length >= 5;

  // Inside the Shield Plaque (auto-switches cleanly between 1-row (<=4) and 2×3 grid (5–6) inside the cream belly!)
  const pW = 248;
  const pLeft = 640 - pW / 2;

  // 1. Rank Name + Star Delta
  const rankY = twoRows ? sy + 218 : sy + 236;
  const dStr = settlement.resultStars === 0 && !won
    ? '0★'
    : settlement.resultStars > 0
      ? `+${settlement.resultStars}★`
      : `${settlement.resultStars}★`;
  drawText(c, t(`rank.${rank.index}`), 640 - 30, rankY, twoRows ? 24 : 26, '#fff4b8', 'center', 900, '#2b1b14', 5.5);
  drawText(
    c,
    dStr,
    640 + 94,
    rankY,
    twoRows ? 22 : 24,
    settlement.resultStars > 0 ? '#9ff584' : settlement.resultStars < 0 ? '#ff9d8f' : '#efe3cc',
    'center',
    900,
    '#2b1b14',
    5,
  );

  // 2. Golden EXP Progress Bar + BIG `progress/max`
  const nextRank = RANKS[rank.index + 1];
  const progressMax = nextRank ? nextRank.minStars - rank.minStars : 1;
  const progress = nextRank ? Math.min(progressMax, Math.max(0, profile.stars - rank.minStars)) : 1;
  drawProgressBar(c, pLeft + 12, rankY + (twoRows ? 20 : 24), pW - 24, twoRows ? 13 : 15, progress / Math.max(1, progressMax), '#ffd242', '#e6dac4', '#4a2912');
  drawText(c, nextRank ? `${progress} / ${progressMax}` : 'MAX', 640, rankY + (twoRows ? 46 : 54), twoRows ? 19 : 21, '#4a2912', 'center', 900);

  // 3. Core Visual Rewards Strip (1 row for 1..4 categories, neat 2×3 mini-grid for 5..6 categories!)
  const rewY = twoRows ? rankY + 60 : rankY + 72;
  if (twoRows) {
    const cols = 3;
    const rw = 74;
    const rowStep = 62;
    coreChips.slice(0, 6).forEach((rc, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const itemsInRow = row === 0 ? Math.min(cols, coreChips.length) : Math.min(cols, coreChips.length - cols);
      const rowStartX = 640 - (itemsInRow * rw) / 2;
      const rcx = rowStartX + col * rw;
      const rcy = rewY + row * rowStep;
      const sz = i === 0 ? 40 : 36;
      drawSpriteContain(c, rc.icon, rcx + (rw - sz) / 2, rcy + (40 - sz) / 2, sz, sz);
      drawText(c, rc.val, rcx + rw / 2, rcy + 49, i === 0 ? 21 : 19.5, '#4f2406', 'center', 900);
    });
  } else {
    const rw = Math.min(72, Math.floor((pW - 14) / Math.max(1, coreChips.length)));
    const rStartX = 640 - (rw * coreChips.length) / 2;
    coreChips.forEach((rc, i) => {
      const rcx = rStartX + i * rw;
      const isCoin = i === 0;
      const sz = isCoin ? 48 : 40;
      drawSpriteContain(c, rc.icon, rcx + (rw - sz) / 2, rewY + (48 - sz) / 2, sz, sz);
      drawText(c, rc.val, rcx + rw / 2, rewY + 62, isCoin ? 24 : 21, '#4f2406', 'center', 900);
    });
  }

  const hasDoubleableRewards = coins > 0 || loot.length > 0 || ingredientLoot.length > 0 || villageLoot.length > 0 || crests > 0;
  if (won && hasDoubleableRewards && settlement.adDoubleCoinsAvailable) {
    const doubleAdRem = getAdRemainingToday(profile, 'double_settlement', localDay());
    const doubleAdMax = AD_DAILY_LIMITS.double_settlement ?? 3;
    if (settlement.adDoubleClaimed) {
      round(c, 892, rewY + 8, 276, 56, 28, '#dff5d6', '#3d8633', 2.4);
      drawText(c, zh ? '✓ 已领取双倍全奖励' : '✓ 2× Loot Claimed', 892 + 138, rewY + 37, 21, '#22591b', 'center', 900);
    } else if (doubleAdRem > 0) {
      drawPillButton(
        c,
        hits,
        'result:ad-double',
        892,
        rewY + 6,
        292,
        62,
        zh ? `🎬 双倍全奖励 (${doubleAdRem}/${doubleAdMax})` : `🎬 2× All Loot (${doubleAdRem}/${doubleAdMax})`,
        'gold',
        { fontSize: 20.5 },
      );
    } else {
      drawPillButton(
        c,
        hits,
        'result:ad-double',
        892,
        rewY + 8,
        286,
        56,
        zh ? `🎬 今日双倍已用完 (0/${doubleAdMax})` : `🎬 Daily Limit (0/${doubleAdMax})`,
        'muted',
        { fontSize: 18.5, disabled: true },
      );
    }
  }

  // 4. BIG Next-Goal Progress Pill right beneath the Winged Shield (`y = 496..572`)
  const hook = computeNextGoalHook(profile);
  if (hook) {
    const hw = 700, hh = 76, hx = 640 - hw / 2, hy = 496;
    drawIvorySlab(c, hx, hy, hw, hh, 22, '#fffaf0', '#f4e0b6', '#b87a24', 2.8);
    const hookSprite = hookIconSprite(hook);
    const cleanText = formatNextGoalText(hook).replace(/^[\p{Emoji}\uFE0F\s]+/u, '');
    drawIconLabel(c, hookSprite, cleanText, hx + 22, hy + 26, 30, 22.5, '#592c08');
    drawProgressBar(c, hx + 22, hy + 50, hw - 44, 14, Math.max(0.06, hook.percent / 100), '#f2b838', 'rgba(72,46,24,0.18)', PALETTE.woodDark);
  }

  // 5. ALL Action Buttons Grouped Together Tightly Under the Center Emblem (`y = 590..658`!)
  const fy = hook ? 590 : 530;
  const bh = 68;
  const gap = 14;
  const reportLabel = allShelfChips.length > 4
    ? `${t('p15.report')} (${allShelfChips.length})`
    : t('p15.report');
  const actions: Array<{ id: string; w: number; label: string; variant: 'cream' | 'gold' | 'green'; icon?: string; fontSize: number }> = [
    { id: 'modal:menu', w: 196, label: zh ? '返回庭院' : 'Home', variant: 'cream', icon: 'ui_btn_return_arrow', fontSize: 24 },
    { id: 'modal:toggle-stats', w: allShelfChips.length > 4 ? 204 : 168, label: reportLabel, variant: 'cream', icon: 'ui_stats_scroll', fontSize: 23 },
  ];
  if (won) {
    actions.push({ id: 'result:share', w: 176, label: zh ? '炫耀战绩' : 'Share', variant: 'gold', icon: 'ui_star_rank', fontSize: 24 });
  } else if (result.reason === 'oranges' && settlement.adReviveAvailable) {
    actions.push({ id: 'result:ad-revive', w: 280, label: zh ? '🎬 复活重打本波 (+3🍊)' : '🎬 Revive Wave (+3🍊)', variant: 'gold', fontSize: 21 });
  }
  actions.push({ id: 'modal:again', w: 246, label: t(won ? 'p15.continue' : 'p15.again'), variant: 'green', icon: 'ui_horn_continue', fontSize: 26 });

  const totalActionW = actions.reduce((sum, a) => sum + a.w, 0) + gap * (actions.length - 1);
  let ax = Math.round(640 - totalActionW / 2);
  for (const act of actions) {
    drawPillButton(c, hits, act.id, ax, fy, act.w, bh, act.label, act.variant, { fontSize: act.fontSize, icon: act.icon });
    ax += act.w + gap;
  }
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

function drawChipGrid(
  c: CanvasRenderingContext2D,
  chips: readonly ShelfChip[],
  x: number,
  y: number,
  w: number,
  maxH: number,
): void {
  if (chips.length === 0) return;
  const zh = getLanguage() === 'zh-CN';
  const maxVisible = 12;
  const list: ShelfChip[] = chips.length > maxVisible
    ? [
        ...chips.slice(0, maxVisible - 1),
        { icon: 'ui_harvest_basket', label: zh ? '更多收获' : 'More', count: `+${chips.length - (maxVisible - 1)}` },
      ]
    : [...chips];

  const multiRow = list.length > 6;
  const cols = multiRow ? 6 : Math.min(6, Math.max(3, list.length));
  const gapX = 10;
  const gapY = 8;
  const cw = Math.min(142, Math.floor((w - (cols - 1) * gapX) / cols));
  const rows = Math.ceil(list.length / cols);
  const ch = multiRow
    ? Math.min(96, Math.max(82, Math.floor((maxH - gapY) / 2)))
    : Math.min(118, maxH);
  const sprSz = multiRow ? 40 : 52;
  const countSz = multiRow ? 19.5 : 23;
  const labelSz = multiRow ? 16 : 18;
  const gridStartX = rows === 1 ? x + Math.max(0, Math.floor((w - (list.length * cw + (list.length - 1) * gapX)) / 2)) : x;

  list.forEach((chip, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = gridStartX + col * (cw + gapX);
    const cy = y + row * (ch + gapY);
    round(c, cx, cy, cw, ch, 15, '#f8ebd0', '#8d6235', 2);
    if (!drawSpriteContain(c, chip.icon, cx + (cw - sprSz) / 2, cy + 6, sprSz, sprSz)) {
      drawSpriteContain(c, 'ui_weapon_fragment', cx + (cw - sprSz) / 2, cy + 6, sprSz, sprSz);
    }
    drawText(c, chip.count, cx + cw / 2, cy + sprSz + (multiRow ? 17 : 22), countSz, '#7e3d0a', 'center', 900);
    const shortLabel = chip.label.length > 5 ? `${chip.label.slice(0, 5)}…` : chip.label;
    drawText(c, shortLabel, cx + cw / 2, cy + ch - (multiRow ? 12 : 16), labelSz, PALETTE.inkSoft, 'center', 800);
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
