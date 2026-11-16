import type {Unit,VisualEvent} from '../core/types';
import {STAGE} from '../config/maps';
import {COMBAT_STYLES} from '../config/combat';
import {assets} from './AssetRegistry';
import {fitSprite} from './HeldWeaponRenderer';
import {drawEnemyArt,ellipse,INK,line,PAPER,polygon,round,star} from './StickerArt';

const pixel=(col:number,row:number)=>({x:STAGE.boardX+(col+.5)*STAGE.cell,y:STAGE.boardY+(row+.5)*STAGE.cell});
/** Captured geometry/effect keeps attacks visible after the firing unit disappears. */
export function drawCombatEvent(c:CanvasRenderingContext2D,event:VisualEvent,units:Unit[]):boolean{
 if(!['slash','projectile','hit','death','food'].includes(event.type))return false;
 const p=Math.max(0,Math.min(1,event.age/Math.max(.001,event.duration))),from=pixel(event.col,event.row),target=pixel(event.targetCol??event.col,event.targetRow??event.row);
 const angle=Math.atan2(target.y-from.y,target.x-from.x),unit=units.find(u=>u.id===event.unitId),kind=event.effect||unit?.kind||'';
 c.save();
 if(event.type==='slash'){
  const style=event.effect||COMBAT_STYLES[event.presentation?.sourceKind??'']||'cleave180',spin=style==='spin360',thrust=style==='thrust';
  // Legacy events without presentation remain safe and deterministic. Never consult
  // the live source, loadout or nearby damage to reconstruct a captured attack.
  const enhanced=event.presentation?.enhanced??false,hero=event.presentation?.hero??false;
  const size=spin?(hero?185:145):thrust?120:style==='heavy_cleave'?136:112;
  const id=spin?'vfx_slash_spin':thrust?'vfx_thrust_cone':style==='heavy_cleave'?'vfx_slash_heavy':style==='cross_slash'&&enhanced?'vfx_slash_cross':'vfx_slash_crescent';
  c.translate(from.x,from.y);
  if(!spin)c.translate(Math.cos(angle)*(thrust?65:28+p*30),Math.sin(angle)*(thrust?65:28+p*30));
  c.rotate(angle+(spin?p*160*Math.PI/180:0));c.globalAlpha*=Math.sin(Math.PI*Math.min(.99,p))*.9;
  const image=assets.get(id);
  if(image)fitSprite(c,image,size);
  else if(thrust){polygon(c,[[-55,-20],[62,0],[-55,20],[-23,0]],'#fff5c9',INK,1.5);line(c,[[-55,0],[52,0]],'#e8c77d',4);}
  else{c.strokeStyle=style==='heavy_cleave'?'#f2b15b':'#fce8a8';c.lineWidth=spin?15:12;c.beginPath();c.arc(0,0,size*.41,spin?-.3:-Math.PI*.52,spin?Math.PI*1.8:Math.PI*.52);c.stroke();c.strokeStyle=PAPER;c.lineWidth=4;c.stroke();if(style==='cross_slash')line(c,[[-40,-40],[40,40]],PAPER,9);}
  if(spin&&enhanced){const heavy=assets.get('vfx_slash_heavy');if(heavy){c.globalAlpha*=.48;fitSprite(c,heavy,size);}}
 }else if(event.type==='projectile'){
  // Defensive handling for legacy saves: a melee source never emits a generic dot.
  if(['spin360','cleave180','cross_slash','thrust'].includes(COMBAT_STYLES[kind]??'')){c.restore();return true;}
  const mortar=kind==='rocket_coon',lift=Math.sin(p*Math.PI)*(mortar?65:13),x=from.x+(target.x-from.x)*p,y=from.y+(target.y-from.y)*p-lift;
  const color=event.color||(kind==='purrcerer'?'#bfa6e5':kind==='pepe_king'?'#a3c981':'#e8c374');
  // Tapered, segmented trail follows the projectile arc rather than a fixed horizontal dash.
  for(let i=4;i>0;i--){const q=Math.max(0,p-i*.035),r=Math.max(0,p-(i-1)*.035);c.globalAlpha=.15+(4-i)*.13;line(c,[[from.x+(target.x-from.x)*q,from.y+(target.y-from.y)*q-Math.sin(q*Math.PI)*(mortar?65:13)],[from.x+(target.x-from.x)*r,from.y+(target.y-from.y)*r-Math.sin(r*Math.PI)*(mortar?65:13)]],color,Math.max(1,8-i*1.5));}
  c.globalAlpha=1;c.translate(x,y);c.rotate(angle);drawProjectile(c,kind,p,event.color);
 }else if(event.type==='food'){
  c.translate(from.x,from.y-16-p*45);c.globalAlpha*=Math.min(1,(1-p)*4);
  // Tiny dried fish icon remains legible even when no optional art decodes.
  ellipse(c,-14,0,8,4,'#e4b86b',INK,1);polygon(c,[[-21,0],[-27,-5],[-27,5]],'#d6a45e',INK,1);ellipse(c,-9,-1,1,1,INK,INK,0);
  c.font='900 22px "Trebuchet MS",sans-serif';c.textAlign='left';c.strokeStyle=PAPER;c.lineWidth=4;c.strokeText(`+${event.value??1}`,0,1);c.fillStyle='#aa762e';c.fillText(`+${event.value??1}`,0,1);
 }else{
  c.translate(from.x,from.y);c.globalAlpha*=1-p;
  if(event.type==='death'&&event.enemyKind&&p<.75){
   c.save();c.translate((event.id%2?1:-1)*p*24,-Math.sin(p*Math.PI)*(event.boss?46:32));
   c.rotate(p*4.2);const shrink=1-p*.55;c.scale(shrink,shrink);
   const body=assets.get(event.enemyKind);
   if(body)fitSprite(c,body,event.boss?126:98);
   else{c.scale(event.boss?1.6:1.24,event.boss?1.6:1.24);drawEnemyArt(c,event.enemyKind,0);}
   c.restore();
  }
  const death=event.type==='death',id=death?'vfx_dust_puff':'vfx_hit_burst',art=assets.get(id);c.rotate(death?p*.4:event.id*.7);
  if(art)fitSprite(c,art,death?55+p*46:46+p*20);
  else if(death){for(let i=0;i<6;i++){const a=i*Math.PI/3;ellipse(c,Math.cos(a)*p*30,Math.sin(a)*p*23,13+p*9,10+p*8,'#e7dcc3',PAPER,2);}}
  else{star(c,0,0,24*(1-p)+7,'#ffdc80',2);line(c,[[-22,0],[22,0]],PAPER,4);line(c,[[0,-22],[0,22]],PAPER,4);}
  if(death)for(let i=0;i<5;i++){
   const a=i*Math.PI*2/5+event.id*.7,r=18+p*(event.boss?77:54);
   star(c,Math.cos(a)*r,Math.sin(a)*r-p*12,3+(1-p)*4,'#ffdf76',.8);
  }
 }
 c.restore();return true;
}
function drawProjectile(c:CanvasRenderingContext2D,kind:string,p:number,color?:string){
 c.save();
 if(kind==='ballin_rooster'){
  polygon(c,[[-12,-9],[-27,-5],[-18,1],[-29,6],[-10,10]],'#efb45b','',0);c.rotate(p*10);ellipse(c,0,0,15,15,'#eda267',PAPER,3);ellipse(c,0,0,15,15,'#eda267',INK,1.8);line(c,[[-13,0],[13,0]],INK,2);line(c,[[0,-13],[0,13]],INK,2);
 }else if(kind==='squirrel'){
  c.rotate(p*13);ellipse(c,0,1,11,14,'#b99061',PAPER,3);round(c,-13,-10,26,8,3,'#8d7554',INK,1.5);line(c,[[-6,-1],[6,9]],'#e1c293',2);
 }else if(kind==='bamboo_mafia'){
  polygon(c,[[-12,-6],[-31,0],[-12,6]],'#f1b870',INK,1);c.rotate(Math.sin(p*14)*.15);round(c,-15,-8,28,16,5,'#a7b67c',PAPER,3);round(c,-15,-8,28,16,5,'#a7b67c',INK,1.5);polygon(c,[[12,-8],[22,0],[12,8]],'#c7d7a0',INK,1.5);
 }else if(kind==='zen_master'){
  c.rotate(p*Math.PI*4);ellipse(c,0,0,15,15,PAPER,INK,1.8);c.beginPath();c.arc(0,0,14,-Math.PI/2,Math.PI/2);c.arc(0,7,7,Math.PI/2,Math.PI*1.5,true);c.arc(0,-7,7,Math.PI/2,-Math.PI/2);c.fillStyle=INK;c.fill();ellipse(c,0,-7,2.7,2.7,PAPER,'',0);ellipse(c,0,7,2.7,2.7,INK,'',0);
 }else if(kind==='meowfia'){
  line(c,[[-14,0],[14,0]],PAPER,6);for(const x of [-7,1,9])line(c,[[x-3,-7],[x+2,0],[x-3,7]],'#e9dfbc',3);polygon(c,[[-13,0],[-21,-7],[-21,7]],'#b9cfaa',INK,1);
 }else if(kind==='doge_wick'){
  line(c,[[-16,0],[15,0]],'#f9d479',9);line(c,[[-12,0],[17,0]],PAPER,3);star(c,17,0,6,'#fff7cb',0);
 }else if(kind==='rocket_coon'){
  c.rotate(p*11);ellipse(c,0,0,16,13,'#a1b29a',PAPER,3);round(c,-8,-10,16,19,3,'#b9aa86',INK,2);star(c,0,0,5,'#ffe1a0',1);
 }else if(kind==='purrcerer'){
  c.rotate(p*9);ellipse(c,0,0,12,12,'#c2a9d6',PAPER,2);for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);line(c,[[-19,-3],[-10,-10],[-11,0],[-3,-6]],'#d9eef9',3);}star(c,0,0,8,'#fff1a9',0);
 }else if(kind==='pepe_king'){
  for(let i=0;i<3;i++)ellipse(c,-i*7,0,10+i*3,13+i*3,'rgba(0,0,0,0)',i===1?PAPER:'#a7bf82',2.5);star(c,8,0,7,'#dbe8ae',0);
 }else{c.rotate(p*8);star(c,0,0,12,color||'#e5bd73',1.5);}
 c.restore();
}
