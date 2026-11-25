import {GUARDIAN_BATH_SPOTS,WIDE_GUARDIAN_BATH_SPOTS,GUARDIAN_WATERLINE,WATER_CLIP_GROW,type GuardianBathSpot} from '../config/guardianBaths';
import {BROTHS,CLEAR_SPRING,isBrothId,type BrothTopping} from '../config/kitchen';
import {isMobileWideStage} from '../config/maps';
import type {MapId} from '../core/types';

/**
 * P15 five-layer guardian bath. Layer 1 (the map with the tub's back half) is painted by the caller;
 * this module adds 2) the clipped living soup, 3) the waterline-clipped soaking capybara, 4) the original
 * front tub rim copied from the map and 5) steam. Everything animates from scene seconds only, so a paused
 * battle (whose scene clock stands still) freezes the bath on the exact same frame.
 */
type C=CanvasRenderingContext2D;
const TAU=Math.PI*2,INK='#3a2618';
export interface BathPainter {
  c:C;
  image(id:string):HTMLImageElement|undefined;
  /** Draws an image centred on the current origin, letterboxed into width × height. */
  drawImage(image:HTMLImageElement,width:number,height:number,x?:number,y?:number):void;
  orange(x:number,y:number,size:number,rotation:number):void;
  /** Tub-free vector capybara used when no soak PNG is decoded (100-unit art space). */
  vectorCapybara(dizzy:boolean):void;
}
/** P17 Capybara Bubble Shield: a ready charge, recharge progress (0..1) and the age of the latest pop. */
export interface BathShield {ready:boolean;progress:number;popAge?:number}
export interface GuardianBathInput {mapId:MapId;oranges:number;seconds:number;activeBrothId?:string|null;brothLevel?:number;happyUntil?:number;shield?:BathShield}

// ── Animation schedule ────────────────────────────────────────────────────────────────────────────────
export const CALM_SCHEDULE=[['capybara_soak',3.2],['capybara_soak_2',1.4],['capybara_soak',2.4],['capybara_soak_3',1.3]] as const;
export const CALM_CYCLE=CALM_SCHEDULE.reduce((sum,[,d])=>sum+d,0);
export const HAPPY_DURATION=2.2,DIZZY_FRAME_SECONDS=.22;
export type GuardianFrameId='capybara_soak'|'capybara_soak_2'|'capybara_soak_3'|'capybara_soak_4'|'capybara_soak_dizzy'|'capybara_soak_dizzy_2';
/** Calm 4-beat loop, a 2.2s happy beat after a cleared wave or legendary merge, rapid dizzy pair at 0 oranges. */
export function guardianFrame(seconds:number,dizzy:boolean,happyUntil=Number.NEGATIVE_INFINITY):GuardianFrameId {
  const t=Number.isFinite(seconds)?seconds:0;
  if(dizzy)return Math.floor(t/DIZZY_FRAME_SECONDS)%2?'capybara_soak_dizzy_2':'capybara_soak_dizzy';
  if(t<happyUntil)return 'capybara_soak_4';
  let left=((t%CALM_CYCLE)+CALM_CYCLE)%CALM_CYCLE;
  for(const [id,duration] of CALM_SCHEDULE){if(left<duration)return id;left-=duration;}
  return 'capybara_soak';
}
export interface GuardianPose {bobY:number;scaleX:number;scaleY:number;tilt:number;swayX:number}
/** Floating breath: gentle bob, out-of-phase squash and a slow tilt (a quicker wobble while dizzy). */
export function guardianPose(seconds:number,dizzy:boolean):GuardianPose {
  const t=Number.isFinite(seconds)?seconds:0,breath=Math.sin(t*1.8+.6);
  return{bobY:Math.sin(t*1.8)*2,scaleX:1+breath*.028,scaleY:1-breath*.025,
    tilt:dizzy?Math.sin(t*5.2)*.05:Math.sin(t*.9)*.025,swayX:dizzy?Math.sin(t*6)*1.2:0};
}

