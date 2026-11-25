import type {MapId} from '../core/types';
import {STAGE} from '../config/maps';
import type {AssetRegistry} from './AssetRegistry';
import {drawCapybaraArt,drawUnitArt,ellipse,star} from './StickerArt';

const guests=[
 ['panda',310,400,1.45],['corgi',390,490,1.25],['hamster',470,515,1.15],
 ['squirrel',160,470,1.15],['hedgehog',220,560,1.1],['bee',370,310,.85],
 ['cat',920,425,1.45],['shiba',1045,465,1.25],['goose',835,520,1.3],
 ['frog',970,555,1.15],['raccoon',1130,550,1.2],
] as const;

/** Menu-only illustration and atmosphere. No board geometry or battle state is read. */
export function drawSplashScene(c:CanvasRenderingContext2D,assets:AssetRegistry,mapId:MapId,seconds:number,oranges:number):void {
 const splash=assets.get('start_splash_bg');
 if(splash){
  const iw=splash.naturalWidth||splash.width||0,ih=splash.naturalHeight||splash.height||0;
  if(iw>0&&ih>0&&iw/ih>1.85){
   const sw=Math.round(STAGE.height*(iw/ih));
   c.drawImage(splash,(STAGE.width-sw)/2,0,sw,STAGE.height);
  }else c.drawImage(splash,0,0,STAGE.width,STAGE.height);
 }
 else drawFallback(c,seconds,oranges);
 c.save();
 // Five translucent curls, bounded to the spring above the capybara's shoulders.
 for(let i=0;i<5;i++){
  const rise=(seconds*.085+i*.197)%1,x=530+i*53+Math.sin(seconds*.7+i)*9,y=464-rise*122;
  c.globalAlpha=Math.sin(rise*Math.PI)*.24;c.strokeStyle='#fff9e9';c.lineWidth=5;
  c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-22,y-12,x+25,y-22,x+3,y-36);c.stroke();
 }
 // Analytic motion avoids accumulating particles while the menu is open.
 for(let i=0;i<14;i++){
  const x=44+(i*97+seconds*(2+i%3))%1192,y=170+(i*61+seconds*(3+i%4))%410;
  const pulse=.5+.5*Math.sin(seconds*1.1+i*2.4);
  c.save();c.translate(x,y);c.rotate(Math.sin(seconds*.45+i)*.7);
  c.globalAlpha=.22+pulse*.20;
  if(mapId==='sakura_onsen'){
   ellipse(c,0,0,3,6,i%2?'#fff0ec':'#ec9fac','transparent',0);
  }else if(mapId==='midnight_kitchen'){
   const glow=c.createRadialGradient(0,0,0,0,0,9);glow.addColorStop(0,'#ffcd61');glow.addColorStop(1,'rgba(255,205,97,0)');
   c.fillStyle=glow;c.fillRect(-9,-9,18,18);ellipse(c,0,0,1.8,1.8,'#ffdc88','transparent',0);
  }else if(mapId==='cat_tower_maze'){
   if(i%2)star(c,0,0,5,'#fff1c9',0);
   else {ellipse(c,0,2,3,2.5,'#fff4dc','transparent',0);for(let toe=0;toe<3;toe++)ellipse(c,-3+toe*3,-2-Math.sin(toe)*1.5,1.2,1.6,'#fff4dc','transparent',0);}
  }else{
   ellipse(c,0,0,2.5,2.5,'#f8ce69','transparent',0);
   if(i%3===0){ellipse(c,-2,-3,2,3,'#e2e8a0','transparent',0);ellipse(c,2,-3,2,3,'#e2e8a0','transparent',0);}
  }
  c.restore();
 }
 c.restore();
}

function drawFallback(c:CanvasRenderingContext2D,seconds:number,oranges:number):void {
 const sky=c.createLinearGradient(0,0,0,480);sky.addColorStop(0,'#ffe4ae');sky.addColorStop(1,'#fff8de');
 c.fillStyle=sky;c.fillRect(0,0,1280,720);
 ellipse(c,245,430,670,170,'#b7cc8a','transparent',0);
 ellipse(c,1110,465,780,190,'#a5bf7d','transparent',0);
 ellipse(c,640,640,880,170,'#d4d797','transparent',0);
 // Warm foreground deck, without a rectangular menu panel.
 c.beginPath();c.moveTo(430,587);c.lineTo(850,587);c.lineTo(1030,720);c.lineTo(250,720);c.closePath();c.fillStyle='#e5bc80';c.fill();
 c.strokeStyle='#c99b67';c.lineWidth=2;
 for(let i=0;i<7;i++){c.beginPath();c.moveTo(430+i*70,587);c.lineTo(250+i*130,720);c.stroke();}
 ellipse(c,640,492,208,94,'#a4a384','#f6ebd0',10);
 ellipse(c,640,478,188,75,'#9bd0c0','#e3efd4',8);
 ellipse(c,640,483,155,51,'#b4dfcc','transparent',0);
 for(const [kind,x,y,scale] of guests){c.save();c.translate(x,y);c.scale(scale,scale);drawUnitArt(c,kind,seconds);c.restore();}
 c.save();c.translate(640,421);c.scale(1.9,1.9);drawCapybaraArt(c,seconds,Math.max(0,Math.floor(oranges)));c.restore();
}
