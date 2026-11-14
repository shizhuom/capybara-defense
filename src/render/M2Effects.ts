import type { Point, VisualEvent } from '../core/types';
import { STAGE } from '../config/maps';
import { drawUnitArt, ellipse, INK, line, PAPER, polygon, round, star } from './StickerArt';

type C=CanvasRenderingContext2D;
type Pixel={x:number;y:number};
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const pixel=(point:Point):Pixel=>({x:STAGE.boardX+(point.col+.5)*STAGE.cell,y:STAGE.boardY+(point.row+.5)*STAGE.cell});

/** Equal time per strike/bounce. Points are captured at cast time, never read from live units. */
function sample(points:Point[],progress:number) {
  const step=clamp(progress)*Math.max(0,points.length-1),index=Math.min(Math.floor(step),Math.max(0,points.length-2));
  const a=pixel(points[index]),b=pixel(points[Math.min(index+1,points.length-1)]),local=step-index;
  return {x:a.x+(b.x-a.x)*local,y:a.y+(b.y-a.y)*local,angle:Math.atan2(b.y-a.y,b.x-a.x),local,index};
}

function ball(c:C,yarn:boolean,spin:number):void {
  c.rotate(spin);
  ellipse(c,0,0,13,13,yarn?'#c2a1d4':'#ed9856',PAPER,4);
  ellipse(c,0,0,13,13,yarn?'#c2a1d4':'#ed9856',INK,1.7);
  if(yarn) {
    for(let i=-1;i<=1;i++) {
      c.beginPath();c.moveTo(-10,i*5-3);c.quadraticCurveTo(0,i*6+9,10,i*5-3);c.strokeStyle='#80689e';c.lineWidth=1.6;c.stroke();
    }
    line(c,[[-8,-9],[8,9]],'#f4e7f8',1.5);
  } else {
    line(c,[[-12,0],[12,0]],INK,1.4);line(c,[[0,-12],[0,12]],INK,1.4);
    c.beginPath();c.moveTo(-8,-10);c.quadraticCurveTo(7,0,-8,10);c.strokeStyle=INK;c.lineWidth=1.4;c.stroke();
  }
}

function sprinkler(c:C,age:number):void {
  // Local forward is +x, so rotation can follow each road corner.
  for(let i=0;i<8;i++) {
    const travel=(age*3+i/8)%1,x=15+travel*53,y=Math.sin(i*2.7)*travel*39;
    line(c,[[x-9,y*.83],[x,y]],'#91d3df',3*(1-travel)+1);
  }
  ellipse(c,0,15,29,7,'rgba(88,132,134,.18)','',0);
  round(c,-24,-15,45,29,7,'#f2ca62',INK,2.6);
  round(c,-10,-29,23,20,7,'#aed8d5',INK,2.1);
  line(c,[[6,-20],[24,-20],[31,-14]],'#e4ae52',5);
  ellipse(c,-14,14,8,8,'#647b77',INK,2);ellipse(c,15,14,8,8,'#647b77',INK,2);
  ellipse(c,-14,14,3,3,PAPER,INK,1);ellipse(c,15,14,3,3,PAPER,INK,1);
  star(c,-7,-2,6,PAPER,0);
}

function giantCat(c:C,progress:number):void {
  const fall=clamp(progress/.52),landed=progress>=.52,drop=(1-fall*fall)*180;
  c.save();c.globalAlpha*=.24+fall*.25;ellipse(c,0,24,20+fall*47,5+fall*10,'#9a7854','',0);c.restore();
  if(landed) {
    const shock=clamp((progress-.52)/.48);
    ellipse(c,0,28,35+shock*90,10+shock*26,'rgba(255,255,255,0)','#f1cb79',4*(1-shock)+1);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;star(c,Math.cos(a)*(40+shock*65),24+Math.sin(a)*(15+shock*23),5*(1-shock)+2,'#f5d796',0);}
  }
  c.save();c.translate(0,-drop);const squash=landed?Math.sin((progress-.52)*14)*.07:0;c.scale(1+squash,1-squash);
  polygon(c,[[-53,-12],[-58,-57],[-28,-39],[27,-39],[56,-57],[52,-10]],'#e9a34f',PAPER,8);
  ellipse(c,0,7,65,39,'#e9a34f',PAPER,8);ellipse(c,0,7,65,39,'#e9a34f',INK,2.8);
  polygon(c,[[-53,-12],[-58,-57],[-28,-39]],'#e9a34f',INK,2.8);polygon(c,[[27,-39],[56,-57],[52,-10]],'#e9a34f',INK,2.8);
  ellipse(c,0,16,36,23,'#f7d29a','',0);ellipse(c,-37,28,18,11,'#edb46d',INK,2);ellipse(c,37,28,18,11,'#edb46d',INK,2);
  line(c,[[-33,-9],[-23,-5],[-14,-9]],INK,3);line(c,[[14,-9],[23,-5],[33,-9]],INK,3);
  polygon(c,[[-5,2],[5,2],[0,8]],'#bd8073',INK,1.5);line(c,[[0,8],[0,14],[-7,17]],INK,2);line(c,[[0,14],[7,17]],INK,2);
  for(const x of [-15,0,15])line(c,[[x,-36],[x*.8,-24]],'#bc793f',4);
  for(const d of [-1,1]){line(c,[[d*37,5],[d*54,1]],'#986c49',2);line(c,[[d*37,12],[d*56,16]],'#986c49',2);}
  c.restore();
}

