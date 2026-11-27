import type {BattleEngine} from './BattleEngine';
import type {BattleLoadout,OpponentIdentity,Point,Unit} from './types';
import {MergeSystem} from './MergeSystem';
import {GridSystem} from './GridSystem';
import {getMap} from '../config/maps';
import {HEROES} from '../config/heroes';
import {UNITS} from '../config/units';
import {PROPS} from '../config/props';
import {WEAPONS,HERO_FAMILIES} from '../config/weapons';
import {getOpponentTuning,type OpponentTuning} from '../config/opponents';

const sample=(random:()=>number)=>Math.max(0,Math.min(.999999999999,Number(random())||0));
const shuffled=<T>(values:T[],random:()=>number):T[]=>{
  const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(sample(random)*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
};
const npcRows=[
  ['橘子汽水豚','Yuzu Capy','capybara'],['瓜子不离手','Seed Snack Captain','hamster'],
  ['早八遛狗人','Morning Dog Walker','doge_agent'],['猫咖值班喵','Cafe Cat Keeper','cat_swordsman'],
  ['温泉泡泡糖','Onsen Bubblegum','sakura_capy'],['厨房干饭王','Kitchen Daydreamer','salted_fish'],
  ['鹅村扛把子','Village Goose Boss','goose_bully'],['熊猫不熬夜','Early Bedtime Panda','kungfu_panda'],
  ['篮球练习生','Basketball Trainee','rooster_star'],['皇冠小短腿','Crowned Short Legs','corgi_crown'],
  ['超市常客','Mart Regular','market_coon'],['呱呱不孤单','Never Lonely Frog','frog_king'],
  ['竹林扫地僧','Bamboo Sweeper','bamboo_master'],['后院退休园长','Retired Garden Warden','capybara'],
  ['情绪稳定祖师爷','Grandmaster of Calm','zen_capy'],
];

/** Uses a setup-only random stream; never reads or changes profile storage. */
export function createOpponentSetup(rankIndex:number,random:()=>number):{tuning:OpponentTuning;loadout:BattleLoadout;identity:OpponentIdentity} {
  const tuning=getOpponentTuning(rankIndex),rank=tuning.rankIndex,tier=rank<6?0:rank<15?1:rank<30?2:rank<45?3:4;
  const loadout:BattleLoadout={equippedWeapons:{},ownedProps:{},equippedActiveProps:[],equippedPassiveProps:[]};
  const heroes=shuffled(Object.keys(HERO_FAMILIES),random),used=new Set<string>();
  for(const hero of heroes){
    if(Object.keys(loadout.equippedWeapons).length>=[0,2,4,6,12][tier])break;
    const index=Object.keys(loadout.equippedWeapons).length,signature=tier===4||tier===3&&index<2;
    const candidates=Object.values(WEAPONS).filter(w=>!used.has(w.id)&&w.family===HERO_FAMILIES[hero]&&
      (signature?w.signatureHero===hero:tier===1?w.rarity===1||w.rarity===2:w.rarity===3));
    if(!candidates.length)continue;
    const weapon=candidates[Math.floor(sample(random)*candidates.length)];
    loadout.equippedWeapons[hero]=weapon.id;used.add(weapon.id);
  }
  const passivePool=Object.values(PROPS).filter(p=>p.type==='passive'&&!['shared_oranges','hyper_party'].includes(p.id)&&
    (tier===1?p.rarity<=2:tier>=3?p.rarity>=2||['auto_shovel','tall_perch','banana_peel'].includes(p.id):true));
  const count=[0,1,2+Math.floor(sample(random)*2),4,5+Math.floor(sample(random)*2)][tier];
  loadout.equippedPassiveProps=shuffled(passivePool,random).slice(0,count).map(p=>p.id);
  loadout.equippedActiveProps=tier<2?[]:tier===2?[sample(random)<.5?'catnip':'milk_bottle']:['milk_bottle','catnip'];
  for(const id of [...loadout.equippedPassiveProps,...loadout.equippedActiveProps])loadout.ownedProps[id]=tier===4?PROPS[id].maxLevel:1;
  const near=npcRows.map((row,index)=>({row,index,rank:Math.min(53,index*4)})).filter(npc=>Math.abs(npc.rank-rank)<=2);
  const npc=near[Math.floor(sample(random)*near.length)],[zh,en,avatarId]=npc.row;
  const identity:OpponentIdentity={id:`pet_npc_${npc.index+1}`,name:{'zh-CN':zh,en},avatarId,rankIndex:npc.rank};
  return {tuning,loadout,identity};
}

/** All decisions issue the same validated commands and spend the same resources as a player. */
export class OpponentAI {
  private elapsed=0;
  private nextDecision:number;
  private sealedSince=new Map<number,number>();
  private tuning:OpponentTuning;
  constructor(tuning:OpponentTuning=getOpponentTuning(0)){
    this.tuning={...tuning};this.nextDecision=tuning.openingDelay;
  }
  tick(engine:BattleEngine,dt:number):void {
    this.elapsed+=dt;
    const {state}=engine,resources=state.sides.ai,units=state.units.filter(u=>u.side==='ai');
    // An imminent leak retains the pre-P1 emergency save during the opening delay.
    if(!resources.sprinklerUsed&&engine.lane('ai').some(enemy=>enemy.progress>=13))engine.useSprinkler('ai');
    for(const id of this.sealedSince.keys())if(!units.some(u=>u.id===id&&(u.statuses.SEALED??0)>0))this.sealedSince.delete(id);
    for(const unit of units)if((unit.statuses.SEALED??0)>0&&!this.sealedSince.has(unit.id))this.sealedSince.set(unit.id,this.elapsed);
    if(this.elapsed+1e-8<this.tuning.openingDelay)return;
    const ready=(id:string)=>resources.loadout.equippedActiveProps.includes(id)&&(resources.propCooldowns[id]??0)<=1e-8;
    const eligible=(u:Unit)=>!u.washing&&u.level<(HEROES[u.kind]?5:UNITS[u.kind]?.maxLevel??1);
    const strength=(u:Unit)=>(HEROES[u.kind]?10000:0)+u.level*100+engine.getUnitStats(u).damage;
    const reacted=units.filter(u=>(u.statuses.SEALED??0)>0&&this.elapsed-(this.sealedSince.get(u.id)??this.elapsed)+1e-8>=this.tuning.reactionDelay);
    const controlled=units.filter(u=>Object.values(u.statuses).some(value=>(value??0)>0)&&eligible(u)&&
      (!(u.statuses.SEALED??0)||reacted.includes(u))).sort((a,b)=>strength(b)-strength(a));
    const crisis=resources.oranges<=2||engine.lane('ai').some(e=>e.boss&&e.progress>=7.5);
    if((this.tuning.rankIndex>=30||crisis)&&ready('milk_bottle')&&controlled[0])engine.useProp('milk_bottle',{unitId:controlled[0].id},'ai');
    else if(reacted.some(u=>HEROES[u.kind])&&!resources.sprinklerUsed)engine.useSprinkler('ai');
    if(crisis){
      if(ready('catnip'))engine.useProp('catnip',{},'ai');
      else if(ready('milk_bottle')){
        const target=units.filter(u=>eligible(u)&&!(u.statuses.SEALED??0)).sort((a,b)=>strength(b)-strength(a))[0];
        if(target)engine.useProp('milk_bottle',{unitId:target.id},'ai');
      }
    }
    if(this.elapsed+1e-8<this.nextDecision)return;
    this.nextDecision=this.elapsed+this.tuning.interval;
    const merges:Array<{source:Unit;target:Unit;priority:number}>=[];
    for(const a of units)for(const b of units){
      if(a.id===b.id||a.washing||b.washing)continue;
      if([a,b].some(u=>(u.statuses.SEALED??0)>0&&!reacted.includes(u)))continue;
      const result=MergeSystem.combine(a,b);if(!result.ok||!result.unit)continue;
      const hero=HEROES[result.unit.kind],recipe=!!hero&&!HEROES[a.kind]&&!HEROES[b.kind];
      merges.push({source:a,target:b,priority:(recipe?1000:hero?100:0)+(recipe&&this.tuning.counterMerges?this.counterScore(engine,result.unit.kind):0)});
    }
    merges.sort((a,b)=>b.priority-a.priority);
    if(merges[0]&&engine.move(merges[0].source.id,merges[0].target.location).ok)return;
    const empty:Point[]=[],grass:Point[]=[];
    for(let row=0;row<5;row++)for(let col=0;col<8;col++){
      if(state.grid[row][col]==='O'&&!units.some(u=>u.location.zone==='board'&&u.location.col===col&&u.location.row===row))empty.push({col,row});
      if(state.grid[row][col]==='G')grass.push({col,row});
    }
    const bench=units.filter(u=>u.location.zone==='bench'&&!u.washing).sort((a,b)=>strength(b)-strength(a));
    if(bench[0]&&empty.length){
      empty.sort((a,b)=>this.placementScore(engine,bench[0],b)-this.placementScore(engine,bench[0],a));
      if(engine.move(bench[0].id,{zone:'board',...empty[0]}).ok)return;
    }
    if(!empty.length&&resources.shovels>0&&grass.length){
      const unit=bench[0]??units.find(u=>u.kind!=='bee');
      grass.sort((a,b)=>unit?this.placementScore(engine,unit,b)-this.placementScore(engine,unit,a):a.row-b.row||a.col-b.col);
      if(engine.dig(grass[0].col,grass[0].row,'ai').ok)return;
    }
    if(resources.food>=10)engine.summon('ai');
  }
  private counterScore(engine:BattleEngine,hero:string):number {
    const bosses=engine.lane('ai').filter(e=>e.boss),family=HERO_FAMILIES[hero];
    return bosses.reduce((score,boss)=>score+(
      ['mega_roomba','buff_roo','dr_clippers'].includes(boss.kind)?family==='ranged'?40:family==='magic'?20:0:
      ['dj_rat_king','hornet_queen','trash_coon'].includes(boss.kind)?['pepe_king','bamboo_mafia','purrcerer','ballin_rooster'].includes(hero)?40:0:
      ['box_kraken','screaming_marmot'].includes(boss.kind)?['kungfu_po','samurai_doge','purrcerer'].includes(hero)?30:0:
      family==='magic'?20:0),0);
  }
  private placementScore(engine:BattleEngine,unit:Unit,p:Point):number {
    const path=getMap(engine.state.mapId).paths.ai,distance=Math.min(...path.map(q=>GridSystem.distance(p,q)));
    const center=Math.hypot(p.col-3.5,p.row-2);
    if(unit.kind==='bee')return distance*100-center;
    const range=engine.getUnitStats(unit).range,coverage=path.filter(q=>GridSystem.distance(p,q)<=range).length;
    if(range>=2.4)return coverage*4+Math.min(distance,2)*6-center*2;
    const adjacent=path.filter(q=>GridSystem.distance(p,q)<=1.5).length;
    return adjacent*10+coverage*2-distance*5-center;
  }
}
