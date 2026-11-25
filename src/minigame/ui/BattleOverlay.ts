import { getActiveBroth } from '../../config/kitchen';
import { STAGE } from '../../config/maps';
import { getUnlockedHeroIds } from '../../config/progression';
import { PROPS } from '../../config/props';
import { getSummonCost } from '../../config/units';
import type { BattleEngine } from '../../core/BattleEngine';
import { isFeatureUnlocked, maxBattleSpeed } from '../../core/FeatureUnlocks';
import { localDay } from '../../core/VillageProgression';
import { getAdRemainingToday } from '../adConfig';
import { getHeroMergeOptions } from '../../core/MergeTargets';
import type { TutorialStep } from '../../core/Tutorial';
import type { BattleState, Profile, StageRect } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import type { ViewportMetrics } from '../../platform/types';
import { INK, round } from '../../render/StickerArt';
import { getWaveHUD } from '../../ui/BattleHUD';
import { placeTutorialBubble, tutorialTargets, type TutorialRect } from '../../ui/TutorialView';
import {
  BTN_STYLES,
  PALETTE,
  UI_FONT,
  drawButton,
  drawGuideRipple,
  drawIvorySlab,
  drawSpriteContain,
  drawText,
  drawWoodPanel,
  drawWrappedText,
  type UiHitManager,
} from './CanvasUI';

export interface BattleOverlayContext {
  engine: BattleEngine;
  profile: Profile;
  elapsed: number;
  speed: 1 | 2 | 3;
  selectedId?: number;
  shovelSelected: boolean;
  activePropId?: string;
  expandedPassiveId?: string;
  highlightPropId?: string;
  tutorialStep: TutorialStep;
  topRightEdge: number;
  viewport: ViewportMetrics;
  /** Brief opening battle curtain reveal countdown (0 = hidden). */
  curtainRemaining: number;
  /** Whether a rewarded-ad 3× speed trial is active for the current battle. */
  speed3xTrialActive?: boolean;
  /** Whether the 3× speed trial rewarded ad placement is configured. */
  adSpeed3xAvailable?: boolean;
}

export interface BattleOverlayResult {
  guideRect: TutorialRect;
  avoidRects: StageRect[];
}

/**
 * Strict 1:1 Web Battle HUD (`p19_02_tutorial_step2_shovel.png` & `p19_06_battle_prop_lesson.png`) tuned for phone readability:
 * - Top bar: Wave + Timer, Early/Upcoming, Fish, Oranges on left; Guide, Shop (when unlocked), Speed, Pause on right.
 * - Left rail: Square Sprinkler medallion + Active Prop medallions + dashed `+` prep slots.
 * - Right rail: Active Broth pill + Passive Aura badge + Passive Prop pills + dashed `+` prep slots.
 * - Bottom: Open clean grass on right (NO clutter box!), big Summon Bell + Golden Merge Callout!
 * - ZERO auto-popping right-side live unit stats card (per user's explicit preference!).
 */
