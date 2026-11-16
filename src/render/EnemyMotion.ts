import type {Enemy,Point} from '../core/types';
import type {RigPose} from './SpritePuppetAnimator';

export const ENEMY_NATURAL_FACING:Readonly<Record<string,-1|0|1>>={
  rat:-1,roach:-1,killer_bee:-1,dr_clippers:-1,king_skunk:-1,hornet_queen:-1,dj_rat_king:-1,
  charmed_rat:1,husky_wrecker:1,diva_kitty:1,screaming_marmot:1,trash_coon:1,
  crab:0,mega_roomba:0,box_kraken:0,sad_rain_frog:0,buff_roo:0,
};
export type EnemyArchetype='scurry'|'skitter'|'scuttle'|'flyer'|'roller'|'hopper'|'heavy_boss';
export interface EnemyPose {
  dirX:1|-1;flipX:number;phase:number;hopY:number;tilt:number;
  squashX:number;squashY:number;shadowScale:number;footfall:boolean;artSeconds:number;
  rig:RigPose;spawnScale:number;jello:number;visualFlip:number;bankTilt:number;
  archetype:EnemyArchetype;wingPhase:number;motorPhase:number;
  /** Normalized ground-ring age; -1 means no landing ring. */
  landing:number;
  /** 0..1 envelope of a boss ability's .45 second anticipation/roar. */
  roar:number;
}
type Motion={
  lastCol:number;lastProgress:number;lastSeconds:number;paused:boolean;clock:number;gaitSeconds:number;
  born:number;hitAt?:number;roarAt?:number;lastHp:number;lastHitFlash:number;lastCooldown:number;
  rawFlip:number;lastStep:number;pose:EnemyPose;
};
type Species={frequency:number;spineLag:number;leanX:number;waveAmpX:number;breatheAmp:number;strideX:number;liftY:number};
const TAU=Math.PI*2;
const SPECIES:Record<EnemyArchetype,Species>={
  scurry:{frequency:9.5,spineLag:2.5,leanX:4,waveAmpX:3.2,breatheAmp:.025,strideX:6.5,liftY:4.5},
  skitter:{frequency:13.5,spineLag:1.8,leanX:2,waveAmpX:1.6,breatheAmp:.018,strideX:4.2,liftY:2.2},
  scuttle:{frequency:8,spineLag:2.1,leanX:0,waveAmpX:2.6,breatheAmp:.035,strideX:5.5,liftY:2.6},
  flyer:{frequency:6.8,spineLag:3.2,leanX:3.5,waveAmpX:1.8,breatheAmp:.018,strideX:0,liftY:0},
  roller:{frequency:6,spineLag:1.2,leanX:1.5,waveAmpX:.45,breatheAmp:.008,strideX:0,liftY:0},
  hopper:{frequency:5.2,spineLag:2.2,leanX:1.8,waveAmpX:1.3,breatheAmp:.025,strideX:4.5,liftY:3.5},
  heavy_boss:{frequency:4.6,spineLag:3.8,leanX:2.5,waveAmpX:3.8,breatheAmp:.045,strideX:8.5,liftY:5.5},
};
function archetypeFor(enemy:Enemy):EnemyArchetype {
  switch(enemy.kind){
    case 'rat':case 'charmed_rat':return 'scurry';
    case 'roach':return 'skitter';
    case 'crab':return 'scuttle';
    case 'killer_bee':case 'hornet_queen':return 'flyer';
    case 'mega_roomba':case 'dr_clippers':return 'roller';
    case 'sad_rain_frog':case 'buff_roo':return 'hopper';
    default:return enemy.boss?'heavy_boss':'scurry';
  }
}
function initialDirection(path:readonly Point[],progress:number):1|-1 {
  let direction:1|-1|undefined;
  for(let i=0;i<path.length-1;i++){
    const dx=path[i+1].col-path[i].col;
    if(dx!==0){if(i<=progress)direction=dx>0?1:-1;else if(direction===undefined)return dx>0?1:-1;}
    if(i>progress&&direction!==undefined)break;
  }
  return direction??1;
}
const clamp01=(value:number)=>Math.max(0,Math.min(1,value));
const smooth=(value:number)=>{const p=clamp01(value);return p*p*(3-2*p);};
function spawnScale(age:number):number {
  if(age>=.22-1e-9)return 1;
  const p=clamp01(age/.22);
  return p<.65?.35+.74*(1-Math.pow(1-p/.65,3)):1+.09*(1-smooth((p-.65)/.35));
}

