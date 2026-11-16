import type {BattleState} from '../core/types';
import {PROPS} from '../config/props';
import {t} from '../i18n/i18n';
import {escapeHtml as esc} from './art';
import {propSticker,sceneSticker} from './stickers';

export const nextBattleSpeed=(speed:1|2|3):1|2|3=>speed===3?1:speed===2?3:2;
export function p13WaveMarkup(state:BattleState):string {
 return `<span aria-hidden="true">${sceneSticker('ui_endless_emblem','',28)}</span><span>${esc(t('p13.endlessWave',{wave:state.wave}))}</span>`;
}
export function earlyWaveCoachmarkMarkup(food:number):string {
 return `<div class="early-tip-bubble" role="note" aria-labelledby="early-tip-title"><div class="early-tip-heading"><span aria-hidden="true">${sceneSticker('ui_tutorial_capy','',52)}</span><strong id="early-tip-title">${esc(t('p13.earlyTitle'))}</strong></div><p>${esc(t('p13.earlyBody',{food}))}</p><div class="early-tip-actions"><button type="button" data-action="early-wave">${esc(t('p13.earlyNow',{food}))}</button><button type="button" data-action="dismiss-early-tip">${esc(t('p13.earlyDismiss'))}</button></div></div><span class="early-tip-pointer" aria-hidden="true">${sceneSticker('ui_tutorial_pointer','',42)}</span>`;
}

export function passiveRailMarkup(state:BattleState,preparation:boolean,expandedId?:string):string {
 const {loadout}=state.sides.player;
 const equipped=loadout.equippedPassiveProps.filter(id=>PROPS[id]?.type==='passive').slice(0,6);
 const ids:(string|undefined)[]=preparation?Array.from({length:6},(_,i)=>equipped[i]):equipped;
 return `<div class="passive-rail-heading" title="${esc(t('p13.passives'))}">${sceneSticker('ui_passive_aura_badge','',28)}<b>${esc(t('p13.passives'))}</b></div>${ids.map(id=>id?`<button type="button" class="passive-slot-pill ${expandedId===id?'is-expanded':''}" data-action="passive-info:${id}" aria-label="${esc(t(`prop.${id}`))}. ${esc(t(`prop.${id}.desc`))}" aria-expanded="${expandedId===id}" title="${esc(t(`prop.${id}`))}: ${esc(t(`prop.${id}.desc`))}"><span aria-hidden="true">${propSticker(id,36)}</span><small>Lv.${loadout.ownedProps[id]??1}</small><span class="passive-tooltip" role="tooltip"><strong>${esc(t(`prop.${id}`))}</strong><span>${esc(t(`prop.${id}.desc`))}</span></span></button>`:`<button type="button" class="passive-slot-pill passive-empty" data-action="passive-backpack" aria-label="${esc(t('p13.passiveEmpty'))}">+</button>`).join('')}${!ids.length?`<span class="passive-none">${esc(t('p13.noPassives'))}</span>`:''}`;
}
