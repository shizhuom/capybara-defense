import type {BattleLoadout,Unit} from '../core/types';
import {COMBAT_STYLES,DEFAULT_HELD_WEAPONS,WEAPON_RARITY_SCALES} from '../config/combat';
import {HEROES} from '../config/heroes';
import {WEAPONS} from '../config/weapons';
import {assets} from './AssetRegistry';
import {ellipse,INK,line,PAPER,polygon,round,star} from './StickerArt';

const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smoothstep=(t:number)=>t*t*(3-2*t);
/** attackAnim counts down through the existing .32s attack, shared by body and mount. */
function attackMotion(active:number):number {
 if(active<=0)return 0;
 const t=1-active;
 if(t<.25)return -.28*smoothstep(t/.25);
 if(t<.5)return -.28+1.28*smoothstep((t-.25)/.25);
 const recovery=(t-.5)/.5;
 return Math.exp(-5*recovery*recovery)*Math.cos(recovery*Math.PI*2)*(1-smoothstep(recovery));
}
export function heldWeapon(unit:Unit,loadout:Partial<BattleLoadout>={}) {
 const defaultId=DEFAULT_HELD_WEAPONS[unit.kind];
 if(unit.location.zone!=='board'||!defaultId)return null;
 const equipped=HEROES[unit.kind]&&WEAPONS[loadout.equippedWeapons?.[unit.kind]??''];
 return {id:equipped?`weapon_${equipped.id}`:defaultId,style:COMBAT_STYLES[unit.kind],scale:equipped?WEAPON_RARITY_SCALES[equipped.rarity]:(HEROES[unit.kind]?.id ? .95 : 1),
  awakened:!!equipped&&equipped.signatureHero===unit.kind,rarity:equipped?equipped.rarity:-1,hero:!!HEROES[unit.kind]};
}
/** Pure poses keep aim, image placement and VFX muzzle locations in agreement. */
export function bodyPose(unit:Unit){
 const active=clamp(unit.attackAnim??0),angle=unit.attackAngle??(unit.facing===-1?Math.PI:0),style=COMBAT_STYLES[unit.kind];
 const pulse=attackMotion(active);
 const lunge=style==='ranged_recoil'?-10*active:style==='magic_cast'?3*pulse:(style==='spin360'?11:12)*pulse;
 return {x:Math.cos(angle)*lunge,y:Math.sin(angle)*lunge,scaleX:1+pulse*.14,scaleY:1-pulse*.11};
}
export function weaponPose(unit:Unit,seconds:number){
 const style=COMBAT_STYLES[unit.kind],active=clamp(unit.attackAnim??0),t=1-active,angle=unit.attackAngle??(unit.facing===-1?Math.PI:0),hero=!!HEROES[unit.kind];
 let rotation=angle,x=Math.cos(angle)*31,y=Math.sin(angle)*24+7,extension=0,recoil=0;
 if(active>0&&style==='spin360'){
  rotation=angle-.9+t*Math.PI*2.1;const radius=hero?54:46;x=Math.cos(rotation)*radius;y=Math.sin(rotation)*radius;
 }else if(active>0&&style==='cross_slash'){
  const swingPhase=(t-.25)/.75,phase=swingPhase<.5?swingPhase*2:2-swingPhase*2;
  const swing=t<.25?-65*t/.25:-65+185*phase;
  rotation=angle+swing*Math.PI/180;x=Math.cos(rotation)*39;y=Math.sin(rotation)*39;
 }else if(active>0&&style==='cleave180'){
  const swing=t<.25?-65*Math.PI/180*(t/.25):(-65+185*(t-.25)/.75)*Math.PI/180;
  rotation=angle+swing;x=Math.cos(rotation)*39;y=Math.sin(rotation)*39;
 }else if(style==='thrust'){
  extension=attackMotion(active)*28;x=Math.cos(angle)*(33+extension);y=Math.sin(angle)*(33+extension);
 }else if(style==='ranged_recoil'){
  recoil=active*10;x=Math.cos(angle)*(34-recoil);y=Math.sin(angle)*(34-recoil)+8;rotation=angle-active*8*Math.PI/180;
 }else if(style==='magic_cast'){
  x=(unit.facing??1)*35;y=-15+Math.sin(seconds*3+unit.id)*5-attackMotion(active)*14;rotation=angle+Math.sin(seconds*2)*.12;
 }
 return {x,y,rotation,extension,recoil,muzzle:style==='ranged_recoil'&&active>1-.12*3.1};
}
export function fitSprite(c:CanvasRenderingContext2D,image:HTMLImageElement,width:number,height=width){
 const iw=image.naturalWidth||image.width||1,ih=image.naturalHeight||image.height||1;
 const ratio=Math.min(width/iw,height/ih);c.drawImage(image,-iw*ratio/2,-ih*ratio/2,iw*ratio,ih*ratio);
}
/** Called in pet-local space. Bench, tools and components deliberately have no mounts. */
export function drawHeldWeapon(c:CanvasRenderingContext2D,unit:Unit,seconds:number,loadout:Partial<BattleLoadout>={}){
 const weapon=heldWeapon(unit,loadout);if(!weapon)return;
 const pose=weaponPose(unit,seconds),size=(weapon.hero?57:44)*weapon.scale;
 c.save();
 if(weapon.style==='magic_cast'){
  c.save();c.globalAlpha*=.45;ellipse(c,0,31,38,13,'rgba(0,0,0,0)',HEROES[unit.kind]?.color??'#c1a2d4',2);c.restore();
 }
 c.translate(pose.x,pose.y);c.rotate(pose.rotation);
 if(weapon.rarity>=0){
  const colors=['#e5d7ac','#a6ca9c','#9bcadf','#c1a2dd','#f3ca70'];
  c.save();c.globalAlpha*=weapon.awakened ? .25+.12*Math.sin(seconds*4) : .17;
  c.shadowColor=weapon.awakened?'#ffda75':colors[weapon.rarity];c.shadowBlur=weapon.awakened?16:7;
  ellipse(c,0,0,size*.43,size*.43,colors[weapon.rarity],'',0);c.restore();
  if(weapon.awakened)star(c,-size*.38,-size*.28,4+Math.sin(seconds*4),'#ffe8a1',0);
 }
 const art=assets.get(weapon.id)||(weapon.id.startsWith('weapon_')?assets.get(weapon.id.slice(7)):undefined);
 c.save();
 const geometry=weaponArtGeometry(weapon.id);
 if(art){c.rotate(geometry.rotation);fitSprite(c,art,size);}
 else {if(weapon.style!=='ranged_recoil')c.rotate(Math.PI/2);drawWeaponFallback(c,weapon.style,size);}
 c.restore();
 // A small grasp connects the independent sticker to the pet silhouette.
 ellipse(c,-5,7,5,4,'#e7caa1',INK,1.3);
 if(pose.muzzle){
  c.save();c.translate(art?geometry.muzzle[0]*size:size*.5,art?geometry.muzzle[1]*size:0);c.globalAlpha*=Math.min(1,(unit.attackAnim??0)*1.6);
  const flash=assets.get('vfx_muzzle_flash');if(flash)fitSprite(c,flash,39);else star(c,0,0,19,'#ffd47a',1.2);c.restore();
 }
 c.restore();
}
type ArtAxis={readonly from:readonly[number,number];readonly tip:readonly[number,number];readonly muzzle?:readonly[number,number]};
// Authored from the supplied PNGs in normalized image coordinates. Melee uses
// handle→striking end; guns use breech→barrel mouth (not grip→mouth). Round relics
// use a horizontal symmetry axis to keep their upright presentation.
const axis=(x:number,y:number,tx:number,ty:number,mx=tx,my=ty):ArtAxis=>({from:[x/256,y/256],tip:[tx/256,ty/256],muzzle:[mx/256,my/256]});
export const WEAPON_ART_AXES:Readonly<Record<string,ArtAxis>>={
 weapon_basic_club:axis(128,220,128,55),weapon_basic_slingshot:axis(128,220,128,50),
 weapon_basic_spear:axis(128,230,128,30),weapon_basic_hammer:axis(128,220,128,47),
 cleaver:axis(47,213,196,53),basketball:axis(64,128,192,128),
 weapon_m01_swatter:axis(40,218,174,70),weapon_m02_slipper:axis(75,185,205,56),
 weapon_m03_scratcher:axis(40,215,204,48),weapon_m04_baguette:axis(65,191,203,53),
 weapon_m05_duster:axis(42,219,180,72),weapon_m06_stool:axis(128,220,128,48),
 weapon_m07_rolling_pin:axis(60,212,206,50),weapon_m08_durian:axis(40,217,177,80),
 weapon_m09_cat_blade:axis(128,214,128,35),weapon_m10_bamboo_staff:axis(39,218,214,40),
 weapon_m11_salted_fish:axis(40,217,201,53),weapon_m12_iron_wok:axis(128,220,128,70),
 weapon_r01_rubber_band:axis(45,123,220,95),weapon_r02_duck_squirt:axis(120,110,205,110),
 weapon_r03_bubble_gun:axis(85,121,181,110),weapon_r04_tennis_launcher:axis(128,144,178,90,174,112),
 weapon_r05_hair_dryer:axis(64,110,173,100),weapon_r06_pressure_washer:axis(94,145,194,84),
 weapon_r07_popcorn_cannon:axis(90,154,193,105),weapon_r08_coin_slingshot:axis(130,116,209,61,130,116),
 weapon_r09_bamboo_bazooka:axis(77,180,222,52),weapon_r10_acorn_minigun:axis(100,144,216,91),
 weapon_r11_sniper_laser:axis(73,158,230,87),weapon_r12_junk_mortar:axis(102,142,204,77),
 weapon_w01_teaser:axis(48,218,204,39),weapon_w02_balloon:axis(64,128,192,128),
 weapon_w03_bug_zapper:axis(44,211,184,71),weapon_w04_yarn_orb:axis(64,128,192,128),
 weapon_w05_disco_ball:axis(64,128,192,128),weapon_w06_yarn_storm:axis(64,128,192,128),
 weapon_w07_cat_scratch_meteor:axis(222,36,80,190),weapon_w08_fortune_fish:axis(204,94,51,139),
 weapon_w09_yin_yang_burner:axis(64,128,192,128),weapon_w10_cosmic_vacuum:axis(144,111,202,58),
 weapon_w11_golden_hoop_ball:axis(64,128,192,128),weapon_w12_rain_crown_scepter:axis(158,117,218,91),
};
export function weaponArtGeometry(id:string):{rotation:number;muzzle:readonly[number,number]}{
 const authored=WEAPON_ART_AXES[id.startsWith('weapon_')?id:`weapon_${id}`]??WEAPON_ART_AXES[id];
 if(!authored)return {rotation:0,muzzle:[.5,0]};
 const rotation=-Math.atan2(authored.tip[1]-authored.from[1],authored.tip[0]-authored.from[0]);
 const mouth=authored.muzzle??authored.tip,x=mouth[0]-.5,y=mouth[1]-.5,co=Math.cos(rotation),si=Math.sin(rotation);
 return {rotation,muzzle:[co*x-si*y,si*x+co*y]};
}
function drawWeaponFallback(c:CanvasRenderingContext2D,style:string,size:number){
 c.save();c.scale(size/54,size/54);
 if(style==='ranged_recoil'){round(c,-23,-9,42,15,4,'#9bad8e',PAPER,3);round(c,-23,-9,42,15,4,'#9bad8e',INK,1.8);round(c,-9,4,10,13,2,'#ad8967',INK,1.5);line(c,[[17,-4],[27,-4]],INK,5);}
 else if(style==='magic_cast'){line(c,[[0,23],[0,-16]],'#b08f69',7);star(c,0,-19,12,'#d3b7e5',2);ellipse(c,0,-19,4,4,'#fff1b0',INK,1);}
 else if(style==='thrust'){line(c,[[0,25],[0,-14]],'#9cb27e',6);polygon(c,[[0,-29],[-8,-11],[0,-15],[7,-11]],PAPER,INK,1.8);}
 else{line(c,[[0,24],[0,-12]],'#b08c65',7);polygon(c,[[-13,-25],[15,-25],[19,-8],[-14,-4]],'#e5d5b2',PAPER,4);polygon(c,[[-13,-25],[15,-25],[19,-8],[-14,-4]],'#e5d5b2',INK,1.8);}
 c.restore();
}
