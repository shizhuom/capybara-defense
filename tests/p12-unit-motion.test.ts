import {describe,expect,it} from 'vitest';
import type {Unit} from '../src/core/types';
import {bodyPose,weaponPose} from '../src/render/HeldWeaponRenderer';
import {UnitMotion} from '../src/render/UnitMotion';

function pet(overrides:Partial<Unit>={}):Unit {
 return {id:10,kind:'corgi',side:'player',level:1,location:{zone:'board',col:2,row:3},
  statuses:{},energy:0,cooldown:0,production:0,buffTime:0,empowered:0,animation:0,facing:1,...overrides};
}

describe('P12 allied motion lifecycle',()=>{
 it('pops a new board pet from .35 through 1.09 and settles at .22 seconds',()=>{
  const motion=new UnitMotion(),unit=pet();
  expect(motion.sample(unit,0,false).spawnScale).toBe(.35);
  const scales=Array.from({length:22},(_,i)=>motion.sample(unit,(i+1)/100,false).spawnScale);
  expect(Math.max(...scales)).toBeGreaterThan(1.08);
  expect(Math.max(...scales)).toBeLessThanOrEqual(1.09);
  expect(scales.at(-1)).toBe(1);
  expect(motion.sample(unit,1,false).spawnScale).toBe(1);
 });

 it('restarts the pop on deployment, board relocation and merges but leaves bench rearrangement still',()=>{
  const motion=new UnitMotion(),unit=pet({location:{zone:'bench',slot:0}});
  expect(motion.sample(unit,0,false).spawnScale).toBe(1);
  unit.location={zone:'bench',slot:1};
  expect(motion.sample(unit,.3,false).spawnScale).toBe(1);
  unit.location={zone:'board',col:2,row:3};
  expect(motion.sample(unit,.4,false).spawnScale).toBe(.35);
  expect(motion.sample(unit,.7,false).spawnScale).toBe(1);
  unit.location={zone:'board',col:3,row:3};
  expect(motion.sample(unit,.8,false).spawnScale).toBe(.35);
  motion.sample(unit,1.1,false);
  unit.level=2;
  expect(motion.sample(unit,1.2,false).spawnScale).toBe(.35);
  motion.sample(unit,1.5,false);
  unit.kind='kungfu_po';
  expect(motion.sample(unit,1.6,false).spawnScale).toBe(.35);
 });

 it('smooths a target reversal with rate 18 while preserving a visible minimum width',()=>{
  const motion=new UnitMotion(),unit=pet();
  expect(motion.sample(unit,0,false).visualFacing).toBe(1);
  unit.facing=-1;
  expect(motion.sample(unit,1/60,false).visualFacing).toBeCloseTo(.481636441,8);
  expect(motion.sample(unit,2/60,false).visualFacing).toBe(.24);
  expect(motion.sample(unit,3/60,false).visualFacing).toBe(-.24);
  for(let frame=4;frame<=30;frame++){
   const facing=motion.sample(unit,frame/60,false).visualFacing;
   expect(Math.abs(facing)).toBeGreaterThanOrEqual(.24);
   expect(Math.abs(facing)).toBeLessThanOrEqual(1);
  }
  expect(motion.sample(unit,.5,false).visualFacing).toBeCloseTo(-1,3);
 });

 it('reaches the same facing at 30 and 60 fps without clamping its internal turn state',()=>{
  const slow=new UnitMotion(),fast=new UnitMotion(),unit=pet();
  slow.sample(unit,0,false);fast.sample(unit,0,false);unit.facing=-1;
  let low=0,high=0;
  for(let frame=1;frame<=3;frame++)low=slow.sample(unit,frame/30,false).visualFacing;
  for(let frame=1;frame<=6;frame++)high=fast.sample(unit,frame/60,false).visualFacing;
  expect(low).toBeCloseTo(high,12);
  expect(low).toBeCloseTo(-.669402224,8);
 });

 it('freezes every pose field while paused and advances the first resumed logical frame',()=>{
  const motion=new UnitMotion(),reference=new UnitMotion(),unit=pet({attackAnim:.8});
  motion.sample(unit,0,false);reference.sample(unit,0,false);
  const before=motion.sample(unit,.05,false);reference.sample(unit,.05,false);
  unit.facing=-1;unit.attackAnim=.5;
  expect(motion.sample(unit,.05,true)).toEqual(before);
  expect(motion.sample(unit,.05,true)).toEqual(before);
  const resumed=motion.sample(unit,.066,false);
  expect(resumed).toEqual(reference.sample(unit,.066,false));
  expect(resumed.rig.phase).toBeGreaterThan(before.rig.phase);
  expect(resumed.spawnScale).toBeGreaterThan(before.spawnScale);
  expect(resumed.visualFacing).toBeLessThan(before.visualFacing);
 });

 it('does not count advancing wall time spent paused toward breathing or spawn age',()=>{
  const motion=new UnitMotion(),reference=new UnitMotion(),unit=pet();
  motion.sample(unit,0,false);reference.sample(unit,0,false);
  const before=motion.sample(unit,.05,false);reference.sample(unit,.05,false);
  expect(motion.sample(unit,100,true)).toEqual(before);
  const resumed=motion.sample(unit,100.016,false),unpaused=reference.sample(unit,.066,false);
  expect(resumed.spawnScale).toBeCloseTo(unpaused.spawnScale,10);
  expect(resumed.rig.phase).toBeCloseTo(unpaused.rig.phase,10);
 });

 it('breathes gently with delayed upper slices and planted unsplit feet without mutating the unit',()=>{
  const motion=new UnitMotion(),unit=pet(),snapshot=structuredClone(unit);
  const first=motion.sample(unit,0,false),next=motion.sample(unit,1/60,false);
  expect(next.rig.phase).toBeGreaterThan(first.rig.phase);
  expect(next.rig.spineLag).toBeGreaterThan(0);
  expect(next.rig.waveAmpX).toBeGreaterThan(0);
  expect(next.rig.waveAmpX).toBeLessThan(2);
  expect(next.rig.breatheAmp).toBeGreaterThan(0);
  expect(next.rig.breatheAmp).toBeLessThan(.03);
  expect(next.rig).toMatchObject({strideX:0,liftY:0,splitLegs:false});
  expect(unit).toEqual(snapshot);
 });

 it('prunes departed ids and clears the previous battle without restarting retained pets',()=>{
  const motion=new UnitMotion(),one=pet(),two=pet({id:11});
  motion.sample(one,0,false);motion.sample(two,0,false);
  motion.sample(one,.3,false);motion.sample(two,.3,false);
  motion.retain(new Set([one.id]));
  expect(motion.sample(one,.4,false).spawnScale).toBe(1);
  expect(motion.sample(two,.4,false).spawnScale).toBe(.35);
  motion.clear();
  expect(motion.sample(one,.5,false).spawnScale).toBe(.35);
 });
});

