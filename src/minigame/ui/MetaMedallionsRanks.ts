import { AVATARS } from '../../config/avatars';
import {
  MEDALLION_IDS,
  MEDALLION_MAX_LEVEL,
  MEDALLION_TOTAL_MAX,
  medallionUpgradeCost,
} from '../../config/medallions';
import { RANKS, getRank, getRankDifficulty } from '../../config/ranks';
import { isFeatureUnlocked } from '../../core/FeatureUnlocks';
import { formatLocation } from '../../core/Location';
import {
  canAffordMedallion,
  getProfileMedallionLevel,
  profileMedallionTotal,
} from '../../core/MedallionProgression';
import { displayNickname } from '../../core/PlayerIdentity';
import { getLeaderboard } from '../../core/PlayerProgression';
import { formatCompactNumber } from '../../core/formatNumber';
import type { Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import { round } from '../../render/StickerArt';
import { localEntry, type LeaderboardSnapshot, type RankLeaderboardSnapshot } from '../../ui/EndlessLeaderboardClient';
import { medallionEffectText } from '../../ui/MedallionScreen';
import type { DialogGuideStep } from '../../ui/OnboardingGuide';
import {
  PALETTE,
  ScrollRegion,
  drawGoldSlider,
  drawGuideRipple,
  drawIconLabel,
  drawIvorySlab,
  drawLedgerShell,
  drawPillButton,
  drawProgressBar,
  drawScrollbar,
  drawSpriteContain,
  drawText,
  drawToggleSwitch,
  drawWrappedText,
  type UiHitManager,
} from './CanvasUI';

export type ProfileHubTab = 'leaderboard' | 'endless-board' | 'profile' | 'settings';
export type MedallionHubTab = 'medallions' | 'endless-board';

export interface LeaderboardUiState {
  endlessSnap: LeaderboardSnapshot;
  rankSnap: RankLeaderboardSnapshot;
  loading: boolean;
  showRankLadder: boolean;
  medallionTab: MedallionHubTab;
}

/**
 * Strict 1:1 Web Storybook Endless Medallions Hub (`MedallionScreen.ts` + `p18_preview_d13_medallions.png`):
 * - 2 equal Honey-Oak tabs: 无尽勋章 / 无尽全球榜
 * - Header badge: `[ui_endless_crest]×X  [ui_coin_gold] Y  总等级 Z/300`
 * - Tab 1: Top dashed-border notice + single-column 6 medallion cards with `Lv.X/50`, effect `×196 → ×242`,
 *   golden progress bar, `花费 [crest] [coin]` chips, and plump golden pill `升级` button!
 * - Tab 2: Global Endless Top 100 Leaderboard!
 */
export function drawMedallionsModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  lb: LeaderboardUiState,
  scroll: ScrollRegion,
  opts?: {
    inBattle?: boolean;
    preparation?: boolean;
    guideStep?: DialogGuideStep | null;
    elapsed?: number;
    wxFriendCanvas?: HTMLCanvasElement | null;
    wxFriendMode?: boolean;
  },
): { scrollViewport?: { x: number; y: number; w: number; h: number }; wxFriendViewport?: { x: number; y: number; w: number; h: number } } {
  const totalLv = profileMedallionTotal(profile);
  const pulseSel = opts?.guideStep?.pulseSelector;
  const zh = getLanguage() === 'zh-CN';
  const endlessTabLabel = opts?.wxFriendMode
    ? (zh ? '无尽好友榜' : 'Friend Endless')
    : t('p11.tab.endless-board');

  const body = drawLedgerShell(c, hits, {
    title: t('p17.title'),
    mascot: 'ui_medallion_peek_capy',
    badgeSegments: [
      { icon: 'ui_endless_crest', text: `×${formatCompactNumber(profile.endlessCrests)}` },
      { icon: 'ui_coin_gold', text: formatCompactNumber(profile.coins) },
      { text: t('p17.totalLevel', { sum: totalLv, max: MEDALLION_TOTAL_MAX }) },
    ],
    tabs: [
      { id: 'medallion:tab:medallions', label: t('p17.title'), active: lb.medallionTab === 'medallions' },
      { id: 'medallion:tab:endless-board', label: endlessTabLabel, active: lb.medallionTab === 'endless-board' },
    ],
    footer1: t('p17.footer1'),
    footer2: opts?.inBattle ? t(opts.preparation ? 'p17.footerPreparation' : 'p17.footerNextBattle') : t('p17.footer2'),
    guideStep: opts?.guideStep,
    elapsed: opts?.elapsed,
  });

  if (lb.medallionTab === 'endless-board') {
    return drawEndlessBoardBody(c, hits, profile, lb, scroll, body, true, opts?.wxFriendCanvas ?? null, Boolean(opts?.wxFriendMode));
  }

  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();
  hits.pushClip(vx, vy, vw, vh);

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // Top Dashed-Border Endless-Only Notice (ENLARGED 25px bold mobile typography!)
  const noteH = 68;
  if (y + noteH >= vy - 20 && y <= vy + vh + 20) {
    round(c, vx + 4, y, rowW, noteH, 18, '#fffdf6', 'transparent', 0);
    c.save();
    c.setLineDash([7, 5]);
    round(c, vx + 4, y, rowW, noteH, 18, 'transparent', '#9c6e3b', 2.4);
    c.restore();
    drawSpriteContain(c, 'ui_endless_emblem', vx + 22, y + 14, 40, 40);
    drawText(c, t('p17.endlessOnly'), vx + 74, y + 35, 25, '#592878', 'left', 900);
  }
  y += noteH + 14;

  // 2-Column GIANT Medallion Cards (6 Medallions!)
  const cols = 2, gapX = 16, gapY = 14;
  const cardW = Math.floor((vw - 16 - gapX) / cols);
  const cardH = 218;
  const pulseFirst = pulseSel === '[data-action="medallion-up:med_breakthrough_atk"]';

  MEDALLION_IDS.forEach((medId, idx) => {
    const col = idx % cols, row = Math.floor(idx / cols);
    const rx = vx + 4 + col * (cardW + gapX);
    const ry = y + row * (cardH + gapY);
    const lv = getProfileMedallionLevel(profile, medId);
    const cost = medallionUpgradeCost(lv);
    const max = lv >= MEDALLION_MAX_LEVEL;
    const afford = canAffordMedallion(profile, medId);
    const shouldPulse = pulseFirst && medId === 'med_breakthrough_atk';

    if (ry + cardH >= vy - 20 && ry <= vy + vh + 20) {
      drawIvorySlab(
        c,
        rx,
        ry,
        cardW,
        cardH,
        20,
        shouldPulse ? '#fff8d4' : '#fffdf8',
        shouldPulse ? '#fae290' : '#f6e8cb',
        shouldPulse ? '#e08b19' : '#7e5530',
        shouldPulse ? 3.8 : 2.4,
      );

      round(c, rx + 16, ry + 18, 96, 96, 18, '#fdf5df', '#8a5d32', 2.2);
      if (!drawSpriteContain(c, medId, rx + 22, ry + 24, 84, 84)) {
        drawSpriteContain(c, 'ui_endless_crest', rx + 22, ry + 24, 84, 84);
      }

      const tx = rx + 126;
      const name = t(`medallion.${medId}`);
      drawText(c, name, tx, ry + 34, 26, PALETTE.ink, 'left', 900);
      round(c, rx + cardW - 122, ry + 16, 106, 34, 17, '#f5dec0', '#966430', 2);
      drawText(c, `Lv.${lv}/${MEDALLION_MAX_LEVEL}`, rx + cardW - 69, ry + 34, 19.5, '#7c3f08', 'center', 900);

      const desc = t(`medallion.${medId}.desc`);
      const nowStr = medallionEffectText(medId, lv);
      const nextStr = max ? '' : medallionEffectText(medId, lv + 1);
      drawWrappedText(c, `${desc} ${nowStr}${max ? '' : ` → ${nextStr}`}`, tx, ry + 58, cardW - 144, 20.5, 25, '#6b3610', 'left', 900, 2);

      drawProgressBar(c, tx, ry + 114, cardW - 144, 13, lv / MEDALLION_MAX_LEVEL, '#e8a832', '#e8dcc4', '#8c6239');

      // Bottom Cost Chips + Giant Upgrade Button
      if (cost) {
        const crestOk = profile.endlessCrests >= cost.crests;
        const coinOk = profile.coins >= cost.coins;
        let cx = rx + 18;
        round(c, cx, ry + cardH - 58, 122, 38, 19, crestOk ? '#e4f7dc' : '#f4e6d2', crestOk ? '#49913b' : '#a88c6c', 1.8);
        drawSpriteContain(c, 'ui_endless_crest', cx + 8, ry + cardH - 52, 26, 26);
        drawText(c, formatCompactNumber(cost.crests), cx + 40, ry + cardH - 38, 20.5, crestOk ? '#23591b' : '#7a5c3c', 'left', 900);
        cx += 132;
        round(c, cx, ry + cardH - 58, 122, 38, 19, coinOk ? '#e4f7dc' : '#f4e6d2', coinOk ? '#49913b' : '#a88c6c', 1.8);
        drawSpriteContain(c, 'ui_coin_gold', cx + 8, ry + cardH - 52, 26, 26);
        drawText(c, formatCompactNumber(cost.coins), cx + 40, ry + cardH - 38, 20.5, coinOk ? '#23591b' : '#7a5c3c', 'left', 900);
      }

      if (ry + cardH > vy && ry < vy + vh) {
        if (max) {
          drawText(c, t('p17.maxed'), rx + cardW - 82, ry + cardH - 38, 22, '#8c4c10', 'center', 900);
        } else {
          drawPillButton(c, hits, `medallion:up:${medId}`, rx + cardW - 152, ry + cardH - 64, 136, 50, t('p17.upgrade'), afford ? 'gold' : 'muted', {
            fontSize: 22,
          });
          if (shouldPulse) {
            drawGuideRipple(c, rx + cardW - 152, ry + cardH - 64, 136, 50, 25, opts?.elapsed ?? 0, { maxExpand: 16, waves: 3, showBullseye: true });
          }
        }
      }
    }
  });
  y += Math.ceil(MEDALLION_IDS.length / cols) * (cardH + gapY);

  const contentH = Math.max(vh, y + scroll.offset - vy + 10);
  hits.popClip();
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

/**
 * Strict 1:1 Web 4-Tab Unified Profile Wood Book (`ProfileScreens.ts` + `p18_preview_d15_rank_board.png` & `p18_preview_d17_settings.png`):
 * Shares ONE unified 4-tab window across:
 *   `段位排行` (leaderboard) | `无尽全球榜` (endless-board, shown at 10★+) | `通行名片` (profile) | `庭院设置` (settings)
 */
export function drawProfileHubModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  activeTab: ProfileHubTab,
  profile: Profile,
  lb: LeaderboardUiState,
  scroll: ScrollRegion,
  opts: {
    inBattle: boolean;
    devUnlocked: boolean;
    wxFriendCanvas?: HTMLCanvasElement | null;
    wxFriendMode?: boolean;
  },
): {
  scrollViewport?: { x: number; y: number; w: number; h: number };
  wxFriendViewport?: { x: number; y: number; w: number; h: number };
  musicSlider?: { x: number; y: number; w: number; h: number };
  soundSlider?: { x: number; y: number; w: number; h: number };
} {
  const zh = getLanguage() === 'zh-CN';
  const showEndless = isFeatureUnlocked(profile, 'endless');
  const tabIds: ProfileHubTab[] = showEndless
    ? ['leaderboard', 'endless-board', 'profile', 'settings']
    : ['leaderboard', 'profile', 'settings'];

  const mascot = activeTab === 'leaderboard' || activeTab === 'endless-board' ? 'ui_rank_peek_capy' : 'ui_profile_peek_capy';
  const tabLabel = (tab: ProfileHubTab): string => {
    if (opts.wxFriendMode && tab === 'endless-board') return zh ? '无尽好友榜' : 'Friend Endless';
    if (opts.wxFriendMode && tab === 'leaderboard') return zh ? '好友段位榜' : 'Friend Rank';
    return t(`p11.tab.${tab}`);
  };
  const headerTitle = opts.wxFriendMode && activeTab === 'endless-board'
    ? (zh ? '无尽好友榜' : 'WeChat Friend Endless')
    : opts.wxFriendMode && activeTab === 'leaderboard'
      ? (zh ? '微信好友段位榜' : 'WeChat Friend Rank')
      : t(`p11.title.${activeTab}`);

  const body = drawLedgerShell(c, hits, {
    title: headerTitle,
    mascot,
    titleHitId: __ENABLE_DEV_TOOLS__ && activeTab === 'settings' ? 'settings:title-tap' : undefined,
    tabs: tabIds.map(tab => ({
      id: `profilehub:tab:${tab}`,
      label: tabLabel(tab),
      active: activeTab === tab,
    })),
    footer1: opts.wxFriendMode && (activeTab === 'leaderboard' || activeTab === 'endless-board')
      ? (zh ? '微信好友排行榜仅展示同玩本游戏的微信好友，由微信官方免费安全托管' : 'Powered by WeChat Open Data Context — shows WeChat friends playing this game')
      : t(`p11.tip.${activeTab}.1`),
    footer2: opts.wxFriendMode && (activeTab === 'leaderboard' || activeTab === 'endless-board')
      ? (zh ? '每局对战结束自动同步最新段位与无尽波次，点击分享可邀请好友上榜' : 'Scores sync automatically after each match — tap Share to invite friends')
      : t(`p11.tip.${activeTab}.2`),
  });

  if (activeTab === 'leaderboard') {
    return drawRankBoardBody(c, hits, profile, lb, scroll, body, opts.wxFriendCanvas ?? null, Boolean(opts.wxFriendMode));
  }
  if (activeTab === 'endless-board') {
    return drawEndlessBoardBody(c, hits, profile, lb, scroll, body, false, opts.wxFriendCanvas ?? null, Boolean(opts.wxFriendMode));
  }
  if (activeTab === 'profile') {
    return drawPassportBody(c, hits, profile, scroll, body);
  }
  return drawSettingsBody(c, hits, profile, scroll, body, opts);
}

