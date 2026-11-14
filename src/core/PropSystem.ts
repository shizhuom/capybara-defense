import type {BattleEngine} from './BattleEngine';
import type {BattleLoadout,CommandResult,Enemy,Side,Unit} from './types';
import {PROPS} from '../config/props';
import {WEAPONS,HERO_FAMILIES} from '../config/weapons';
import {UNITS,DRAW_POOL,SHOVEL_PRODUCTION} from '../config/units';
import {HEROES} from '../config/heroes';
import {RECIPES} from '../config/recipes';
import {getMap} from '../config/maps';
import {GridSystem} from './GridSystem';

export interface PropTarget {unitId?:number;col?:number;row?:number}

/** Snapshot validation keeps outside profile edits from changing a running match. */
export function copyLoadout(input:Partial<BattleLoadout>={}):BattleLoadout {
  if(!input||typeof input!=='object')input={};
  const entries=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.entries(value):[];
  const ownedProps:Record<string,number>={};
  for(const [id,value] of entries(input.ownedProps))if(Object.hasOwn(PROPS,id)&&Number.isInteger(value)&&value>0)ownedProps[id]=Math.min(value,PROPS[id].maxLevel);
  const slots=(ids:string[]|undefined,type:'active'|'passive',limit:number)=>[...new Set(Array.isArray(ids)?ids:[])].filter(id=>typeof id==='string'&&Object.hasOwn(ownedProps,id)&&PROPS[id]?.type===type).slice(0,limit);
  const equippedWeapons:Record<string,string>={},used=new Set<string>();
  for(const [hero,id] of entries(input.equippedWeapons))if(typeof id==='string'&&Object.hasOwn(WEAPONS,id)&&Object.hasOwn(HERO_FAMILIES,hero)&&HERO_FAMILIES[hero]===WEAPONS[id].family&&!used.has(id)){equippedWeapons[hero]=id;used.add(id);}
  return{ownedProps,equippedWeapons,equippedActiveProps:slots(input.equippedActiveProps,'active',2),equippedPassiveProps:slots(input.equippedPassiveProps,'passive',6)};
}

