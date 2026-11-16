import type {Unit} from '../core/types';
import {bodyPose} from './HeldWeaponRenderer';
import type {RigPose} from './SpritePuppetAnimator';

export interface UnitPose {
 visualFacing:number;
 spawnScale:number;
 rig:RigPose;
 body:{x:number;y:number;scaleX:number;scaleY:number};
}

type Motion={
 kind:string;level:number;boardPosition:string;lastSeconds:number;artSeconds:number;
 facing:number;spawnAge:number;pose:UnitPose;
};

const smoothstep=(t:number)=>t*t*(3-2*t);
function spawnScale(age:number):number {
 if(age>=.22)return 1;
 if(age<.14)return .35+.74*(1-Math.pow(1-age/.14,3));
 return 1.09-.09*smoothstep((age-.14)/.08);
}

/** Per-battle rendering state; neither interpolation nor pause changes combat units. */
export class UnitMotion {
 private readonly states=new Map<number,Motion>();

 clear():void {this.states.clear();}
 retain(ids:ReadonlySet<number>):void {
  for(const id of this.states.keys())if(!ids.has(id))this.states.delete(id);
 }

 sample(unit:Unit,seconds:number,paused:boolean):UnitPose {
  const previous=this.states.get(unit.id);
  if(previous&&paused){
   // Also accepts wall-clock callers without catching up across their pause.
   previous.lastSeconds=seconds;
   return previous.pose;
  }
  const dt=previous?Math.max(0,seconds-previous.lastSeconds):0;
  const onBoard=unit.location.zone==='board';
  const boardPosition=unit.location.zone==='board'?`${unit.location.col},${unit.location.row}`:'';
  const deployed=onBoard&&(!previous||previous.boardPosition!==boardPosition||previous.kind!==unit.kind||previous.level!==unit.level);
  const spawnAge=onBoard?(deployed?0:(previous?.spawnAge??0)+dt):.22;
  const targetFacing=unit.facing??1;
  // Keep the unclamped value for frame-rate independent exponential smoothing.
  const facing=previous?targetFacing+(previous.facing-targetFacing)*Math.exp(-18*dt):targetFacing;
  const visualFacing=(Math.sign(facing)||targetFacing)*Math.max(.24,Math.abs(facing));
  const artSeconds=previous?previous.artSeconds+dt:seconds;
  const body=onBoard?bodyPose(unit):{x:0,y:0,scaleX:1,scaleY:1};
  const pose:UnitPose={visualFacing,spawnScale:spawnScale(spawnAge),body,
   rig:{phase:artSeconds*1.35+unit.id*1.71,spineLag:1.4,leanX:body.x*targetFacing*.24,
    waveAmpX:1.15,breatheAmp:.016,strideX:0,liftY:0,splitLegs:false}};
  this.states.set(unit.id,{kind:unit.kind,level:unit.level,boardPosition,lastSeconds:seconds,artSeconds,facing,spawnAge,pose});
  return pose;
 }
}
