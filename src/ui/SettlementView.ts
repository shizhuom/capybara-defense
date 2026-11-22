import type {BattleState,Profile} from '../core/types';
import {getRank,RANKS} from '../config/ranks';
import {HEROES} from '../config/heroes';
import {WEAPONS} from '../config/weapons';
import {t} from '../i18n/i18n';
import {weaponSticker,avatarSticker} from '../render/M3Art';
import {heroSticker,sceneSticker,unitSticker} from './stickers';
import {formatCompactNumber} from '../core/formatNumber';
import {STANDARD_VICTORY_CRESTS} from '../config/medallions';
import {escapeHtml as esc} from './art';
import {INGREDIENT_IDS,isIngredientId,type IngredientId} from '../config/kitchen';
import {VILLAGE_RESOURCE_IDS,type VillageResourceId} from '../config/village';
import {computeNextGoalHook,type NextGoalHook} from '../core/FeatureUnlocks';
const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const reportClock=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const count=(value:number)=>Math.round(value).toLocaleString('en-US');
export function lootMarkup(loot:readonly string[]):string {
 if(!loot.length)return `<p class="loot-empty">${tr('loot.none')}</p>`;
 const counts=new Map<string,number>();for(const id of loot)counts.set(id,(counts.get(id)??0)+1);
 return `<ul class="loot-list loot-tray">${[...counts].map(([id,count])=>`<li>${WEAPONS[id]?weaponSticker(id,44):sceneSticker('ui_weapon_fragment','',44)}<span>${tr(`fragment.${id}`)}</span><b>×${count}</b></li>`).join('')}</ul>`;
}
/** Ingredient counts in catalog order; unknown ids are ignored. */
export function ingredientCounts(ids:readonly string[]|undefined):[IngredientId,number][] {
 const counts=new Map<IngredientId,number>();for(const id of ids??[])if(isIngredientId(id))counts.set(id,(counts.get(id)??0)+1);
 return INGREDIENT_IDS.filter(id=>counts.has(id)).map(id=>[id,counts.get(id)!]);
}
export function ingredientLootMarkup(ids:readonly string[]|undefined):string {
 const counts=ingredientCounts(ids);
 return counts.length?`<ul class="loot-list loot-tray ingredient-tray">${counts.map(([id,count])=>`<li>${sceneSticker(id,'',44)}<span>${tr(`ingredient.${id}`)}</span><b>×${count}</b></li>`).join('')}</ul>`:'';
}
/** Village materials in a fixed order (wood, essence) with counts. */
export function villageMaterialCounts(ids:readonly string[]|undefined):[VillageResourceId,number][] {
 return VILLAGE_RESOURCE_IDS.map(id=>[id,(ids??[]).filter(item=>item===id).length] as [VillageResourceId,number]).filter(([,n])=>n>0);
}
export function villageLootMarkup(ids:readonly string[]|undefined):string {
 const counts=villageMaterialCounts(ids);
 return counts.length?`<ul class="loot-list loot-tray village-tray">${counts.map(([id,count])=>`<li>${sceneSticker(id,'',44)}<span>${tr(id==='res_onsen_wood'?'p16.wood':'p16.essence')}</span><b>×${count}</b></li>`).join('')}</ul>`:'';
}
export function pauseMarkup(state:BattleState):string {
 const fragments=state.sides.player.loot;
 const crestsSoFar=(state.endless?(state.standardResult?.endlessCrests??0):0)+(state.sides.player.endlessCrests??0);
 return `<div class="ledger-shell pause-shell">
  <header class="ledger-header pause-header"><div class="ledger-mascot" aria-hidden="true">${sceneSticker('ui_pause_peek_capy','',78)}</div><div class="ledger-heading"><h2 id="dialog-title">${tr('p12.pauseTitle')}</h2></div><div class="compendium-toolbar"><button type="button" class="ledger-close dialog-close" data-action="resume" aria-label="${tr('p12.resume')}">×</button></div></header>
  <div class="ledger-body pause-storybook-board" tabindex="0">
   <article class="pause-status-strip"><div class="storybook-frame" aria-hidden="true">${sceneSticker('ui_map_sign','',58)}</div><div class="pause-status-copy"><h3>${tr(`map.${state.mapId}`)}</h3><p><span>${tr(state.endless?'p13.endlessWave':'p12.pauseWave',{wave:state.wave})}</span><span>${tr('p12.pauseTime',{time:clock(state.time)})}</span><span>${tr('p12.pauseOranges',{count:state.sides.player.oranges})}</span></p></div></article>
   <section><h3 class="pause-section-head">${sceneSticker('ui_weapon_fragment','',26)}${tr('p12.pauseLoot')}</h3>${fragments.length?lootMarkup(fragments):`<p class="loot-empty">${tr('p12.pauseEmpty')}</p>`}</section>
   ${state.endless||crestsSoFar>0?`<section class="pause-ingredients pause-crests"><h3>${sceneSticker('ui_endless_crest','',28)}${tr('p17.pauseCrests')}</h3><ul class="loot-list loot-tray crest-tray"><li>${sceneSticker('ui_endless_crest','',40)}<span>${tr('p17.crests')}</span><b>×${crestsSoFar}</b></li></ul></section>`:''}
   ${state.sides.player.villageLoot?.length?`<section class="pause-ingredients pause-materials"><h3>${sceneSticker('ui_village_gate','',30)}${tr('p16.pauseMaterials')}</h3>${villageLootMarkup(state.sides.player.villageLoot)}</section>`:''}
   ${state.sides.player.ingredientLoot?.length?`<section class="pause-ingredients"><h3>${sceneSticker('ui_kitchen_pot','',30)}${tr('p14.pauseIngredients')}</h3>${ingredientLootMarkup(state.sides.player.ingredientLoot)}</section>`:''}
  </div>
  <footer class="settlement-actions pause-actions pause-storybook-actions"><button type="button" class="button button-teal" data-action="resume" autofocus><span aria-hidden="true">▶</span> ${tr('p12.resume')}</button><div><button type="button" data-action="profile">${tr('p12.profile')}</button><button type="button" data-action="settings">${tr('p12.settings')}</button><button type="button" class="surrender-button" data-action="surrender">${state.endless?`${sceneSticker('ui_endless_emblem','',20)} `:''}${tr(state.endless?'p13.settleEndless':'p12.surrender')}</button></div></footer>
 </div>`;
}
export function endlessOfferMarkup(state:BattleState,savedResult:boolean,firstUnlock=false,ticketAwarded=false,showCrests=true):string {
 const result=state.standardResult??state.result;
 const crests=showCrests?(result?.endlessCrests??STANDARD_VICTORY_CRESTS):0;
 return `<div class="endless-offer-shell">
  <div class="endless-offer-emblem" aria-hidden="true">${sceneSticker('ui_endless_emblem','',148)}</div>
  ${firstUnlock?`<span class="endless-first-unlock-pill">${tr('p19.onboard.endless.badge')}</span>`:''}
  <h2 id="dialog-title">${tr('p13.endlessOfferTitle')}</h2>
  ${savedResult?`<p class="endless-banked-note" role="status"><span aria-hidden="true">✓</span> ${tr('p13.endlessBanked')}</p>`:`<div class="endless-save-pending" role="status"><p>${tr('p13.savePending')}</p><button type="button" data-action="retry-save-result" autofocus>${tr('p13.retrySave')}</button></div>`}
  <div class="endless-offer-story"><p>${tr('p13.endlessOfferBody')}</p><div class="endless-growth" role="img" aria-label="${tr('p13.endlessScaling')}"><span aria-hidden="true">×1.25 <i>→</i> ×1.56 <i>→</i> ×1.95 <i>→</i> …</span></div></div>
  ${savedResult?`<div class="endless-offer-rewards" aria-label="${tr('p13.treasureShelf')}"><span>${sceneSticker('ui_star_rank','',28)}<b>${tr('p13.rankBanked')}</b></span><span>${sceneSticker('ui_coin_gold','',32)}<b>+${result?.coins??0}</b></span>${ticketAwarded?`<span>${sceneSticker('ui_ticket_gacha','',30)}<b>+1</b></span>`:''}${crests?`<span class="endless-offer-crest" title="${tr('p17.crests')}">${sceneSticker('ui_endless_crest','',30)}<b>+${crests}</b></span>`:''}</div>`:''}
  <footer class="endless-offer-actions"><button type="button" class="endless-decline" data-action="decline-endless"><span aria-hidden="true">${sceneSticker('ui_trophy_rank','',22)}</span> ${tr('p13.declineEndless')}</button><button type="button" class="endless-enter" data-action="enter-endless"${savedResult?' autofocus':' disabled'}><span aria-hidden="true">${sceneSticker('ui_endless_emblem','',24)}</span> ${tr('p13.enterEndless')}</button></footer>
 </div>`;
}
export interface ResultViewInput {state:BattleState;profile:Profile;savedResult:boolean;resultStars:number;previousRank:number;newWeapons:readonly string[];newAvatars:readonly string[];newRoster?:{units:readonly string[];heroes:readonly string[]};statsOpen?:boolean;
  /** P17: the player's exact global endless rank once the run has synced. */
  globalRank?:number;
  /** P19: whether this win completed the 3-win free gacha meter. */
  ticketAwarded?:boolean}
