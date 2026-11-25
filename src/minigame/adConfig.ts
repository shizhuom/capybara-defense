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
  | 'stamina_refill';

/**
 * Rewarded Video Ad Unit IDs per platform (`wx` / `bl`).
 * Leave empty until Traffic Master (流量主 / 500 UV) is approved; UI hides ad buttons gracefully when empty.
 * Supply real unit IDs via build-time env `VITE_WX_AD_REVIVE`, etc., or directly here before release build.
 */
const env = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {});

const AD_UNITS: Record<Exclude<PlatformKind, 'web'>, Record<AdPlacement, string>> = {
  wx: {
    revive: env.VITE_WX_AD_REVIVE ?? '',
    double_settlement: env.VITE_WX_AD_DOUBLE_COINS ?? '',
    free_gacha: env.VITE_WX_AD_FREE_GACHA ?? '',
    free_shop_refresh: env.VITE_WX_AD_SHOP_REFRESH ?? '',
    double_harvest: env.VITE_WX_AD_DOUBLE_HARVEST ?? '',
    stamina_refill: env.VITE_WX_AD_STAMINA_REFILL ?? '',
  },
  bl: {
    revive: env.VITE_BL_AD_REVIVE ?? '',
    double_settlement: env.VITE_BL_AD_DOUBLE_COINS ?? '',
    free_gacha: env.VITE_BL_AD_FREE_GACHA ?? '',
    free_shop_refresh: env.VITE_BL_AD_SHOP_REFRESH ?? '',
    double_harvest: env.VITE_BL_AD_DOUBLE_HARVEST ?? '',
    stamina_refill: env.VITE_BL_AD_STAMINA_REFILL ?? '',
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

/**
 * Default Cloudflare Worker leaderboard endpoint (also overrideable via VITE_LEADERBOARD_API_URL).
 * In WeChat/Bilibili production, whitelist this HTTPS domain in the Mini Game console's request合法域名,
 * or requests will gracefully fall back to offline NPC + local device cache with zero errors.
 */
export const MINIGAME_LEADERBOARD_URL = (
  env.VITE_LEADERBOARD_API_URL
  ?? 'https://capybara-endless-leaderboard.capybara-defense.workers.dev'
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
        ? `「${rankName}」已收录 ${profile.mergedHeroes.length}/12 位传奇英雄，快来和我一起摸鱼泡澡！`
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