export function drawBattleOverlay(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  ctx: BattleOverlayContext,
): BattleOverlayResult {
  const { engine, profile, elapsed, speed, shovelSelected, activePropId, expandedPassiveId, highlightPropId, tutorialStep, topRightEdge, viewport: vp, curtainRemaining } = ctx;
  const state = engine.state;
  const player = state.sides.player;
  const zh = getLanguage() === 'zh-CN';
  const avoidRects: StageRect[] = [];
  const preparation = state.wave === 1 && state.spawned === 0;

  // ── 1. GIANT MOBILE TOP HUD BAR (y: 8..74 — HUGE 32~36px bold counters, 0 overlap with WeChat [🎮][···|◉]!) ──
  const waveHud = getWaveHUD(state);
  const leftStart = vp.visible.left < -10
    ? Math.round(Math.min(14, Math.max(vp.safeStage.left + 10, -28)))
    : 12;
  const waveX = leftStart, waveY = 8, waveW = 216, waveH = 66;
  drawIvorySlab(c, waveX, waveY, waveW, waveH, 20, '#fffdf7', '#f5e4c2', '#5c3b1e', 3);
  if (state.endless) {
    drawSpriteContain(c, 'ui_endless_emblem', waveX + 10, waveY + 12, 42, 42);
    drawText(c, `W${state.wave}`, waveX + 104, waveY + 34, 30, '#6b2f94', 'center', 900);
  } else {
    drawBlueWaveIcon(c, waveX + 32, waveY + 33);
    drawText(c, `${state.wave}/10`, waveX + 104, waveY + 34, 31, PALETTE.ink, 'center', 900);
  }
  drawText(
    c,
    waveHud.kind === 'boss' ? (zh ? '首领' : 'BOSS') : `${waveHud.remaining}s`,
    waveX + waveW - 36,
    waveY + 35,
    22,
    waveHud.kind === 'boss' ? '#b83526' : '#7a4d22',
    'center',
    900,
  );

  // Fish Food Pill (HUGE 36px bold!)
  let nextX = waveX + waveW + 10;
  const foodW = 132;
  drawIvorySlab(c, nextX, waveY, foodW, waveH, 20, '#fffdf7', '#f5e4c2', '#5c3b1e', 3);
  if (drawSpriteContain(c, 'ui_fish_food', nextX + 10, waveY + 11, 44, 44)) {
    drawText(c, String(player.food), nextX + 90, waveY + 34, 35, PALETTE.ink, 'center', 900);
  } else {
    drawText(c, `🐟${player.food}`, nextX + foodW / 2, waveY + 34, 30, PALETTE.ink, 'center', 900);
  }
  nextX += foodW + 10;

  // Oranges Pill (HUGE 34px bold!)
  const orangeW = state.endless && player.capyShieldReady ? 148 : 126;
  drawIvorySlab(c, nextX, waveY, orangeW, waveH, 20, '#fffdf7', '#f5e4c2', '#5c3b1e', 3);
  if (drawSpriteContain(c, 'orange', nextX + 10, waveY + 11, 44, 44)) {
    drawText(c, `×${player.oranges}`, nextX + 86, waveY + 34, 33, player.oranges <= 1 ? '#c73a2b' : PALETTE.ink, 'center', 900);
    if (state.endless && player.capyShieldReady) {
      drawSpriteContain(c, 'ui_rank_protect_shield', nextX + orangeW - 30, waveY + 18, 26, 26);
    }
  } else {
    drawText(c, `🍊×${player.oranges}`, nextX + orangeW / 2, waveY + 34, 28, PALETTE.ink, 'center', 900);
  }
  nextX += orangeW + 10;

  // Early Wave Horn button OR Upcoming Wave Preview (when space permits between Oranges & top-right controls!)
  const rightEdge = topRightEdge;
  const compactRight = rightEdge < 1060;
  const ctrlGap = compactRight ? 8 : 10;
  const pauseW = compactRight ? 74 : 80;
  const speedW = compactRight ? 74 : 82;
  const shopW = compactRight ? 116 : 132;
  const guideW = compactRight ? 116 : 132;
  const ctrlH = 66;
  const permMaxSpd = maxBattleSpeed(profile);
  const maxSpd = ctx.speed3xTrialActive ? 3 : permMaxSpd;
  const showSpeed = maxSpd > 1 || (profile.matches ?? 0) >= 1;
  const showShop = isFeatureUnlocked(profile, 'market') || isFeatureUnlocked(profile, 'armory');

  const pauseX = rightEdge - pauseW;
  let cursorX = pauseX;
  let speedX = cursorX;
  if (showSpeed) {
    speedX = cursorX - ctrlGap - speedW;
    cursorX = speedX;
  }
  let shopX = cursorX;
  if (showShop) {
    shopX = cursorX - ctrlGap - shopW;
    cursorX = shopX;
  }
  const guideX = cursorX - ctrlGap - guideW;
  const guideRect: TutorialRect = { x: guideX, y: waveY, w: guideW, h: ctrlH };

  const early = engine.canCallEarlyWave();
  const midGap = guideX - nextX - 10;
  if (early.allowed && midGap >= 116) {
    const hornW = Math.min(144, midGap);
    const pulse = 1 + Math.sin(elapsed * 5) * 0.03;
    c.save();
    c.translate(nextX + hornW / 2, waveY + waveH / 2);
    c.scale(pulse, pulse);
    c.translate(-(nextX + hornW / 2), -(waveY + waveH / 2));
    drawButton(c, hits, 'battle:early-wave', nextX, waveY, hornW, waveH, `+${early.bonusFood}`, {
      ...BTN_STYLES.gold,
      radius: 20,
      fontSize: 28,
      icon: 'ui_wave_horn',
    });
    c.restore();
    nextX += hornW + 10;
  } else if (!early.allowed && midGap >= 118) {
    const preview = engine.getUpcomingWavePreview();
    if (preview) {
      const pw = Math.min(126, midGap);
      drawIvorySlab(c, nextX, waveY, pw, waveH, 20, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.8);
      const previewIcon = preview.bosses[0] ?? preview.minion;
      drawText(c, preview.bosses.length > 0 ? (zh ? '首领' : 'Boss') : (zh ? '来袭' : 'Next'), nextX + 38, waveY + 34, 21, preview.bosses.length > 0 ? '#b6392c' : PALETTE.inkSoft, 'center', 900);
      drawSpriteContain(c, previewIcon, nextX + pw - 52, waveY + 8, 48, 48);
      nextX += pw + 10;
    }
  }

  // Top-Right Controls: [图鉴] [商店] [2×] [⏸] — GIANT 66px tall buttons completely LEFT of WeChat [🎮][···|◉]!
  drawButton(c, hits, 'battle:guide', guideX, waveY, guideW, ctrlH, zh ? '图鉴' : 'Guide', {
    ...BTN_STYLES.cream,
    radius: 18,
    fontSize: 25,
    icon: 'ui_compendium_book',
  });
  if (showShop) {
    drawButton(c, hits, 'battle:shop', shopX, waveY, shopW, ctrlH, zh ? '商店' : 'Shop', {
      ...BTN_STYLES.cream,
      radius: 18,
      fontSize: 25,
      icon: isFeatureUnlocked(profile, 'market') ? 'ui_shop_bag' : 'weapon_m10_bamboo_staff',
    });
  }
  if (showSpeed) {
    drawButton(c, hits, 'battle:speed', speedX, waveY, speedW, ctrlH, maxSpd <= 1 ? '1×🔒' : `${speed}×`, {
      ...(speed > 1 ? BTN_STYLES.gold : BTN_STYLES.cream),
      radius: 18,
      fontSize: maxSpd <= 1 ? 20 : 28,
    });
  }
  const canOffer3xTrial = permMaxSpd < 3
    && !ctx.speed3xTrialActive
    && Boolean(ctx.adSpeed3xAvailable)
    && tutorialStep === 'done'
    && getAdRemainingToday(profile, 'speed3x_trial', localDay()) > 0;
  if (canOffer3xTrial) {
    const trialW = 132;
    const trialH = 38;
    const trialX = Math.min(pauseX + pauseW - trialW, Math.max(guideX, speedX - 18));
    drawButton(c, hits, 'battle:speed3x-trial', trialX, waveY + ctrlH + 6, trialW, trialH, zh ? '🎬 3×试用' : '🎬 3× Trial', {
      ...BTN_STYLES.gold,
      radius: 14,
      fontSize: 18,
    });
  }
  drawButton(c, hits, 'battle:pause', pauseX, waveY, pauseW, ctrlH, '⏸', {
    ...BTN_STYLES.cream,
    radius: 18,
    fontSize: 28,
  });

  // ── 2. LEFT VERTICAL MEDALLION RAIL (matches 10×4 wide board!) ───────────
  drawLeftToolRail(c, hits, state, profile, preparation, activePropId, highlightPropId, elapsed);

  // ── 3. RIGHT VERTICAL AURA RAIL (Active Broth + Passive Props + Prep `+`!) ─
  drawRightAuraRail(c, hits, state, profile, preparation, expandedPassiveId, vp);

  // ── 4. BOTTOM SUMMON BELL & GOLDEN HERO MERGE CALLOUT (clean open right grass!) ─
  drawBottomControls(c, hits, engine, activePropId, shovelSelected, elapsed);

  // ── 5. MATCH-1 7-STEP GUIDED TUTORIAL OVERLAY (Expanding Ripple Beacons!) ─
  if (tutorialStep !== 'done') {
    drawTutorialOverlay(c, hits, tutorialStep, state, guideRect, avoidRects, elapsed, ctx.selectedId, shovelSelected);
  }

  // ── 6. BRIEF OPENING BATTLE CLASH CURTAIN (tap anywhere to skip!) ─────────
  if (curtainRemaining > 0) {
    drawBattleCurtain(c, hits, state, profile, curtainRemaining, vp);
  }

  return { guideRect, avoidRects };
}

