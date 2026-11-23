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
  drawHinokiBoard,
  drawHoneyOakTab,
  drawIconLabel,
  drawIvorySlab,
  drawMatchaSignboard,
  drawProgressBar,
  drawSpriteContain,
  drawText,
  drawYuzuCloseButton,
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
  med_luck_rate: { zh: '幸运四叶草勋章', en: 'Clover Luck', descZh: 'Lv.5 突破觉醒成功率', descEn: 'Lv.5 Awakening odds bonus', icon: 'ui_merge_sparkle' },
  med_momentum: { zh: '战意共鸣勋章', en: 'Battle Momentum', descZh: '满战意 (200) 伤害增幅', descEn: 'Max Spirit (200) DMG boost', icon: 'ui_streak_flame' },
  med_boss_resist: { zh: '佛系护体勋章', en: 'Calm Ward', descZh: '首领控场减免 / 免疫', descEn: 'Boss debuff resist & shrug', icon: 'ui_victory_shield_wings' },
  med_boss_slayer: { zh: '巨兽克星勋章', en: 'Sovereign Piercer', descZh: '无尽首领伤害 & 破甲', descEn: 'Endless Boss DMG & Pen', icon: 'ui_crossed_blades' },
  med_capy_shield: { zh: '水豚泡泡盾勋章', en: 'Capybara Shield', descZh: '自动抵挡伤害冷却时间', descEn: 'Bubble-shield recharge', icon: 'orange' },
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
 * 1:1 P18 Carved Hinoki-Wood Endless Medallion Hall (无尽勋章殿堂)
 */
export function drawMedallionsModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
): void {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1080, ph = 548;
  const px = (1280 - pw) / 2, py = 142;

  const totalLv = profileMedallionTotal(profile);
  const ceiling = estimateEndlessCeilingWave({ levels: profile.endlessMedallions, awakened: true, momentum: 200 });

  drawMatchaSignboard(
    c,
    640,
    18,
    zh ? '无尽勋章殿堂' : 'Endless Medallion Hall',
    zh
      ? `星徽 ${profile.endlessCrests} · 金币 ${profile.coins} · 总等级 ${totalLv}/${MEDALLION_TOTAL_MAX} · 预估上限 ~W${ceiling}`
      : `Crests ${profile.endlessCrests} · Coins ${profile.coins} · Total Lv.${totalLv}/${MEDALLION_TOTAL_MAX} · ~W${ceiling}`,
    360,
  );
  drawYuzuCloseButton(c, hits, 'modal:close', px + pw - 22, 52);
  drawSpriteContain(c, 'ui_medallion_peek_capy', px + 14, py - 84, 102, 102);

  drawHinokiBoard(c, px, py, pw, ph, 24);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // 2×3 Grid of 6 Medallions (big mobile-friendly fonts!)
  const gx = px + 22, gy = py + 18, gw = pw - 44, gh = ph - 36;
  const cols = 2, gap = 14;
  const cw = Math.floor((gw - gap) / cols);
  const ch = Math.floor((gh - gap * 2) / 3);

  MEDALLION_IDS.forEach((medId, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const rx = gx + col * (cw + gap);
    const ry = gy + row * (ch + gap);
    const lv = getProfileMedallionLevel(profile, medId);
    const cost = medallionUpgradeCost(lv);
    const afford = canAffordMedallion(profile, medId);
    const info = MEDALLION_COPY[medId];

    drawIvorySlab(c, rx, ry, cw, ch, 18, '#fffdf7', '#f5e4c2', afford ? '#8b52bf' : '#7a5230', afford ? 3 : 2.2);
    round(c, rx + 14, ry + 18, 82, 82, 18, '#efe3fa', '#7b48a3', 2.4);
    if (!drawSpriteContain(c, medId, rx + 18, ry + 22, 74, 74)) {
      drawSpriteContain(c, info.icon, rx + 18, ry + 22, 74, 74);
    }

    drawText(c, zh ? info.zh : info.en, rx + 108, ry + 30, 20, PALETTE.ink, 'left', 900);
    drawText(c, `Lv.${lv}/${MEDALLION_MAX_LEVEL}`, rx + cw - 16, ry + 30, 17, '#6b3394', 'right', 900);
    drawText(c, zh ? info.descZh : info.descEn, rx + 108, ry + 58, 15.5, PALETTE.inkSoft, 'left', 700);

    const curVal = formatMedallionValue(medId, lv);
    const nxtVal = lv < MEDALLION_MAX_LEVEL ? formatMedallionValue(medId, lv + 1) : 'MAX';
    drawText(c, `${curVal}  →  ${nxtVal}`, rx + 108, ry + 86, 18, '#2c763d', 'left', 900);

    drawProgressBar(c, rx + 14, ry + ch - 28, cw - 208, 14, lv / MEDALLION_MAX_LEVEL, '#965cc7', 'rgba(72,46,24,0.18)', '#5c3b1e');

    if (cost) {
      drawButton(
        c,
        hits,
        `medallion:up:${medId}`,
        rx + cw - 182,
        ry + ch - 56,
        168,
        46,
        `✨${cost.crests}  🪙${cost.coins}`,
        {
          ...(afford ? BTN_STYLES.gold : BTN_STYLES.muted),
          radius: 13,
          fontSize: 15.5,
          disabled: !afford,
        },
      );
    } else {
      round(c, rx + cw - 126, ry + ch - 50, 112, 38, 12, '#f4df9e', PALETTE.goldDark, 1.8);
      drawText(c, 'MAX ★', rx + cw - 70, ry + ch - 31, 16, '#7a450c', 'center', 900);
    }
  });
}

