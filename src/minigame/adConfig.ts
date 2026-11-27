import { getRank } from '../config/ranks';
import type { Profile } from '../core/types';
import { getLanguage, t } from '../i18n/i18n';
import type { PlatformKind, ShareOptions } from '../platform/types';

export type AdPlacement =
  | 'revive'
  | 'double_settlement'
  | 'free_gacha'
  | 'free_shop_refresh'
  | 'double_harvest'
  | 'stamina_refill'
  | 'free_basket'
  | 'speed3x_trial';

/** Daily caps per rewarded-video placement (omitted = unlimited per day, e.g. 1/battle revive or stamina refill). */
export const AD_DAILY_LIMITS: Partial<Record<AdPlacement, number>> = {
  double_settlement: 3,
  free_gacha: 3,
  free_basket: 2,
  speed3x_trial: 3,
  double_harvest: 1,
};

/**
 * Rewarded Video Ad Unit IDs per platform (`wx` / `bl`).
 * Leave empty until Traffic Master (流量主 / 500 UV) is approved; UI hides ad buttons gracefully when empty.
 * Supply either a single shared `VITE_WX_AD_DEFAULT` or per-placement `VITE_WX_AD_*` IDs (or paste directly here).
 */
const env = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {});
const wxDefault = env.VITE_WX_AD_DEFAULT ?? '';
const blDefault = env.VITE_BL_AD_DEFAULT ?? '';

const AD_UNITS: Record<Exclude<PlatformKind, 'web'>, Record<AdPlacement, string>> = {
  wx: {
    revive: env.VITE_WX_AD_REVIVE ?? wxDefault,
    double_settlement: env.VITE_WX_AD_DOUBLE_COINS ?? wxDefault,
    free_gacha: env.VITE_WX_AD_FREE_GACHA ?? wxDefault,
    free_shop_refresh: env.VITE_WX_AD_SHOP_REFRESH ?? wxDefault,
    double_harvest: env.VITE_WX_AD_DOUBLE_HARVEST ?? wxDefault,
    stamina_refill: env.VITE_WX_AD_STAMINA_REFILL ?? wxDefault,
    free_basket: env.VITE_WX_AD_FREE_BASKET ?? wxDefault,
    speed3x_trial: env.VITE_WX_AD_SPEED3X_TRIAL ?? wxDefault,
  },
  bl: {
    revive: env.VITE_BL_AD_REVIVE ?? blDefault,
    double_settlement: env.VITE_BL_AD_DOUBLE_COINS ?? blDefault,
    free_gacha: env.VITE_BL_AD_FREE_GACHA ?? blDefault,
    free_shop_refresh: env.VITE_BL_AD_SHOP_REFRESH ?? blDefault,
    double_harvest: env.VITE_BL_AD_DOUBLE_HARVEST ?? blDefault,
    stamina_refill: env.VITE_BL_AD_STAMINA_REFILL ?? blDefault,
    free_basket: env.VITE_BL_AD_FREE_BASKET ?? blDefault,
    speed3x_trial: env.VITE_BL_AD_SPEED3X_TRIAL ?? blDefault,
  },
};

export function getAdUnitId(kind: PlatformKind, placement: AdPlacement): string | undefined {
  if (kind === 'web') return undefined;
  const id = AD_UNITS[kind]?.[placement]?.trim();
  return id || undefined;
}

export function isAdPlacementAvailable(kind: PlatformKind, placement: AdPlacement): boolean {
  return Boolean(getAdUnitId(kind, placement));
}

export function getAdDailyLimit(placement: AdPlacement): number | null {
  return AD_DAILY_LIMITS[placement] ?? null;
}

export function getAdUsedToday(profile: Pick<Profile, 'adDaily'>, placement: AdPlacement, day: string): number {
  if (!profile.adDaily || profile.adDaily.day !== day) return 0;
  const n = profile.adDaily.counts[placement];
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export function getAdRemainingToday(profile: Pick<Profile, 'adDaily'>, placement: AdPlacement, day: string): number {
  const limit = getAdDailyLimit(placement);
  if (limit === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - getAdUsedToday(profile, placement, day));
}

export function canUseAdToday(profile: Pick<Profile, 'adDaily'>, placement: AdPlacement, day: string): boolean {
  return getAdRemainingToday(profile, placement, day) > 0;
}

export function recordAdUse(profile: Profile, placement: AdPlacement, day: string): Profile {
  const prevCounts = profile.adDaily?.day === day ? { ...profile.adDaily.counts } : {};
  prevCounts[placement] = (prevCounts[placement] ?? 0) + 1;
  return { ...profile, adDaily: { day, counts: prevCounts } };
}

/**
 * Optional mini-game leaderboard HTTPS endpoint (configured via build-time `VITE_MINIGAME_LEADERBOARD_URL`).
 * Intentionally separate from Web `.env.production`'s Cloudflare `workers.dev` URL so WeChat / Bilibili builds
 * run cleanly in local mode without triggering `request:fail url not in domain list` errors until a real
 * ICP-filed domain or Tencent CloudBase backend is configured.
 */
export const MINIGAME_LEADERBOARD_URL = (
  env.VITE_MINIGAME_LEADERBOARD_URL ?? ''
).trim().replace(/\/+$/, '');

export function buildSharePayload(
  profile: Profile,
  context: 'menu' | 'victory' | 'endless' | 'profile' = 'menu',
  wave?: number,
): ShareOptions {
  const rank = getRank(profile.stars);
  const rankName = t(`rank.${rank.index}`);
  const zh = getLanguage() === 'zh-CN';

  if (context === 'endless' && wave && wave >= 11) {
    return {
      title: zh
        ? `我在《卡皮巴拉别慌》无尽模式守到了第 ${wave} 波！敢来比比情绪稳定吗 🍊`
        : `I survived to Endless Wave ${wave} in Capybara Chill Defense! 🍊`,
      query: `ref=endless&wave=${wave}`,
    };
  }
  if (context === 'victory') {
    return {
      title: zh
        ? `这一桶稳了！我已晋升「${rankName}」(★${profile.stars})，快来一起泡温泉守卫浴池 🍊`
        : `Tub defended! Reached ${rankName} (★${profile.stars}) in Capybara Chill Defense 🍊`,
      query: `ref=win&stars=${profile.stars}`,
    };
  }
  if (context === 'profile') {
    return {
      title: zh
        ? `「${rankName}」已收录 ${profile.mergedHeroes.length}/12 位传奇英雄，快来和我一起舒心泡澡！`
        : `${rankName} with ${profile.mergedHeroes.length}/12 Heroes unlocked — come chill in the onsen!`,
      query: 'ref=profile',
    };
  }
  return {
    title: zh
      ? '卡皮巴拉别慌！摇铃合成传奇萌宠，一起守卫温泉木桶 🍊'
      : 'Capybara Chill Defense! Merge adorable pets and protect the hot spring tub 🍊',
    query: 'ref=menu',
  };
}
