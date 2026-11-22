import { GridSystem } from './GridSystem';
import { ECONOMY, getSummonCost, SHOVEL_PRODUCTION, UNITS } from '../config/units';
import { HEROES } from '../config/heroes';
import { ENEMIES } from '../config/enemies';
import {getMap,GRID_ROWS,GRID_COLS,STAGE} from '../config/maps';
import {COMBAT_STYLES} from '../config/combat';
import {progressionFor,getUnlockedBossIds,getUnlockedMinionIds} from '../config/progression';
import {RANKS,getRankDifficulty} from '../config/ranks';
import {applyNewBossMechanic} from './BossMechanics';
import {rollWeapon} from '../config/weapons';
import {getVillageBuff,type VillageBuffKey,type VillageResourceId} from '../config/village';
import {AWAKENED_DAMAGE,AWAKENED_RATE,STANDARD_VICTORY_CRESTS,armorPenetration,bossResist,bossSlayerMultiplier,breakthroughAttackMultiplier,capyShieldCooldown,computeBreakthroughChance,endlessCrestsForWave,getMedallionLevel,momentumMultiplier,type BreakthroughChance,type MedallionId} from '../config/medallions';
import {ELITE_ENEMY_IDS,INGREDIENT_IDS,MAP_SIGNATURE_INGREDIENT,getActiveBroth,getBrothEffect,getKitchenCollectionAura,getUnitCombatFamily,type BrothEffectKey,type IngredientId} from '../config/kitchen';
import { FIRST_WAVE_PREPARATION, WAVE_DURATION,bossesForWave,waveEnemyCount,minionForWave,getWaveConfig } from '../config/waves';
import { MergeSystem } from './MergeSystem';
import {CombatRecords} from './CombatRecords';
import type {OpponentTuning} from '../config/opponents';
import { Random } from './Random';
import {copyLoadout,PropSystem,type PropTarget} from './PropSystem';
import {WeaponSystem} from './WeaponSystem';
import {getBaseUnitStats,getBeeProduction,type UnitStats} from './UnitStats';
import type { BattleLoadout,BattleState, CommandResult, Enemy, Point, Side, Unit, UnitLocation, VisualEvent,SideState,MapId,WavePreview } from './types';
export interface FeatureDropFlags { armory?:boolean; village?:boolean; kitchen?:boolean; medallions?:boolean }
export interface EngineOptions { seed?:number; autoWaves?:boolean; ai?:boolean; loadouts?:Partial<Record<Side,Partial<BattleLoadout>>>; mapId?:MapId; rankIndex?:number; aiOverrides?:Partial<OpponentTuning>; tutorialGuided?:boolean; progressionStars?:number; progressionHeroes?:string[]; featureDrops?:FeatureDropFlags; unlockedWeapons?:readonly string[] }
let battleSequence=0;
export class BattleEngine {
  state:BattleState;
  private sequence=1;
  private random:Random;
  /** P14 ingredient drops draw only from this stream; `random` keeps its exact P13 sequence. */
  private ingredientRandom:Random;
  /** P16 building-material drops and pavilion fragment rolls; never touches `random` or `ingredientRandom`. */
  private villageRandom:Random;
  /** P17 breakthrough rolls and Calm Ward resist checks; only ever drawn in endless with a qualifying action. */
  private endlessRandom:Random;
  private props:PropSystem;
  private weapons:WeaponSystem;
  private enemyEverSpawned=false;
  private tutorialHold=false;
  private transitionHold=false;
  private announcedElites=new Set<string>();
  private unlockedDraws?:Set<string>;
  private pendingBosses:{kind:string;at:number}[]=[];
  private waveBossSchedule:readonly (readonly string[])[];
  private bossSeed:number;
  private lockedBenchUnit?:Unit;
  private combatRecords=new CombatRecords();
  private luckyDrops=0;
  private effectOwners=new WeakMap<Enemy,Partial<Record<'burn'|'poison'|'bleed',Unit>>>();
  constructor(public options:EngineOptions={}) {
    const seed=options.seed??Math.floor(Math.random()*0xffffffff);
    this.random=new Random(seed);
    this.ingredientRandom=new Random(((seed^0x27d4eb2d)>>>0)||1);
    this.villageRandom=new Random(((seed^0x517cc1b7)>>>0)||1);
    this.endlessRandom=new Random(((seed^0x9e3779b1)>>>0)||1);
    const mapId=getMap(options.mapId).id,rankIndex=Number.isFinite(options.rankIndex)?Math.max(0,Math.min(53,Math.trunc(options.rankIndex!))):0;
    this.bossSeed=((seed^0x6d2b79f5)>>>0)||1;
    const scheduleRandom=new Random(this.bossSeed);
    if(options.progressionStars!==undefined)this.unlockedDraws=new Set(progressionFor({stars:options.progressionStars,highestStars:options.progressionStars,mergedHeroes:options.progressionHeroes??[]}).units);
    this.waveBossSchedule=Array.from({length:10},(_,i)=>{
      const originals=bossesForWave(mapId,rankIndex,i+1,()=>scheduleRandom.next());
      return Object.freeze(this.restrictBosses(originals,i+1));
    });
    const side=(side:Side):SideState=>({lockedBenchSlot:null,food:ECONOMY.initialFood,summons:0,oranges:ECONOMY.initialOranges,shovels:ECONOMY.initialShovels,shovelTimer:0,kills:0,damage:0,loot:[],ingredientLoot:[],villageLoot:[],fog:0,loadout:copyLoadout(side==='player'?options.loadouts?.player:undefined),propCooldowns:{},sprinklerUsed:false,giantCatUses:0,catnipTime:0,capyShieldReady:false,capyShieldTimer:0,endlessCrests:0});
    this.state={id:`${Date.now()}-${++battleSequence}`,phase:'ready',time:0,wave:0,waveTime:0,nextSpawn:0,spawned:0,mapId,rankIndex,mergedHeroes:{player:[],ai:[]},grid:GridSystem.create(mapId),craterHits:{},sides:{player:side('player'),ai:side('ai')},units:[],enemies:[],events:[],traps:[],result:null};
    this.props=new PropSystem(this,()=>this.random.next());this.props.initialize();this.weapons=new WeaponSystem(this,()=>this.random.next());
  }
  start():void {
    if(this.state.phase!=='ready')return;
    this.state.phase='playing';if(this.options.autoWaves!==false)this.beginWave(1);
  }
  /** The UI banks the standard result before opting in; the headless default still ends at ten. */
  enterEndless():CommandResult {
    const s=this.state,result=s.result;
    if(s.phase!=='finished'||s.endless||s.wave!==10||s.sides.player.oranges<=0||
      !result||result.winner!=='player'||result.reason!=='waves'||result.endless)return{ok:false,key:'hint.invalid'};
    s.standardResult={...result,loot:[...result.loot],playerLoot:[...result.playerLoot],aiLoot:[...result.aiLoot],
      mergedHeroes:result.mergedHeroes?[...result.mergedHeroes]:undefined,mvp:result.mvp?{...result.mvp}:undefined,
      ingredientLoot:result.ingredientLoot?Object.freeze([...result.ingredientLoot]) as string[]:undefined,
      villageLoot:result.villageLoot?Object.freeze([...result.villageLoot]) as string[]:undefined};
    Object.freeze(s.standardResult.loot);Object.freeze(s.standardResult.playerLoot);Object.freeze(s.standardResult.aiLoot);
    if(s.standardResult.mergedHeroes)Object.freeze(s.standardResult.mergedHeroes);
    if(s.standardResult.mvp)Object.freeze(s.standardResult.mvp);
    Object.freeze(s.standardResult);
    s.endless=true;s.endlessCoins=0;s.endlessClearedWave=10;s.result=null;s.phase='playing';
    // Capybara Bubble Shield: one charge is ready the moment endless begins.
    s.sides.player.capyShieldReady=this.medallion('med_capy_shield')>0;s.sides.player.capyShieldTimer=0;
    this.tutorialHold=false;this.transitionHold=false;
    this.beginWave(11,false);
    return{ok:true,key:'hint.wave'};
  }
  tick(dt:number):void {
    if(!Number.isFinite(dt)||dt<=0||this.state.phase!=='playing')return;
    if(this.state.sides.player.oranges<=0){this.finish('ai','oranges');return;}
    let remaining=Math.min(dt,600);
    while(remaining>1e-8&&this.state.phase==='playing'){
      const step=Math.min(.05,remaining);this.step(step);remaining-=step;
    }
  }
  pause(value=true):void {
    if(this.state.phase!=='playing'&&this.state.phase!=='paused')return;
    this.state.phase=value?'paused':'playing';
    if(!value&&this.state.sides.player.oranges<=0)this.finish('ai','oranges');
  }
  setTutorialHold(active:boolean):void {
    if(!active&&this.tutorialHold&&this.state.wave===1&&this.state.spawned===0){
      this.state.nextSpawn=Math.max(8,this.state.nextSpawn);
      this.state.waveTime=Math.min(this.state.waveTime,FIRST_WAVE_PREPARATION-this.state.nextSpawn);
    }
    this.tutorialHold=active;
  }
  setTransitionHold(active:boolean):void {this.transitionHold=active;}
  isDrawUnlocked(kind:string):boolean {return !this.unlockedDraws||this.unlockedDraws.has(kind);}
  private unlockedEnemy(kind:string):string {
    if(this.options.progressionStars===undefined)return kind;
    if(ENEMIES[kind]?.boss){const pool=getUnlockedBossIds(this.options.progressionStars);return pool.includes(kind)?kind:pool[Math.max(0,this.state.wave-1)%pool.length];}
    return getUnlockedMinionIds(this.options.progressionStars).includes(kind)?kind:kind==='killer_bee'?'roach':'rat';
  }
  private restrictBosses(originals:readonly string[],wave:number):string[] {
    if(this.options.progressionStars===undefined)return [...originals];
    const pool=getUnlockedBossIds(this.options.progressionStars),chosen:string[]=[];
    originals.forEach((id,n)=>{
      const available=pool.filter(b=>!chosen.includes(b)),index=wave-1+n;
      chosen.push(available.includes(id)?id:available[index%available.length]??pool[index%pool.length]);
    });
    return chosen;
  }
  private bossesForCurrentSchedule(wave:number):readonly string[] {
    if(wave<=10)return this.waveBossSchedule[wave-1]??[];
    // Derive each wave independently: preview order and frequency cannot affect draws or boss choices.
    const random=new Random(((this.bossSeed^Math.imul(wave,0x9e3779b1))>>>0)||1);
    return this.restrictBosses(bossesForWave(this.state.mapId,this.state.rankIndex,wave,()=>random.next()),wave);
  }
  currentWaveTargetCount():number {return waveEnemyCount(Math.max(1,this.state.wave),this.state.rankIndex);}
  getUpcomingWavePreview():WavePreview|null {
    if(this.state.phase==='finished'||(!this.state.endless&&this.state.wave>=10))return null;
    const wave=this.state.wave<=1&&this.state.spawned===0?1:this.state.wave+1;
    const count=waveEnemyCount(wave,this.state.rankIndex);
    const kinds=new Set(Array.from({length:count},(_,i)=>this.unlockedEnemy(minionForWave(wave,i,this.state.rankIndex))));
    const minion=['charmed_rat','killer_bee','crab','roach','rat'].find(kind=>kinds.has(kind))!;
    return{wave,count,bosses:[...this.bossesForCurrentSchedule(wave)],minion};
  }
  canCallEarlyWave():{allowed:boolean;bonusFood:number} {
    const s=this.state;
    if(s.phase!=='playing'||this.tutorialHold||this.transitionHold||s.sides.player.oranges<=0||s.enemies.length>0)return{allowed:false,bonusFood:0};
    const prep=s.wave===1&&s.spawned===0,wait=(prep?FIRST_WAVE_PREPARATION:WAVE_DURATION)-s.waveTime;
    const clear=s.wave>=1&&(s.endless||s.wave<10)&&s.spawned>=this.currentWaveTargetCount()&&!this.pendingBosses.length;
    if(wait<=1.5||(!prep&&!clear))return{allowed:false,bonusFood:0};
    return{allowed:true,bonusFood:Math.max(3,Math.min(prep?8:10,Math.ceil(wait*(prep?.4:.35))))};
  }
  callEarlyWave():CommandResult {
    const {allowed,bonusFood}=this.canCallEarlyWave();if(!allowed)return{ok:false,key:'p6.earlyUnavailable'};
    if(this.state.wave===1&&this.state.spawned===0){this.state.waveTime=FIRST_WAVE_PREPARATION;this.state.nextSpawn=0;this.updateWaves(0);}
    else {this.recordEndlessClear();this.beginWave(this.state.wave+1);}
    this.state.sides.player.food+=bonusFood;
    this.event({type:'food',side:'player',col:2,row:0,value:bonusFood,textKey:'hint.food',duration:1.1});
    return{ok:true,key:'p6.earlyCalled'};
  }
  toggleBenchLock(slot:number):CommandResult {
    if(this.state.phase!=='playing'||this.tutorialHold)return{ok:false,key:'hint.paused'};
    if(!Number.isInteger(slot)||slot<0||slot>=5)return{ok:false,key:'hint.invalid'};
    const unit=this.state.units.find(u=>u.side==='player'&&u.location.zone==='bench'&&u.location.slot===slot);
    if(!unit)return{ok:false,key:'hint.invalid'};
    this.validateBenchLock();
    const unlock=this.state.sides.player.lockedBenchSlot===slot;
    this.state.sides.player.lockedBenchSlot=unlock?null:slot;this.lockedBenchUnit=unlock?undefined:unit;
    return{ok:true,key:unlock?'p6.benchUnlocked':'p6.benchLocked',unitId:unit.id};
  }
  private validateBenchLock():void {
    const slot=this.state.sides.player.lockedBenchSlot,unit=this.lockedBenchUnit;
    if(slot===null||slot===undefined||!unit||!this.state.units.includes(unit)||unit.location.zone!=='bench'||unit.location.slot!==slot){
      this.state.sides.player.lockedBenchSlot=null;this.lockedBenchUnit=undefined;
    }
  }
  useProp(id:string,target:PropTarget={},side:Side='player'):CommandResult{
    const result=side==='player'?this.props.use(id,target,side):{ok:false,key:'hint.invalid'};this.validateBenchLock();return result;
  }
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
  private dropEnabled(key:keyof FeatureDropFlags):boolean {return this.options.featureDrops?.[key]??true;}
  rollWeaponFragment(rarities?:number[]):string{return rollWeapon(()=>this.random.next(),rarities,RANKS[this.state.rankIndex].fragmentMultiplier,this.options.unlockedWeapons);}
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
    const teachingPack=this.options.tutorialGuided&&this.state.sides[side].summons===0?['hamster','hamster','panda','hat_bamboo','squirrel']:undefined;
    // Validate the price before discarding. A pack replaces this bench atomically.
    this.validateBenchLock();const kept=this.lockedBenchUnit;
    this.state.units=this.state.units.filter(u=>u.side!==side||u.location.zone!=='bench'||u===kept);
    this.state.sides[side].food-=cost;this.state.sides[side].summons++;
    let firstId:number|undefined,shovels=kept?.kind==='shovel'?1:0;
    for(let i=0;i<ECONOMY.summonCount-(kept?1:0);i++){
      const result=this.grant(teachingPack?.[i]??this.props.draw(side,shovels<2),side);firstId??=result.unitId;
      const unit=this.state.units.find(u=>u.id===result.unitId);if(unit){if(unit.kind==='shovel')shovels++;if(!teachingPack)this.props.promoteDraw(unit);}
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
      if(result.ok){this.state.units=this.state.units.filter(u=>u.id!==id);this.validateBenchLock();}
      return result;
    }
    if(target.zone==='board'&&!GridSystem.owns(source.side,target.col,target.row))return{ok:false,key:'hint.enemyTerritory'};
    if(!GridSystem.canPlace(this.state,source.side,target))return{ok:false,key:'hint.invalidTile'};
    const occupant=this.state.units.find(u=>u.side===source.side&&this.sameLocation(u.location,target));
    if(occupant?.kind==='shovel'&&source.location.zone==='board')return{ok:false,key:'hint.toolOnly'};
    if(source.washing||occupant?.washing)return{ok:false,key:'m2.washing'};
    if(occupant?.id===source.id)return{ok:true,key:'hint.selected',unitId:id};
    if(occupant){
      // P17: in endless only, a Lv.5 hero fed its part (or an identical twin) rolls a breakthrough instead of "max level".
      const pair=this.state.endless?MergeSystem.breakthroughPair(source,occupant):null;
      if(pair){
        if(pair.locked){this.event({type:'bubble',side:source.side,...this.unitPosition(occupant),textKey:'hint.mergeLocked',unitId:occupant.id,duration:1.6});return{ok:false,key:'hint.mergeLocked',unitId:id};}
        return this.breakthrough(pair.base,pair.feeder);
      }
      const outcome=MergeSystem.combine(source,occupant);
      if(outcome.unit){
        this.combatRecords.merge(source,occupant,outcome.unit);
        this.state.units=this.state.units.filter(u=>u.id!==source.id&&u.id!==occupant.id);
        this.state.units.push(outcome.unit);
        this.validateBenchLock();
        const position=this.unitPosition(outcome.unit);
        if(HEROES[outcome.unit.kind]&&!this.state.mergedHeroes[source.side].includes(outcome.unit.kind))this.state.mergedHeroes[source.side].push(outcome.unit.kind);
        const legendary=!!HEROES[outcome.unit.kind]&&!HEROES[source.kind]&&!HEROES[occupant.kind];
        this.event({type:'purge',side:source.side,...position,textKey:'hint.purged',effect:legendary?'legendary':undefined,unitId:outcome.unit.id,duration:1.4});
        const refund=legendary?this.broth('heroRefund'):0;
        if(refund){this.state.sides[source.side].food+=refund;this.event({type:'food',side:source.side,...position,value:refund,textKey:'hint.food',duration:1.1});}
        return{ok:true,key:outcome.key,unitId:outcome.unit.id};
      }
      if(outcome.swap){const from=source.location;source.location={...target};occupant.location={...from};source.animation=1;occupant.animation=1;this.validateBenchLock();}
      if(!outcome.ok)this.event({type:'bubble',side:source.side,...this.unitPosition(occupant),textKey:outcome.key,unitId:occupant.id,duration:1.6});
      return{ok:outcome.ok,key:outcome.key,unitId:id};
    }
    source.location={...target};source.animation=1;this.validateBenchLock();return{ok:true,key:'hint.deployed',unitId:id};
  }
  /** The feeder is always consumed and its records join the hero; a miss is free and adds +5% to the next roll. */
  private breakthrough(base:Unit,feeder:Unit):CommandResult {
    const chance=this.getBreakthroughChance(base),roll=this.endlessRandom.next();
    this.combatRecords.merge(feeder,base,base);
    this.state.units=this.state.units.filter(u=>u.id!==feeder.id);this.validateBenchLock();
    const position=this.unitPosition(base);
    if(roll<chance.total){
      base.awakened=true;base.statuses={};base.animation=1;
      this.event({type:'purge',side:base.side,...position,effect:'awakened',unitId:base.id,textKey:'p17.breakthroughSuccess',duration:1.5});
      return{ok:true,key:'p17.breakthroughSuccess',unitId:base.id};
    }
    base.breakthroughFails=(base.breakthroughFails??0)+1;base.animation=.7;
    const next=Math.round(this.getBreakthroughChance(base).total*100);
    this.event({type:'bubble',side:base.side,...position,textKey:'p17.breakthroughFail',value:next,unitId:base.id,duration:1.6});
    return{ok:true,key:'p17.breakthroughFail',unitId:base.id,value:next};
  }
  /** Live breakdown shown on the hero card; the roll uses exactly this value. */
  getBreakthroughChance(unit:Unit):BreakthroughChance {
    const tally=this.combatRecords.tally(unit),boost=1+this.broth('momentumBonus');
    return computeBreakthroughChance({preEndlessKills:tally.preEndlessKills*boost,preEndlessBossKills:tally.preEndlessBossKills*boost,
      luckMedallionLevel:this.medallion('med_luck_rate'),previousFails:unit.breakthroughFails??0});
  }
  /** Battle spirit of the unit's merge lineage (0..200), accelerated by Starlight Celestial Spring. */
  getUnitMomentum(unit:Unit):number {
    const raw=this.combatRecords.momentum(unit),boost=this.broth('momentumBonus');
    return boost?Math.min(200,raw*(1+boost)):raw;
  }
  getKillTally(unit:Unit){return this.combatRecords.tally(unit);}
  /** The player's medallion level; exactly 0 when the loadout carries none. */
  medallion(id:MedallionId):number {return getMedallionLevel(this.state.sides.player.loadout,id);}
  /** Calm Ward shortens boss debuffs in endless; the standard waves keep the exact duration. */
  resistDuration(duration:number):number {
    const resist=this.state.endless?bossResist(this.medallion('med_boss_resist')):0;
    return resist?duration*(1-resist):duration;
  }
  /** Calm Ward may shrug off a destructive boss skill in endless (rolled on `endlessRandom` only). */
  resistBossSkill(at:Point):boolean {
    const resist=this.state.endless?bossResist(this.medallion('med_boss_resist')):0;
    if(!resist||this.endlessRandom.next()>=resist)return false;
    this.event({type:'bubble',side:'player',col:at.col,row:at.row,textKey:'p17.resistBlock',effect:'resist_block',duration:1.3});
    return true;
  }
  storeShovel(id:number):CommandResult {
    if(!this.actionAllowed())return{ok:false,key:'hint.paused'};
    const unit=this.state.units.find(u=>u.id===id&&u.side==='player'&&u.kind==='shovel'&&u.location.zone==='bench');
    if(!unit)return{ok:false,key:'hint.toolOnly'};
    if(this.state.sides.player.shovels>=this.getShovelRules().maxStored)return{ok:false,key:'hint.shovelFull'};
    this.state.sides.player.shovels++;this.state.units=this.state.units.filter(u=>u.id!==id);
    this.validateBenchLock();
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
  spawnEnemy(kind:string,side:Side,scale=this.state.endless?getWaveConfig(this.state.wave).hpScale:1):Enemy {
    if(!ENEMIES[kind])throw new Error('Unknown enemy');
    kind=this.unlockedEnemy(kind);
    const config=ENEMIES[kind];if(!config)throw new Error('Unknown enemy');
    const difficulty=getRankDifficulty(this.state.rankIndex,this.options);
    const pressure=this.state.endless?getWaveConfig(this.state.wave):undefined;
    scale*=difficulty.hpMultiplier*(this.props.has('player','shared_oranges')?1.15:1);
    const p=GridSystem.pathPosition(side,0,this.state.mapId);
    const enemy:Enemy={id:side==='player'?this.sequence++:0,kind,side,boss:config.boss,hp:config.hp*scale,maxHp:config.hp*scale,progress:0,col:p.col,row:p.row,speed:config.speed*difficulty.speedMultiplier*(pressure?.speedScale??1)*(this.props.has('player','hyper_party')?1.12:1),armor:Math.min(.8,config.armor+((config.armor>0||config.boss)?difficulty.armorBonus:0)+(pressure?.armorBonus??0)),size:1,abilityCooldown:config.interval*difficulty.bossCooldownScale,stun:0,slow:0,slowFactor:1,burn:0,burnDps:0,poison:0,poisonDps:0,stolenBy:[],hitFlash:0};
    if(side!=='player')return enemy;
    this.enemyEverSpawned=true;
    this.state.enemies.push(enemy);
    if(enemy.boss){
      this.event({type:'bubble',side,col:p.col,row:p.row,textKey:`boss.${kind}.bubble`,effect:'boss_spawn',enemyKind:kind,boss:true,duration:2.6});
      if(['box_kraken','sad_rain_frog','king_skunk'].includes(kind))this.bossAbility(enemy);
    }
    else if(['crab','killer_bee','charmed_rat'].includes(kind)&&!this.announcedElites.has(kind)){
      this.announcedElites.add(kind);this.event({type:'alert',side,...p,effect:'elite_spawn',enemyKind:kind,boss:false,duration:2.6});
    }
    return enemy;
  }
  adjustOranges(delta:number,side:Side='player'):void {
    if(side!=='player'||!this.actionAllowed()||!Number.isFinite(delta))return;
    this.props.adjustOranges(Math.trunc(delta));
    this.event({type:'orange',side,...getMap(this.state.mapId).paths.player.at(-1)!,value:delta,duration:1.2,textKey:delta<0?'hint.orangeLost':'hint.orangeAdded'});
    if(delta<0&&this.state.sides[side].oranges===0)this.finish('ai','oranges');
  }
  addFood(amount:number,side:Side='player'):void { if(side==='player'&&this.actionAllowed()&&Number.isFinite(amount))this.state.sides[side].food=Math.max(0,this.state.sides[side].food+Math.trunc(amount)); }
  skipWave():void {
    if(!this.actionAllowed())return;
    // Skipping drops pending enemies without kill income or loot.
    this.state.enemies=[];
    if(!this.state.endless&&this.state.wave>=10){this.finishByScore();return;}
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
    this.validateBenchLock();
    for(const side of ['player'] as Side[]){
      const resources=this.state.sides[side];resources.fog=Math.max(0,resources.fog-dt);
      if(this.state.endless&&!resources.capyShieldReady&&this.medallion('med_capy_shield')>0){
        resources.capyShieldTimer=Math.max(0,resources.capyShieldTimer-dt);
        if(resources.capyShieldTimer<=1e-8){resources.capyShieldReady=true;resources.capyShieldTimer=0;}
      }
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
      // The barrage is the reward for charging, not a source of its own next charge.
      // Otherwise four-times fire rate refreshes Meowfia's buff before it can expire.
      if(HEROES[unit.kind]&&!(unit.kind==='meowfia'&&unit.buffTime>0)){
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
      if(enemy.boss){enemy.abilityCooldown-=dt;if(enemy.abilityCooldown<=0){this.bossAbility(enemy);enemy.abilityCooldown=ENEMIES[enemy.kind].interval*getRankDifficulty(this.state.rankIndex).bossCooldownScale;}}
      if(enemy.hp<=0)continue;
      const hasteDuration=Math.min(dt,Math.max(0,enemy.hasteTime??0));enemy.hasteTime=Math.max(0,(enemy.hasteTime??0)-dt);
      if(enemy.stun<=0)enemy.progress+=enemy.speed*(dt+.3*hasteDuration)*(enemy.slow>0?enemy.slowFactor:1)*(this.props.has(enemy.side,'banana_peel')?.88:1)*this.brothEnemySpeed(enemy);
      Object.assign(enemy,GridSystem.pathPosition(enemy.side,enemy.progress,this.state.mapId));
      this.props.onEnemy(enemy);if(enemy.hp<=0)continue;
      if(enemy.progress>=getMap(this.state.mapId).paths.player.length-1){
        this.state.enemies=this.state.enemies.filter(e=>e.id!==enemy.id);
        if(this.blockWithCapyShield(enemy))continue;
        this.adjustOranges(enemy.boss?-2:-1,enemy.side);
        if(this.state.phase==='finished')break;
      }
    }
    this.state.enemies=this.state.enemies.filter(e=>e.hp>0);
    if(this.options.autoWaves!==false&&this.state.phase==='playing'){
      if(this.state.endless){
        if(this.recordEndlessClear()&&this.state.waveTime+1e-8>=WAVE_DURATION)this.beginWave(this.state.wave+1);
      }else if(this.state.wave===10&&this.state.spawned>=this.currentWaveTargetCount()&&!this.pendingBosses.length&&this.state.enemies.length===0)this.finishByScore();
    }
  }
  /** Capybara Bubble Shield (endless only): absorbs one whole orange theft, then recharges. */
  private blockWithCapyShield(enemy:Enemy):boolean {
    const resources=this.state.sides.player;
    if(!this.state.endless||enemy.side!=='player'||!resources.capyShieldReady)return false;
    resources.capyShieldReady=false;resources.capyShieldTimer=capyShieldCooldown(this.medallion('med_capy_shield'));
    this.event({type:'shield_block',side:'player',...getMap(this.state.mapId).paths.player.at(-1)!,textKey:'p17.shieldBlock',enemyKind:enemy.kind,boss:enemy.boss,duration:.9});
    return true;
  }
  private recordEndlessClear():boolean {
    const s=this.state;
    if(!s.endless||s.wave<11||s.sides.player.oranges<=0||s.spawned<this.currentWaveTargetCount()||this.pendingBosses.length||s.enemies.some(enemy=>enemy.hp>0))return false;
    if(s.wave>(s.endlessClearedWave??10)){
      const coins=15*(s.wave-10),multiplier=this.coinMultiplier();
      s.endlessCoins=(s.endlessCoins??0)+(multiplier!==1?Math.round(coins*multiplier):coins);s.endlessClearedWave=s.wave;
      if(this.dropEnabled('medallions'))s.sides.player.endlessCrests+=endlessCrestsForWave(s.wave);
      const k=s.wave-10;
      // P19 rebalanced endless drops: 1 fragment every 3 waves; 1 ingredient every 2 waves (+ truffle every 5 waves); 1 wood / 3 waves & 1 essence / 5 waves.
      if(this.dropEnabled('armory')&&k%3===0)s.sides.player.loot.push(this.rollWeaponFragment());
      if(this.dropEnabled('kitchen')){
        if(k%2===0)this.harvest(this.pickIngredient(['ing_sakura','ing_chili','ing_bamboo','ing_honey']));
        if(k%5===0)this.harvest('ing_mushroom');
        this.goldenFeastRoll();
      }
      if(this.dropEnabled('village')){
        if(k%3===0)this.gather('res_onsen_wood');
        if(k%5===0)this.gather('res_yuzu_essence');
        const dropBonus=this.broth('dropBonus');
        if(dropBonus&&k%3===0&&this.villageRandom.next()<dropBonus)this.gather('res_onsen_wood');
      }
    }
    return true;
  }
  private beginWave(wave:number,grantIncome=true):void {
    this.announcedElites.clear();
    this.state.wave=wave;this.state.waveTime=0;this.state.nextSpawn=wave===1?FIRST_WAVE_PREPARATION:1;this.state.spawned=0;
    for(const side of ['player'] as Side[]){
      if(wave>1&&grantIncome)this.state.sides[side].food+=ECONOMY.waveIncome+this.broth('waveIncome');
    }
    if(wave===7&&this.dropEnabled('village'))this.gather('res_onsen_wood');
    this.event({type:'bubble',side:'player',col:3.5,row:4.5,textKey:'hint.wave',value:wave,duration:1.8});
    const bosses=this.bossesForCurrentSchedule(wave);
    this.pendingBosses=bosses.slice(1).map((kind,index)=>({kind,at:5*(index+1)}));if(bosses[0])this.spawnBoss(bosses[0]);
  }
  private updateWaves(dt:number):void {
    if(!this.state.wave)return;
    if((this.tutorialHold||this.transitionHold)&&this.state.wave===1&&this.state.spawned===0)return;
    this.state.waveTime+=dt;this.state.nextSpawn-=dt;
    const config=getWaveConfig(this.state.wave);
    for(const boss of this.pendingBosses.filter(b=>this.state.waveTime+1e-8>=b.at))this.spawnBoss(boss.kind);
    this.pendingBosses=this.pendingBosses.filter(b=>this.state.waveTime+1e-8<b.at);
    if(this.state.spawned<this.currentWaveTargetCount()&&this.state.nextSpawn<=0){
      const kind=minionForWave(this.state.wave,this.state.spawned,this.state.rankIndex);
      for(const side of ['player'] as Side[])this.spawnEnemy(kind,side,config.hpScale);
      this.state.spawned++;
      // Carry sub-step overshoot in endless so each exponential density interval stays exact.
      this.state.nextSpawn=this.state.endless?this.state.nextSpawn+config.interval:config.interval*getRankDifficulty(this.state.rankIndex).intervalScale;
    }
    if(this.state.wave<10&&this.state.waveTime+1e-8>=WAVE_DURATION&&this.state.spawned>=this.currentWaveTargetCount()&&!this.pendingBosses.length)this.beginWave(this.state.wave+1);
  }
  getUnitStats(unit:Unit):UnitStats {
    const base=getBaseUnitStats(unit.kind,unit.level);
    if(!UNITS[unit.kind]&&!HEROES[unit.kind]||unit.kind==='shovel')return base;
    return this.endlessStats(unit,this.kitchenStats(unit,this.weapons.stats(unit,{...base,rate:base.rate*(1+this.props.haste(unit.side))})));
  }
  /** P17 endless-only hero layer: battle momentum for every hero, plus ×2.5 · 1.235^Lv and +15% speed once awakened. */
  private endlessStats(unit:Unit,stats:UnitStats):UnitStats {
    if(!this.state.endless||unit.side!=='player'||!HEROES[unit.kind])return stats;
    let damage=stats.damage*momentumMultiplier(this.getUnitMomentum(unit),this.medallion('med_momentum')),rate=stats.rate;
    if(unit.awakened){damage*=AWAKENED_DAMAGE*breakthroughAttackMultiplier(this.medallion('med_breakthrough_atk'));rate*=AWAKENED_RATE;}
    return{...stats,damage,rate};
  }
  /** Permanent collection aura plus today's broth. With nothing brewed the stats are returned untouched. */
  private kitchenStats(unit:Unit,stats:UnitStats):UnitStats {
    const loadout=this.state.sides[unit.side].loadout,aura=getKitchenCollectionAura(loadout),active=getActiveBroth(loadout);
    // P16 village buffs (bamboo pool ATK/SPD, cat-nap SPD) stack with the kitchen; absent buffs are exactly zero.
    const villageDamage=getVillageBuff(loadout,'damage'),villageRate=getVillageBuff(loadout,'rate');
    if(!aura.unlockedCount&&!active&&!villageDamage&&!villageRate)return stats;
    let damage=stats.damage*(1+aura.damageBonus)*(1+villageDamage),rate=stats.rate*(1+aura.rateBonus)*(1+villageRate);
    if(active){
      const family=getUnitCombatFamily(unit.kind),fx=(key:BrothEffectKey)=>getBrothEffect(loadout,key);
      if(family==='melee'){damage*=1+fx('meleeDamage');rate*=1+fx('meleeRate');}
      else if(family==='ranged')damage*=1+fx('rangedDamage');
      else if(family==='magic')damage*=1+fx('magicDamage');
      if(UNITS[unit.kind]?.category==='basic'&&unit.level>=3)damage*=1+fx('veteranDamage');
      damage*=1+fx('allDamage');rate*=1+fx('allRate');
    }
    return{...stats,damage,rate};
  }
  private broth(key:BrothEffectKey):number {return getBrothEffect(this.state.sides.player.loadout,key);}
  private village(key:VillageBuffKey):number {return getVillageBuff(this.state.sides.player.loadout,key);}
  private gather(...ids:VillageResourceId[]):void {this.state.sides.player.villageLoot.push(...ids);}
  /** Boss: sakura pavilion bonus fragment roll (when armory unlocked) & rare essence boost. */
  private dropVillageKill(enemy:Enemy):void {
    if(!enemy.boss)return;
    const bonus=this.village('bossFragment');
    if(bonus&&this.dropEnabled('armory')&&this.villageRandom.next()<bonus)this.state.sides[enemy.side].loot.push(rollWeapon(()=>this.villageRandom.next(),undefined,RANKS[this.state.rankIndex].fragmentMultiplier,this.options.unlockedWeapons));
    if(this.dropEnabled('village')&&this.state.wave===10){
      const extra=this.village('essenceDrop')+this.broth('dropBonus')*.35;
      if(extra>0&&this.villageRandom.next()<extra)this.gather('res_yuzu_essence');
    }
  }
  private coinMultiplier():number {return(1+this.broth('coinBonus'))*(1+this.village('coinBonus'));}
  /** Chill Melon slows the whole lane; Sakura Milk slows the last 3.5 cells before the tub. */
  private brothEnemySpeed(enemy:Enemy):number {
    const global=this.broth('globalSlow'),tub=this.broth('tubSlow');
    if(!global&&!tub)return 1;
    const nearTub=tub&&enemy.progress>=getMap(this.state.mapId).paths.player.length-1-3.5;
    return(1-global)*(nearTub?1-tub:1);
  }
  private harvest(...ids:IngredientId[]):void {if(this.dropEnabled('kitchen'))this.state.sides.player.ingredientLoot.push(...ids);}
  private pickIngredient(pool:readonly IngredientId[]):IngredientId {
    return pool[Math.min(pool.length-1,Math.floor(this.ingredientRandom.next()*pool.length))];
  }
  /** Golden Seafood Feast / Hundred-Fruit Golden Spring: chance for one extra random ingredient. */
  private goldenFeastRoll():void {
    const chance=this.broth('dropBonus');
    if(chance&&this.dropEnabled('kitchen')&&this.ingredientRandom.next()<chance)this.harvest(this.pickIngredient(INGREDIENT_IDS));
  }
  private waveClearIngredients(wave:3|6|10|number):void {
    if(!this.dropEnabled('kitchen'))return;
    this.harvest(wave===3?'ing_yuzu':wave===6?'ing_honey':MAP_SIGNATURE_INGREDIENT[this.state.mapId]);this.goldenFeastRoll();
  }
  private dropKillIngredients(enemy:Enemy):void {
    if(!this.dropEnabled('kitchen'))return;
    const signature=MAP_SIGNATURE_INGREDIENT[this.state.mapId];
    if(enemy.boss){
      // P19: bosses at W6/W8/W10 drop 1 curated ingredient; W10 & endless bosses also have a 5% Lucky Crit Truffle roll.
      if(!this.state.endless&&[6,8,10].includes(this.state.wave)){
        this.harvest(this.pickIngredient(this.state.wave>=8?['ing_mushroom','ing_chili','ing_sakura',signature]:['ing_bamboo','ing_honey','ing_yuzu',signature]));
        this.goldenFeastRoll();
      }
      if((this.state.wave===10||this.state.endless)&&this.ingredientRandom.next()<.05){
        this.harvest('ing_mushroom');
        this.luckyDrops++;
        this.event({type:'lucky_drop',side:'player',col:enemy.col,row:enemy.row,textKey:'p19.luckyTruffle',color:'#ffe27a',duration:1.8});
      }
      return;
    }
    const elite=ELITE_ENEMY_IDS.includes(enemy.kind);
    if(!elite||this.ingredientRandom.next()>=.04)return;
    const roll=this.ingredientRandom.next();
    this.harvest(roll<.45?'ing_bamboo':roll<.8?'ing_honey':signature);
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
    const bossBroth=unit&&enemy.boss?this.broth('bossDamage'):0,bossVillage=unit&&enemy.boss?this.village('bossDamage'):0;
    // P17 Sovereign Piercer (endless only): extra boss damage and a share of every target's armor ignored.
    const slayer=unit&&this.state.endless?this.medallion('med_boss_slayer'):0;
    const bossBonus=(bossBroth||bossVillage?(1+bossBroth)*(1+bossVillage):1)*(slayer&&enemy.boss?bossSlayerMultiplier(slayer):1);
    const armor=slayer?enemy.armor*(1-armorPenetration(slayer)):enemy.armor;
    const damage=amount*(unit?this.weapons.damageMultiplier(unit,enemy):1)*bossBonus*(trueDamage||(enemy.armorBreak??0)>0?1:1-armor),actual=Math.min(enemy.hp,damage);enemy.hp-=damage;
    if(amount>=3){
      enemy.hitFlash=.14;const source=unit?this.unitPosition(unit):{col:enemy.col,row:enemy.row+1},dx=enemy.col-source.col,dy=enemy.row-source.row,len=Math.hypot(dx,dy)||1;
      enemy.knockX=dx/len*5;enemy.knockY=dy/len*5;
      this.event({type:'hit',side:enemy.side,col:enemy.col,row:enemy.row,effect:'vfx_hit_burst',duration:.18});
    }
    this.state.sides[enemy.side].damage+=actual;
    if(unit)this.combatRecords.hit(unit,actual,enemy.hp<=0,!!this.state.endless,enemy.boss);
    if(amount>=3){
      const style=unit?COMBAT_STYLES[unit.kind]:undefined;
      const hitCue=critical||unit?.kind==='rocket_coon'?'hit_heavy':periodic||style==='magic_cast'?'hit_magic':style==='ranged_recoil'?'hit_ranged':'hit_melee';
      this.event({type:'damage',side:enemy.side,col:enemy.col,row:enemy.row,value:Math.round(damage),hitCue,color:critical?'#f16941':'#fff7da',duration:.65});
    }
    if(enemy.hp<=0){
      const owner=this.state.sides[enemy.side];owner.kills++;
      this.dropKillIngredients(enemy);this.dropVillageKill(enemy);
      if(enemy.boss&&this.dropEnabled('armory')){
        // P19 rebalanced weapon fragment drops (~2.2-2.4/win) + 5% Lucky Crit Legendary drop on W10/Endless bosses.
        if(!this.state.endless){
          const chance=this.state.wave===10?1:this.state.wave===8?.65:this.state.wave===6?.55:this.state.wave===9?.35:.30;
          if(this.random.next()<chance)owner.loot.push(this.rollWeaponFragment());
        }
        if((this.state.wave===10||this.state.endless)&&this.random.next()<.05){
          owner.loot.push(this.rollWeaponFragment([4]));
          this.luckyDrops++;
          this.event({type:'lucky_drop',side:'player',col:enemy.col,row:enemy.row,textKey:'p19.luckyLegendary',color:'#ffd45c',duration:1.9});
        }
      }
      const food=enemy.boss?ECONOMY.bossKillFood:ECONOMY.killFood;owner.food+=food;
      this.event({type:'food',side:enemy.side,col:enemy.col,row:enemy.row,value:food,textKey:'hint.food',duration:1.1});
      this.event({type:'death',side:enemy.side,col:enemy.col,row:enemy.row,effect:'vfx_dust_puff',enemyKind:enemy.kind,boss:enemy.boss,duration:.55});
      if(unit?.kind==='doge_wick'&&this.random.next()<(this.weapons.awakened(unit)?.85:.5))owner.food+=2;
      this.event({type:'burst',side:enemy.side,col:enemy.col,row:enemy.row,duration:.5,color:enemy.boss?'#f9bd56':'#c4dec7'});
      if(unit&&weaponHooks)this.weapons.onKill(unit);
    }
    // Spicy Hotpot: every direct hit leaves a short two-second burn on survivors.
    const burn=unit&&!periodic&&enemy.hp>0?this.broth('burnRatio'):0;
    if(burn)this.applyDot(enemy,'burn',2,this.stats(unit!).damage*burn,unit!);
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
        if(cell&&this.resistBossSkill(cell))break;
        if(cell){this.state.grid[cell.row][cell.col]='B';delete this.state.craterHits[cell.col+','+cell.row];this.event({type:'burst',side:enemy.side,...cell,color:'#bd9478',duration:1});}break;
      }
      case 'mega_roomba':{
        const victim=units.filter(u=>UNITS[u.kind]?.category==='basic'&&GridSystem.distance(this.unitPosition(u),enemy)<=1.2).sort((a,b)=>a.level-b.level||a.id-b.id)[0];
        if(victim&&this.resistBossSkill(this.unitPosition(victim)))break;
        if(victim){this.state.units=this.state.units.filter(u=>u.id!==victim.id);enemy.hp=Math.min(enemy.maxHp,enemy.hp+enemy.maxHp*.2);enemy.size*=1.15;}break;
      }
      case 'dr_clippers':{
        const clipped=units.filter(u=>GridSystem.distance(this.unitPosition(u),enemy)<=2).sort((a,b)=>b.level-a.level).slice(0,2);
        if(clipped.length&&this.resistBossSkill(this.unitPosition(clipped[0])))break;
        for(const u of clipped){u.level=Math.max(1,u.level-1);u.statuses.MERGE_LOCK=this.resistDuration(5);u.animation=1;}break;
      }
      case 'box_kraken':{
        const victim=units.sort((a,b)=>b.level-a.level||this.stats(b).damage-this.stats(a).damage)[0];
        if(victim)victim.statuses.SEALED=this.resistDuration(18);break;
      }
      case 'sad_rain_frog':{const wet=this.resistDuration(18);for(const u of units)u.statuses.WET=wet;break;}
      case 'king_skunk':this.state.sides[enemy.side].fog=this.resistDuration(6);break;
      default:applyNewBossMechanic(this,enemy,units);
    }
    this.event({type:'bubble',side:enemy.side,col:enemy.col,row:enemy.row,textKey:`boss.${enemy.kind}.bubble`,duration:1.5});
  }
  private finishByScore():void {
    this.finish(this.state.sides.player.oranges>0?'player':'ai','waves');
  }
  private finish(winner:Side,reason:'oranges'|'waves'|'surrender'):void {
    if(this.state.result)return;
    // A command can kill the last foe and cash out before the next simulation tick.
    // Settle that clear now; pending spawns, live enemies and a lost guardian still block it.
    if(this.state.endless)this.recordEndlessClear();
    const playerLoot=[...this.state.sides.player.loot],aiLoot:string[]=[];
    if(this.state.endless&&this.state.standardResult){
      const standard=this.state.standardResult,endlessCoins=this.state.endlessCoins??0,harvest=[...this.state.sides.player.ingredientLoot];
      this.state.result={winner:'player',reason,loot:[...playerLoot],playerLoot,aiLoot,coins:standard.coins+endlessCoins,
        elapsed:this.state.time,rankIndex:this.state.rankIndex,mergedHeroes:[...this.state.mergedHeroes.player],mvp:this.combatRecords.mvp(this.state.units),
        endless:true,endlessWave:this.state.wave,endlessCoins,endlessLoot:playerLoot.slice(standard.playerLoot.length),
        // The standard receipt already banked its share; endless keeps 100% of every later ingredient.
        ingredientLoot:harvest,endlessIngredientLoot:harvest.slice(standard.ingredientLoot?.length??0),
        villageLoot:[...this.state.sides.player.villageLoot],endlessVillageLoot:this.state.sides.player.villageLoot.slice(standard.villageLoot?.length??0),
        endlessCrests:this.state.sides.player.endlessCrests,awakenedCount:this.state.units.filter(u=>u.side==='player'&&u.awakened).length,
        ...(this.luckyDrops?{luckyDrops:this.luckyDrops}:{})};
      this.state.phase='finished';return;
    }
    const won=winner==='player';
    if(won&&reason==='waves'){
      this.waveClearIngredients(10);
      if(this.dropEnabled('village')){
        // W10 win pays 2 wood total (1 at W7 + 1 at W10) + 60% chance of 1 essence.
        this.gather('res_onsen_wood');
        if(this.villageRandom.next()<.6)this.gather('res_yuzu_essence');
      }
    }
    // Anti-frustration salvage: a loss or surrender still carries home at least half (rounded up).
    const salvage=<T,>(list:readonly T[])=>won?[...list]:list.slice(0,Math.ceil(list.length/2));
    const ingredientLoot=salvage(this.state.sides.player.ingredientLoot),villageLoot=salvage(this.state.sides.player.villageLoot);
    const baseCoins=RANKS[this.state.rankIndex].winCoins+Math.min(45,Math.floor(this.state.sides.player.food*.5)),multiplier=this.coinMultiplier();
    this.state.result={winner,reason,loot:won?[...playerLoot]:[],playerLoot,aiLoot,coins:won?(multiplier!==1?Math.round(baseCoins*multiplier):baseCoins):0,elapsed:this.state.time,rankIndex:this.state.rankIndex,mergedHeroes:[...this.state.mergedHeroes.player],mvp:this.combatRecords.mvp(this.state.units),ingredientLoot,villageLoot,
      ...(won&&reason==='waves'&&this.dropEnabled('medallions')?{endlessCrests:STANDARD_VICTORY_CRESTS}:{}),
      ...(this.luckyDrops?{luckyDrops:this.luckyDrops}:{})};this.state.phase='finished';
  }
}
