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
  opts?: { inBattle?: boolean; preparation?: boolean; guideStep?: DialogGuideStep | null; elapsed?: number },
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const totalLv = profileMedallionTotal(profile);
  const pulseSel = opts?.guideStep?.pulseSelector;

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
      { id: 'medallion:tab:endless-board', label: t('p11.tab.endless-board'), active: lb.medallionTab === 'endless-board' },
    ],
    footer1: t('p17.footer1'),
    footer2: opts?.inBattle ? t(opts.preparation ? 'p17.footerPreparation' : 'p17.footerNextBattle') : t('p17.footer2'),
    guideStep: opts?.guideStep,
    elapsed: opts?.elapsed,
  });

  if (lb.medallionTab === 'endless-board') {
    return drawEndlessBoardBody(c, hits, profile, lb, scroll, body, true);
  }

  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // Top Dashed-Border Endless-Only Notice (`medallion-endless-note` in `p18_preview_d13`!)
  const noteH = 52;
  if (y + noteH >= vy - 20 && y <= vy + vh + 20) {
    round(c, vx + 4, y, rowW, noteH, 16, '#fffdf6', 'transparent', 0);
    c.save();
    c.setLineDash([6, 4]);
    round(c, vx + 4, y, rowW, noteH, 16, 'transparent', '#9c6e3b', 2);
    c.restore();
    drawSpriteContain(c, 'ui_endless_emblem', vx + 18, y + 12, 28, 28);
    drawText(c, t('p17.endlessOnly'), vx + 54, y + 27, 16.5, PALETTE.ink, 'left', 800);
  }
  y += noteH + 12;

  // Single-Column 6 Medallion Cards
  const rowH = 132, gap = 12;
  const pulseFirst = pulseSel === '[data-action="medallion-up:med_breakthrough_atk"]';

  MEDALLION_IDS.forEach(medId => {
    const lv = getProfileMedallionLevel(profile, medId);
    const cost = medallionUpgradeCost(lv);
    const max = lv >= MEDALLION_MAX_LEVEL;
    const afford = canAffordMedallion(profile, medId);
    const shouldPulse = pulseFirst && medId === 'med_breakthrough_atk';

    if (y + rowH >= vy - 20 && y <= vy + vh + 20) {
      drawIvorySlab(
        c,
        vx + 4,
        y,
        rowW,
        rowH,
        18,
        shouldPulse ? '#fff8d4' : '#fffdf8',
        shouldPulse ? '#fae290' : '#f6e8cb',
        shouldPulse ? '#e08b19' : '#7e5530',
        shouldPulse ? 3.5 : 2,
      );

      round(c, vx + 18, y + 22, 86, 86, 18, '#fdf5df', '#8a5d32', 2);
      if (!drawSpriteContain(c, medId, vx + 23, y + 27, 76, 76)) {
        drawSpriteContain(c, 'ui_endless_crest', vx + 23, y + 27, 76, 76);
      }

      const tx = vx + 118;
      const name = t(`medallion.${medId}`);
      drawText(c, name, tx, y + 26, 21, PALETTE.ink, 'left', 900);
      c.font = '900 21px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
      const nw = c.measureText(name).width;
      round(c, tx + nw + 10, y + 14, 82, 24, 12, '#f5dec0', '#966430', 1.4);
      drawText(c, `Lv.${lv}/${MEDALLION_MAX_LEVEL}`, tx + nw + 51, y + 27, 13.5, '#7c3f08', 'center', 900);

      // Effect line + `now → next`
      const desc = t(`medallion.${medId}.desc`);
      const nowStr = medallionEffectText(medId, lv);
      const nextStr = max ? '' : medallionEffectText(medId, lv + 1);
      drawText(c, desc, tx, y + 54, 15.5, PALETTE.inkSoft, 'left', 700);
      c.font = '700 15.5px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
      const dw = c.measureText(desc).width;
      drawText(c, nowStr, tx + dw + 10, y + 54, 16.5, PALETTE.ink, 'left', 900);
      if (!max) {
        c.font = '900 16.5px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
        const nowW = c.measureText(nowStr).width;
        drawText(c, `→ ${nextStr}`, tx + dw + nowW + 18, y + 54, 16.5, '#c45218', 'left', 900);
      }

      // Slim Golden Progress Bar
      drawProgressBar(c, tx, y + 74, rowW - 280, 10, lv / MEDALLION_MAX_LEVEL, '#e8a832', '#e8dcc4', '#8c6239');

      // Cost Chips (`花费 [crest] [coin]`)
      if (cost) {
        drawText(c, t('p17.cost'), tx, y + 106, 14.5, PALETTE.inkSoft, 'left', 800);
        const crestOk = profile.endlessCrests >= cost.crests;
        const coinOk = profile.coins >= cost.coins;
        let cx = tx + 42;
        round(c, cx, y + 93, 92, 26, 13, crestOk ? '#e4f7dc' : '#f4e6d2', crestOk ? '#49913b' : '#a88c6c', 1.4);
        drawSpriteContain(c, 'ui_endless_crest', cx + 6, y + 96, 20, 20);
        drawText(c, formatCompactNumber(cost.crests), cx + 30, y + 107, 14, crestOk ? '#23591b' : '#7a5c3c', 'left', 900);
        cx += 100;
        round(c, cx, y + 93, 92, 26, 13, coinOk ? '#e4f7dc' : '#f4e6d2', coinOk ? '#49913b' : '#a88c6c', 1.4);
        drawSpriteContain(c, 'ui_coin_gold', cx + 6, y + 96, 20, 20);
        drawText(c, formatCompactNumber(cost.coins), cx + 30, y + 107, 14, coinOk ? '#23591b' : '#7a5c3c', 'left', 900);
      }

      // Right Action Pill Button (`升级` or `已满级`)
      if (y + rowH > vy && y < vy + vh) {
        if (max) {
          drawText(c, t('p17.maxed'), vx + 4 + rowW - 68, y + 66, 16, '#8c4c10', 'center', 900);
        } else {
          drawPillButton(c, hits, `medallion:up:${medId}`, vx + 4 + rowW - 122, y + 43, 108, 46, t('p17.upgrade'), afford ? 'gold' : 'muted', {
            fontSize: 17.5,
          });
        }
      }
    }
    y += rowH + gap;
  });

  const contentH = Math.max(vh, y + scroll.offset - vy + 10);
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
  opts: { inBattle: boolean; devUnlocked: boolean },
): {
  scrollViewport?: { x: number; y: number; w: number; h: number };
  musicSlider?: { x: number; y: number; w: number; h: number };
  soundSlider?: { x: number; y: number; w: number; h: number };
} {
  const showEndless = isFeatureUnlocked(profile, 'endless');
  const tabIds: ProfileHubTab[] = showEndless
    ? ['leaderboard', 'endless-board', 'profile', 'settings']
    : ['leaderboard', 'profile', 'settings'];

  const mascot = activeTab === 'leaderboard' || activeTab === 'endless-board' ? 'ui_rank_peek_capy' : 'ui_profile_peek_capy';
  const showStarsBadge = activeTab === 'leaderboard' || activeTab === 'profile';

  const body = drawLedgerShell(c, hits, {
    title: t(`p11.title.${activeTab}`),
    mascot,
    titleHitId: activeTab === 'settings' ? 'settings:title-tap' : undefined,
    badgeSegments: showStarsBadge ? [{ icon: 'ui_star_rank', text: String(profile.stars) }] : undefined,
    tabs: tabIds.map(tab => ({
      id: `profilehub:tab:${tab}`,
      label: t(`p11.tab.${tab}`),
      active: activeTab === tab,
    })),
    footer1: t(`p11.tip.${activeTab}.1`),
    footer2: t(`p11.tip.${activeTab}.2`),
  });

  if (activeTab === 'leaderboard') {
    return drawRankBoardBody(c, hits, profile, lb, scroll, body);
  }
  if (activeTab === 'endless-board') {
    return drawEndlessBoardBody(c, hits, profile, lb, scroll, body, false);
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
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const lang = getLanguage();
  const zh = lang === 'zh-CN';
  const rank = getRank(profile.stars);
  const nextRank = RANKS[rank.index + 1];
  const progress = nextRank ? Math.max(0, Math.min(1, (profile.stars - rank.minStars) / (nextRank.minStars - rank.minStars))) : 1;

  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // 1. Clickable My-Rank Summary Card (tapping toggles full 54-Rank Ladder!)
  const sumH = 104;
  if (y + sumH >= vy - 20 && y <= vy + vh + 20) {
    if (y + sumH > vy && y < vy + vh) {
      hits.add({ id: 'lb:toggle-ladder', x: vx + 4, y: Math.max(vy, y), w: rowW, h: Math.min(y + sumH, vy + vh) - Math.max(vy, y) });
    }
    drawIvorySlab(c, vx + 4, y, rowW, sumH, 18, '#fffdf8', '#f6e8cb', lb.showRankLadder ? '#c97416' : '#7e5530', lb.showRankLadder ? 2.6 : 2.2);
    round(c, vx + 18, y + 14, 76, 76, 16, '#fff3d6', '#7a5230', 2);
    if (!drawSpriteContain(c, `avatar_${profile.avatarId}`, vx + 23, y + 19, 66, 66)) {
      drawSpriteContain(c, 'avatar_capybara', vx + 23, y + 19, 66, 66);
    }

    const rName = t(`rank.${rank.index}`);
    drawText(c, rName, vx + 110, y + 30, 21.5, PALETTE.ink, 'left', 900);
    c.font = '900 21.5px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
    const rw = c.measureText(rName).width;
    round(c, vx + 120 + rw, y + 18, 108, 24, 12, '#f2e0bc', '#8c5d2c', 1.4);
    drawText(c, t(lb.showRankLadder ? 'p19.rankLadderHide' : 'p19.rankLadderShow'), vx + 174 + rw, y + 31, 13, '#5c3612', 'center', 900);

    const progText = t(nextRank ? 'p11.profile.rankProgress' : 'p11.profile.topRank', {
      count: nextRank ? nextRank.minStars - profile.stars : 0,
      coins: rank.winCoins,
    });
    drawText(c, progText, vx + 110, y + 58, 15, PALETTE.inkSoft, 'left', 800);
    drawProgressBar(c, vx + 110, y + 76, rowW - 230, 10, progress, '#e8b43c', '#e6dac4', '#8c6239');

    drawIconLabel(c, 'ui_star_rank', String(profile.stars), vx + 4 + rowW - 96, y + 52, 26, 22, '#9e5a0c');
  }
  y += sumH + 10;

  // 2A. 54-Rank Ladder Sub-View when toggled open
  if (lb.showRankLadder) {
    const headH = 96;
    if (y + headH >= vy - 20 && y <= vy + vh + 20) {
      drawIvorySlab(c, vx + 4, y, rowW, headH, 16, '#e9fae0', '#d4f2c4', '#3d8633', 2);
      drawText(c, t('p19.rankLadderTitle'), vx + 20, y + 24, 18.5, '#1f5418', 'left', 900);
      drawWrappedText(c, t('p19.rankLadderSub'), vx + 20, y + 40, rowW - 148, 13.5, 18, '#2b6123', 'left', 700, 3);
      if (y + headH > vy && y < vy + vh) {
        drawPillButton(c, hits, 'lb:toggle-ladder', vx + 4 + rowW - 118, y + 28, 104, 38, t('p19.rankLadderBack'), 'cream', { fontSize: 14.5 });
      }
    }
    y += headH + 10;

    const rh = 60, rg = 8;
    RANKS.forEach((rk, i) => {
      if (y + rh >= vy - 20 && y <= vy + vh + 20) {
        const isCur = i === rank.index;
        const reached = i < rank.index;
        const nxt = RANKS[i + 1];
        const range = nxt ? `${rk.minStars}–${nxt.minStars - 1}★` : `${rk.minStars}★+`;
        drawIvorySlab(c, vx + 4, y, rowW, rh, 14, isCur ? '#fff0a8' : '#fffdf8', isCur ? '#f7d874' : '#f6e8cb', isCur ? '#c96214' : '#8a6239', isCur ? 2.6 : 1.6);
        drawIconLabel(c, 'ui_star_rank', range, vx + 16, y + rh / 2, 20, 15, '#8c4b10');
        drawText(c, t(`rank.${i}`), vx + 128, y + 22, 17.5, PALETTE.ink, 'left', 900);
        const extra = getRankDifficulty(i).extraCount;
        const mapTag = i === 0 ? t('map.sunny_backyard') : i === 10 ? t('map.sakura_onsen') : i === 20 ? t('map.midnight_kitchen') : i === 30 ? t('map.cat_tower_maze') : '';
        drawText(c, `+${rk.winCoins}金币 · 碎片×${rk.fragmentMultiplier.toFixed(1)}${extra ? ` · +${extra}怪` : ''}${mapTag ? ` · ${mapTag}` : ''}`, vx + 128, y + 45, 13.5, PALETTE.inkSoft, 'left', 700);
        const pillText = isCur ? t('p19.rankCurrent') : reached ? '✓' : `+${Math.max(1, rk.minStars - profile.stars)}★`;
        round(c, vx + 4 + rowW - 86, y + 17, 72, 26, 13, isCur ? '#f5c23b' : reached ? '#dff5d6' : '#eee3cf', '#8a5d32', 1.4);
        drawText(c, pillText, vx + 4 + rowW - 50, y + 31, 13.5, isCur ? '#4a250a' : reached ? '#22591b' : PALETTE.inkSoft, 'center', 900);
      }
      y += rh + rg;
    });

    const contentH = Math.max(vh, y + scroll.offset - vy + 10);
    c.restore();
    scroll.setContentBounds(contentH, vh);
    drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
    return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
  }

  // 2B. Global Rank Toolbar Card (`p18_preview_d15`!)
  const snap = lb.rankSnap;
  const online = snap.mode === 'online' && snap.entries.length > 0;
  const toolH = 74;
  if (y + toolH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, toolH, 16, '#fffdf8', '#f6e8cb', '#7e5530', 1.8);
    const myRankStr = online && snap.me && snap.me.rank > 0
      ? t('p17.rankBoard.rank', { rank: snap.me.rank, total: Math.max(snap.totalPlayers, snap.me.rank) })
      : (zh ? `本地段位榜 · ${displayNickname(profile, lang)}` : `Local Board · ${displayNickname(profile, lang)}`);
    drawText(c, myRankStr, vx + 20, y + 24, 16.5, '#8c4912', 'left', 900);

    const loc = formatLocation(profile.locationLabel, lang, profile.playerId);
    round(c, vx + 18, y + 40, 152, 26, 13, '#f5e8cc', '#9c7344', 1.4);
    drawSpriteContain(c, 'ui_map_sign', vx + 24, y + 44, 18, 18);
    drawText(c, loc.slice(0, 8), vx + 46, y + 54, 13.5, PALETTE.inkSoft, 'left', 800);

    if (y + toolH > vy && y < vy + vh) {
      drawPillButton(c, hits, 'lb:rename', vx + 180, y + 38, 92, 30, zh ? '改昵称' : 'Rename', 'green', { fontSize: 13.5 });
      drawPillButton(c, hits, 'lb:share', vx + 280, y + 38, 86, 30, zh ? '分享' : 'Share', 'gold', { fontSize: 13.5 });
      drawPillButton(c, hits, 'lb:refresh', vx + 4 + rowW - 108, y + 18, 94, 38, lb.loading ? '…' : `↻ ${zh ? '刷新' : 'Sync'}`, 'cream', { fontSize: 15 });
    }
  }
  y += toolH + 12;

  // 3. Heading + Single-Column Player Rows
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

  if (y + 26 >= vy - 20 && y <= vy + vh + 20) {
    drawText(
      c,
      online ? `${t('p17.rankBoard.top', { count: Math.min(100, rows.length) })}  ${t('p17.board.players', { total: snap.totalPlayers })}` : t('m3.localBoard'),
      vx + 8,
      y + 12,
      17.5,
      '#fffdf5',
      'left',
      900,
    );
  }
  y += 32;

  const rh = 78, rg = 10;
  rows.forEach(r => {
    if (y + rh >= vy - 20 && y <= vy + vh + 20) {
      drawIvorySlab(c, vx + 4, y, rowW, rh, 16, r.isMe ? '#fff4c4' : '#fffdf8', r.isMe ? '#f8da7a' : '#f6e8cb', r.isMe ? '#c26912' : '#7e5530', r.isMe ? 2.6 : 1.8);
      const medal = r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : String(r.place);
      drawText(c, medal, vx + 36, y + rh / 2, r.place <= 3 ? 26 : 19, PALETTE.ink, 'center', 900);
      round(c, vx + 64, y + 11, 56, 56, 14, '#fff3d6', '#8a5d32', 1.8);
      drawSpriteContain(c, `avatar_${r.avatar}`, vx + 68, y + 15, 48, 48);
      drawText(c, r.name + (r.isMe ? ` ${t('p11.profile.youHere')}` : ''), vx + 134, y + 26, 19.5, PALETTE.ink, 'left', 900);
      const rkStr = t(`rank.${getRank(r.stars).index}`);
      drawText(c, rkStr, vx + 134, y + 54, 15, PALETTE.inkSoft, 'left', 700);
      c.font = '700 15px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
      const rkw = c.measureText(rkStr).width;
      drawSpriteContain(c, 'ui_map_sign', vx + 144 + rkw, y + 45, 16, 16);
      drawText(c, r.loc, vx + 164 + rkw, y + 54, 14.5, '#7c5d3a', 'left', 700);
      drawIconLabel(c, 'ui_star_rank', String(r.stars), vx + 4 + rowW - 92, y + rh / 2, 24, 21, '#9e5a0c');
    }
    y += rh + rg;
  });

  const contentH = Math.max(vh, y + scroll.offset - vy + 10);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

// ── SHARED GLOBAL ENDLESS BOARD BODY (used in BOTH Medallions Tab 2 & Profile Hub Tab 2!) ──
function drawEndlessBoardBody(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  lb: LeaderboardUiState,
  scroll: ScrollRegion,
  body: { x: number; y: number; w: number; h: number },
  fromMedallionHub: boolean,
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const lang = getLanguage();
  const zh = lang === 'zh-CN';
  const myNick = displayNickname(profile, lang);
  const best = profile.bestEndlessWave ?? 0;
  const snap = lb.endlessSnap;
  const online = snap.mode === 'online' && snap.entries.length > 0;

  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // Identity Card
  const idH = 114;
  if (y + idH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, idH, 18, '#fffdf8', '#f6e8cb', '#7e5530', 2);
    round(c, vx + 18, y + 18, 76, 76, 16, '#fff3d6', '#7a5230', 2);
    drawSpriteContain(c, `avatar_${profile.avatarId}`, vx + 23, y + 23, 66, 66);

    drawText(c, myNick, vx + 110, y + 28, 21, PALETTE.ink, 'left', 900);
    const bestLine = best >= 11 ? t('p17.board.best', { wave: best }) : t('p17.board.noBest');
    drawText(c, bestLine, vx + 110, y + 58, 15.5, best >= 11 ? '#6a2e8c' : PALETTE.inkSoft, 'left', 800);
    const loc = formatLocation(profile.locationLabel, lang, profile.playerId);
    drawIconLabel(c, 'ui_map_sign', loc, vx + 110, y + 88, 18, 14.5, '#7c5d3a');

    if (y + idH > vy && y < vy + vh) {
      drawPillButton(c, hits, 'lb:rename', vx + 4 + rowW - 216, y + 16, 96, 36, zh ? '改昵称' : 'Rename', 'gold', { fontSize: 14.5 });
      drawPillButton(c, hits, 'lb:refresh', vx + 4 + rowW - 110, y + 16, 96, 36, lb.loading ? '…' : `↻ ${zh ? '刷新' : 'Sync'}`, 'cream', { fontSize: 14.5 });
      if (!fromMedallionHub) {
        drawPillButton(c, hits, 'modal:switch:medallions', vx + 4 + rowW - 216, y + 62, 202, 36, t('p17.board.medallions'), 'cream', { fontSize: 14.5, icon: 'ui_endless_crest' });
      }
    }
  }
  y += idH + 12;

  const local = localEntry(profile, lang);
  const entries = snap.entries.length > 0 ? snap.entries : !online && local ? [local] : [];
  if (entries.length === 0) {
    drawIvorySlab(c, vx + 4, y, rowW, 130, 16);
    drawText(c, best >= 11 ? t('p17.board.best', { wave: best }) : t('p17.board.noBest'), vx + 4 + rowW / 2, y + 54, 19, PALETTE.ink, 'center', 900);
    drawText(c, zh ? '通关第 10 波并开启无尽模式即可冲击全球前 100 名！' : 'Clear Wave 10 and enter Endless to join the Global Top 100!', vx + 4 + rowW / 2, y + 88, 15, PALETTE.inkSoft, 'center', 700);
    y += 140;
  } else {
    if (y + 26 >= vy - 20 && y <= vy + vh + 20) {
      drawText(c, `${t(online ? 'p17.board.top' : 'p17.board.local', { count: Math.min(100, entries.length) })}`, vx + 8, y + 12, 17, '#fffdf5', 'left', 900);
    }
    y += 32;
    const rh = 80, rg = 10;
    entries.forEach((e, idx) => {
      if (y + rh >= vy - 20 && y <= vy + vh + 20) {
        const place = e.rank || idx + 1;
        drawIvorySlab(c, vx + 4, y, rowW, rh, 16, e.isMe ? '#f5e8ff' : '#fffdf8', e.isMe ? '#e6cfff' : '#f6e8cb', e.isMe ? '#7b3fa0' : '#7e5530', e.isMe ? 2.6 : 1.8);
        const medal = place <= 3 ? ['🥇', '🥈', '🥉'][place - 1] : `#${place}`;
        drawText(c, medal, vx + 36, y + rh / 2, place <= 3 ? 26 : 19, PALETTE.ink, 'center', 900);
        round(c, vx + 64, y + 12, 56, 56, 14, '#fff3d6', '#8a5d32', 1.8);
        drawSpriteContain(c, `avatar_${e.avatarId}`, vx + 68, y + 16, 48, 48);
        drawText(c, e.nickname + (e.isMe ? ` ${t('p17.board.me')}` : ''), vx + 134, y + 26, 19, PALETTE.ink, 'left', 900);

        const mvpSprite = e.mvpAwakened ? `${e.mvpKind}_awakened` : e.mvpKind;
        if (!drawSpriteContain(c, mvpSprite, vx + 134, y + 40, 30, 30)) {
          drawSpriteContain(c, e.mvpKind, vx + 134, y + 40, 30, 30);
        }
        const mm = Math.floor(e.elapsedSeconds / 60);
        const ss = String(Math.floor(e.elapsedSeconds % 60)).padStart(2, '0');
        drawText(c, `${e.awakenedCount ? `✦${e.awakenedCount} · ` : ''}${mm}:${ss} · ${formatLocation(e.location, lang, e.nickname)}`, vx + 170, y + 56, 14.5, PALETTE.inkSoft, 'left', 700);
        drawText(c, t('p17.board.wave', { wave: e.bestWave }), vx + 4 + rowW - 22, y + rh / 2, 20, '#6a2e8c', 'right', 900);
      }
      y += rh + rg;
    });
  }

  const contentH = Math.max(vh, y + scroll.offset - vy + 10);
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

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // Top Passport Summary Card
  const sumH = 114;
  if (y + sumH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, sumH, 18, '#fffdf8', '#f6e8cb', '#7e5530', 2.2);
    round(c, vx + 18, y + 18, 78, 78, 18, '#fff3d6', '#7a5230', 2.2);
    if (!drawSpriteContain(c, `avatar_${profile.avatarId}`, vx + 23, y + 23, 68, 68)) {
      drawSpriteContain(c, 'avatar_capybara', vx + 23, y + 23, 68, 68);
    }

    drawText(c, nick, vx + 112, y + 28, 22, PALETTE.ink, 'left', 900);
    drawText(c, `${t(`rank.${rank.index}`)} · ${loc}`, vx + 112, y + 58, 15.5, PALETTE.inkSoft, 'left', 800);
    drawText(c, t('p11.profile.record', { matches: profile.matches, rate, best: profile.bestWinStreak }), vx + 112, y + 86, 15, '#2b6b56', 'left', 800);

    if (y + sumH > vy && y < vy + vh) {
      drawPillButton(c, hits, 'profile:rename', vx + 4 + rowW - 126, y + 14, 112, 38, zh ? '✎ 改昵称' : '✎ Rename', 'gold', { fontSize: 14.5 });
      drawPillButton(c, hits, 'profile:share', vx + 4 + rowW - 126, y + 60, 112, 38, zh ? '分享名片' : 'Share', 'green', { fontSize: 14.5 });
    }
  }
  y += sumH + 14;

  // Heading: Avatar Collection
  if (y + 26 >= vy - 20 && y <= vy + vh + 20) {
    drawText(c, `${t('p11.profile.avatarCollection')} (${profile.unlockedAvatars.length}/${Object.keys(AVATARS).length})`, vx + 8, y + 12, 17.5, '#fffdf5', 'left', 900);
  }
  y += 32;

  // Single-Column Avatar Rows (EXACT `ProfileScreens.ts` `passport()`!)
  const avatars = Object.values(AVATARS);
  const rh = 86, rg = 10;
  avatars.forEach(av => {
    if (y + rh >= vy - 20 && y <= vy + vh + 20) {
      const unlocked = profile.unlockedAvatars.includes(av.id);
      const selected = profile.avatarId === av.id;
      if (y + rh > vy && y < vy + vh) {
        hits.add({
          id: `profile:avatar:${av.id}`,
          x: vx + 4,
          y: Math.max(vy, y),
          w: rowW,
          h: Math.min(y + rh, vy + vh) - Math.max(vy, y),
          data: { id: av.id, unlocked, desc: t(`avatar.${av.id}.desc`) },
        });
      }
      drawIvorySlab(
        c,
        vx + 4,
        y,
        rowW,
        rh,
        16,
        selected ? '#fff4c4' : unlocked ? '#fffdf8' : '#efe7d8',
        selected ? '#f7dc84' : unlocked ? '#f6e8cb' : '#e3d8c4',
        selected ? '#c96f14' : '#7e5530',
        selected ? 2.6 : 1.8,
      );
      round(c, vx + 16, y + 11, 64, 64, 15, '#fff3d6', '#8a5d32', 1.8);
      if (!drawSpriteContain(c, `avatar_${av.id}`, vx + 20, y + 15, 56, 56, unlocked ? 1 : 0.36)) {
        drawSpriteContain(c, 'avatar_capybara', vx + 20, y + 15, 56, 56, 0.35);
      }

      drawText(c, t(`avatar.${av.id}`), vx + 96, y + 30, 19.5, unlocked ? PALETTE.ink : PALETTE.muted, 'left', 900);
      drawText(c, t(`avatar.${av.id}.desc`), vx + 96, y + 58, 15, PALETTE.inkSoft, 'left', 700);

      const rCx = vx + 4 + rowW - 60;
      if (selected) {
        drawText(c, t('p11.profile.avatarCurrent'), rCx, y + 28, 15, '#2c763d', 'center', 900);
        drawSpriteContain(c, 'ui_storybook_check', rCx - 13, y + 44, 26, 26);
      } else if (unlocked) {
        round(c, rCx - 42, y + 25, 84, 34, 17, '#f2e0bc', '#855a2e', 1.6);
        drawText(c, t('p11.profile.avatarChange'), rCx, y + 43, 15.5, PALETTE.ink, 'center', 900);
      } else {
        drawText(c, t('m3.avatarLocked'), rCx, y + 28, 14.5, PALETTE.muted, 'center', 800);
        drawSpriteContain(c, 'ui_lock_closed', rCx - 12, y + 44, 24, 24);
      }
    }
    y += rh + rg;
  });

  const contentH = Math.max(vh, y + scroll.offset - vy + 10);
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

  const rowW = vw - 14;
  let y = vy + 4 - scroll.offset;

  // Card 1: Music Volume (`♫` icon box + Golden Slider + %)
  const volH = 92;
  const sliderX = vx + 104, sliderW = rowW - 196;
  const musicSliderRect = { x: sliderX, y: y + 48, w: sliderW, h: 30 };
  if (y + volH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, volH, 18);
    round(c, vx + 20, y + 16, 60, 60, 14, '#f4efe6', '#8a6239', 1.8);
    drawText(c, '♫', vx + 50, y + 48, 30, PALETTE.ink, 'center', 900);
    drawText(c, t('p11.profile.musicVolume'), sliderX, y + 30, 19.5, PALETTE.ink, 'left', 900);
    drawGoldSlider(c, sliderX, y + 48, sliderW, 30, profile.settings.musicVolume);
    drawText(c, `${Math.round(profile.settings.musicVolume * 100)}%`, vx + 4 + rowW - 42, y + 48, 18, PALETTE.inkSoft, 'center', 900);
    if (y + volH > vy && y < vy + vh) {
      hits.add({ id: 'settings:music', x: sliderX - 14, y: Math.max(vy, y + 36), w: sliderW + 28, h: 48 });
    }
  }
  y += volH + 12;

  // Card 2: Sound FX Volume (hand-inked speaker box + Golden Slider + %)
  const soundSliderRect = { x: sliderX, y: y + 48, w: sliderW, h: 30 };
  if (y + volH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, volH, 18);
    round(c, vx + 20, y + 16, 60, 60, 14, '#f4efe6', '#8a6239', 1.8);
    drawMiniSpeakerIcon(c, vx + 50, y + 46);
    drawText(c, t('p11.profile.soundVolume'), sliderX, y + 30, 19.5, PALETTE.ink, 'left', 900);
    drawGoldSlider(c, sliderX, y + 48, sliderW, 30, profile.settings.soundVolume);
    drawText(c, `${Math.round(profile.settings.soundVolume * 100)}%`, vx + 4 + rowW - 42, y + 48, 18, PALETTE.inkSoft, 'center', 900);
    if (y + volH > vy && y < vy + vh) {
      hits.add({ id: 'settings:sound', x: sliderX - 14, y: Math.max(vy, y + 36), w: sliderW + 28, h: 48 });
    }
  }
  y += volH + 12;

  // Card 3: Grouped Toggle Slab (`显示伤害数字` + `语言切换` + optional `开发者调试`)
  const rowsInToggle = opts.devUnlocked ? 3 : 2;
  const togH = rowsInToggle * 78;
  if (y + togH >= vy - 20 && y <= vy + vh + 20) {
    drawIvorySlab(c, vx + 4, y, rowW, togH, 18);
    // Row 1: Show Damage Numbers + iOS green toggle switch
    drawText(c, t('m3.damage'), vx + 24, y + 28, 19.5, PALETTE.ink, 'left', 900);
    drawText(c, t('p5.damageHint'), vx + 24, y + 54, 14.5, PALETTE.inkSoft, 'left', 700);
    if (y + 78 > vy && y < vy + vh) {
      drawToggleSwitch(c, hits, 'settings:damage', vx + 4 + rowW - 88, y + 22, profile.settings.showDamageNumbers);
    }

    // Divider 1
    c.strokeStyle = 'rgba(138,98,57,0.22)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(vx + 22, y + 78);
    c.lineTo(vx + 4 + rowW - 22, y + 78);
    c.stroke();

    // Row 2: Language Switch
    const r2y = y + 78;
    drawText(c, zh ? '显示语言' : 'Language', vx + 24, r2y + 28, 19.5, PALETTE.ink, 'left', 900);
    drawText(c, zh ? '切换简体中文 / English 界面' : 'Switch between Chinese & English', vx + 24, r2y + 54, 14.5, PALETTE.inkSoft, 'left', 700);
    if (r2y + 78 > vy && r2y < vy + vh) {
      drawPillButton(c, hits, 'settings:lang', vx + 4 + rowW - 154, r2y + 18, 134, 42, zh ? '中文 ⇄ EN' : 'EN ⇄ 中文', 'cream', { fontSize: 15.5 });
    }

    // Row 3 (when hidden 5-tap Dev Mode unlocked): Open Developer QA Workbench
    if (opts.devUnlocked) {
      const r3y = y + 156;
      c.beginPath();
      c.moveTo(vx + 22, r3y);
      c.lineTo(vx + 4 + rowW - 22, r3y);
      c.stroke();
      drawText(c, zh ? '开发者调试台' : 'Developer QA Panel', vx + 24, r3y + 28, 19.5, '#a83424', 'left', 900);
      drawText(c, zh ? '跳转新手节点 0~8、全解锁测试档与战局工具' : 'Jump onboarding stages 0–8 & battle tools', vx + 24, r3y + 54, 14.5, PALETTE.inkSoft, 'left', 700);
      if (r3y + 78 > vy && r3y < vy + vh) {
        drawPillButton(c, hits, 'settings:open-dev', vx + 4 + rowW - 122, r3y + 18, 102, 42, zh ? '打开' : 'Open', 'coral', { fontSize: 16 });
      }
    }
  }
  y += togH + 12;

  // Card 4: Replay Tutorial (`重温新手教程` — EXACT `p18_preview_d17_settings.png`!)
  if (!opts.inBattle) {
    const tutH = 92;
    if (y + tutH >= vy - 20 && y <= vy + vh + 20) {
      drawIvorySlab(c, vx + 4, y, rowW, tutH, 18);
      round(c, vx + 20, y + 14, 64, 64, 14, '#fff3d6', '#8a6239', 1.8);
      drawSpriteContain(c, 'ui_tutorial_capy', vx + 24, y + 18, 56, 56);
      drawText(c, t('p11.profile.tutorialReplay'), vx + 102, y + 32, 19.5, PALETTE.ink, 'left', 900);
      drawText(c, t('p11.profile.tutorialHint'), vx + 102, y + 60, 14.5, PALETTE.inkSoft, 'left', 700);
      if (y + tutH > vy && y < vy + vh) {
        drawPillButton(c, hits, 'settings:replay-tutorial', vx + 4 + rowW - 116, y + 25, 96, 42, t('p11.profile.start'), 'cream', { fontSize: 16 });
      }
    }
    y += tutH + 12;
  }

  const contentH = Math.max(vh, y + scroll.offset - vy + 6);
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
