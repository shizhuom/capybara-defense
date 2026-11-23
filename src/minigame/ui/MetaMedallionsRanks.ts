import { AVATARS } from '../../config/avatars';
import {
  MEDALLION_IDS,
  MEDALLION_MAX_LEVEL,
  MEDALLION_TOTAL_MAX,
  estimateEndlessCeilingWave,
  medallionEffectValue,
  medallionUpgradeCost,
  type MedallionId,
} from '../../config/medallions';
import { RANKS, getRank, getRankDifficulty } from '../../config/ranks';
import {
  canAffordMedallion,
  getProfileMedallionLevel,
  profileMedallionTotal,
} from '../../core/MedallionProgression';
import { displayNickname } from '../../core/PlayerIdentity';
import { getLeaderboard } from '../../core/PlayerProgression';
import { villageStars } from '../../core/VillageProgression';
import { formatCompactNumber } from '../../core/formatNumber';
import type { Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import { round } from '../../render/StickerArt';
import type { LeaderboardSnapshot, RankLeaderboardSnapshot } from '../../ui/EndlessLeaderboardClient';
import {
  BTN_STYLES,
  PALETTE,
  ScrollRegion,
  drawButton,
  drawProgressBar,
  drawSpriteContain,
  drawText,
  drawWoodPanel,
  formatClock,
  type UiHitManager,
} from './CanvasUI';
import { drawScrollbar } from './MetaArmoryMarket';

export interface LeaderboardUiState {
  tab: 'rank' | 'endless' | 'ladder';
  endlessSnap: LeaderboardSnapshot;
  rankSnap: RankLeaderboardSnapshot;
  loading: boolean;
}

const MEDALLION_COPY: Record<MedallionId, { zh: string; en: string; descZh: string; descEn: string; icon: string }> = {
  med_breakthrough_atk: { zh: '破界炽焰勋章', en: 'Ember Breakthrough', descZh: '觉醒英雄无尽伤害倍率', descEn: 'Awakened Endless DMG mult', icon: 'ui_endless_crest' },
  med_luck_rate: { zh: '幸运四叶草勋章', en: 'Clover Luck', descZh: 'Lv.5 突破觉醒成功率加成', descEn: 'Lv.5 Awakening odds bonus', icon: 'ui_merge_sparkle' },
  med_momentum: { zh: '战意共鸣勋章', en: 'Battle Momentum', descZh: '满战意 (200) 伤害增幅', descEn: 'Max Spirit (200) DMG boost', icon: 'ui_streak_flame' },
  med_boss_resist: { zh: '佛系护体勋章', en: 'Calm Ward', descZh: '首领控场减免 / 概率免疫', descEn: 'Boss debuff resist & shrug', icon: 'ui_victory_shield_wings' },
  med_boss_slayer: { zh: '巨兽克星勋章', en: 'Sovereign Piercer', descZh: '无尽首领伤害 & 护甲穿透', descEn: 'Endless Boss DMG & Armor Pen', icon: 'ui_crossed_blades' },
  med_capy_shield: { zh: '水豚泡泡盾勋章', en: 'Capybara Shield', descZh: '自动抵挡进桶伤害冷却时间', descEn: 'Auto bubble-shield recharge', icon: 'orange' },
};

function formatMedallionValue(id: MedallionId, lv: number): string {
  const v = medallionEffectValue(id, lv);
  switch (id) {
    case 'med_breakthrough_atk':
    case 'med_momentum':
    case 'med_boss_slayer':
      return `×${v >= 100 ? formatCompactNumber(v) : Number(v.toFixed(2))}`;
    case 'med_luck_rate':
    case 'med_boss_resist':
      return `+${Math.round(v * 100)}%`;
    case 'med_capy_shield':
      return lv <= 0 ? '—' : `${v}s`;
  }
}

/**
 * Hub #5: Endless Medallion Hall (无尽勋章殿堂)
 */
export function drawMedallionsModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
): void {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1020, ph = 610;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;

  drawWoodPanel(c, px, py, pw, ph, 24, PALETTE.cream, PALETTE.woodDark);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Header
  drawSpriteContain(c, 'ui_endless_crest', px + 24, py + 14, 48, 48);
  drawText(c, zh ? '无尽勋章殿堂' : 'Endless Medallion Hall', px + 80, py + 30, 24, '#5e2c82', 'left', 900);
  const totalLv = profileMedallionTotal(profile);
  const ceiling = estimateEndlessCeilingWave({ levels: profile.endlessMedallions, awakened: true, momentum: 200 });
  drawText(
    c,
    `✨ ${profile.endlessCrests}   ·   🪙 ${profile.coins}   ·   ${zh ? `总等级 ${totalLv}/${MEDALLION_TOTAL_MAX}  ·  预估无尽上限 ~W${ceiling}` : `Total Lv.${totalLv}/${MEDALLION_TOTAL_MAX} · Est. Ceiling ~W${ceiling}`}`,
    px + 80,
    py + 54,
    13,
    PALETTE.inkSoft,
    'left',
    800,
  );
  drawButton(c, hits, 'modal:close', px + pw - 56, py + 18, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // Explanatory pill
  round(c, px + 26, py + 76, pw - 52, 34, 12, '#efe3fa', '#8450ad', 1.6);
  drawText(
    c,
    zh
      ? '♾️ 勋章仅在第 11 波起无尽模式生效（前 10 波完全公平）。每通关 10 波得 3 星徽，无尽每波持续加码掉落！'
      : '♾️ Medallions activate in Endless Mode (Wave 11+). Wave-10 clears grant 3 Crests + every Endless wave drops more!',
    px + pw / 2,
    py + 94,
    12.5,
    '#522575',
    'center',
    800,
  );

  // 2×3 Grid of 6 Medallions
  const gx = px + 26, gy = py + 122, gw = pw - 52, gh = ph - 148;
  const cols = 2, gap = 14;
  const cw = Math.floor((gw - gap) / cols);
  const ch = Math.floor((gh - gap * 2) / 3);

  MEDALLION_IDS.forEach((medId, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rx = gx + col * (cw + gap);
    const ry = gy + row * (ch + gap);
    const lv = getProfileMedallionLevel(profile, medId);
    const cost = medallionUpgradeCost(lv);
    const afford = canAffordMedallion(profile, medId);
    const info = MEDALLION_COPY[medId];

    round(c, rx, ry, cw, ch, 18, '#fff7e5', afford ? '#8b52bf' : PALETTE.woodLight, afford ? 2.5 : 1.8);
    round(c, rx + 14, ry + 16, 68, 68, 16, '#efe3fa', '#7b48a3', 2);
    if (!drawSpriteContain(c, medId, rx + 18, ry + 20, 60, 60)) {
      drawSpriteContain(c, info.icon, rx + 18, ry + 20, 60, 60);
    }

    drawText(c, zh ? info.zh : info.en, rx + 94, ry + 26, 16.5, PALETTE.ink, 'left', 900);
    drawText(c, `Lv.${lv}/${MEDALLION_MAX_LEVEL}`, rx + cw - 16, ry + 26, 13.5, '#6b3394', 'right', 900);
    drawText(c, zh ? info.descZh : info.descEn, rx + 94, ry + 48, 12, PALETTE.inkSoft, 'left', 700);

    const curVal = formatMedallionValue(medId, lv);
    const nxtVal = lv < MEDALLION_MAX_LEVEL ? formatMedallionValue(medId, lv + 1) : 'MAX';
    drawText(c, `${curVal}  →  ${nxtVal}`, rx + 94, ry + 72, 14, '#2c763d', 'left', 900);

    drawProgressBar(c, rx + 14, ry + ch - 26, cw - 186, 12, lv / MEDALLION_MAX_LEVEL, '#965cc7', 'rgba(72,46,24,0.16)', PALETTE.woodDark);

    if (cost) {
      drawButton(
        c,
        hits,
        `medallion:up:${medId}`,
        rx + cw - 160,
        ry + ch - 52,
        146,
        40,
        `✨${cost.crests} 🪙${cost.coins}`,
        {
          ...(afford ? BTN_STYLES.gold : BTN_STYLES.muted),
          radius: 12,
          fontSize: 12.5,
          disabled: !afford,
        },
      );
    } else {
      round(c, rx + cw - 120, ry + ch - 46, 104, 34, 11, '#f4df9e', PALETTE.goldDark, 1.5);
      drawText(c, 'MAX ★', rx + cw - 68, ry + ch - 29, 13, '#7a450c', 'center', 900);
    }
  });
}

/**
 * Hub #6: Onsen Hall of Fame & 54-Rank Ladder (温泉风云榜：段位榜 / 无尽全球榜 / 54阶总览)
 */
export function drawLeaderboardModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  lb: LeaderboardUiState,
  scroll: ScrollRegion,
): { scrollViewport: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1020, ph = 626;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;

  drawWoodPanel(c, px, py, pw, ph, 24, PALETTE.cream, PALETTE.woodDark);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Header
  drawSpriteContain(c, 'ui_trophy_rank', px + 24, py + 14, 48, 48);
  drawText(c, t('p5.page.leaderboard'), px + 80, py + 30, 24, PALETTE.ink, 'left', 900);
  const myNick = displayNickname(profile, getLanguage());
  const modeLabel = lb.tab === 'rank'
    ? (lb.rankSnap.mode === 'online' ? (zh ? '🌐 全球联网榜' : '🌐 Online Global') : (zh ? '🏡 本地温泉榜（离线回退）' : '🏡 Local Board (Offline)'))
    : lb.tab === 'endless'
      ? (lb.endlessSnap.mode === 'online' ? (zh ? '🌐 无尽全球前100' : '🌐 Global Top 100') : (zh ? '🏡 本地无尽记录' : '🏡 Local Endless'))
      : t('p19.rankLadderTitle');
  drawText(c, `${modeLabel}   ·   ${myNick}`, px + 80, py + 54, 13, PALETTE.inkSoft, 'left', 800);

  // Nickname & Refresh buttons
  drawButton(c, hits, 'lb:rename', px + pw - 294, py + 18, 120, 38, zh ? '✎ 改昵称' : '✎ Rename', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 13.5,
  });
  drawButton(c, hits, 'lb:refresh', px + pw - 164, py + 18, 96, 38, lb.loading ? '…' : (zh ? '🔄 刷新' : '🔄 Sync'), {
    ...BTN_STYLES.teal,
    radius: 12,
    fontSize: 13.5,
  });
  drawButton(c, hits, 'modal:close', px + pw - 56, py + 18, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // 3 Tabs
  const ty = py + 76;
  drawButton(c, hits, 'lb:tab:rank', px + 26, ty, 200, 40, zh ? '🏆 段位风云榜' : '🏆 Rank Board', {
    ...(lb.tab === 'rank' ? BTN_STYLES.gold : BTN_STYLES.cream),
    radius: 13,
    fontSize: 14.5,
  });
  drawButton(c, hits, 'lb:tab:endless', px + 236, ty, 200, 40, zh ? '♾️ 无尽全球榜' : '♾️ Endless Board', {
    ...(lb.tab === 'endless' ? BTN_STYLES.gold : BTN_STYLES.cream),
    radius: 13,
    fontSize: 14.5,
  });
  drawButton(c, hits, 'lb:tab:ladder', px + 446, ty, 220, 40, zh ? '📊 54 阶段位总览' : '📊 All 54 Ranks', {
    ...(lb.tab === 'ladder' ? BTN_STYLES.gold : BTN_STYLES.cream),
    radius: 13,
    fontSize: 14.5,
  });

  // Share Rank Card button
  drawButton(c, hits, 'lb:share', px + pw - 180, ty, 154, 40, zh ? '📤 炫耀战绩' : '📤 Share', {
    ...BTN_STYLES.green,
    radius: 13,
    fontSize: 14,
  });

  const vx = px + 26, vy = ty + 50, vw = pw - 52, vh = ph - 148;
  round(c, vx, vy, vw, vh, 16, '#fff8ea', PALETTE.woodLight, 1.8);

  c.save();
  c.beginPath();
  c.rect(vx + 2, vy + 2, vw - 4, vh - 4);
  c.clip();

  let contentH = 0;

  // ── TAB 1: RANK BOARD (Online Global or Local NPC Fallback) ───────────────
  if (lb.tab === 'rank') {
    const useOnline = lb.rankSnap.mode === 'online' && lb.rankSnap.entries.length > 0;
    const rows = useOnline
      ? lb.rankSnap.entries.map(e => ({
          rank: e.rank,
          name: e.nickname,
          avatar: e.avatarId,
          stars: e.stars,
          sub: `${e.wins}/${e.matches}${e.location ? ` · ${e.location}` : ''}`,
          isMe: Boolean(e.isMe),
        }))
      : getLeaderboard(profile).map((e, idx) => ({
          rank: idx + 1,
          name: e.isPlayer ? myNick : (zh ? e.name['zh-CN'] : e.name.en),
          avatar: e.avatarId,
          stars: e.stars,
          sub: `${e.wins}/${e.matches}`,
          isMe: e.isPlayer,
        }));

    const rh = 58, gap = 8, pad = 12;
    rows.forEach((r, idx) => {
      const ry = vy + pad + idx * (rh + gap) - scroll.offset;
      if (ry + rh < vy - 20 || ry > vy + vh + 20) return;

      round(c, vx + pad, ry, vw - pad * 2, rh, 14, r.isMe ? '#fff0bd' : '#f7ebd1', r.isMe ? '#c26912' : PALETTE.woodLight, r.isMe ? 2.4 : 1.4);
      const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`;
      drawText(c, medal, vx + pad + 32, ry + rh / 2, r.rank <= 3 ? 22 : 16, PALETTE.ink, 'center', 900);
      drawSpriteContain(c, `avatar_${r.avatar}`, vx + pad + 62, ry + 9, 40, 40);
      drawText(c, r.name + (r.isMe ? (zh ? '（我）' : ' (You)') : ''), vx + pad + 114, ry + 20, 15, PALETTE.ink, 'left', 900);
      drawText(c, `${t(`rank.${getRank(r.stars).index}`)}  ·  ${zh ? '胜/局' : 'W/M'} ${r.sub}`, vx + pad + 114, ry + 41, 12, PALETTE.inkSoft, 'left', 700);
      drawText(c, `★ ${r.stars}`, vx + vw - pad - 24, ry + rh / 2, 18, '#b56c12', 'right', 900);
    });
    contentH = pad * 2 + rows.length * (rh + gap);
  }

  // ── TAB 2: ENDLESS GLOBAL BOARD ───────────────────────────────────────────
  else if (lb.tab === 'endless') {
    const entries = lb.endlessSnap.entries;
    if (entries.length === 0) {
      const bestWave = profile.bestEndlessWave ?? 0;
      drawText(
        c,
        bestWave >= 11
          ? (zh ? `你当前的无尽纪录：♾️ 第 ${bestWave} 波（联网同步后展示全球前 100 名）` : `Your Endless Record: ♾️ Wave ${bestWave} (Connect online for Global Top 100)`)
          : (zh ? '通关第 10 波并开启无尽模式（第 11 波+）即可冲击全球无尽榜！' : 'Clear Wave 10 and enter Endless (Wave 11+) to join the Global Board!'),
        vx + vw / 2,
        vy + vh / 2,
        16,
        PALETTE.inkSoft,
        'center',
        800,
      );
      contentH = vh;
    } else {
      const rh = 60, gap = 8, pad = 12;
      entries.forEach((e, idx) => {
        const ry = vy + pad + idx * (rh + gap) - scroll.offset;
        if (ry + rh < vy - 20 || ry > vy + vh + 20) return;

        round(c, vx + pad, ry, vw - pad * 2, rh, 14, e.isMe ? '#efe0ff' : '#f7ebd1', e.isMe ? '#7b3fa0' : PALETTE.woodLight, e.isMe ? 2.4 : 1.4);
        const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`;
        drawText(c, medal, vx + pad + 32, ry + rh / 2, e.rank <= 3 ? 22 : 16, PALETTE.ink, 'center', 900);
        drawSpriteContain(c, `avatar_${e.avatarId}`, vx + pad + 62, ry + 10, 40, 40);
        drawText(c, e.nickname + (e.isMe ? (zh ? '（我）' : ' (You)') : ''), vx + pad + 114, ry + 21, 15, PALETTE.ink, 'left', 900);
        drawText(
          c,
          `MVP ${t(`hero.${e.mvpKind}`)}${e.mvpAwakened ? '★' : ''} · ${formatClock(e.elapsedSeconds)} · ${zh ? '勋章' : 'Med'} ${e.medallionTotal}`,
          vx + pad + 114,
          ry + 43,
          12,
          PALETTE.inkSoft,
          'left',
          700,
        );
        drawText(c, `♾️ W${e.bestWave}`, vx + vw - pad - 24, ry + rh / 2, 19, '#6a2e8c', 'right', 900);
      });
      contentH = pad * 2 + entries.length * (rh + gap);
    }
  }

  // ── TAB 3: FULL 54-TIER RANK LADDER (Zero-Penalty Note!) ──────────────────
  else {
    const myRankIdx = getRank(profile.stars).index;
    const pad = 12;
    // Fairness banner at top of scroll content
    const noteY = vy + pad - scroll.offset;
    round(c, vx + pad, noteY, vw - pad * 2, 54, 14, '#e5f5dd', '#3c8532', 1.8);
    drawText(
      c,
      zh
        ? '🛡️ 升级零惩罚：全段位怪物血量 / 移速 / 首领冷却恒定 1×！升段只涨金币、碎片倍率与新地图解锁！'
        : '🛡️ Zero Rank Penalty: Enemy HP, speed & boss cooldown stay 1× across all 54 ranks! Higher ranks boost rewards & unlock maps!',
      vx + vw / 2,
      noteY + 28,
      13,
      '#24591d',
      'center',
      800,
    );

    const rh = 46, gap = 6;
    const startY = noteY + 64;
    RANKS.forEach((rk, i) => {
      const ry = startY + i * (rh + gap);
      if (ry + rh < vy - 20 || ry > vy + vh + 20) return;

      const isCur = i === myRankIdx;
      const mapMilestone = i === 0 ? t('map.sunny_backyard')
        : i === 10 ? `🗺️ ${t('map.sakura_onsen')}`
          : i === 20 ? `🗺️ ${t('map.midnight_kitchen')}`
            : i === 30 ? `🗺️ ${t('map.cat_tower_maze')}`
              : '';
      round(c, vx + pad, ry, vw - pad * 2, rh, 12, isCur ? '#ffe9a6' : '#f7ebd1', isCur ? '#c26912' : PALETTE.woodLight, isCur ? 2.4 : 1.2);
      drawText(c, `${rk.minStars}★`, vx + pad + 42, ry + rh / 2, 14, '#8c4b10', 'center', 900);
      drawText(c, `${t(`rank.${i}`)}${isCur ? (zh ? '  👈 当前' : '  👈 You') : ''}`, vx + pad + 90, ry + rh / 2, 14.5, PALETTE.ink, 'left', 900);
      const extra = getRankDifficulty(i).extraCount;
      const rewardLine = `🪙+${rk.winCoins}  ·  ${zh ? '碎片' : 'Drop'} ×${rk.fragmentMultiplier.toFixed(1)}${extra ? `  ·  W1-10 +${extra}` : ''}${mapMilestone ? `  ·  ${mapMilestone}` : ''}`;
      drawText(c, rewardLine, vx + vw - pad - 18, ry + rh / 2, 12.5, PALETTE.inkSoft, 'right', 800);
    });
    contentH = pad * 2 + 64 + RANKS.length * (rh + gap);
  }

  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

