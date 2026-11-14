import type { Unit } from './types';
import { RECIPES } from '../config/recipes';
import { UNITS } from '../config/units';
import { HEROES } from '../config/heroes';
export interface MergeOutcome { ok:boolean; key:string; unit?:Unit; swap?:boolean }
export class MergeSystem {
  static combine(source:Unit, target:Unit):MergeOutcome {
    const reject=(key:string):MergeOutcome=>({ok:false,key});
    if(source.id===target.id)return reject('hint.invalid');
    if(source.side!==target.side)return reject('hint.enemyTerritory');
    if(source.kind==='shovel'||target.kind==='shovel')return source.location.zone==='bench'&&target.location.zone==='bench'?{ok:true,key:'hint.swapped',swap:true}:reject('hint.toolOnly');
    const pair=[source.kind,target.kind];
    if(pair.includes('shiba')&&pair.includes('hat_wizard'))return reject('hint.dogeMagic');
    const recipe=RECIPES.find(r=>r.parts.every(p=>pair.includes(p)));
    const targetRecipe=RECIPES.find(r=>r.hero===target.kind);
    const sourceRecipe=RECIPES.find(r=>r.hero===source.kind);
    const feedTarget=targetRecipe?.parts.some(p=>p===source.kind);
    const feedSource=sourceRecipe?.parts.some(p=>p===target.kind);
    const same=source.kind===target.kind&&source.level===target.level&&(!!HEROES[source.kind]||UNITS[source.kind]?.category==='basic');
    if(!recipe&&!feedTarget&&!feedSource&&!same)return{ok:true,key:'hint.swapped',swap:true};
    if((source.statuses.MERGE_LOCK??0)>0||(target.statuses.MERGE_LOCK??0)>0)return reject('hint.mergeLocked');
    const base=feedSource?source:target;
    const max=HEROES[base.kind]?5:UNITS[base.kind]?.maxLevel??1;
    if(!recipe&&base.level>=max)return reject('hint.maxLevel');
    return {
      ok:true,key:feedTarget||feedSource?'hint.fed':'hint.merged',
      unit:{...base,id:target.id,side:target.side,location:{...target.location},kind:recipe?.hero??base.kind,level:recipe?1:base.level+1,statuses:{},cooldown:0,energy:0,production:0,buffTime:0,empowered:0,animation:1},
    };
  }
}
