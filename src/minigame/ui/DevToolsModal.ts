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
  const pw = 1040, ph = 616;
  const px = (1280 - pw) / 2, py = 74;

  drawHinokiBoard(c, px, py, pw, ph, 26);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  const sub = zh
    ? `当前星级 ★${profile.stars} · 对局 ${profile.matches} · 金币 ${profile.coins}（点任意节点立即跳转并预览新手指引）`
    : `Stars ★${profile.stars} · Matches ${profile.matches} · Coins ${profile.coins} (Tap any node to preview onboarding)`;
  drawMatchaSignboard(c, 640, 22, zh ? '开发者调试 & 新手预览' : 'Developer QA & Stage Preview', sub, 380);
  drawYuzuCloseButton(c, hits, 'modal:close', px + pw - 22, 54, 26);

  // ── 1. 9 Onboarding Stage Jump Buttons (0..8) ─────────────────────────────
  const sy = py + 54;
  drawIvorySlab(c, px + 24, sy, pw - 48, 280, 18);
  drawText(c, zh ? '1. 跳转任意新手阶段（0 ~ 8，含开张赠礼与弹窗引导）' : '1. Jump to Onboarding Stage (0–8)', px + 42, sy + 26, 18, PALETTE.ink, 'left', 900);

  const cols = 3, gap = 12;
  const cw = Math.floor((pw - 84 - gap * 2) / cols);
  const ch = 66;
  for (let stage = 0; stage <= 8; stage++) {
    const col = stage % cols;
    const row = Math.floor(stage / cols);
    const bx = px + 42 + col * (cw + gap);
    const by = sy + 48 + row * (ch + gap);
    drawButton(c, hits, `dev:stage:${stage}`, bx, by, cw, ch, t(`p19.devStage.${stage}`), {
      ...(stage === 0 ? BTN_STYLES.teal : BTN_STYLES.cream),
      radius: 14,
      fontSize: 15.5,
    });
  }

  // ── 2. Account / Save Quick Tools ─────────────────────────────────────────
  const ay = sy + 294;
  drawIvorySlab(c, px + 24, ay, pw - 48, 114, 18);
  drawText(c, zh ? '2. 存档与全解锁工具' : '2. Profile & Unlock Tools', px + 42, ay + 26, 18, PALETTE.ink, 'left', 900);

  drawButton(c, hits, 'dev:unlock-all', px + 42, ay + 48, 264, 50, zh ? '一键全解锁测试档' : 'Unlock All (Test Save)', {
    ...BTN_STYLES.gold,
    radius: 14,
    fontSize: 17,
  });
  drawButton(c, hits, 'dev:restore', px + 320, ay + 48, 240, 50, zh ? '恢复正式存档' : 'Restore Normal Save', {
    ...(isTestSave ? BTN_STYLES.teal : BTN_STYLES.muted),
    radius: 14,
    fontSize: 17,
    disabled: !isTestSave,
  });
  drawButton(c, hits, 'dev:reset', px + 574, ay + 48, 220, 50, zh ? '清空重置存档' : 'Reset Save', {
    ...BTN_STYLES.coral,
    radius: 14,
    fontSize: 17,
  });
  drawButton(c, hits, 'dev:add-coins', px + 808, ay + 48, 190, 50, '+5000 金币', {
    ...BTN_STYLES.green,
    radius: 14,
    fontSize: 17,
    icon: 'ui_coin_gold',
  });

  // ── 3. In-Battle Quick Tools ──────────────────────────────────────────────
  const by2 = ay + 128;
  drawIvorySlab(c, px + 24, by2, pw - 48, 114, 18);
  drawText(
    c,
    state
      ? (zh ? `3. 当前战局快捷工具（第 ${state.wave} 波）` : `3. Battle Tools (Wave ${state.wave})`)
      : (zh ? '3. 战局快捷工具（进入战斗后从暂停 → 设置进入即可使用）' : '3. Battle Tools (Enter a battle first)'),
    px + 42,
    by2 + 26,
    18,
    PALETTE.ink,
    'left',
    900,
  );

  const disabled = !state;
  drawButton(c, hits, 'dev:battle-food', px + 42, by2 + 48, 224, 50, zh ? '+500 小鱼干' : '+500 Fish', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.green),
    radius: 14,
    fontSize: 17,
    icon: 'ui_fish_food',
    disabled,
  });
  drawButton(c, hits, 'dev:battle-skip', px + 280, by2 + 48, 224, 50, zh ? '跳过当前波' : 'Skip Wave', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.gold),
    radius: 14,
    fontSize: 17,
    icon: 'ui_wave_horn',
    disabled,
  });
  drawButton(c, hits, 'dev:battle-orange-up', px + 518, by2 + 48, 178, 50, zh ? '+1 橘子' : '+1 Orange', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.teal),
    radius: 14,
    fontSize: 17,
    icon: 'orange',
    disabled,
  });
  drawButton(c, hits, 'dev:battle-orange-down', px + 710, by2 + 48, 178, 50, zh ? '-1 橘子' : '-1 Orange', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.coral),
    radius: 14,
    fontSize: 17,
    icon: 'orange',
    disabled,
  });
}