function weapon(c:C,effect:string,progress:number):void {
  const radius=14+progress*38;
  if(/bamboo|shoot/.test(effect)) {
    for(let i=-2;i<=2;i++) {
      const height=(25+(2-Math.abs(i))*10)*Math.sin(Math.PI*Math.min(1,progress*1.4));
      polygon(c,[[i*15-7,15],[i*15,-height],[i*15+7,15]],'#94b768',INK,1.7);
      line(c,[[i*15-4,4],[i*15+4,4]],'#d6de9d',1.5);
    }
  } else if(/fish|missile/.test(effect)) {
    ellipse(c,0,0,22,9,'#a6c8c1',PAPER,3);polygon(c,[[-19,0],[-31,-10],[-31,10]],'#a6c8c1',INK,1.5);ellipse(c,13,-2,2,2,INK,INK,0);
    line(c,[[-11,-1],[8,-1]],PAPER,2);
  } else if(/claw|scratch|meteor/.test(effect)) {
    ellipse(c,0,4,16,13,'#efdfbd',INK,2);
    for(let i=0;i<3;i++){ellipse(c,-13+i*13,-15,6,8,'#efdfbd',INK,1.5);line(c,[[-17+i*13,-35],[-23+i*13,-4]],'#f5e6cb',4);}
  } else if(/fire|flame|burn|heat|popcorn|rocket|dryer/.test(effect)) {
    polygon(c,[[-18,18],[-25,-2],[-10,2],[-7,-30],[8,-8],[15,-19],[22,18]],'#efad54',INK,1.7);
    polygon(c,[[-8,18],[-7,-2],[2,4],[9,-8],[13,18]],'#ffe4a2','',0);
  } else if(/vacuum|vortex|black_hole/.test(effect)) {
    ellipse(c,0,0,radius,radius*.65,'#705688',PAPER,2);
    c.rotate(progress*9);for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(4,-25,30,-12,26,6);c.strokeStyle='#d3bce1';c.lineWidth=3;c.stroke();}
  } else if(/treasure/.test(effect)) {
    round(c,-24,-9,48,32,4,'#b88242',INK,2.2);c.save();c.translate(-24,-11);c.rotate(-progress*.7);round(c,0,-14,48,17,5,'#b88242',INK,2.2);line(c,[[9,-14],[9,2]],'#edc86a',4);line(c,[[39,-14],[39,2]],'#edc86a',4);c.restore();
    round(c,-5,-6,10,13,2,'#f3ce70',INK,1.4);star(c,6,-21-progress*22,8,'#f6db8e',1);
  } else if(/electric|zap|laser|lightning/.test(effect)) {
    polygon(c,[[4,-31],[-20,4],[-3,3],[-8,30],[22,-9],[5,-7]],'#abdce5',PAPER,3);
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3+progress*4;star(c,Math.cos(a)*radius,Math.sin(a)*radius,4,'#f6dc8e',0);}
  } else if(/coin|fortune|lucky/.test(effect)) {
    c.rotate(progress*3);ellipse(c,0,0,17,20,'#edc85e',INK,2);ellipse(c,0,0,11,14,'#f6da87','#bd9746',1.4);line(c,[[0,-8],[0,8]],'#a58039',3);
  } else if(/bubble|water|washer|squirt/.test(effect)) {
    for(let i=0;i<4;i++){const a=i*Math.PI*2/4;ellipse(c,Math.cos(a)*radius*.6,Math.sin(a)*radius*.6,8+i,8+i,'#c6e8e6','#78b9c2',1.5);ellipse(c,Math.cos(a)*radius*.6-3,Math.sin(a)*radius*.6-3,2,3,PAPER,'',0);}
  } else if(/wave|rolling|wooden|sound|yin|yang|disco/.test(effect)) {
    for(let i=0;i<3;i++)ellipse(c,0,0,8+i*10+progress*18,4+i*5+progress*9,'rgba(255,255,255,0)','#c6bcd9',2.5);
    star(c,0,0,10,'#c6bcd9',1);
  } else if(/yarn/.test(effect))ball(c,true,progress*7);
  else if(/ball|hoop/.test(effect))ball(c,false,progress*7);
  else {
    ellipse(c,0,0,radius,radius,'rgba(255,255,255,0)','#c6a0ce',2);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5+progress*2;star(c,Math.cos(a)*radius,Math.sin(a)*radius,6,'#e9c77c',1);}
  }
}

