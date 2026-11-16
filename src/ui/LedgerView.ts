import type {Profile} from '../core/types';
import {getLanguage,t} from '../i18n/i18n';
import {getRank,getRankDifficulty} from '../config/ranks';
import {bossCountForWave} from '../config/waves';
import {sceneSticker} from './stickers';
import {escapeHtml as esc} from './art';

export type LedgerPage='compendium'|'armory'|'market'|'profile'|'leaderboard'|'settings';
const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
export function languagePills():string {
  return `<div class="language-switch dialog-language" role="group" aria-label="${tr('app.language')}">${(['zh-CN','en'] as const).map(lang=>`<button type="button" data-action="${lang}" aria-pressed="${getLanguage()===lang}" class="${getLanguage()===lang?'selected':''}">${lang==='en'?'EN':getLanguage()==='en'?'ZH':'中'}</button>`).join('')}</div>`;
}
export function ledgerWallet(profile:Profile):string {
  return `<div class="ledger-wallet"><span title="${tr('profile.coins')}">${sceneSticker('ui_coin_gold','',26)}<b>${profile.coins}</b></span><span title="${tr('p5.tickets')}">${sceneSticker('ui_ticket_gacha','',26)}<b>${profile.freeLotteryTickets}</b></span></div>`;
}
export function ledgerTabs(page:LedgerPage):string {
  const tabs=page==='armory'?['all','melee','ranged','magic','recycle']:page==='market'?['shop','backpack','lottery']:['leaderboard','profile','settings'];
  const active=page==='armory'?'all':page==='market'?'shop':page;
  const prefix=page==='armory'?'meta-family:':page==='market'?'meta-tab:':'';
  return `<nav class="ledger-tabs ${prefix?'meta-tabs':'profile-navigation'}" aria-label="${tr('p5.notebookTabs')}">${tabs.map(tab=>`<button type="button" data-action="${prefix}${tab}" aria-pressed="${active===tab}" class="${active===tab?'selected':''}">${tr(`p11.tab.${tab}`)}</button>`).join('')}</nav>`;
}
export interface LedgerOptions {profile?:Profile;tabs?:string;badges?:string;inBattle?:boolean;preparation?:boolean}
export function ledger(page:LedgerPage,body:string,options:LedgerOptions={}):string {
  const headerId=({compendium:'ui_compendium_peek_capy',armory:'ui_armory_peek_capy',market:'ui_market_peek_raccoon',leaderboard:'ui_rank_peek_capy',profile:'ui_profile_peek_capy',settings:'ui_profile_peek_capy'} as const)[page];
  const close=page==='compendium'?'close-recipes':page==='armory'||page==='market'?'close-meta':'close-profile';
  const profile=options.profile;
  const summary=!profile||page==='settings'?'':page==='armory'?tr('p11.unlocked',{count:profile.unlockedWeapons.length}):page==='market'?`${sceneSticker('ui_coin_gold','',18)} ${profile.coins} <span aria-hidden="true">·</span> ${sceneSticker('ui_ticket_gacha','',18)} ${profile.freeLotteryTickets}`:`${sceneSticker('ui_star_rank','',18)} ${profile.stars}`;
  const badge=options.badges??(summary?`<span class="collection-badge">${summary}</span>`:'');
  const switchPage=page==='armory'?'market':'armory';
  const link=options.inBattle&&(page==='armory'||page==='market')?`<button type="button" class="storybook-switch" data-action="battle-shop:${switchPage}">${tr(`p11.switch.${switchPage}`)} ›</button>`:'';
  const tip1=page==='compendium'?'p10.footerTip1':`p11.tip.${page}.1`;
  const tip2=page==='compendium'?'p10.footerTip2':options.inBattle?(options.preparation?'p11.preparation':'p11.nextBattle'):`p11.tip.${page}.2`;
  return `<div class="ledger-shell" data-ledger-page="${page}"><header class="ledger-header"><div class="ledger-mascot">${sceneSticker(headerId,'',78)}</div><div class="ledger-heading"><h2 id="dialog-title">${tr(page==='compendium'?'p10.title':`p11.title.${page}`)}</h2>${badge||link?`<div class="storybook-heading-note">${badge}${link}</div>`:''}</div><div class="ledger-header-end"><div class="compendium-toolbar"><button type="button" class="ledger-close dialog-close icon-button" data-action="${close}" aria-label="${tr('m3.close')}">×</button></div></div></header>${options.tabs??ledgerTabs(page)}<div class="ledger-body" tabindex="0">${body}</div><footer class="storybook-footer-tip"><p>${tr(tip1)}</p><p${options.inBattle?' role="status"':''}>${tr(tip2)}</p></footer></div>`;
}
export function threatBanner(profile:Profile,compact=false):string {
  const rank=getRank(profile.stars),d=getRankDifficulty(rank.index),doubles=[6,8,9,10].filter(w=>bossCountForWave(w,rank.index)===2);
  return `<section class="threat-banner ${compact?'compact':''}">${sceneSticker('ui_skull_threat','',compact?34:52)}<div><strong>${tr('p5.threat')} · ${tr(`rank.${rank.index}`)}</strong><div class="threat-values"><span>♥ ${tr('p5.threatHP',{value:d.hpMultiplier})}</span><span>➜ ${tr('p5.threatSpeed',{value:Math.round((d.speedMultiplier-1)*100)})}</span><span>🐾 ${tr('p5.threatCount',{value:d.extraCount})}</span><span>${tr(doubles.length?'p5.doubleWaves':'p5.singleBoss',{waves:doubles.join(' / ')})}</span></div>${compact?'':`<small>${tr('p5.threatDetail',{armor:Math.round(d.armorBonus*100),cooldown:Math.round((1-d.bossCooldownScale)*100)})}${rank.index>=20?` · ${tr('p5.vanguard')}`:''}</small>`}</div></section>`;
}
