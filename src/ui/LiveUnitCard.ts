import { HEROES } from '../config/heroes';
import { RECIPES } from '../config/recipes';
import { UNITS } from '../config/units';
import { WEAPONS } from '../config/weapons';
import { GridSystem } from '../core/GridSystem';
import { MergeSystem } from '../core/MergeSystem';
import { getBaseUnitStats, getBeeProduction } from '../core/UnitStats';
import type { UnitStats } from '../core/UnitStats';
import type { BattleLoadout, BattleState, Unit } from '../core/types';
import { t } from '../i18n/i18n';
import { weaponSticker } from '../render/M3Art';
import { escapeHtml as esc } from './art';
import { sceneSticker, unitSticker } from './stickers';

export interface LiveUnitCardInput {
  unit:Unit;
  state:BattleState;
  /** Supply engine.getEffectiveUnitStats(unit), including current battle modifiers. */
  stats:UnitStats;
  /** Supply the selected side's battle loadout, rather than the mutable profile. */
  loadout:BattleLoadout;
}
const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
const unitName=(kind:string)=>tr(`${HEROES[kind]?'hero':'unit'}.${kind}`);
const picture=(kind:string,size:number)=>`<span role="img" aria-label="${unitName(kind)}"><span aria-hidden="true">${unitSticker(kind,size)}</span></span>`;
const production=(level:number,loadout:BattleLoadout)=>tr('p3.productionValue',getBeeProduction(level,loadout));

