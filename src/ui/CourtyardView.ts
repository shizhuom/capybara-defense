import type { Profile } from '../core/types';
import { MAP_IDS } from '../config/maps';
import { getRank } from '../config/ranks';
import { getUnlockedMaps } from '../core/PlayerProgression';
import { avatarSticker, weaponSticker } from '../render/M3Art';
import { getLanguage, t } from '../i18n/i18n';
import { escapeHtml as esc } from './art';
import { artSticker, sceneSticker } from './stickers';

/** Small corner controls leave the animal-gathering panorama unobstructed. */
export function courtyardMarkup(profile: Profile): string {
  const tr=(key:string)=>esc(t(key)), unlocked=getUnlockedMaps(profile), rank=getRank(profile.stars);
  const maps=['auto',...MAP_IDS].map(id=>{
    const locked=id!=='auto'&&!unlocked.includes(id as typeof MAP_IDS[number]);
    const fullName=tr(id==='auto'?'p3.auto':`map.${id}`);
    return `<button type="button" data-action="select-map:${id}" aria-label="${fullName}" title="${fullName}" aria-pressed="${profile.selectedMap===id}" class="${locked?'locked':''}" ${locked?'disabled':''}>${tr(id==='auto'?'p3.auto':`p3.map.${id}`)}${locked?' <span class="map-lock" aria-hidden="true">🔒</span>':''}</button>`;
  }).join('');
  return `<button type="button" class="profile-pill" data-action="profile"><span aria-hidden="true">${avatarSticker(profile.avatarId,46)}</span><span><b>${tr(`rank.${rank.index}`)}</b><strong>🪙 ${profile.coins}　⭐ ${profile.stars}</strong></span></button>
    <div class="menu-system"><div class="language-switch" role="group" aria-label="${tr('app.language')}"><button type="button" data-action="zh-CN" aria-pressed="${getLanguage()==='zh-CN'}">中</button><button type="button" data-action="en" aria-pressed="${getLanguage()==='en'}">EN</button></div><button type="button" class="icon-button" data-action="settings" aria-label="${tr('m3.settings')}">⚙</button></div>
    <h1 class="art-title" aria-label="${tr('app.title')}">${artSticker(getLanguage()==='zh-CN'?'title_logo_zh':'title_logo_en',t('app.title'))}</h1>
    <nav class="map-chips" aria-label="${tr('m3.map')}"><span aria-hidden="true">${sceneSticker('ui_map_sign','',24)}</span>${maps}</nav>
    <button type="button" class="start-button" data-action="start" aria-label="${tr('menu.start')}">${artSticker(getLanguage()==='zh-CN'?'ui_btn_start_zh':'ui_btn_start_en',t('menu.start'))}</button>
    <nav class="hub-dock hub-dock-left"><button type="button" data-action="recipes"><span class="medallion" aria-hidden="true">${sceneSticker('ui_compendium_book','',56)}</span><b>${tr('p3.guide')}</b></button><button type="button" data-action="armory"><span class="medallion" aria-hidden="true">${weaponSticker('m10_bamboo_staff',56)}</span><b>${tr('p3.armory')}</b><small>${profile.unlockedWeapons.length}/36</small></button></nav>
    <nav class="hub-dock hub-dock-right"><button type="button" data-action="market"><span class="medallion" aria-hidden="true">${sceneSticker('ui_shop_bag','',56)}</span><b>${tr('p3.shop')}</b>${profile.freeLotteryTickets?`<small class="ticket-badge">🎟 ${profile.freeLotteryTickets}</small>`:''}</button><button type="button" data-action="leaderboard"><span class="medallion" aria-hidden="true">${sceneSticker('ui_trophy_rank','',56)}</span><b>${tr('p3.rank')}</b></button></nav>`;
}