describe('P12 anticipation, strike and elastic recovery',()=>{
 it.each(['hamster','hedgehog','corgi','kungfu_po','puss_in_hat','zen_master'])('%s leans back, strikes, then returns through a small rebound',kind=>{
  const unit=pet({kind,attackAngle:0,attackAnim:.875});
  expect(bodyPose(unit).x).toBeLessThan(0);
  unit.attackAnim=.5;const strike=bodyPose(unit);
  expect(strike.x).toBeGreaterThan(0);
  expect(strike.scaleX).toBeGreaterThan(1);
  expect(strike.scaleY).toBeLessThan(1);
  unit.attackAnim=.25;const rebound=bodyPose(unit);
  expect(rebound.x).toBeLessThan(0);
  expect(Math.abs(rebound.x)).toBeLessThan(strike.x*.25);
  unit.attackAnim=0;
  expect(bodyPose(unit)).toEqual({x:0,y:0,scaleX:1,scaleY:1});
 });

 it('keeps the three body phases continuous at their boundaries and settles exactly',()=>{
  const unit=pet({attackAngle:0});
  for(const active of [.75,.5,0]){
   unit.attackAnim=active+1e-6;const before=bodyPose(unit);
   unit.attackAnim=Math.max(0,active-1e-6);const after=bodyPose(unit);
   expect(Math.abs(before.x-after.x)).toBeLessThan(.001);
   expect(Math.abs(before.scaleX-after.scaleX)).toBeLessThan(.001);
   expect(Math.abs(before.scaleY-after.scaleY)).toBeLessThan(.001);
  }
 });

 it('withdraws a spear before its 28px strike and recovers with the body',()=>{
  const unit=pet({kind:'hedgehog',attackAngle:0,attackAnim:.875});
  expect(weaponPose(unit,0).extension).toBeLessThan(0);
  unit.attackAnim=.5;
  expect(weaponPose(unit,0).extension).toBe(28);
  unit.attackAnim=.25;
  expect(weaponPose(unit,0).extension).toBeLessThan(0);
  unit.attackAnim=0;
  expect(weaponPose(unit,0).extension).toBe(0);
 });

 it('lowers a casting focus during anticipation, lifts it at strike and lets it settle',()=>{
  const unit=pet({kind:'zen_master',attackAngle:0,attackAnim:0});
  const restingY=weaponPose(unit,0).y;
  unit.attackAnim=.875;
  expect(weaponPose(unit,0).y).toBeGreaterThan(restingY);
  unit.attackAnim=.5;
  expect(weaponPose(unit,0).y).toBeCloseTo(restingY-14);
  unit.attackAnim=.25;
  expect(weaponPose(unit,0).y).toBeGreaterThan(restingY);
  unit.attackAnim=0;
  expect(weaponPose(unit,0).y).toBe(restingY);
 });

 it('keeps the firing kick while the ranged body winds up, stretches and rebounds',()=>{
  const unit=pet({kind:'meowfia',attackAngle:0,attackAnim:1});
  expect(bodyPose(unit).x).toBe(-10);
  expect(weaponPose(unit,0)).toMatchObject({recoil:10,muzzle:true});
  unit.attackAnim=.875;
  expect(bodyPose(unit).scaleX).toBeLessThan(1);
  unit.attackAnim=.5;
  expect(bodyPose(unit).scaleX).toBeGreaterThan(1);
  expect(weaponPose(unit,0).muzzle).toBe(false);
  unit.attackAnim=.25;
  expect(bodyPose(unit).scaleX).toBeLessThan(1);
 });
});
