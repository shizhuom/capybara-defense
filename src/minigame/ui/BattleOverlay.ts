import { HEROES } from '../../config/heroes';
import { getActiveBroth } from '../../config/kitchen';
import { STAGE } from '../../config/maps';
import { MOMENTUM_CAP, breakthroughAttackMultiplier } from '../../config/medallions';
import { PROPS } from '../../config/props';
import { RECIPES } from '../../config/recipes';
import { UNITS, getSummonCost } from '../../config/units';
import { WEAPONS } from '../../config/weapons';
import type { BattleEngine } from '../../core/BattleEngine';
import { maxBattleSpeed } from '../../core/FeatureUnlocks';
import { GridSystem } from '../../core/GridSystem';
import { MergeSystem } from '../../core/MergeSystem';
import { getBenchMergeHints } from '../../core/MergeTargets';
import { propTargetKind } from '../../core/PropTargets';
import type { TutorialStep } from '../../core/Tutorial';
import { getBaseUnitStats, getBeeProduction } from '../../core/UnitStats';
import { formatCompactNumber } from '../../core/formatNumber';
import type { BattleState, Profile, StageRect, Unit } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import { INK, round } from '../../render/StickerArt';
import { getBossHUD, getWaveHUD } from '../../ui/BattleHUD';
import { placeTutorialBubble, tutorialTargets, type TutorialRect } from '../../ui/TutorialView';
import {
  BTN_STYLES,
  PALETTE,
  drawButton,
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
  selectedId?: number;
  shovelSelected: boolean;
  activePropId?: string;
  expandedPassiveId?: string;
  tutorialStep: TutorialStep;
  capsuleRightMargin: number;
}

export interface BattleOverlayResult {
  guideRect: TutorialRect;
  avoidRects: StageRect[];
}

/**
 * Full Battle HUD, Boss Bar, Left Prop/Sprinkler Rail, Right Passive/Broth Rail,
 * Summon Bell, Live Unit Inspection Card, and Match-1 6-Step Tutorial Overlay.
 */
