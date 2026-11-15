import type {BattleState} from './types';
import {MergeSystem} from './MergeSystem';
import {HEROES} from '../config/heroes';

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
