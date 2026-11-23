import type { BattleState, Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import { round } from '../../render/StickerArt';
import {
  BTN_STYLES,
  PALETTE,
  drawButton,
  drawText,
  drawWoodPanel,
  type UiHitManager,
} from './CanvasUI';

/**
 * Hidden Canvas Developer & QA Debugger Modal (unlocked via 5 rapid taps on the Settings title
 * or via `globalThis.__capyDev.openDev()` in WeChat DevTools Console).
 * Allows instant jumping to any P19 onboarding stage (0..8), Unlock-All test profile, and battle tools.
 */
export function drawDevToolsModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  state: BattleState | null,
  isTestSave: boolean,
): void {
  const zh = getLanguage() === 'zh-CN';
  const pw = 920, ph = 590;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;

  drawWoodPanel(c, px, py, pw, ph, 24, '#fff8eb', '#5d3b22');
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  drawText(c, zh ? '🧪 开发者调试 & 新手指引节点预览' : '🧪 Developer QA & Onboarding Stage Preview', px + 28, py + 34, 22, PALETTE.ink, 'left', 900);
  drawText(
    c,
    zh
      ? `当前星级 ★${profile.stars} · 对局 ${profile.matches} · 金币 ${profile.coins}（点任意节点立即跳转并预览该阶段新手指引）`
      : `Stars ★${profile.stars} · Matches ${profile.matches} · Coins ${profile.coins} (Tap any node to preview its onboarding)`,
    px + 28,
    py + 58,
    12.5,
    PALETTE.inkSoft,
    'left',
    700,
  );
  drawButton(c, hits, 'modal:close', px + pw - 56, py + 18, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // ── 1. 9 Onboarding Stage Jump Buttons (0..8) ─────────────────────────────
  const sy = py + 84;
  round(c, px + 24, sy, pw - 48, 250, 16, '#f6e7c7', PALETTE.woodLight, 1.8);
  drawText(c, zh ? '🎓 1. 跳转任意新手阶段（0 ~ 8，含开张赠礼与弹窗引导）' : '🎓 1. Jump to Onboarding Stage (0–8)', px + 40, sy + 22, 14.5, PALETTE.ink, 'left', 900);

  const cols = 3, gap = 10;
  const cw = Math.floor((pw - 80 - gap * 2) / cols);
  const ch = 58;
  for (let stage = 0; stage <= 8; stage++) {
    const col = stage % cols;
    const row = Math.floor(stage / cols);
    const bx = px + 40 + col * (cw + gap);
    const by = sy + 42 + row * (ch + gap);
    drawButton(c, hits, `dev:stage:${stage}`, bx, by, cw, ch, t(`p19.devStage.${stage}`), {
      ...(stage === 0 ? BTN_STYLES.teal : BTN_STYLES.cream),
      radius: 13,
      fontSize: 13,
    });
  }

  // ── 2. Account / Save Quick Tools ─────────────────────────────────────────
  const ay = sy + 264;
  round(c, px + 24, ay, pw - 48, 102, 16, '#f6e7c7', PALETTE.woodLight, 1.8);
  drawText(c, zh ? '📦 2. 存档与全解锁工具' : '📦 2. Profile & Unlock Tools', px + 40, ay + 22, 14.5, PALETTE.ink, 'left', 900);

  drawButton(c, hits, 'dev:unlock-all', px + 40, ay + 42, 240, 44, zh ? '🌟 一键全解锁测试档' : '🌟 Unlock All (Test Save)', {
    ...BTN_STYLES.gold,
    radius: 12,
    fontSize: 14,
  });
  drawButton(c, hits, 'dev:restore', px + 294, ay + 42, 220, 44, zh ? '↩ 恢复正式存档' : '↩ Restore Normal Save', {
    ...(isTestSave ? BTN_STYLES.teal : BTN_STYLES.muted),
    radius: 12,
    fontSize: 14,
    disabled: !isTestSave,
  });
  drawButton(c, hits, 'dev:reset', px + 528, ay + 42, 200, 44, zh ? '🗑️ 清空重置存档' : '🗑️ Reset Save', {
    ...BTN_STYLES.coral,
    radius: 12,
    fontSize: 14,
  });
  drawButton(c, hits, 'dev:add-coins', px + 742, ay + 42, 138, 44, '🪙 +5000', {
    ...BTN_STYLES.green,
    radius: 12,
    fontSize: 14,
  });

  // ── 3. In-Battle Quick Tools ──────────────────────────────────────────────
  const by2 = ay + 114;
  round(c, px + 24, by2, pw - 48, 104, 16, '#f6e7c7', PALETTE.woodLight, 1.8);
  drawText(
    c,
    state
      ? (zh ? `⚔️ 3. 当前战局快捷工具（第 ${state.wave} 波）` : `⚔️ 3. Battle Tools (Wave ${state.wave})`)
      : (zh ? '⚔️ 3. 战局快捷工具（进入战斗后从暂停 → 设置进入即可使用）' : '⚔️ 3. Battle Tools (Enter a battle first)'),
    px + 40,
    by2 + 22,
    14.5,
    PALETTE.ink,
    'left',
    900,
  );

  const disabled = !state;
  drawButton(c, hits, 'dev:battle-food', px + 40, by2 + 44, 196, 44, '🐟 +500 小鱼干', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.green),
    radius: 12,
    fontSize: 14,
    disabled,
  });
  drawButton(c, hits, 'dev:battle-skip', px + 250, by2 + 44, 196, 44, zh ? '⏭ 跳过当前波' : '⏭ Skip Wave', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.gold),
    radius: 12,
    fontSize: 14,
    disabled,
  });
  drawButton(c, hits, 'dev:battle-orange-up', px + 460, by2 + 44, 140, 44, '🍊 +1 橘子', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.teal),
    radius: 12,
    fontSize: 14,
    disabled,
  });
  drawButton(c, hits, 'dev:battle-orange-down', px + 614, by2 + 44, 140, 44, '🍊 -1 橘子', {
    ...(disabled ? BTN_STYLES.muted : BTN_STYLES.coral),
    radius: 12,
    fontSize: 14,
    disabled,
  });
}
