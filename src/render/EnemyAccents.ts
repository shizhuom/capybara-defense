import type {Enemy} from '../core/types';
import type {EnemyPose} from './EnemyMotion';
import {ellipse,line,star} from './StickerArt';

/** Render-only accents use the cached pose clock, so pause freezes every stroke. */
export function drawEnemyAccents(c:CanvasRenderingContext2D,enemy:Enemy,pose:EnemyPose,size:number):void {
 c.save();
 if(pose.archetype==='flyer'){
  const flap=Math.sin(pose.wingPhase),span=size*.23;
  for(const side of [-1,1]){
   c.save();c.translate(side*size*.15,-size*.14);c.rotate(side*(.5+flap*.6));c.globalAlpha*=.43;
   ellipse(c,side*span*.5,-7,span,6+Math.abs(flap)*6,'#d8fbf7','#f3fff8',1.2);
   c.globalAlpha*=.5;ellipse(c,side*span*.44,-1,span*.9,5,'#f5fff5','',0);c.restore();
  }
 }else if(pose.archetype==='roller'){
  c.save();c.translate(0,size*.32);c.scale(1,.3);c.rotate(pose.motorPhase*.035);c.globalAlpha*=.65;
  for(let i=0;i<3;i++){
   const a=i*Math.PI*2/3;c.beginPath();c.arc(0,0,size*(.25+i*.025),a,a+1.2);c.strokeStyle=enemy.kind==='mega_roomba'?'#c9e9d9':'#ffe29a';c.lineWidth=2;c.stroke();
  }c.restore();
  if(enemy.kind==='dr_clippers')for(let i=0;i<3;i++){
   const a=pose.motorPhase*.08+i*2;star(c,-pose.dirX*(size*.26+i*5),size*.27+Math.sin(a)*5,2+Math.abs(Math.sin(a))*2,'#ffe5a6',.5);
  }
 }
 if(pose.roar>0){
  c.globalAlpha*=pose.roar*.6;
  for(const side of [-1,1])line(c,[[side*size*.45,-size*.23],[side*size*(.5+pose.roar*.08),-size*.28]],'#ffdea3',3);
 }
 c.restore();
}
export function drawLandingRipple(c:CanvasRenderingContext2D,pose:EnemyPose,size:number):void {
 if(pose.landing<0||pose.landing>=1)return;
 const p=pose.landing;c.save();c.globalAlpha*=.32*(1-p);
 ellipse(c,0,size*.31,size*(.21+p*.23),size*(.045+p*.035),'transparent',pose.archetype==='hopper'?'#d8f7e6':'#ecdbb4',2.1);c.restore();
}
