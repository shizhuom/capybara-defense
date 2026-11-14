import type {Enemy,Point} from '../core/types';

export const ENEMY_NATURAL_FACING:Readonly<Record<string,-1|0|1>>={
  rat:-1,roach:-1,killer_bee:-1,dr_clippers:-1,king_skunk:-1,hornet_queen:-1,dj_rat_king:-1,
  charmed_rat:1,husky_wrecker:1,diva_kitty:1,screaming_marmot:1,trash_coon:1,
  crab:0,mega_roomba:0,box_kraken:0,sad_rain_frog:0,buff_roo:0,
};
export interface EnemyPose {
  dirX:1|-1;flipX:number;phase:number;useWalk2:boolean;hopY:number;tilt:number;
  squashX:number;squashY:number;shadowScale:number;footfall:boolean;artSeconds:number;
}
type Motion={lastCol:number;lastRow:number;lastStep:number;pose:EnemyPose};
function initialDirection(path:readonly Point[],progress:number):1|-1 {
  let direction:1|-1|undefined;
  for(let i=0;i<path.length-1;i++){
    const dx=path[i+1].col-path[i].col;
    if(dx!==0){if(i<=progress)direction=dx>0?1:-1;else if(direction===undefined)return dx>0?1:-1;}
    if(i>progress&&direction!==undefined)break;
  }
  return direction??1;
}

/** Rendering-only state: gait follows traveled progress, never mutates enemies or emits combat events. */
export class EnemyMotion {
  private readonly states=new Map<number,Motion>();
  clear():void {this.states.clear();}
  retain(ids:ReadonlySet<number>):void {for(const id of this.states.keys())if(!ids.has(id))this.states.delete(id);}
  sample(enemy:Enemy,seconds:number,paused:boolean,path:readonly Point[]):EnemyPose {
    const previous=this.states.get(enemy.id);
    if(paused&&previous)return {...previous.pose,footfall:false};
    const dx=previous?enemy.col-previous.lastCol:0;
    const dirX=Math.abs(dx)>.002?(dx>0?1:-1):previous?.pose.dirX??initialDirection(path,enemy.progress);
    const flying=enemy.kind==='killer_bee'||enemy.kind==='hornet_queen';
    const steps=enemy.boss?3.8:enemy.kind==='roach'?6.5:enemy.kind==='crab'?5:5.5;
    const frozen=enemy.stun>0||paused;
    const phase=frozen&&previous?previous.pose.phase:(flying?seconds*12*Math.PI+enemy.id*1.3:enemy.progress*steps*Math.PI+enemy.id*1.3);
    const useWalk2=frozen&&previous?previous.pose.useWalk2:flying?Math.floor(seconds*12+enemy.id)%2===1:Math.sin(phase)<0;
    const hopY=frozen?0:-Math.abs(Math.sin(phase))*(enemy.boss?6.5:enemy.kind==='roach'?3.5:5.5);
    const contact=Math.cos(phase*2),step=Math.floor(phase/Math.PI);
    const pose:EnemyPose={dirX,flipX:ENEMY_NATURAL_FACING[enemy.kind]?dirX*ENEMY_NATURAL_FACING[enemy.kind]:dirX,
      phase,useWalk2,hopY,tilt:enemy.stun>0?Math.sin(seconds*16)*.06:Math.sin(phase)*(enemy.boss?.065:.085),
      squashX:1+contact*.04,squashY:1-contact*.04,shadowScale:1-(-hopY/18),
      footfall:!frozen&&!flying&&!!previous&&step!==previous.lastStep&&enemy.progress!==0&&(enemy.boss||enemy.kind==='roach'),
      artSeconds:frozen&&previous?previous.pose.artSeconds:flying?seconds:phase/7};
    this.states.set(enemy.id,{lastCol:enemy.col,lastRow:enemy.row,lastStep:step,pose});
    return pose;
  }
}