/**
 * 1:1 P18 Carved Hinoki-Wood Onsen Hall of Fame (温泉风云榜：段位榜 / 无尽榜 / 54阶总览)
 */
export function drawLeaderboardModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  lb: LeaderboardUiState,
  scroll: ScrollRegion,
): { scrollViewport: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1080, ph = 532;
  const px = (1280 - pw) / 2, py = 158;
  const myNick = displayNickname(profile, getLanguage());

  const subText = lb.tab === 'rank'
    ? (lb.rankSnap.mode === 'online' ? (zh ? `全球联网榜 · ${myNick}` : `Online Global · ${myNick}`) : (zh ? `本地温泉榜 · ${myNick}` : `Local Board · ${myNick}`))
    : lb.tab === 'endless'
      ? (lb.endlessSnap.mode === 'online' ? (zh ? `无尽全球前100 · ${myNick}` : `Global Top 100 · ${myNick}`) : (zh ? `本地无尽记录 · ${myNick}` : `Local Endless · ${myNick}`))
      : t('p19.rankLadderTitle');

  drawMatchaSignboard(c, 640, 18, t('p5.page.leaderboard'), subText, 320);
  drawYuzuCloseButton(c, hits, 'modal:close', px + pw - 22, 52);

  // Top-right Rename & Sync pills
  drawButton(c, hits, 'lb:rename', px + pw - 294, 30, 118, 42, zh ? '改昵称' : 'Rename', {
    ...BTN_STYLES.cream,
    radius: 13,
    fontSize: 16,
  });
  drawButton(c, hits, 'lb:refresh', px + pw - 166, 30, 102, 42, lb.loading ? '…' : (zh ? '刷新' : 'Sync'), {
    ...BTN_STYLES.teal,
    radius: 13,
    fontSize: 16,
  });

  // 3 Honey-Oak Tabs
  const tabY = py - 44;
  drawHoneyOakTab(c, hits, 'lb:tab:rank', px + 116, tabY, 204, 48, zh ? '段位风云榜' : 'Rank Board', lb.tab === 'rank');
  drawHoneyOakTab(c, hits, 'lb:tab:endless', px + 330, tabY, 204, 48, zh ? '无尽全球榜' : 'Endless Top', lb.tab === 'endless');
  drawHoneyOakTab(c, hits, 'lb:tab:ladder', px + 544, tabY, 224, 48, zh ? '54 阶段位总览' : 'All 54 Ranks', lb.tab === 'ladder');

  drawButton(c, hits, 'lb:share', px + pw - 186, tabY + 2, 166, 40, zh ? '📤 炫耀战绩' : '📤 Share', {
    ...BTN_STYLES.green,
    radius: 13,
    fontSize: 16,
  });

  // Peeking Rank Capybara
  drawSpriteContain(c, 'ui_rank_peek_capy', px + 10, tabY - 38, 102, 102);

  drawHinokiBoard(c, px, py, pw, ph, 24);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  const vx = px + 20, vy = py + 16, vw = pw - 40, vh = ph - 32;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  let contentH = 0;

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

    const rh = 72, gap = 10, pad = 4;
    rows.forEach((r, idx) => {
      const ry = vy + pad + idx * (rh + gap) - scroll.offset;
      if (ry + rh < vy - 20 || ry > vy + vh + 20) return;

      drawIvorySlab(c, vx + pad, ry, vw - pad * 2, rh, 16, r.isMe ? '#fff4c4' : '#fffdf7', r.isMe ? '#f8da7a' : '#f5e4c2', r.isMe ? '#c26912' : '#7a5230', r.isMe ? 3 : 2);
      const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`;
      drawText(c, medal, vx + pad + 38, ry + rh / 2, r.rank <= 3 ? 28 : 20, PALETTE.ink, 'center', 900);
      drawSpriteContain(c, `avatar_${r.avatar}`, vx + pad + 72, ry + 11, 50, 50);
      drawText(c, r.name + (r.isMe ? (zh ? '（我）' : ' (You)') : ''), vx + pad + 136, ry + 24, 19, PALETTE.ink, 'left', 900);
      drawText(c, `${t(`rank.${getRank(r.stars).index}`)}  ·  ${zh ? '胜/局' : 'W/M'} ${r.sub}`, vx + pad + 136, ry + 51, 15, PALETTE.inkSoft, 'left', 700);
      drawIconLabel(c, 'ui_star_rank', String(r.stars), vx + vw - pad - 110, ry + rh / 2, 26, 22, '#9e5a0c');
    });
    contentH = pad * 2 + rows.length * (rh + gap);
  } else if (lb.tab === 'endless') {
    const entries = lb.endlessSnap.entries;
    if (entries.length === 0) {
      drawIvorySlab(c, vx + 4, vy + 4, vw - 8, vh - 8, 16);
      const bestWave = profile.bestEndlessWave ?? 0;
      drawText(
        c,
        bestWave >= 11
          ? (zh ? `你当前的无尽纪录：第 ${bestWave} 波（联网同步后展示全球前 100 名）` : `Your Endless Record: Wave ${bestWave} (Connect online for Global Top 100)`)
          : (zh ? '通关第 10 波并开启无尽模式（第 11 波+）即可冲击全球无尽榜！' : 'Clear Wave 10 and enter Endless (Wave 11+) to join the Global Board!'),
        vx + vw / 2,
        vy + vh / 2,
        19,
        PALETTE.inkSoft,
        'center',
        800,
      );
      contentH = vh;
    } else {
      const rh = 74, gap = 10, pad = 4;
      entries.forEach((e, idx) => {
        const ry = vy + pad + idx * (rh + gap) - scroll.offset;
        if (ry + rh < vy - 20 || ry > vy + vh + 20) return;

        drawIvorySlab(c, vx + pad, ry, vw - pad * 2, rh, 16, e.isMe ? '#f4e6ff' : '#fffdf7', e.isMe ? '#e3c7ff' : '#f5e4c2', e.isMe ? '#7b3fa0' : '#7a5230', e.isMe ? 3 : 2);
        const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`;
        drawText(c, medal, vx + pad + 38, ry + rh / 2, e.rank <= 3 ? 28 : 20, PALETTE.ink, 'center', 900);
        drawSpriteContain(c, `avatar_${e.avatarId}`, vx + pad + 72, ry + 12, 50, 50);
        drawText(c, e.nickname + (e.isMe ? (zh ? '（我）' : ' (You)') : ''), vx + pad + 136, ry + 24, 19, PALETTE.ink, 'left', 900);
        drawText(
          c,
          `MVP ${t(`hero.${e.mvpKind}`)}${e.mvpAwakened ? '★' : ''} · ${formatClock(e.elapsedSeconds)} · ${zh ? '勋章' : 'Med'} ${e.medallionTotal}`,
          vx + pad + 136,
          ry + 52,
          15,
          PALETTE.inkSoft,
          'left',
          700,
        );
        drawText(c, `W${e.bestWave}`, vx + vw - pad - 24, ry + rh / 2, 24, '#6a2e8c', 'right', 900);
      });
      contentH = pad * 2 + entries.length * (rh + gap);
    }
  } else {
    const myRankIdx = getRank(profile.stars).index;
    const pad = 4;
    const noteY = vy + pad - scroll.offset;
    drawIvorySlab(c, vx + pad, noteY, vw - pad * 2, 62, 15, '#e8f9df', '#d4f2c4', '#3c8532', 2.2);
    drawText(
      c,
      zh
        ? '升段零惩罚：全 54 阶怪物血量 / 移速 / 首领冷却恒定 1×！升段只涨金币、碎片倍率与新地图解锁！'
        : 'Zero Rank Penalty: Enemy HP, speed & boss cooldown stay 1× across all 54 ranks! Climbing only boosts rewards!',
      vx + vw / 2,
      noteY + 32,
      16.5,
      '#24591d',
      'center',
      900,
    );

    const rh = 56, gap = 8;
    const startY = noteY + 72;
    RANKS.forEach((rk, i) => {
      const ry = startY + i * (rh + gap);
      if (ry + rh < vy - 20 || ry > vy + vh + 20) return;

      const isCur = i === myRankIdx;
      const mapMilestone = i === 0 ? t('map.sunny_backyard')
        : i === 10 ? t('map.sakura_onsen')
          : i === 20 ? t('map.midnight_kitchen')
            : i === 30 ? t('map.cat_tower_maze')
              : '';
      const extra = getRankDifficulty(i).extraCount;
      drawIvorySlab(c, vx + pad, ry, vw - pad * 2, rh, 14, isCur ? '#fff0a8' : '#fffdf7', isCur ? '#f7d56a' : '#f5e4c2', isCur ? '#c26912' : '#7a5230', isCur ? 2.8 : 1.6);
      drawText(c, `${rk.minStars}★`, vx + pad + 48, ry + rh / 2, 17, '#8c4b10', 'center', 900);
      drawText(c, `${t(`rank.${i}`)}${isCur ? (zh ? '  👈 当前' : '  👈 You') : ''}`, vx + pad + 104, ry + rh / 2, 18, PALETTE.ink, 'left', 900);
      const rewardLine = `+${rk.winCoins}金币 · 碎片×${rk.fragmentMultiplier.toFixed(1)}${extra ? ` · +${extra}怪` : ''}${mapMilestone ? ` · ${mapMilestone}` : ''}`;
      drawText(c, rewardLine, vx + vw - pad - 18, ry + rh / 2, 15.5, PALETTE.inkSoft, 'right', 800);
    });
    contentH = pad * 2 + 72 + RANKS.length * (rh + gap);
  }

  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