// ── TAB 1: RANK BOARD + CLICKABLE 54-RANK LADDER (`p18_preview_d15_rank_board.png`) ──
function drawRankBoardBody(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  lb: LeaderboardUiState,
  scroll: ScrollRegion,
  body: { x: number; y: number; w: number; h: number },
  wxFriendCanvas: HTMLCanvasElement | null,
  wxFriendMode: boolean,
): { scrollViewport?: { x: number; y: number; w: number; h: number }; wxFriendViewport?: { x: number; y: number; w: number; h: number } } {
  const lang = getLanguage();
  const zh = lang === 'zh-CN';
  const rank = getRank(profile.stars);
  const nextRank = RANKS[rank.index + 1];
  const progress = nextRank ? Math.max(0, Math.min(1, (profile.stars - rank.minStars) / (nextRank.minStars - rank.minStars))) : 1;

  // ── WECHAT OFFICIAL FREE FRIEND RANK LEADERBOARD (Open Data Context sharedCanvas) ──
  if (wxFriendMode && wxFriendCanvas && !lb.showRankLadder) {
    const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
    const rowW = vw - 8;
    const sumH = 104;
    const sumY = vy + 2;

    drawIvorySlab(c, vx + 4, sumY, rowW, sumH, 18, '#fffdf8', '#f6e8cb', '#7e5530', 2.4);
    hits.add({ id: 'lb:toggle-ladder', x: vx + 4, y: sumY, w: rowW - 360, h: sumH });
    round(c, vx + 18, sumY + 14, 76, 76, 18, '#fff3d6', '#7a5230', 2.2);
    if (!drawSpriteContain(c, `avatar_${profile.avatarId}`, vx + 24, sumY + 20, 64, 64)) {
      drawSpriteContain(c, 'avatar_capybara', vx + 24, sumY + 20, 64, 64);
    }
    const rName = t(`rank.${rank.index}`);
    drawText(c, rName, vx + 110, sumY + 32, 26, PALETTE.ink, 'left', 900);
    c.font = '900 26px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
    const rw = c.measureText(rName).width;
    round(c, vx + 122 + rw, sumY + 17, 136, 32, 16, '#f2e0bc', '#8c5d2c', 1.8);
    drawText(c, t('p19.rankLadderShow'), vx + 190 + rw, sumY + 34, 18, '#5c3612', 'center', 900);
    drawIconLabel(c, 'ui_star_rank', String(profile.stars), vx + 110, sumY + 72, 26, 23, '#9e5a0c');
    drawProgressBar(c, vx + 196, sumY + 65, Math.max(140, rowW - 580), 14, progress, '#e8b43c', '#e6dac4', '#8c6239');

    drawPillButton(c, hits, 'lb:share', vx + 4 + rowW - 284, sumY + 26, 140, 52, zh ? '邀请好友' : 'Invite', 'gold', { fontSize: 21 });
    drawPillButton(c, hits, 'lb:refresh', vx + 4 + rowW - 132, sumY + 26, 116, 52, lb.loading ? '…' : (zh ? '刷新' : 'Sync'), 'cream', { fontSize: 21 });

    const listX = vx + 4;
    const listY = sumY + sumH + 10;
    const listW = rowW;
    const listH = Math.max(180, vy + vh - listY - 2);
    try {
      c.drawImage(wxFriendCanvas, listX, listY, listW, listH);
    } catch { /* sharedCanvas may still be initializing on first frame */ }
    return { wxFriendViewport: { x: listX, y: listY, w: listW, h: listH } };
  }

  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();
  hits.pushClip(vx, vy, vw, vh);

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // 1. Clickable GIANT My-Rank Summary Card (tapping toggles full 54-Rank Ladder!)
  const sumH = 128;
  if (y + sumH >= vy - 20 && y <= vy + vh + 20) {
    if (y + sumH > vy && y < vy + vh) {
      hits.add({ id: 'lb:toggle-ladder', x: vx + 4, y: Math.max(vy, y), w: rowW, h: Math.min(y + sumH, vy + vh) - Math.max(vy, y) });
    }
    drawIvorySlab(c, vx + 4, y, rowW, sumH, 20, '#fffdf8', '#f6e8cb', lb.showRankLadder ? '#c97416' : '#7e5530', lb.showRankLadder ? 3.2 : 2.6);
    round(c, vx + 20, y + 18, 92, 92, 20, '#fff3d6', '#7a5230', 2.4);
    if (!drawSpriteContain(c, `avatar_${profile.avatarId}`, vx + 26, y + 24, 80, 80)) {
      drawSpriteContain(c, 'avatar_capybara', vx + 26, y + 24, 80, 80);
    }

    const rName = t(`rank.${rank.index}`);
    drawText(c, rName, vx + 130, y + 36, 29, PALETTE.ink, 'left', 900);
    c.font = '900 29px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
    const rw = c.measureText(rName).width;
    round(c, vx + 144 + rw, y + 20, 142, 34, 17, '#f2e0bc', '#8c5d2c', 2);
    drawText(c, t(lb.showRankLadder ? 'p19.rankLadderHide' : 'p19.rankLadderShow'), vx + 215 + rw, y + 38, 19, '#5c3612', 'center', 900);

    const progText = t(nextRank ? 'p11.profile.rankProgress' : 'p11.profile.topRank', {
      count: nextRank ? nextRank.minStars - profile.stars : 0,
      coins: rank.winCoins,
    });
    drawText(c, progText, vx + 130, y + 74, 21, PALETTE.inkSoft, 'left', 800);
    drawProgressBar(c, vx + 130, y + 96, rowW - 280, 14, progress, '#e8b43c', '#e6dac4', '#8c6239');

    drawIconLabel(c, 'ui_star_rank', String(profile.stars), vx + 4 + rowW - 122, y + 64, 34, 29, '#9e5a0c');
  }
  y += sumH + 12;

  // 2A. 54-Rank Ladder Sub-View when toggled open
  if (lb.showRankLadder) {
    const headH = 116;
    if (y + headH >= vy - 20 && y <= vy + vh + 20) {
      drawIvorySlab(c, vx + 4, y, rowW, headH, 18, '#e9fae0', '#d4f2c4', '#3d8633', 2.4);
      drawText(c, t('p19.rankLadderTitle'), vx + 24, y + 30, 25, '#1f5418', 'left', 900);
      drawWrappedText(c, t('p19.rankLadderSub'), vx + 24, y + 52, rowW - 180, 19, 25, '#2b6123', 'left', 800, 2);
      if (y + headH > vy && y < vy + vh) {
        drawPillButton(c, hits, 'lb:toggle-ladder', vx + 4 + rowW - 144, y + 34, 128, 48, t('p19.rankLadderBack'), 'cream', { fontSize: 20 });
      }
    }
    y += headH + 12;

    const rh = 86, rg = 10;
    RANKS.forEach((rk, i) => {
      if (y + rh >= vy - 20 && y <= vy + vh + 20) {
        const isCur = i === rank.index;
        const reached = i < rank.index;
        const nxt = RANKS[i + 1];
        const range = nxt ? `${rk.minStars}–${nxt.minStars - 1}★` : `${rk.minStars}★+`;
        drawIvorySlab(c, vx + 4, y, rowW, rh, 18, isCur ? '#fff0a8' : '#fffdf8', isCur ? '#f7d874' : '#f6e8cb', isCur ? '#c96214' : '#8a6239', isCur ? 3 : 2);
        drawIconLabel(c, 'ui_star_rank', range, vx + 18, y + rh / 2, 26, 21, '#8c4b10');
        drawText(c, t(`rank.${i}`), vx + 168, y + 30, 25, PALETTE.ink, 'left', 900);
        const extra = getRankDifficulty(i).extraCount;
        const mapTag = i === 0 ? t('map.sunny_backyard') : i === 10 ? t('map.sakura_onsen') : i === 20 ? t('map.midnight_kitchen') : i === 30 ? t('map.cat_tower_maze') : '';
        const multStr = Number(rk.fragmentMultiplier.toFixed(2)).toString();
        const details = [
          t('p19.rankWinCoins', { coins: rk.winCoins }),
          t('p19.rankFragBoost', { mult: multStr }),
          ...(extra ? [t('p19.rankExtraMinions', { count: extra })] : []),
          ...(mapTag ? [mapTag] : []),
        ].join(' · ');
        drawText(c, details, vx + 168, y + 62, 18.5, PALETTE.inkSoft, 'left', 800);
        const pillText = isCur ? t('p19.rankCurrent') : reached ? '✓' : `+${Math.max(1, rk.minStars - profile.stars)}★`;
        round(c, vx + 4 + rowW - 114, y + 24, 98, 38, 19, isCur ? '#f5c23b' : reached ? '#dff5d6' : '#eee3cf', '#8a5d32', 1.8);
        drawText(c, pillText, vx + 4 + rowW - 65, y + 44, 19, isCur ? '#4a250a' : reached ? '#22591b' : PALETTE.inkSoft, 'center', 900);
      }
      y += rh + rg;
    });

    const contentH = Math.max(vh, y + scroll.offset - vy + 10);
    c.restore();
    scroll.setContentBounds(contentH, vh);
    drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
    return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
  }

  // 2B. GIANT Global Rank Toolbar Card
  const snap = lb.rankSnap;
  const online = snap.mode === 'online' && snap.entries.length > 0;
  const toolH = 104;
  if (y + toolH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, toolH, 20, '#fffdf8', '#f6e8cb', '#7e5530', 2.4);
    const myRankStr = online && snap.me && snap.me.rank > 0
      ? t('p17.rankBoard.rank', { rank: snap.me.rank, total: Math.max(snap.totalPlayers, snap.me.rank) })
      : (zh ? `本地段位榜 · ${displayNickname(profile, lang)}` : `Local Board · ${displayNickname(profile, lang)}`);
    drawText(c, myRankStr, vx + 24, y + 30, 24, '#8c4912', 'left', 900);

    const loc = formatLocation(profile.locationLabel, lang, profile.playerId);
    round(c, vx + 22, y + 52, 208, 38, 19, '#f5e8cc', '#9c7344', 1.8);
    drawSpriteContain(c, 'ui_map_sign', vx + 30, y + 58, 26, 26);
    drawText(c, loc.slice(0, 8), vx + 62, y + 72, 19, PALETTE.inkSoft, 'left', 900);

    if (y + toolH > vy && y < vy + vh) {
      drawPillButton(c, hits, 'lb:rename', vx + 244, y + 48, 122, 44, zh ? '改昵称' : 'Rename', 'green', { fontSize: 20 });
      drawPillButton(c, hits, 'lb:share', vx + 378, y + 48, 112, 44, zh ? '分享' : 'Share', 'gold', { fontSize: 20 });
      drawPillButton(c, hits, 'lb:refresh', vx + 4 + rowW - 134, y + 26, 116, 52, lb.loading ? '…' : (zh ? '刷新' : 'Sync'), 'cream', { fontSize: 22 });
    }
  }
  y += toolH + 14;

  // 3. Heading + GIANT Single-Column Player Rows
  const myNick = displayNickname(profile, lang);
  const rows = online
    ? snap.entries.map((e, i) => ({
        place: e.rank || i + 1,
        name: e.nickname,
        avatar: e.avatarId,
        stars: e.stars,
        loc: formatLocation(e.location, lang, e.nickname),
        isMe: Boolean(e.isMe),
      }))
    : getLeaderboard(profile).map((e, i) => ({
        place: i + 1,
        name: e.isPlayer ? myNick : e.name[lang],
        avatar: e.avatarId,
        stars: e.stars,
        loc: formatLocation(e.isPlayer ? profile.locationLabel : undefined, lang, e.isPlayer ? profile.playerId : e.id),
        isMe: e.isPlayer,
      }));

  if (y + 32 >= vy - 20 && y <= vy + vh + 20) {
    drawText(
      c,
      online ? `${t('p17.rankBoard.top', { count: Math.min(100, rows.length) })}  ${t('p17.board.players', { total: snap.totalPlayers })}` : t('m3.localBoard'),
      vx + 8,
      y + 16,
      23,
      '#fffdf5',
      'left',
      900,
    );
  }
  y += 40;

  const rh = 104, rg = 12;
  rows.forEach(r => {
    if (y + rh >= vy - 20 && y <= vy + vh + 20) {
      drawIvorySlab(c, vx + 4, y, rowW, rh, 20, r.isMe ? '#fff4c4' : '#fffdf8', r.isMe ? '#f8da7a' : '#f6e8cb', r.isMe ? '#c26912' : '#7e5530', r.isMe ? 3.2 : 2.4);
      const medal = r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : String(r.place);
      drawText(c, medal, vx + 44, y + rh / 2, r.place <= 3 ? 34 : 25, PALETTE.ink, 'center', 900);
      round(c, vx + 82, y + 14, 76, 76, 18, '#fff3d6', '#8a5d32', 2.2);
      drawSpriteContain(c, `avatar_${r.avatar}`, vx + 88, y + 20, 64, 64);
      drawText(c, r.name + (r.isMe ? ` ${t('p11.profile.youHere')}` : ''), vx + 176, y + 34, 26, PALETTE.ink, 'left', 900);
      const rkStr = t(`rank.${getRank(r.stars).index}`);
      drawText(c, rkStr, vx + 176, y + 72, 20.5, PALETTE.inkSoft, 'left', 800);
      c.font = '800 20.5px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
      const rkw = c.measureText(rkStr).width;
      drawSpriteContain(c, 'ui_map_sign', vx + 190 + rkw, y + 60, 22, 22);
      drawText(c, r.loc, vx + 216 + rkw, y + 72, 20, '#7c5d3a', 'left', 800);
      drawIconLabel(c, 'ui_star_rank', String(r.stars), vx + 4 + rowW - 122, y + rh / 2, 32, 28, '#9e5a0c');
    }
    y += rh + rg;
  });

  const contentH = Math.max(vh, y + scroll.offset - vy + 10);
  hits.popClip();
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

