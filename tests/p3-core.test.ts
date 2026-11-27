import {describe,it,expect} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {getBaseUnitStats,getBeeProduction,LEVEL_MULTIPLIERS} from '../src/core/UnitStats';
import type {BattleLoadout} from '../src/core/types';

const loadout=(passive:string[]=[],active:string[]=[]):BattleLoadout=>({equippedWeapons:{},ownedProps:Object.fromEntries([...passive,...active].map(id=>[id,1])),equippedPassiveProps:passive,equippedActiveProps:active});
function prep(input:Partial<BattleLoadout>={}){const e=new BattleEngine({seed:10,loadouts:{player:input}});e.start();return e;}
function pet(e:BattleEngine,kind='hamster'){const id=e.grant(kind).unitId!;return e.state.units.find(u=>u.id===id)!;}

describe('P3 shared base and effective stats',()=>{
 it('uses five exact basic damage levels with existing rate growth and clamps impossible levels',()=>{
  expect(LEVEL_MULTIPLIERS).toEqual([1,1.55,2.25,3.15,4.3]);
  [16,24.8,36,50.4,68.8].forEach((damage,i)=>expect(getBaseUnitStats('hamster',i+1).damage).toBeCloseTo(damage));
  expect(getBaseUnitStats('hamster',2)).toMatchObject({range:1.6,charge:0});expect(getBaseUnitStats('hamster',2).rate).toBeCloseTo(1.4);
  expect(getBaseUnitStats('panda',5)).toEqual({damage:3,rate:1/1.5,range:1.35,charge:0});
  expect(getBaseUnitStats('shovel',5)).toEqual({damage:0,rate:0,range:0,charge:0});
  expect(getBaseUnitStats('missing',1)).toEqual({damage:0,rate:0,range:0,charge:0});
  expect(getBaseUnitStats('hamster',NaN)).toEqual(getBaseUnitStats('hamster',1));
  const e=prep(),u=pet(e);u.level=4;expect(e.getUnitStats(u).damage).toBeCloseTo(50.4);
  const hero=pet(e,'kungfu_po');hero.level=3;expect(getBaseUnitStats(hero.kind,3).damage).toBeCloseTo(getBaseUnitStats(hero.kind,1).damage*2.56);
 });
 it('shares actual bee production at all three levels and overtime rates',()=>{
  expect([1,2,3].map(level=>getBeeProduction(level))).toEqual([{amount:1,interval:18},{amount:1,interval:11},{amount:2,interval:7}]);
  expect(getBeeProduction(9)).toEqual({amount:2,interval:7});
  expect(getBeeProduction(1,loadout(['bee_overtime']))).toEqual({amount:1,interval:13.5});
  const e=new BattleEngine({autoWaves:false,loadouts:{player:loadout(['bee_overtime'])}});e.start();const u=pet(e,'bee');u.level=3;u.location={zone:'board',col:2,row:1};e.tick(10.5);expect(e.state.sides.player.food).toBe(36);
 });
 it('reports WET/buff/prop cadence exactly once and uses it for the actual next attack',()=>{
  const e=prep(loadout(['hyper_party'],['catnip'])),u=pet(e);e.useProp('catnip');u.statuses.WET=8;u.buffTime=8;u.location={zone:'board',col:2,row:1};
  const base=e.getUnitStats(u);expect(base.rate).toBeCloseTo(1.25*1.55);expect(e.getEffectiveUnitStats(u)).toEqual({...base,rate:base.rate*.55*4});
  const m=e.spawnEnemy('rat','player');m.speed=0;m.progress=2;m.col=1;m.row=1;m.hp=m.maxHp=10000;e.tick(.05);
  expect(u.cooldown).toBeCloseTo(1/(1.25*1.55*.55*4)-.05);
 });
});

