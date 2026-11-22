import type { Profile } from '../core/types';
import { MAP_IDS } from '../config/maps';
import { getRank } from '../config/ranks';
import { getUnlockedMaps } from '../core/PlayerProgression';
import { avatarSticker, weaponSticker } from '../render/M3Art';
import { getLanguage, t } from '../i18n/i18n';
import { escapeHtml as esc } from './art';
import { artSticker, sceneSticker } from './stickers';
import { BROTHS, BROTH_IDS, isBrothId } from '../config/kitchen';
import { canBrewOrUpgradeAnyBroth, getBrothLevel } from '../core/KitchenProgression';
import { villageBadge, villageStars } from '../core/VillageProgression';
import { VILLAGE_MAX_STARS } from '../config/village';
import { upgradeableMedallions } from '../core/MedallionProgression';
import { formatCompactNumber } from '../core/formatNumber';
import { isFeatureUnlocked, isRankHubUnlocked, nextLockedFeature, type FeatureId } from '../core/FeatureUnlocks';

/** Village medallion: `Harvest!` when the basket is ripe, `Build!` when something is affordable, else total stars. */
export function villageDockMarkup(profile: Profile, now = Date.now()): string {
  const badge = villageBadge(profile, now);
  const small = badge === 'harvest' ? `<small class="village-harvest-badge">${esc(t('p16.harvestBadge'))}</small>`
    : badge === 'build' ? `<small class="village-build-badge">${esc(t('p16.buildBadge'))}</small>`
    : `<small class="village-stars-badge">★${villageStars(profile)}/${VILLAGE_MAX_STARS}</small>`;
  return `<button type="button" class="village-dock-button" data-action="village"><span class="medallion" aria-hidden="true">${sceneSticker('ui_village_gate','',48)}</span><b>${esc(t('p16.dock'))}</b>${small}</button>`;
}

/** Kitchen medallion: a glowing `Brew!` badge whenever a new broth can be brewed, otherwise progress. */
export function kitchenDockMarkup(profile: Profile): string {
  const brewable = canBrewOrUpgradeAnyBroth(profile).brewable.length > 0;
  const unlocked = (profile.unlockedBroths ?? []).filter(isBrothId).length;
  const badge = brewable ? `<small class="kitchen-brew-badge">${esc(t('p14.brewBadge'))}</small>` : `<small class="kitchen-progress-badge">${unlocked}/${BROTH_IDS.length}</small>`;
  return `<button type="button" class="kitchen-dock-button" data-action="kitchen"><span class="medallion" aria-hidden="true">${sceneSticker('ui_kitchen_pot','',48)}</span><b>${esc(t('p14.dock'))}</b>${badge}</button>`;
}
/** Compact pill for today's soak; it opens the kitchen to switch broths. */
export function activeBrothPillMarkup(profile: Profile): string {
  const id = profile.activeBrothId, level = id && isBrothId(id) ? getBrothLevel(profile, id) : 0;
  if (!id || !isBrothId(id) || !level) return '';
  const name = t(`broth.${id}`);
  return `<button type="button" class="active-broth-pill" data-action="kitchen" style="--broth-color:${BROTHS[id].bathColor}" title="${esc(t('p14.activeTitle'))}: ${esc(name)} Lv.${level}" aria-label="${esc(t('p14.activeTitle'))}: ${esc(name)} Lv.${level}"><span aria-hidden="true">${sceneSticker(id,'',24)}</span><span class="active-broth-name">${esc(name)}</span><b>Lv.${level}</b></button>`;
}

