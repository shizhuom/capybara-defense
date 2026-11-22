import {describe,it,expect} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {getBenchMergeHints} from '../src/core/MergeTargets';
import type {Unit} from '../src/core/types';

const pet=(e:BattleEngine,kind:string)=>{const id=e.grant(kind).unitId!;return e.state.units.find(u=>u.id===id)!;};
const roster=(e:BattleEngine)=>e.state.units.filter(u=>u.location.zone==='bench').map(u=>[u.kind,u.level]);
describe('P6 immutable previews and fair early waves',()=>{
 it('previews preparation wave1 without moving the clocks or consuming any main random draws',()=>{
  const a=new BattleEngine({seed:124,rankIndex:53}),b=new BattleEngine({seed:124,rankIndex:53});a.start();b.start();
  const before=JSON.stringify(a.state);for(let i=0;i<30;i++)expect(a.getUpcomingWavePreview()).toMatchObject({wave:1,count:15,bosses:[],minion:'roach'});
  expect(JSON.stringify(a.state)).toBe(before);a.summon();b.summon();expect(roster(a)).toEqual(roster(b));
  for(let i=0;i<8;i++)expect(a.rollWeaponFragment()).toBe(b.rollWeaponFragment());
 });
 it.each([0,20,40,45,53])('uses the previewed schedule for real main and delayed bosses at rank%i without main RNG consumption',rankIndex=>{
  const e=new BattleEngine({seed:13,rankIndex}),control=new BattleEngine({seed:13,rankIndex});e.start();control.start();
  for(let wave=2;wave<=10;wave++){
   e.state.spawned=1;const preview=e.getUpcomingWavePreview()!;expect(preview.wave).toBe(wave);
   const ids=[...preview.bosses];(preview.bosses as string[]).push('invalid');
   expect(e.getUpcomingWavePreview()!.bosses).toEqual(ids);e.skipWave();
   expect(e.state.enemies.filter(m=>m.boss).map(m=>m.kind)).toEqual(ids.slice(0,1));
   e.tick(5);expect(e.state.enemies.filter(m=>m.boss).map(m=>m.kind)).toEqual(ids);expect(new Set(ids).size).toBe(ids.length);
  }
  e.summon();control.summon();expect(roster(e)).toEqual(roster(control));
  expect(e.getUpcomingWavePreview()).toBeNull();
 });
 it('grants8 food and immediately spawns the first minion, only once, when calling at18s prep',()=>{
  const e=new BattleEngine({seed:8});e.start();expect(e.canCallEarlyWave()).toEqual({allowed:true,bonusFood:8});
  expect(e.callEarlyWave().ok).toBe(true);expect(e.state.spawned).toBe(1);expect(e.state.enemies).toHaveLength(1);
  expect(e.state.waveTime).toBe(18);expect(e.state.sides.player.food).toBe(30);
  expect(e.callEarlyWave().ok).toBe(false);expect(e.state.sides.player.food).toBe(30);
  expect(e.state.events.some(v=>v.type==='food'&&v.value===8)).toBe(true);
 });
 it('rewards remaining waiting time plus normal next-wave income after a genuinely cleared wave',()=>{
  const e=new BattleEngine();e.start();Object.assign(e.state,{spawned:7,waveTime:20});
  expect(e.canCallEarlyWave()).toEqual({allowed:true,bonusFood:6});expect(e.callEarlyWave().ok).toBe(true);
  expect(e.state.wave).toBe(2);expect(e.state.sides.player.food).toBe(31);
 });
 it('blocks hold, pause, live enemies, partial spawning, delayed bosses, final wave and near-zero wait',()=>{
  const e=new BattleEngine({rankIndex:53,tutorialGuided:true});e.start();e.setTutorialHold(true);expect(e.callEarlyWave().ok).toBe(false);
  e.setTutorialHold(false);e.pause();expect(e.callEarlyWave().ok).toBe(false);e.pause(false);
  e.state.waveTime=16.6;expect(e.callEarlyWave().ok).toBe(false);e.state.waveTime=0;e.spawnEnemy('rat','player');expect(e.callEarlyWave().ok).toBe(false);
  e.state.enemies=[];e.state.spawned=3;expect(e.callEarlyWave().ok).toBe(false);
  while(e.state.wave<6)e.skipWave();e.state.enemies=[];e.state.spawned=30;expect(e.callEarlyWave().ok).toBe(false);
  while(e.state.wave<10)e.skipWave();e.state.enemies=[];e.state.spawned=39;expect(e.callEarlyWave().ok).toBe(false);
 });
});