// ── SHARED ENDLESS BOARD BODY (WeChat Free Friend Board on wx; Local Board on Web/BL) ──
function drawEndlessBoardBody(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  lb: LeaderboardUiState,
  scroll: ScrollRegion,
  body: { x: number; y: number; w: number; h: number },
  fromMedallionHub: boolean,
  wxFriendCanvas: HTMLCanvasElement | null = null,
  wxFriendMode = false,
): { scrollViewport?: { x: number; y: number; w: number; h: number }; wxFriendViewport?: { x: number; y: number; w: number; h: number } } {
  const lang = getLanguage();
  const zh = lang === 'zh-CN';
  const myNick = displayNickname(profile, lang);
  const best = profile.bestEndlessWave ?? 0;

  // ── WECHAT OFFICIAL FREE FRIEND ENDLESS LEADERBOARD (Open Data Context sharedCanvas) ──
  if (wxFriendMode && wxFriendCanvas) {
    const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
    const rowW = vw - 8;
    const idH = 104;
    const idY = vy + 2;

    drawIvorySlab(c, vx + 4, idY, rowW, idH, 18, '#fffdf8', '#f6e8cb', '#7e5530', 2.4);
    round(c, vx + 18, idY + 14, 76, 76, 18, '#fff3d6', '#7a5230', 2.2);
    drawSpriteContain(c, `avatar_${profile.avatarId}`, vx + 24, idY + 20, 64, 64);

    drawText(c, zh ? '微信好友无尽榜' : 'WeChat Friend Endless', vx + 110, idY + 32, 26, PALETTE.ink, 'left', 900);
    const bestLine = best >= 11 ? t('p17.board.best', { wave: best }) : t('p17.board.noBest');
    drawText(c, bestLine, vx + 110, idY + 70, 21, best >= 11 ? '#6a2e8c' : PALETTE.inkSoft, 'left', 800);

    let rightCursor = vx + 4 + rowW - 16;
    drawPillButton(c, hits, 'lb:refresh', rightCursor - 116, idY + 26, 116, 52, lb.loading ? '…' : (zh ? '刷新' : 'Sync'), 'cream', { fontSize: 21 });
    rightCursor -= 128;
    drawPillButton(c, hits, 'lb:share', rightCursor - 136, idY + 26, 136, 52, zh ? '邀请好友' : 'Invite', 'gold', { fontSize: 21 });
    rightCursor -= 148;
    if (!fromMedallionHub) {
      drawPillButton(c, hits, 'modal:switch:medallions', rightCursor - 188, idY + 26, 188, 52, t('p17.board.medallions'), 'cream', { fontSize: 19.5, icon: 'ui_endless_crest' });
    }

    const listX = vx + 4;
    const listY = idY + idH + 10;
    const listW = rowW;
    const listH = Math.max(180, vy + vh - listY - 2);
    try {
      c.drawImage(wxFriendCanvas, listX, listY, listW, listH);
    } catch { /* sharedCanvas may still be initializing on first frame */ }
    return { wxFriendViewport: { x: listX, y: listY, w: listW, h: listH } };
  }

  const snap = lb.endlessSnap;
  const online = snap.mode === 'online' && snap.entries.length > 0;

  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();
  hits.pushClip(vx, vy, vw, vh);

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // Identity Card (GIANT mobile boxes & fonts!)
  const idH = 136;
  if (y + idH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, idH, 20, '#fffdf8', '#f6e8cb', '#7e5530', 2.4);
    round(c, vx + 20, y + 22, 92, 92, 20, '#fff3d6', '#7a5230', 2.4);
    drawSpriteContain(c, `avatar_${profile.avatarId}`, vx + 26, y + 28, 80, 80);

    drawText(c, myNick, vx + 130, y + 34, 27, PALETTE.ink, 'left', 900);
    const bestLine = best >= 11 ? t('p17.board.best', { wave: best }) : t('p17.board.noBest');
    drawText(c, bestLine, vx + 130, y + 72, 21, best >= 11 ? '#6a2e8c' : PALETTE.inkSoft, 'left', 800);
    const loc = formatLocation(profile.locationLabel, lang, profile.playerId);
    drawIconLabel(c, 'ui_map_sign', loc, vx + 130, y + 106, 22, 19, '#7c5d3a');

    if (y + idH > vy && y < vy + vh) {
      drawPillButton(c, hits, 'lb:rename', vx + 4 + rowW - 264, y + 18, 120, 44, zh ? '改昵称' : 'Rename', 'gold', { fontSize: 19.5 });
      drawPillButton(c, hits, 'lb:refresh', vx + 4 + rowW - 134, y + 18, 118, 44, lb.loading ? '…' : (zh ? '刷新' : 'Sync'), 'cream', { fontSize: 19.5 });
      if (!fromMedallionHub) {
        drawPillButton(c, hits, 'modal:switch:medallions', vx + 4 + rowW - 264, y + 74, 248, 44, t('p17.board.medallions'), 'cream', { fontSize: 19.5, icon: 'ui_endless_crest' });
      }
    }
  }
  y += idH + 14;

  const local = localEntry(profile, lang);
  const entries = snap.entries.length > 0 ? snap.entries : !online && local ? [local] : [];
  if (entries.length === 0) {
    drawIvorySlab(c, vx + 4, y, rowW, 148, 20);
    drawText(c, best >= 11 ? t('p17.board.best', { wave: best }) : t('p17.board.noBest'), vx + 4 + rowW / 2, y + 58, 25, PALETTE.ink, 'center', 900);
    drawText(c, zh ? '通关第 10 波并开启无尽模式即可冲击全球前 100 名！' : 'Clear Wave 10 and enter Endless to join the Global Top 100!', vx + 4 + rowW / 2, y + 102, 20, PALETTE.inkSoft, 'center', 800);
    y += 158;
  } else {
    if (y + 32 >= vy - 20 && y <= vy + vh + 20) {
      drawText(c, `${t(online ? 'p17.board.top' : 'p17.board.local', { count: Math.min(100, entries.length) })}`, vx + 8, y + 16, 23, '#fffdf5', 'left', 900);
    }
    y += 40;
    const rh = 104, rg = 12;
    entries.forEach((e, idx) => {
      if (y + rh >= vy - 20 && y <= vy + vh + 20) {
        const place = e.rank || idx + 1;
        drawIvorySlab(c, vx + 4, y, rowW, rh, 20, e.isMe ? '#f5e8ff' : '#fffdf8', e.isMe ? '#e6cfff' : '#f6e8cb', e.isMe ? '#7b3fa0' : '#7e5530', e.isMe ? 3.2 : 2.4);
        const medal = place <= 3 ? ['🥇', '🥈', '🥉'][place - 1] : `#${place}`;
        drawText(c, medal, vx + 44, y + rh / 2, place <= 3 ? 34 : 25, PALETTE.ink, 'center', 900);
        round(c, vx + 82, y + 14, 76, 76, 18, '#fff3d6', '#8a5d32', 2.2);
        drawSpriteContain(c, `avatar_${e.avatarId}`, vx + 88, y + 20, 64, 64);
        drawText(c, e.nickname + (e.isMe ? ` ${t('p17.board.me')}` : ''), vx + 176, y + 34, 25, PALETTE.ink, 'left', 900);

        const mvpSprite = e.mvpAwakened ? `${e.mvpKind}_awakened` : e.mvpKind;
        if (!drawSpriteContain(c, mvpSprite, vx + 176, y + 54, 36, 36)) {
          drawSpriteContain(c, e.mvpKind, vx + 176, y + 54, 36, 36);
        }
        const mm = Math.floor(e.elapsedSeconds / 60);
        const ss = String(Math.floor(e.elapsedSeconds % 60)).padStart(2, '0');
        drawText(c, `${e.awakenedCount ? `✦${e.awakenedCount} · ` : ''}${mm}:${ss} · ${formatLocation(e.location, lang, e.nickname)}`, vx + 220, y + 73, 19.5, PALETTE.inkSoft, 'left', 800);
        drawText(c, t('p17.board.wave', { wave: e.bestWave }), vx + 4 + rowW - 24, y + rh / 2, 26, '#6a2e8c', 'right', 900);
      }
      y += rh + rg;
    });
  }

  const contentH = Math.max(vh, y + scroll.offset - vy + 10);
  hits.popClip();
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

