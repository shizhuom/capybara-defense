import {BattleEngine} from '../../src/core/BattleEngine';
import {GridSystem} from '../../src/core/GridSystem';
import {MAPS,MAP_IDS} from '../../src/config/maps';
import {HEROES} from '../../src/config/heroes';
import {HERO_FAMILIES,WEAPONS} from '../../src/config/weapons';
import type {BattleLoadout,MapId,Unit} from '../../src/core/types';

export const COMBATANTS=['hamster','squirrel','hedgehog','corgi',...Object.keys(HEROES)];
export const STEP=1/60;
export function combatant(engine:BattleEngine,kind:string,level=1,col=2,row=1):Unit {
  const id=engine.grant(kind).unitId!;
  const unit=engine.state.units.find(u=>u.id===id)!;
  unit.level=level;unit.location={zone:'board',col,row};return unit;
}
export function signatureLoadout(kind:string):Partial<BattleLoadout> {
  const weapon=Object.values(WEAPONS).find(w=>w.signatureHero===kind);
  return{equippedWeapons:weapon?{[kind]:weapon.id}:{}};
}
/** Zero-armor stationary targets. Disables only knockback to hold range constant.
 * Damage includes ultimates, DOTs and equipment; no kill procs or control utility. */
export function dummyDps(kind:string,options:{level?:number;targets?:number;seconds?:number;loadout?:Partial<BattleLoadout>;dt?:number}={}) {
  const e=new BattleEngine({seed:20261115,autoWaves:false,loadouts:{player:options.loadout}});e.start();
  const unit=combatant(e,kind,options.level??1),seconds=options.seconds??180,dt=options.dt??STEP;
  for(let i=0;i<(options.targets??1);i++){
    const enemy=e.spawnEnemy('rat','player');enemy.progress=2+i*.06;
    Object.assign(enemy,GridSystem.pathPosition('player',enemy.progress));enemy.speed=0;enemy.armor=0;enemy.hp=enemy.maxHp=1e9;
  }
  e.knockback=()=>{};
  let buffSeconds=0,maxConsecutiveBuff=0,consecutiveBuff=0;
  for(let time=0;time<seconds-1e-8;time+=dt){
    const delta=Math.min(dt,seconds-time);e.tick(delta);
    if(unit.buffTime>0){buffSeconds+=delta;consecutiveBuff+=delta;maxConsecutiveBuff=Math.max(maxConsecutiveBuff,consecutiveBuff);}else consecutiveBuff=0;
  }
  return{dps:e.state.sides.player.damage/seconds,buffUptime:buffSeconds/seconds,maxConsecutiveBuff,damage:e.state.sides.player.damage};
}
/** Same solo defender, all existing open pads, 24 durable rats over 90 s.
 * Real path movement, crowd/control effects, kills and overkill are retained. */
export function pathDps(kind:string,mapId:MapId,level=1,loadout:Partial<BattleLoadout>={}) {
  const map=MAPS[mapId],pads=map.grid.flatMap((row,y)=>row.flatMap((tile,x)=>tile==='O'?[{col:x,row:y}]:[]));
  return pads.map(p=>{
    const e=new BattleEngine({seed:20261115,autoWaves:false,mapId,loadouts:{player:loadout}});e.start();
    combatant(e,kind,level,p.col,p.row);e.state.sides.player.oranges=999;
    const seconds=90,dt=.05;let spawned=0;
    for(let time=0;time<seconds-1e-8;time+=dt){
      if(spawned<24&&time+1e-8>=spawned*1.3){
        const enemy=e.spawnEnemy('rat','player');enemy.hp=enemy.maxHp=1200;enemy.armor=0;enemy.speed=.6;spawned++;
      }
      e.tick(dt);
    }
    return{...p,dps:e.state.sides.player.damage/seconds,kills:e.state.sides.player.kills};
  });
}
export function runCombatBenchmark(){
  return COMBATANTS.map(kind=>{
    const e=new BattleEngine({autoWaves:false}),unit=combatant(e,kind),stats=e.getUnitStats(unit);
    const maps=MAP_IDS.map(mapId=>({mapId,pads:pathDps(kind,mapId)}));
    const samples=maps.flatMap(m=>m.pads);
    return{kind,family:HERO_FAMILIES[kind]??(kind==='hamster'||kind==='corgi'?'basic_melee':'basic_ranged'),
      normalDps:stats.damage*stats.rate,range:stats.range,
      dummy:dummyDps(kind),pack:dummyDps(kind,{targets:4}),
      level3:dummyDps(kind,{level:3}),level5:dummyDps(kind,{level:5}),
      ...(HEROES[kind]?{signature:dummyDps(kind,{loadout:signatureLoadout(kind)})}:{}),
      pathAverageDps:samples.reduce((sum,p)=>sum+p.dps,0)/samples.length,
      pathBestDps:maps.reduce((sum,m)=>sum+Math.max(...m.pads.map(p=>p.dps)),0)/maps.length,maps};
  });
}
