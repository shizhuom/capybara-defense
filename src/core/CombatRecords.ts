import type {BattleMVP,Unit} from './types';

interface RecordEntry {unit:Unit;damage:number;kills:number}
/** Battle-owned records keep delayed hits attached to a merge lineage, not a stale unit object. */
export class CombatRecords {
  private entries=new Map<number,RecordEntry>();
  private successors=new Map<number,number>();
  private resolve(id:number):number {
    const next=this.successors.get(id);if(next===undefined)return id;
    const root=this.resolve(next);this.successors.set(id,root);return root;
  }
  hit(unit:Unit,damage:number,killed:boolean):void {
    if(unit.side!=='player'||!Number.isFinite(damage)||damage<=0)return;
    const id=this.resolve(unit.id),record=this.entries.get(id)??{unit,damage:0,kills:0};
    record.damage+=damage;if(killed)record.kills++;this.entries.set(id,record);
  }
  merge(source:Unit,target:Unit,result:Unit):void {
    const ids=[...new Set([this.resolve(source.id),this.resolve(target.id)])];
    const combined={unit:result,damage:0,kills:0};
    for(const id of ids){const record=this.entries.get(id);if(record){combined.damage+=record.damage;combined.kills+=record.kills;}this.entries.delete(id);}
    for(const id of ids)if(id!==result.id)this.successors.set(id,result.id);
    this.entries.set(result.id,combined);
  }
  mvp(liveUnits:readonly Unit[]):BattleMVP|undefined {
    for(const unit of liveUnits){const record=this.entries.get(unit.id);if(record)record.unit=unit;}
    const best=[...this.entries.entries()].filter(([,r])=>r.damage>0).sort(([a,x],[b,y])=>y.damage-x.damage||y.kills-x.kills||a-b)[0]?.[1];
    return best?{kind:best.unit.kind,level:best.unit.level,damage:best.damage,kills:best.kills}:undefined;
  }
}