function drawLeftToolRail(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  profile: Profile,
  preparation: boolean,
  activePropId: string | undefined,
  highlightPropId: string | undefined,
  elapsed: number,
): void {
  const player = state.sides.player;
  const zh = getLanguage() === 'zh-CN';
  const size = 98;
  const rx = STAGE.shovelX - Math.round(size / 2);

  // Enlarged Square Cream Sprinkler Medallion right below Shovel
  const spY = STAGE.shovelY + 72;
  const used = player.sprinklerUsed;
  const spPressed = !used && hits.isPressed('battle:sprinkler');
  const spDy = spPressed ? 3 : 0;
  hits.add({ id: 'battle:sprinkler', x: rx, y: spY, w: size, h: size, disabled: used });

  drawIvorySlab(
    c,
    rx,
    spY + spDy,
    size,
    size,
    24,
    used ? '#cfc6b8' : '#fffdf6',
    used ? '#b8ae9e' : '#e4f4eb',
    used ? '#7d7366' : '#3a6e59',
    3.4,
  );
  drawSpriteContain(c, 'sprinkler', rx + 12, spY + spDy + 10, 74, 74, used ? 0.38 : 1);
  round(c, rx + size - 34, spY + spDy + size - 32, 34, 30, 15, used ? '#8c8175' : '#2b8a6d', '#fffdf5', 2.4);
  drawText(c, used ? '0' : '1', rx + size - 17, spY + spDy + size - 16, 20, '#fffdf5', 'center', 900);

  // Equipped Active Props (+ soft dashed `+` prep slot when Market unlocked)
  const equipped = player.loadout.equippedActiveProps.filter(id => PROPS[id]?.type === 'active').slice(0, 2);
  const slotCount = preparation && isFeatureUnlocked(profile, 'market') ? 2 : equipped.length;

  for (let index = 0; index < slotCount; index++) {
    const propId = equipped[index];
    const py = spY + size + 12 + index * 102;
    const ph = 92;

    if (!propId) {
      hits.add({ id: 'battle:backpack', x: rx, y: py, w: size, h: ph });
      c.save();
      c.setLineDash([6, 5]);
      round(c, rx, py, size, ph, 20, 'rgba(235,244,218,0.62)', '#4a6b3e', 2.4);
      c.restore();
      drawText(c, '+', rx + size / 2, py + ph / 2, 36, '#3a5730', 'center', 900);
      continue;
    }

    const def = PROPS[propId];
    const cd = Math.max(0, player.propCooldowns[propId] ?? 0);
    const ready = cd <= 0.05;
    const selected = activePropId === propId;
    const highlighted = highlightPropId === propId;
    const pulse = selected || highlighted ? 1 + Math.sin(elapsed * 6) * 0.04 : 1;
    const lv = player.loadout.ownedProps[propId] ?? 1;

    hits.add({ id: `battle:prop:${propId}`, x: rx, y: py, w: size, h: ph, data: propId, disabled: !ready });

    c.save();
    if (selected || highlighted) {
      c.translate(rx + size / 2, py + ph / 2);
      c.scale(pulse, pulse);
      c.translate(-(rx + size / 2), -(py + ph / 2));
    }
    if (highlighted) {
      drawGuideRipple(c, rx, py, size, ph, 20, elapsed, { maxExpand: 26, waves: 3, showBullseye: true });
    }
    drawIvorySlab(
      c,
      rx,
      py,
      size,
      ph,
      20,
      selected || highlighted ? '#fff0ad' : ready ? '#fffdf6' : '#c8bfb0',
      selected || highlighted ? '#f7ca57' : ready ? '#f4e1ba' : '#ada394',
      selected || highlighted ? '#c75a16' : '#5a3a1e',
      selected || highlighted ? 3.8 : 3,
    );
    if (!drawSpriteContain(c, `prop_${propId}`, rx + 13, py + 7, 72, 68, ready ? 1 : 0.4)) {
      drawText(c, def.icon, rx + size / 2, py + 42, 42, PALETTE.ink, 'center', 700);
    }

    if (ready) {
      if (selected) {
        round(c, rx + 4, py + ph - 26, size - 8, 24, 12, '#c75a16', 'transparent', 0);
        drawText(c, zh ? '点释放' : 'Cast', rx + size / 2, py + ph - 13, 16, '#fffdf5', 'center', 900);
      } else {
        round(c, rx + size - 34, py + ph - 30, 32, 28, 14, '#6a4626', '#fffdf5', 2.2);
        drawText(c, String(lv), rx + size - 18, py + ph - 15, 17, '#fffdf5', 'center', 900);
      }
    } else {
      round(c, rx + 6, py + 6, size - 12, ph - 12, 16, 'rgba(34,20,10,0.56)', 'transparent', 0);
      drawText(c, `${Math.ceil(cd)}s`, rx + size / 2, py + ph / 2, 26, '#fff6d6', 'center', 900, INK, 4.5);
    }
    c.restore();
  }
}

