import type {BattleState} from '../core/types';
import {PROPS} from '../config/props';
import {t} from '../i18n/i18n';
import {escapeHtml as esc} from './art';
import {propSticker,sceneSticker} from './stickers';
import {getActiveBroth} from '../config/kitchen';
import {brothEffectText,kitchenAuraText} from './KitchenScreen';

/** Today's soak sits atop the passive rail. In Wave 1 preparation an empty slot opens the kitchen. */
export function brothRailMarkup(state:BattleState,preparation:boolean,expanded=false):string {
 const loadout=state.sides.player.loadout,active=getActiveBroth(loadout);
 if(!active)return preparation&&(loadout.unlockedBroths?.length??0)>0?`<button type="button" class="broth-rail-pill broth-empty" data-action="kitchen" aria-label="${esc(t('p14.railPick'))}" title="${esc(t('p14.railPick'))}"><span aria-hidden="true">${sceneSticker('ui_kitchen_pot','',30)}</span><small>+</small></button>`:'';
 const {def,level}=active,name=t(`broth.${def.id}`),effect=brothEffectText(def.id,level);
 return `<button type="button" class="broth-rail-pill ${expanded?'is-expanded':''}" data-action="broth-info" data-broth-id="${def.id}" style="--broth-color:${def.bathColor}" aria-expanded="${expanded}" aria-label="${esc(t('p14.railTitle'))}: ${esc(name)} Lv.${level}. ${esc(effect)}" title="${esc(name)} Lv.${level}: ${esc(effect)}"><span aria-hidden="true">${sceneSticker(def.id,'',36)}</span><small>Lv.${level}</small><span class="passive-tooltip broth-tooltip" role="tooltip"><em>${esc(t('p14.railTitle'))}</em><strong>${esc(name)} · Lv.${level}</strong><span>${esc(effect)}</span><span class="broth-tooltip-live">${esc(t('p14.railLive'))} · ${esc(kitchenAuraText(loadout))}</span></span></button>`;
}

export const nextBattleSpeed=(speed:1|2|3):1|2|3=>speed===3?1:speed===2?3:2;
export function p13WaveMarkup(state:BattleState):string {
 return `<span aria-hidden="true">${sceneSticker('ui_endless_emblem','',28)}</span><span>${esc(t('p17.board.wave',{wave:state.wave}))}</span>`;
}
export function earlyWaveCoachmarkMarkup(food:number):string {
 return `<div class="early-tip-bubble" role="note" aria-labelledby="early-tip-title"><div class="early-tip-heading"><span aria-hidden="true">${sceneSticker('ui_tutorial_capy','',52)}</span><strong id="early-tip-title">${esc(t('p13.earlyTitle'))}</strong></div><p>${esc(t('p13.earlyBody',{food}))}</p><div class="early-tip-actions"><button type="button" data-action="early-wave">${esc(t('p13.earlyNow',{food}))}</button><button type="button" data-action="dismiss-early-tip">${esc(t('p13.earlyDismiss'))}</button></div></div><span class="early-tip-pointer" aria-hidden="true">${sceneSticker('ui_tutorial_pointer','',42)}</span>`;
}

export function passiveRailMarkup(state:BattleState,preparation:boolean,expandedId?:string):string {
 const {loadout}=state.sides.player;
 const equipped=loadout.equippedPassiveProps.filter(id=>PROPS[id]?.type==='passive').slice(0,6);
 const ids:(string|undefined)[]=preparation?Array.from({length:6},(_,i)=>equipped[i]):equipped;
 return `${brothRailMarkup(state,preparation,expandedId==='broth')}<div class="passive-rail-heading" title="${esc(t('p13.passives'))}">${sceneSticker('ui_passive_aura_badge','',28)}<b>${esc(t('p13.passives'))}</b></div>${ids.map(id=>id?`<button type="button" class="passive-slot-pill ${expandedId===id?'is-expanded':''}" data-action="passive-info:${id}" aria-label="${esc(t(`prop.${id}`))}. ${esc(t(`prop.${id}.desc`))}" aria-expanded="${expandedId===id}" title="${esc(t(`prop.${id}`))}: ${esc(t(`prop.${id}.desc`))}"><span aria-hidden="true">${propSticker(id,36)}</span><small>Lv.${loadout.ownedProps[id]??1}</small><span class="passive-tooltip" role="tooltip"><strong>${esc(t(`prop.${id}`))}</strong><span>${esc(t(`prop.${id}.desc`))}</span></span></button>`:`<button type="button" class="passive-slot-pill passive-empty" data-action="passive-backpack" aria-label="${esc(t('p13.passiveEmpty'))}">+</button>`).join('')}${!ids.length?`<span class="passive-none">${esc(t('p13.noPassives'))}</span>`:''}`;
}