/** Rendering-only state: movement follows progress; no enemy data or combat events are changed. */
export class EnemyMotion {
  private readonly states=new Map<number,Motion>();
  clear():void {this.states.clear();}
  retain(ids:ReadonlySet<number>):void {for(const id of this.states.keys())if(!ids.has(id))this.states.delete(id);}
  sample(enemy:Enemy,seconds:number,paused:boolean,path:readonly Point[]):EnemyPose {
    const previous=this.states.get(enemy.id);
    const now=Number.isFinite(seconds)?seconds:previous?.lastSeconds??0;
    if(paused&&previous){
      previous.lastSeconds=now;previous.paused=true;
      return previous.pose;
    }
    const elapsed=previous?Math.max(0,now-previous.lastSeconds):0;
    // Scene clocks resume with a frame delta; standalone wall clocks can skip a whole pause.
    const dt=previous?.paused&&elapsed>.1?0:elapsed;
    const clock=previous?previous.clock+dt:now;
    const frozen=enemy.stun>0||paused;
    const gaitSeconds=previous?previous.gaitSeconds+(frozen?0:dt):clock;
    const dx=previous?enemy.col-previous.lastCol:0;
    const dirX:1|-1=Math.abs(dx)>.002?(dx>0?1:-1):previous?.pose.dirX??initialDirection(path,enemy.progress);
    const naturalFacing=ENEMY_NATURAL_FACING[enemy.kind]||1,flipX=dirX*naturalFacing;
    const rawFlip=previous?previous.rawFlip+(flipX-previous.rawFlip)*(1-Math.exp(-18*dt)):flipX;
    const visualFlip=(rawFlip<0?-1:rawFlip>0?1:flipX)*Math.max(.24,Math.abs(rawFlip));
    const bankTilt=(flipX-rawFlip)*.1;
    const archetype=archetypeFor(enemy),species=SPECIES[archetype];
    const usesClock=archetype==='flyer'||archetype==='roller';
    const phase=previous?(frozen?previous.pose.phase:previous.pose.phase+(usesClock?dt*species.frequency:(enemy.progress-previous.lastProgress)*species.frequency)):
      (usesClock?gaitSeconds*species.frequency:enemy.progress*species.frequency)+enemy.id*1.3;
    const rig:RigPose={phase,spineLag:species.spineLag,leanX:species.leanX*naturalFacing,waveAmpX:species.waveAmpX,
      breatheAmp:species.breatheAmp,strideX:species.strideX,liftY:species.liftY,splitLegs:!usesClock};
    const wave=Math.sin(phase),contact=Math.cos(phase*2);
    let hopY=0,tilt=0,squashX=1,squashY=1,landing=-1;
    switch(archetype){
      case 'scurry':
        hopY=-Math.abs(wave)*3.4;tilt=dirX*.09+wave*.035;
        squashX=1+contact*.025;squashY=1-contact*.025;break;
      case 'skitter':
        hopY=-Math.abs(wave)*1.8;tilt=wave*.035;
        squashX=1+contact*.018;squashY=1-contact*.018;break;
      case 'scuttle':
        hopY=-Math.abs(Math.sin(phase*2))*2.2;tilt=wave*.13;
        squashX=1+contact*.025;squashY=1-contact*.025;break;
      case 'flyer':
        hopY=-11+Math.sin(gaitSeconds*5.2+enemy.id)*5;tilt=dirX*.12+wave*.045;
        squashX=1+contact*.012;squashY=1-contact*.012;break;
      case 'roller':
        hopY=Math.sin(gaitSeconds*36*TAU+enemy.id)*.8;
        tilt=dirX*(.025+Math.min(.045,Math.abs(enemy.progress-(previous?.lastProgress??enemy.progress)))*.5);break;
      case 'hopper':{
        const cycle=((phase%TAU)+TAU)%TAU/TAU;
        squashX=1.15;squashY=.84;
        if(cycle>=.24&&cycle<.88){
          const flight=(cycle-.24)/.64,height=enemy.kind==='buff_roo'?18:14;
          hopY=-4*height*flight*(1-flight);
          const stretch=smooth((cycle-.24)/.035),land=smooth((cycle-.84)/.04);
          squashX=(1.15-.25*stretch)*(1-land)+1.19*land;
          squashY=(.84+.28*stretch)*(1-land)+.8*land;
        }else if(cycle>=.88){
          landing=(cycle-.88)/.12;
          squashX=1.19-.04*smooth(landing);squashY=.8+.04*smooth(landing);
        }
        tilt=wave*.035;break;
      }
      case 'heavy_boss':{
        hopY=-Math.pow(Math.abs(wave),.65)*7;tilt=Math.sin(phase-.35)*.085;
        squashX=1+contact*.055;squashY=1-contact*.055;
        const stepAge=((phase%Math.PI)+Math.PI)%Math.PI/Math.PI;
        if(stepAge<.18)landing=stepAge/.18;
        break;
      }
    }
    const step=archetype==='hopper'?Math.floor((phase/TAU)-.88):Math.floor(phase/Math.PI);
    const hitAt=enemy.hitFlash>(previous?.lastHitFlash??0)+.001||enemy.hp<(previous?.lastHp??enemy.hp)?clock:previous?.hitAt;
    const roarAt=enemy.boss&&previous&&enemy.abilityCooldown>previous.lastCooldown+.05?clock:previous?.roarAt;
    const hitAge=hitAt===undefined?Infinity:Math.max(0,clock-hitAt);
    const roarAge=roarAt===undefined?Infinity:Math.max(0,clock-roarAt);
    const pose:EnemyPose={dirX,flipX,phase,hopY,tilt:enemy.stun>0?Math.sin(clock*16+enemy.id)*.06:tilt,
      squashX,squashY,shadowScale:Math.max(.3,1-Math.max(0,-hopY)/28),
      footfall:!frozen&&!usesClock&&!!previous&&step!==previous.lastStep&&enemy.progress!==previous.lastProgress,
      artSeconds:frozen&&previous?previous.pose.artSeconds:usesClock?gaitSeconds:phase/7,
      rig,spawnScale:spawnScale(clock-(previous?.born??clock)),
      jello:Number.isFinite(hitAge)?Math.exp(-14*hitAge)*Math.sin(34*hitAge):0,
      visualFlip,bankTilt,archetype,wingPhase:gaitSeconds*28*TAU+enemy.id,motorPhase:gaitSeconds*36*TAU+enemy.id,
      landing,roar:roarAge<.45?Math.sin(roarAge/.45*Math.PI):0};
    this.states.set(enemy.id,{lastCol:enemy.col,lastProgress:enemy.progress,lastSeconds:now,paused,clock,gaitSeconds,
      born:previous?.born??clock,hitAt,roarAt,lastHp:enemy.hp,lastHitFlash:enemy.hitFlash,lastCooldown:enemy.abilityCooldown,
      rawFlip,lastStep:step,pose});
    return pose;
  }
}