describe('P3 preparation loadout sync',()=>{
 it('accepts playing/paused first-wave prep, rejects ready, later waves and finished without mutation',()=>{
  const e=new BattleEngine();expect(e.canSyncPreparationLoadout()).toBe(false);const before=JSON.stringify(e.state);expect(e.syncPreparationLoadout(loadout()).ok).toBe(false);expect(JSON.stringify(e.state)).toBe(before);
  e.start();expect(e.canSyncPreparationLoadout()).toBe(true);e.pause();expect(e.syncPreparationLoadout(loadout(['tall_perch'])).ok).toBe(true);expect(e.state.phase).toBe('paused');
  e.pause(false);e.skipWave();const late=JSON.stringify(e.state);expect(e.syncPreparationLoadout(loadout()).ok).toBe(false);expect(JSON.stringify(e.state)).toBe(late);
  const done=prep();done.surrender();expect(done.canSyncPreparationLoadout()).toBe(false);
 });
 it('locks permanently after automatic or sandbox manual spawn even when enemies disappear and counters reset',()=>{
  const e=prep();e.tick(30.01);expect(e.canSyncPreparationLoadout()).toBe(false);
  const manual=new BattleEngine({autoWaves:false});manual.start();expect(manual.canSyncPreparationLoadout()).toBe(true);manual.spawnEnemy('rat','player');manual.state.enemies=[];manual.state.wave=1;manual.state.spawned=0;
  const before=JSON.stringify(manual.state);expect(manual.syncPreparationLoadout(loadout(['extra_oranges'])).ok).toBe(false);expect(JSON.stringify(manual.state)).toBe(before);
 });
 it('preserves earned resources, draw count, unit state, traps, cooldowns and used rescues across swaps',()=>{
  const e=prep(loadout(['extra_oranges','auto_shovel'],['catnip','glue_trap'])),r=e.state.sides.player,u=pet(e,'kungfu_po');
  e.useProp('catnip');e.useProp('glue_trap',{col:1,row:0});e.useSprinkler();r.giantCatUses=2;r.food=47;r.summons=3;r.oranges=6;r.shovels=6;r.shovelTimer=17;u.energy=3;u.cooldown=.71;u.statuses.WET=8;
  const units=JSON.stringify(e.state.units),traps=JSON.stringify(e.state.traps),cooldowns={...r.propCooldowns};
  const next=loadout(['shared_oranges','hyper_party','tall_perch'],['washer','milk_bottle']);next.equippedWeapons={kungfu_po:'m10_bamboo_staff'};
  expect(e.syncPreparationLoadout(next).ok).toBe(true);expect(r.oranges).toBe(8);expect(r.food).toBe(47);expect(r.summons).toBe(3);expect(r.shovels).toBe(6);expect(r.shovelTimer).toBe(17);
  expect(r.propCooldowns).toEqual(cooldowns);expect(r.sprinklerUsed).toBe(true);expect(r.giantCatUses).toBe(2);expect(r.catnipTime).toBe(8);expect(JSON.stringify(e.state.units)).toBe(units);expect(JSON.stringify(e.state.traps)).toBe(traps);
  expect(e.getUnitStats(u).damage).toBeGreaterThan(getBaseUnitStats(u.kind,1).damage);expect(e.getUnitStats(u).rate).toBeGreaterThan(getBaseUnitStats(u.kind,1).rate);
  expect(e.syncPreparationLoadout(next).ok).toBe(true);expect(r.oranges).toBe(8);e.syncPreparationLoadout(loadout());expect(r.oranges).toBe(4);expect(r.shovels).toBe(6);
  const shovel=pet(e,'shovel');expect(e.storeShovel(shovel.id).ok).toBe(false);e.tick(.1);expect(r.shovels).toBe(6);r.shovels=3;e.tick(55);expect(r.shovels).toBe(4);
 });
 it('grants overtime food reversibly during Wave 1 prep without minting extra fish, while live bee timing follows swaps',()=>{
  for(const initial of [loadout(),loadout(['bee_overtime'])]){
   const e=prep(initial),r=e.state.sides.player;for(let i=0;i<3;i++){e.syncPreparationLoadout(loadout(['bee_overtime']));expect(r.food).toBe(32);e.syncPreparationLoadout(loadout());expect(r.food).toBe(22);}
  }
  const e=prep(),bee=pet(e,'bee');bee.location={zone:'board',col:2,row:1};e.tick(10);expect(bee.production).toBeCloseTo(10);e.syncPreparationLoadout(loadout(['bee_overtime']));e.tick(3.5);expect(e.state.sides.player.food).toBe(33);
 });
 it.each([[['extra_oranges'],4],[['shared_oranges'],6],[['extra_oranges','shared_oranges'],8]] as const)('retains damage below zero through repeated %j passive round trips',(passive,damage)=>{
  const original=loadout([...passive]),e=new BattleEngine({autoWaves:false,loadouts:{player:original}});e.start();e.adjustOranges(-damage);expect(e.state.sides.player.oranges).toBe(1);
  for(let i=0;i<4;i++){
   expect(e.syncPreparationLoadout(loadout()).ok).toBe(true);expect(e.state.sides.player.oranges).toBe(0);
   expect(e.syncPreparationLoadout(original).ok).toBe(true);expect(e.state.sides.player.oranges).toBe(1);
  }
 });
 it('applies intervening orange gains to the retained deficit without losing prep or imposing a health cap',()=>{
  const original=loadout(['extra_oranges']),e=new BattleEngine({autoWaves:false,loadouts:{player:original}});e.start();e.adjustOranges(-4);e.syncPreparationLoadout(loadout());expect(e.state.sides.player.oranges).toBe(0);
  e.adjustOranges(1);expect(e.state.sides.player.oranges).toBe(0);expect(e.state.phase).toBe('playing');expect(e.syncPreparationLoadout(original).ok).toBe(true);expect(e.state.sides.player.oranges).toBe(2);
  e.syncPreparationLoadout(loadout());expect(e.state.sides.player.oranges).toBe(0);e.adjustOranges(10);expect(e.state.sides.player.oranges).toBe(10);
  for(let i=0;i<3;i++){expect(e.syncPreparationLoadout(original).ok).toBe(true);expect(e.state.sides.player.oranges).toBe(12);expect(e.syncPreparationLoadout(loadout()).ok).toBe(true);expect(e.state.sides.player.oranges).toBe(10);}
 });
 it('allows paused preparation swaps to settle zero health before resuming',()=>{
  const original=loadout(['extra_oranges']),e=new BattleEngine({autoWaves:false,loadouts:{player:original}});e.start();e.adjustOranges(-4);e.pause();
  expect(e.syncPreparationLoadout(loadout()).ok).toBe(true);expect(e.state.sides.player.oranges).toBe(0);e.tick(1);expect(e.state.phase).toBe('paused');
  expect(e.syncPreparationLoadout(original).ok).toBe(true);expect(e.state.sides.player.oranges).toBe(1);e.pause(false);expect(e.state.phase).toBe('playing');
 });
 it.each(['tick','resume'] as const)('defeats unsettled zero health on %s and cannot revive a finished battle',command=>{
  const e=new BattleEngine({autoWaves:false,loadouts:{player:loadout(['extra_oranges'])}});e.start();e.adjustOranges(-4);if(command==='resume')e.pause();e.syncPreparationLoadout(loadout());
  if(command==='resume')e.pause(false);else e.tick(.05);expect(e.state.phase).toBe('finished');expect(e.state.result).toMatchObject({winner:'ai',reason:'oranges'});
  const before=JSON.stringify(e.state);expect(e.syncPreparationLoadout(loadout(['extra_oranges'])).ok).toBe(false);e.adjustOranges(100);expect(JSON.stringify(e.state)).toBe(before);
 });
 it('still immediately ends ordinary lethal orange damage',()=>{
  const e=prep();e.adjustOranges(-3);expect(e.state.phase).toBe('finished');expect(e.state.result).toMatchObject({winner:'ai',reason:'oranges'});
 });
 it('copies and validates snapshot input so subsequent profile changes cannot alter the battle',()=>{
  const e=prep(),input=loadout(['extra_oranges'],['catnip']);input.equippedWeapons={kungfu_po:'m10_bamboo_staff',meowfia:'m10_bamboo_staff',missing:'invalid'};input.ownedProps.auto_shovel=-2;input.equippedPassiveProps.push('auto_shovel','extra_oranges','invalid');
  expect(e.syncPreparationLoadout(input).ok).toBe(true);const copy=JSON.stringify(e.state.sides.player.loadout);input.ownedProps.extra_oranges=0;input.equippedPassiveProps.length=0;input.equippedWeapons.kungfu_po='m01_spoon';expect(JSON.stringify(e.state.sides.player.loadout)).toBe(copy);
  expect(e.state.sides.player.loadout.equippedPassiveProps).toEqual(['extra_oranges']);expect(e.state.sides.player.loadout.equippedWeapons).toEqual({kungfu_po:'m10_bamboo_staff'});
 });
 it('normalizes malformed external loadout fields and rejects inherited catalog names',()=>{
  const e=prep();expect(()=>e.syncPreparationLoadout({ownedProps:{catnip:1,toString:1},equippedActiveProps:'catnip',equippedPassiveProps:{},equippedWeapons:{kungfu_po:'toString'}} as unknown as BattleLoadout)).not.toThrow();
  expect(e.state.sides.player.loadout).toEqual({ownedProps:{catnip:1},equippedActiveProps:[],equippedPassiveProps:[],equippedWeapons:{}});
 });
});