describe('P6 one free bench lock',()=>{
 it('keeps the exact locked unit, rerolls4 slots, retains escalating prices and fails atomically without food',()=>{
  const e=new BattleEngine({seed:41});e.start();e.summon();const kept=e.state.units[2];kept.level=3;
  expect(e.toggleBenchLock(2).ok).toBe(true);expect(e.state.sides.player.lockedBenchSlot).toBe(2);
  const oldIds=e.state.units.map(u=>u.id);expect(e.summon().ok).toBe(true);
  expect(e.state.units.find(u=>u.id===kept.id)).toBe(kept);expect(kept.level).toBe(3);expect(e.state.units).toHaveLength(5);
  expect(e.state.units.filter(u=>!oldIds.includes(u.id))).toHaveLength(4);expect(e.state.sides.player.food).toBe(0);
  const before=JSON.stringify(e.state);expect(e.summon().ok).toBe(false);expect(JSON.stringify(e.state)).toBe(before);
 });
 it('moves the one lock between occupied slots and toggles it off, never locking empty or invalid slots',()=>{
  const e=new BattleEngine();e.start();pet(e,'hamster');pet(e,'panda');
  for(const slot of [-1,1.5,2,5,NaN])expect(e.toggleBenchLock(slot).ok).toBe(false);
  e.toggleBenchLock(0);e.toggleBenchLock(1);expect(e.state.sides.player.lockedBenchSlot).toBe(1);e.toggleBenchLock(1);expect(e.state.sides.player.lockedBenchSlot).toBeNull();
  e.setTutorialHold(true);expect(e.toggleBenchLock(0).ok).toBe(false);e.setTutorialHold(false);e.pause();expect(e.toggleBenchLock(0).ok).toBe(false);
 });
 it.each(['deploy','same-slot','swap','merge-source','merge-target','shovel-store','shovel-dig','recycle'] as const)('clears lock only when its identity leaves or is consumed: %s',mode=>{
  const e=new BattleEngine({loadouts:{player:{equippedActiveProps:['recycle_bin'],ownedProps:{recycle_bin:1}}}});e.start();
  const a=pet(e,mode.startsWith('shovel')?'shovel':'hamster');e.toggleBenchLock(0);
  if(mode==='deploy')e.move(a.id,{zone:'board',col:2,row:1});
  if(mode==='same-slot')e.move(a.id,{zone:'bench',slot:0});
  if(mode==='swap'){const b=pet(e,'panda');e.move(a.id,b.location);}
  if(mode==='merge-source'){const b=pet(e,'hamster');e.move(a.id,b.location);}
  if(mode==='merge-target'){const b=pet(e,'hamster');e.move(b.id,a.location);}
  if(mode==='shovel-store')e.storeShovel(a.id);
  if(mode==='shovel-dig')e.move(a.id,{zone:'board',col:2,row:0});
  if(mode==='recycle')e.useProp('recycle_bin',{unitId:a.id});
  expect(e.state.sides.player.lockedBenchSlot).toBe(mode==='same-slot'?0:null);
 });
 it('preserves a valid lock after a rejected move, clears stale occupants and caps a locked-shovel pack at2 tools',()=>{
  const e=new BattleEngine({seed:5});e.start();const shovel=pet(e,'shovel');e.toggleBenchLock(0);
  expect(e.move(shovel.id,{zone:'board',col:0,row:0}).ok).toBe(false);expect(e.state.sides.player.lockedBenchSlot).toBe(0);
  e.addFood(10000);for(let i=0;i<60;i++){e.summon();expect(e.state.units.filter(u=>u.kind==='shovel').length).toBeLessThanOrEqual(2);}
  e.state.units=e.state.units.filter(u=>u.id!==shovel.id);e.summon();expect(e.state.sides.player.lockedBenchSlot).toBeNull();expect(e.state.units).toHaveLength(5);
 });
});

it('marks new hero recipes gold, same-unit upgrades and hero feeding small, and excludes shovels or washing units',()=>{
 const e=new BattleEngine();e.start();const a=pet(e,'panda'),b=pet(e,'hat_bamboo');
 expect(getBenchMergeHints(e.state).map(h=>h.kind)).toEqual(['hero','hero']);
 b.kind='kungfu_po';expect(getBenchMergeHints(e.state).map(h=>h.kind)).toEqual(['upgrade','upgrade']);
 a.washing=2;expect(getBenchMergeHints(e.state)).toEqual([]);a.washing=0;
 a.kind=b.kind='hamster';expect(getBenchMergeHints(e.state).map(h=>h.kind)).toEqual(['upgrade','upgrade']);
 a.kind='shovel';expect(getBenchMergeHints(e.state)).toEqual([]);
});