export function drawBattleOverlay(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  ctx: BattleOverlayContext,
): BattleOverlayResult {
  const { engine, profile, elapsed, speed, selectedId, shovelSelected, activePropId, expandedPassiveId, tutorialStep, capsuleRightMargin } = ctx;
  const state = engine.state;
  const player = state.sides.player;
  const lang = getLanguage();
  const avoidRects: StageRect[] = [];

  // ── 1. TOP HUD BAR (y: 8..60) ─────────────────────────────────────────────
  const waveHud = getWaveHUD(state);
  const waveX = 16, waveY = 8, waveW = 166, waveH = 52;
  round(c, waveX, waveY, waveW, waveH, 14, 'rgba(255,246,225,0.95)', PALETTE.woodDark, 2.2);
  const waveLabel = state.endless
    ? t('p13.endlessWave', { wave: state.wave })
    : t('hud.wave', { wave: state.wave, total: 10 });
  drawText(c, waveLabel, waveX + waveW / 2, waveY + 19, 16, state.endless ? '#7b3fa0' : PALETTE.ink, 'center', 900);
  const subTimer = waveHud.kind === 'preparation'
    ? (lang === 'zh-CN' ? `布阵 ${waveHud.remaining}s` : `Prep ${waveHud.remaining}s`)
    : waveHud.kind === 'boss'
      ? (lang === 'zh-CN' ? '首领来袭!' : 'Boss Active!')
      : `${waveHud.remaining}s`;
  drawProgressBar(c, waveX + 12, waveY + 34, waveW - 68, 10, waveHud.fraction, waveHud.kind === 'boss' ? '#d95745' : '#6cb85b', 'rgba(72,46,24,0.18)', PALETTE.woodDark);
  drawText(c, subTimer, waveX + waveW - 10, waveY + 39, 11, PALETTE.inkSoft, 'right', 800);

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
    drawButton(c, hits, 'battle:early-wave', nextX, waveY, hornW, waveH, `📯 +${early.bonusFood}🐟`, {
      ...BTN_STYLES.gold,
      radius: 14,
      fontSize: 16,
    });
    c.restore();
    nextX += hornW + 8;
  } else {
    const preview = engine.getUpcomingWavePreview();
    if (preview) {
      const pw = 134;
      round(c, nextX, waveY, pw, waveH, 14, 'rgba(255,244,220,0.88)', PALETTE.woodMid, 1.8);
      const previewIcon = preview.bosses[0] ?? preview.minion;
      drawSpriteContain(c, previewIcon, nextX + 6, waveY + 6, 38, 38);
      const tag = preview.bosses.length > 0
        ? (lang === 'zh-CN' ? `W${preview.wave} 首领` : `W${preview.wave} Boss`)
        : `W${preview.wave} ×${preview.count}`;
      drawText(c, lang === 'zh-CN' ? '下波预告' : 'Upcoming', nextX + 48, waveY + 17, 11, PALETTE.inkSoft, 'left', 700);
      drawText(c, tag, nextX + 48, waveY + 35, 13, preview.bosses.length > 0 ? '#b6392c' : PALETTE.ink, 'left', 900);
      nextX += pw + 8;
    }
  }

  // Fish Food & Oranges pills
  const foodW = 104;
  round(c, nextX, waveY, foodW, waveH, 14, 'rgba(255,246,225,0.95)', PALETTE.woodDark, 2.2);
  if (drawSpriteContain(c, 'ui_fish_food', nextX + 8, waveY + 9, 34, 34)) {
    drawText(c, String(player.food), nextX + 70, waveY + 27, 21, PALETTE.ink, 'center', 900);
  } else {
    drawText(c, `🐟 ${player.food}`, nextX + foodW / 2, waveY + 27, 20, PALETTE.ink, 'center', 900);
  }
  nextX += foodW + 8;

  const orangeW = state.endless && player.capyShieldReady ? 112 : 90;
  round(c, nextX, waveY, orangeW, waveH, 14, 'rgba(255,246,225,0.95)', PALETTE.woodDark, 2.2);
  if (drawSpriteContain(c, 'orange', nextX + 8, waveY + 10, 32, 32)) {
    drawText(c, `${player.oranges}${state.endless && player.capyShieldReady ? '🛡' : ''}`, nextX + 64, waveY + 27, 20, player.oranges <= 1 ? '#c73a2b' : PALETTE.ink, 'center', 900);
  } else {
    drawText(c, `🍊 ${player.oranges}`, nextX + orangeW / 2, waveY + 27, 20, PALETTE.ink, 'center', 900);
  }
  nextX += orangeW + 10;

  // Top-Right Control Cluster (respects WeChat capsule margin!)
  const rightEdge = 1280 - Math.max(16, capsuleRightMargin);
  const pauseW = 54, guideW = 86, speedW = 66, ctrlH = 48;
  const pauseX = rightEdge - pauseW;
  const guideX = pauseX - 8 - guideW;
  const speedX = guideX - 8 - speedW;
  const guideRect: TutorialRect = { x: guideX, y: waveY, w: guideW, h: ctrlH };

  const maxSpd = maxBattleSpeed(profile);
  const speedLabel = maxSpd <= 1 ? '1× 🔒' : `${speed}×`;
  drawButton(c, hits, 'battle:speed', speedX, waveY, speedW, ctrlH, speedLabel, {
    ...(speed > 1 ? BTN_STYLES.gold : BTN_STYLES.cream),
    radius: 13,
    fontSize: maxSpd <= 1 ? 14 : 18,
  });
  drawButton(c, hits, 'battle:guide', guideX, waveY, guideW, ctrlH, lang === 'zh-CN' ? '图鉴' : 'Guide', {
    ...BTN_STYLES.cream,
    radius: 13,
    fontSize: 15,
    icon: 'ui_compendium_book',
  });
  drawButton(c, hits, 'battle:pause', pauseX, waveY, pauseW, ctrlH, '⏸', {
    ...BTN_STYLES.cream,
    radius: 13,
    fontSize: 20,
  });

  // Boss Health Bar (sits cleanly in the middle gap between Oranges pill and Speed button!)
  const bossHud = getBossHUD(state);
  if (bossHud) {
    const availW = speedX - nextX - 10;
    if (availW >= 180) {
      const bw = Math.min(340, availW);
      const bx = nextX + (availW - bw) / 2;
      const by = 8;
      const bh = 52;
      round(c, bx, by, bw, bh, 14, bossHud.warning ? '#5c1f1a' : '#4a261d', bossHud.warning ? '#ffcf5c' : '#e08b63', 2.4);
      drawSpriteContain(c, bossHud.kind, bx + 6, by + 5, 42, 42);
      const bossName = `${t(`boss.${bossHud.kind}`)}${bossHud.count > 1 ? ` ×${bossHud.count}` : ''}`;
      drawText(c, bossName, bx + 54, by + 16, 13, '#fff6df', 'left', 900);
      drawText(c, `${formatCompactNumber(bossHud.hp)}/${formatCompactNumber(bossHud.maxHp)}`, bx + bw - 10, by + 16, 11, '#ffd9a8', 'right', 800);
      drawProgressBar(c, bx + 52, by + 27, bw - 62, 11, bossHud.fraction, '#eb5442', 'rgba(255,255,255,0.18)', '#2d120c');
      // Boss skill cooldown sliver
      drawProgressBar(c, bx + 52, by + 41, bw - 62, 5, 1 - bossHud.cooldownFraction, bossHud.warning ? '#ffe066' : '#76c5d9', 'rgba(255,255,255,0.12)', 'transparent');
    }
  }

  // ── 2. LEFT VERTICAL RAIL (Sprinkler + Active Props, x: 16..154, y: 236..588) ─
  drawLeftToolRail(c, hits, state, activePropId, elapsed);

  // ── 3. RIGHT VERTICAL RAIL (Active Broth + Passive Props, x: 1122..1264) ──
  drawRightAuraRail(c, hits, state, expandedPassiveId);

  // ── 4. BOTTOM SUMMON BELL & STATUS CHIP (y: 610..702) ─────────────────────
  drawBottomControls(c, hits, engine, activePropId, shovelSelected, elapsed);

  // ── 5. LIVE UNIT INSPECTION CARD (when a unit is selected) ────────────────
  if (selectedId !== undefined) {
    const unit = state.units.find(u => u.id === selectedId && u.side === 'player');
    if (unit) {
      const rect = drawLiveUnitCard(c, hits, engine, unit);
      avoidRects.push(rect);
    }
  }

  // ── 6. MATCH-1 6-STEP GUIDED TUTORIAL OVERLAY ─────────────────────────────
  if (tutorialStep !== 'done') {
    drawTutorialOverlay(c, hits, tutorialStep, state, guideRect, avoidRects, elapsed);
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
  const lang = getLanguage();
  const rx = 18;
  const rw = 136;

  // Emergency Free Sprinkler (always available 1x per battle)
  const spY = 236;
  const spH = 64;
  const used = player.sprinklerUsed;
  const spPressed = !used && hits.isPressed('battle:sprinkler');
  const spDy = spPressed ? 2 : 0;
  hits.add({ id: 'battle:sprinkler', x: rx, y: spY, w: rw, h: spH, disabled: used });

  if (!used && !spPressed) round(c, rx, spY + 3, rw, spH, 16, '#2f6a5a', PALETTE.woodDark, 1.5);
  round(c, rx, spY + spDy, rw, spH, 16, used ? 'rgba(130,118,104,0.72)' : '#63b7a1', PALETTE.woodDark, 2.2);
  drawSpriteContain(c, 'sprinkler', rx + 8, spY + spDy + 10, 44, 44, used ? 0.45 : 1);
  drawText(c, lang === 'zh-CN' ? '洒水器' : 'Sprinkler', rx + 58, spY + spDy + 23, 14, used ? '#e6ded2' : '#fffdf6', 'left', 900);
  drawText(c, used ? (lang === 'zh-CN' ? '本局已用' : 'Used') : (lang === 'zh-CN' ? '免费救场' : 'Free 1×'), rx + 58, spY + spDy + 43, 11, used ? '#d4cabd' : '#e6fff7', 'left', 800);

  // Equipped Active Props (up to 3 slots)
  const equipped = player.loadout.equippedActiveProps.filter(id => PROPS[id]?.type === 'active').slice(0, 3);
  equipped.forEach((propId, index) => {
    const def = PROPS[propId];
    const py = 314 + index * 74;
    const ph = 64;
    const cd = Math.max(0, player.propCooldowns[propId] ?? 0);
    const ready = cd <= 0.05;
    const selected = activePropId === propId;
    const pulse = selected ? 1 + Math.sin(elapsed * 6) * 0.025 : 1;

    hits.add({ id: `battle:prop:${propId}`, x: rx, y: py, w: rw, h: ph, data: propId, disabled: !ready });

    c.save();
    if (selected) {
      c.translate(rx + rw / 2, py + ph / 2);
      c.scale(pulse, pulse);
      c.translate(-(rx + rw / 2), -(py + ph / 2));
    }
    if (ready) round(c, rx, py + 3, rw, ph, 16, selected ? '#b57b24' : '#b7976b', PALETTE.woodDark, 1.5);
    round(
      c,
      rx,
      py,
      rw,
      ph,
      16,
      selected ? '#ffe07d' : ready ? '#fff5dd' : 'rgba(130,118,104,0.75)',
      selected ? '#c75a16' : PALETTE.woodDark,
      selected ? 3 : 2.2,
    );

    if (!drawSpriteContain(c, `prop_${propId}`, rx + 8, py + 10, 44, 44, ready ? 1 : 0.48)) {
      drawText(c, def.icon, rx + 30, py + 34, 28, PALETTE.ink, 'center', 700);
    }

    const name = t(`prop.${propId}`);
    drawText(c, name.length > 6 ? `${name.slice(0, 6)}…` : name, rx + 56, py + 22, 13, ready ? PALETTE.ink : '#eee4d6', 'left', 900);
    if (ready) {
      const hint = selected
        ? (lang === 'zh-CN' ? '点目标释放' : 'Tap target')
        : propTargetKind(propId) === 'self'
          ? (lang === 'zh-CN' ? '点即释放' : 'Tap cast')
          : (lang === 'zh-CN' ? '点击/拖拽' : 'Tap/Drag');
      drawText(c, hint, rx + 56, py + 43, 11, selected ? '#a8440e' : PALETTE.tealDark, 'left', 800);
    } else {
      const frac = def.cooldown > 0 ? 1 - cd / def.cooldown : 0;
      drawProgressBar(c, rx + 56, py + 36, 68, 8, frac, '#f4c855', 'rgba(0,0,0,0.28)', 'transparent');
      drawText(c, `${Math.ceil(cd)}s`, rx + 90, py + 52, 11, '#fff5dc', 'center', 900);
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

  const rx = 1134;
  const rw = 126;
  let y = 84;

  // Active Broth pill
  if (activeBroth) {
    const { def, level } = activeBroth;
    const h = 56;
    const exp = expandedPassiveId === 'broth';
    hits.add({ id: 'battle:passive:broth', x: rx, y, w: rw, h });
    round(c, rx, y, rw, h, 14, exp ? '#ffe8a3' : 'rgba(255,246,225,0.92)', PALETTE.woodDark, exp ? 2.8 : 2);
    if (!drawSpriteContain(c, def.id, rx + 6, y + 6, 42, 42)) {
      drawSpriteContain(c, 'ui_kitchen_pot', rx + 6, y + 6, 42, 42);
    }
    drawText(c, t(`broth.${def.id}`).slice(0, 5), rx + 52, y + 20, 12, PALETTE.ink, 'left', 900);
    drawText(c, `Lv.${level}`, rx + 52, y + 38, 12, PALETTE.tealDark, 'left', 800);
    if (exp) {
      drawAuraTooltip(c, rx - 246, y, t(`broth.${def.id}`) + ` Lv.${level}`, t('p14.railLive'));
    }
    y += h + 10;
  }

  // Passive Prop pills
  for (const propId of passives) {
    const def = PROPS[propId];
    const h = 50;
    const exp = expandedPassiveId === propId;
    hits.add({ id: `battle:passive:${propId}`, x: rx, y, w: rw, h });
    round(c, rx, y, rw, h, 13, exp ? '#ffe8a3' : 'rgba(255,246,225,0.9)', PALETTE.woodDark, exp ? 2.6 : 1.8);
    if (!drawSpriteContain(c, `prop_${propId}`, rx + 6, y + 6, 36, 36)) {
      drawText(c, def.icon, rx + 24, y + 26, 22, PALETTE.ink, 'center', 700);
    }
    const name = t(`prop.${propId}`);
    drawText(c, name.length > 5 ? `${name.slice(0, 5)}…` : name, rx + 46, y + 18, 11, PALETTE.ink, 'left', 800);
    drawText(c, `Lv.${loadout.ownedProps[propId] ?? 1}`, rx + 46, y + 34, 11, PALETTE.inkSoft, 'left', 800);
    if (exp) {
      drawAuraTooltip(c, rx - 256, Math.min(y, 440), t(`prop.${propId}`), t(`prop.${propId}.desc`));
    }
    y += h + 8;
  }
}

function drawAuraTooltip(c: CanvasRenderingContext2D, x: number, y: number, title: string, desc: string): void {
  const w = 244;
  const h = 92;
  drawWoodPanel(c, x, y, w, h, 14, PALETTE.creamSoft, PALETTE.woodDark);
  drawText(c, title, x + 14, y + 22, 14, PALETTE.ink, 'left', 900);
  drawWrappedText(c, desc, x + 14, y + 36, w - 28, 12, 16, PALETTE.inkSoft, 'left', 600, 3);
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
  const lang = getLanguage();
  const cost = getSummonCost(player.summons);
  const affordable = player.food >= cost;
  const benchCount = state.units.filter(u => u.side === 'player' && u.location.zone === 'bench').length;
  const benchHints = getBenchMergeHints(state);
  const heroReady = benchHints.some(h => h.kind === 'hero');

  // Summon Bell Button (aligned to STAGE.summonX/Y/W/H)
  const sx = STAGE.summonX, sy = STAGE.summonY, sw = STAGE.summonW, sh = STAGE.summonH;
  const pressed = hits.isPressed('battle:summon');
  const dy = pressed ? 3 : 0;
  hits.add({ id: 'battle:summon', x: sx, y: sy, w: sw, h: sh });

  if (!pressed) round(c, sx, sy + 4, sw, sh, 18, affordable ? '#8f622a' : '#857866', PALETTE.woodDark, 2);
  round(c, sx, sy + dy, sw, sh, 18, affordable ? '#f8df93' : '#e6d9c2', PALETTE.woodDark, 3);

  // Subtle warning pill if redrawing would discard an unmerged Hero pair!
  if (heroReady) {
    const glow = 0.55 + Math.sin(elapsed * 5) * 0.35;
    round(c, sx + 10, sy + dy - 14, sw - 20, 24, 12, `rgba(214,96,77,${glow.toFixed(2)})`, '#fff7e6', 2);
    drawText(c, t('p6.redrawHero'), sx + sw / 2, sy + dy - 2, 12, '#fffdf5', 'center', 900);
  }

  if (drawSpriteContain(c, 'ui_bell_summon', sx + 18, sy + dy + 16, 58, 58)) {
    drawText(c, benchCount > 0 ? t('hud.redraw') : t('hud.summon'), sx + 158, sy + dy + 28, 17, PALETTE.ink, 'center', 900);
    drawText(c, `🐟 ${cost}`, sx + 158, sy + dy + 60, 26, affordable ? '#4a2e16' : '#c74838', 'center', 900);
  } else {
    drawText(c, `🔔 🐟 ${cost}`, sx + sw / 2, sy + dy + sh / 2, 26, affordable ? PALETTE.ink : '#c74838', 'center', 900);
  }

  // Bottom-Right Contextual Action / Shovel Recharge Chip (x: 1044..1262, y: 616..696)
  const cx = 1044, cy = 616, cw = 218, ch = 80;
  if (activePropId) {
    drawButton(c, hits, 'battle:cancel-mode', cx, cy, cw, ch, lang === 'zh-CN' ? '✕ 取消道具释放' : '✕ Cancel Prop', {
      ...BTN_STYLES.coral,
      radius: 16,
      fontSize: 16,
    });
  } else if (shovelSelected) {
    drawButton(c, hits, 'battle:cancel-mode', cx, cy, cw, ch, lang === 'zh-CN' ? '✕ 取消开荒铁锹' : '✕ Cancel Shovel', {
      ...BTN_STYLES.coral,
      radius: 16,
      fontSize: 16,
    });
  } else {
    const rules = engine.getShovelRules();
    const remain = Math.max(0, Math.ceil(rules.interval - player.shovelTimer));
    round(c, cx, cy, cw, ch, 16, 'rgba(255,246,225,0.88)', PALETTE.woodMid, 2);
    drawText(c, t(`map.${state.mapId}`), cx + cw / 2, cy + 25, 15, PALETTE.ink, 'center', 900);
    const shovelInfo = player.shovels >= rules.maxStored
      ? (lang === 'zh-CN' ? `铁锹已满 (${player.shovels}/${rules.maxStored})` : `Shovels full (${player.shovels}/${rules.maxStored})`)
      : (lang === 'zh-CN' ? `铁锹 ${player.shovels}/${rules.maxStored} · ${remain}s后+1` : `Shovels ${player.shovels}/${rules.maxStored} · +1 in ${remain}s`);
    drawText(c, shovelInfo, cx + cw / 2, cy + 52, 12, PALETTE.inkSoft, 'center', 800);
  }
}

function drawLiveUnitCard(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  engine: BattleEngine,
  unit: Unit,
): StageRect {
  const state = engine.state;
  const loadout = state.sides.player.loadout;
  const kind = unit.kind;
  const hero = HEROES[kind];
  const def = UNITS[kind];
  const maxLv = hero ? 5 : def?.maxLevel ?? 1;
  const stats = engine.getEffectiveUnitStats(unit);
  const lang = getLanguage();

  // Dock away from the selected unit so it never obscures the unit itself
  const dockLeft = unit.location.zone === 'board' && unit.location.col >= 5;
  const w = 296;
  const h = hero ? (state.endless && unit.level >= 5 ? 378 : 332) : def?.category === 'component' ? 286 : 244;
  const x = dockLeft ? 20 : 1280 - w - 20;
  const y = 74;

  drawWoodPanel(c, x, y, w, h, 18, PALETTE.creamSoft, PALETTE.woodDark);
  // Capture background touches on card so tapping inside doesn't drop through to the board
  hits.add({ id: 'battle:card-bg', x, y, w, h });

  // Header: portrait + name + level + optional bench lock + close
  const spriteId = hero && unit.awakened ? `${kind}_awakened` : kind;
  round(c, x + 12, y + 12, 50, 50, 12, '#f2dfb8', PALETTE.woodMid, 2);
  if (!drawSpriteContain(c, spriteId, x + 14, y + 14, 46, 46)) {
    drawSpriteContain(c, kind, x + 14, y + 14, 46, 46);
  }

  const name = t(`${hero ? 'hero' : 'unit'}.${kind}`);
  drawText(c, name, x + 70, y + 26, 16, PALETTE.ink, 'left', 900);
  const lvLabel = `Lv.${unit.level}/${maxLv}${unit.awakened ? ' ★' : ''}`;
  drawText(c, lvLabel, x + 70, y + 48, 13, unit.awakened ? '#c26912' : PALETTE.tealDark, 'left', 800);

  // Close button
  drawButton(c, hits, 'battle:clear-select', x + w - 42, y + 12, 30, 30, '×', {
    ...BTN_STYLES.cream,
    radius: 10,
    fontSize: 18,
  });

  // Bench lock button when unit sits in a pet nest
  if (unit.location.zone === 'bench') {
    const locked = state.sides.player.lockedBenchSlot === unit.location.slot;
    drawButton(c, hits, 'battle:lock-selected', x + w - 78, y + 12, 30, 30, locked ? '🔒' : '🔓', {
      ...(locked ? BTN_STYLES.gold : BTN_STYLES.cream),
      radius: 10,
      fontSize: 15,
    });
  }

  let cy = y + 72;

  // Core stat strip
  if (kind === 'shovel') {
    drawWrappedText(c, t('inspect.toolBody'), x + 14, cy, w - 28, 12, 17, PALETTE.inkSoft, 'left', 600, 3);
    cy += 64;
    drawButton(c, hits, 'battle:store-shovel', x + 16, cy, w - 32, 40, t('inspect.storeShovel'), {
      ...BTN_STYLES.teal,
      radius: 12,
      fontSize: 14,
    });
    return { x, y, w, h };
  }

  if (kind === 'bee') {
    const prod = getBeeProduction(unit.level, loadout);
    round(c, x + 14, cy, w - 28, 32, 10, '#f4e5c3', PALETTE.woodLight, 1.5);
    drawText(c, `🐟 ${t('p3.productionValue', prod)}`, x + w / 2, cy + 16, 13, PALETTE.ink, 'center', 800);
    cy += 40;
  } else {
    const pills = [
      `⚔️ ${formatCompactNumber(stats.damage)}`,
      `⚡ ${Number(stats.rate.toFixed(2))}/s`,
      `🎯 ${Number(stats.range.toFixed(1))}`,
    ];
    const pw = Math.floor((w - 36) / 3);
    pills.forEach((p, idx) => {
      const px = x + 14 + idx * (pw + 4);
      round(c, px, cy, pw, 30, 9, '#f4e5c3', PALETTE.woodLight, 1.4);
      drawText(c, p, px + pw / 2, cy + 15, 12, PALETTE.ink, 'center', 900);
    });
    cy += 38;
  }

  // Active status pills
  const statuses = (Object.entries(unit.statuses) as Array<[string, number]>).filter(([, sec]) => sec > 0);
  if (statuses.length > 0 || (unit.washing ?? 0) > 0) {
    const tags = statuses.map(([k, sec]) => `${t(`status.${k}`)} ${Math.ceil(sec)}s`);
    if (unit.washing) tags.push(t('m2.washing'));
    round(c, x + 14, cy, w - 28, 24, 8, '#fde2dc', '#c95c48', 1.2);
    drawText(c, tags.slice(0, 2).join(' · '), x + w / 2, cy + 12, 11, '#9c2d1f', 'center', 800);
    cy += 30;
  }

  // Helper: checks if a merge partner exists on board or bench
  const canMergeWith = (partnerKind: string, feed = false) => state.units.some(partner => {
    if (partner.id === unit.id || partner.kind !== partnerKind || partner.side !== unit.side || unit.washing || partner.washing) return false;
    const src = feed ? partner : unit;
    const dst = feed ? unit : partner;
    if (!GridSystem.canPlace(state, src.side, dst.location)) return false;
    const out = MergeSystem.combine(src, dst);
    return out.ok && !!out.unit && !out.swap;
  });

  // Component recipes
  if (def?.category === 'component') {
    const matching = RECIPES.filter(r => (r.parts as readonly string[]).includes(kind));
    drawText(c, t('inspect.combine'), x + 14, cy + 8, 12, PALETTE.inkSoft, 'left', 800);
    cy += 20;
    for (const r of matching.slice(0, 3)) {
      const partner = r.parts.find(p => p !== kind)!;
      const ready = canMergeWith(partner);
      round(c, x + 14, cy, w - 28, 42, 10, ready ? '#e7f8de' : '#f7ebd1', ready ? '#4b8f38' : PALETTE.woodLight, ready ? 2 : 1.3);
      drawSpriteContain(c, partner, x + 20, cy + 5, 32, 32);
      drawText(c, '→', x + 58, cy + 21, 14, PALETTE.inkSoft, 'center', 900);
      drawSpriteContain(c, r.hero, x + 68, cy + 4, 34, 34);
      drawText(c, t(`hero.${r.hero}`), x + 108, cy + 21, 13, PALETTE.ink, 'left', 900);
      if (ready) {
        round(c, x + w - 72, cy + 10, 52, 22, 8, '#53a644', 'transparent', 0);
        drawText(c, t('p3.ready'), x + w - 46, cy + 21, 11, '#fffdf5', 'center', 900);
      }
      cy += 48;
    }
    return { x, y, w, h };
  }

  // Basic pet next level preview
  if (def?.category === 'basic') {
    if (unit.level >= maxLv) {
      round(c, x + 14, cy + 6, w - 28, 34, 10, '#f7e5b4', PALETTE.goldDark, 1.5);
      drawText(c, `★ ${t('p3.max')}`, x + w / 2, cy + 23, 14, '#7d4b0f', 'center', 900);
    } else {
      const ready = canMergeWith(kind);
      const cur = getBaseUnitStats(kind, unit.level);
      const nxt = getBaseUnitStats(kind, unit.level + 1);
      round(c, x + 14, cy + 4, w - 28, 74, 12, ready ? '#e7f8de' : '#f7ebd1', ready ? '#4b8f38' : PALETTE.woodLight, 1.8);
      drawText(
        c,
        `${lang === 'zh-CN' ? '同星合成' : 'Merge'} Lv.${unit.level} → Lv.${unit.level + 1}${ready ? ` · ${t('p3.ready')}` : ''}`,
        x + 24,
        cy + 24,
        13,
        ready ? '#2d6b22' : PALETTE.ink,
        'left',
        900,
      );
      const growth = kind === 'bee'
        ? `${t('p3.productionValue', getBeeProduction(unit.level, loadout))} → ${t('p3.productionValue', getBeeProduction(unit.level + 1, loadout))}`
        : `⚔️ ${Math.round(cur.damage)} → ${Math.round(nxt.damage)}   ⚡ ${Number(cur.rate.toFixed(2))} → ${Number(nxt.rate.toFixed(2))}/s`;
      drawText(c, growth, x + 24, cy + 52, 12, PALETTE.inkSoft, 'left', 700);
    }
    return { x, y, w, h };
  }

  // Hero details: weapon, energy bar, skill, feed parts, Endless Momentum & Breakthrough
  if (hero) {
    const weapon = WEAPONS[loadout.equippedWeapons[kind]];
    const recipe = RECIPES.find(r => r.hero === kind);
    // Weapon badge
    round(c, x + 14, cy, w - 28, 30, 9, '#f6e7c6', PALETTE.woodLight, 1.3);
    drawText(c, weapon ? `⚔️ ${t(`weapon.${weapon.id}`)}` : t('p3.noWeapon'), x + 24, cy + 15, 12, weapon ? PALETTE.ink : PALETTE.muted, 'left', 800);
    cy += 36;

    // Energy bar
    const energyVal = Math.max(0, Math.min(stats.charge, unit.energy));
    const energyFrac = stats.charge > 0 ? energyVal / stats.charge : 0;
    drawText(c, `🔋 ${energyVal}/${stats.charge}`, x + 14, cy + 8, 12, PALETTE.ink, 'left', 800);
    drawProgressBar(c, x + 84, cy + 2, w - 98, 13, energyFrac, '#53b888', 'rgba(72,46,24,0.18)', PALETTE.woodDark);
    cy += 24;

    // Skill summary
    drawText(c, `★ ${t(`skill.${kind}`)}`, x + 14, cy + 8, 13, '#8a4510', 'left', 900);
    cy += 18;
    cy += drawWrappedText(c, t(`skill.${kind}.desc`, { charge: stats.charge }), x + 14, cy, w - 28, 11.5, 15.5, PALETTE.inkSoft, 'left', 600, 3) + 6;

    // Endless Momentum & Breakthrough (or normal feed parts)
    if (state.endless) {
      const momentum = Math.floor(Math.max(0, Math.min(MOMENTUM_CAP, engine.getUnitMomentum(unit))));
      drawText(c, `🔥 ${t('p17.momentum', { value: momentum, max: MOMENTUM_CAP })}`, x + 14, cy + 8, 12, '#a84712', 'left', 800);
      cy += 20;
      if (unit.awakened) {
        const power = breakthroughAttackMultiplier(engine.medallion('med_breakthrough_atk'));
        round(c, x + 14, cy, w - 28, 42, 10, '#fff0c4', '#c77a14', 2);
        drawText(c, `${t('p17.awakenedBadge')} · ×${Number(power.toFixed(2))}`, x + w / 2, cy + 21, 13, '#8f4709', 'center', 900);
        return { x, y, w, h };
      }
      if (unit.level >= 5) {
        const ch = engine.getBreakthroughChance(unit);
        const pct = Math.round(ch.total * 100);
        round(c, x + 14, cy, w - 28, 62, 10, '#fdeed2', '#c77a14', 2);
        drawText(c, `${t('p17.breakthroughPanel')} · ${pct}%`, x + 24, cy + 18, 13, '#8f4709', 'left', 900);
        const bd = t('p17.breakdown', {
          base: Math.round(ch.base * 100),
          spirit: Math.round(ch.preTenBonus * 100),
          medal: Math.round(ch.medallionBonus * 100),
          pity: Math.round(ch.failBonus * 100),
        });
        drawWrappedText(c, bd, x + 24, cy + 32, w - 48, 10.5, 13.5, PALETTE.inkSoft, 'left', 700, 2);
        return { x, y, w, h };
      }
    }

    if (unit.level < 5 && recipe) {
      round(c, x + 14, cy, w - 28, 44, 10, '#f5e7c9', PALETTE.woodLight, 1.4);
      drawText(c, t('p3.feed'), x + 22, cy + 22, 12, PALETTE.inkSoft, 'left', 800);
      recipe.parts.forEach((part, idx) => {
        const px = x + 104 + idx * 44;
        const ready = canMergeWith(part, true);
        if (ready) round(c, px - 2, cy + 4, 36, 36, 8, '#dff6d3', '#4b8f38', 1.8);
        drawSpriteContain(c, part, px, cy + 6, 32, 32);
      });
      drawText(c, `→ Lv.${unit.level + 1}`, x + w - 22, cy + 22, 12, PALETTE.ink, 'right', 900);
    } else if (unit.level >= 5) {
      round(c, x + 14, cy, w - 28, 32, 10, '#f7e5b4', PALETTE.goldDark, 1.5);
      drawText(c, `★ ${t('p3.max')}`, x + w / 2, cy + 16, 13, '#7d4b0f', 'center', 900);
    }
  }

  return { x, y, w, h };
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

  // Glowing spotlight frames around source & target
  for (const r of rects) {
    c.save();
    c.strokeStyle = `rgba(255,228,112,${pulse.toFixed(2)})`;
    c.lineWidth = 5;
    c.beginPath();
    c.roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 16);
    c.stroke();
    c.fillStyle = `rgba(255,232,128,${(0.14 * pulse).toFixed(2)})`;
    c.fill();
    c.restore();
  }

  // Animated curved dashed arrow from source -> target
  if (source && target) {
    const sx = source.x + source.w / 2;
    const sy = source.y + source.h / 2;
    const tx = target.x + target.w / 2;
    const ty = target.y + target.h / 2;
    const cx = sx;
    const cy = ty;
    c.save();
    c.strokeStyle = '#ffe078';
    c.lineWidth = 5;
    c.setLineDash([12, 8]);
    c.lineDashOffset = -elapsed * 42;
    c.beginPath();
    c.moveTo(sx, sy);
    c.quadraticCurveTo(cx, cy, tx, ty);
    c.stroke();
    c.setLineDash([]);
    // Arrowhead
    const angle = Math.atan2(ty - cy, tx - cx);
    c.fillStyle = '#ffe078';
    c.beginPath();
    c.moveTo(tx, ty);
    c.lineTo(tx - 16 * Math.cos(angle - 0.45), ty - 16 * Math.sin(angle - 0.45));
    c.lineTo(tx - 16 * Math.cos(angle + 0.45), ty - 16 * Math.sin(angle + 0.45));
    c.closePath();
    c.fill();
    c.restore();
  }

  // Bouncing pointer hand on Steps 1 & 6
  if (target && (step === 1 || step === 6)) {
    const bob = Math.sin(elapsed * 6) * 6;
    const px = target.x + target.w * 0.65;
    const py = step === 1 ? target.y - 54 + bob : target.y + target.h + 4 + bob;
    drawSpriteContain(c, 'ui_tutorial_pointer', px, py, 56, 56);
  }

  // Storybook Tutorial Bubble (smartly avoids target/source/card)
  const bubbleSize = { w: 424, h: step === 5 ? 246 : acknowledge ? 222 : 186 };
  const b = placeTutorialBubble([...rects, ...avoidRects], bubbleSize);
  drawWoodPanel(c, b.x, b.y, b.w, b.h, 20, '#fff7e4', '#6d4724');
  hits.add({ id: 'battle:tutorial-bg', x: b.x, y: b.y, w: b.w, h: b.h });

  // Mascot + Step Pill + Title + Skip
  drawSpriteContain(c, 'ui_tutorial_capy', b.x + 12, b.y + 10, 56, 56);
  round(c, b.x + 74, b.y + 14, 78, 22, 11, '#4e9b86', 'transparent', 0);
  drawText(c, `STEP ${step}/6`, b.x + 113, b.y + 25, 11, '#fffdf5', 'center', 900);

  drawButton(c, hits, 'battle:tutorial-skip', b.x + b.w - 88, b.y + 12, 74, 28, t('p1.tutorialSkip'), {
    ...BTN_STYLES.cream,
    radius: 10,
    fontSize: 12,
  });

  const titleKey = step === 2 ? 'p19.tutorialDig.title' : step === 1 ? 'p5.tutorial1.title' : `p5.tutorial${step - 1}.title`;
  const bodyKey = step === 2 ? 'p19.tutorialDig.body' : step === 5 ? 'p6.tutorial4Body' : step === 6 ? 'p19.tutorial6.body' : step === 1 ? 'p5.tutorial1.body' : `p5.tutorial${step - 1}.body`;

  drawText(c, t(titleKey), b.x + 74, b.y + 52, 16, PALETTE.ink, 'left', 900);
  let cy = b.y + 72;
  cy += drawWrappedText(c, t(bodyKey), b.x + 18, cy, b.w - 36, 13.5, 19, PALETTE.inkSoft, 'left', 600, 4);

  if (step === 5) {
    const eqY = cy + 6;
    round(c, b.x + 18, eqY, b.w - 36, 46, 12, '#f4e3bd', PALETTE.woodLight, 1.5);
    drawSpriteContain(c, 'panda', b.x + 34, eqY + 5, 36, 36);
    drawText(c, '+', b.x + 84, eqY + 23, 18, PALETTE.ink, 'center', 900);
    drawSpriteContain(c, 'hat_bamboo', b.x + 98, eqY + 5, 36, 36);
    drawText(c, '=', b.x + 150, eqY + 23, 18, PALETTE.ink, 'center', 900);
    drawSpriteContain(c, 'kungfu_po', b.x + 166, eqY + 3, 40, 40);
    drawText(c, t('hero.kungfu_po'), b.x + 216, eqY + 23, 15, '#7e3c0e', 'left', 900);
  }

  // Progress dots
  const dotY = b.y + b.h - (acknowledge ? 62 : 24);
  for (let n = 1; n <= 6; n++) {
    const dx = b.x + b.w / 2 + (n - 3.5) * 28;
    const fill = n === step ? '#f4c855' : n < step ? '#6db85a' : '#dfd2b8';
    round(c, dx - 10, dotY - 10, 20, 20, 10, fill, PALETTE.woodDark, 1.5);
    drawText(c, String(n), dx, dotY + 1, 11, n === step ? PALETTE.ink : n < step ? '#fffdf5' : PALETTE.muted, 'center', 900);
  }

  if (acknowledge) {
    drawButton(c, hits, 'battle:tutorial-ack', b.x + b.w / 2 - 84, b.y + b.h - 44, 168, 34, t('p1.tutorialAck'), {
      ...BTN_STYLES.teal,
      radius: 12,
      fontSize: 14,
    });
  }
}

export { INK };
