import {spriteUrl} from '../render/AssetRegistry';
import {avatarSticker} from '../render/M3Art';
import {UNIT_ICONS,escapeHtml} from './art';

const ink='#514739';
const p=(d:string,fill='none',stroke=ink,width=2.5)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const r=(x:number,y:number,w:number,h:number,fill:string,rx=5)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${ink}" stroke-width="2.5"/>`;
const e=(x:number,y:number,rx:number,ry:number,fill:string)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${ink}" stroke-width="2.5"/>`;
const leaf=p('M0 17 Q-27 1 -19 -22 Q3 -21 0 17 Q0 -15 24 -28 Q34 -1 0 17Z','#9eb77c')+p('M0 29 V-5');
const orange=(x:number,y:number)=>e(x,y,10,10,'#edb25f')+p(`M${x} ${y-9} q3 -10 11 -6 q-1 8 -11 6Z`,'#94ad75');
const eyes=e(-9,-1,2,3,ink)+e(9,-1,2,3,ink)+p('M-5 12 Q0 17 5 12');
const head=(color:string)=>e(-19,-20,8,10,color)+e(19,-20,8,10,color)+e(0,3,26,24,color)+eyes;
const crown=p('M-20 -22 L-23 -36 -9 -29 0 -42 9 -29 23 -36 20 -22Z','#e7c679');
const rat=head('#bcae94')+p('M-22 19 Q-42 29 -28 35 Q-15 38 -18 28','none','#b794a0',4)+e(0,7,5,4,'#d49f9d')+p('M-6 16 H6 V24 H-6Z','#fff6d8');
const bee=e(-18,-8,12,18,'#d5e4dc')+e(18,-8,12,18,'#d5e4dc')+e(0,7,20,25,'#e8c46f')+p('M-18 7 H18 M-15 21 H15','none',ink,6)+eyes;
const frog=e(0,10,28,22,'#9bb88a')+e(-17,-13,11,12,'#9bb88a')+e(17,-13,11,12,'#9bb88a')+e(-17,-14,5,6,'#fff9eb')+e(17,-14,5,6,'#fff9eb')+e(-16,-14,2,3,ink)+e(16,-14,2,3,ink)+p('M-16 13 Q0 23 16 13');
const coon=head('#a7b2a5')+p('M-25 -4 L-15 -12 0 -5 15 -12 25 -4 15 5 0 0 -15 5Z','#687a71')+e(-9,-4,2,3,'#fff9eb')+e(9,-4,2,3,'#fff9eb');
const enemies:Record<string,string>={
  rat,
  roach:e(0,7,16,28,'#aa9173')+p('M0 -18 V32 M-12 -12 L-29 -24 M12 -12 L29 -24 M-14 0 L-30 -6 M14 0 L30 -6 M-15 12 L-33 18 M15 12 L33 18 M-10 27 L-22 38 M10 27 L22 38','none',ink,3)+e(-5,-10,2,3,ink)+e(5,-10,2,3,ink),
  crab:e(0,12,25,18,'#d69f87')+e(-12,-8,5,9,'#e8bd9d')+e(12,-8,5,9,'#e8bd9d')+e(-12,-11,2,3,ink)+e(12,-11,2,3,ink)+p('M-19 7 L-34 -9 -35 -22 -25 -15 -20 -29 -17 -14 -27 -5 M19 7 L34 -9 35 -22 25 -15 20 -29 17 -14 27 -5 M-23 18 L-36 24 M23 18 L36 24 M-17 27 L-28 34 M17 27 L28 34','none','#b4826c',5),
  killer_bee:bee+p('M-14 -10 L-3 -5 M14 -10 L3 -5 M-6 31 L0 42 6 31Z','#aa8067')+p('M-23 -17 L-30 -29 M23 -17 L30 -29'),
  charmed_rat:rat+p('M17 -21 Q8 -32 18 -36 Q23 -37 26 -31 Q31 -36 36 -31 Q42 -21 26 -13Z','#dbaaaf'),
  husky_wrecker:p('M-25 -3 L-28 -35 -7 -20 Q0 -23 8 -20 L29 -35 25 -2 Q33 29 0 32 Q-33 29 -25 -3Z','#a7b9b5')+p('M-18 -6 L-7 -14 0 -3 7 -14 18 -6 12 15 0 26 -12 15Z','#f8efd6')+e(-10,-3,3,4,ink)+e(10,-3,3,4,ink)+p('M-4 9 H4 L0 14Z',ink)+p('M-22 28 L-11 21 -2 30 10 23 24 30','#c9ac87'),
  mega_roomba:e(0,16,34,19,'#879d98')+e(0,4,34,22,'#c7d3c2')+e(0,0,22,12,'#a7b8a7')+r(-9,-9,18,13,'#e1b185')+e(0,-3,3,3,'#f5dfad')+p('M-24 15 H24 M-18 22 H18 M-25 27 L-34 37 M25 27 L34 37'),
  dr_clippers:head('#d8bd96')+p('M-22 -8 H22 L17 -21 H-17Z','#f2ead7')+r(15,9,20,30,'#a5b8b4')+r(13,4,24,8,'#d3d8c8')+p('M16 3 V-7 M22 3 V-7 M28 3 V-7 M34 3 V-7 M20 21 H30'),
  box_kraken:r(-27,-22,54,51,'#c7a780')+p('M-27 -22 L-7 -36 10 -23 27 -22 M-27 -22 L-10 -10 0 -21 12 -10 27 -22 M0 -21 V27','none','#8b755a')+e(-12,0,3,4,ink)+e(12,0,3,4,ink)+p('M-26 17 Q-43 7 -38 27 Q-33 40 -22 29 M26 17 Q43 7 38 27 Q33 40 22 29','none','#ae91af',6),
  sad_rain_frog:frog+p('M-31 -26 Q-38 -37 -24 -39 Q-17 -49 -6 -41 Q7 -45 11 -33 Q26 -34 24 -23Z','#b4bec1')+p('M-22 -19 L-26 -11 M-9 -20 L-12 -12 M7 -18 L4 -10','none','#88b8c4',3),
  king_skunk:p('M-18 19 Q-46 9 -29 -31 Q-14 -49 -3 -31 Q5 -6 -6 12Z','#68766d')+p('M-24 -29 Q-35 0 -15 17','none','#f4e9d2',8)+head('#77857c')+p('M0 -20 Q-9 -3 0 5 Q9 -3 0 -20Z','#f9f0d7')+p('M25 17 Q43 6 38 29 Q27 41 22 28Z','#a2b48a'),
  diva_kitty:p('M-24 0 L-29 -33 -9 -21 Q0 -25 10 -21 L29 -33 24 0 Q32 28 0 31 Q-32 28 -24 0Z','#d8c5c0')+p('M-17 -1 Q-10 7 -3 -1 M3 -1 Q10 7 17 -1 M-15 -1 L-19 -6 M15 -1 L19 -6 M-3 10 Q0 16 3 10')+p('M23 -21 Q16 -36 26 -37 Q32 -39 35 -32 Q44 -39 45 -29 Q42 -20 31 -14Z','#deacb6'),
  buff_roo:p('M-17 -8 L-19 -39 -8 -37 -4 -15 M17 -8 L19 -39 8 -37 4 -15','#c8a17c')+head('#c8a17c')+e(-27,21,13,15,'#c88d7f')+e(27,21,13,15,'#c88d7f')+r(-34,11,15,8,'#edc6a0')+r(19,11,15,8,'#edc6a0')+p('M-11 27 Q0 37 11 27','none','#eed3ac',6),
  hornet_queen:bee+crown+p('M-18 -14 L-7 -7 M18 -14 L7 -7 M-6 32 L0 43 6 32Z','#a37e64')+p('M-29 0 L-37 10 M29 0 L37 10','none','#b799c0',4),
  screaming_marmot:head('#b79b7a')+e(0,12,12,16,'#766957')+p('M-8 1 H8 V10 H-8Z','#fff0ce')+p('M-31 -10 L-39 -18 M-32 1 H-43 M31 -10 L39 -18 M32 1 H43','none','#d5b781',3),
  trash_coon:coon+r(-24,19,48,18,'#9aaa9b')+r(-28,15,56,8,'#c3cbb3')+p('M-15 27 H15 M-8 33 H8 M25 -15 L35 -35','none','#8c759f',4)+e(34,-34,8,8,'#d7b4ca')+p('M29 -33 H39 M34 -39 V-29'),
  dj_rat_king:rat+crown+r(-38,10,18,27,'#9d91aa')+r(20,10,18,27,'#9d91aa')+e(-29,25,6,6,'#d3c0d4')+e(29,25,6,6,'#d3c0d4')+p('M-29 8 V-12 Q0 -39 29 -12 V8','none','#91859b',5),
};
const tools:Record<string,string>={
  shovel:p('M0 -7 V-29 M-10 -29 V-39 H10 V-29Z','none','#b39a79',6)+p('M-15 -7 H15 L12 18 0 33 -12 18Z','#bbc8b9')+p('M0 0 V23','none','#e3e5cd',3),
  sprinkler:r(-28,-6,47,29,'#e9c977')+r(-15,-25,25,22,'#b4d5cf')+p('M9 -19 H27 L34 -11','none','#c8a157',5)+e(-17,24,8,8,'#798b80')+e(15,24,8,8,'#798b80')+p('M26 -3 L38 -8 M26 3 H42 M26 9 L38 15','none','#94c8d0',3),
};
const props:Record<string,string>={
  washer:r(-29,-30,58,62,'#b6c9c1')+r(-24,-25,48,11,'#f5e4bb')+e(0,10,20,20,'#f8f2d9')+e(0,10,13,13,'#a1c7cb')+p('M-10 9 Q0 0 10 11 Q0 21 -10 9Z','#d6b1be'),
  clay:e(0,12,28,17,'#cbb0cc')+p('M-22 3 Q-25 -18 -9 -17 Q-3 -35 13 -22 Q29 -15 23 6Z','#dcbdd0')+e(-8,-4,3,4,'#f5dfad')+p('M3 11 Q15 -2 20 8','none','#a681aa',4),
  milk_bottle:p('M-11 -19 V-28 Q0 -42 11 -28 V-19Z','#e0b98e')+r(-17,-20,34,9,'#c3aec9')+p('M-16 -9 Q-27 4 -21 29 Q0 40 21 29 Q27 4 16 -9Z','#fff1cc')+p('M8 1 H18 M8 10 H19 M8 19 H18','none','#bda3b5')+e(-7,13,5,7,'#e2bfa1'),
  whistle:p('M-29 -3 Q-34 23 -7 27 Q17 28 21 7 L35 -3 29 -17 10 -8 Q-10 -23 -29 -3Z','#dfc16f')+e(-9,6,11,12,'#f5da8b')+p('M21 -8 L28 4 M-24 -18 Q-34 -33 -22 -36 M-12 -25 L-9 -36','none','#a697b2'),
  expired_can:r(-23,-27,46,58,'#b5c4a2')+e(0,-26,23,7,'#d7ddc5')+r(-23,-8,46,25,'#e8bc98',0)+p('M-12 5 L-3 -3 6 6 -1 13Z','#e3cf94')+p('M-13 -28 H10 M-15 28 H15'),
  catnip:leaf+r(-17,16,34,16,'#d4b18d')+p('M-12 24 H12','none','#f7dfad'),
  glue_trap:p('M-33 5 L17 -22 36 10 -15 34Z','#c9ae82')+p('M-24 6 L14 -14 25 9 -14 26Z','#e7cc8c')+p('M-8 2 Q11 -9 14 3 Q11 13 -2 13 Q-15 9 -8 2Z','#bca0c1')+e(-2,3,3,3,'#f3e1b8'),
  recycle_bin:r(-23,-18,46,50,'#9fb89a')+r(-28,-24,56,9,'#c3d2ae')+p('M-10 -25 V-32 H10 V-25 M-11 2 L0 -7 11 2 M0 -7 V15 M-11 15 H11','none','#f9ebc5',4),
  gold_doge:p('M-23 -3 L-28 -29 -9 -17 Q0 -24 10 -17 L28 -29 23 -2 Q33 29 0 31 Q-33 29 -23 -3Z','#e3c16e')+e(-10,3,2,3,ink)+e(10,3,2,3,ink)+p('M-12 13 Q0 26 12 13 M-3 12 H3')+e(26,25,10,10,'#f2d58b')+p('M26 19 V31'),
  auto_shovel:r(-31,8,62,26,'#abc2ad')+r(-20,-24,40,31,'#e1c894')+p('M-9 -23 V-34 H9 V-23 M0 2 V22','none','#8c9d96',6)+p('M-10 20 H10 L8 30 H-8Z','#c9d4ca')+e(-22,32,6,6,'#86978b')+e(22,32,6,6,'#86978b'),
  giant_orange_cat:p('M-28 -4 L-28 -29 -11 -18 Q0 -24 12 -18 L28 -29 29 -4 Q38 28 0 32 Q-37 27 -28 -4Z','#e4ad6b')+p('M-16 3 H-7 M7 3 H16 M-5 15 Q0 22 5 15 M-8 -18 L-6 -8 M0 -21 V-10 M8 -18 L6 -8')+p('M-27 15 H-38 M27 15 H38'),
  vip_poster:r(-25,-33,50,65,'#ead9ac')+p('M-27 -23 H27 M-27 25 H27','none','#b29471',5)+p('M-12 4 L-15 -11 -5 -6 0 -17 6 -6 15 -11 12 4Z','#e4bd66')+p('M-13 15 H13 M-7 21 H7','none','#ac9a77'),
  extra_oranges:e(0,20,33,10,'#d4c7a4')+orange(-17,8)+orange(16,8)+orange(0,-9),
  shared_oranges:p('M-33 -20 H33 V-6 Q22 0 33 6 V25 H-33 V6 Q-22 0 -33 -6Z','#d3bea2')+p('M8 -15 V20','none','#faf0d0',3)+orange(-12,2)+p('M18 -8 H26 M18 3 H26 M18 14 H26'),
  hyper_party:p('M-30 30 L-18 -10 11 17Z','#d8a0b2')+p('M-24 11 L-8 22 M-20 0 L1 15','none','#f7df9f',5)+p('M-7 -15 Q-14 -34 0 -32 Q16 -26 7 -15 M13 -6 Q31 -24 32 -9 M16 7 L35 3 M-22 -25 L-29 -34','none','#a5bb91',3)+e(24,24,4,4,'#c4afd0'),
  banana_peel:p('M-3 -16 Q-20 -3 -30 20 Q-11 24 1 3 Q11 23 31 20 Q17 -7 5 -17Z','#edce76')+p('M-3 -16 L-2 -28 7 -26 5 -17Z','#b1b983')+p('M0 -9 L1 3 M-23 18 L-7 -1 M25 17 L10 -2','none','#bda65c',2),
  emp_jammer:r(-21,-3,42,35,'#aebbc2')+e(0,15,7,7,'#d3b4cf')+p('M0 -3 V-22 M-10 -17 Q0 -28 10 -17 M-19 -24 Q0 -43 19 -24','none','#9287aa',3)+p('M-26 8 H-32 M26 8 H32 M-12 29 H12'),
  promo_badge:p('M-19 9 L-23 35 -7 28 0 37 8 10 M19 9 L24 34 9 27 1 35 -7 8','#c5a9c8')+e(0,-7,25,25,'#e6c577')+e(0,-7,17,17,'#f5df9f')+p('M0 -19 L4 -11 13 -10 7 -3 8 6 0 2 -8 6 -7 -3 -13 -10 -4 -11Z','#c3a05e'),
  tall_perch:p('M-19 31 V-16 M18 31 V-16','none','#b69976',6)+r(-29,22,58,10,'#ceb48e')+r(-27,-17,54,9,'#b4c59e')+p('M-18 -26 L13 -36 21 -19 -12 -11Z','#adbcc1')+e(17,-28,9,10,'#d5ddd0')+p('M0 -17 V-4 M-7 -4 H8'),
  bee_overtime:e(-18,-13,12,16,'#d3e3df')+e(15,-13,12,16,'#d3e3df')+e(0,4,19,24,'#efd07c')+p('M-18 3 H18 M-14 17 H14','none','#665e4c',6)+e(-7,-5,2,3,ink)+e(7,-5,2,3,ink)+e(23,25,12,12,'#eed49a')+p('M23 18 V25 L29 28'),
};
const sizeOf=(size:number,fallback:number)=>Number.isFinite(size)&&size>0?Math.max(16,Math.min(512,Math.round(size))):fallback;
function geometry(id:string,art:string,size:number):string {
  return `<svg viewBox="-48 -48 96 96" width="${size}" height="${size}" role="img" aria-label="${id}" data-sticker="${id}"><g stroke-linecap="round" stroke-linejoin="round"><path d="M-39 -26 Q-42 -42 -19 -40 L19 -41 Q42 -39 40 -18 L41 22 Q38 43 17 41 L-22 42 Q-43 38 -40 18Z" fill="#fff9eb" stroke="#fffdf6" stroke-width="5"/>${art}</g></svg>`;
}
function image(id:string,size:number):string|undefined {
  const url=spriteUrl(id);return url?`<img src="${escapeHtml(url)}" width="${size}" height="${size}" alt="${id}" data-sticker="${id}" style="object-fit:contain"/>`:undefined;
}
export function propSticker(id:string,size=48):string {
  const key=Object.hasOwn(props,id)?id:'washer',n=sizeOf(size,48),override=image(`prop_${key}`,n);
  return override||`<svg viewBox="-48 -48 96 96" width="${n}" height="${n}" role="img" aria-label="${key}" data-sticker="prop_${key}"><g stroke-linecap="round" stroke-linejoin="round"><path d="M-39 -26 Q-42 -42 -19 -40 L19 -41 Q42 -39 40 -18 L41 22 Q38 43 17 41 L-22 42 Q-43 38 -40 18Z" fill="#fff9eb" stroke="#fffdf6" stroke-width="5"/>${props[key]}</g></svg>`;
}
export function unitSticker(kind:string,size=40):string {
  const key=Object.hasOwn(UNIT_ICONS,kind)||Object.hasOwn(enemies,kind)?kind:'hamster',n=sizeOf(size,40),override=image(key,n);
  if(override)return override;
  if(Object.hasOwn(enemies,key))return geometry(key,enemies[key],n);
  if(['hamster','squirrel','bee'].includes(key))return avatarSticker(key,n);
  return `<span role="img" aria-label="${key}" data-sticker="${key}" style="display:inline-grid;place-items:center;width:${n}px;height:${n}px;font-size:${Math.round(n*.63)}px">${escapeHtml(UNIT_ICONS[key])}</span>`;
}
export function sceneSticker(id:'menu_banner'|'logo_capy'|'sprinkler'|'shovel',fallback:string,size?:number):string {
  const n=sizeOf(size??(id==='menu_banner'?400:64),64);
  return image(id,n)||(Object.hasOwn(tools,id)?geometry(id,tools[id],n):fallback);
}