// ── Soup palettes ─────────────────────────────────────────────────────────────────────────────────────
export interface SoupPalette {center:string;main:string;edge:string;foam:string;steam:string;bubbles:number;topping?:BrothTopping;tier:number;level:number}
export function soupPalette(activeBrothId?:string|null,level=1):SoupPalette {
  if(isBrothId(activeBrothId)){
    const b=BROTHS[activeBrothId];
    return{center:b.bathCenter,main:b.bathColor,edge:b.bathEdge,foam:b.foamColor,steam:b.steamColor,bubbles:b.bubbles,topping:b.topping,tier:b.tier,level:Math.max(1,Math.min(3,Math.trunc(level)||1))};
  }
  return{center:CLEAR_SPRING.bathCenter,main:CLEAR_SPRING.bathColor,edge:CLEAR_SPRING.bathEdge,foam:CLEAR_SPRING.foamColor,steam:CLEAR_SPRING.steamColor,bubbles:CLEAR_SPRING.bubbles,tier:0,level:0};
}
/** `#RRGGBB` to translucent canvas paint. */
export function rgba(hex:string,alpha:number):string {
  const value=Number.parseInt(hex.slice(1,7),16),a=Math.max(0,Math.min(1,alpha));
  return `rgba(${value>>16&255},${value>>8&255},${value&255},${Math.round(a*1000)/1000})`;
}
function lighten(hex:string,amount:number):string {
  const v=Number.parseInt(hex.slice(1,7),16),ch=(s:number)=>Math.round(((v>>s)&255)+(255-((v>>s)&255))*amount);
  return `#${[16,8,0].map(s=>ch(s).toString(16).padStart(2,'0')).join('')}`;
}
/** Mock-safe gradient: falls back to a flat colour when a context cannot create gradients. */
function radialFill(c:C,x:number,y:number,r0:number,r1:number,stops:[number,string][],fallback:string):string|CanvasGradient {
  const g=typeof c.createRadialGradient==='function'?c.createRadialGradient(x,y,r0,x,y,r1):undefined;
  if(!g||typeof g.addColorStop!=='function')return fallback;
  for(const [offset,color] of stops)g.addColorStop(offset,color);return g;
}
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};

// ── Geometry ──────────────────────────────────────────────────────────────────────────────────────────
export function waterlineY(spot:GuardianBathSpot,x:number):number {
  const L=spot.size*1.5,t=Math.max(0,Math.min(1,(x+L)/(2*L)));
  return spot.size*GUARDIAN_WATERLINE.side+4*spot.size*GUARDIAN_WATERLINE.bulge*t*(1-t);
}
const chestHalf=(spot:GuardianBathSpot)=>spot.size*.32;
function waterPath(c:C,spot:GuardianBathSpot,grow=WATER_CLIP_GROW):void {
  const w=spot.water;c.beginPath();c.ellipse(w.x,w.y,w.rx+grow,w.ry+grow,0,0,TAU);
}

