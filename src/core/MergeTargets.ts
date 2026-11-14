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
