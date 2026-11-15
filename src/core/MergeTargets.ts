import type {BattleState} from './types';
import {MergeSystem} from './MergeSystem';
import {HEROES} from '../config/heroes';
import {RECIPES} from '../config/recipes';

export interface MergeTarget {unitId:number;kind:'upgrade'|'hero';heroId?:string;nextLevel?:number;feedHero?:boolean}
export function getMergeTargets(state:BattleState,sourceId:number):MergeTarget[] {
  const source=state.units.find(unit=>unit.id===sourceId);
  if(!source||source.washing)return [];
  return state.units.flatMap(candidate=>{
    if(candidate.id===source.id||candidate.side!==source.side||candidate.washing)return [];
    const outcome=MergeSystem.combine(source,candidate);
    if(!outcome.ok||!outcome.unit)return [];
    return [{unitId:candidate.id,kind:HEROES[outcome.unit.kind]?'hero' as const:'upgrade' as const,nextLevel:outcome.unit.level,
      ...(HEROES[outcome.unit.kind]?{heroId:outcome.unit.kind}:{}),
      ...(HEROES[source.kind]||HEROES[candidate.kind]?{feedHero:true}:{})}];
  });
}

/** Both sides of a real pairing participate, whether the partner is in a nest or on a pad. */
export function getBoardMergeHints(state:BattleState):Array<{unitId:number;col:number;row:number;kind:'hero'|'upgrade'}> {
  return state.units.flatMap(unit=>{
    if(unit.side!=='player'||unit.location.zone!=='board'||unit.kind==='shovel'||unit.washing)return [];
    const targets=getMergeTargets(state,unit.id);if(!targets.length)return [];
    const hero=targets.some(target=>target.kind==='hero'&&!target.feedHero);
    return [{unitId:unit.id,col:unit.location.col,row:unit.location.row,kind:hero?'hero' as const:'upgrade' as const}];
  });
}

/** Passive dock hints distinguish creating a hero from feeding an existing one. */
export function getBenchMergeHints(state:BattleState):Array<{unitId:number;slot:number;kind:'hero'|'upgrade'}> {
  return state.units.flatMap(unit=>{
    if(unit.side!=='player'||unit.location.zone!=='bench'||unit.kind==='shovel')return [];
    const targets=getMergeTargets(state,unit.id);if(!targets.length)return [];
    const hero=targets.some(target=>target.kind==='hero'&&!HEROES[unit.kind]&&!HEROES[state.units.find(u=>u.id===target.unitId)!.kind]);
    return [{unitId:unit.id,slot:unit.location.slot,kind:hero?'hero' as const:'upgrade' as const}];
  });
}

export interface PassiveMergeCallout {
  unitId:number;zone:'board'|'bench';kind:'hero'|'upgrade';heroId?:string;nextLevel?:number;partnerIds:number[];
}
/** A new hero takes priority; feeding an existing hero is an upgrade, not a new recipe. */
export function getPassiveMergeCallouts(state:BattleState):PassiveMergeCallout[] {
  return state.units.flatMap(unit=>{
    if(unit.side!=='player'||unit.kind==='shovel')return [];
    const targets=getMergeTargets(state,unit.id),best=targets.find(t=>t.kind==='hero'&&!t.feedHero)??targets[0];
    if(!best)return [];
    const hero=best.kind==='hero'&&!best.feedHero;
    return [{unitId:unit.id,zone:unit.location.zone,kind:hero?'hero' as const:'upgrade' as const,
      ...(best.heroId?{heroId:best.heroId}:{}),nextLevel:best.nextLevel,
      partnerIds:targets.filter(t=>hero?t.kind==='hero'&&!t.feedHero&&t.heroId===best.heroId:t.feedHero||t.kind==='upgrade').map(t=>t.unitId)}];
  });
}

/** Stable recipe order; multiple copies of a recipe do not crowd out other hero names. */
export function getHeroMergeOptions(state:BattleState):Array<{heroId:string;sourceId:number;targetId:number}> {
  const pairs=new Map<string,{heroId:string;sourceId:number;targetId:number}>();
  for(const source of state.units.filter(u=>u.side==='player').sort((a,b)=>a.id-b.id))for(const target of getMergeTargets(state,source.id)){
    if(target.kind==='hero'&&!target.feedHero&&target.heroId&&!pairs.has(target.heroId))pairs.set(target.heroId,{heroId:target.heroId,sourceId:source.id,targetId:target.unitId});
  }
  return RECIPES.flatMap(r=>pairs.has(r.hero)?[pairs.get(r.hero)!]:[]);
}