export class PropSystem {
  private trapSequence=1;
  private beeFoodGranted=false;
  private orangeDeficit=0;
  constructor(private engine:BattleEngine,private random:()=>number){}
  has(side:Side,id:string):boolean {return this.engine.state.sides[side].loadout.equippedPassiveProps.includes(id);}
  initialize():void {
    const sides=this.engine.state.sides;
    for(const side of ['player'] as Side[]){
      if(this.has(side,'extra_oranges'))sides[side].oranges+=2;
      if(this.has(side,'shared_oranges'))sides[side].oranges+=4;
      this.grantBeeFood();
    }
  }
  syncPreparationLoadout(loadout:BattleLoadout):void {
    const resources=this.engine.state.sides.player;
    const orangeBonus=(value:BattleLoadout)=>(value.equippedPassiveProps.includes('extra_oranges')?2:0)+(value.equippedPassiveProps.includes('shared_oranges')?4:0);
    const delta=orangeBonus(loadout)-orangeBonus(resources.loadout);
    resources.loadout=loadout;this.adjustOranges(delta);
    this.grantBeeFood();
  }
  adjustOranges(delta:number):void {
    const resources=this.engine.state.sides.player;
    // Keep damage beyond the currently equipped budget; displaying zero must
    // not forgive it on the next equipment swap or orange gain.
    const balance=resources.oranges-this.orangeDeficit+delta;
    this.orangeDeficit=Math.max(0,-balance);resources.oranges=Math.max(0,balance);
  }
  private grantBeeFood():void {
    if(this.beeFoodGranted||!this.has('player','bee_overtime'))return;
    this.engine.state.sides.player.food+=10;this.beeFoodGranted=true;
  }
  shovelRules(side:Side):{interval:number;maxStored:number}{return this.has(side,'auto_shovel')?{interval:30,maxStored:6}:{interval:SHOVEL_PRODUCTION.interval,maxStored:SHOVEL_PRODUCTION.maxStored};}
  haste(side:Side):number {
    return(this.has(side,'hyper_party')?.38:0)+(this.engine.state.sides[side].catnipTime>0?.45:0);
  }
  draw(side:Side,allowShovel=true):string {
    const pool=DRAW_POOL.filter(item=>allowShovel||item.id!=='shovel');
    const weights=pool.map(item=>item.weight*(item.category==='component'&&this.has(side,'vip_poster')?1.8:1));
    let value=this.random()*weights.reduce((a,b)=>a+b,0);
    return pool.find((_,i)=>(value-=weights[i])<0)?.id??pool.at(-1)!.id;
  }
  promoteDraw(unit:Unit):void {
    if(!this.has(unit.side,'promo_badge')||UNITS[unit.kind]?.category!=='basic')return;
    const level=this.engine.state.sides[unit.side].loadout.ownedProps.promo_badge;
    if(this.random()<[.08,.15,.22][Math.min(2,Math.max(0,level-1))])unit.level=2;
  }
  use(id:string,target:PropTarget={},side:Side='player'):CommandResult {
    const state=this.engine.state,resources=state.sides[side],prop=PROPS[id];
    if(state.phase!=='playing')return{ok:false,key:'hint.paused'};
    if(!prop||!resources.loadout.equippedActiveProps.includes(id))return{ok:false,key:'m2.propNotEquipped'};
    if((resources.propCooldowns[id]??0)>1e-8)return{ok:false,key:'m2.propCooldown'};
    const unit=state.units.find(u=>u.id===target.unitId&&u.side===side),basic=unit&&UNITS[unit.kind],max=unit?(HEROES[unit.kind]?5:basic?.maxLevel??1):1;
    if(prop.target==='unit'){
      if(!unit)return{ok:false,key:'m2.invalidTarget'};
      if(unit.kind==='shovel'&&(id!=='recycle_bin'||unit.location.zone!=='bench'))return{ok:false,key:'hint.toolOnly'};
      if((unit.washing??0)>0)return{ok:false,key:'m2.washing'};
      if(id==='washer'&&!(basic?.category==='component'||basic?.category==='basic'&&unit.level===1))return{ok:false,key:'m2.invalidTarget'};
      if(id==='clay'&&basic?.category!=='component')return{ok:false,key:'m2.invalidTarget'};
      if(id==='milk_bottle'&&(max===1||unit.level>=max))return{ok:false,key:'hint.maxLevel'};
      if(id==='recycle_bin'&&unit.level!==1)return{ok:false,key:'m2.invalidTarget'};
    }
    if(prop.target==='road'&&(!Number.isInteger(target.col)||!Number.isInteger(target.row)||!GridSystem.owns(side,target.col!,target.row!)||state.grid[target.row!][target.col!]!=='R'||state.traps.some(trap=>trap.side===side&&trap.col===target.col&&trap.row===target.row)))return{ok:false,key:'m2.invalidTarget'};
    resources.propCooldowns[id]=prop.cooldown;
    let key='m2.upgraded';
    switch(id){
      case 'washer':unit!.washing=3;key='m2.washing';break;
      case 'clay':{
        const existing=state.units.filter(u=>u.side===side&&u.id!==unit!.id&&UNITS[u.kind]?.category==='component'&&!u.washing);
        const matches=[...new Set(existing.flatMap(u=>RECIPES.filter(recipe=>(recipe.parts as readonly string[]).includes(u.kind)).map(recipe=>recipe.parts.find(part=>part!==u.kind)!)))].filter(kind=>kind!==unit!.kind);
        this.transform(unit!,matches.length?matches[Math.floor(this.random()*matches.length)]:this.randomComponent(unit!.kind));key='m2.transformed';break;
      }
      case 'milk_bottle':this.upgrade(unit!,1);break;
      case 'whistle':this.upgrade(unit!,this.random()<.65?1:-1);key='m2.trained';break;
      case 'expired_can':{
        const lucky=this.random()<.55;this.engine.adjustOranges(lucky?1:-1,side);key=lucky?'m2.canLucky':'m2.canUnlucky';break;
      }
      case 'catnip':resources.catnipTime=8;key='m2.catnip';break;
      case 'glue_trap':state.traps.push({id:this.trapSequence++,side,col:target.col!,row:target.row!,charges:3,hitIds:[]});key='m2.trapPlaced';break;
      case 'recycle_bin':state.units=state.units.filter(u=>u.id!==unit!.id);resources.food+=unit!.kind==='shovel'?4:5;key='m2.recycled';break;
    }
    return{ok:true,key,unitId:unit&&id!=='recycle_bin'?unit.id:undefined};
  }
  sprinkler(side:Side):CommandResult {
    const state=this.engine.state,resources=state.sides[side];
    if(state.phase!=='playing')return{ok:false,key:'hint.paused'};
    if(resources.sprinklerUsed)return{ok:false,key:'m2.sprinklerUsed'};
    resources.sprinklerUsed=true;
    const points=[...getMap(this.engine.state.mapId).paths[side]].reverse().map(p=>({...p}));
    this.engine.event({type:'sprinkler',side,...points[0],points,duration:1.1});
    for(const unit of state.units)if(unit.side===side&&(unit.statuses.SEALED??0)>0){
      delete unit.statuses.SEALED;
      this.engine.event({type:'purge',side,...this.engine.unitPosition(unit),unitId:unit.id,effect:'sprinkler',textKey:'hint.purged',duration:1.1});
    }
    for(const enemy of this.engine.lane(side)){
      this.engine.knockback(enemy,4.5);this.engine.hurt(enemy,120,undefined,false,false,true);enemy.slow=Math.max(enemy.slow,2);enemy.slowFactor=.5;
    }
    return{ok:true,key:'m2.sprinklerReady'};
  }
  tick(dt:number):void {
    for(const side of ['player'] as Side[]){
      const resources=this.engine.state.sides[side];resources.catnipTime=Math.max(0,resources.catnipTime-dt);
      for(const id of Object.keys(resources.propCooldowns)){const next=resources.propCooldowns[id]-dt;resources.propCooldowns[id]=next<1e-8?0:next;}
    }
    for(const unit of this.engine.state.units)if(unit.side==='player'&&(unit.washing??0)>0){unit.washing=Math.max(0,unit.washing!-dt);if(unit.washing<1e-8){unit.washing=0;this.transform(unit,this.randomComponent(unit.kind));}}
  }
  onEnemy(enemy:Enemy):void {
    if(enemy.hp<=0)return;
    const {state}=this.engine;
    for(const trap of state.traps){
      if(trap.side!==enemy.side||trap.charges<=0||trap.hitIds.includes(enemy.id)||GridSystem.distance(trap,enemy)>.62)continue;
      trap.hitIds.push(enemy.id);trap.charges-=enemy.boss?3:1;enemy.stun=Math.max(enemy.stun,3.2);
    }
    state.traps=state.traps.filter(trap=>trap.charges>0);
    const owner=state.sides[enemy.side];
    if(this.has(enemy.side,'giant_orange_cat')&&owner.giantCatUses<2&&enemy.progress>=getMap(state.mapId).paths.player.length-3){
      owner.giantCatUses++;const center=GridSystem.pathPosition(enemy.side,getMap(state.mapId).paths.player.length-2,this.engine.state.mapId);
      this.engine.event({type:'giant_cat',side:enemy.side,...center,duration:1.1});
      for(const target of this.engine.lane(enemy.side).filter(e=>e.progress>=getMap(state.mapId).paths.player.length-3.2)){
        this.engine.hurt(target,target.boss?target.maxHp*.35:target.hp,undefined,true,false,true);
        if(target.boss)this.engine.knockback(target,3);
      }
    }
  }
  blockBoss(enemy:Enemy):boolean {
    if(!this.has(enemy.side,'emp_jammer')||this.random()>=.45)return false;
    this.engine.hurt(enemy,enemy.maxHp*.08,undefined,true,false,true);
    this.engine.event({type:'bubble',side:enemy.side,col:enemy.col,row:enemy.row,textKey:'m2.empBackfire',duration:1.2});return true;
  }
  treasure(side:Side,col:number,row:number):void {
    if(!this.has(side,'gold_doge')||this.random()>=.35)return;
    const food=this.random()<.5;
    if(food)this.engine.state.sides[side].food+=12;else this.engine.state.sides[side].loot.push(this.engine.rollWeaponFragment());
    this.engine.event({type:'bubble',side,col,row,textKey:food?'m2.treasureFood':'m2.treasureFragment',effect:'treasure',duration:1.4});
    this.engine.event({type:'weapon',side,col,row,effect:'treasure',color:'#eabc4c',duration:.8});
  }
  private randomComponent(exclude:string):string {
    const options=DRAW_POOL.filter(unit=>unit.category==='component'&&unit.id!==exclude);return options[Math.floor(this.random()*options.length)].id;
  }
  private transform(unit:Unit,kind:string):void {unit.kind=kind;unit.level=1;unit.energy=0;unit.cooldown=0;unit.animation=1;unit.statuses={};}
  private upgrade(unit:Unit,delta:number):void {
    const previous=unit.level,max=HEROES[unit.kind]?5:UNITS[unit.kind]?.maxLevel??1;unit.level=Math.min(max,Math.max(1,unit.level+delta));unit.animation=1;
    if(unit.level>previous){unit.statuses={};unit.energy=0;unit.cooldown=0;this.engine.event({type:'purge',side:unit.side,...this.engine.unitPosition(unit),unitId:unit.id,textKey:'hint.purged',duration:1.1});}
  }
}
