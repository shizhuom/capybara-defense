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

/** Small corner controls leave the animal-gathering panorama unobstructed. */
export function courtyardMarkup(profile: Profile): string {
  const tr=(key:string)=>esc(t(key)), unlocked=getUnlockedMaps(profile), rank=getRank(profile.stars);
  const maps=['auto',...MAP_IDS].map(id=>{
    const locked=id!=='auto'&&!unlocked.includes(id as typeof MAP_IDS[number]);
    const fullName=tr(id==='auto'?'p3.auto':`map.${id}`);
    return `<button type="button" data-action="select-map:${id}" aria-label="${fullName}" title="${fullName}" aria-pressed="${profile.selectedMap===id}" class="${locked?'locked':''}" ${locked?'disabled':''}>${tr(id==='auto'?'p3.auto':`p3.map.${id}`)}${locked?' <span class="map-lock" aria-hidden="true">🔒</span>':''}</button>`;
  }).join('');
  return `<button type="button" class="profile-pill" data-action="profile"><span aria-hidden="true">${avatarSticker(profile.avatarId,46)}</span><span><b>${tr(`rank.${rank.index}`)}</b><strong>${sceneSticker('ui_coin_gold','',22)} ${profile.coins}　${sceneSticker('ui_star_rank','',22)} ${profile.stars}</strong></span></button>
    <div class="menu-system"><div class="language-switch" role="group" aria-label="${tr('app.language')}"><button type="button" data-action="zh-CN" aria-pressed="${getLanguage()==='zh-CN'}">中</button><button type="button" data-action="en" aria-pressed="${getLanguage()==='en'}">EN</button></div><button type="button" class="icon-button" data-action="settings" aria-label="${tr('m3.settings')}">⚙</button></div>
    <h1 class="art-title" aria-label="${tr('app.title')}">${artSticker(getLanguage()==='zh-CN'?'title_logo_zh':'title_logo_en',t('app.title'))}</h1>
    <nav class="map-chips" aria-label="${tr('m3.map')}"><span aria-hidden="true">${sceneSticker('ui_map_sign','',24)}</span>${maps}</nav>
    <button type="button" class="start-button" data-action="start" aria-label="${tr('menu.start')}">${artSticker(getLanguage()==='zh-CN'?'ui_btn_start_zh':'ui_btn_start_en',t('menu.start'))}</button>
    <nav class="hub-dock hub-dock-left"><button type="button" data-action="recipes"><span class="medallion" aria-hidden="true">${sceneSticker('ui_compendium_book','',56)}</span><b>${tr('p3.guide')}</b></button><button type="button" data-action="armory"><span class="medallion" aria-hidden="true">${weaponSticker('m10_bamboo_staff',56)}</span><b>${tr('p3.armory')}</b><small>${profile.unlockedWeapons.length}/36</small></button>${kitchenDockMarkup(profile)}</nav>${activeBrothPillMarkup(profile)}
    <nav class="hub-dock hub-dock-right"><button type="button" data-action="market"><span class="medallion" aria-hidden="true">${sceneSticker('ui_shop_bag','',56)}</span><b>${tr('p3.shop')}</b>${profile.freeLotteryTickets?`<small class="ticket-badge">${sceneSticker('ui_ticket_gacha','',18)} ${profile.freeLotteryTickets}</small>`:''}</button><button type="button" data-action="leaderboard"><span class="medallion" aria-hidden="true">${sceneSticker('ui_trophy_rank','',56)}</span><b>${tr('p3.rank')}</b></button></nav>`;
}