/** Returns whether the event was consumed; legacy effects remain in StickerRenderer. */
export function drawM2Event(c:C,event:VisualEvent):boolean {
  if(!['dash','bounce','sprinkler','giant_cat','weapon'].includes(event.type))return false;
  const progress=clamp(event.duration>0?event.age/event.duration:1);
  const points=event.points?.length?event.points:[{col:event.col,row:event.row},{col:event.targetCol??event.col,row:event.targetRow??event.row}];
  const current=sample(points,progress);
  c.save();c.lineCap='round';c.lineJoin='round';
  c.globalAlpha*=Math.min(1,(1-progress)*7+.15);
  if(event.type==='dash') {
    // Only the current strike and recent afterimages are visible; never draw all strikes at once.
    for(let i=3;i>=1;i--) {
      const behind=sample(points,Math.max(0,progress-i*.022));
      c.save();c.globalAlpha*=.13*(4-i);c.translate(behind.x,behind.y);if(Math.cos(behind.angle)<0)c.scale(-1,1);c.scale(.57,.57);drawUnitArt(c,'ronin_goose',event.age);c.restore();
    }
    c.translate(current.x,current.y);c.save();if(Math.cos(current.angle)<0)c.scale(-1,1);c.scale(.62,.62);drawUnitArt(c,'ronin_goose',event.age);c.restore();
    c.rotate(current.angle);line(c,[[-38,-5],[-8,-5]],PAPER,4);line(c,[[-29,8],[-4,8]],'#c9dedb',2);
    line(c,[[-9,20],[20,-20]],PAPER,5);star(c,13,-12,6,'#f3d392',0);
  } else if(event.type==='bounce') {
    const previous=sample(points,Math.max(0,progress-.055));
    const lift=Math.sin(current.local*Math.PI)*28;
    line(c,[[previous.x,previous.y-Math.sin(previous.local*Math.PI)*28],[current.x,current.y-lift]],event.effect==='yarn'?'#c9a8de':'#f1bf76',4);
    c.translate(current.x,current.y-lift);
    if(event.effect!=='yarn')polygon(c,[[-8,7],[-25,-8],[-10,-4],[-18,-25],[8,-8],[12,9]],'#f5cf82','',0);
    ball(c,event.effect==='yarn',event.age*9);
    if(event.effect==='yarn')line(c,[[-20,-12],[-14,-7],[-20,0],[-13,7]],'#fff7dc',2);
  } else if(event.type==='sprinkler') {
    c.translate(current.x,current.y);c.rotate(current.angle);sprinkler(c,event.age);
  } else if(event.type==='giant_cat') {
    const destination=pixel(points[points.length-1]);c.translate(destination.x,destination.y);giantCat(c,progress);
  } else {
    const destination=pixel(points[points.length-1]);c.translate(destination.x,destination.y);weapon(c,event.effect||'',progress);
  }
  c.restore();return true;
}

