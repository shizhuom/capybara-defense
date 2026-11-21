import type {BattleMVP,Unit} from './types';
import {MOMENTUM_CAP} from '../config/medallions';

export {MOMENTUM_CAP};
export interface KillTally {preEndlessKills:number;preEndlessBossKills:number;endlessKills:number;endlessBossKills:number}
interface RecordEntry extends KillTally {unit:Unit;damage:number;kills:number}
const EMPTY:Readonly<KillTally>=Object.freeze({preEndlessKills:0,preEndlessBossKills:0,endlessKills:0,endlessBossKills:0});

/**
 * Battle spirit (P17): one standard-wave kill is worth 12.5 endless kills, and bosses count five times.
 * Raising a core attacker in waves 1-10 is the fastest way to a strong endless hero.
 */
export function computeUnitMomentum(rec:KillTally):number {
  const pre=rec.preEndlessKills*1.0+rec.preEndlessBossKills*5.0;
  const end=rec.endlessKills*.08+rec.endlessBossKills*.5;
  return Math.min(MOMENTUM_CAP,pre+end);
}

/** Battle-owned records keep delayed hits attached to a merge lineage, not a stale unit object. */
export class CombatRecords {
  private entries=new Map<number,RecordEntry>();
  private successors=new Map<number,number>();
  private resolve(id:number):number {
    const next=this.successors.get(id);if(next===undefined)return id;
    const root=this.resolve(next);this.successors.set(id,root);return root;
  }
  hit(unit:Unit,damage:number,killed:boolean,isEndless=false,isBoss=false):void {
    if(unit.side!=='player'||!Number.isFinite(damage)||damage<=0)return;
    const id=this.resolve(unit.id),record=this.entries.get(id)??{unit,damage:0,kills:0,...EMPTY};
    record.damage+=damage;
    if(killed){
      record.kills++;
      if(isEndless){if(isBoss)record.endlessBossKills++;else record.endlessKills++;}
      else if(isBoss)record.preEndlessBossKills++;else record.preEndlessKills++;
    }
    this.entries.set(id,record);
  }
  merge(source:Unit,target:Unit,result:Unit):void {
    const ids=[...new Set([this.resolve(source.id),this.resolve(target.id)])];
    const combined:RecordEntry={unit:result,damage:0,kills:0,...EMPTY};
    for(const id of ids){
      const record=this.entries.get(id);
      if(record){combined.damage+=record.damage;combined.kills+=record.kills;
        combined.preEndlessKills+=record.preEndlessKills;combined.preEndlessBossKills+=record.preEndlessBossKills;
        combined.endlessKills+=record.endlessKills;combined.endlessBossKills+=record.endlessBossKills;}
      this.entries.delete(id);
    }
    for(const id of ids)if(id!==result.id)this.successors.set(id,result.id);
    this.entries.set(result.id,combined);
  }
  /** Kill tally for the unit's whole merge lineage (zeros when it has not landed a hit yet). */
  tally(unit:Unit):KillTally {
    const record=this.entries.get(this.resolve(unit.id));
    return record?{preEndlessKills:record.preEndlessKills,preEndlessBossKills:record.preEndlessBossKills,endlessKills:record.endlessKills,endlessBossKills:record.endlessBossKills}:{...EMPTY};
  }
  momentum(unit:Unit):number {return computeUnitMomentum(this.tally(unit));}
  mvp(liveUnits:readonly Unit[]):BattleMVP|undefined {
    for(const unit of liveUnits){const record=this.entries.get(unit.id);if(record)record.unit=unit;}
    const best=[...this.entries.entries()].filter(([,r])=>r.damage>0).sort(([a,x],[b,y])=>y.damage-x.damage||y.kills-x.kills||a-b)[0]?.[1];
    return best?{kind:best.unit.kind,level:best.unit.level,damage:best.damage,kills:best.kills,...(best.unit.awakened?{awakened:true}:{})}:undefined;
  }
}
