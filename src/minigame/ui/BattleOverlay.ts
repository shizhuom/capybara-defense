import { getActiveBroth } from '../../config/kitchen';
import { STAGE } from '../../config/maps';
import { PROPS } from '../../config/props';
import { getSummonCost } from '../../config/units';
import type { BattleEngine } from '../../core/BattleEngine';
import { maxBattleSpeed } from '../../core/FeatureUnlocks';
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
 * 1:1 Web Battle HUD (`p19_02_tutorial_step2_shovel.png` style) tuned for phone readability:
 * - Large bold numbers & labels across top bar, left medallions, bottom summon bell, and tutorial.
 * - ZERO auto-popping right-side unit stats card (keeps the entire garden & right rail unobstructed!).
 * - Includes Boss/Elite siren alert banners and brief battle-start clash curtain.
 */
export function drawBattleOverlay(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  ctx: BattleOverlayContext,
): BattleOverlayResult {
  const { engine, profile, elapsed, speed, shovelSelected, activePropId, expandedPassiveId, tutorialStep, topRightEdge, viewport: vp, curtainRemaining } = ctx;
  const state = engine.state;
  const player = state.sides.player;
  const zh = getLanguage() === 'zh-CN';
  const avoidRects: StageRect[] = [];

  // ── 1. TOP HUD BAR (y: 8..60 — matches p19_02 with big readable mobile fonts!) ──
  const waveHud = getWaveHUD(state);
  const waveX = 16, waveY = 8, waveW = 148, waveH = 52;
  drawIvorySlab(c, waveX, waveY, waveW, waveH, 16, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.4);
  if (state.endless) {
    drawSpriteContain(c, 'ui_endless_emblem', waveX + 8, waveY + 9, 34, 34);
    drawText(c, `W${state.wave}`, waveX + 94, waveY + 27, 23, '#6b2f94', 'center', 900);
  } else {
    drawSpriteContain(c, 'ui_wave_horn', waveX + 8, waveY + 9, 34, 34);
    drawText(c, `${state.wave}/10`, waveX + 92, waveY + 27, 23, PALETTE.ink, 'center', 900);
  }

  // Crisp timer pill tucked directly below Wave pill (exact p19_02 position!)
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
    const hornW = 142;
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
      const pw = 120;
      drawIvorySlab(c, nextX, waveY, pw, waveH, 16, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.2);
      const previewIcon = preview.bosses[0] ?? preview.minion;
      drawText(c, preview.bosses.length > 0 ? (zh ? '首领' : 'Boss') : (zh ? '来袭' : 'Next'), nextX + 34, waveY + 27, 17, preview.bosses.length > 0 ? '#b6392c' : PALETTE.inkSoft, 'center', 900);
      drawSpriteContain(c, previewIcon, nextX + pw - 48, waveY + 6, 40, 40);
      nextX += pw + 8;
    }
  }

  // Fish Food Pill (big bold 25px digits!)
  const foodW = 114;
  drawIvorySlab(c, nextX, waveY, foodW, waveH, 16, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.4);
  if (drawSpriteContain(c, 'ui_fish_food', nextX + 10, waveY + 8, 36, 36)) {
    drawText(c, String(player.food), nextX + 78, waveY + 27, 25, PALETTE.ink, 'center', 900);
  } else {
    drawText(c, `🐟${player.food}`, nextX + foodW / 2, waveY + 27, 22, PALETTE.ink, 'center', 900);
  }
  nextX += foodW + 8;

  // Oranges Pill (big bold 25px digits!)
  const orangeW = state.endless && player.capyShieldReady ? 124 : 104;
  drawIvorySlab(c, nextX, waveY, orangeW, waveH, 16, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.4);
  if (drawSpriteContain(c, 'orange', nextX + 10, waveY + 9, 34, 34)) {
    drawText(c, `×${player.oranges}`, nextX + 74, waveY + 27, 24, player.oranges <= 1 ? '#c73a2b' : PALETTE.ink, 'center', 900);
    if (state.endless && player.capyShieldReady) {
      drawSpriteContain(c, 'ui_rank_protect_shield', nextX + orangeW - 26, waveY + 12, 22, 22);
    }
  } else {
    drawText(c, `🍊×${player.oranges}`, nextX + orangeW / 2, waveY + 27, 22, PALETTE.ink, 'center', 900);
  }
  nextX += orangeW + 10;

  // Top-Right Controls (respects WeChat capsule & wide-phone safe bounds!)
  const rightEdge = topRightEdge;
  const pauseW = 58, guideW = 104, speedW = 72, ctrlH = 52;
  const pauseX = rightEdge - pauseW;
  const guideX = pauseX - 8 - guideW;
  const speedX = guideX - 8 - speedW;
  const guideRect: TutorialRect = { x: guideX, y: waveY, w: guideW, h: ctrlH };

  const maxSpd = maxBattleSpeed(profile);
  const showSpeed = maxSpd > 1 || (profile.matches ?? 0) >= 1;
  if (showSpeed) {
    drawButton(c, hits, 'battle:speed', speedX, waveY, speedW, ctrlH, maxSpd <= 1 ? '1×🔒' : `${speed}×`, {
      ...(speed > 1 ? BTN_STYLES.gold : BTN_STYLES.cream),
      radius: 15,
      fontSize: maxSpd <= 1 ? 16 : 21,
    });
  }
  drawButton(c, hits, 'battle:guide', guideX, waveY, guideW, ctrlH, zh ? '图鉴' : 'Guide', {
    ...BTN_STYLES.cream,
    radius: 15,
    fontSize: 19,
    icon: 'ui_compendium_book',
  });
  drawButton(c, hits, 'battle:pause', pauseX, waveY, pauseW, ctrlH, '⏸', {
    ...BTN_STYLES.cream,
    radius: 15,
    fontSize: 22,
  });

  // Boss Health Bar (sits cleanly between Oranges and Top-Right controls)
  const bossHud = getBossHUD(state);
  const rightBarEdge = showSpeed ? speedX : guideX;
  if (bossHud) {
    const availW = rightBarEdge - nextX - 10;
    if (availW >= 200) {
      const bw = Math.min(350, availW);
      const bx = nextX + (availW - bw) / 2;
      const by = 8;
      const bh = 52;
      round(c, bx, by, bw, bh, 15, bossHud.warning ? '#6b2019' : '#4d241c', bossHud.warning ? '#ffcf5c' : '#e68c64', 2.6);
      drawSpriteContain(c, bossHud.kind, bx + 6, by + 4, 44, 44);
      const bossName = `${t(`boss.${bossHud.kind}`)}${bossHud.count > 1 ? ` ×${bossHud.count}` : ''}`;
      drawText(c, bossName, bx + 56, by + 16, 16, '#fff8e4', 'left', 900);
      drawText(c, `${formatCompactNumber(bossHud.hp)}/${formatCompactNumber(bossHud.maxHp)}`, bx + bw - 10, by + 16, 13.5, '#ffe0b3', 'right', 900);
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

  // ── 2. LEFT VERTICAL MEDALLION RAIL (matches p19_02 compact squares!) ─────
  drawLeftToolRail(c, hits, state, activePropId, elapsed);

  // ── 3. RIGHT VERTICAL AURA RAIL (Active Broth + Passive Props) ────────────
  drawRightAuraRail(c, hits, state, expandedPassiveId);

  // ── 4. BOTTOM SUMMON BELL, HERO MERGE CALLOUT & STATUS CHIP ───────────────
  drawBottomControls(c, hits, engine, activePropId, shovelSelected, elapsed);

  // ── 5. MATCH-1 6-STEP GUIDED TUTORIAL OVERLAY (larger mobile fonts!) ──────
  if (tutorialStep !== 'done') {
    drawTutorialOverlay(c, hits, tutorialStep, state, guideRect, avoidRects, elapsed);
  }

  // ── 6. BRIEF OPENING BATTLE CLASH CURTAIN (tap anywhere to skip!) ─────────
  if (curtainRemaining > 0) {
    drawBattleCurtain(c, hits, state, curtainRemaining, vp);
  }

  return { guideRect, avoidRects };
}

function drawLeftToolRail(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  activePropId: string | undefined,
  elapsed: number,
): void {
  const player = state.sides.player;
  const zh = getLanguage() === 'zh-CN';
  const rx = 42;
  const size = 88;

  // Compact Square Cream Sprinkler Medallion (exact p19_02 look!)
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
  // Crisp bottom-right count pill (`1` or `0`)
  round(c, rx + size - 30, spY + spDy + size - 28, 30, 26, 13, used ? '#8c8175' : '#4a997e', '#fffdf5', 2);
  drawText(c, used ? '0' : '1', rx + size - 15, spY + spDy + size - 14, 16, '#fffdf5', 'center', 900);

  // Equipped Active Props (square tactile medallions stacked cleanly below Sprinkler)
  const equipped = player.loadout.equippedActiveProps.filter(id => PROPS[id]?.type === 'active').slice(0, 3);
  equipped.forEach((propId, index) => {
    const def = PROPS[propId];
    const py = 332 + index * 92;
    const ph = 82;
    const cd = Math.max(0, player.propCooldowns[propId] ?? 0);
    const ready = cd <= 0.05;
    const selected = activePropId === propId;
    const pulse = selected ? 1 + Math.sin(elapsed * 6) * 0.035 : 1;

    hits.add({ id: `battle:prop:${propId}`, x: rx, y: py, w: size, h: ph, data: propId, disabled: !ready });

    c.save();
    if (selected) {
      c.translate(rx + size / 2, py + ph / 2);
      c.scale(pulse, pulse);
      c.translate(-(rx + size / 2), -(py + ph / 2));
    }
    drawIvorySlab(
      c,
      rx,
      py,
      size,
      ph,
      18,
      selected ? '#fff0ad' : ready ? '#fffdf6' : '#c8bfb0',
      selected ? '#f7ca57' : ready ? '#f4e1ba' : '#ada394',
      selected ? '#c75a16' : '#5a3a1e',
      selected ? 3.5 : 2.6,
    );
    if (!drawSpriteContain(c, `prop_${propId}`, rx + 14, py + 8, 60, 56, ready ? 1 : 0.4)) {
      drawText(c, def.icon, rx + size / 2, py + 38, 36, PALETTE.ink, 'center', 700);
    }

    if (ready) {
      const shortName = (zh ? def.name['zh-CN'] : def.name.en).slice(0, 4);
      round(c, rx + 4, py + ph - 22, size - 8, 20, 10, selected ? '#c75a16' : 'rgba(74,43,22,0.84)', 'transparent', 0);
      drawText(c, selected ? (zh ? '点释放' : 'Cast') : shortName, rx + size / 2, py + ph - 11, 12.5, '#fffdf5', 'center', 900);
    } else {
      round(c, rx + 6, py + 6, size - 12, ph - 12, 14, 'rgba(34,20,10,0.52)', 'transparent', 0);
      drawText(c, `${Math.ceil(cd)}s`, rx + size / 2, py + ph / 2, 22, '#fff6d6', 'center', 900, INK, 4);
    }
    c.restore();
  });
}

function drawRightAuraRail(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  state: BattleState,
  expandedPassiveId: string | undefined,
): void {
  const loadout = state.sides.player.loadout;
  const activeBroth = getActiveBroth(loadout);
  const passives = loadout.equippedPassiveProps.filter(id => PROPS[id]?.type === 'passive').slice(0, 6);
  if (!activeBroth && passives.length === 0) return;

  const rx = 1172;
  const size = 74;
  let y = 84;

  if (activeBroth) {
    const { def, level } = activeBroth;
    const exp = expandedPassiveId === 'broth';
    hits.add({ id: 'battle:passive:broth', x: rx, y, w: size, h: size });
    drawIvorySlab(c, rx, y, size, size, 16, '#fffdf7', def.bathColor, exp ? '#c25711' : '#5a3a1e', exp ? 3 : 2.2);
    if (!drawSpriteContain(c, def.id, rx + 9, y + 6, 56, 52)) {
      drawSpriteContain(c, 'ui_kitchen_pot', rx + 9, y + 6, 56, 52);
    }
    round(c, rx + 10, y + size - 22, size - 20, 20, 10, '#4a2b16', 'transparent', 0);
    drawText(c, `Lv.${level}`, rx + size / 2, y + size - 11, 13.5, '#fff6df', 'center', 900);
    if (exp) {
      drawAuraTooltip(c, rx - 310, y, `${t(`broth.${def.id}`)} Lv.${level}`, t('p14.railLive'));
    }
    y += size + 10;
  }

  for (const propId of passives) {
    const def = PROPS[propId];
    const exp = expandedPassiveId === propId;
    hits.add({ id: `battle:passive:${propId}`, x: rx, y, w: size, h: 66 });
    drawIvorySlab(c, rx, y, size, 66, 15, exp ? '#fff0b3' : '#fffdf7', exp ? '#f5d26a' : '#f4e2bc', exp ? '#c25711' : '#5a3a1e', exp ? 3 : 2.2);
    if (!drawSpriteContain(c, `prop_${propId}`, rx + 13, y + 5, 48, 44)) {
      drawText(c, def.icon, rx + size / 2, y + 28, 28, PALETTE.ink, 'center', 700);
    }
    round(c, rx + 12, y + 46, size - 24, 18, 9, '#4a2b16', 'transparent', 0);
    drawText(c, `Lv.${loadout.ownedProps[propId] ?? 1}`, rx + size / 2, y + 55, 12.5, '#fff6df', 'center', 900);
    if (exp) {
      drawAuraTooltip(c, rx - 310, Math.min(y, 430), t(`prop.${propId}`), t(`prop.${propId}.desc`));
    }
    y += 74;
  }
}

function drawAuraTooltip(c: CanvasRenderingContext2D, x: number, y: number, title: string, desc: string): void {
  const w = 298;
  const h = 116;
  drawWoodPanel(c, x, y, w, h, 16, PALETTE.creamSoft, PALETTE.woodDark);
  drawText(c, title, x + 16, y + 26, 18, PALETTE.ink, 'left', 900);
  drawWrappedText(c, desc, x + 16, y + 44, w - 32, 15.5, 21, PALETTE.inkSoft, 'left', 700, 3);
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
  const cost = getSummonCost(player.summons);
  const affordable = player.food >= cost;
  const benchCount = state.units.filter(u => u.side === 'player' && u.location.zone === 'bench').length;
  const heroOptions = getHeroMergeOptions(state);

  const sx = STAGE.summonX, sy = STAGE.summonY, sw = STAGE.summonW, sh = STAGE.summonH;
  const pressed = hits.isPressed('battle:summon');
  const dy = pressed ? 3 : 0;
  hits.add({ id: 'battle:summon', x: sx, y: sy, w: sw, h: sh });

  // Hero-Merge Golden Ribbon above Summon Bell (exact p19_02 look!)
  if (heroOptions.length > 0) {
    const heroName = t(`hero.${heroOptions[0].heroId}`);
    const ribbonText = zh ? `✦ 可合成【${heroName}】!` : `✦ Merge ${heroName}!`;
    const glow = 0.85 + Math.sin(elapsed * 5) * 0.15;
    c.save();
    c.globalAlpha = glow;
    round(c, sx - 6, sy - 32, sw + 12, 30, 15, '#f6cf55', '#5a3414', 2.4);
    drawText(c, ribbonText, sx + sw / 2, sy - 16, 16.5, '#462208', 'center', 900);
    c.restore();
  }

  // Summon Bell Slab (big readable 32px cost!)
  if (!pressed) round(c, sx, sy + 5, sw, sh, 20, affordable ? '#8f622a' : '#857866', PALETTE.woodDark, 2.2);
  round(c, sx, sy + dy, sw, sh, 20, affordable ? '#f5db8c' : '#e6d9c2', PALETTE.woodDark, 3.2);
  round(c, sx + 6, sy + dy + 4, sw - 12, 16, 8, 'rgba(255,255,255,0.28)', 'transparent', 0);

  if (drawSpriteContain(c, 'ui_bell_summon', sx + 22, sy + dy + 16, 60, 60)) {
    drawSpriteContain(c, 'ui_fish_food', sx + 96, sy + dy + 28, 36, 36);
    drawText(c, String(cost), sx + 168, sy + dy + sh / 2 + 2, 34, affordable ? '#3e2310' : '#c74232', 'center', 900);
  } else {
    drawText(c, `🔔 ${cost}`, sx + sw / 2, sy + dy + sh / 2, 30, affordable ? PALETTE.ink : '#c74232', 'center', 900);
  }
  if (benchCount > 0) {
    drawText(c, `↻${benchCount}`, sx + sw - 18, sy + dy + 20, 16, '#6e4926', 'right', 900);
  }

  // Bottom-Right Cancel / Shovel Recharge Chip (big mobile font!)
  const cx = 1044, cy = 614, cw = 218, ch = 84;
  if (activePropId) {
    drawButton(c, hits, 'battle:cancel-mode', cx, cy, cw, ch, zh ? '✕ 取消道具' : '✕ Cancel Prop', {
      ...BTN_STYLES.coral,
      radius: 18,
      fontSize: 20,
    });
  } else if (shovelSelected) {
    drawButton(c, hits, 'battle:cancel-mode', cx, cy, cw, ch, zh ? '✕ 取消铁锹' : '✕ Cancel Dig', {
      ...BTN_STYLES.coral,
      radius: 18,
      fontSize: 20,
    });
  } else {
    const rules = engine.getShovelRules();
    const remain = Math.max(0, Math.ceil(rules.interval - player.shovelTimer));
    drawIvorySlab(c, cx, cy, cw, ch, 18, 'rgba(255,252,242,0.92)', 'rgba(244,226,188,0.92)', '#6a4626', 2.4);
    drawText(c, t(`map.${state.mapId}`), cx + cw / 2, cy + 28, 19, PALETTE.ink, 'center', 900);
    const shovelInfo = player.shovels >= rules.maxStored
      ? (zh ? `铁锹已满 ${player.shovels}/${rules.maxStored}` : `Shovels ${player.shovels}/${rules.maxStored}`)
      : (zh ? `铁锹 ${player.shovels}/${rules.maxStored} · ${remain}s` : `Shovel ${player.shovels}/${rules.maxStored} · ${remain}s`);
    drawText(c, shovelInfo, cx + cw / 2, cy + 58, 16, PALETTE.inkSoft, 'center', 800);
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
  const { source, target, acknowledge } = tutorialTargets(step, state, guideRect);
  const rects = [target, source].filter((r): r is TutorialRect => !!r);
  const pulse = 0.65 + Math.sin(elapsed * 5.2) * 0.35;

  for (const r of rects) {
    c.save();
    c.strokeStyle = `rgba(255,228,112,${pulse.toFixed(2)})`;
    c.lineWidth = 5;
    c.beginPath();
    c.roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 16);
    c.stroke();
    c.fillStyle = `rgba(255,232,128,${(0.16 * pulse).toFixed(2)})`;
    c.fill();
    c.restore();
  }

  if (source && target) {
    const sx = source.x + source.w / 2, sy = source.y + source.h / 2;
    const tx = target.x + target.w / 2, ty = target.y + target.h / 2;
    const cx = sx, cy = ty;
    c.save();
    c.strokeStyle = '#ffe078';
    c.lineWidth = 6;
    c.setLineDash([14, 9]);
    c.lineDashOffset = -elapsed * 42;
    c.beginPath();
    c.moveTo(sx, sy);
    c.quadraticCurveTo(cx, cy, tx, ty);
    c.stroke();
    c.setLineDash([]);
    const angle = Math.atan2(ty - cy, tx - cx);
    c.fillStyle = '#ffe078';
    c.beginPath();
    c.moveTo(tx, ty);
    c.lineTo(tx - 18 * Math.cos(angle - 0.45), ty - 18 * Math.sin(angle - 0.45));
    c.lineTo(tx - 18 * Math.cos(angle + 0.45), ty - 18 * Math.sin(angle + 0.45));
    c.closePath();
    c.fill();
    c.restore();
  }

  if (target && (step === 1 || step === 6)) {
    const bob = Math.sin(elapsed * 6) * 6;
    const px = target.x + target.w * 0.65;
    const py = step === 1 ? target.y - 58 + bob : target.y + target.h + 4 + bob;
    drawSpriteContain(c, 'ui_tutorial_pointer', px, py, 60, 60);
  }

  // Larger mobile-readable tutorial bubble!
  const bubbleSize = { w: 486, h: step === 5 ? 290 : acknowledge ? 268 : 228 };
  const b = placeTutorialBubble([...rects, ...avoidRects], bubbleSize);
  drawWoodPanel(c, b.x, b.y, b.w, b.h, 22, '#fff9eb', '#6a4420');
  hits.add({ id: 'battle:tutorial-bg', x: b.x, y: b.y, w: b.w, h: b.h });

  drawSpriteContain(c, 'ui_tutorial_capy', b.x + 14, b.y + 12, 66, 66);
  round(c, b.x + 88, b.y + 14, 96, 26, 13, '#4e9b86', 'transparent', 0);
  drawText(c, `STEP ${step}/6`, b.x + 136, b.y + 28, 14, '#fffdf5', 'center', 900);

  drawButton(c, hits, 'battle:tutorial-skip', b.x + b.w - 94, b.y + 12, 80, 34, t('p1.tutorialSkip'), {
    ...BTN_STYLES.cream,
    radius: 11,
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

function drawBattleCurtain(c: CanvasRenderingContext2D, hits: UiHitManager, state: BattleState, remaining: number, vp: ViewportMetrics): void {
  // Smooth open: stays closed briefly, then parts left & right across full phone/tablet bleed!
  const tNorm = Math.max(0, Math.min(1, remaining / 0.85));
  const open = tNorm < 0.45 ? 1 - tNorm / 0.45 : 0;
  const halfW = Math.max(650, Math.ceil(vp.visible.width / 2) + 20);
  const slide = open * halfW;
  const alpha = tNorm < 0.35 ? tNorm / 0.35 : 1;

  hits.add({ id: 'battle:skip-curtain', x: vp.visible.left, y: vp.visible.top, w: vp.visible.width, h: vp.visible.height });
  c.save();
  // Left & Right warm wooden shutters spanning the full edge-to-edge screen
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
  drawSpriteContain(c, 'ui_battle_clash_crest', 640 - 90, 150, 180, 180);
  drawSpriteContain(c, 'ui_crossed_blades', 640 - 68, 190, 136, 136);
  drawText(c, t(`map.${state.mapId}`), 640, 386, 40, '#fff7dc', 'center', 900, INK, 7);
  drawText(c, `${t(`rank.${state.rankIndex}`)} · ${t('p9.ready')}`, 640, 444, 22, '#ffe099', 'center', 900, INK, 5);
  c.restore();
}

export { UI_FONT };
