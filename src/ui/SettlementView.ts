import type {BattleState,Profile} from '../core/types';
import {getRank} from '../config/ranks';
import {HEROES} from '../config/heroes';
import {WEAPONS} from '../config/weapons';
import {t} from '../i18n/i18n';
import {weaponSticker,avatarSticker} from '../render/M3Art';
import {sceneSticker,unitSticker} from './stickers';
import {escapeHtml as esc} from './art';
const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export function lootMarkup(loot:readonly string[]):string {
 if(!loot.length)return `<p class="loot-empty">${tr('loot.none')}</p>`;
 const counts=new Map<string,number>();for(const id of loot)counts.set(id,(counts.get(id)??0)+1);
 return `<ul class="loot-list loot-tray">${[...counts].map(([id,count])=>`<li>${WEAPONS[id]?weaponSticker(id,34):sceneSticker('ui_merge_sparkle','',34)}<span>${tr(`fragment.${id}`)}</span><b>×${count}</b></li>`).join('')}</ul>`;
}
function header(kind:'pause'|'win'|'loss',title:string,subtitle:string):string {
 const id=kind==='pause'?'ui_header_pause':kind==='win'?'ui_result_victory':'ui_result_defeat';
 return `<header class="ledger-header ${kind==='pause'?'pause-header':'result-'+kind+'-header'}"><div class="ledger-mascot">${sceneSticker(id,'',kind==='pause'?76:96)}</div><div class="ledger-heading"><h2 id="dialog-title">${title}</h2><p>${subtitle}</p></div><div class="ledger-header-end"><div class="compendium-toolbar"><button type="button" class="ledger-close dialog-close" data-action="${kind==='pause'?'resume':'menu'}" aria-label="${tr(kind==='pause'?'p6.resume':'p6.menu')}">×</button></div></div></header>`;
}
export function pauseMarkup(state:BattleState):string {
 return `<div class="ledger-shell pause-shell">${header('pause',tr('pause.title'),tr('pause.subtitle'))}<div class="ledger-body" tabindex="0"><div class="pause-status-strip"><span>${sceneSticker('ui_map_sign','',28)}${tr(`map.${state.mapId}`)}</span><span>🌊 ${state.wave} / 10</span><span title="${tr('p6.time')}">⏱ ${clock(state.time)}</span><span>${sceneSticker('orange','',28)}×${state.sides.player.oranges}</span></div><section><h3>${tr('pause.loot')}</h3>${lootMarkup(state.sides.player.loot)}</section><p class="settlement-note">${tr('pause.rule')}</p></div><footer class="settlement-actions pause-actions"><button type="button" class="button button-teal" data-action="resume" autofocus>▶ ${tr('p6.resume')}</button><div><button type="button" data-action="profile">🪪 ${tr('m3.profile')}</button><button type="button" data-action="settings">⚙ ${tr('m3.settings')}</button><button type="button" class="surrender-button" data-action="surrender">🏳 ${tr('p6.surrender')}</button></div></footer></div>`;
}
export interface ResultViewInput {state:BattleState;profile:Profile;savedResult:boolean;resultStars:number;previousRank:number;newWeapons:readonly string[];newAvatars:readonly string[]}
export function resultMarkup({state,profile,savedResult,resultStars,previousRank,newWeapons,newAvatars}:ResultViewInput):string {
 const result=state.result!;if(!result)return '';
 const won=result.winner==='player',rank=getRank(profile.stars),mvp=result.mvp;
 const stars=`${resultStars>0?'+':''}${resultStars}`;
 const rewards=[['ui_coin_gold',won?result.coins:0,'profile.coins'],['ui_merge_sparkle',won?result.loot.length:0,'profile.fragments'],...(won?[['ui_ticket_gacha',1,'p5.tickets']]:[])] as [Parameters<typeof sceneSticker>[0],number,string][];
 const units=state.units.filter(u=>u.side==='player'&&u.location.zone==='board');
 const mvpBody=mvp?`${unitSticker(mvp.kind,64)}<strong>${tr(`${HEROES[mvp.kind]?'hero':'unit'}.${mvp.kind}`)}</strong><span>${tr('inspect.level',{level:mvp.level})}</span><div class="mvp-stats"><span><b>${Math.round(mvp.damage)}</b>${tr('p6.damage')}</span><span><b>${mvp.kills}</b>${tr('p6.kills')}</span></div>`:`<p>${tr('p6.noMvp')}</p><div class="lineup-stickers">${units.slice(0,8).map(u=>unitSticker(u.kind,30)).join('')}</div><span>${tr('p6.lineup',{count:units.length})}</span>`;
 const unlocks=newWeapons.length||newAvatars.length?`<div class="unlock-reward unlock-gallery"><h3>✦ ${tr('p6.unlock')}</h3>${newWeapons.map(id=>`<div>${weaponSticker(id,48)}<strong>${tr(`weapon.${id}`)}</strong></div>`).join('')}${newAvatars.map(id=>`<div>${avatarSticker(id,48)}<strong>${tr(`avatar.${id}`)}</strong></div>`).join('')}</div>`:'';
 return `<div class="ledger-shell result-shell ${won?'result-win':'result-loss'}">${header(won?'win':'loss',tr(won?'result.win':'result.loss'),`${tr(won?'result.winSub':'result.lossSub')} · ⏱ ${clock(result.elapsed)}`)}<div class="ledger-body" tabindex="0"><div class="result-summary-grid"><div class="result-rewards-card"><h3>${tr(`rank.${rank.index}`)}</h3><div class="rank-result"><span class="result-star-change">${sceneSticker('ui_star_rank','',30)}<b>${stars}</b><small>${tr('m3.stars',{count:profile.stars})}</small></span>${savedResult&&!won&&resultStars===0?`<p class="star-protection">${tr(previousRank<10?'m3.protected':'m3.floorProtected')}</p>`:''}${won&&resultStars>1?`<p>${tr('m3.streakBonus')}</p>`:''}${rank.index>previousRank?`<p class="promotion-banner">${tr('m3.promotion',{rank:t(`rank.${rank.index}`)})}</p>`:''}</div><div class="result-rewards">${rewards.map(([id,value,key])=>`<span>${sceneSticker(id,'',36)}<b>+${value}</b><small>${tr(key)}</small></span>`).join('')}</div></div><div class="result-mvp-card"><h3>${sceneSticker('ui_mvp_crown','',42)}${tr('p6.mvp')}</h3>${mvpBody}</div></div><h3>${tr('result.pool')}</h3>${lootMarkup(result.loot)}${unlocks}<p class="save-note">${tr(savedResult?'result.awarded':'result.memory')}</p>${won?'':`<p class="result-reason">${tr(`result.reason.${result.reason}`)}</p>`}</div><footer class="settlement-actions result-actions"><button type="button" class="button button-teal" data-action="start" autofocus>🔥 ${tr('p6.again')}</button><button type="button" class="button" data-action="menu">🏡 ${tr('p6.menu')}</button></footer></div>`;
}