// ── Layer 2 · living soup ─────────────────────────────────────────────────────────────────────────────
function drawSoup(c:C,spot:GuardianBathSpot,pal:SoupPalette,seconds:number,pose:GuardianPose,p:BathPainter):void {
  const w=spot.water,rx=w.rx+WATER_CLIP_GROW,ry=w.ry+WATER_CLIP_GROW,R=Math.max(rx,ry),half=chestHalf(spot),wl=waterlineY(spot,0);
  c.save();waterPath(c,spot);c.clip();
  // Rich liquid body: bright centre, main colour, darker wall shade.
  c.fillStyle=radialFill(c,w.x-rx*.16,w.y-ry*.2,1,R*1.12,[[0,pal.center],[.5,pal.main],[.84,pal.main],[1,pal.edge]],pal.main);
  c.fillRect(w.x-rx,w.y-ry,rx*2,ry*2);
  // Slowly turning light currents.
  for(let i=0;i<3;i++){
    const a=seconds*.45+i*2.1;c.beginPath();c.ellipse(w.x,w.y,rx*(.44+i*.17),ry*(.38+i*.16),0,a,a+.85+i*.3);
    c.strokeStyle=rgba(lighten(pal.center,.55),.42-i*.09);c.lineWidth=2.2-i*.4;c.stroke();
  }
  // Contact shadow where the chest meets the liquid, breathing with the capybara.
  const breath=Math.sin(seconds*1.8+.6);
  c.beginPath();c.ellipse(0,wl+spot.size*.035+pose.bobY*.4,half*1.1*(1+breath*.03),spot.size*.07*(1+breath*.06),0,0,TAU);
  c.fillStyle=rgba(pal.edge,.34);c.fill();
  drawToppings(c,spot,pal,seconds,p);
  drawBubbles(c,spot,pal,seconds);
  // Two soft rings spreading from the chest as it sinks and rises.
  for(let i=0;i<2;i++){
    const ph=(seconds*.42+i*.5)%1;c.beginPath();c.ellipse(0,wl+1,half*(1.08+ph*.95),spot.size*(.05+ph*.09),0,0,TAU);
    c.strokeStyle=rgba(pal.foam,(1-ph)*.55);c.lineWidth=1.5;c.stroke();
  }
  c.restore();
}
function bubbleCount(pal:SoupPalette):number {return 5+Math.round(Math.max(0,Math.min(2,(pal.bubbles-.6)*1.6)));}
function drawBubbles(c:C,spot:GuardianBathSpot,pal:SoupPalette,seconds:number):void {
  const w=spot.water,half=chestHalf(spot),wl=waterlineY(spot,0),n=bubbleCount(pal);
  for(let i=0;i<n;i++){
    const period=(2.3+hash(i+1)*1.5)/Math.max(.35,pal.bubbles),p=seconds/period+hash(i+9),cycle=Math.floor(p),f=p-cycle,key=i*31+cycle*7;
    const a=hash(key)*TAU,r=.42+hash(key+3)*.42;let x=w.x+Math.cos(a)*w.rx*r,y=w.y+Math.sin(a)*w.ry*r;
    // Keep bubbles beside or in front of the chest so they stay visible around the capybara.
    if(Math.abs(x)<half*1.05&&y<wl+3)y=Math.min(w.y+w.ry*.8,wl+spot.size*.08+hash(key+5)*w.ry*.3);
    const size=Math.max(1.8,Math.min(4.8,spot.size*.036*(.75+hash(key+4)*.6)));
    if(f<.78){
      const s=size*Math.pow(f/.78,.55);if(s<.4)continue;
      c.beginPath();c.arc(x,y,s,0,TAU);c.fillStyle=rgba(pal.foam,.58);c.fill();c.strokeStyle=rgba(pal.edge,.5);c.lineWidth=1;c.stroke();
      c.beginPath();c.arc(x-s*.35,y-s*.35,s*.28,0,TAU);c.fillStyle='rgba(255,255,255,.85)';c.fill();
    }else{
      const k=(f-.78)/.22;c.beginPath();c.arc(x,y,size*(1+k*1.25),0,TAU);c.strokeStyle=rgba(pal.foam,(1-k)*.8);c.lineWidth=1.2;c.stroke();
    }
  }
}
function leaf(c:C,x:number,y:number,len:number,rot:number,fill='#6FA94F'):void {
  c.save();c.translate(x,y);c.rotate(rot);c.beginPath();c.moveTo(-len,0);c.quadraticCurveTo(0,-len*.62,len,0);c.quadraticCurveTo(0,len*.62,-len,0);c.closePath();
  c.fillStyle=fill;c.fill();c.strokeStyle=INK;c.lineWidth=1;c.stroke();c.beginPath();c.moveTo(-len*.7,0);c.lineTo(len*.7,0);c.strokeStyle='rgba(40,70,30,.6)';c.lineWidth=.7;c.stroke();c.restore();
}
function dot(c:C,x:number,y:number,r:number,fill:string,outline=true):void {
  c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=fill;c.fill();if(outline){c.strokeStyle=INK;c.lineWidth=.9;c.stroke();}
}
/** One floating garnish; `r` is its radius in stage pixels. */
function topping(c:C,kind:BrothTopping,index:number,r:number,p:BathPainter):void {
  const sprite=(id:string)=>{const img=p.image(id);if(img){p.drawImage(img,r*2.5,r*2.5);return true;}return false;};
  switch(kind){
    case 'yuzu':
      if(!sprite('broth_topping_yuzu')){dot(c,0,0,r,'#F6C84C');dot(c,0,0,r*.72,'#FFE58A',false);for(let k=0;k<6;k++){c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(k*1.05)*r*.7,Math.sin(k*1.05)*r*.7);c.strokeStyle='#FFF6D6';c.lineWidth=.8;c.stroke();}}
      break;
    case 'sakura':
      if(!sprite('broth_topping_sakura')){c.beginPath();c.moveTo(0,r);c.bezierCurveTo(-r,r*.4,-r,-r*.5,-r*.35,-r);c.lineTo(0,-r*.6);c.lineTo(r*.35,-r);c.bezierCurveTo(r,-r*.5,r,r*.4,0,r);c.closePath();c.fillStyle='#FFE0E6';c.fill();c.strokeStyle='#4A322B';c.lineWidth=1;c.stroke();}
      break;
    case 'imperial':
      if(!sprite(index%2?'broth_topping_sakura':'broth_topping_yuzu'))dot(c,0,0,r*.8,index%2?'#FFE0E6':'#F6C84C');
      dot(c,r*.9,r*.6,r*.22,'#D1453A');break;
    case 'chili':
      c.beginPath();c.arc(0,0,r*.9,.35,2.6);c.arc(-r*.15,-r*.25,r*.55,2.6,.35,true);c.closePath();c.fillStyle='#D9362B';c.fill();c.strokeStyle=INK;c.lineWidth=1;c.stroke();
      c.beginPath();c.moveTo(r*.75,r*.25);c.lineTo(r*1.05,-r*.05);c.strokeStyle='#4E8A3A';c.lineWidth=1.6;c.stroke();
      for(const [x,y,s] of [[-r*1.4,-r*.9,.32],[r*1.5,-r*.5,.26],[-r*.4,r*1.3,.22]] as const){c.beginPath();c.ellipse(x,y,r*s,r*s*.7,0,0,TAU);c.fillStyle='rgba(255,196,74,.85)';c.fill();}
      break;
    case 'scallion':
      for(const [x,y] of [[0,0],[r*.9,r*.5]] as const){c.beginPath();c.arc(x,y,r*.5,0,TAU);c.fillStyle='#E1F2BE';c.fill();c.strokeStyle='#6E9F3E';c.lineWidth=1.4;c.stroke();}
      break;
    case 'osmanthus':
      for(let k=0;k<4;k++){c.beginPath();c.ellipse(Math.cos(k*Math.PI/2)*r*.35,Math.sin(k*Math.PI/2)*r*.35,r*.32,r*.22,k*Math.PI/2,0,TAU);c.fillStyle='#F7B733';c.fill();}
      dot(c,0,0,r*.18,'#E08A1A',false);break;
    case 'ginger':
      c.beginPath();c.ellipse(0,0,r*.8,r*.62,.3,0,TAU);c.fillStyle='#F3DD9A';c.fill();c.strokeStyle=INK;c.lineWidth=1;c.stroke();
      c.beginPath();c.ellipse(0,0,r*.45,r*.32,.3,0,TAU);c.strokeStyle='rgba(196,150,70,.7)';c.lineWidth=.8;c.stroke();
      if(index%2===0){c.save();c.rotate(.9);c.fillStyle='#9A5C2E';c.fillRect(-r*1.3,r*.8,r*1.6,r*.4);c.restore();}
      break;
    case 'matcha':
      for(const [x,y,s] of [[0,0,.6],[r*.6,r*.3,.42],[-r*.5,r*.35,.36]] as const)dot(c,x,y,r*s,'rgba(230,245,216,.88)',false);
      if(index%2)leaf(c,r*.3,-r*.5,r*.55,.6,'#5E9A43');
      break;
    case 'herbal':
      dot(c,-r*.4,0,r*.32,'#D1453A');dot(c,r*.35,r*.35,r*.28,'#D1453A');leaf(c,r*.2,-r*.45,r*.6,-.5,'#5F9A4C');break;
    case 'truffle':
      dot(c,0,0,r*.45,'#5A3B26');dot(c,r*.7,r*.4,r*.3,'#6E4A32');c.beginPath();c.arc(-r*.6,r*.5,r*.32,0,TAU);c.strokeStyle='#6E9F3E';c.lineWidth=1.2;c.stroke();break;
    case 'melon':
      dot(c,0,0,r*.55,'#EFFFF9');dot(c,r*.75,r*.35,r*.4,'#E1FBF2');leaf(c,-r*.6,-r*.4,r*.55,.4,'#4E9C6A');break;
    case 'feast':
      if(index%2){c.beginPath();c.arc(0,0,r*.75,.4,3.6);c.lineWidth=r*.42;c.strokeStyle='#F08A5A';c.stroke();}
      else for(const [x,y] of [[-r*.35,0],[r*.35,0],[0,r*.4]] as const){c.fillStyle='#F6D34A';c.fillRect(x-r*.22,y-r*.22,r*.44,r*.44);}
      break;
    case 'starlight':
      if(index%2){if(!sprite('broth_topping_sakura'))dot(c,0,0,r*.75,'#FFE0E6');}
      else{c.beginPath();for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,rad=k%2?r*.46:r*.95;c[k?'lineTo':'moveTo'](Math.cos(a)*rad,Math.sin(a)*rad);}c.closePath();c.fillStyle='#FFE87C';c.fill();c.strokeStyle='#8E621C';c.lineWidth=.9;c.stroke();}
      dot(c,r*.85,-r*.55,r*.2,'#FFF9D2',false);break;
    case 'orchard':
      if(index%2){if(!sprite('broth_topping_yuzu'))dot(c,0,0,r*.85,'#F6C84C');}
      else{c.beginPath();c.ellipse(0,0,r*.9,r*.52,-.3,0,TAU);c.fillStyle='#FF9F7A';c.fill();c.strokeStyle=INK;c.lineWidth=.9;c.stroke();}
      dot(c,-r*.75,r*.55,r*.24,'#D1453A');leaf(c,r*.6,-r*.55,r*.5,-.5,'#5E9A43');break;
  }
}
function drawToppings(c:C,spot:GuardianBathSpot,pal:SoupPalette,seconds:number,p:BathPainter):void {
  if(!pal.topping)return;
  const w=spot.water,count=pal.topping==='imperial'||pal.topping==='starlight'||pal.topping==='orchard'?4:3,r=Math.max(5,spot.size*.105);
  for(let i=0;i<count;i++){
    // Sway back and forth along the front half of the tub, so garnish never floats up beside the face.
    const dir=i%2?1:-1,swing=.5+.5*Math.sin(seconds*(.13+i*.035)+i*2.4),a=-.2+(Math.PI+.4)*((i+swing)/count);
    const x=w.x+Math.cos(a)*w.rx*.7,y=w.y+Math.max(-.15,Math.sin(a))*w.ry*.62+Math.sin(seconds*1.3+i)*.8;
    c.save();c.translate(x,y);c.rotate(seconds*.32*dir+i*1.7);topping(c,pal.topping,i,r,p);c.restore();
  }
}

