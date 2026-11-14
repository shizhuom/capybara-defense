import type {BattleState} from './types';
import {MergeSystem} from './MergeSystem';
import {HEROES} from '../config/heroes';

export function getMergeTargets(state:BattleState,sourceId:number):Array<{unitId:number;kind:'upgrade'|'hero';heroId?:string}> {
  const source=state.units.find(unit=>unit.id===sourceId);
  if(!source||source.washing)return [];
  return state.units.flatMap(candidate=>{
    if(candidate.id===source.id||candidate.side!==source.side||candidate.washing)return [];
    const outcome=MergeSystem.combine(source,candidate);
    if(!outcome.ok||!outcome.unit)return [];
    return [{unitId:candidate.id,kind:HEROES[outcome.unit.kind]?'hero' as const:'upgrade' as const,
      ...(HEROES[outcome.unit.kind]?{heroId:outcome.unit.kind}:{})}];
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