/** P17: compact warm-gold pill mirroring today's soak; it opens the Endless Medallion Hall. */
export function endlessHallPillMarkup(profile: Profile): string {
  const ready = upgradeableMedallions(profile).length > 0, best = profile.bestEndlessWave ?? 0;
  const crests = formatCompactNumber(profile.endlessCrests ?? 0), title = `${t('p17.title')} · ${t('p17.crests')} ×${crests}${best >= 11 ? ` · ${t('p17.bestWave', { wave: best })}` : ''}`;
  const badge = ready ? `<b class="endless-hall-ready">${esc(t('p17.canUpgrade'))}</b>` : `<b class="endless-hall-crests">×${crests}</b>`;
  return `<button type="button" class="endless-hall-pill${ready ? ' is-ready' : ''}" data-action="medallions" title="${esc(title)}" aria-label="${esc(title)}"><span aria-hidden="true">${sceneSticker('ui_endless_crest', '', 24)}</span><span class="endless-hall-name">${esc(t('p17.hallPill'))}</span>${badge}${best >= 11 ? `<small class="endless-hall-best">${esc(t('p17.bestWave', { wave: best }))}</small>` : ''}</button>`;
}

/** Option A: renders a single locked preview dock button for the very next unlockable hub system. */
function lockedDockMarkup(id: FeatureId, badgeText: string): string {
  const art = id === 'armory' ? weaponSticker('m10_bamboo_staff', 56)
    : id === 'market' ? sceneSticker('ui_shop_bag', '', 56)
    : id === 'village' ? sceneSticker('ui_village_gate', '', 48)
    : id === 'kitchen' ? sceneSticker('ui_kitchen_pot', '', 48)
    : sceneSticker('ui_endless_crest', '', 44);
  const labelKey = id === 'armory' ? 'p3.armory' : id === 'market' ? 'p3.shop' : id === 'village' ? 'p16.dock' : id === 'kitchen' ? 'p14.dock' : 'p17.hallPill';
  return `<button type="button" class="hub-dock-locked" data-action="locked-feature:${id}" title="${esc(t(`p19.feature.${id}`))} · ${esc(badgeText)}" aria-label="${esc(t(`p19.feature.${id}`))} · ${esc(badgeText)}"><span class="medallion is-locked-art" aria-hidden="true">${art}</span><b>${esc(t(labelKey))}</b><small class="feature-lock-badge">🔒 ${esc(badgeText)}</small></button>`;
}

