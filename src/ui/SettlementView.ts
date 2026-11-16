import type {BattleState,Profile} from '../core/types';
import {getRank,RANKS} from '../config/ranks';
import {HEROES} from '../config/heroes';
import {WEAPONS} from '../config/weapons';
import {t} from '../i18n/i18n';
import {weaponSticker,avatarSticker} from '../render/M3Art';
import {sceneSticker,unitSticker} from './stickers';
import {escapeHtml as esc} from './art';
const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const reportClock=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const count=(value:number)=>Math.round(value).toLocaleString('en-US');
export function lootMarkup(loot:readonly string[]):string {
 if(!loot.length)return `<p class="loot-empty">${tr('loot.none')}</p>`;
 const counts=new Map<string,number>();for(const id of loot)counts.set(id,(counts.get(id)??0)+1);
 return `<ul class="loot-list loot-tray">${[...counts].map(([id,count])=>`<li>${WEAPONS[id]?weaponSticker(id,44):sceneSticker('ui_merge_sparkle','',44)}<span>${tr(`fragment.${id}`)}</span><b>×${count}</b></li>`).join('')}</ul>`;
}
export function pauseMarkup(state:BattleState):string {
 const fragments=state.sides.player.loot;
 return `<div class="ledger-shell pause-shell">
  <header class="ledger-header pause-header"><div class="ledger-mascot" aria-hidden="true">${sceneSticker('ui_pause_peek_capy','',78)}</div><div class="ledger-heading"><h2 id="dialog-title">${tr('p12.pauseTitle')}</h2></div><div class="compendium-toolbar"><button type="button" class="ledger-close dialog-close" data-action="resume" aria-label="${tr('p12.resume')}">×</button></div></header>
  <div class="ledger-body pause-storybook-board" tabindex="0">
   <article class="pause-status-strip"><div class="storybook-frame" aria-hidden="true">${sceneSticker('ui_map_sign','',58)}</div><div class="pause-status-copy"><h3>${tr(`map.${state.mapId}`)}</h3><p><span>${tr(state.endless?'p13.endlessWave':'p12.pauseWave',{wave:state.wave})}</span><span>${tr('p12.pauseTime',{time:clock(state.time)})}</span><span>${tr('p12.pauseOranges',{count:state.sides.player.oranges})}</span></p></div></article>
   <section><h3>${tr('p12.pauseLoot')}</h3>${fragments.length?lootMarkup(fragments):`<p class="loot-empty">${tr('p12.pauseEmpty')}</p>`}</section>
  </div>
  <footer class="settlement-actions pause-actions pause-storybook-actions"><button type="button" class="button button-teal" data-action="resume" autofocus><span aria-hidden="true">▶</span> ${tr('p12.resume')}</button><div><button type="button" data-action="profile">🪪 ${tr('p12.profile')}</button><button type="button" data-action="settings">⚙ ${tr('p12.settings')}</button><button type="button" class="surrender-button" data-action="surrender">${state.endless?'♾':'🏳'} ${tr(state.endless?'p13.settleEndless':'p12.surrender')}</button></div></footer>
 </div>`;
}
export function endlessOfferMarkup(state:BattleState,savedResult:boolean):string {
 const result=state.standardResult??state.result;
 return `<div class="endless-offer-shell">
  <div class="endless-offer-emblem" aria-hidden="true">${sceneSticker('ui_endless_emblem','',148)}</div>
  <h2 id="dialog-title">${tr('p13.endlessOfferTitle')}</h2>
  ${savedResult?`<p class="endless-banked-note" role="status"><span aria-hidden="true">✓</span> ${tr('p13.endlessBanked')}</p>`:`<div class="endless-save-pending" role="status"><p>${tr('p13.savePending')}</p><button type="button" data-action="retry-save-result" autofocus>${tr('p13.retrySave')}</button></div>`}
  <div class="endless-offer-story"><p>${tr('p13.endlessOfferBody')}</p><div class="endless-growth" role="img" aria-label="${tr('p13.endlessScaling')}"><span aria-hidden="true">×2 <i>→</i> ×4 <i>→</i> ×8 <i>→</i> ×16…</span></div></div>
  ${savedResult?`<div class="endless-offer-rewards" aria-label="${tr('p13.treasureShelf')}"><span>${sceneSticker('ui_star_rank','',28)}<b>${tr('p13.rankBanked')}</b></span><span>${sceneSticker('ui_coin_gold','',32)}<b>+${result?.coins??0}</b></span><span>${sceneSticker('ui_ticket_gacha','',30)}<b>+1</b></span></div>`:''}
  <footer class="endless-offer-actions"><button type="button" class="endless-decline" data-action="decline-endless"><span aria-hidden="true">🏆</span> ${tr('p13.declineEndless')}</button><button type="button" class="endless-enter" data-action="enter-endless"${savedResult?' autofocus':' disabled'}><span aria-hidden="true">♾</span> ${tr('p13.enterEndless')}</button></footer>
 </div>`;
}
export interface ResultViewInput {state:BattleState;profile:Profile;savedResult:boolean;resultStars:number;previousRank:number;newWeapons:readonly string[];newAvatars:readonly string[];newRoster?:{units:readonly string[];heroes:readonly string[]};statsOpen?:boolean}
export function resultMarkup({state,profile,savedResult,resultStars,previousRank,newWeapons,newAvatars,newRoster,statsOpen=false}:ResultViewInput):string {
 const result=state.result!;if(!result)return '';
 const endless=Boolean(result.endless),won=endless||result.winner==='player',rank=getRank(profile.stars),mvp=result.mvp;
 const coins=won?(endless&&state.standardResult?state.standardResult.coins+(result.endlessCoins??0):result.coins):0;
 const loot=won?(endless&&state.standardResult?[...state.standardResult.loot,...(result.endlessLoot??[])]:result.loot):[];
 const endlessWave=result.endlessWave??state.wave,bestEndlessWave=Math.max(endlessWave,profile.bestEndlessWave??0);
 const stars=`${resultStars>0?'+':''}${resultStars}`;
 const guardianStars=endless?3:won?Math.min(3,Math.max(1,Math.floor(state.sides.player.oranges))):0;
 const nextRank=RANKS[rank.index+1],progressMax=nextRank?nextRank.minStars-rank.minStars:1;
 const progress=nextRank?Math.min(progressMax,Math.max(0,profile.stars-rank.minStars)):1;
 const progressLabel=tr(nextRank?'p12.rankProgress':'p12.maxRank',{current:progress,total:progressMax});
 const protection=savedResult&&!won&&resultStars===0?tr(previousRank<10?'m3.protected':'m3.floorProtected'):'';
 const streak=won&&resultStars>1?tr('m3.streakBonus'):'';
 const rankNotes=[protection,streak,rank.index>previousRank?tr('m3.promotion',{rank:t(`rank.${rank.index}`)}):''].filter(Boolean).join(' · ');
 const units=state.units.filter(u=>u.side==='player'&&u.location.zone==='board');
 const mvpBody=mvp?`<figure class="visual-mvp-hero"><div class="visual-mvp-portrait"><span class="visual-mvp-crown" aria-hidden="true">${sceneSticker('ui_mvp_crown','',48)}</span>${unitSticker(mvp.kind,104)}<span class="visual-mvp-level">Lv.${mvp.level}</span></div><figcaption><b>MVP</b><strong>${tr(`${HEROES[mvp.kind]?'hero':'unit'}.${mvp.kind}`)}</strong></figcaption></figure><dl class="visual-medals"><div class="visual-medal visual-damage"><dt>${sceneSticker('ui_stat_damage_burst','',52)}<span>${tr('p13.damage')}</span></dt><dd>${count(mvp.damage)}</dd></div><div class="visual-medal visual-kills"><dt>${sceneSticker('ui_stat_ko_skull','',52)}<span>${tr('p13.kills')}</span></dt><dd>×${count(mvp.kills)}</dd></div></dl>`:`<div class="visual-team-photo"><div class="lineup-stickers">${units.slice(0,8).map(u=>unitSticker(u.kind,48)).join('')||sceneSticker('ui_tutorial_capy','',104)}</div><p>${tr('p6.noMvp')}</p><span>${tr('p6.lineup',{count:units.length})}</span></div>`;
 const treasure=(picture:string,quantity:string,label:string)=>`<figure class="visual-treasure-item" title="${label}"><span class="visual-treasure-art" aria-hidden="true">${picture}</span><figcaption><b>${quantity}</b><span class="settlement-sr-only">${label}</span></figcaption></figure>`;
 const fragments=new Map<string,number>();for(const id of loot)fragments.set(id,(fragments.get(id)??0)+1);
 const treasureItems=treasure(sceneSticker('ui_coin_gold','',64),`+${count(coins)}`,tr('profile.coins'))+(won?treasure(sceneSticker('ui_ticket_gacha','',60),'+1',tr('p5.tickets')):'')+[...fragments].map(([id,quantity])=>treasure(WEAPONS[id]?weaponSticker(id,60):sceneSticker('ui_merge_sparkle','',60),`×${quantity}`,tr(`fragment.${id}`))).join('');
 const newFriend=(picture:string,label:string)=>`<figure class="visual-new-friend" title="${label}">${picture}<span aria-hidden="true">NEW!</span><figcaption class="settlement-sr-only">${label}</figcaption></figure>`;
 const newFriends=[...(won&&newRoster?[...newRoster.units,...newRoster.heroes].map(id=>newFriend(unitSticker(id,56),tr(`${HEROES[id]?'hero':'unit'}.${id}`))):[]),...newWeapons.map(id=>newFriend(weaponSticker(id,56),tr(`weapon.${id}`))),...newAvatars.map(id=>newFriend(avatarSticker(id,56),tr(`avatar.${id}`)))];
 const unlocks=newFriends.length?`<div class="visual-unlock-ribbon" role="status" aria-label="${tr('p6.unlock')}"><span class="visual-unlock-chest" aria-hidden="true">${sceneSticker('ui_unlock_chest','',76)}</span><div class="visual-unlock-friends">${newFriends.join('')}</div></div>`:'';
 const unlockPictures=[...(won&&newRoster?[...newRoster.units,...newRoster.heroes].map(id=>unitSticker(id,28)):[]),...newWeapons.map(id=>weaponSticker(id,28)),...newAvatars.map(id=>avatarSticker(id,28))];
 const unlockHint=unlockPictures.length?`<button type="button" class="crest-unlock-hint" data-action="toggle-result-stats" aria-controls="result-stats" aria-expanded="${statsOpen}" aria-label="${tr('p12.unlockDetails')}"><span>✦ ${tr('p12.newUnlocks')}</span><span class="crest-unlock-pictures" aria-hidden="true">${unlockPictures.slice(0,3).join('')}</span>${unlockPictures.length>3?`<b>+${unlockPictures.length-3}</b>`:''}</button>`:'';
 const starArc=Array.from({length:3},(_,index)=>`<span class="crest-star ${index<guardianStars?'is-lit':'is-dim'}" style="--star-delay:${(index+1)*.12}s" aria-hidden="true">${sceneSticker(index<guardianStars?'ui_victory_star_lit':'ui_victory_star_dim','',96)}</span>`).join('');
 const saveRetry=savedResult?'':`<div class="crest-save-retry" role="status"${statsOpen?' inert':''}><p>${tr('p13.savePending')}</p><button type="button" data-action="retry-save-result" autofocus>${tr('p13.retrySave')}</button></div>`;
 return `<div class="ledger-shell result-shell ${won?'result-win':'result-loss'}${endless?' result-endless':''}${statsOpen?' is-stats-open':''}${savedResult?'':' has-save-pending'}">
  <button type="button" class="crest-return-btn" data-action="menu" aria-label="${tr('p12.return')}"${savedResult?'':' disabled'}${statsOpen?' inert':''}><span aria-hidden="true">${sceneSticker('ui_btn_return_arrow','',54)}</span></button>
  <div class="crest-stage"${statsOpen?' inert':''}>
   <div class="crest-stars-arc" role="img" aria-label="${tr('p12.guardianStars',{count:guardianStars})}">${starArc}</div>
   <div class="crest-emblem-art" aria-hidden="true">${sceneSticker(won?'ui_victory_shield_wings':'ui_defeat_shield_wings','',520)}</div>
   <h2 id="dialog-title" class="crest-ribbon-title ${won?'result-win-header':'result-loss-header'}"><svg class="crest-ribbon-svg" viewBox="0 0 380 100" focusable="false"><defs><path id="crest-ribbon-curve" d="M 26,74 Q 190,34 354,74" fill="none"/></defs><text><textPath href="#crest-ribbon-curve" startOffset="50%" text-anchor="middle">${tr(endless?'p13.endlessVictory':won?'p13.victory':'p12.defeat')}</textPath></text></svg></h2>
   <div class="crest-plaque-body">
    <div class="crest-rank-line"><span class="crest-rank-name">${tr(`rank.${rank.index}`)}</span><span class="crest-rank-delta"${endless?` title="${tr('p13.rankBanked')}"`:''}>${protection?tr('p13.starProtected'):`${stars}★`}${protection?`<span class="crest-rank-badge" title="${protection}" aria-label="${protection}">♢</span>`:streak?`<span class="crest-rank-badge" title="${streak}" aria-label="${streak}">✦</span>`:''}</span></div>
    <div class="crest-exp-bar" role="progressbar" aria-label="${progressLabel}" aria-valuemin="0" aria-valuemax="${progressMax}" aria-valuenow="${progress}" style="--rank-progress:${progress/progressMax*100}%"><span></span></div>
    ${endless?`<p class="crest-endless-record">${tr('p13.endlessRecord',{wave:endlessWave,best:bestEndlessWave})}</p>`:''}
    <div class="crest-core-rewards"><span class="crest-coin" aria-label="${tr('profile.coins')} +${coins}">${sceneSticker('ui_coin_gold','',40)}<b>+${count(coins)}</b></span>${won?`<span class="crest-bonus" title="${tr('p5.tickets')}" aria-label="${tr('p5.tickets')} +1">${sceneSticker('ui_ticket_gacha','',26)}<b>+1</b></span>`:''}${loot.length?`<span class="crest-bonus" title="${tr('profile.fragments')}" aria-label="${tr('profile.fragments')} +${loot.length}">${sceneSticker('ui_merge_sparkle','',24)}<b>+${loot.length}</b></span>`:''}</div>
   </div>${savedResult?unlockHint:''}
  </div>
  ${saveRetry}
  <footer class="settlement-actions crest-corner-actions"${statsOpen?' inert':''}><button type="button" class="crest-corner-btn btn-stats" data-action="toggle-result-stats" aria-controls="result-stats" aria-expanded="${statsOpen}"><span aria-hidden="true">${sceneSticker('ui_stats_scroll','',36)}</span><span>${tr('p12.stats')}</span></button><button type="button" class="crest-corner-btn btn-continue" data-action="start"${savedResult?' autofocus':' disabled'}><span aria-hidden="true">${sceneSticker('ui_horn_continue','',40)}</span><span>${tr(won?'p12.continue':'p12.retry')}</span></button></footer>
  <aside id="result-stats" class="crest-stats-drawer" role="region" aria-labelledby="result-stats-title"${statsOpen?'':' hidden'}>
   <header class="crest-drawer-header"><h3 id="result-stats-title">${sceneSticker('ui_stats_scroll','',38)}${tr('p12.report')}</h3><div class="compendium-toolbar"><button type="button" class="crest-stats-close" data-action="close-result-stats" aria-label="${tr('p12.closeStats')}">×</button></div></header>
   <div class="ledger-body crest-report-body" tabindex="0"><div class="visual-report-scroll"><p class="settlement-sr-only">${tr(won?'result.winSub':'result.lossSub')} ${tr('m3.stars',{count:profile.stars})} ${rankNotes}</p><article class="visual-mvp-stage" aria-label="${tr('p6.mvp')}">${mvpBody}</article><section class="visual-treasure-shelf" aria-label="${tr('p13.treasureShelf')}"><div class="visual-treasure-items">${treasureItems}</div>${unlocks}</section><footer class="visual-footprint-strip" aria-label="${tr('p13.runFootprints')}"><span class="visual-map-print">${sceneSticker('ui_map_sign','',32)}<b>${tr(`map.${state.mapId}`)}</b></span><span>${sceneSticker(endless?'ui_endless_emblem':'ui_wave_horn','',30)}<b>${tr(endless?'p13.endlessWave':'p13.reportWave',{wave:endless?endlessWave:state.wave})}</b></span><span aria-label="${tr('p13.guardTime',{time:reportClock(result.elapsed)})}"><i aria-hidden="true">⏱</i><b>${reportClock(result.elapsed)}</b></span><span aria-label="${tr('p12.pauseOranges',{count:state.sides.player.oranges})}">${sceneSticker('orange','',30)}<b>×${state.sides.player.oranges}</b></span></footer></div><p class="save-note">${tr(savedResult?endless?'p13.endlessAwarded':'result.awarded':'p13.savePending')}</p>${savedResult?'':`<button type="button" class="report-save-retry" data-action="retry-save-result">${tr('p13.retrySave')}</button>`}${won?'':`<p class="result-reason">${tr(`result.reason.${result.reason}`)}</p>`}</div>
  </aside>
 </div>`;
}