function nextGoalHookMarkup(hook:NextGoalHook|null):string {
 if(!hook)return '';
 let text='';
 if(hook.kind==='feature'){
  const name=t(`p19.feature.${hook.id}`);
  text=hook.target===1&&hook.current===0?tr('p19.hook.featureMatch',{name}):tr('p19.hook.featureStars',{name,need:Math.max(1,hook.target-hook.current),current:hook.current,target:hook.target});
 }else if(hook.kind==='gacha_ticket'){
  text=tr('p19.hook.gacha');
 }else if(hook.kind==='weapon'){
  text=tr('p19.hook.weapon',{name:t(`weapon.${hook.id}`),need:Math.max(1,hook.target-hook.current),current:hook.current,target:hook.target});
 }else if(hook.kind==='village'){
  text=tr('p19.hook.village',{name:t(`facility.${hook.id}`),pct:hook.percent});
 }else{
  text=tr('p19.hook.kitchen',{name:t(`broth.${hook.id}`),pct:hook.percent});
 }
 return `<div class="crest-next-hook" role="status"><span class="crest-next-hook-text">${text}</span><span class="crest-next-hook-bar" aria-hidden="true"><i style="width:${Math.max(6,Math.min(100,hook.percent))}%"></i></span></div>`;
}
/** Crests this whole run banked: the standard victory's 3 plus every endless wave's share. */
export function resultCrests(state:BattleState):number {
 const result=state.result;if(!result)return 0;
 return result.endless&&state.standardResult?(state.standardResult.endlessCrests??0)+(result.endlessCrests??0):result.endlessCrests??0;
}
export function resultMarkup({state,profile,savedResult,resultStars,previousRank,newWeapons,newAvatars,newRoster,statsOpen=false,globalRank,ticketAwarded=false}:ResultViewInput):string {
 const result=state.result!;if(!result)return '';
 const endless=Boolean(result.endless),won=endless||result.winner==='player',rank=getRank(profile.stars),mvp=result.mvp;
 const coins=won?(endless&&state.standardResult?state.standardResult.coins+(result.endlessCoins??0):result.coins):0;
 const loot=won?(endless&&state.standardResult?[...state.standardResult.loot,...(result.endlessLoot??[])]:result.loot):[];
 const endlessWave=result.endlessWave??state.wave,bestEndlessWave=Math.max(endlessWave,profile.bestEndlessWave??0);
 const stars=`${resultStars>0?'+':''}${resultStars}`,crests=won?resultCrests(state):0;
 const guardianStars=endless?3:won?Math.min(3,Math.max(1,Math.floor(state.sides.player.oranges))):0;
 const nextRank=RANKS[rank.index+1],progressMax=nextRank?nextRank.minStars-rank.minStars:1;
 const progress=nextRank?Math.min(progressMax,Math.max(0,profile.stars-rank.minStars)):1;
 const progressLabel=tr(nextRank?'p12.rankProgress':'p12.maxRank',{current:progress,total:progressMax});
 const protection=savedResult&&!won&&resultStars===0?tr(previousRank<10?'m3.protected':'m3.floorProtected'):'';
 const streak=won&&resultStars>1?tr('m3.streakBonus'):'';
 const rankNotes=[protection,streak,rank.index>previousRank?tr('m3.promotion',{rank:t(`rank.${rank.index}`)}):''].filter(Boolean).join(' · ');
 const units=state.units.filter(u=>u.side==='player'&&u.location.zone==='board');
 // P15: pictures carry the meaning; the full sentence stays in title/aria-label for assistive technology.
 const delta=protection
  ?`<span class="crest-rank-delta is-protected" title="${protection}" aria-label="${protection} 0★">${sceneSticker('ui_rank_protect_shield','',28)}<b aria-hidden="true">0★</b></span>`
  :streak?`<span class="crest-rank-delta is-streak" title="${streak}" aria-label="${streak} ${stars}★">${sceneSticker('ui_streak_flame','',28)}<b aria-hidden="true">${stars}★</b></span>`
  :`<span class="crest-rank-delta"${endless?` title="${tr('p13.rankBanked')}"`:''}><b>${stars}★</b></span>`;
 const fragments=new Map<string,number>();for(const id of loot)fragments.set(id,(fragments.get(id)??0)+1);
 // Defeat salvage still reaches the shelf; endless results list every ingredient from the whole run.
 const ingredients=ingredientCounts(result.ingredientLoot),ingredientTotal=ingredients.reduce((sum,[,n])=>sum+n,0);
 const reward=(cls:string,picture:string,value:string,label:string)=>`<span class="crest-reward ${cls}" title="${label}" aria-label="${label} ${value}">${picture}<b aria-hidden="true">${value}</b></span>`;
 const showTicket=won&&ticketAwarded;
 const coreRewards=reward('crest-coin',sceneSticker('ui_coin_gold','',62),`+${count(coins)}`,tr('profile.coins'))
  +(showTicket?reward('crest-bonus crest-ticket',sceneSticker('ui_ticket_gacha','',56),'+1',tr('p5.tickets')):'')
  +(crests?reward('crest-bonus crest-crests',sceneSticker('ui_endless_crest','',56),`+${crests}`,tr('p17.crests')):'')
  +(loot.length?reward('crest-bonus crest-fragments',sceneSticker('ui_weapon_fragment','',56),`+${loot.length}`,tr('profile.fragments')):'')
  +(ingredientTotal?reward('crest-bonus crest-ingredients',ingredients.length===1?sceneSticker(ingredients[0][0],'',56):sceneSticker('ui_kitchen_pot','',56),`+${ingredientTotal}`,tr('p14.resultIngredients')):'');
 const nextHook=savedResult?nextGoalHookMarkup(computeNextGoalHook(profile)):'';
 const endlessFull=tr('p13.endlessRecord',{wave:endlessWave,best:bestEndlessWave});
 const rankBadge=endless&&globalRank&&globalRank>0?`<span class="crest-global-rank" role="status">${tr('p17.globalRank',{rank:globalRank})}</span>`:'';
 const endlessCapsule=endless?`<p class="crest-endless-record" title="${endlessFull}"><span class="crest-endless-capsule" aria-hidden="true">${sceneSticker('ui_endless_emblem','',24)}<b>${tr('p15.endlessCapsule',{wave:endlessWave,best:bestEndlessWave})}</b></span><span class="settlement-sr-only">${endlessFull}</span>${rankBadge}</p>`:'';
 const medal=(cls:string,icon:string,label:string,value:string)=>`<div class="visual-medal ${cls}"><dt>${sceneSticker(icon as 'ui_stat_damage_burst','',64)}<span class="settlement-sr-only">${label}</span></dt><dd>${value}</dd></div>`;
 const mvpBody=mvp?`<figure class="visual-mvp-hero"><div class="visual-mvp-portrait"><span class="visual-mvp-crown" aria-hidden="true">${sceneSticker('ui_mvp_crown','',48)}</span>${heroSticker(mvp.kind,116,mvp.awakened===true)}<span class="visual-mvp-level">Lv.${mvp.level}${mvp.awakened?' ★':''}</span></div><figcaption><b>MVP</b><strong>${tr(`${HEROES[mvp.kind]?'hero':'unit'}.${mvp.kind}`)}</strong></figcaption></figure><dl class="visual-medals">${medal('visual-damage','ui_stat_damage_burst',tr('p13.damage'),formatCompactNumber(mvp.damage))}${medal('visual-kills','ui_stat_ko_skull',tr('p13.kills'),`×${count(mvp.kills)}`)}</dl>`:`<div class="visual-team-photo"><div class="lineup-stickers">${units.slice(0,8).map(u=>u.awakened?heroSticker(u.kind,52,true):unitSticker(u.kind,52)).join('')||sceneSticker('ui_tutorial_capy','',104)}</div><p>${tr('p6.noMvp')}</p><span>${tr('p6.lineup',{count:units.length})}</span></div>`;
 const treasure=(picture:string,quantity:string,label:string,extra='')=>`<figure class="visual-treasure-item${extra}" title="${label}"><span class="visual-treasure-art" aria-hidden="true">${picture}</span><figcaption><b>${quantity}</b><span class="settlement-sr-only">${label}</span></figcaption></figure>`;
 const treasureItems=treasure(sceneSticker('ui_coin_gold','',72),`+${count(coins)}`,tr('profile.coins'))+(showTicket?treasure(sceneSticker('ui_ticket_gacha','',72),'+1',tr('p5.tickets')):'')
  +[...fragments].map(([id,quantity])=>treasure(WEAPONS[id]?weaponSticker(id,72):sceneSticker('ui_weapon_fragment','',72),`×${quantity}`,tr(`fragment.${id}`))).join('')
  +ingredients.map(([id,quantity])=>treasure(sceneSticker(id,'',72),`×${quantity}`,`${tr(`ingredient.${id}`)} ×${quantity}`,' is-ingredient')).join('')
  +villageMaterialCounts(result.villageLoot).map(([id,quantity])=>treasure(sceneSticker(id,'',72),`×${quantity}`,`${tr(id==='res_onsen_wood'?'p16.wood':'p16.essence')} ×${quantity}`,' is-material')).join('')
  +(crests?treasure(sceneSticker('ui_endless_crest','',72),`×${crests}`,tr('p17.resultCrests',{count:crests}),' is-crest'):'');
 const salvage=ingredientTotal&&!won?`<p class="ingredient-salvage-note">${sceneSticker('ui_kitchen_pot','',28)}<span>${tr('p14.salvageNote')}</span></p>`:'';
 const newFriend=(picture:string,label:string)=>`<figure class="visual-new-friend" title="${label}">${picture}<span aria-hidden="true">NEW!</span><figcaption class="settlement-sr-only">${label}</figcaption></figure>`;
 const newFriends=[...(won&&newRoster?[...newRoster.units,...newRoster.heroes].map(id=>newFriend(unitSticker(id,60),tr(`${HEROES[id]?'hero':'unit'}.${id}`))):[]),...newWeapons.map(id=>newFriend(weaponSticker(id,60),tr(`weapon.${id}`))),...newAvatars.map(id=>newFriend(avatarSticker(id,60),tr(`avatar.${id}`)))];
 const unlocks=newFriends.length?`<div class="visual-unlock-ribbon" role="status" aria-label="${tr('p6.unlock')}"><span class="visual-unlock-chest" aria-hidden="true">${sceneSticker('ui_unlock_chest','',76)}</span><div class="visual-unlock-friends">${newFriends.join('')}</div></div>`:'';
 const unlockPictures=[...(won&&newRoster?[...newRoster.units,...newRoster.heroes].map(id=>unitSticker(id,28)):[]),...newWeapons.map(id=>weaponSticker(id,28)),...newAvatars.map(id=>avatarSticker(id,28))];
 const unlockHint=unlockPictures.length?`<button type="button" class="crest-unlock-hint" data-action="toggle-result-stats" aria-controls="result-stats" aria-expanded="${statsOpen}" aria-label="${tr('p12.unlockDetails')}"><span>✦ ${tr('p12.newUnlocks')}</span><span class="crest-unlock-pictures" aria-hidden="true">${unlockPictures.slice(0,3).join('')}</span>${unlockPictures.length>3?`<b>+${unlockPictures.length-3}</b>`:''}</button>`:'';
 const starArc=Array.from({length:3},(_,index)=>`<span class="crest-star ${index<guardianStars?'is-lit':'is-dim'}" style="--star-delay:${(index+1)*.12}s" aria-hidden="true">${sceneSticker(index<guardianStars?'ui_victory_star_lit':'ui_victory_star_dim','',96)}</span>`).join('');
 const saveRetry=savedResult?'':`<div class="crest-save-retry" role="status"${statsOpen?' inert':''}><p>${tr('p13.savePending')}</p><button type="button" data-action="retry-save-result" autofocus>${tr('p13.retrySave')}</button></div>`;
 const savedKey=endless?'p13.endlessAwarded':'result.awarded';
 const saveState=savedResult?`<p class="save-note save-check" role="status" title="${tr(savedKey)}"><span aria-hidden="true">✓</span><span class="settlement-sr-only">${tr(savedKey)}</span></p>`:`<p class="save-note">${tr('p13.savePending')}</p><button type="button" class="report-save-retry" data-action="retry-save-result">${tr('p13.retrySave')}</button>`;
 return `<div class="ledger-shell result-shell ${won?'result-win':'result-loss'}${endless?' result-endless':''}${statsOpen?' is-stats-open':''}${savedResult?'':' has-save-pending'}">
  <button type="button" class="crest-return-btn" data-action="menu" aria-label="${tr('p12.return')}"${savedResult?'':' disabled'}${statsOpen?' inert':''}><span aria-hidden="true">${sceneSticker('ui_btn_return_arrow','',54)}</span></button>
  <div class="crest-stage"${statsOpen?' inert':''}>
   <div class="crest-stars-arc" role="img" aria-label="${tr('p12.guardianStars',{count:guardianStars})}">${starArc}</div>
   <div class="crest-emblem-art" aria-hidden="true">${sceneSticker(won?'ui_victory_shield_wings':'ui_defeat_shield_wings','',520)}</div>
   <h2 id="dialog-title" class="crest-ribbon-title ${won?'result-win-header':'result-loss-header'}"><svg class="crest-ribbon-svg" viewBox="0 0 380 100" focusable="false"><defs><path id="crest-ribbon-curve" d="M 26,74 Q 190,34 354,74" fill="none"/></defs><text><textPath href="#crest-ribbon-curve" startOffset="50%" text-anchor="middle">${tr(endless?'p13.endlessVictory':won?'p13.victory':'p12.defeat')}</textPath></text></svg></h2>
   <div class="crest-plaque-body">
    <div class="crest-rank-block">
     <div class="crest-rank-line"><span class="crest-rank-name">${tr(`rank.${rank.index}`)}</span>${delta}</div>
     <div class="crest-exp-bar" role="progressbar" aria-label="${progressLabel}" aria-valuemin="0" aria-valuemax="${progressMax}" aria-valuenow="${progress}" style="--rank-progress:${progress/progressMax*100}%"><span></span></div>
     <b class="crest-exp-count" aria-hidden="true">${nextRank?tr('p15.rankProgress',{current:progress,total:progressMax}):tr('p15.maxRank')}</b>
     ${endlessCapsule}
    </div>
    <div class="crest-core-rewards">${coreRewards}</div>
    ${nextHook}
   </div>${savedResult?unlockHint:''}
  </div>
  ${saveRetry}
  <footer class="settlement-actions crest-corner-actions"${statsOpen?' inert':''}><button type="button" class="crest-corner-btn btn-stats" data-action="toggle-result-stats" aria-controls="result-stats" aria-expanded="${statsOpen}"><span aria-hidden="true">${sceneSticker('ui_stats_scroll','',44)}</span><span>${tr('p15.report')}</span></button><button type="button" class="crest-corner-btn btn-continue" data-action="start"${savedResult?' autofocus':' disabled'}><span aria-hidden="true">${sceneSticker('ui_horn_continue','',46)}</span><span>${tr(won?'p15.continue':'p15.again')}</span></button></footer>
  <aside id="result-stats" class="crest-stats-drawer" role="region" aria-labelledby="result-stats-title"${statsOpen?'':' hidden'}>
   <header class="crest-drawer-header"><h3 id="result-stats-title">${sceneSticker('ui_stats_scroll','',38)}${tr('p12.report')}</h3><div class="compendium-toolbar"><button type="button" class="crest-stats-close" data-action="close-result-stats" aria-label="${tr('p12.closeStats')}">×</button></div></header>
   <div class="ledger-body crest-report-body" tabindex="0"><div class="visual-report-scroll"><p class="settlement-sr-only">${tr(won?'result.winSub':'result.lossSub')} ${tr('m3.stars',{count:profile.stars})} ${rankNotes}</p><article class="visual-mvp-stage" aria-label="${tr('p6.mvp')}">${mvpBody}</article><section class="visual-treasure-shelf" aria-label="${tr('p13.treasureShelf')}"><div class="visual-treasure-items">${treasureItems}</div>${salvage}${unlocks}</section><footer class="visual-footprint-strip" aria-label="${tr('p13.runFootprints')}"><span class="visual-map-print">${sceneSticker('ui_map_sign','',34)}<b>${tr(`map.${state.mapId}`)}</b></span><span>${sceneSticker(endless?'ui_endless_emblem':'ui_wave_horn','',34)}<b>${tr(endless?'p17.board.wave':'p13.reportWave',{wave:endless?endlessWave:state.wave})}</b></span><span aria-label="${tr('p13.guardTime',{time:reportClock(result.elapsed)})}">${sceneSticker('ui_clock_sand','',34)}<b>${reportClock(result.elapsed)}</b></span><span aria-label="${tr('p12.pauseOranges',{count:state.sides.player.oranges})}">${sceneSticker('orange','',34)}<b>×${state.sides.player.oranges}</b></span></footer></div>${saveState}${won?'':`<p class="result-reason">${tr(`result.reason.${result.reason}`)}</p>`}</div>
  </aside>
 </div>`;
}
