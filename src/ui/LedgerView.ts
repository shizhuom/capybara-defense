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
  const shop=page==='armory'||page==='market',pages:LedgerPage[]=shop?['armory','market']:['profile','leaderboard','settings'];
  return `<nav class="ledger-tabs ${shop?'meta-tabs shop-navigation':'profile-navigation'}" aria-label="${tr('p5.notebookTabs')}">${pages.map(p=>`<button type="button" data-action="${shop?'battle-shop:':''}${p}" aria-pressed="${page===p}" class="${page===p?'selected':''}">${tr(`p5.page.${p}`)}</button>`).join('')}</nav>`;
}
export function ledger(page:LedgerPage,body:string,options:{profile?:Profile;tabs?:string;badges?:string}={}):string {
  const headerId=page==='leaderboard'?'ui_header_rank':`ui_header_${page}` as Parameters<typeof sceneSticker>[0];
  const close=page==='compendium'?'close-recipes':page==='armory'||page==='market'?'close-meta':'close-profile';
  return `<div class="ledger-shell" data-ledger-page="${page}"><header class="ledger-header"><div class="ledger-mascot">${sceneSticker(headerId,'',76)}</div><div class="ledger-heading"><h2 id="dialog-title">${tr(`p5.page.${page}`)}</h2><p>${tr(`p5.subtitle.${page}`)}</p>${options.badges??''}</div><div class="ledger-header-end">${options.profile?(page==='profile'||page==='leaderboard'?`<div class="ledger-wallet"><span>${sceneSticker('ui_star_rank','',26)}<b>${options.profile.stars}</b></span><span>${sceneSticker('ui_skull_threat','',26)}<b>×${getRankDifficulty(getRank(options.profile.stars).index).hpMultiplier}</b></span></div>`:ledgerWallet(options.profile)):''}<div class="compendium-toolbar"><button type="button" class="ledger-close dialog-close icon-button" data-action="${close}" aria-label="${tr('m3.close')}">×</button></div></div></header>${options.tabs??ledgerTabs(page)}<div class="ledger-body" tabindex="0">${body}</div></div>`;
}
export function threatBanner(profile:Profile,compact=false):string {
  const rank=getRank(profile.stars),d=getRankDifficulty(rank.index),doubles=[6,8,9,10].filter(w=>bossCountForWave(w,rank.index)===2);
  return `<section class="threat-banner ${compact?'compact':''}">${sceneSticker('ui_skull_threat','',compact?34:52)}<div><strong>${tr('p5.threat')} · ${tr(`rank.${rank.index}`)}</strong><div class="threat-values"><span>♥ ${tr('p5.threatHP',{value:d.hpMultiplier})}</span><span>➜ ${tr('p5.threatSpeed',{value:Math.round((d.speedMultiplier-1)*100)})}</span><span>🐾 ${tr('p5.threatCount',{value:d.extraCount})}</span><span>${tr(doubles.length?'p5.doubleWaves':'p5.singleBoss',{waves:doubles.join(' / ')})}</span></div>${compact?'':`<small>${tr('p5.threatDetail',{armor:Math.round(d.armorBonus*100),cooldown:Math.round((1-d.bossCooldownScale)*100)})}${rank.index>=20?` · ${tr('p5.vanguard')}`:''}</small>`}</div></section>`;
}
