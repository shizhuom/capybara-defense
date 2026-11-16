import type {BattleEngine} from './BattleEngine';
import type {Enemy,Point,Unit} from './types';
import {UNITS} from '../config/units';
import {getMap} from '../config/maps';
import {getWaveConfig} from '../config/waves';
import {GridSystem} from './GridSystem';

/** Extra bosses share the engine's EMP gate; summons are ordinary lane enemies. */
export function applyNewBossMechanic(engine:BattleEngine,boss:Enemy,units:Unit[]):void {
  const targets:Point[]=[];
  const summon=(kind:string,offset:number,scale=engine.state.endless?getWaveConfig(engine.state.wave).hpScale:1,boneShield=false)=>{
    const enemy=engine.spawnEnemy(kind,boss.side,scale);
    enemy.progress=Math.max(0,Math.min(getMap(engine.state.mapId).paths.player.length-1,boss.progress+offset));
    Object.assign(enemy,GridSystem.pathPosition(boss.side,enemy.progress,engine.state.mapId));
    if(boneShield)enemy.boneShield=true;
    targets.push({col:enemy.col,row:enemy.row});
  };
  switch(boss.kind){
    case 'diva_kitty':{
      const victim=units.filter(u=>UNITS[u.kind]?.category==='basic'&&(u.kind!=='bee'||u.level===1)).sort((a,b)=>a.level-b.level||a.id-b.id)[0];
      if(victim){targets.push(engine.unitPosition(victim));engine.state.units=engine.state.units.filter(u=>u.id!==victim.id);summon('charmed_rat',0);}break;
    }
    case 'buff_roo':
    case 'screaming_marmot':{
      const knock=boss.kind==='buff_roo',range=knock?2:2.2;
      for(const unit of units.filter(u=>GridSystem.distance(engine.unitPosition(u),boss)<=range)
        .sort((a,b)=>GridSystem.distance(engine.unitPosition(a),boss)-GridSystem.distance(engine.unitPosition(b),boss)||a.id-b.id).slice(0,2)){
        unit.statuses[knock?'KNOCKDOWN':'CONFUSED']=knock?9:6.5;targets.push(engine.unitPosition(unit));
      }break;
    }
    case 'hornet_queen':for(const offset of [.3,.6,.9])summon('killer_bee',offset);break;
    case 'trash_coon':{
      const scale=getWaveConfig(engine.state.wave).hpScale*1.3;
      for(const offset of [-.3,0,.3])summon('rat',offset,scale,true);break;
    }
    case 'dj_rat_king':
      for(const enemy of engine.lane(boss.side)){
        enemy.hp=Math.min(enemy.maxHp,enemy.hp+enemy.maxHp*.12);enemy.hasteTime=Math.max(4,enemy.hasteTime??0);targets.push({col:enemy.col,row:enemy.row});
      }break;
    default:return;
  }
  engine.event({type:'boss_skill',side:boss.side,col:boss.col,row:boss.row,effect:boss.kind,points:targets,duration:1.1});
}