// ── Layer 3 · soaking capybara ────────────────────────────────────────────────────────────────────────
function drawCapybara(c:C,spot:GuardianBathSpot,input:GuardianBathInput,pose:GuardianPose,p:BathPainter):void {
  const size=spot.size,dizzy=input.oranges<=0,wl=waterlineY(spot,-size*1.5);
  const id=guardianFrame(input.seconds,dizzy,input.happyUntil);
  // Legacy headless consumers may still supply the pre-P10 tub image; browsers fall back to vector art.
  const image=p.image(id)??p.image(dizzy?'capybara_soak_dizzy':'capybara_soak')??(typeof Image==='undefined'?p.image('capybara'):undefined);
  c.save();
  // Only the part above the liquid is drawn: the chest sinks below the waterline arc.
  c.beginPath();c.moveTo(-size*1.5,-size*2.5);c.lineTo(size*1.5,-size*2.5);c.lineTo(size*1.5,wl);
  c.quadraticCurveTo(0,wl+2*size*GUARDIAN_WATERLINE.bulge,-size*1.5,wl);c.closePath();c.clip();
  c.translate(pose.swayX,pose.bobY+wl);c.rotate(pose.tilt);c.scale(pose.scaleX,pose.scaleY);c.translate(0,-wl);
  if(image)p.drawImage(image,size,size);
  else{c.scale(size/100,size/100);p.vectorCapybara(dizzy);}
  c.restore();
}
/** Foam collar and bright waterline where the chest meets the soup (clipped to the tub water). */
function drawFoamCollar(c:C,spot:GuardianBathSpot,pal:SoupPalette,seconds:number,pose:GuardianPose):void {
  const half=chestHalf(spot)*pose.scaleX+1.5,n=10,step=half*2.1/(n-1),ry=spot.size*.032;
  c.save();waterPath(c,spot);c.clip();
  // Soft shade first, then an overlapping froth band that breathes along the waterline.
  c.beginPath();c.ellipse(0,waterlineY(spot,0)+ry*1.2,half*1.14,ry*1.6,0,0,TAU);c.fillStyle=rgba(pal.edge,.2);c.fill();
  for(let k=0;k<n;k++){
    const x=-half*1.05+k*step+Math.sin(seconds*1.3+k)*.5,y=waterlineY(spot,x)+.6+Math.sin(seconds*2.4+k*1.7)*.5,swell=1+.22*Math.sin(seconds*1.7+k*1.3);
    c.beginPath();c.ellipse(x,y,step*.78*swell,ry*swell,0,0,TAU);c.fillStyle=rgba(pal.foam,.62);c.fill();
  }
  for(let k=0;k<n;k+=2){const x=-half*.95+k*step,y=waterlineY(spot,x)-ry*.35;c.beginPath();c.arc(x,y,ry*.45,0,TAU);c.fillStyle='rgba(255,255,255,.8)';c.fill();}
  c.beginPath();for(let k=0;k<=24;k++){const x=-half*1.16+k*half*2.32/24,y=waterlineY(spot,x)+ry*1.15;k?c.lineTo(x,y):c.moveTo(x,y);}
  c.strokeStyle=rgba(lighten(pal.main,.65),.85);c.lineWidth=1.3;c.stroke();
  c.restore();
}
/** Head-top anchor under the pose transform, sampled with a lag so stacked oranges trail the head. */
function headAnchor(spot:GuardianBathSpot,pose:GuardianPose):{x:number;y:number} {
  const wl=waterlineY(spot,-spot.size*1.5),dy=(spot.orangeBaseY-wl)*pose.scaleY;
  return{x:pose.swayX-dy*Math.sin(pose.tilt),y:pose.bobY+wl+dy*Math.cos(pose.tilt)};
}
function drawOranges(spot:GuardianBathSpot,input:GuardianBathInput,p:BathPainter):void {
  const dizzy=input.oranges<=0,t=input.seconds;
  for(let i=0;i<Math.max(0,Math.floor(input.oranges));i++){
    const lagged=guardianPose(t-.12*(i+1),dizzy),anchor=headAnchor(spot,lagged);
    p.orange(anchor.x+Math.sin(t*1.5-i*.38)*(1.5+i*.8),anchor.y-i*15,10,Math.sin(t*1.2-i*.4)*.07*(i+1)+lagged.tilt*(1+i*.4));
  }
}