export function drawSealed(c:C,seconds:number):void {
  c.save();c.globalAlpha*=.98;
  round(c,-29,-25,58,51,4,'#d9b78a',PAPER,7);round(c,-29,-25,58,51,4,'#d9b78a',INK,2.4);
  for(let x=-25;x<29;x+=5)line(c,[[x,-23],[x,24]],'#bc9368',.8);
  polygon(c,[[-29,-25],[-11,-34],[0,-24],[-21,-15]],'#ead0a5',INK,1.7);polygon(c,[[29,-25],[11,-34],[0,-24],[22,-15]],'#ecd5ae',INK,1.7);
  c.save();c.translate(0,-22);c.rotate(Math.sin(seconds*8)*.08);
  round(c,-5,-5,10,48,1,'#efd594','#b58c5b',1.2);polygon(c,[[5,9],[14,16],[9,27],[4,21]],'#efd594','#b58c5b',1);c.restore();
  round(c,-23,2,15,12,1,'#f9edcf',INK,1);line(c,[[-21,5],[-11,5]],'#a88b68',1);line(c,[[-21,9],[-15,9]],'#a88b68',1);
  const bob=Math.sin(seconds*7)*3;
  ellipse(c,26,-34+bob,12,14,'#f4ce69',PAPER,3);
  c.font='900 24px "Trebuchet MS", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#8b4e37';c.fillText('!',26,-33+bob);
  c.restore();
}

export function drawWet(c:C,seconds:number):void {
  c.save();c.translate(0,-49+Math.sin(seconds*2)*1.4);
  ellipse(c,-15,1,10,8,'#8197aa',PAPER,3);ellipse(c,0,-4,14,10,'#8197aa',PAPER,3);ellipse(c,15,1,10,8,'#8197aa',PAPER,3);
  round(c,-22,0,44,9,4,'#8197aa','#8197aa',0);
  for(let i=0;i<4;i++){const y=10+(seconds*25+i*9)%23,x=-18+i*12;line(c,[[x,y],[x-2,y+5]],'#6baacb',2.3);}
  c.restore();ellipse(c,0,28,26,4,'rgba(114,174,193,.24)','',0);
}

export function drawWasher(c:C,seconds:number,remaining:number):void {
  c.save();round(c,-32,-37,64,70,9,'#d4e7e6',PAPER,6);round(c,-32,-37,64,70,9,'rgba(255,255,255,0)',INK,2);
  line(c,[[-22,-27],[-6,-27]],'#86b7b4',3);ellipse(c,21,-27,3,3,'#e7c56c',INK,1);
  ellipse(c,0,0,23,23,'#a5d0d4',INK,2.4);
  c.save();c.rotate(seconds*8);for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);ellipse(c,7,1,12,5,'#e6f4ed','',0);}c.restore();
  c.beginPath();c.arc(0,0,27,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(remaining/3));c.strokeStyle='#72a59b';c.lineWidth=3;c.stroke();c.restore();
}

export function drawGlueTrap(c:C,charges:number):void {
  round(c,-25,-17,50,34,5,'#e4bd80',INK,2);round(c,-21,-13,42,26,4,'#e9d49f','#c4a66c',1);
  for(let i=0;i<3;i++)line(c,[[-16+i*15,-9],[-20+i*15,7]],'#f7e7be',3);
  for(let i=0;i<Math.max(0,Math.min(3,charges));i++)ellipse(c,-9+i*9,19,2.5,2.5,'#916c49',PAPER,1);
}

export function drawPropCursor(c:C,id:string,seconds:number):void {
  c.save();c.rotate(Math.sin(seconds*5)*.06);
  if(id==='washer'){c.scale(.65,.65);drawWasher(c,seconds,3);}
  else if(id==='glue_trap')drawGlueTrap(c,3);
  else if(id==='milk_bottle'){round(c,-11,-15,22,34,6,'#f8e7bf',INK,2);round(c,-7,-23,14,10,4,'#dda6a3',INK,2);star(c,0,2,6,'#e6bb64',1);}
  else if(id==='recycle_bin'){round(c,-17,-15,34,36,5,'#a7c1ac',INK,2);line(c,[[-22,-18],[22,-18]],INK,4);line(c,[[-6,-25],[6,-25]],INK,4);star(c,0,3,8,PAPER,1);}
  else if(id==='whistle'){round(c,-18,-8,31,20,7,'#ebc779',INK,2);round(c,7,-10,17,9,2,'#ebc779',INK,2);ellipse(c,-5,1,5,5,'#8e7859',INK,1);}
  else {ellipse(c,0,0,21,18,'#c9abd8',PAPER,3);star(c,0,0,11,'#f9e4a4',1.2);}
  c.restore();
}