function drawRightAuraRail(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  profile: Profile,
  preparation: boolean,
  expandedPassiveId: string | undefined,
  vp: ViewportMetrics,
): void {
  const loadout = state.sides.player.loadout;
  const activeBroth = getActiveBroth(loadout);
  const passives = loadout.equippedPassiveProps.filter(id => PROPS[id]?.type === 'passive').slice(0, 6);
  const showPrepPassives = preparation && isFeatureUnlocked(profile, 'market');
  if (!activeBroth && passives.length === 0 && !showPrepPassives) return;

  // Sit cleanly in the right garden bleed on wide phones (zero board overlap!), or compact right edge on 16:9
  const tileW = 76;
  const tileH = 70;
  const rx = vp.visible.right > 1350 ? 1268 : Math.min(1200, STAGE.boardX + STAGE.cols * STAGE.cell - tileW - 4);
  let y = 92;
  const zh = getLanguage() === 'zh-CN';

  // Active Broth Pill
  if (activeBroth) {
    const id = 'broth';
    const expanded = expandedPassiveId === id;
    hits.add({ id: `battle:passive:${id}`, x: rx, y, w: tileW, h: tileH });
    drawIvorySlab(c, rx, y, tileW, tileH, 16, expanded ? '#fff2b2' : '#fffdf6', expanded ? '#f7d56a' : '#f5e4c2', '#5c3b1e', 2.6);
    round(c, rx + 12, y + 4, 52, 44, 11, activeBroth.def.bathColor, '#6e4b2b', 1.5);
    drawSpriteContain(c, activeBroth.def.id, rx + 16, y + 6, 44, 40);
    round(c, rx + 5, y + tileH - 22, tileW - 10, 20, 10, '#4a2b16', 'transparent', 0);
    drawText(c, `Lv.${activeBroth.level}`, rx + tileW / 2, y + tileH - 11, 15, '#fffdf5', 'center', 900);

    if (expanded) {
      drawRightTooltip(c, rx - 350, y, 336, `${t(`broth.${activeBroth.def.id}`)} Lv.${activeBroth.level}`, t('p14.railLive'));
    }
    y += tileH + 8;
  }

  // Passive Aura Header Badge
  if (passives.length > 0 || showPrepPassives) {
    round(c, rx + 14, y - 2, 48, 36, 18, 'rgba(255,248,232,0.88)', '#6e4926', 1.8);
    drawSpriteContain(c, 'ui_passive_aura_badge', rx + 21, y, 34, 32);
    round(c, rx + 8, y + 28, tileW - 16, 22, 11, 'rgba(62,38,18,0.92)', 'transparent', 0);
    drawText(c, t('p13.passives'), rx + tileW / 2, y + 39, 14.5, '#fffdf5', 'center', 900);
    y += 56;
  }

  // Passive Props (+ dashed `+` slots during Wave-1 prep)
  const slotCount = showPrepPassives ? 6 : passives.length;
  const pH = slotCount > 4 ? 62 : tileH;
  for (let i = 0; i < slotCount; i++) {
    const propId = passives[i];
    if (!propId) {
      hits.add({ id: 'battle:backpack', x: rx, y, w: tileW, h: pH });
      c.save();
      c.setLineDash([5, 4]);
      round(c, rx + 5, y, tileW - 10, pH, 14, 'rgba(235,244,218,0.56)', '#4a6b3e', 2);
      c.restore();
      drawText(c, '+', rx + tileW / 2, y + pH / 2, 28, '#3a5730', 'center', 900);
      y += pH + 6;
      continue;
    }

    const def = PROPS[propId];
    const lv = loadout.ownedProps[propId] ?? 1;
    const expanded = expandedPassiveId === propId;
    hits.add({ id: `battle:passive:${propId}`, x: rx, y, w: tileW, h: pH });
    drawIvorySlab(c, rx, y, tileW, pH, 15, expanded ? '#fff2b2' : '#fffdf6', expanded ? '#f7d56a' : '#f5e4c2', '#5c3b1e', 2.4);
    if (!drawSpriteContain(c, `prop_${propId}`, rx + 14, y + 4, 48, pH - 24)) {
      drawText(c, def.icon, rx + tileW / 2, y + pH / 2 - 6, 28, PALETTE.ink, 'center', 700);
    }
    round(c, rx + 5, y + pH - 21, tileW - 10, 19, 9, '#4a2b16', 'transparent', 0);
    drawText(c, `Lv.${lv}`, rx + tileW / 2, y + pH - 11, 14.5, '#fffdf5', 'center', 900);

    if (expanded) {
      drawRightTooltip(c, rx - 350, Math.min(520, y), 336, `${zh ? def.name['zh-CN'] : def.name.en} Lv.${lv}`, zh ? def.description['zh-CN'] : def.description.en);
    }
    y += pH + 6;
  }
}

