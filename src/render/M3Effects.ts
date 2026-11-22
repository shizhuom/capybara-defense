import type {MapId,VisualEvent} from '../core/types';
import {STAGE} from '../config/maps';
import {ellipse,INK,line,PAPER,polygon,round,star} from './StickerArt';
type C=CanvasRenderingContext2D;
export function heart(c:C,x:number,y:number,size:number,color='#df9cae'):void {
  c.save();c.translate(x,y);c.scale(size/12,size/12);c.beginPath();c.moveTo(0,10);c.bezierCurveTo(-24,-4,-10,-20,0,-8);c.bezierCurveTo(10,-20,24,-4,0,10);c.closePath();c.fillStyle=color;c.fill();c.strokeStyle=INK;c.lineWidth=1.8;c.stroke();c.restore();
}
export function confusionSpiral(c:C,seconds:number):void {
  c.save();c.translate(0,-40);c.rotate(seconds*1.7);c.strokeStyle='#9a7db4';c.lineWidth=2.5;c.beginPath();
  for(let i=0;i<=44;i++){const a=i*.32,r=1+i*.25,x=Math.cos(a)*r,y=Math.sin(a)*r*.65;if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.stroke();c.restore();
  line(c,[[-28,-20],[-33,-26],[-30,-31]],'#b29ac5',2);line(c,[[28,-23],[33,-29],[30,-34]],'#b29ac5',2);
}
export function boneShield(c:C):void {
  c.save();c.translate(20,9);polygon(c,[[-13,-17],[13,-17],[11,5],[0,15],[-11,5]],'#9daba2',PAPER,4);polygon(c,[[-13,-17],[13,-17],[11,5],[0,15],[-11,5]],'#9daba2',INK,1.8);
  c.rotate(-.45);line(c,[[0,-11],[0,6]],'#f4e7c8',5);
  for(const y of [-11,6])for(const x of [-2,2])ellipse(c,x,y,3,3,'#f4e7c8',INK,.8);c.restore();
}
/** Edge decorations stay outside the hit-tested board rectangle. */
export function drawThemeEdges(c:C,id:MapId,time:number,accent:string):void {
  for(const [x,y,flip] of [[17,280,1],[623,927,-1],[18,938,1],[621,281,-1]]){
    c.save();c.translate(x,y);c.scale(flip*.7,.7);c.rotate(Math.sin(time*.4)*.035);
    if(id==='sakura_onsen'){
      line(c,[[-12,35],[0,4],[8,-28]],'#9c7b69',4);
      for(const [px,py] of [[0,3],[7,-23],[-7,24]]){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipse(c,px+Math.cos(a)*7,py+Math.sin(a)*7,5,6,'#edbbc7',INK,.8);}ellipse(c,px,py,3,3,'#f2d18b',INK,.6);}
    }else if(id==='midnight_kitchen'){
      round(c,-11,-20,22,36,5,'#ebdcc3',INK,2);line(c,[[-11,-25],[11,-25]],'#ab8063',5);line(c,[[2,16],[2,36]],'#a1ada4',4);ellipse(c,2,39,7,10,'#c3d0c5',INK,1.8);line(c,[[-6,-7],[6,-7]],'#bba58a',2);
    }else if(id==='cat_tower_maze'){
      line(c,[[0,-34],[0,32]],'#c7a87e',12);for(let y=-30;y<28;y+=6)line(c,[[-5,y],[5,y+3]],'#a88c69',1.2);
      round(c,-17,-3,34,9,3,'#d5bea0',INK,1.7);line(c,[[15,3],[20,23]],INK,1);ellipse(c,20,29,7,7,accent,INK,1.6);line(c,[[14,27],[25,30]],'#f6dfc1',1);
    }else{
      line(c,[[0,30],[0,0]],'#8da174',3);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipse(c,Math.cos(a)*9,Math.sin(a)*9,6,7,accent,INK,1);}ellipse(c,0,0,5,5,'#f3d17d',INK,1);polygon(c,[[0,20],[-14,13],[-9,25]],'#9eb484',INK,1.2);
    }
    c.restore();
  }
}
/** Every target was captured by the engine: no live unit lookup or guessed random target. */
export function drawM3Event(c:C,event:VisualEvent):boolean {
  if(event.type!=='boss_skill')return false;
  const p=Math.max(0,Math.min(1,event.age/Math.max(.001,event.duration))),pixel=(col:number,row:number)=>({x:STAGE.boardX+(col+.5)*STAGE.cell,y:STAGE.boardY+(row+.5)*STAGE.cell});
  const source=pixel(event.col,event.row),targets=event.points?.length?event.points:[{col:event.col,row:event.row}];
  c.save();c.globalAlpha*=Math.min(1,(1-p)*4);
  // Source tells the player who cast the effect, even after that boss is defeated.
  c.save();c.translate(source.x,source.y);
  if(event.effect==='buff_roo'){for(let i=0;i<3;i++)ellipse(c,0,15,15+p*(60+i*25),5+p*(30+i*9),'rgba(0,0,0,0)','#dcaa73',3-i*.5);}
  else if(event.effect==='screaming_marmot'){for(let i=0;i<3;i++)ellipse(c,0,-3,18+p*(75+i*23),18+p*(55+i*18),'rgba(0,0,0,0)','#b6a0cf',2.8);}
  else if(event.effect==='hornet_queen'){polygon(c,[[-5,-7],[22,-21],[22,4],[-5,-1]],'#e7c162',INK,2);line(c,[[28,-18],[36,-24]],'#e7c162',2);line(c,[[29,-8],[41,-8]],'#e7c162',2);}
  else if(event.effect==='trash_coon'){ellipse(c,0,0,25+p*45,10+p*15,'rgba(0,0,0,0)','#9bb89a',3);for(let i=0;i<3;i++){const x=(i-1)*19;line(c,[[x,3],[x,-12-p*29]],'#adc6a0',4);star(c,x,-14-p*29,5,'#dce2b4',1);}}
  else if(event.effect==='dj_rat_king'){for(let i=0;i<3;i++)ellipse(c,0,0,25+p*(80+i*35),25+p*(80+i*35),'rgba(0,0,0,0)',i%2?'#aad3b8':'#d3a8ce',3);}
  else if(event.effect==='dr_clippers'){
    for(let i=0;i<2;i++)ellipse(c,0,0,18+p*(54+i*24),14+p*(40+i*18),'rgba(0,0,0,0)',i?'#e66479':'#b49aba',3-i*.6);
  }
  else heart(c,0,-30,12+p*4);
  c.restore();
  for(const [index,point] of targets.entries()){
    const target=pixel(point.col,point.row);
    if(event.effect==='diva_kitty'){const travel=Math.min(1,p*1.6);heart(c,source.x+(target.x-source.x)*travel,source.y+(target.y-source.y)*travel-Math.sin(travel*Math.PI)*30,10);}
    if(event.effect==='dr_clippers'){
      c.save();c.setLineDash([6,5]);line(c,[[source.x,source.y],[target.x,target.y]],'#e05a6d',3);c.restore();
    }
    c.save();c.translate(target.x,target.y);
    switch(event.effect){
      case 'dr_clippers':{
        const snap=Math.abs(Math.sin(p*Math.PI*3))*.42;
        ellipse(c,0,0,16+p*36,16+p*36,'rgba(224,79,95,0.12)','#e04f5f',3);
        for(const dir of [-1,1]){
          c.save();c.rotate(dir*(.22+snap));
          line(c,[[-22,0],[24,0]],'#eef3f7',5);line(c,[[-22,0],[24,0]],INK,2);
          ellipse(c,-26,dir*6,6,6,'#e05a6d',INK,1.8);
          c.restore();
        }
        for(let i=0;i<5;i++){
          const a=i*Math.PI*2/5+p*2.4,r=12+p*34;
          ellipse(c,Math.cos(a)*r,Math.sin(a)*r-p*10,4.5*(1-p*.5),3.2*(1-p*.5),'#f6ead4',INK,1);
        }
        break;
      }
      case 'diva_kitty':heart(c,0,-17-Math.sin(p*Math.PI)*13,8+p*4);ellipse(c,0,18,17+p*15,6,'rgba(0,0,0,0)','#e2a1b2',2);break;
      case 'buff_roo':for(let i=0;i<4;i++){const a=i*Math.PI/2+p;star(c,Math.cos(a)*(15+p*30),Math.sin(a)*(10+p*22),6,'#edc277',1);}line(c,[[-24,19],[-9,11],[0,24],[10,13],[26,20]],'#a78867',2);break;
      case 'hornet_queen':line(c,[[-30-p*18,-8],[-6,-8]],'#dbb359',3);line(c,[[-25-p*18,5],[-3,5]],'#dbb359',2);polygon(c,[[6,-4],[17,0],[6,4]],'#f0d379',INK,1);break;
      case 'screaming_marmot':confusionSpiral(c,event.age+index);break;
      case 'trash_coon':ellipse(c,0,14,23,8,'rgba(0,0,0,0)','#a6b896',2);line(c,[[-10,-7],[10,7]],'#f4e7c8',5);for(const [x,y] of [[-10,-7],[10,7]]){ellipse(c,x-2,y,3,3,'#f4e7c8',INK,1);ellipse(c,x+2,y,3,3,'#f4e7c8',INK,1);}break;
      case 'dj_rat_king':line(c,[[-7,-16],[-7,-4],[7,-4],[7,-16]],'#91ba91',4);line(c,[[0,-22],[0,3]],'#91ba91',4);for(const x of [-15,15]){line(c,[[x,16],[x,2]],'#d0a2ca',2);ellipse(c,x-4,16,4,3,'#d0a2ca',INK,1);}break;
      default:star(c,0,0,12,'#ecd39b',1);
    }
    c.restore();
  }
  c.restore();return true;
}