// ── Layer 5 · steam and warm motes ────────────────────────────────────────────────────────────────────
function drawSteam(c:C,spot:GuardianBathSpot,pal:SoupPalette,seconds:number):void {
  const w=spot.water,strands=pal.tier>=3||pal.level>=3?4:3;
  c.lineWidth=1.6;
  for(let i=0;i<strands;i++){
    const phase=(seconds*.18+i/strands)%1,x=w.x+[-.62,.6,-.24,.3][i]*w.rx,y=w.y-w.ry*.15-phase*24,sway=Math.sin(seconds*.8+i)*2;
    c.save();c.globalAlpha*=Math.sin(phase*Math.PI);c.strokeStyle=rgba(pal.steam,pal.tier?.62:.34);
    c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-6+sway,y-6,x+7+sway,y-12,x+sway*.5,y-19);c.stroke();c.restore();
  }
  if(pal.tier>=3||pal.level>=3)for(let i=0;i<3;i++){
    const phase=(seconds*.23+i*.33)%1,x=w.x+(hash(i+40)-.5)*w.rx*1.2+Math.sin(seconds+i)*3,y=w.y-phase*34;
    c.save();c.globalAlpha*=Math.sin(phase*Math.PI)*.8;c.beginPath();c.arc(x,y,1.6,0,TAU);c.fillStyle=rgba(lighten(pal.center,.4),1);c.fill();c.restore();
  }
}