function drawRightTooltip(c: CanvasRenderingContext2D, x: number, y: number, w: number, title: string, body: string): void {
  drawWoodPanel(c, x, y, w, 132, 18, '#fffaf0', PALETTE.woodDark);
  drawText(c, title, x + 18, y + 30, 23, PALETTE.ink, 'left', 900);
  drawWrappedText(c, body, x + 18, y + 54, w - 36, 19, 25, PALETTE.inkSoft, 'left', 700, 3);
}

function drawBottomControls(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  engine: BattleEngine,
  activePropId: string | undefined,
  shovelSelected: boolean,
  elapsed: number,
): void {
  const state = engine.state;
  const player = state.sides.player;
  const zh = getLanguage() === 'zh-CN';

  // GIANT Golden Hero-Merge Callout Pill floating directly above Summon Bell
  const mergeOpts = getHeroMergeOptions(state);
  if (mergeOpts.length > 0 && !activePropId && !shovelSelected) {
    const heroName = t(`hero.${mergeOpts[0].heroId}`);
    const label = zh ? `✦ 可合成【${heroName}】!` : `✦ Ready: ${heroName}!`;
    const mw = 316, mh = 42;
    const mx = STAGE.summonX + (STAGE.summonW - mw) / 2;
    const my = STAGE.summonY - mh - 6;
    const bounce = Math.sin(elapsed * 5.2) * 2;
    round(c, mx, my + bounce + 3, mw, mh, 21, 'rgba(54,28,6,0.38)', 'transparent', 0);
    round(c, mx, my + bounce, mw, mh, 21, '#f8d254', '#7a450b', 2.8);
    drawText(c, label, mx + mw / 2, my + bounce + mh / 2 + 1, 22, '#472408', 'center', 900);
  }

  // GIANT Warm Gold Summon Bell Button (`46px` bold fish cost!)
  const cost = getSummonCost(player.summons);
  const canAfford = player.food >= cost && state.phase === 'playing';
  const pressed = canAfford && hits.isPressed('battle:summon');
  const dy = pressed ? 3 : 0;
  const sx = STAGE.summonX, sy = STAGE.summonY, sw = STAGE.summonW, sh = STAGE.summonH;

  hits.add({ id: 'battle:summon', x: sx, y: sy, w: sw, h: sh, disabled: !canAfford });
  if (!pressed) {
    round(c, sx, sy + 6, sw, sh, 24, canAfford ? '#b57416' : '#8c8070', PALETTE.woodDark, 3);
  }
  round(c, sx, sy + dy, sw, sh, 24, canAfford ? '#f6d572' : '#d2c9b8', PALETTE.woodDark, 3.6);
  if (canAfford) {
    round(c, sx + 8, sy + dy + 6, sw - 16, 18, 10, 'rgba(255,255,255,0.34)', 'transparent', 0);
  }

  drawSpriteContain(c, 'ui_bell_summon', sx + 44, sy + dy + Math.round((sh - 76) / 2), 76, 76, canAfford ? 1 : 0.45);
  drawSpriteContain(c, 'ui_fish_food', sx + 144, sy + dy + Math.round((sh - 50) / 2), 50, 50, canAfford ? 1 : 0.45);
  drawText(c, String(cost), sx + 206 + (sw - 240) / 2, sy + dy + sh / 2 + 2, 48, canAfford ? '#3f220d' : '#736757', 'center', 900);

  // Clean targeting Cancel pill ONLY when player actively selected a Prop or Shovel
  if (activePropId || shovelSelected) {
    const label = activePropId
      ? (zh ? `取消「${PROPS[activePropId]?.name['zh-CN']}」` : `Cancel ${PROPS[activePropId]?.name.en}`)
      : (zh ? '取消开垦' : 'Cancel Dig');
    drawButton(c, hits, 'battle:cancel-mode', sx + sw + 12, sy + 20, 134, 76, label, {
      ...BTN_STYLES.coral,
      radius: 20,
      fontSize: 19,
    });
  }
}