/** Small corner controls leave the animal-gathering panorama unobstructed and progressively reveal systems. */
export function courtyardMarkup(profile: Profile, now = Date.now()): string {
  const tr=(key:string)=>esc(t(key)), unlocked=getUnlockedMaps(profile), rank=getRank(profile.stars);
  const hasRank = isRankHubUnlocked(profile);
  const hasArmory = isFeatureUnlocked(profile, 'armory');
  const hasMarket = isFeatureUnlocked(profile, 'market');
  const hasVillage = isFeatureUnlocked(profile, 'village');
  const hasKitchen = isFeatureUnlocked(profile, 'kitchen');
  const hasMedallions = isFeatureUnlocked(profile, 'medallions');
  const nextDock = nextLockedFeature(profile, true);
  const lockText = nextDock ? (nextDock.requiresMatchOnly ? t('p19.lockMatch') : t('p19.lockStars', { stars: nextDock.targetStars })) : '';

  const maps=['auto',...MAP_IDS].map(id=>{
    const locked=id!=='auto'&&!unlocked.includes(id as typeof MAP_IDS[number]);
    const fullName=tr(id==='auto'?'p3.auto':`map.${id}`);
    return `<button type="button" data-action="select-map:${id}" aria-label="${fullName}" title="${fullName}" aria-pressed="${profile.selectedMap===id}" class="${locked?'locked':''}" ${locked?'disabled':''}>${tr(id==='auto'?'p3.auto':`p3.map.${id}`)}${locked?' <span class="map-lock" aria-hidden="true">🔒</span>':''}</button>`;
  }).join('');

  const profilePill = hasRank
    ? `<button type="button" class="profile-pill" data-action="profile"><span aria-hidden="true">${avatarSticker(profile.avatarId,46)}</span><span><b>${tr(`rank.${rank.index}`)}</b><strong>${sceneSticker('ui_coin_gold','',22)} ${profile.coins}　${sceneSticker('ui_star_rank','',22)} ${profile.stars}</strong></span></button>`
    : '';
  const mapNav = hasRank
    ? `<nav class="map-chips" aria-label="${tr('m3.map')}"><span aria-hidden="true">${sceneSticker('ui_map_sign','',24)}</span>${maps}</nav>`
    : '';

  const leftItems: string[] = [
    `<button type="button" data-action="recipes"><span class="medallion" aria-hidden="true">${sceneSticker('ui_compendium_book','',56)}</span><b>${tr('p3.guide')}</b></button>`,
  ];
  if (hasArmory) leftItems.push(`<button type="button" data-action="armory"><span class="medallion" aria-hidden="true">${weaponSticker('m10_bamboo_staff',56)}</span><b>${tr('p3.armory')}</b><small>${profile.unlockedWeapons.length}/36</small></button>`);
  else if (nextDock?.id === 'armory') leftItems.push(lockedDockMarkup('armory', lockText));
  if (hasKitchen) leftItems.push(kitchenDockMarkup(profile));
  else if (nextDock?.id === 'kitchen') leftItems.push(lockedDockMarkup('kitchen', lockText));

  const rightItems: string[] = [];
  if (hasVillage) rightItems.push(villageDockMarkup(profile, now));
  else if (nextDock?.id === 'village') rightItems.push(lockedDockMarkup('village', lockText));
  if (hasMarket) rightItems.push(`<button type="button" data-action="market"><span class="medallion" aria-hidden="true">${sceneSticker('ui_shop_bag','',56)}</span><b>${tr('p3.shop')}</b>${profile.freeLotteryTickets?`<small class="ticket-badge">${sceneSticker('ui_ticket_gacha','',18)} ${profile.freeLotteryTickets}</small>`:''}</button>`);
  else if (nextDock?.id === 'market') rightItems.push(lockedDockMarkup('market', lockText));
  if (hasRank) rightItems.push(`<button type="button" data-action="leaderboard"><span class="medallion" aria-hidden="true">${sceneSticker('ui_trophy_rank','',56)}</span><b>${tr('p3.rank')}</b></button>`);

  const endlessPill = hasMedallions
    ? endlessHallPillMarkup(profile)
    : nextDock?.id === 'medallions'
      ? `<button type="button" class="endless-hall-pill is-locked-preview" data-action="locked-feature:medallions" title="${esc(t('p19.feature.medallions'))} · ${esc(lockText)}"><span aria-hidden="true">${sceneSticker('ui_endless_crest','',22)}</span><span class="endless-hall-name">${esc(t('p17.hallPill'))}</span><b class="feature-lock-pill">🔒 ${esc(lockText)}</b></button>`
      : '';

  return `${profilePill}
    <div class="menu-system"><div class="language-switch" role="group" aria-label="${tr('app.language')}"><button type="button" data-action="zh-CN" aria-pressed="${getLanguage()==='zh-CN'}">中</button><button type="button" data-action="en" aria-pressed="${getLanguage()==='en'}">EN</button></div><button type="button" class="icon-button" data-action="settings" aria-label="${tr('m3.settings')}">⚙</button></div>
    <h1 class="art-title" aria-label="${tr('app.title')}">${artSticker(getLanguage()==='zh-CN'?'title_logo_zh':'title_logo_en',t('app.title'))}</h1>
    ${mapNav}
    <button type="button" class="start-button" data-action="start" aria-label="${tr('menu.start')}">${artSticker(getLanguage()==='zh-CN'?'ui_btn_start_zh':'ui_btn_start_en',t('menu.start'))}</button>
    <nav class="hub-dock hub-dock-left">${leftItems.join('')}</nav>${hasKitchen ? activeBrothPillMarkup(profile) : ''}${endlessPill}
    ${rightItems.length ? `<nav class="hub-dock hub-dock-right">${rightItems.join('')}</nav>` : ''}`;
}