/** Draws layers 2-5 for the player's guardian tub; the map (layer 1) must already be on the canvas. */
export function drawGuardianBath(p:BathPainter,input:GuardianBathInput):void {
  const c=p.c,spot=isMobileWideStage()?WIDE_GUARDIAN_BATH_SPOTS[input.mapId]:GUARDIAN_BATH_SPOTS[input.mapId],dizzy=input.oranges<=0;
  const pal=soupPalette(input.activeBrothId,input.brothLevel),pose=guardianPose(input.seconds,dizzy);
  c.save();c.translate(spot.x,spot.y);
  drawSoup(c,spot,pal,input.seconds,pose,p);
  drawCapybara(c,spot,input,pose,p);
  drawFoamCollar(c,spot,pal,input.seconds,pose);
  drawOranges(spot,input,p);
  c.restore();
  const rim=p.image(`tub_rim_${input.mapId}`);
  if(rim)c.drawImage(rim,spot.rim.dx,spot.rim.dy,spot.rim.dw,spot.rim.dh);
  c.save();c.translate(spot.x,spot.y);drawSteam(c,spot,pal,input.seconds);c.restore();
  if(input.shield)drawBathShield(c,spot,input,input.shield);
}

/**
 * P17 shield, drawn after the rim so it wraps the whole tub: a thin warm-gold rim light with a faint inner sheen
 * (the soak animation and soup stay fully visible). While recharging, a 32×4 bar sits just under the tub.
 */