/**
 * High-contrast concentric expanding ripple beacon (`0` shadowBlur for 100% iOS Canvas 2D safety)
 * so players immediately spot which button/pet/tile to tap or drag to on any bright or dark background.
 */
function drawTutorialRipple(
  c: CanvasRenderingContext2D,
  r: TutorialRect,
  elapsed: number,
  primary: boolean,
  isTarget: boolean,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.6);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const radius = Math.min(24, Math.max(14, Math.min(r.w, r.h) * 0.24));

  // 1. Expanding concentric rectangular ripple waves radiating outward (3 staggered waves on primary, 2 on secondary)
  const waveCount = primary ? 3 : 2;
  const maxExpand = primary ? 34 : 20;
  for (let i = 0; i < waveCount; i++) {
    const phase = (elapsed * 0.92 + i / waveCount) % 1;
    const exp = 3 + phase * maxExpand;
    const alpha = Math.pow(1 - phase, 1.35) * (primary ? 0.96 : 0.62);
    if (alpha <= 0.03) continue;
    const rr = radius + exp * 0.45;
    // Outer dark-amber contrast halo so the bright gold ripple pops on sunlit grass AND cream buttons
    round(
      c,
      r.x - exp,
      r.y - exp,
      r.w + exp * 2,
      r.h + exp * 2,
      rr,
      'transparent',
      `rgba(122,48,0,${(alpha * 0.65).toFixed(2)})`,
      primary ? 7 : 5,
    );
    round(
      c,
      r.x - exp,
      r.y - exp,
      r.w + exp * 2,
      r.h + exp * 2,
      rr,
      'transparent',
      isTarget ? `rgba(142,240,104,${alpha.toFixed(2)})` : `rgba(255,226,64,${alpha.toFixed(2)})`,
      primary ? 4.2 : 3,
    );
  }

  // 2. Crisp breathing focus frame tightly hugging the hitbox
  const fillCol = isTarget
    ? `rgba(130,224,96,${((primary ? 0.24 : 0.14) * (0.65 + 0.35 * pulse)).toFixed(2)})`
    : `rgba(255,222,74,${((primary ? 0.24 : 0.14) * (0.65 + 0.35 * pulse)).toFixed(2)})`;
  const strokeCol = isTarget ? '#8ef068' : '#ffe248';
  round(c, r.x - 4, r.y - 4, r.w + 8, r.h + 8, radius + 3, 'transparent', 'rgba(110,44,0,0.72)', primary ? 7.5 : 5.5);
  round(c, r.x - 4, r.y - 4, r.w + 8, r.h + 8, radius + 3, fillCol, strokeCol, primary ? 4.2 : 3);

  // 3. Primary tap bullseye water-ripple + gently tapping paw pointer
  if (primary) {
    c.save();
    for (let i = 0; i < 2; i++) {
      const p = (elapsed * 1.15 + i * 0.5) % 1;
      const rad = 8 + p * 24;
      const a = Math.pow(1 - p, 1.3) * 0.92;
      c.beginPath();
      c.arc(cx, cy, rad, 0, Math.PI * 2);
      c.strokeStyle = `rgba(120,48,0,${(a * 0.6).toFixed(2)})`;
      c.lineWidth = 5;
      c.stroke();
      c.strokeStyle = `rgba(255,244,158,${a.toFixed(2)})`;
      c.lineWidth = 2.8;
      c.stroke();
    }
    c.restore();

    const bob = Math.sin(elapsed * 6.2) * 6;
    const pawSz = 56;
    const aboveTop = r.y > 96;
    const px = Math.min(STAGE.width - pawSz - 6, Math.max(6, r.x + r.w * 0.62));
    const py = aboveTop ? r.y - pawSz * 0.56 + bob : r.y + r.h - 10 - bob;
    drawSpriteContain(c, 'ui_tutorial_pointer', px, py, pawSz, pawSz);
  }
}

function rectContainsUnit(r: TutorialRect | undefined, u: BattleState['units'][number] | undefined): boolean {
  if (!r || !u) return false;
  const ux = u.location.zone === 'bench' ? STAGE.benchX + u.location.slot * STAGE.benchStep : STAGE.boardX + u.location.col * STAGE.cell;
  const uy = u.location.zone === 'bench' ? STAGE.benchY : STAGE.boardY + u.location.row * STAGE.cell;
  return Math.abs(r.x - ux) < 8 && Math.abs(r.y - uy) < 8;
}

