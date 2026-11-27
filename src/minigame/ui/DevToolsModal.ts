import type { BattleState, Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import {
  BTN_STYLES,
  PALETTE,
  drawButton,
  drawHinokiBoard,
  drawIvorySlab,
  drawMatchaSignboard,
  drawText,
  drawYuzuCloseButton,
  type UiHitManager,
} from './CanvasUI';

/**
 * Hidden Canvas Developer & QA Debugger Modal (unlocked via 5 rapid taps on the Settings signboard
 * or via `globalThis.__capyDev.openDev()` in WeChat DevTools Console).
 * Restyled in P18 carved hinoki-wood with large mobile-readable buttons.
 */
export function drawDevToolsModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  state: BattleState | null,
  isTestSave: boolean,
): void {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1140, ph = 618;
  const px = (1280 - pw) / 2, py = 74;

  drawHinokiBoard(c, px, py, pw, ph, 26);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  const sub = zh
    ? `当前星级 ★${profile.stars} · 对局 ${profile.matches} · 金币 ${profile.coins}（点任意节点立即跳转并预览新手指引）`
    : `Stars ★${profile.stars} · Matches ${profile.matches} · Coins ${profile.coins} (Tap any node to preview onboarding)`;
  drawMatchaSignboard(c, 640, 16, zh ? '开发者调试 & 新手预览' : 'Developer QA & Stage Preview', sub, 430);
  drawYuzuCloseButton(c, hits, 'modal:close', Math.max(880, Math.min(1084, px + pw - 22, hits.modalRightEdge - 34)), 50, 30);

  // ── 1. 9 Onboarding Stage Jump Buttons (0..8) ─────────────────────────────
  const sy = py + 44;
  drawIvorySlab(c, px + 24, sy, pw - 48, 286, 18);
  drawText(c, zh ? '1. 跳转任意新手阶段（0 ~ 8，自动补满体力 · 含开张赠礼与弹窗引导）' : '1. Jump to Onboarding Stage (0–8, auto-refills stamina)', px + 42, sy + 26, 21, PALETTE.ink, 'left', 900);

  const cols = 3, gap = 12;
  const cw = Math.floor((pw - 84 - gap * 2) / cols);
  const ch = 68;
  for (let stage = 0; stage <= 8; stage++) {
    const col = stage % cols;
    const row = Math.floor(stage / cols);
    const bx = px + 42 + col * (cw + gap);
    const by = sy + 48 + row * (ch + gap);
    drawButton(c, hits, `dev:stage:${stage}`, bx, by, cw, ch, t(`p19.devStage.${stage}`), {
      ...(stage === 0 ? BTN_STYLES.teal : BTN_STYLES.cream),
      radius: 15,
      fontSize: 19,
    });
  }

  // ── 2. Account / Save Quick Tools ─────────────────────────────────────────
  const ay = sy + 298;
  drawIvorySlab(c, px + 24, ay, pw - 48, 120, 18);
  drawText(c, zh ? '2. 存档、体力与全解锁工具' : '2. Profile, Energy & Unlock Tools', px + 42, ay + 28, 21, PALETTE.ink, 'left', 900);

  const row2W = pw - 84;
  const bGap = 10;
  const bW = Math.floor((row2W - bGap * 4) / 5);
  let rx = px + 42;
  drawButton(c, hits, 'dev:unlock-all', rx, ay + 52, bW, 54, zh ? '一键全解锁' : 'Unlock All', {
    ...BTN_STYLES.gold,
    radius: 15,
    fontSize: 19.5,
  });
  rx += bW + bGap;
  drawButton(c, hits, 'dev:restore', rx, ay + 52, bW, 54, zh ? '恢复正式档' : 'Restore Save', {
    ...(isTestSave ? BTN_STYLES.teal : BTN_STYLES.muted),
    radius: 15,
    fontSize: 19.5,
    disabled: !isTestSave,
  });
  rx += bW + bGap;
  drawButton(c, hits, 'dev:reset', rx, ay + 52, bW, 54, zh ? '清空重置' : 'Reset Save', {
    ...BTN_STYLES.coral,
    radius: 15,
    fontSize: 19.5,
  });
  rx += bW + bGap;
  drawButton(c, hits, 'dev:add-coins', rx, ay + 52, bW, 54, '+5000', {
    ...BTN_STYLES.green,
    radius: 15,
    fontSize: 19.5,
    icon: 'ui_coin_gold',
  });
  rx += bW + bGap;
  drawButton(c, hits, 'dev:refill-stamina', rx, ay + 52, bW, 54, zh ? '⚡ 补满体力' : '⚡ Full Energy', {
    ...BTN_STYLES.gold,
    radius: 15,
    fontSize: 19.5,
  });

  // ── 3. In-Battle Quick Tools ──────────────────────────────────────────────
  const by2 = ay + 132;
  drawIvorySlab(c, px + 24, by2, pw - 48, 120, 18);
  drawText(
    c,
    state
      ? (zh ? `3. 当前战局快捷工具（第 ${state.wave} 波）` : `3. Battle Tools (Wave ${state.wave})`)
      : (zh ? '3. 战局快捷工具（进入战斗后从暂停 → 设置 → 开发者调试台即可使用）' : '3. Battle Tools (Enter a battle first)'),
    px + 42,
    by2 + 28,
    21,
    PALETTE.ink,
    'left',
    900,
  );

  const disabled = !state;
  const b3W = Math.floor((row2W - bGap * 3) / 4);
  let bx3 = px + 42;
  drawButton(c, hits, 'dev:battle-food', bx3, by2 + 52, b3W, 54, zh ? '+500 小鱼干' : '+500 Fish', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.green),
    radius: 15,
    fontSize: 19.5,
    icon: 'ui_fish_food',
    disabled,
  });
  bx3 += b3W + bGap;
  drawButton(c, hits, 'dev:battle-skip', bx3, by2 + 52, b3W, 54, zh ? '跳过当前波' : 'Skip Wave', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.gold),
    radius: 15,
    fontSize: 19.5,
    icon: 'ui_wave_horn',
    disabled,
  });
  bx3 += b3W + bGap;
  drawButton(c, hits, 'dev:battle-orange-up', bx3, by2 + 52, b3W, 54, zh ? '+1 橘子' : '+1 Orange', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.teal),
    radius: 15,
    fontSize: 19.5,
    icon: 'orange',
    disabled,
  });
  bx3 += b3W + bGap;
  drawButton(c, hits, 'dev:battle-orange-down', bx3, by2 + 52, b3W, 54, zh ? '-1 橘子' : '-1 Orange', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.coral),
    radius: 15,
    fontSize: 19.5,
    icon: 'orange',
    disabled,
  });
}