/** Rendering only: all interaction is delegated to the host through data-action. */
export function liveUnitCardMarkup({unit,state,stats,loadout}:LiveUnitCardInput):string {
  const kind=unit.kind,hero=HEROES[kind],definition=UNITS[kind],max=hero?5:definition?.maxLevel??1;
  const left=unit.location.zone==='board'&&unit.location.col>=6;
  const available=(partnerKind:string,feed=false)=>state.units.some(partner=>{
    if(partner.id===unit.id||partner.kind!==partnerKind||partner.side!==unit.side||unit.washing||partner.washing)return false;
    const source=feed?partner:unit,target=feed?unit:partner;
    if(!GridSystem.canPlace(state,source.side,target.location))return false;
    const outcome=MergeSystem.combine(source,target);
    return outcome.ok&&!!outcome.unit&&!outcome.swap;
  });
  const ready=(yes:boolean)=>yes?`<b class="merge-ready">${tr('p3.ready')}</b>`:'';
  const status=(Object.entries(unit.statuses) as [string,number][]).filter(([,time])=>time>0).map(([status,time])=>`<span class="live-status">${tr(`status.${status}`)} ${Math.ceil(time)}s</span>`).join('')+(unit.washing?`<span class="live-status">${tr('m2.washing')}</span>`:'');
  let body=kind==='shovel'?`<p>${tr('inspect.toolBody')}</p><button type="button" data-action="store-shovel">${tr('inspect.storeShovel')}</button>`:kind==='bee'?`<div class="live-stat-pills"><span title="${tr('p3.production')}" data-live-stat="production">${production(unit.level,loadout)}</span></div>`:`<div class="live-stat-pills"><span title="${tr('p3.damage')}" aria-label="${tr('p3.damage')}" data-live-stat="damage">⚔ ${Math.round(stats.damage)}</span><span title="${tr('p3.rate')}" aria-label="${tr('p3.rate')}" data-live-stat="rate">ϟ ${Number(stats.rate.toFixed(2))}/s</span><span title="${tr('p3.range')}" aria-label="${tr('p3.range')}" data-live-stat="range">◎ ${Number(stats.range.toFixed(1))}</span></div>`;
  body+=`<div class="live-statuses" data-live-statuses>${status}</div>`;
  if(definition?.category==='component'){
    body+=`<div class="live-recipes">${RECIPES.filter(r=>(r.parts as readonly string[]).includes(kind)).map(r=>{
      const partner=r.parts.find(p=>p!==kind)!,yes=available(partner);
      return `<button type="button" class="live-equation${yes?' partner-ready':''}" data-action="inspect-book:${r.hero}">${picture(kind,30)}<b>＋</b>${picture(partner,30)}<b>→</b>${picture(r.hero,34)}<span>${unitName(r.hero)}</span>${ready(yes)}</button>`;
    }).join('')}</div>`;
    if(kind==='shiba'||kind==='hat_wizard')body+=`<p class="locked-pair">${picture('shiba',26)}＋${picture('hat_wizard',26)} 🔒 ${tr('p3.lockedPair')}</p>`;
  }
  if(definition?.category==='basic'){
    if(unit.level>=max)body+=`<b class="live-max">${tr('p3.max')}</b>`;
    else {
      const yes=available(kind),next=getBaseUnitStats(kind,unit.level+1),current=getBaseUnitStats(kind,unit.level);
      body+=`<div class="live-upgrade${yes?' partner-ready':''}"><div class="live-equation">${picture(kind,30)}<span>${tr('p3.level',{level:unit.level})}</span>＋${picture(kind,30)}<span>${tr('p3.level',{level:unit.level})}</span>→<span>${tr('p3.level',{level:unit.level+1})}</span></div><p>${tr(kind==='bee'?'p3.next':'p3.basePreview')}: ${kind==='bee'?`${production(unit.level,loadout)} → ${production(unit.level+1,loadout)}`:`⚔ ${Math.round(current.damage)} → ${Math.round(next.damage)} · ϟ ${Number(current.rate.toFixed(2))} → ${Number(next.rate.toFixed(2))}/s`}</p>${ready(yes)}</div>`;
    }
  }
  if(hero){
    const weapon=WEAPONS[loadout.equippedWeapons[kind]],recipe=RECIPES.find(r=>r.hero===kind)!;
    const value=Math.max(0,Math.min(stats.charge,unit.energy)),percent=stats.charge>0?value/stats.charge*100:0;
    body+=`<div class="live-weapon">${weapon?`<span aria-hidden="true">${weaponSticker(weapon.id,36)}</span><span>${tr('p3.equipped')}<br/><b>${tr(`weapon.${weapon.id}`)}</b></span>`:tr('p3.noWeapon')}</div><div class="live-energy" data-live-energy><span data-live-energy-value>${tr('p3.energy',{value,total:stats.charge})}</span><div role="progressbar" data-live-energy-bar aria-label="${tr('p3.charge')}" aria-valuemin="0" aria-valuemax="${stats.charge}" aria-valuenow="${value}"><i data-live-energy-fill style="width:${percent}%"></i></div></div><p class="live-skill"><b>${tr(`skill.${kind}`)}</b><br/>${tr(`skill.${kind}.desc`,{charge:stats.charge})}</p>`;
    body+=unit.level>=max?`<b class="live-max">${tr('p3.max')}</b>`:`<div class="live-feed"><b>${tr('p3.feed')}</b>${recipe.parts.map(part=>{const yes=available(part,true);return `<span class="${yes?'partner-ready':''}">${picture(part,30)}${ready(yes)}</span>`;}).join('<span>/</span>')}<span>→ ${tr('p3.level',{level:unit.level+1})}</span></div>`;
  }
  return `<aside id="live-unit-card" class="live-unit-card${left?' dock-left':''}" aria-label="${unitName(kind)}"><header class="live-card-header">${picture(kind,48)}<div><h3>${unitName(kind)}</h3><b data-live-level>${tr('p3.level',{level:unit.level})}</b></div><button type="button" data-action="inspect-book:${esc(kind)}" aria-label="${tr('p3.book')}" title="${tr('p3.book')}"><span aria-hidden="true">${sceneSticker('ui_compendium_book','',22)}</span></button><button type="button" data-action="clear" aria-label="${tr('inspect.cancel')}">×</button></header>${body}</aside>`;
}