/**
 * Hub #7: Keeper Passport & 16-Avatar Wax Seal Wall (守护者名片)
 */
export function drawProfileModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  scroll: ScrollRegion,
): { scrollViewport: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 940, ph = 610;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;

  drawWoodPanel(c, px, py, pw, ph, 24, PALETTE.cream, PALETTE.woodDark);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Top Identity Card
  const rank = getRank(profile.stars);
  const nick = displayNickname(profile, getLanguage());
  const winRate = profile.matches > 0 ? `${Math.round((profile.wins / profile.matches) * 100)}%` : '—';

  round(c, px + 26, py + 22, pw - 94, 108, 18, '#f4e2bd', PALETTE.woodMid, 2);
  round(c, px + 42, py + 36, 80, 80, 40, '#fff7e5', PALETTE.woodDark, 2.5);
  if (!drawSpriteContain(c, `avatar_${profile.avatarId}`, px + 48, py + 42, 68, 68)) {
    drawSpriteContain(c, 'avatar_capybara', px + 48, py + 42, 68, 68);
  }
  drawText(c, nick, px + 138, py + 54, 22, PALETTE.ink, 'left', 900);
  drawText(
    c,
    `${t(`rank.${rank.index}`)} (★${profile.stars})  ·  ${zh ? '胜率' : 'Win%'} ${winRate} (${profile.wins}/${profile.matches})  ·  ${zh ? '最高连胜' : 'Streak'} ${profile.bestWinStreak}`,
    px + 138,
    py + 82,
    13.5,
    PALETTE.inkSoft,
    'left',
    800,
  );
  drawText(
    c,
    `${zh ? '英雄' : 'Heroes'} ${profile.mergedHeroes.length}/12  ·  ${zh ? '神兵' : 'Weapons'} ${profile.unlockedWeapons.length}/36  ·  ${zh ? '汤底' : 'Broths'} ${profile.unlockedBroths.length}/14  ·  ${zh ? '山庄' : 'Village'} ${villageStars(profile)}/15${profile.bestEndlessWave ? `  ·  ♾️W${profile.bestEndlessWave}` : ''}`,
    px + 138,
    py + 106,
    12.5,
    PALETTE.tealDark,
    'left',
    800,
  );

  drawButton(c, hits, 'profile:rename', px + pw - 224, py + 34, 140, 38, zh ? '✎ 修改昵称' : '✎ Rename', {
    ...BTN_STYLES.gold,
    radius: 12,
    fontSize: 13.5,
  });
  drawButton(c, hits, 'profile:share', px + pw - 224, py + 80, 140, 38, zh ? '📤 分享名片' : '📤 Share', {
    ...BTN_STYLES.green,
    radius: 12,
    fontSize: 13.5,
  });
  drawButton(c, hits, 'modal:close', px + pw - 56, py + 22, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // 16-Avatar Wall
  drawText(c, `💮 ${t('p5.avatarWall')} (${profile.unlockedAvatars.length}/${Object.keys(AVATARS).length})`, px + 28, py + 150, 16, PALETTE.ink, 'left', 900);

  const vx = px + 26, vy = py + 168, vw = pw - 52, vh = ph - 192;
  round(c, vx, vy, vw, vh, 16, '#fff8ea', PALETTE.woodLight, 1.8);

  const avatars = Object.values(AVATARS);
  c.save();
  c.beginPath();
  c.rect(vx + 2, vy + 2, vw - 4, vh - 4);
  c.clip();

  const cols = 4, gap = 12, pad = 14;
  const cw = Math.floor((vw - pad * 2 - gap * (cols - 1)) / cols);
  const ch = 122;

  avatars.forEach((av, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const rx = vx + pad + col * (cw + gap);
    const ry = vy + pad + row * (ch + gap) - scroll.offset;
    if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

    const unlocked = profile.unlockedAvatars.includes(av.id);
    const active = profile.avatarId === av.id;

    if (ry + ch > vy && ry < vy + vh) {
      hits.add({ id: `profile:avatar:${av.id}`, x: rx, y: Math.max(vy, ry), w: cw, h: Math.min(ry + ch, vy + vh) - Math.max(vy, ry), data: { id: av.id, unlocked, desc: zh ? av.description['zh-CN'] : av.description.en } });
    }

    round(c, rx, ry, cw, ch, 14, active ? '#ffe8a3' : unlocked ? '#f7ebd1' : '#ebe4d6', active ? '#c26912' : unlocked ? PALETTE.woodMid : '#b8ad9c', active ? 2.8 : 1.6);
    if (!drawSpriteContain(c, `avatar_${av.id}`, rx + cw / 2 - 30, ry + 10, 60, 60, unlocked ? 1 : 0.38)) {
      drawSpriteContain(c, 'avatar_capybara', rx + cw / 2 - 30, ry + 10, 60, 60, 0.35);
    }
    if (!unlocked) drawText(c, '🔒', rx + cw - 18, ry + 18, 15, PALETTE.inkSoft, 'center', 700);
    drawText(c, zh ? av.name['zh-CN'] : av.name.en, rx + cw / 2, ry + 84, 13.5, unlocked ? PALETTE.ink : PALETTE.muted, 'center', 900);
    drawText(
      c,
      active ? (zh ? '✓ 使用中' : '✓ Equipped') : unlocked ? (zh ? '点击更换' : 'Tap to use') : (zh ? av.description['zh-CN'] : av.description.en).slice(0, 12),
      rx + cw / 2,
      ry + 105,
      10.5,
      active ? '#8a450b' : PALETTE.inkSoft,
      'center',
      700,
    );
  });

  const rows = Math.ceil(avatars.length / cols);
  const contentH = pad * 2 + rows * (ch + gap);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}