/**
 * 1:1 P18 Carved Hinoki-Wood Keeper Passport & 16-Avatar Wax Seal Wall (守护者名片)
 */
export function drawProfileModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  scroll: ScrollRegion,
): { scrollViewport: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1040, ph = 548;
  const px = (1280 - pw) / 2, py = 142;

  drawMatchaSignboard(c, 640, 18, t('p5.page.profile'), t('p5.passport'), 310);
  drawYuzuCloseButton(c, hits, 'modal:close', px + pw - 22, 52);
  drawSpriteContain(c, 'ui_profile_peek_capy', px + 14, py - 84, 102, 102);

  drawHinokiBoard(c, px, py, pw, ph, 24);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Top Identity Slab
  const rank = getRank(profile.stars);
  const nick = displayNickname(profile, getLanguage());
  const winRate = profile.matches > 0 ? `${Math.round((profile.wins / profile.matches) * 100)}%` : '—';

  drawIvorySlab(c, px + 22, py + 16, pw - 44, 118, 18, '#fffdf7', '#f4e2bd', '#5c3b1e', 2.4);
  round(c, px + 38, py + 30, 90, 90, 45, '#fffdf7', '#5c3b1e', 3);
  if (!drawSpriteContain(c, `avatar_${profile.avatarId}`, px + 44, py + 36, 78, 78)) {
    drawSpriteContain(c, 'avatar_capybara', px + 44, py + 36, 78, 78);
  }
  drawText(c, nick, px + 144, py + 48, 25, PALETTE.ink, 'left', 900);
  drawText(
    c,
    `${t(`rank.${rank.index}`)} (★${profile.stars})  ·  ${zh ? '胜率' : 'Win%'} ${winRate} (${profile.wins}/${profile.matches})  ·  ${zh ? '最高连胜' : 'Streak'} ${profile.bestWinStreak}`,
    px + 144,
    py + 80,
    16,
    PALETTE.inkSoft,
    'left',
    800,
  );
  drawText(
    c,
    `${zh ? '英雄' : 'Heroes'} ${profile.mergedHeroes.length}/12 · ${zh ? '神兵' : 'Weapons'} ${profile.unlockedWeapons.length}/36 · ${zh ? '汤底' : 'Broths'} ${profile.unlockedBroths.length}/14 · ${zh ? '山庄' : 'Village'} ${villageStars(profile)}/15`,
    px + 144,
    py + 108,
    15,
    PALETTE.tealDark,
    'left',
    800,
  );

  drawButton(c, hits, 'profile:rename', px + pw - 196, py + 26, 156, 44, zh ? '✎ 修改昵称' : '✎ Rename', {
    ...BTN_STYLES.gold,
    radius: 13,
    fontSize: 16,
  });
  drawButton(c, hits, 'profile:share', px + pw - 196, py + 78, 156, 44, zh ? '📤 分享名片' : '📤 Share', {
    ...BTN_STYLES.green,
    radius: 13,
    fontSize: 16,
  });

  // 16-Avatar Wax Seal Wall
  const vx = px + 22, vy = py + 148, vw = pw - 44, vh = ph - 166;
  const avatars = Object.values(AVATARS);

  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const cols = 4, gap = 12, pad = 4;
  const cw = Math.floor((vw - pad * 2 - gap * (cols - 1)) / cols);
  const ch = 144;

  avatars.forEach((av, idx) => {
    const col = idx % cols, row = Math.floor(idx / cols);
    const rx = vx + pad + col * (cw + gap);
    const ry = vy + pad + row * (ch + gap) - scroll.offset;
    if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

    const unlocked = profile.unlockedAvatars.includes(av.id);
    const active = profile.avatarId === av.id;

    if (ry + ch > vy && ry < vy + vh) {
      hits.add({ id: `profile:avatar:${av.id}`, x: rx, y: Math.max(vy, ry), w: cw, h: Math.min(ry + ch, vy + vh) - Math.max(vy, ry), data: { id: av.id, unlocked, desc: zh ? av.description['zh-CN'] : av.description.en } });
    }

    drawIvorySlab(
      c,
      rx,
      ry,
      cw,
      ch,
      16,
      active ? '#fff0ad' : unlocked ? '#fffdf7' : '#ebe4d6',
      active ? '#f7d56a' : unlocked ? '#f4e2bc' : '#ddd3c0',
      active ? '#c26912' : unlocked ? '#7a5230' : '#a39582',
      active ? 3 : 2,
    );
    if (!drawSpriteContain(c, `avatar_${av.id}`, rx + cw / 2 - 36, ry + 10, 72, 72, unlocked ? 1 : 0.38)) {
      drawSpriteContain(c, 'avatar_capybara', rx + cw / 2 - 36, ry + 10, 72, 72, 0.35);
    }
    if (!unlocked) drawSpriteContain(c, 'ui_lock_closed', rx + cw - 34, ry + 10, 24, 24);
    drawText(c, zh ? av.name['zh-CN'] : av.name.en, rx + cw / 2, ry + 98, 16.5, unlocked ? PALETTE.ink : PALETTE.muted, 'center', 900);
    drawText(
      c,
      active ? (zh ? '✓ 使用中' : '✓ Active') : unlocked ? (zh ? '点击更换' : 'Tap to use') : (zh ? av.description['zh-CN'] : av.description.en).slice(0, 11),
      rx + cw / 2,
      ry + 123,
      13.5,
      active ? '#8a450b' : PALETTE.inkSoft,
      'center',
      800,
    );
  });

  const contentH = pad * 2 + Math.ceil(avatars.length / cols) * (ch + gap);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}