// ── TAB 3: KEEPER PASSPORT (`通行名片` — Single-Column Avatar List, Exact `ProfileScreens.ts`!) ──
function drawPassportBody(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  scroll: ScrollRegion,
  body: { x: number; y: number; w: number; h: number },
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const lang = getLanguage();
  const zh = lang === 'zh-CN';
  const rank = getRank(profile.stars);
  const nick = displayNickname(profile, lang);
  const rate = profile.matches ? Math.round((profile.wins / profile.matches) * 100) : 0;
  const loc = formatLocation(profile.locationLabel, lang, profile.playerId);

  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();
  hits.pushClip(vx, vy, vw, vh);

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // Top Passport Summary Card (GIANT readable!)
  const sumH = 136;
  if (y + sumH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, sumH, 20, '#fffdf8', '#f6e8cb', '#7e5530', 2.4);
    round(c, vx + 20, y + 22, 92, 92, 20, '#fff3d6', '#7a5230', 2.4);
    if (!drawSpriteContain(c, `avatar_${profile.avatarId}`, vx + 26, y + 28, 80, 80)) {
      drawSpriteContain(c, 'avatar_capybara', vx + 26, y + 28, 80, 80);
    }

    drawText(c, nick, vx + 130, y + 34, 28, PALETTE.ink, 'left', 900);
    drawText(c, `${t(`rank.${rank.index}`)} · ${loc}`, vx + 130, y + 72, 21, PALETTE.inkSoft, 'left', 800);
    drawText(c, t('p11.profile.record', { matches: profile.matches, rate, best: profile.bestWinStreak }), vx + 130, y + 106, 20, '#2b6b56', 'left', 900);

    if (y + sumH > vy && y < vy + vh) {
      drawPillButton(c, hits, 'profile:rename', vx + 4 + rowW - 156, y + 18, 140, 46, zh ? '✎ 改昵称' : '✎ Rename', 'gold', { fontSize: 20 });
      drawPillButton(c, hits, 'profile:share', vx + 4 + rowW - 156, y + 72, 140, 46, zh ? '分享名片' : 'Share', 'green', { fontSize: 20 });
    }
  }
  y += sumH + 14;

  // Heading: Avatar Collection
  if (y + 32 >= vy - 20 && y <= vy + vh + 20) {
    drawText(c, `${t('p11.profile.avatarCollection')} (${profile.unlockedAvatars.length}/${Object.keys(AVATARS).length})`, vx + 8, y + 16, 23, '#fffdf5', 'left', 900);
  }
  y += 40;

  // 2-Column GIANT Avatar Cards
  const avatars = Object.values(AVATARS);
  const cols = 2, gapX = 16, gapY = 12;
  const cardW = Math.floor((vw - 16 - gapX) / cols);
  const rh = 114;
  avatars.forEach((av, idx) => {
    const col = idx % cols, row = Math.floor(idx / cols);
    const rx = vx + 4 + col * (cardW + gapX);
    const ry = y + row * (rh + gapY);
    if (ry + rh >= vy - 20 && ry <= vy + vh + 20) {
      const unlocked = profile.unlockedAvatars.includes(av.id);
      const selected = profile.avatarId === av.id;
      if (ry + rh > vy && ry < vy + vh) {
        hits.add({
          id: `profile:avatar:${av.id}`,
          x: rx,
          y: Math.max(vy, ry),
          w: cardW,
          h: Math.min(ry + rh, vy + vh) - Math.max(vy, ry),
          data: { id: av.id, unlocked, desc: t(`avatar.${av.id}.desc`) },
        });
      }
      drawIvorySlab(
        c,
        rx,
        ry,
        cardW,
        rh,
        18,
        selected ? '#fff4c4' : unlocked ? '#fffdf8' : '#efe7d8',
        selected ? '#f7dc84' : unlocked ? '#f6e8cb' : '#e3d8c4',
        selected ? '#c96f14' : '#7e5530',
        selected ? 3 : 2,
      );
      round(c, rx + 14, ry + 15, 84, 84, 18, '#fff3d6', '#8a5d32', 2);
      if (!drawSpriteContain(c, `avatar_${av.id}`, rx + 20, ry + 21, 72, 72, unlocked ? 1 : 0.36)) {
        drawSpriteContain(c, 'avatar_capybara', rx + 20, ry + 21, 72, 72, 0.35);
      }

      drawText(c, t(`avatar.${av.id}`), rx + 112, ry + 38, 24, unlocked ? PALETTE.ink : PALETTE.muted, 'left', 900);
      drawWrappedText(c, t(`avatar.${av.id}.desc`), rx + 112, ry + 58, cardW - 234, 18, 23, PALETTE.inkSoft, 'left', 700, 2);

      const rCx = rx + cardW - 60;
      if (selected) {
        drawText(c, t('p11.profile.avatarCurrent'), rCx, ry + 36, 18.5, '#2c763d', 'center', 900);
        drawSpriteContain(c, 'ui_storybook_check', rCx - 15, ry + 56, 30, 30);
      } else if (unlocked) {
        round(c, rCx - 48, ry + 36, 96, 42, 21, '#f2e0bc', '#855a2e', 2);
        drawText(c, t('p11.profile.avatarChange'), rCx, ry + 58, 19, PALETTE.ink, 'center', 900);
      } else {
        drawText(c, t('m3.avatarLocked'), rCx, ry + 36, 18, PALETTE.muted, 'center', 800);
        drawSpriteContain(c, 'ui_lock_closed', rCx - 14, ry + 56, 28, 28);
      }
    }
  });
  y += Math.ceil(avatars.length / cols) * (rh + gapY);

  const contentH = Math.max(vh, y + scroll.offset - vy + 10);
  hits.popClip();
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

