import { getActiveBroth } from '../../config/kitchen';
import { STAGE } from '../../config/maps';
import { getUnlockedHeroIds } from '../../config/progression';
import { PROPS } from '../../config/props';
import { getSummonCost } from '../../config/units';
import type { BattleEngine } from '../../core/BattleEngine';
import { isFeatureUnlocked, maxBattleSpeed } from '../../core/FeatureUnlocks';
import { getHeroMergeOptions } from '../../core/MergeTargets';
import type { TutorialStep } from '../../core/Tutorial';
import { formatCompactNumber } from '../../core/formatNumber';
import type { BattleState, Profile, StageRect } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import type { ViewportMetrics } from '../../platform/types';
import { INK, round } from '../../render/StickerArt';
import { getBossHUD, getWaveHUD } from '../../ui/BattleHUD';
import { placeTutorialBubble, tutorialTargets, type TutorialRect } from '../../ui/TutorialView';
import {
  BTN_STYLES,
  PALETTE,
  UI_FONT,
  drawButton,
  drawIvorySlab,
  drawProgressBar,
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
  shovelSelected: boolean;
  activePropId?: string;
  expandedPassiveId?: string;
  highlightPropId?: string;
  tutorialStep: TutorialStep;
  topRightEdge: number;
  viewport: ViewportMetrics;
  /** Brief opening battle curtain reveal countdown (0 = hidden). */
  curtainRemaining: number;
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

  // ── 1. TOP HUD BAR (y: 8..60 — matches p19_02 & p19_06 with crisp mobile fonts!) ──
  const waveHud = getWaveHUD(state);
  const waveX = 16, waveY = 8, waveW = 144, waveH = 52;
  drawIvorySlab(c, waveX, waveY, waveW, waveH, 16, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.4);
  if (state.endless) {
    drawSpriteContain(c, 'ui_endless_emblem', waveX + 8, waveY + 9, 34, 34);
    drawText(c, `W${state.wave}`, waveX + 92, waveY + 27, 23, '#6b2f94', 'center', 900);
  } else {
    drawBlueWaveIcon(c, waveX + 26, waveY + 26);
    drawText(c, `${state.wave}/10`, waveX + 90, waveY + 27, 23, PALETTE.ink, 'center', 900);
  }

  // Crisp timer pill tucked directly below Wave pill
  const timerY = waveY + waveH + 4;
  round(c, waveX, timerY, 108, 30, 15, 'rgba(255,247,230,0.95)', '#6e4927', 2);
  drawSpriteContain(c, 'ui_clock_sand', waveX + 8, timerY + 4, 22, 22);
  drawText(
    c,
    waveHud.kind === 'boss' ? (zh ? '首领' : 'BOSS') : `${waveHud.remaining}s`,
    waveX + 66,
    timerY + 16,
    16,
    waveHud.kind === 'boss' ? '#b83526' : PALETTE.ink,
    'center',
    900,
  );

  // Early Wave Horn button OR Upcoming Wave Preview pill
  const early = engine.canCallEarlyWave();
  let nextX = waveX + waveW + 8;
  if (early.allowed) {
    const hornW = 136;
    const pulse = 1 + Math.sin(elapsed * 5) * 0.03;
    c.save();
    c.translate(nextX + hornW / 2, waveY + waveH / 2);
    c.scale(pulse, pulse);
    c.translate(-(nextX + hornW / 2), -(waveY + waveH / 2));
    drawButton(c, hits, 'battle:early-wave', nextX, waveY, hornW, waveH, `+${early.bonusFood}`, {
      ...BTN_STYLES.gold,
      radius: 16,
      fontSize: 22,
      icon: 'ui_wave_horn',
    });
    c.restore();
    nextX += hornW + 8;
  } else {
    const preview = engine.getUpcomingWavePreview();
    if (preview) {
      const pw = 116;
      drawIvorySlab(c, nextX, waveY, pw, waveH, 16, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.2);
      const previewIcon = preview.bosses[0] ?? preview.minion;
      drawText(c, preview.bosses.length > 0 ? (zh ? '首领' : 'Boss') : (zh ? '来袭' : 'Next'), nextX + 34, waveY + 27, 17, preview.bosses.length > 0 ? '#b6392c' : PALETTE.inkSoft, 'center', 900);
      drawSpriteContain(c, previewIcon, nextX + pw - 46, waveY + 6, 40, 40);
      nextX += pw + 8;
    }
  }

  // Fish Food Pill
  const foodW = 112;
  drawIvorySlab(c, nextX, waveY, foodW, waveH, 16, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.4);
  if (drawSpriteContain(c, 'ui_fish_food', nextX + 10, waveY + 8, 36, 36)) {
    drawText(c, String(player.food), nextX + 76, waveY + 27, 25, PALETTE.ink, 'center', 900);
  } else {
    drawText(c, `🐟${player.food}`, nextX + foodW / 2, waveY + 27, 22, PALETTE.ink, 'center', 900);
  }
  nextX += foodW + 8;

  // Oranges Pill
  const orangeW = state.endless && player.capyShieldReady ? 122 : 102;
  drawIvorySlab(c, nextX, waveY, orangeW, waveH, 16, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.4);
  if (drawSpriteContain(c, 'orange', nextX + 10, waveY + 9, 34, 34)) {
    drawText(c, `×${player.oranges}`, nextX + 72, waveY + 27, 24, player.oranges <= 1 ? '#c73a2b' : PALETTE.ink, 'center', 900);
    if (state.endless && player.capyShieldReady) {
      drawSpriteContain(c, 'ui_rank_protect_shield', nextX + orangeW - 26, waveY + 12, 22, 22);
    }
  } else {
    drawText(c, `🍊×${player.oranges}`, nextX + orangeW / 2, waveY + 27, 22, PALETTE.ink, 'center', 900);
  }
  nextX += orangeW + 10;

  // Top-Right Controls (EXACT Web order `p19_06`: [图鉴] [商店] [1×] [⏸] — respecting WeChat capsule!)
  const rightEdge = topRightEdge;
  const pauseW = 58, speedW = 68, shopW = 102, guideW = 102, ctrlH = 52;
  const maxSpd = maxBattleSpeed(profile);
  const showSpeed = maxSpd > 1 || (profile.matches ?? 0) >= 1;
  const showShop = isFeatureUnlocked(profile, 'market') || isFeatureUnlocked(profile, 'armory');

  const pauseX = rightEdge - pauseW;
  let cursorX = pauseX;
  let speedX = cursorX;
  if (showSpeed) {
    speedX = cursorX - 8 - speedW;
    cursorX = speedX;
  }
  let shopX = cursorX;
  if (showShop) {
    shopX = cursorX - 8 - shopW;
    cursorX = shopX;
  }
  const guideX = cursorX - 8 - guideW;
  const guideRect: TutorialRect = { x: guideX, y: waveY, w: guideW, h: ctrlH };

  drawButton(c, hits, 'battle:guide', guideX, waveY, guideW, ctrlH, zh ? '图鉴' : 'Guide', {
    ...BTN_STYLES.cream,
    radius: 15,
    fontSize: 18.5,
    icon: 'ui_compendium_book',
  });
  if (showShop) {
    drawButton(c, hits, 'battle:shop', shopX, waveY, shopW, ctrlH, zh ? '商店' : 'Shop', {
      ...BTN_STYLES.cream,
      radius: 15,
      fontSize: 18.5,
      icon: isFeatureUnlocked(profile, 'market') ? 'ui_shop_bag' : 'weapon_m10_bamboo_staff',
    });
  }
  if (showSpeed) {
    drawButton(c, hits, 'battle:speed', speedX, waveY, speedW, ctrlH, maxSpd <= 1 ? '1×🔒' : `${speed}×`, {
      ...(speed > 1 ? BTN_STYLES.gold : BTN_STYLES.cream),
      radius: 15,
      fontSize: maxSpd <= 1 ? 15.5 : 21,
    });
  }
  drawButton(c, hits, 'battle:pause', pauseX, waveY, pauseW, ctrlH, '⏸', {
    ...BTN_STYLES.cream,
    radius: 15,
    fontSize: 22,
  });

  // Boss Health Bar (sits cleanly between Oranges and Top-Right controls)
  const bossHud = getBossHUD(state);
  if (bossHud) {
    const availW = guideX - nextX - 10;
    if (availW >= 180) {
      const bw = Math.min(340, availW);
      const bx = nextX + (availW - bw) / 2;
      const by = 8;
      const bh = 52;
      round(c, bx, by, bw, bh, 15, bossHud.warning ? '#6b2019' : '#4d241c', bossHud.warning ? '#ffcf5c' : '#e68c64', 2.6);
      drawSpriteContain(c, bossHud.kind, bx + 6, by + 4, 44, 44);
      const bossName = `${t(`boss.${bossHud.kind}`)}${bossHud.count > 1 ? ` ×${bossHud.count}` : ''}`;
      drawText(c, bossName, bx + 54, by + 16, 15.5, '#fff8e4', 'left', 900);
      drawText(c, `${formatCompactNumber(bossHud.hp)}/${formatCompactNumber(bossHud.maxHp)}`, bx + bw - 10, by + 16, 13, '#ffe0b3', 'right', 900);
      drawProgressBar(c, bx + 54, by + 28, bw - 64, 12, bossHud.fraction, '#eb5442', 'rgba(255,255,255,0.2)', '#2d120c');
      drawProgressBar(c, bx + 54, by + 43, bw - 64, 5, 1 - bossHud.cooldownFraction, bossHud.warning ? '#ffe066' : '#76c5d9', 'rgba(255,255,255,0.14)', 'transparent');
    }
  }

  // Boss / Elite Arrival Alert Banner (exact Web `ui_alert_siren` style!)
  const alertEvent = [...state.events].reverse().find(
    ev => ev.side === 'player' && ev.enemyKind && (ev.effect === 'boss_spawn' || ev.effect === 'elite_spawn'),
  );
  if (alertEvent?.enemyKind) {
    const isBoss = Boolean(alertEvent.boss);
    const aw = 490, ah = 62, ax = (1280 - aw) / 2, ay = 76;
    round(c, ax, ay + 4, aw, ah, 18, 'rgba(30,10,6,0.42)', 'transparent', 0);
    round(c, ax, ay, aw, ah, 18, isBoss ? '#5e1f18' : '#4a301a', isBoss ? '#ffcf5c' : '#f2c872', 3);
    drawSpriteContain(c, 'ui_alert_siren', ax + 12, ay + 11, 40, 40);
    drawSpriteContain(c, alertEvent.enemyKind, ax + 56, ay + 7, 48, 48);
    const eName = t(`${isBoss ? 'boss' : 'enemy'}.${alertEvent.enemyKind}`);
    drawText(c, isBoss ? t('p9.boss', { name: eName }) : `${t('p9.elite')} · ${eName}`, ax + 114, ay + 22, 18, '#fff7dc', 'left', 900);
    const tipKey = isBoss ? `p1.boss.${alertEvent.enemyKind}.tip` : `p9.alert.${alertEvent.enemyKind}`;
    const tip = t(tipKey);
    drawText(c, tip.length > 26 ? `${tip.slice(0, 26)}…` : tip, ax + 114, ay + 45, 13.5, '#ffe2b8', 'left', 700);
  }

  // ── 2. LEFT VERTICAL MEDALLION RAIL (matches p19_02 & p19_06!) ────────────
  drawLeftToolRail(c, hits, state, profile, preparation, activePropId, highlightPropId, elapsed);

  // ── 3. RIGHT VERTICAL AURA RAIL (Active Broth + Passive Props + Prep `+`!) ─
  drawRightAuraRail(c, hits, state, profile, preparation, expandedPassiveId);

  // ── 4. BOTTOM SUMMON BELL & GOLDEN HERO MERGE CALLOUT (clean open right grass!) ─
  drawBottomControls(c, hits, engine, activePropId, shovelSelected, elapsed);

  // ── 5. MATCH-1 6-STEP GUIDED TUTORIAL OVERLAY ─────────────────────────────
  if (tutorialStep !== 'done') {
    drawTutorialOverlay(c, hits, tutorialStep, state, guideRect, avoidRects, elapsed);
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
  const rx = 42;
  const size = 88;

  // Compact Square Cream Sprinkler Medallion
  const spY = 230;
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
    20,
    used ? '#cfc6b8' : '#fffdf6',
    used ? '#b8ae9e' : '#e4f4eb',
    used ? '#7d7366' : '#3a6e59',
    3,
  );
  drawSpriteContain(c, 'sprinkler', rx + 12, spY + spDy + 10, 64, 64, used ? 0.38 : 1);
  round(c, rx + size - 30, spY + spDy + size - 28, 30, 26, 13, used ? '#8c8175' : '#4a997e', '#fffdf5', 2);
  drawText(c, used ? '0' : '1', rx + size - 15, spY + spDy + size - 14, 16, '#fffdf5', 'center', 900);

  // Equipped Active Props (+ soft dashed `+` prep slot when Market unlocked, matching `p19_06`!)
  const equipped = player.loadout.equippedActiveProps.filter(id => PROPS[id]?.type === 'active').slice(0, 2);
  const slotCount = preparation && isFeatureUnlocked(profile, 'market') ? 2 : equipped.length;

  for (let index = 0; index < slotCount; index++) {
    const propId = equipped[index];
    const py = 332 + index * 92;
    const ph = 82;

    if (!propId) {
      hits.add({ id: 'battle:backpack', x: rx, y: py, w: size, h: ph });
      c.save();
      c.setLineDash([6, 5]);
      round(c, rx, py, size, ph, 18, 'rgba(235,244,218,0.58)', '#4a6b3e', 2);
      c.restore();
      drawText(c, '+', rx + size / 2, py + ph / 2, 30, '#3a5730', 'center', 900);
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
      const glow = 0.55 + 0.45 * Math.sin(elapsed * 6);
      round(c, rx - 5, py - 5, size + 10, ph + 10, 22, 'rgba(255,220,76,0.28)', `rgba(255,212,56,${glow.toFixed(2)})`, 4.5);
    }
    drawIvorySlab(
      c,
      rx,
      py,
      size,
      ph,
      18,
      selected || highlighted ? '#fff0ad' : ready ? '#fffdf6' : '#c8bfb0',
      selected || highlighted ? '#f7ca57' : ready ? '#f4e1ba' : '#ada394',
      selected || highlighted ? '#c75a16' : '#5a3a1e',
      selected || highlighted ? 3.5 : 2.6,
    );
    if (!drawSpriteContain(c, `prop_${propId}`, rx + 12, py + 7, 64, 62, ready ? 1 : 0.4)) {
      drawText(c, def.icon, rx + size / 2, py + 38, 36, PALETTE.ink, 'center', 700);
    }

    if (ready) {
      if (selected) {
        round(c, rx + 4, py + ph - 22, size - 8, 20, 10, '#c75a16', 'transparent', 0);
        drawText(c, zh ? '点释放' : 'Cast', rx + size / 2, py + ph - 11, 12.5, '#fffdf5', 'center', 900);
      } else {
        // Exact Web `p19_06` clean numeric level badge (no mid-word truncated Chinese title!)
        round(c, rx + size - 30, py + ph - 26, 28, 24, 12, '#6a4626', '#fffdf5', 2);
        drawText(c, String(lv), rx + size - 16, py + ph - 13, 14, '#fffdf5', 'center', 900);
      }
    } else {
      round(c, rx + 6, py + 6, size - 12, ph - 12, 14, 'rgba(34,20,10,0.52)', 'transparent', 0);
      drawText(c, `${Math.ceil(cd)}s`, rx + size / 2, py + ph / 2, 22, '#fff6d6', 'center', 900, INK, 4);
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
): void {
  const loadout = state.sides.player.loadout;
  const activeBroth = getActiveBroth(loadout);
  const passives = loadout.equippedPassiveProps.filter(id => PROPS[id]?.type === 'passive').slice(0, 6);
  const showPrepPassives = preparation && isFeatureUnlocked(profile, 'market');
  if (!activeBroth && passives.length === 0 && !showPrepPassives) return;

  const rx = 1166;
  let y = 78;
  const tileW = 72;
  const tileH = 66;
  const zh = getLanguage() === 'zh-CN';

  // Active Broth Pill
  if (activeBroth) {
    const id = 'broth';
    const expanded = expandedPassiveId === id;
    hits.add({ id: `battle:passive:${id}`, x: rx, y, w: tileW, h: tileH });
    drawIvorySlab(c, rx, y, tileW, tileH, 16, expanded ? '#fff2b2' : '#fffdf6', expanded ? '#f7d56a' : '#f5e4c2', '#5c3b1e', 2.4);
    round(c, rx + 12, y + 4, 48, 42, 11, activeBroth.def.bathColor, '#6e4b2b', 1.5);
    drawSpriteContain(c, activeBroth.def.id, rx + 16, y + 6, 40, 38);
    round(c, rx + 6, y + tileH - 20, tileW - 12, 18, 9, '#4a2b16', 'transparent', 0);
    drawText(c, `Lv.${activeBroth.level}`, rx + tileW / 2, y + tileH - 10, 12.5, '#fffdf5', 'center', 900);

    if (expanded) {
      drawRightTooltip(c, rx - 310, y, 298, `${t(`broth.${activeBroth.def.id}`)} Lv.${activeBroth.level}`, t('p14.railLive'));
    }
    y += tileH + 8;
  }

  // Passive Aura Header Badge (`ui_passive_aura_badge` + 被动 — soft cream backing so it pops over map flora!)
  if (passives.length > 0 || showPrepPassives) {
    round(c, rx + 14, y - 2, 44, 34, 17, 'rgba(255,248,232,0.86)', '#6e4926', 1.6);
    drawSpriteContain(c, 'ui_passive_aura_badge', rx + 20, y, 32, 30);
    round(c, rx + 10, y + 26, tileW - 20, 20, 10, 'rgba(62,38,18,0.9)', 'transparent', 0);
    drawText(c, t('p13.passives'), rx + tileW / 2, y + 36, 12, '#fffdf5', 'center', 900);
    y += 52;
  }

  // Passive Props (+ dashed `+` slots during Wave-1 prep)
  const slotCount = showPrepPassives ? 6 : passives.length;
  const pH = slotCount > 4 ? 58 : tileH;
  for (let i = 0; i < slotCount; i++) {
    const propId = passives[i];
    if (!propId) {
      hits.add({ id: 'battle:backpack', x: rx, y, w: tileW, h: pH });
      c.save();
      c.setLineDash([5, 4]);
      round(c, rx + 6, y, tileW - 12, pH, 14, 'rgba(235,244,218,0.52)', '#4a6b3e', 1.8);
      c.restore();
      drawText(c, '+', rx + tileW / 2, y + pH / 2, 24, '#3a5730', 'center', 900);
      y += pH + 6;
      continue;
    }

    const def = PROPS[propId];
    const lv = loadout.ownedProps[propId] ?? 1;
    const expanded = expandedPassiveId === propId;
    hits.add({ id: `battle:passive:${propId}`, x: rx, y, w: tileW, h: pH });
    drawIvorySlab(c, rx, y, tileW, pH, 15, expanded ? '#fff2b2' : '#fffdf6', expanded ? '#f7d56a' : '#f5e4c2', '#5c3b1e', 2.2);
    if (!drawSpriteContain(c, `prop_${propId}`, rx + 14, y + 4, 44, pH - 22)) {
      drawText(c, def.icon, rx + tileW / 2, y + pH / 2 - 6, 26, PALETTE.ink, 'center', 700);
    }
    round(c, rx + 6, y + pH - 19, tileW - 12, 17, 8, '#4a2b16', 'transparent', 0);
    drawText(c, `Lv.${lv}`, rx + tileW / 2, y + pH - 10, 12, '#fffdf5', 'center', 900);

    if (expanded) {
      drawRightTooltip(c, rx - 310, Math.min(540, y), 298, `${zh ? def.name['zh-CN'] : def.name.en} Lv.${lv}`, zh ? def.description['zh-CN'] : def.description.en);
    }
    y += pH + 6;
  }
}

function drawRightTooltip(c: CanvasRenderingContext2D, x: number, y: number, w: number, title: string, body: string): void {
  drawWoodPanel(c, x, y, w, 108, 16, '#fffaf0', PALETTE.woodDark);
  drawText(c, title, x + 16, y + 26, 18, PALETTE.ink, 'left', 900);
  drawWrappedText(c, body, x + 16, y + 44, w - 32, 15, 20, PALETTE.inkSoft, 'left', 700, 3);
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

  // Golden Hero-Merge Callout Pill floating directly above Summon Bell (EXACT `p19_02`!)
  const mergeOpts = getHeroMergeOptions(state);
  if (mergeOpts.length > 0 && !activePropId && !shovelSelected) {
    const heroName = t(`hero.${mergeOpts[0].heroId}`);
    const label = zh ? `✦ 可合成【${heroName}】!` : `✦ Ready: ${heroName}!`;
    const mw = 260, mh = 34;
    const mx = STAGE.summonX + (STAGE.summonW - mw) / 2;
    const my = STAGE.summonY - mh - 4;
    const bounce = Math.sin(elapsed * 5.2) * 2;
    round(c, mx, my + bounce + 2, mw, mh, 17, 'rgba(54,28,6,0.36)', 'transparent', 0);
    round(c, mx, my + bounce, mw, mh, 17, '#f8d254', '#7a450b', 2.4);
    drawText(c, label, mx + mw / 2, my + bounce + mh / 2 + 1, 16.5, '#472408', 'center', 900);
  }

  // Big Warm Gold Summon Bell Button (`34px` bold fish cost!)
  const cost = getSummonCost(player.summons);
  const canAfford = player.food >= cost && state.phase === 'playing';
  const pressed = canAfford && hits.isPressed('battle:summon');
  const dy = pressed ? 3 : 0;
  const sx = STAGE.summonX, sy = STAGE.summonY, sw = STAGE.summonW, sh = STAGE.summonH;

  hits.add({ id: 'battle:summon', x: sx, y: sy, w: sw, h: sh, disabled: !canAfford });
  if (!pressed) {
    round(c, sx, sy + 5, sw, sh, 20, canAfford ? '#b57416' : '#8c8070', PALETTE.woodDark, 2.5);
  }
  round(c, sx, sy + dy, sw, sh, 20, canAfford ? '#f6d572' : '#d2c9b8', PALETTE.woodDark, 3.2);
  if (canAfford) {
    round(c, sx + 6, sy + dy + 4, sw - 12, 16, 10, 'rgba(255,255,255,0.32)', 'transparent', 0);
  }

  drawSpriteContain(c, 'ui_bell_summon', sx + 22, sy + dy + 17, 58, 58, canAfford ? 1 : 0.45);
  drawSpriteContain(c, 'ui_fish_food', sx + 96, sy + dy + 28, 36, 36, canAfford ? 1 : 0.45);
  drawText(c, String(cost), sx + 172, sy + dy + 48, 34, canAfford ? '#3f220d' : '#736757', 'center', 900);
  drawText(c, '↻5', sx + sw - 26, sy + dy + 20, 15.5, '#6b4722', 'center', 800);

  // Clean targeting Cancel pill ONLY when player actively selected a Prop or Shovel (otherwise right grass stays 100% open like Web!)
  if (activePropId || shovelSelected) {
    const label = activePropId
      ? (zh ? `释放「${PROPS[activePropId]?.name['zh-CN']}」· 点取消` : `Cast ${PROPS[activePropId]?.name.en} · Cancel`)
      : (zh ? '点绿草坪开垦 · 点取消' : 'Tap grass to dig · Cancel');
    drawButton(c, hits, 'battle:cancel-mode', 1044, STAGE.summonY + 14, 218, 60, label, {
      ...BTN_STYLES.coral,
      radius: 16,
      fontSize: 16,
    });
  }
}

function drawTutorialOverlay(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  step: Exclude<TutorialStep, 'done'>,
  state: BattleState,
  guideRect: TutorialRect,
  avoidRects: readonly StageRect[],
  elapsed: number,
): void {
  const targets = tutorialTargets(step, state, guideRect);
  const pulse = 0.55 + 0.45 * Math.sin(elapsed * 5.2);

  if (targets.source) {
    const r = targets.source;
    round(c, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 18, `rgba(255,224,102,${(0.16 * pulse).toFixed(2)})`, `rgba(255,216,74,${(0.75 + 0.25 * pulse).toFixed(2)})`, 4);
  }
  if (targets.target) {
    const r = targets.target;
    round(c, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 16, `rgba(148,224,112,${(0.2 * pulse).toFixed(2)})`, `rgba(255,228,112,${(0.75 + 0.25 * pulse).toFixed(2)})`, 3.5);
  }
  if (targets.source && targets.target) {
    const ax = targets.source.x + targets.source.w / 2;
    const ay = targets.source.y + targets.source.h / 2;
    const bx = targets.target.x + targets.target.w / 2;
    const by = targets.target.y + targets.target.h / 2;
    c.save();
    c.strokeStyle = '#ffdf6b';
    c.lineWidth = 4.5;
    c.setLineDash([12, 8]);
    c.lineDashOffset = -elapsed * 32;
    c.beginPath();
    c.moveTo(ax, ay);
    c.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - 24, bx, by);
    c.stroke();
    c.restore();
  }

  const acknowledge = targets.acknowledge || step === 6;
  const bubbleW = 486;
  const bubbleH = step === 5 ? 256 : acknowledge ? 228 : 200;
  const targetRects = [targets.target, targets.source].filter((r): r is TutorialRect => Boolean(r));
  const b = placeTutorialBubble([...targetRects, ...avoidRects], { w: bubbleW, h: bubbleH });

  drawWoodPanel(c, b.x, b.y, b.w, b.h, 22, '#fffdf6', '#69411b');
  hits.add({ id: 'battle:tutorial-bg', x: b.x, y: b.y, w: b.w, h: b.h });

  drawSpriteContain(c, 'ui_tutorial_capy', b.x + 16, b.y + 12, 64, 64);
  round(c, b.x + 88, b.y + 14, 96, 26, 13, '#4c9883', 'transparent', 0);
  drawText(c, `STEP ${step}/6`, b.x + 136, b.y + 28, 13.5, '#fffdf5', 'center', 900);

  drawButton(c, hits, 'battle:tutorial-skip', b.x + b.w - 92, b.y + 12, 78, 34, t('p1.tutorialSkip'), {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 15,
  });

  const titleKey = step === 2 ? 'p19.tutorialDig.title' : step === 1 ? 'p5.tutorial1.title' : `p5.tutorial${step - 1}.title`;
  const bodyKey = step === 2 ? 'p19.tutorialDig.body' : step === 5 ? 'p6.tutorial4Body' : step === 6 ? 'p19.tutorial6.body' : step === 1 ? 'p5.tutorial1.body' : `p5.tutorial${step - 1}.body`;

  drawText(c, t(titleKey), b.x + 88, b.y + 58, 21, PALETTE.ink, 'left', 900);
  let cy = b.y + 84;
  cy += drawWrappedText(c, t(bodyKey), b.x + 20, cy, b.w - 40, 17, 24, PALETTE.inkSoft, 'left', 700, 4);

  if (step === 5) {
    const eqY = cy + 6;
    round(c, b.x + 20, eqY, b.w - 40, 52, 14, '#f4e3bd', PALETTE.woodLight, 1.8);
    drawSpriteContain(c, 'panda', b.x + 34, eqY + 6, 40, 40);
    drawText(c, '+', b.x + 88, eqY + 26, 22, PALETTE.ink, 'center', 900);
    drawSpriteContain(c, 'hat_bamboo', b.x + 104, eqY + 6, 40, 40);
    drawText(c, '=', b.x + 158, eqY + 26, 22, PALETTE.ink, 'center', 900);
    drawSpriteContain(c, 'kungfu_po', b.x + 174, eqY + 4, 44, 44);
    drawText(c, t('hero.kungfu_po'), b.x + 228, eqY + 26, 19, '#7e3c0e', 'left', 900);
  }

  const dotY = b.y + b.h - (acknowledge ? 72 : 28);
  for (let n = 1; n <= 6; n++) {
    const dx = b.x + b.w / 2 + (n - 3.5) * 34;
    const fill = n === step ? '#f4c855' : n < step ? '#6db85a' : '#dfd2b8';
    round(c, dx - 12, dotY - 12, 24, 24, 12, fill, PALETTE.woodDark, 1.8);
    drawText(c, String(n), dx, dotY + 1, 14, n === step ? PALETTE.ink : n < step ? '#fffdf5' : PALETTE.muted, 'center', 900);
  }

  if (acknowledge) {
    drawButton(c, hits, 'battle:tutorial-ack', b.x + b.w / 2 - 102, b.y + b.h - 50, 204, 40, t('p1.tutorialAck'), {
      ...BTN_STYLES.teal,
      radius: 14,
      fontSize: 17,
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