export function shieldDome(spot:GuardianBathSpot,oranges:number):{x:number;y:number;rx:number;ry:number} {
  const top=-spot.size*.62-Math.max(0,Math.min(6,Math.floor(oranges)))*15,bottom=spot.water.y+spot.water.ry*.72;
  return{x:spot.water.x,y:(top+bottom)/2,rx:Math.max(spot.water.rx*1.08,spot.size*.66),ry:(bottom-top)/2};
}
function drawBathShield(c:C,spot:GuardianBathSpot,input:GuardianBathInput,shield:BathShield):void {
  const dome=shieldDome(spot,input.oranges);
  c.save();c.translate(spot.x,spot.y);
  if(shield.ready){
    const breath=1+Math.sin(input.seconds*1.6)*.012;
    c.beginPath();c.ellipse(dome.x,dome.y,dome.rx*breath,dome.ry*breath,0,0,Math.PI*2);
    c.fillStyle='rgba(255, 250, 225, 0.14)';c.fill();
    c.lineWidth=2.2;c.strokeStyle='rgba(255, 224, 128, 0.75)';c.stroke();
    // Soft sheen arc on the upper left; no glow, no bloom.
    c.beginPath();c.ellipse(dome.x,dome.y,dome.rx*.84*breath,dome.ry*.84*breath,0,Math.PI*1.08,Math.PI*1.42);
    c.lineWidth=3;c.strokeStyle='rgba(255, 250, 225, 0.55)';c.stroke();
  }else{
    // Cream track with a hairline cocoa edge so the 32×4 charge bar reads on wood, grass and soup alike.
    const width=32,height=4,x=dome.x-width/2,y=spot.rim.dy+spot.rim.dh-spot.y+3;
    c.beginPath();c.roundRect(x-1,y-1,width+2,height+2,3);c.fillStyle='rgba(255, 248, 230, 0.92)';c.fill();c.lineWidth=1;c.strokeStyle='rgba(74, 50, 43, 0.75)';c.stroke();
    c.beginPath();c.roundRect(x,y,Math.max(2,width*Math.max(0,Math.min(1,shield.progress))),height,2);c.fillStyle='rgba(240, 176, 52, 1)';c.fill();
  }
  c.restore();
}
