import type { Profile } from '../core/types';
import { MAP_IDS } from '../config/maps';
import { getRank } from '../config/ranks';
import { getUnlockedMaps } from '../core/PlayerProgression';
import { avatarSticker, weaponSticker } from '../render/M3Art';
import { getLanguage, t } from '../i18n/i18n';
import { escapeHtml as esc } from './art';
import { sceneSticker } from './stickers';

/** Peaceful hub controls sit over the continuously rendered map. */
export function courtyardMarkup(profile: Profile): string {
  const tr=(key:string)=>esc(t(key)), unlocked=getUnlockedMaps(profile), rank=getRank(profile.stars);
  const maps=['auto',...MAP_IDS].map((id,index)=>{
    const locked=id!=='auto'&&!unlocked.includes(id as typeof MAP_IDS[number]);
    const fullName=tr(id==='auto'?'p3.auto':`map.${id}`);
    return `<button type="button" data-action="select-map:${id}" aria-label="${fullName}" title="${fullName}" aria-pressed="${profile.selectedMap===id}" class="${locked?'locked':''}" ${locked?'disabled':''}>${['🎲','🏡','🌸','🍳','🐾'][index]} ${tr(id==='auto'?'p3.auto':`p3.map.${id}`)}${locked?' 🔒':''}</button>`;
  }).join('');
  return `<button type="button" class="profile-pill" data-action="profile"><span aria-hidden="true">${avatarSticker(profile.avatarId,46)}</span><span><b>${tr(`rank.${rank.index}`)}</b><strong>🪙 ${profile.coins}　⭐ ${profile.stars}</strong></span></button>
    <div class="menu-system"><div class="language-switch" role="group" aria-label="${tr('app.language')}"><button type="button" data-action="zh-CN" aria-pressed="${getLanguage()==='zh-CN'}">中</button><button type="button" data-action="en" aria-pressed="${getLanguage()==='en'}">EN</button></div><button type="button" class="icon-button" data-action="settings" aria-label="${tr('m3.settings')}">⚙</button></div>
    <div class="title-plaque"><span aria-hidden="true">${sceneSticker('logo_capy','',66)}</span><h1>${tr('app.title')}</h1></div>
    <nav class="map-chips" aria-label="${tr('m3.map')}">${maps}</nav>
    <button type="button" class="start-button" data-action="start">▶ ${tr('menu.start')}</button>
    <nav class="hub-dock"><button type="button" data-action="recipes"><span aria-hidden="true">${sceneSticker('ui_compendium_book','',52)}</span><b>${tr('p3.guide')}</b></button><button type="button" data-action="armory"><span aria-hidden="true">${weaponSticker('m10_bamboo_staff',52)}</span><b>${tr('p3.armory')}</b><small>${profile.unlockedWeapons.length}/36</small></button><button type="button" data-action="market"><span aria-hidden="true">${sceneSticker('ui_shop_bag','',52)}</span><b>${tr('p3.shop')}</b>${profile.freeLotteryTickets?`<small class="ticket-badge">🎟 ${profile.freeLotteryTickets}</small>`:''}</button><button type="button" data-action="leaderboard"><span aria-hidden="true" class="rank-hub-icon">🏆</span><b>${tr('p3.rank')}</b></button></nav>`;
}
