import { getRank } from '../config/ranks';
import { profileMedallionTotal } from '../core/MedallionProgression';
import type { Profile } from '../core/types';
import { t, type Language } from '../i18n/i18n';

export const FRIEND_CLOUD_KEYS = {
  rank: 'capy_rank_stars',
  endless: 'capy_endless_wave',
} as const;

export interface FriendCloudEntry {
  key: string;
  value: string;
}

/**
 * Builds official WeChat `wx.setUserCloudStorage` KVDataList payloads for the free
 * Open Data Context Friend Leaderboards (Rank Stars + Endless Best Wave).
 */
export function buildFriendCloudPayload(
  profile: Profile,
  lang: Language = 'zh-CN',
  nowSec = Math.floor(Date.now() / 1000),
): FriendCloudEntry[] {
  const entries: FriendCloudEntry[] = [];
  const updateTime = Number.isFinite(nowSec) && nowSec > 0 ? Math.trunc(nowSec) : Math.floor(Date.now() / 1000);

  // 1. Rank Stars board (skip when Developer Mode tainted rank stars)
  if (!profile.rankTainted && ((profile.matches ?? 0) >= 1 || (profile.stars ?? 0) >= 1)) {
    const stars = Math.max(0, Math.trunc(profile.stars ?? 0));
    const rank = getRank(stars);
    entries.push({
      key: FRIEND_CLOUD_KEYS.rank,
      value: JSON.stringify({
        wxgame: { score: stars, update_time: updateTime },
        stars,
        highestStars: Math.max(stars, Math.trunc(profile.highestStars ?? 0)),
        rankIndex: rank.index,
        rankName: rank.name[lang] ?? t(`rank.${rank.index}`),
        wins: Math.max(0, Math.trunc(profile.wins ?? 0)),
        matches: Math.max(0, Math.trunc(profile.matches ?? 0)),
      }),
    });
  }

  // 2. Endless Best Wave board (Wave 11+)
  const bestWave = Math.max(0, Math.trunc(profile.bestEndlessWave ?? 0));
  if (bestWave >= 11) {
    entries.push({
      key: FRIEND_CLOUD_KEYS.endless,
      value: JSON.stringify({
        wxgame: { score: bestWave, update_time: updateTime },
        bestWave,
        elapsed: Math.max(0, Math.round(profile.bestEndlessTime ?? 0)),
        mvpKind: profile.bestEndlessMvp ?? 'kungfu_po',
        medallionTotal: profileMedallionTotal(profile),
      }),
    });
  }

  return entries;
}