function drawTutorialOverlay(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  step: Exclude<TutorialStep, 'done'>,
  state: BattleState,
  guideRect: TutorialRect,
  avoidRects: readonly StageRect[],
  elapsed: number,
  selectedId?: number,
  shovelSelected = false,
): void {
  const targets = tutorialTargets(step, state, guideRect);
  const selectedUnit = selectedId !== undefined ? state.units.find(u => u.id === selectedId) : undefined;
  const sourceActive = step === 2
    ? shovelSelected
    : rectContainsUnit(targets.source, selectedUnit);

  // Expanding ripple beacons: on 2-step tap guides, spotlight Source first, then shift primary ripple to Target once picked!
  if (targets.source) {
    drawTutorialRipple(c, targets.source, elapsed, step === 4 ? true : !sourceActive, false);
  }
  if (targets.target) {
    const targetPrimary = !targets.source || sourceActive;
    drawTutorialRipple(c, targets.target, elapsed, targetPrimary, Boolean(targets.source));
  }

  // Animated trajectory curve between source and target (+ gliding golden drag orb on Step 4 Drag!)
  if (targets.source && targets.target) {
    const ax = targets.source.x + targets.source.w / 2;
    const ay = targets.source.y + targets.source.h / 2;
    const bx = targets.target.x + targets.target.w / 2;
    const by = targets.target.y + targets.target.h / 2;
    const ctrlX = (ax + bx) / 2;
    const ctrlY = Math.min(ay, by) - 28;
    c.save();
    c.strokeStyle = 'rgba(104,44,0,0.65)';
    c.lineWidth = 7.5;
    c.setLineDash([12, 8]);
    c.lineDashOffset = -elapsed * 36;
    c.beginPath();
    c.moveTo(ax, ay);
    c.quadraticCurveTo(ctrlX, ctrlY, bx, by);
    c.stroke();
    c.strokeStyle = '#ffe252';
    c.lineWidth = 4.2;
    c.stroke();
    c.setLineDash([]);

    // On Step 4 (Drag Merge), animate a glowing orb gliding continuously along the arc from Source -> Target!
    if (step === 4) {
      const tPos = (elapsed * 0.78) % 1;
      const inv = 1 - tPos;
      const gx = inv * inv * ax + 2 * inv * tPos * ctrlX + tPos * tPos * bx;
      const gy = inv * inv * ay + 2 * inv * tPos * ctrlY + tPos * tPos * by;
      c.beginPath();
      c.arc(gx, gy, 13, 0, Math.PI * 2);
      c.fillStyle = '#ffe458';
      c.strokeStyle = '#6e3004';
      c.lineWidth = 3.2;
      c.fill();
      c.stroke();
    }
    c.restore();
  }

  const acknowledge = targets.acknowledge || step === 7;
  const hasEquationStrip = step === 5 || step === 6;
  const bubbleW = 556;
  const bubbleH = hasEquationStrip ? (acknowledge ? 344 : 300) : acknowledge ? 286 : 244;
  const targetRects = [targets.target, targets.source].filter((r): r is TutorialRect => Boolean(r));
  const b = placeTutorialBubble([...targetRects, ...avoidRects], { w: bubbleW, h: bubbleH });

  drawWoodPanel(c, b.x, b.y, b.w, b.h, 24, '#fffdf6', '#69411b');
  hits.add({ id: 'battle:tutorial-bg', x: b.x, y: b.y, w: b.w, h: b.h });

  drawSpriteContain(c, 'ui_tutorial_capy', b.x + 16, b.y + 12, 74, 74);
  round(c, b.x + 98, b.y + 14, 118, 32, 16, '#4c9883', 'transparent', 0);
  drawText(c, `STEP ${step}/7`, b.x + 157, b.y + 31, 18, '#fffdf5', 'center', 900);

  drawButton(c, hits, 'battle:tutorial-skip', b.x + b.w - 110, b.y + 12, 94, 42, t('p1.tutorialSkip'), {
    ...BTN_STYLES.cream,
    radius: 14,
    fontSize: 19,
  });

  const titleKey = step === 2
    ? 'p19.tutorialDig.title'
    : step === 6
      ? 'p19.tutorialBee.title'
      : step === 7
        ? 'p5.tutorial5.title'
        : step === 1
          ? 'p5.tutorial1.title'
          : `p5.tutorial${step - 1}.title`;
  const bodyKey = step === 2
    ? 'p19.tutorialDig.body'
    : step === 5
      ? 'p6.tutorial4Body'
      : step === 6
        ? 'p19.tutorialBee.body'
        : step === 7
          ? 'p19.tutorial6.body'
          : step === 1
            ? 'p5.tutorial1.body'
            : `p5.tutorial${step - 1}.body`;

  drawText(c, t(titleKey), b.x + 98, b.y + 68, 25, PALETTE.ink, 'left', 900);
  let cy = b.y + 96;
  cy += drawWrappedText(c, t(bodyKey), b.x + 22, cy, b.w - 44, 21, 28, PALETTE.inkSoft, 'left', 700, 4);

  if (step === 5) {
    const eqY = cy + 6;
    round(c, b.x + 22, eqY, b.w - 44, 58, 16, '#f4e3bd', PALETTE.woodLight, 2);
    drawSpriteContain(c, 'panda', b.x + 36, eqY + 6, 46, 46);
    drawText(c, '+', b.x + 96, eqY + 30, 26, PALETTE.ink, 'center', 900);
    drawSpriteContain(c, 'hat_bamboo', b.x + 114, eqY + 6, 46, 46);
    drawText(c, '=', b.x + 174, eqY + 30, 26, PALETTE.ink, 'center', 900);
    drawSpriteContain(c, 'kungfu_po', b.x + 192, eqY + 4, 50, 50);
    drawText(c, t('hero.kungfu_po'), b.x + 252, eqY + 30, 24, '#7e3c0e', 'left', 900);
  } else if (step === 6) {
    const eqY = cy + 6;
    round(c, b.x + 22, eqY, b.w - 44, 58, 16, '#fff3c9', '#d49a2a', 2);
    drawSpriteContain(c, 'bee', b.x + 38, eqY + 6, 46, 46);
    drawText(c, '→', b.x + 102, eqY + 30, 26, '#8a4c08', 'center', 900);
    drawSpriteContain(c, 'ui_fish_food', b.x + 122, eqY + 8, 42, 42);
    drawText(c, t('p19.tutorialBee.badge'), b.x + 178, eqY + 30, 22, '#6e3706', 'left', 900);
  }

  const dotY = b.y + b.h - (acknowledge ? 82 : 30);
  for (let n = 1; n <= 7; n++) {
    const dx = b.x + b.w / 2 + (n - 4) * 38;
    const fill = n === step ? '#f4c855' : n < step ? '#6db85a' : '#dfd2b8';
    round(c, dx - 13.5, dotY - 13.5, 27, 27, 13.5, fill, PALETTE.woodDark, 2);
    drawText(c, String(n), dx, dotY + 1, 16.5, n === step ? PALETTE.ink : n < step ? '#fffdf5' : PALETTE.muted, 'center', 900);
  }

  if (acknowledge) {
    drawButton(c, hits, 'battle:tutorial-ack', b.x + b.w / 2 - 120, b.y + b.h - 56, 240, 46, t('p1.tutorialAck'), {
      ...BTN_STYLES.teal,
      radius: 16,
      fontSize: 21,
    });
  }
}