// ── TAB 4: GARDEN SETTINGS (`庭院设置` — EXACT `p18_preview_d17_settings.png`!) ──
function drawSettingsBody(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  scroll: ScrollRegion,
  body: { x: number; y: number; w: number; h: number },
  opts: { inBattle: boolean; devUnlocked: boolean },
): {
  scrollViewport?: { x: number; y: number; w: number; h: number };
  musicSlider?: { x: number; y: number; w: number; h: number };
  soundSlider?: { x: number; y: number; w: number; h: number };
} {
  const zh = getLanguage() === 'zh-CN';
  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();
  hits.pushClip(vx, vy, vw, vh);

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // Card 1: Music Volume (`♫` icon box + Golden Slider + %)
  const volH = 104;
  const sliderX = vx + 114, sliderW = rowW - 226;
  const musicSliderRect = { x: sliderX, y: y + 56, w: sliderW, h: 34 };
  if (y + volH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, volH, 20);
    round(c, vx + 22, y + 18, 68, 68, 16, '#f4efe6', '#8a6239', 2);
    drawText(c, '♫', vx + 56, y + 54, 36, PALETTE.ink, 'center', 900);
    drawText(c, t('p11.profile.musicVolume'), sliderX, y + 32, 24, PALETTE.ink, 'left', 900);
    drawGoldSlider(c, sliderX, y + 56, sliderW, 34, profile.settings.musicVolume);
    drawText(c, `${Math.round(profile.settings.musicVolume * 100)}%`, vx + 4 + rowW - 50, y + 54, 23, PALETTE.inkSoft, 'center', 900);
    if (y + volH > vy && y < vy + vh) {
      hits.add({ id: 'settings:music', x: sliderX - 14, y: y + 40, w: sliderW + 28, h: 56 });
    }
  }
  y += volH + 14;

  // Card 2: Sound FX Volume (hand-inked speaker box + Golden Slider + %)
  const soundSliderRect = { x: sliderX, y: y + 56, w: sliderW, h: 34 };
  if (y + volH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, volH, 20);
    round(c, vx + 22, y + 18, 68, 68, 16, '#f4efe6', '#8a6239', 2);
    drawMiniSpeakerIcon(c, vx + 56, y + 52);
    drawText(c, t('p11.profile.soundVolume'), sliderX, y + 32, 24, PALETTE.ink, 'left', 900);
    drawGoldSlider(c, sliderX, y + 56, sliderW, 34, profile.settings.soundVolume);
    drawText(c, `${Math.round(profile.settings.soundVolume * 100)}%`, vx + 4 + rowW - 50, y + 54, 23, PALETTE.inkSoft, 'center', 900);
    if (y + volH > vy && y < vy + vh) {
      hits.add({ id: 'settings:sound', x: sliderX - 14, y: y + 40, w: sliderW + 28, h: 56 });
    }
  }
  y += volH + 14;

  // Card 3: Grouped Toggle Slab (`显示伤害数字` + `语言切换` + optional `开发者调试` in dev builds only!)
  const showDevRow = __ENABLE_DEV_TOOLS__ && opts.devUnlocked;
  const rowsInToggle = 1 + (__ENABLE_ENGLISH__ ? 1 : 0) + (showDevRow ? 1 : 0);
  const rowStep = 90;
  const togH = rowsInToggle * rowStep;
  if (y + togH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, togH, 20);
    // Row 1: Show Damage Numbers + iOS green toggle switch
    drawText(c, t('m3.damage'), vx + 26, y + 32, 24, PALETTE.ink, 'left', 900);
    drawText(c, t('p5.damageHint'), vx + 26, y + 64, 19, PALETTE.inkSoft, 'left', 700);
    if (y + rowStep > vy && y < vy + vh) {
      drawToggleSwitch(c, hits, 'settings:damage', vx + 4 + rowW - 94, y + 28, profile.settings.showDamageNumbers);
    }

    let nextRowY = y + rowStep;
    c.strokeStyle = 'rgba(138,98,57,0.22)';
    c.lineWidth = 1.5;

    // Row 2: Language Switch (omitted in Chinese-only WeChat builds)
    if (__ENABLE_ENGLISH__) {
      const r2y = nextRowY;
      c.beginPath();
      c.moveTo(vx + 24, r2y);
      c.lineTo(vx + 4 + rowW - 24, r2y);
      c.stroke();
      drawText(c, zh ? '显示语言' : 'Language', vx + 26, r2y + 32, 24, PALETTE.ink, 'left', 900);
      drawText(c, zh ? '切换简体中文 / English 界面' : 'Switch between Chinese & English', vx + 26, r2y + 64, 19, PALETTE.inkSoft, 'left', 700);
      if (r2y + rowStep > vy && r2y < vy + vh) {
        drawPillButton(c, hits, 'settings:lang', vx + 4 + rowW - 184, r2y + 20, 162, 50, zh ? '中文 ⇄ EN' : 'EN ⇄ 中文', 'cream', { fontSize: 20 });
      }
      nextRowY += rowStep;
    }

    // Optional Row (when hidden 5-tap Dev Mode unlocked in dev builds only)
    if (showDevRow) {
      const r3y = nextRowY;
      c.beginPath();
      c.moveTo(vx + 24, r3y);
      c.lineTo(vx + 4 + rowW - 24, r3y);
      c.stroke();
      drawText(c, zh ? '开发者调试台' : 'Developer QA Panel', vx + 26, r3y + 32, 24, '#a83424', 'left', 900);
      drawText(c, zh ? '跳转新手节点 0~8、全解锁测试档与战局工具' : 'Jump onboarding stages 0–8 & battle tools', vx + 26, r3y + 64, 19, PALETTE.inkSoft, 'left', 700);
      if (r3y + rowStep > vy && r3y < vy + vh) {
        drawPillButton(c, hits, 'settings:open-dev', vx + 4 + rowW - 142, r3y + 20, 120, 50, zh ? '打开' : 'Open', 'coral', { fontSize: 20 });
      }
    }
  }
  y += togH + 14;

  // Card 4: Replay Tutorial
  if (!opts.inBattle) {
    const tutH = 104;
    if (y + tutH >= vy - 20 && y <= vy + vh + 20) {
      drawIvorySlab(c, vx + 4, y, rowW, tutH, 20);
      round(c, vx + 22, y + 16, 72, 72, 16, '#fff3d6', '#8a6239', 2);
      drawSpriteContain(c, 'ui_tutorial_capy', vx + 26, y + 20, 64, 64);
      drawText(c, t('p11.profile.tutorialReplay'), vx + 112, y + 36, 24, PALETTE.ink, 'left', 900);
      drawText(c, t('p11.profile.tutorialHint'), vx + 112, y + 68, 19, PALETTE.inkSoft, 'left', 700);
      if (y + tutH > vy && y < vy + vh) {
        drawPillButton(c, hits, 'settings:replay-tutorial', vx + 4 + rowW - 140, y + 27, 118, 50, t('p11.profile.start'), 'cream', { fontSize: 20 });
      }
    }
    y += tutH + 14;
  }

  const contentH = Math.max(vh, y + scroll.offset - vy + 6);
  hits.popClip();
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
  return {
    scrollViewport: { x: vx, y: vy, w: vw, h: vh },
    musicSlider: musicSliderRect,
    soundSlider: soundSliderRect,
  };
}

function drawMiniSpeakerIcon(c: CanvasRenderingContext2D, cx: number, cy: number): void {
  c.save();
  c.translate(cx, cy);
  c.fillStyle = '#5c7c99';
  c.strokeStyle = PALETTE.ink;
  c.lineWidth = 2.2;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(-11, -5);
  c.lineTo(-5, -5);
  c.lineTo(2, -11);
  c.lineTo(2, 11);
  c.lineTo(-5, 5);
  c.lineTo(-11, 5);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = '#3b82b6';
  c.beginPath();
  c.arc(4, 0, 7, -0.75, 0.75);
  c.stroke();
  c.beginPath();
  c.arc(4, 0, 12, -0.75, 0.75);
  c.stroke();
  c.restore();
}
