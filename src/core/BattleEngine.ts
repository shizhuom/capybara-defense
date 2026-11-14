import { GridSystem } from './GridSystem';
import { ECONOMY, getSummonCost, SHOVEL_PRODUCTION, UNITS } from '../config/units';
import { HEROES } from '../config/heroes';
import { ENEMIES } from '../config/enemies';
import {getMap,GRID_ROWS,GRID_COLS,STAGE} from '../config/maps';
import {COMBAT_STYLES} from '../config/combat';
import {RANKS} from '../config/ranks';
import {applyNewBossMechanic} from './BossMechanics';
import {rollWeapon} from '../config/weapons';
import { FIRST_WAVE_PREPARATION, WAVES, WAVE_DURATION,bossForWave } from '../config/waves';
import { MergeSystem } from './MergeSystem';
import type {OpponentTuning} from '../config/opponents';
import { Random } from './Random';
import {copyLoadout,PropSystem,type PropTarget} from './PropSystem';
import {WeaponSystem} from './WeaponSystem';
import {getBaseUnitStats,getBeeProduction,type UnitStats} from './UnitStats';
import type { BattleLoadout,BattleState, CommandResult, Enemy, Point, Side, Unit, UnitLocation, VisualEvent,SideState,MapId } from './types';
export interface EngineOptions { seed?:number; autoWaves?:boolean; ai?:boolean; loadouts?:Partial<Record<Side,Partial<BattleLoadout>>>; mapId?:MapId; rankIndex?:number; aiOverrides?:Partial<OpponentTuning> }
let battleSequence=0;
export class BattleEngine {
  state:BattleState;
  private sequence=1;
  private random:Random;
  private props:PropSystem;
  private weapons:WeaponSystem;
  private enemyEverSpawned=false;
  private effectOwners=new WeakMap<Enemy,Partial<Record<'burn'|'poison'|'bleed',Unit>>>();
  constructor(public options:EngineOptions={}) {
    const seed=options.seed??Math.floor(Math.random()*0xffffffff);
    this.random=new Random(seed);
    const mapId=getMap(options.mapId).id,rankIndex=Number.isFinite(options.rankIndex)?Math.max(0,Math.min(53,Math.trunc(options.rankIndex!))):0;
    const side=(side:Side):SideState=>({food:ECONOMY.initialFood,summons:0,oranges:ECONOMY.initialOranges,shovels:ECONOMY.initialShovels,shovelTimer:0,kills:0,damage:0,loot:[],fog:0,loadout:copyLoadout(side==='player'?options.loadouts?.player:undefined),propCooldowns:{},sprinklerUsed:false,giantCatUses:0,catnipTime:0});
    this.state={id:`${Date.now()}-${++battleSequence}`,phase:'ready',time:0,wave:0,waveTime:0,nextSpawn:0,spawned:0,mapId,rankIndex,mergedHeroes:{player:[],ai:[]},grid:GridSystem.create(mapId),craterHits:{},sides:{player:side('player'),ai:side('ai')},units:[],enemies:[],events:[],traps:[],result:null};
    this.props=new PropSystem(this,()=>this.random.next());this.props.initialize();this.weapons=new WeaponSystem(this,()=>this.random.next());
  }
  start():void {
    if(this.state.phase!=='ready')return;
    this.state.phase='playing';if(this.options.autoWaves!==false)this.beginWave(1);
  }
  tick(dt:number):void {
    if(!Number.isFinite(dt)||dt<=0||this.state.phase!=='playing')return;
    let remaining=Math.min(dt,600);
    while(remaining>1e-8&&this.state.phase==='playing'){
      const step=Math.min(.05,remaining);this.step(step);remaining-=step;
    }
  }
  pause(value=true):void { if(this.state.phase==='playing'||this.state.phase==='paused') this.state.phase=value?'paused':'playing'; }
  useProp(id:string,target:PropTarget={},side:Side='player'):CommandResult{return side==='player'?this.props.use(id,target,side):{ok:false,key:'hint.invalid'};}
  useSprinkler(side:Side='player'):CommandResult{return side==='player'?this.props.sprinkler(side):{ok:false,key:'hint.invalid'};}
  getShovelRules(side:Side='player'):{interval:number;maxStored:number}{return this.props.shovelRules(side);}
  canSyncPreparationLoadout():boolean {
    return(this.state.phase==='playing'||this.state.phase==='paused')&&this.state.wave<=1&&this.state.spawned===0&&!this.enemyEverSpawned;
  }
  syncPreparationLoadout(input:Partial<BattleLoadout>):CommandResult {
    if(!this.canSyncPreparationLoadout())return{ok:false,key:'hint.invalid'};
    this.props.syncPreparationLoadout(copyLoadout(input));
    return{ok:true,key:'hint.selected'};
  }
  rollWeaponFragment():string{return rollWeapon(()=>this.random.next(),undefined,RANKS[this.state.rankIndex].fragmentMultiplier);}
  applyDot(enemy:Enemy,effect:'burn'|'poison'|'bleed',duration:number,dps:number,unit:Unit):void {
    if(enemy.side!=='player'||unit.side!=='player')return;
    const field=effect==='burn'?'burnDps':effect==='poison'?'poisonDps':'bleedDps';
    // Keep the cast's unit reference even if a later merge removes it from the board.
    // A weaker refresh extends the effect without stealing its damage/kill ownership.
    if((enemy[effect]??0)<=0||dps>=(enemy[field]??0)){
      enemy[field]=dps;const owners=this.effectOwners.get(enemy)??{};owners[effect]=unit;this.effectOwners.set(enemy,owners);
    }
    enemy[effect]=Math.max(enemy[effect]??0,duration);
  }
  grant(kind:string,side:Side='player'):CommandResult {
    if(side!=='player')return{ok:false,key:'hint.invalid'};
    if(!this.actionAllowed())return {ok:false,key:'hint.paused'};
    if(!UNITS[kind]&&!HEROES[kind]) return {ok:false,key:'hint.invalid'};
    const slot=Array.from({length:5},(_,i)=>i).find(i=>!this.state.units.some(u=>u.side===side&&u.location.zone==='bench'&&u.location.slot===i));
    if(slot===undefined)return{ok:false,key:'hint.benchFull'};
    const id=this.sequence++;
    this.state.units.push({id,kind,side,level:1,location:{zone:'bench',slot},statuses:{},energy:0,cooldown:0,production:0,buffTime:0,empowered:0,animation:0});
    return {ok:true,key:'hint.granted',unitId:id};
  }
  summon(side:Side='player'):CommandResult {
    if(side!=='player')return{ok:false,key:'hint.invalid'};
    if(!this.actionAllowed())return{ok:false,key:'hint.paused'};
    const cost=getSummonCost(this.state.sides[side].summons);
    if(this.state.sides[side].food<cost)return{ok:false,key:'hint.noFood'};
    const discarded=this.state.units.some(u=>u.side===side&&u.location.zone==='bench');
    // Validate the price before discarding. A pack replaces this bench atomically.
    this.state.units=this.state.units.filter(u=>u.side!==side||u.location.zone!=='bench');
    this.state.sides[side].food-=cost;this.state.sides[side].summons++;
    let firstId:number|undefined,shovels=0;
    for(let i=0;i<ECONOMY.summonCount;i++){
      const result=this.grant(this.props.draw(side,shovels<2),side);firstId??=result.unitId;
      const unit=this.state.units.find(u=>u.id===result.unitId);if(unit){if(unit.kind==='shovel')shovels++;this.props.promoteDraw(unit);}
    }
    return{ok:true,key:discarded?'hint.redrawn':'hint.summoned',unitId:firstId};
  }
  move(id:number,target:UnitLocation):CommandResult {
    if(!this.actionAllowed())return{ok:false,key:'hint.paused'};
    const source=this.state.units.find(u=>u.id===id);
    if(!source||source.side!=='player')return{ok:false,key:'hint.invalid'};
    if(source.kind==='shovel'&&target.zone==='board'){
      if(source.location.zone!=='bench')return{ok:false,key:'hint.toolOnly'};
      const result=this.useShovel(target.col,target.row,source.side,1);
      if(result.ok)this.state.units=this.state.units.filter(u=>u.id!==id);
      return result;
    }
    if(target.zone==='board'&&!GridSystem.owns(source.side,target.col,target.row))return{ok:false,key:'hint.enemyTerritory'};
    if(!GridSystem.canPlace(this.state,source.side,target))return{ok:false,key:'hint.invalidTile'};
    const occupant=this.state.units.find(u=>u.side===source.side&&this.sameLocation(u.location,target));
    if(occupant?.kind==='shovel'&&source.location.zone==='board')return{ok:false,key:'hint.toolOnly'};
    if(source.washing||occupant?.washing)return{ok:false,key:'m2.washing'};
    if(occupant?.id===source.id)return{ok:true,key:'hint.selected',unitId:id};
    if(occupant){
      const outcome=MergeSystem.combine(source,occupant);
      if(outcome.unit){
        this.state.units=this.state.units.filter(u=>u.id!==source.id&&u.id!==occupant.id);
        this.state.units.push(outcome.unit);
        const position=this.unitPosition(outcome.unit);
        if(HEROES[outcome.unit.kind]&&!this.state.mergedHeroes[source.side].includes(outcome.unit.kind))this.state.mergedHeroes[source.side].push(outcome.unit.kind);
        const legendary=!!HEROES[outcome.unit.kind]&&!HEROES[source.kind]&&!HEROES[occupant.kind];
        this.event({type:'purge',side:source.side,...position,textKey:'hint.purged',effect:legendary?'legendary':undefined,unitId:outcome.unit.id,duration:1.4});
        return{ok:true,key:outcome.key,unitId:outcome.unit.id};
      }
      if(outcome.swap){const from=source.location;source.location={...target};occupant.location={...from};source.animation=1;occupant.animation=1;}
      if(!outcome.ok)this.event({type:'bubble',side:source.side,...this.unitPosition(occupant),textKey:outcome.key,unitId:occupant.id,duration:1.6});
      return{ok:outcome.ok,key:outcome.key,unitId:id};
    }
    source.location={...target};source.animation=1;return{ok:true,key:'hint.deployed',unitId:id};
  }
  storeShovel(id:number):CommandResult {
    if(!this.actionAllowed())return{ok:false,key:'hint.paused'};
    const unit=this.state.units.find(u=>u.id===id&&u.side==='player'&&u.kind==='shovel'&&u.location.zone==='bench');
    if(!unit)return{ok:false,key:'hint.toolOnly'};
    if(this.state.sides.player.shovels>=this.getShovelRules().maxStored)return{ok:false,key:'hint.shovelFull'};
    this.state.sides.player.shovels++;this.state.units=this.state.units.filter(u=>u.id!==id);
    return{ok:true,key:'hint.shovelStored'};
  }
  dig(col:number,row:number,side:Side='player'):CommandResult {
    if(!this.actionAllowed())return{ok:false,key:'hint.paused'};
    if(side!=='player')return{ok:false,key:'hint.invalid'};
    const resources=this.state.sides[side],tile=this.state.grid[row]?.[col],remaining=2-(this.state.craterHits[col+','+row]??0);
    const amount=tile==='B'?Math.min(remaining,resources.shovels):Math.min(1,resources.shovels);
    if(!GridSystem.owns(side,col,row)||!['G','B'].includes(tile))return{ok:false,key:'hint.invalidTile'};
    if(amount<=0)return{ok:false,key:'hint.noShovels'};
    const result=this.useShovel(col,row,side,amount);if(result.ok)resources.shovels-=amount;return result;
  }
  private useShovel(col:number,row:number,side:Side,amount:number):CommandResult {
    if(!GridSystem.owns(side,col,row))return{ok:false,key:'hint.invalidTile'};
    const tile=this.state.grid[row][col],key=col+','+row;
    if(tile!=='G'&&tile!=='B')return{ok:false,key:'hint.invalidTile'};
    if(tile==='B'&&(this.state.craterHits[key]??0)+amount<2){
      this.state.craterHits[key]=1;
      this.event({type:'bubble',side,col,row,textKey:'hint.repairProgress',duration:1.2});
      return{ok:true,key:'hint.repairProgress'};
    }
    this.state.grid[row][col]='O';delete this.state.craterHits[key];
    if(tile==='G')this.props.treasure(side,col,row);
    this.event({type:'burst',side,col,row,duration:.6,color:'#8fbd75'});
    return{ok:true,key:tile==='B'?'hint.repaired':'hint.dig'};
  }
  spawnBoss(kind:string,side?:Side):CommandResult {
    if(!this.actionAllowed())return{ok:false,key:'hint.paused'};
    if(!ENEMIES[kind]?.boss)return{ok:false,key:'hint.invalid'};
    if(side==='ai')return{ok:false,key:'hint.invalid'};
    this.spawnEnemy(kind,'player');
    return{ok:true,key:'hint.boss'};
  }
  spawnEnemy(kind:string,side:Side,scale=1):Enemy {
    const config=ENEMIES[kind];if(!config)throw new Error('Unknown enemy');
    scale*=RANKS[this.state.rankIndex].hpMultiplier*(this.props.has('player','shared_oranges')?1.15:1);
    const p=GridSystem.pathPosition(side,0,this.state.mapId);
    const enemy:Enemy={id:side==='player'?this.sequence++:0,kind,side,boss:config.boss,hp:config.hp*scale,maxHp:config.hp*scale,progress:0,col:p.col,row:p.row,speed:config.speed*(this.props.has('player','hyper_party')?1.12:1),armor:config.armor,size:1,abilityCooldown:config.interval,stun:0,slow:0,slowFactor:1,burn:0,burnDps:0,poison:0,poisonDps:0,stolenBy:[],hitFlash:0};
    if(side!=='player')return enemy;
    this.enemyEverSpawned=true;
    this.state.enemies.push(enemy);
    if(enemy.boss){
      this.event({type:'bubble',side,col:p.col,row:p.row,textKey:`boss.${kind}.bubble`,effect:'boss_spawn',duration:2.2});
      if(['box_kraken','sad_rain_frog','king_skunk'].includes(kind))this.bossAbility(enemy);
    }
    return enemy;
  }
  adjustOranges(delta:number,side:Side='player'):void {
    if(side!=='player'||!this.actionAllowed()||!Number.isFinite(delta))return;
    this.state.sides[side].oranges=Math.max(0,this.state.sides[side].oranges+Math.trunc(delta));
    this.event({type:'orange',side,...getMap(this.state.mapId).paths.player.at(-1)!,value:delta,duration:1.2,textKey:delta<0?'hint.orangeLost':'hint.orangeAdded'});
    if(this.state.sides[side].oranges===0)this.finish(side==='player'?'ai':'player','oranges');
  }
  addFood(amount:number,side:Side='player'):void { if(side==='player'&&this.actionAllowed()&&Number.isFinite(amount))this.state.sides[side].food=Math.max(0,this.state.sides[side].food+Math.trunc(amount)); }
  skipWave():void {
    if(!this.actionAllowed())return;
    // Skipping drops pending enemies without kill income or loot.
    this.state.enemies=[];
    if(this.state.wave>=10){this.finishByScore();return;}
    this.beginWave(Math.max(1,this.state.wave+1));
  }
  surrender():void { if(this.state.phase==='playing'||this.state.phase==='paused')this.finish('ai','surrender'); }
  private actionAllowed():boolean { return this.state.phase==='ready'||this.state.phase==='playing'; }
  private sameLocation(a:UnitLocation,b:UnitLocation):boolean {
    return a.zone==='bench'&&b.zone==='bench'?a.slot===b.slot:a.zone==='board'&&b.zone==='board'&&a.col===b.col&&a.row===b.row;
  }
  unitPosition(unit:Unit):Point { return unit.location.zone==='board'?unit.location:{col:(STAGE.benchX+unit.location.slot*STAGE.benchStep+STAGE.benchSize/2-STAGE.boardX)/STAGE.cell-.5,row:(STAGE.benchY+STAGE.benchSize/2-STAGE.boardY)/STAGE.cell-.5}; }
  event(event:Omit<VisualEvent,'id'|'age'>):void { this.state.events.push({...event,id:this.sequence++,age:0}); }
  private step(dt:number):void {
    this.state.time+=dt;
    this.state.events=this.state.events.filter(e=>(e.age+=dt)<e.duration);
    this.props.tick(dt);
    for(const side of ['player'] as Side[]){
      const resources=this.state.sides[side];resources.fog=Math.max(0,resources.fog-dt);
      const rules=this.getShovelRules(side);
      if(resources.shovels>=rules.maxStored){resources.shovelTimer=0;continue;}
      resources.shovelTimer+=dt;
      if(resources.shovelTimer+1e-8>=rules.interval){
        resources.shovelTimer=Math.max(0,resources.shovelTimer-rules.interval);
        resources.shovels=Math.min(rules.maxStored,resources.shovels+SHOVEL_PRODUCTION.amount);
      }
    }
    if(this.options.autoWaves!==false)this.updateWaves(dt);
    for(const unit of [...this.state.units]){
      if(unit.side!=='player')continue;
      for(const status of Object.keys(unit.statuses) as (keyof Unit['statuses'])[]){
        const left=(unit.statuses[status]??0)-dt;if(left<=0)delete unit.statuses[status];else unit.statuses[status]=left;
      }
      unit.attackAnim=Math.max(0,(unit.attackAnim??0)-dt*3.1);unit.animation=Math.max(0,unit.animation-dt*3);unit.buffTime=Math.max(0,unit.buffTime-dt);unit.powerTime=Math.max(0,(unit.powerTime??0)-dt);
      if(unit.location.zone!=='board'||unit.kind==='shovel')continue;
      if(unit.statuses.SEALED||unit.statuses.KNOCKDOWN||unit.statuses.CONFUSED||unit.washing)continue;
      if(unit.kind==='bee'){
        const production=getBeeProduction(unit.level,this.state.sides[unit.side].loadout),interval=production.interval;unit.production+=dt;
        while(unit.production+1e-8>=interval){unit.production-=interval;this.state.sides[unit.side].food+=production.amount;this.event({type:'bubble',side:unit.side,...unit.location,textKey:'hint.food',value:production.amount,duration:1});}
        continue;
      }
      const stats=this.stats(unit);
      unit.cooldown-=dt;
      if(unit.cooldown>1e-8)continue;
      const candidates=this.state.enemies.filter(e=>e.side===unit.side&&e.hp>0&&GridSystem.distance(unit.location as Point,e)<=stats.range).sort((a,b)=>b.progress-a.progress);
      if(!candidates.length){unit.cooldown=0;continue;}
      this.attack(unit,candidates[0],stats.damage);
      // Preserve the fractional overshoot so fixed steps never reduce the configured attack rate.
      unit.cooldown+=1/this.getEffectiveUnitStats(unit).rate;
      unit.animation=1;
      if(HEROES[unit.kind]){
        unit.energy++;
        const required=this.stats(unit).charge;
        if(unit.energy>=required){unit.energy=0;this.ultimate(unit,candidates[0],stats.damage);}
      }
    }
    for(const enemy of [...this.state.enemies]){
      if(enemy.side!=='player')continue;
      if(enemy.hp<=0)continue;
      enemy.hitFlash=Math.max(0,enemy.hitFlash-dt);if(enemy.hitFlash===0){enemy.knockX=0;enemy.knockY=0;}
      for(const effect of ['burn','poison','bleed'] as const){
        const remaining=enemy[effect]??0;if(remaining<=0)continue;
        const dps=effect==='burn'?enemy.burnDps:effect==='poison'?enemy.poisonDps:enemy.bleedDps??0;
        this.hurt(enemy,dps*Math.min(dt,remaining),this.effectOwners.get(enemy)?.[effect],false,true,false,true);
        enemy[effect]=Math.max(0,remaining-dt);
      }
      enemy.armorBreak=Math.max(0,(enemy.armorBreak??0)-dt);
      if(enemy.hp<=0)continue;
      enemy.stun=Math.max(0,enemy.stun-dt);enemy.slow=Math.max(0,enemy.slow-dt);
      if(enemy.boss){enemy.abilityCooldown-=dt;if(enemy.abilityCooldown<=0){this.bossAbility(enemy);enemy.abilityCooldown=ENEMIES[enemy.kind].interval;}}
      if(enemy.hp<=0)continue;
      const hasteDuration=Math.min(dt,Math.max(0,enemy.hasteTime??0));enemy.hasteTime=Math.max(0,(enemy.hasteTime??0)-dt);
      if(enemy.stun<=0)enemy.progress+=enemy.speed*(dt+.3*hasteDuration)*(enemy.slow>0?enemy.slowFactor:1)*(this.props.has(enemy.side,'banana_peel')?.88:1);
      Object.assign(enemy,GridSystem.pathPosition(enemy.side,enemy.progress,this.state.mapId));
      this.props.onEnemy(enemy);if(enemy.hp<=0)continue;
      if(enemy.progress>=getMap(this.state.mapId).paths.player.length-1){
        this.state.enemies=this.state.enemies.filter(e=>e.id!==enemy.id);
        this.adjustOranges(enemy.boss?-2:-1,enemy.side);
        if(this.state.phase==='finished')break;
      }
    }
    this.state.enemies=this.state.enemies.filter(e=>e.hp>0);
    if(this.options.autoWaves!==false&&this.state.wave===10&&this.state.spawned>=WAVES[9].count&&this.state.enemies.length===0&&this.state.phase==='playing')this.finishByScore();
  }
  private beginWave(wave:number):void {
    this.state.wave=wave;this.state.waveTime=0;this.state.nextSpawn=wave===1?FIRST_WAVE_PREPARATION:1;this.state.spawned=0;
    for(const side of ['player'] as Side[]){
      if(wave>1)this.state.sides[side].food+=ECONOMY.waveIncome;
    }
    this.event({type:'bubble',side:'player',col:3.5,row:4.5,textKey:'hint.wave',value:wave,duration:1.8});
    const boss=bossForWave(this.state.mapId,this.state.rankIndex,wave,()=>this.random.next());if(boss)this.spawnBoss(boss);
  }
  private updateWaves(dt:number):void {
    if(!this.state.wave)return;
    this.state.waveTime+=dt;this.state.nextSpawn-=dt;
    const config=WAVES[this.state.wave-1];
    if(this.state.spawned<config.count&&this.state.nextSpawn<=0){
      const index=this.state.spawned,kind=this.state.wave<3?'rat':index%5===4?'crab':index%3===1?'roach':'rat';
      for(const side of ['player'] as Side[])this.spawnEnemy(kind,side,config.hpScale);
      this.state.spawned++;this.state.nextSpawn=config.interval;
    }
    if(this.state.wave<10&&this.state.waveTime+1e-8>=WAVE_DURATION)this.beginWave(this.state.wave+1);
  }
  getUnitStats(unit:Unit):UnitStats {
    const base=getBaseUnitStats(unit.kind,unit.level);
    if(!UNITS[unit.kind]&&!HEROES[unit.kind]||unit.kind==='shovel')return base;
    return this.weapons.stats(unit,{...base,rate:base.rate*(1+this.props.haste(unit.side))});
  }
  getEffectiveUnitStats(unit:Unit):UnitStats {
    const stats=this.getUnitStats(unit);
    return{...stats,rate:stats.rate*((unit.statuses.WET??0)>0?.55:1)*(unit.buffTime>0?4:1)};
  }
  private stats(unit:Unit){return this.getUnitStats(unit);}
  lane(side:Side):Enemy[] { return this.state.enemies.filter(e=>e.side===side&&e.hp>0); }
  private shot(unit:Unit,enemy:Enemy,color?:string):void {
    this.event({type:'projectile',side:unit.side,...this.unitPosition(unit),targetCol:enemy.col,targetRow:enemy.row,color:color??HEROES[unit.kind]?.color??UNITS[unit.kind]?.color,duration:.25,unitId:unit.id,effect:unit.kind});
  }
  hurt(enemy:Enemy,amount:number,unit?:Unit,critical=false,weaponHooks=true,trueDamage=false,periodic=false):void {
    if(enemy.side!=='player'||unit?.side==='ai'||enemy.hp<=0||amount<=0)return;
    const damage=amount*(unit?this.weapons.damageMultiplier(unit,enemy):1)*(trueDamage||(enemy.armorBreak??0)>0?1:1-enemy.armor),actual=Math.min(enemy.hp,damage);enemy.hp-=damage;
    if(amount>=3){
      enemy.hitFlash=.14;const source=unit?this.unitPosition(unit):{col:enemy.col,row:enemy.row+1},dx=enemy.col-source.col,dy=enemy.row-source.row,len=Math.hypot(dx,dy)||1;
      enemy.knockX=dx/len*5;enemy.knockY=dy/len*5;
      this.event({type:'hit',side:enemy.side,col:enemy.col,row:enemy.row,effect:'vfx_hit_burst',duration:.18});
    }
    this.state.sides[enemy.side].damage+=actual;
    if(amount>=3)this.event({type:'damage',side:enemy.side,col:enemy.col,row:enemy.row,value:Math.round(damage),color:critical?'#f16941':'#fff7da',duration:.65});
    if(enemy.hp<=0){
      const owner=this.state.sides[enemy.side];owner.kills++;
      if(enemy.boss){
        const count=1+Math.floor(this.random.next()*2);
        for(let i=0;i<count;i++)owner.loot.push(this.rollWeaponFragment());
      }
      const food=enemy.boss?ECONOMY.bossKillFood:ECONOMY.killFood;owner.food+=food;
      this.event({type:'food',side:enemy.side,col:enemy.col,row:enemy.row,value:food,textKey:'hint.food',duration:1.1});
      this.event({type:'death',side:enemy.side,col:enemy.col,row:enemy.row,effect:'vfx_dust_puff',duration:.55});
      if(unit?.kind==='doge_wick'&&this.random.next()<(this.weapons.awakened(unit)?.85:.5))owner.food+=2;
      this.event({type:'burst',side:enemy.side,col:enemy.col,row:enemy.row,duration:.5,color:enemy.boss?'#f9bd56':'#c4dec7'});
      if(unit&&weaponHooks)this.weapons.onKill(unit);
    }
    if(unit&&weaponHooks&&!periodic)this.weapons.onHit(unit,enemy,amount);
  }
  private splash(unit:Unit,center:Point,radius:number,damage:number,critical=false):void {
    for(const enemy of this.lane(unit.side))if(GridSystem.distance(center,enemy)<=radius)this.hurt(enemy,damage,unit,critical);
  }
  private pierce(unit:Unit,target:Enemy,damage:number,max=3):void {
    const start=this.unitPosition(unit),dx=target.col-start.col,dy=target.row-start.row,len=Math.hypot(dx,dy)||1;
    const hits=this.lane(unit.side).filter(e=>{
      const x=e.col-start.col,y=e.row-start.row,along=(x*dx+y*dy)/len,across=Math.abs(x*dy-y*dx)/len;
      return along>=0&&along<=this.stats(unit).range+1&&across<.5;
    }).sort((a,b)=>GridSystem.distance(start,a)-GridSystem.distance(start,b)).slice(0,max);
    for(const e of hits)this.hurt(e,damage,unit);
  }
  private attack(unit:Unit,target:Enemy,damage:number):void {
    const position=this.unitPosition(unit),dx=target.col-position.col,dy=target.row-position.row,style=COMBAT_STYLES[unit.kind];
    unit.attackAngle=Math.atan2(dy,dx);unit.facing=dx<0?-1:1;unit.attackAnim=1;
    if(style&&['spin360','cleave180','cross_slash','thrust'].includes(style)){
      const awakened=!!this.weapons.awakened(unit),empowered=unit.empowered>0;
      // The empowered Puss branch below is the only critical basic slash. Capture it
      // before its final charge is consumed; later ultimates/hooks are separate attacks.
      const critical=unit.kind==='puss_in_hat'&&empowered;
      const presentation=Object.freeze({sourceKind:unit.kind,hero:!!HEROES[unit.kind],awakened,empowered,critical,enhanced:awakened||empowered||critical});
      this.event({type:'slash',side:unit.side,...position,targetCol:target.col,targetRow:target.row,unitId:unit.id,effect:unit.kind==='samurai_doge'?'heavy_cleave':style,duration:.33,presentation});
    }
    else this.shot(unit,target);
    switch(unit.kind){
      case 'hedgehog':this.pierce(unit,target,damage);break;
      case 'corgi':this.hurt(target,damage,unit);for(const other of this.lane(unit.side))if(other.id!==target.id&&GridSystem.distance(target,other)<=.8)this.hurt(other,damage*.5,unit);break;
      case 'doge_wick':this.pierce(unit,target,damage*.5);this.shot(unit,target,'#f5dc89');this.pierce(unit,target,damage*.5);break;
      case 'puss_in_hat':
        if(unit.empowered>0){unit.empowered--;for(const other of this.lane(unit.side))if((Math.abs(other.col-target.col)<=.35||Math.abs(other.row-target.row)<=.35)&&GridSystem.distance(target,other)<=1.2){this.hurt(other,damage*2.2,unit,true);if(this.weapons.awakened(unit))this.applyDot(other,'bleed',3,damage*.35,unit);}}
        else this.hurt(target,damage,unit);break;
      case 'rocket_coon':
        if(!target.stolenBy.includes(unit.id)){target.stolenBy.push(unit.id);if(this.random.next()<(this.weapons.awakened(unit)?.4:.2)){this.state.sides[unit.side].food++;this.event({type:'bubble',side:unit.side,...this.unitPosition(unit),textKey:'hint.stolen',duration:1});}}
        this.hurt(target,damage,unit);break;
      default:this.hurt(target,damage,unit);
    }
    this.weapons.onAttack(unit,target,damage);
  }
  private ultimate(unit:Unit,target:Enemy,damage:number):void {
    const position=this.unitPosition(unit),lane=this.lane(unit.side),awakened=this.weapons.awakened(unit);
    this.event({type:'bubble',side:unit.side,...position,textKey:`ult.${unit.kind}`,duration:1.7,unitId:unit.id});
    if(!['ronin_goose','purrcerer','ballin_rooster'].includes(unit.kind))this.event({type:'burst',side:unit.side,...position,color:HEROES[unit.kind].color,unitId:unit.id,duration:.7});
    switch(unit.kind){
      case 'kungfu_po':for(const e of lane)if(GridSystem.distance(position,e)<=2.2*(awakened?1.3:1)){this.hurt(e,damage*3.5,unit,true);e.stun=2;}if(awakened)this.weapons.bamboo(unit,position,2.2*1.3,damage,'bamboo_ring');break;
      case 'bamboo_mafia':
        for(let i=0;i<(awakened?8:5);i++){const live=this.lane(unit.side);if(!live.length)break;const e=live[Math.floor(this.random.next()*live.length)];this.shot(unit,e,'#ee8d59');for(const hit of live)if(GridSystem.distance(e,hit)<=.85){this.hurt(hit,damage*1.5,unit,true);this.applyDot(hit,'burn',3,damage*.35,unit);}}
        break;
      case 'zen_master':{
        const progress=target.progress;for(let wave=0;wave<(awakened?2:1);wave++)for(const e of lane)if(e.progress<=progress+.5){this.hurt(e,damage*2.8,unit,true);this.knockback(e,1.4);}
        if(awakened)this.event({type:'weapon',side:unit.side,...position,effect:'yin_yang_double',duration:1});break;
      }
      case 'puss_in_hat':unit.empowered=awakened?6:4;break;
      case 'meowfia':unit.buffTime=awakened?4:2.5;unit.cooldown=.02;break;
      case 'purrcerer':{
        const points:Point[]=[{...position}];
        for(const e of lane.sort((a,b)=>GridSystem.distance(target,a)-GridSystem.distance(target,b)).slice(0,awakened?10:6)){points.push({col:e.col,row:e.row});this.hurt(e,damage*2.4,unit,true);e.stun=.6;}
        this.event({type:'bounce',side:unit.side,...position,points,effect:'yarn',duration:1.1,unitId:unit.id});break;
      }
      case 'samurai_doge':
        for(const e of lane)if(GridSystem.distance(target,e)<=.65){this.hurt(e,damage*4.5,unit,true);if(!e.boss&&e.hp>0&&e.hp/e.maxHp<(awakened?.35:.25))this.hurt(e,e.hp/(1-e.armor)+1,unit,true);}
        if(awakened)this.weapons.projectiles(unit,2,damage,'fish');break;
      case 'doge_wick':for(let i=0;i<3;i++){this.pierce(unit,target,damage*2.8,99);this.shot(unit,target,'#f5dc89');}break;
      case 'ronin_goose':{
        const points:Point[]=[{...position}],count=awakened?10:7;
        for(let i=0;i<count;i++){const live=this.lane(unit.side).sort((a,b)=>GridSystem.distance(position,a)-GridSystem.distance(position,b)),e=live[i%Math.max(1,live.length)];
          if(e){const end={col:e.col+(i%2?-.25:.25),row:e.row+(i%2?.18:-.18)};points.push(end);this.hurt(e,damage*1.6,unit,true);}else points.push({...position});}
        this.event({type:'dash',side:unit.side,...position,points,effect:'goose',duration:1.1,unitId:unit.id});break;
      }
      case 'ballin_rooster':{
        for(const e of lane)if(GridSystem.distance(position,e)<=2.2)this.knockback(e,1);
        const points:Point[]=[{...position}];
        for(let i=0;i<(awakened?12:8);i++){const live=this.lane(unit.side);if(!live.length)break;const e=live[i%live.length];points.push({col:e.col,row:e.row});this.hurt(e,damage*2,unit,true);}
        this.event({type:'bounce',side:unit.side,...position,points,effect:'basketball',duration:1.1,unitId:unit.id});break;
      }
      case 'rocket_coon':this.splash(unit,target,1.4*(awakened?1.4:1),damage*3.2,true);break;
      case 'pepe_king':for(const e of lane){e.slow=awakened?6:4;e.slowFactor=.6;this.applyDot(e,'poison',awakened?6:4,damage*.65,unit);if(awakened)e.armorBreak=6;}break;
    }
  }
  knockback(enemy:Enemy,amount:number):void { enemy.progress=Math.max(0,enemy.progress-amount);Object.assign(enemy,GridSystem.pathPosition(enemy.side,enemy.progress,this.state.mapId)); }
  private bossAbility(enemy:Enemy):void {
    if(this.props.blockBoss(enemy))return;
    const units=this.state.units.filter(u=>u.side===enemy.side&&u.location.zone==='board');
    switch(enemy.kind){
      case 'husky_wrecker':{
        const broken=this.state.grid.flatMap((tiles,row)=>tiles.map((tile,col)=>({tile,col,row}))).filter(cell=>cell.tile==='B'&&GridSystem.owns(enemy.side,cell.col,cell.row)).length;
        if(broken>=(ENEMIES.husky_wrecker.maxBrokenTiles??2))break;
        const cells:Point[]=[];
        for(let row=0;row<GRID_ROWS;row++)for(let col=0;col<GRID_COLS;col++)if(GridSystem.owns(enemy.side,col,row)&&this.state.grid[row][col]==='O'&&!units.some(u=>u.location.zone==='board'&&u.location.col===col&&u.location.row===row))cells.push({col,row});
        const cell=cells.sort((a,b)=>GridSystem.distance(enemy,a)-GridSystem.distance(enemy,b))[0];
        if(cell){this.state.grid[cell.row][cell.col]='B';delete this.state.craterHits[cell.col+','+cell.row];this.event({type:'burst',side:enemy.side,...cell,color:'#bd9478',duration:1});}break;
      }
      case 'mega_roomba':{
        const victim=units.filter(u=>UNITS[u.kind]?.category==='basic'&&GridSystem.distance(this.unitPosition(u),enemy)<=1.2).sort((a,b)=>a.level-b.level||a.id-b.id)[0];
        if(victim){this.state.units=this.state.units.filter(u=>u.id!==victim.id);enemy.hp=Math.min(enemy.maxHp,enemy.hp+enemy.maxHp*.2);enemy.size*=1.15;}break;
      }
      case 'dr_clippers':for(const u of units.filter(u=>GridSystem.distance(this.unitPosition(u),enemy)<=2).sort((a,b)=>b.level-a.level).slice(0,2)){u.level=Math.max(1,u.level-1);u.statuses.MERGE_LOCK=5;u.animation=1;}break;
      case 'box_kraken':{
        const victim=units.sort((a,b)=>b.level-a.level||this.stats(b).damage-this.stats(a).damage)[0];
        if(victim)victim.statuses.SEALED=18;break;
      }
      case 'sad_rain_frog':for(const u of units)u.statuses.WET=18;break;
      case 'king_skunk':this.state.sides[enemy.side].fog=6;break;
      default:applyNewBossMechanic(this,enemy,units);
    }
    this.event({type:'bubble',side:enemy.side,col:enemy.col,row:enemy.row,textKey:`boss.${enemy.kind}.bubble`,duration:1.5});
  }
  private finishByScore():void {
    this.finish(this.state.sides.player.oranges>0?'player':'ai','waves');
  }
  private finish(winner:Side,reason:'oranges'|'waves'|'surrender'):void {
    if(this.state.result)return;
    const playerLoot=[...this.state.sides.player.loot],aiLoot:string[]=[];
    this.state.result={winner,reason,loot:winner==='player'?[...playerLoot]:[],playerLoot,aiLoot,coins:winner==='player'?RANKS[this.state.rankIndex].winCoins+Math.min(45,Math.floor(this.state.sides.player.food*.5)):0,elapsed:this.state.time,rankIndex:this.state.rankIndex,mergedHeroes:[...this.state.mergedHeroes.player]};this.state.phase='finished';
  }
}