function drawBattleCurtain(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  profile: Profile,
  remaining: number,
  vp: ViewportMetrics,
): void {
  const tNorm = Math.max(0, Math.min(1, remaining / 0.85));
  const open = tNorm < 0.45 ? 1 - tNorm / 0.45 : 0;
  const halfW = Math.max(650, Math.ceil(vp.visible.width / 2) + 20);
  const slide = open * halfW;
  const alpha = tNorm < 0.35 ? tNorm / 0.35 : 1;

  hits.add({ id: 'battle:skip-curtain', x: vp.visible.left, y: vp.visible.top, w: vp.visible.width, h: vp.visible.height });
  c.save();
  c.fillStyle = '#5d391f';
  c.fillRect(640 - halfW - slide, vp.visible.top - 2, halfW + 2, vp.visible.height + 4);
  c.fillRect(638 + slide, vp.visible.top - 2, halfW + 2, vp.visible.height + 4);
  c.strokeStyle = '#f2cc7c';
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(640 - slide, vp.visible.top); c.lineTo(640 - slide, vp.visible.bottom);
  c.moveTo(640 + slide, vp.visible.top); c.lineTo(640 + slide, vp.visible.bottom);
  c.stroke();

  c.globalAlpha = alpha;
  drawSpriteContain(c, 'ui_battle_clash_crest', 640 - 90, 128, 180, 180);
  drawSpriteContain(c, 'ui_crossed_blades', 640 - 66, 166, 132, 132);
  drawText(c, t(`map.${state.mapId}`), 640, 356, 40, '#fff7dc', 'center', 900, INK, 7);
  drawText(c, t('p9.ready'), 640, 406, 23, '#ffe099', 'center', 900, INK, 5);

  // Roster preview strip (EXACT `BattlePresentation.ts`!)
  const heroes = getUnlockedHeroIds(Math.max(profile.stars, profile.highestStars)).slice(0, 6);
  const spacing = 54;
  const startX = 640 - ((heroes.length - 1) * spacing) / 2;
  heroes.forEach((h, i) => {
    drawSpriteContain(c, h, startX + i * spacing - 22, 434, 44, 44);
  });

  drawText(c, `${t(`rank.${state.rankIndex}`)} · ${t('p9.skipCurtain')}`, 640, 506, 17, '#f5d99d', 'center', 800, INK, 4);
  c.restore();
}

/** Crisp storybook blue wave crest icon for the top-left Wave `1/10` pill (distinct from the brass early-wave horn!). */
function drawBlueWaveIcon(c: CanvasRenderingContext2D, cx: number, cy: number): void {
  c.save();
  c.translate(cx, cy);
  c.fillStyle = '#3b9be0';
  c.strokeStyle = '#1f4e78';
  c.lineWidth = 2.2;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  c.beginPath();
  c.moveTo(-14, 7);
  c.bezierCurveTo(-13, -8, -2, -14, 7, -10);
  c.bezierCurveTo(13, -7, 13, 0, 7, 1);
  c.bezierCurveTo(4, 1, 2, -2, 4, -4);
  c.bezierCurveTo(0, -4, -3, 1, 2, 4);
  c.bezierCurveTo(7, 6, 12, 4, 14, 7);
  c.lineTo(14, 11);
  c.lineTo(-14, 11);
  c.closePath();
  c.fill();
  c.stroke();

  c.strokeStyle = '#dff4ff';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-8, 1);
  c.quadraticCurveTo(-4, -8, 5, -7);
  c.stroke();
  c.restore();
}

export { UI_FONT };
