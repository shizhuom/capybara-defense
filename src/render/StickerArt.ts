/** Small, local vector illustrations. All coordinates are relative to a sticker's centre. */
export const INK = '#514739';
export const PAPER = '#fff9eb';
type C = CanvasRenderingContext2D;

export function line(c: C, points: number[][], color = INK, width = 2.8): void {
  c.beginPath();
  points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
  c.strokeStyle = color; c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
}
const isTransparentColor = (color: string): boolean => {
  if (!color) return true;
  const trimmed = color.trim().toLowerCase();
  return trimmed === 'transparent' || trimmed === 'none' || /^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(trimmed);
};

export function ellipse(c: C, x: number, y: number, rx: number, ry: number, fill: string, stroke = INK, width = 2.6): void {
  c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  if (!isTransparentColor(fill)) { c.fillStyle = fill; c.fill(); }
  if (width > 0 && !isTransparentColor(stroke)) { c.strokeStyle=stroke; c.lineWidth=width; c.stroke(); }
}
export function round(c: C, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = INK, width = 2.6): void {
  c.beginPath(); c.roundRect(x,y,w,h,r);
  if (!isTransparentColor(fill)) { c.fillStyle=fill; c.fill(); }
  if (width > 0 && !isTransparentColor(stroke)) { c.strokeStyle=stroke; c.lineWidth=width; c.stroke(); }
}
export function polygon(c: C, points: number[][], fill: string, stroke = INK, width = 2.6): void {
  c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
  if (!isTransparentColor(fill)) { c.fillStyle=fill; c.fill(); }
  if (width > 0 && !isTransparentColor(stroke)) { c.strokeStyle=stroke; c.lineWidth=width; c.lineJoin='round'; c.stroke(); }
}
export function star(c: C, x: number, y: number, r: number, fill = '#f4ca69', width = 1.7): void {
  const points = Array.from({length:10},(_,i) => {
    const a = -Math.PI/2+i*Math.PI/5, length = i%2 ? r*.45 : r;
    return [x+Math.cos(a)*length,y+Math.sin(a)*length];
  }); polygon(c,points,fill,INK,width);
}
function outlineOval(c: C, x:number,y:number,rx:number,ry:number,fill:string): void {
  ellipse(c,x,y,rx,ry,fill,'#fffdf6',9); ellipse(c,x,y,rx,ry,fill);
}
function eyes(c: C, x=0, y=-4, spacing=9, sleepy=false): void {
  if (sleepy) { line(c,[[x-spacing-3,y],[x-spacing,y+1],[x-spacing+3,y]],INK,2.4); line(c,[[x+spacing-3,y],[x+spacing,y+1],[x+spacing+3,y]],INK,2.4); }
  else { ellipse(c,x-spacing,y,2.3,3,INK,INK,0); ellipse(c,x+spacing,y,2.3,3,INK,INK,0); ellipse(c,x-spacing-.7,y-1,.7,.9,PAPER,PAPER,0); ellipse(c,x+spacing-.7,y-1,.7,.9,PAPER,PAPER,0); }
}
function cheeks(c:C,y=3,x=16):void { ellipse(c,-x,y,4.5,2.5,'#e9a08b','#e9a08b',0); ellipse(c,x,y,4.5,2.5,'#e9a08b','#e9a08b',0); }
function smile(c:C,x=0,y=7):void { line(c,[[x-3,y],[x,y+2],[x+3,y]],INK,1.9); }

export function drawOrange(c:C,x:number,y:number,size=10,angle=0):void {
  c.save(); c.translate(x,y); c.rotate(angle);
  ellipse(c,0,0,size,size*.86,'#f8a54f',INK,2.1);
  ellipse(c,-size*.3,-size*.2,size*.16,size*.22,'#ffdc96','#ffdc96',0);
  c.save(); c.rotate(-.5); ellipse(c,3,-size*.8,size*.4,size*.17,'#81aa77',INK,1.3); c.restore();
  line(c,[[0,-size*.8],[1,-size*1.04]],INK,1.6); c.restore();
}

function bambooHat(c:C,y=-22):void {
  polygon(c,[[-31,y+3],[1,y-17],[30,y+3],[17,y+8],[-18,y+8]],'#c1c88e');
  line(c,[[-29,y+3],[29,y+3]],'#809064',2);
  [-15,0,15].forEach(x=>line(c,[[1,y-14],[x,y+3]],'#9fa576',1));
  line(c,[[-23,y+7],[-18,y+15]],'#829267',2);
}
function shades(c:C,y=-5):void {
  round(c,-24,y-6,21,14,5,'#514f61',INK,2.5); round(c,3,y-6,21,14,5,'#514f61',INK,2.5);
  line(c,[[-3,y-1],[3,y-1]],INK,3); line(c,[[-27,y-4],[-23,y-3]],INK,2.8); line(c,[[23,y-3],[27,y-4]],INK,2.8);
  line(c,[[-19,y-2],[-12,y-5]],'#a7bbcf',2); line(c,[[8,y-2],[15,y-5]],'#a7bbcf',2);
}
function wizardHat(c:C,y=-20):void {
  polygon(c,[[-23,y+7],[-9,y-31],[5,y-36],[4,y-19],[20,y+5]],'#a590cd');
  ellipse(c,0,y+6,29,6,'#b7a3da'); line(c,[[-17,y-2],[15,y-2]],'#e7ca79',5); star(c,-5,y-14,5,'#f8df8c',1.2);
}
function crown(c:C,y=-25):void {
  polygon(c,[[-22,y+9],[-25,y-12],[-10,y-3],[0,y-18],[10,y-3],[25,y-12],[22,y+9]],'#f3cf67');
  round(c,-22,y+6,44,7,3,'#edb856',INK,2);
  ellipse(c,0,y+3,3,4,'#e39588',INK,1.3);
  [-24,0,24].forEach((x,i)=>ellipse(c,x,y-(i===1?18:12),2.6,2.6,'#ffe8a3',INK,1.3));
}
function cleaver(c:C,x=21,y=6):void {
  c.save(); c.translate(x,y); c.rotate(-.33);
  round(c,-3,5,7,18,2,'#ab7958',INK,2.2); round(c,-5,-20,25,28,3,'#c9d8dc',INK,2.5);
  line(c,[[-1,-16],[16,-16],[16,4]],'#f9fded',3); ellipse(c,14,-13,1.9,1.9,INK,INK,0); c.restore();
}
function basketball(c:C,x=0,y=0,r=21):void {
  ellipse(c,x,y,r,r,'#ec9860');
  line(c,[[x-r,y],[x+r,y]],INK,1.6); line(c,[[x,y-r],[x,y+r]],INK,1.6);
  c.strokeStyle=INK; c.lineWidth=1.6;
  c.beginPath(); c.moveTo(x-r*.65,y-r*.74); c.quadraticCurveTo(x+r*.45,y,x-r*.65,y+r*.74); c.stroke();
  c.beginPath(); c.moveTo(x+r*.65,y-r*.74); c.quadraticCurveTo(x-r*.45,y,x+r*.65,y+r*.74); c.stroke();
}
function trashLid(c:C,x=0,y=0):void {
  ellipse(c,x,y,28,12,'#a1beb1'); round(c,x-8,y-18,16,9,3,'#90ac9f',INK,2);
  ellipse(c,x,y-3,28,10,'#b3c8b8'); line(c,[[x-18,y-4],[x-5,y-7]],'#e4ead3',2.4); line(c,[[x+7,y-7],[x+18,y-4]],'#e4ead3',2.4);
}
function accessory(c:C,kind:string,time:number):void {
  c.save(); c.translate(0,4+Math.sin(time*2)*2);
  switch(kind) {
    case 'hat_bamboo': bambooHat(c,0); break;
    case 'hat_shades': shades(c,0); break;
    case 'hat_wizard': wizardHat(c,12); break;
    case 'cleaver': cleaver(c,-5,0); break;
    case 'basketball': basketball(c); break;
    case 'trash_lid': trashLid(c,0,2); break;
    case 'crown': crown(c,-1); break;
  }
  c.restore(); star(c,27,-26,4.5,'#f5ca77',0); star(c,-26,18,3,'#e9ac9f',0);
}

function animal(c:C,kind:string,time:number):void {
  if (kind==='bee') {
    ellipse(c,-15,-13,12,18,'#edf6e3','#89a9a2',2); ellipse(c,15,-13,12,18,'#edf6e3','#89a9a2',2);
    outlineOval(c,0,2,21,23,'#f8d96c');
    c.save(); c.beginPath(); c.ellipse(0,2,20,22,0,0,Math.PI*2); c.clip();
    round(c,-22,5,44,7,0,INK,INK,0); round(c,-22,18,44,7,0,INK,INK,0); c.restore();
    line(c,[[-7,-19],[-11,-28]],INK,2); line(c,[[7,-19],[11,-28]],INK,2);
    ellipse(c,-11,-28,3,3,INK,INK,0); ellipse(c,11,-28,3,3,INK,INK,0); eyes(c,0,-5,7); cheeks(c,1,13); smile(c,0,2);
    round(c,14,11,15,17,4,'#d7a365',INK,2); round(c,17,6,9,7,2,'#efd58d',INK,2); line(c,[[17,18],[26,18]],'#fff0b0',2); return;
  }
  if(kind==='hedgehog') {
    const spikes=Array.from({length:24},(_,i)=>{const a=-Math.PI+i*Math.PI/23; const r=i%2?25:33;return[Math.cos(a)*r,Math.sin(a)*r+9];});
    polygon(c,[[-27,13],...spikes,[27,13]],'#9f816e','#fffdf6',8); polygon(c,[[-27,13],...spikes,[27,13]],'#9f816e');
    ellipse(c,-2,5,22,21,'#e8cfac'); eyes(c,-4,0,7); cheeks(c,5,14); ellipse(c,18,3,4,3,INK,INK,0);
    line(c,[[-21,22],[-13,24]],INK,4); line(c,[[6,24],[15,23]],INK,4);
    line(c,[[23,24],[23,-36]],'#8b7150',3.4); polygon(c,[[18,-27],[23,-39],[28,-27]],'#d1e0d5',INK,2); ellipse(c,17,13,5,4,'#e8cfac',INK,2); return;
  }
  if(kind==='goose') {
    outlineOval(c,-5,11,24,16,'#f9f4de');
    round(c,5,-25,14,37,8,'#f9f4de',INK,2.5); ellipse(c,11,-23,16,13,'#f9f4de');
    polygon(c,[[23,-26],[37,-20],[23,-16]],'#efb064'); eyes(c,15,-25,4,true);
    c.beginPath(); c.moveTo(-19,7); c.quadraticCurveTo(-6,20,2,7); c.strokeStyle='#c9c6ac'; c.lineWidth=2; c.stroke();
    line(c,[[-12,25],[-12,30],[-20,30]],'#d89f60',3); line(c,[[3,25],[3,30],[-3,30]],'#d89f60',3); return;
  }
  if(kind==='frog') {
    outlineOval(c,0,8,27,20,'#91bb77');
    ellipse(c,-16,-14,11,12,'#91bb77'); ellipse(c,16,-14,11,12,'#91bb77');
    ellipse(c,-15,-14,7,7,'#f5efd8',INK,1.5); ellipse(c,15,-14,7,7,'#f5efd8',INK,1.5);
    ellipse(c,-14,-12,2.6,3.2,INK,INK,0); ellipse(c,14,-12,2.6,3.2,INK,INK,0);
    line(c,[[-22,-19],[-10,-17]],'#719b64',4); line(c,[[10,-17],[22,-19]],'#719b64',4);
    ellipse(c,0,11,20,7,'#d2a37e',INK,2); line(c,[[-17,8],[0,10],[17,8]],INK,2); cheeks(c,1,22); return;
  }
  if(kind==='rooster') {
    polygon(c,[[-14,12],[-31,-3],[-30,17],[-16,21]],'#7b8795');
    outlineOval(c,0,6,23,25,'#f3d18c');
    ellipse(c,-8,-21,6,9,'#dc7f70',INK,2); ellipse(c,1,-24,6,10,'#dc7f70',INK,2); ellipse(c,9,-21,5,8,'#dc7f70',INK,2);
    eyes(c,0,-5,8); polygon(c,[[-5,1],[6,1],[0,8]],'#eaa154',INK,1.7); ellipse(c,1,11,4,6,'#dc7f70',INK,1.7);
    line(c,[[-10,29],[-10,34],[-17,34]],'#d59a4d',3); line(c,[[10,29],[10,34],[17,34]],'#d59a4d',3); return;
  }
  const colors:Record<string,string>={hamster:'#eabc80',squirrel:'#c9916e',corgi:'#e8b166',panda:'#f8f5df',cat:'#efbb8d',shiba:'#d8a26c',raccoon:'#a7aaa0'};
  const coat=colors[kind]||'#d7b68b';
  if(kind==='squirrel') {
    c.save(); c.rotate(-.3); outlineOval(c,-22,2,16,28,'#c28b68'); ellipse(c,-24,1,8,18,'#e4b58c',INK,1.9); c.restore();
  }
  if(kind==='raccoon') {
    c.save(); c.translate(-23,13); c.rotate(-.7); ellipse(c,0,0,12,21,'#a8aaa0');
    line(c,[[-10,-7],[10,-7]],'#60655f',5); line(c,[[-10,6],[10,6]],'#60655f',5); c.restore();
  }
  if(kind==='corgi') {
    round(c,-29,23,58,7,4,'#8fb6ab',INK,2.5); ellipse(c,-19,32,5,5,'#6d7b78',INK,2); ellipse(c,18,32,5,5,'#6d7b78',INK,2);
  }
  outlineOval(c,0,9,22,21,coat);
  ellipse(c,-13,25,8,5,kind==='panda'?'#60615b':coat,INK,2); ellipse(c,13,25,8,5,kind==='panda'?'#60615b':coat,INK,2);
  if(['cat','shiba','corgi'].includes(kind)) {
    polygon(c,[[-24,-14],[-23,-35],[-7,-22]],coat,'#fffdf6',6); polygon(c,[[7,-22],[23,-35],[24,-14]],coat,'#fffdf6',6);
    polygon(c,[[-24,-14],[-23,-35],[-7,-22]],coat); polygon(c,[[7,-22],[23,-35],[24,-14]],coat);
    polygon(c,[[-20,-20],[-20,-28],[-13,-22]],'#e7a996',INK,0); polygon(c,[[13,-22],[20,-28],[20,-20]],'#e7a996',INK,0);
  } else {
    const ear=kind==='panda'?'#5f605a':coat;
    ellipse(c,-20,-23,9,10,ear,'#fffdf6',7); ellipse(c,20,-23,9,10,ear,'#fffdf6',7);
    ellipse(c,-20,-23,9,10,ear); ellipse(c,20,-23,9,10,ear);
    if(kind!=='panda'){ellipse(c,-20,-23,4,5,'#dba393',INK,0);ellipse(c,20,-23,4,5,'#dba393',INK,0);}
  }
  ellipse(c,0,-7,26,23,coat);
  if(kind==='panda') {
    c.save(); c.rotate(-.3); ellipse(c,-11,-8,7,9,'#686a62',INK,0); c.restore();
    c.save(); c.rotate(.3); ellipse(c,11,-8,7,9,'#686a62',INK,0); c.restore();
    ellipse(c,-9,-8,2,3,PAPER,PAPER,0); ellipse(c,9,-8,2,3,PAPER,PAPER,0);
    ellipse(c,-18,15,8,11,'#60615b',INK,2); ellipse(c,18,15,8,11,'#60615b',INK,2);
  } else if(kind==='raccoon') {
    polygon(c,[[-25,-8],[-17,-15],[0,-7],[17,-15],[25,-8],[16,1],[0,-3],[-16,1]],'#636a64',INK,0);
    ellipse(c,-10,-7,2.3,3,PAPER,PAPER,0); ellipse(c,10,-7,2.3,3,PAPER,PAPER,0);
  } else {
    if(['shiba','corgi','hamster'].includes(kind)) {
      ellipse(c,-10,4,13,10,'#fff0cf',INK,0); ellipse(c,10,4,13,10,'#fff0cf',INK,0);
    }
    eyes(c,0,-9,10,kind==='shiba'); cheeks(c,1,19);
  }
  ellipse(c,0,0,3.5,2.6,INK,INK,0); smile(c,0,5);
  if(kind==='cat') {
    line(c,[[-5,-28],[-4,-20]],'#b78361',2.8); line(c,[[5,-28],[4,-20]],'#b78361',2.8);
    line(c,[[-24,-2],[-17,0]],'#b78361',2); line(c,[[24,-2],[17,0]],'#b78361',2);
  }
  if(kind==='shiba'){line(c,[[-17,-16],[-10,-19]],INK,1.5); line(c,[[7,-17],[15,-15]],INK,1.5);}
  if(kind==='hamster') {
    polygon(c,[[-15,12],[13,12],[3,18],[-13,18]],'#b88174',INK,1.4);
    ellipse(c,-20,12,9,13,'#b58b58',INK,2); line(c,[[-21,1],[-20,22]],'#e7c89e',2); line(c,[[20,22],[23,-7]],'#c7d8cb',3); polygon(c,[[19,-6],[24,-16],[27,-5]],'#d1ded1',INK,1.6);
  }
  if(kind==='squirrel') {
    line(c,[[16,23],[16,7],[9,-3]],'#795e46',4); line(c,[[16,7],[25,-4]],'#795e46',4); line(c,[[9,-3],[25,-4]],'#c0a572',1.7); ellipse(c,20,13,4,5,'#e0aa7b',INK,1.8);
  }
  if(kind==='corgi') { polygon(c,[[-12,11],[12,11],[0,22]],'#dd8e7a',INK,1.5); }
  void time;
}

const HERO_BASE:Record<string,string>={kungfu_po:'panda',bamboo_mafia:'panda',zen_master:'panda',puss_in_hat:'cat',meowfia:'cat',purrcerer:'cat',samurai_doge:'shiba',doge_wick:'shiba',ronin_goose:'goose',ballin_rooster:'rooster',rocket_coon:'raccoon',pepe_king:'frog'};

export function drawUnitArt(c:C,kind:string,time:number):void {
  c.save(); c.lineJoin='round'; c.lineCap='round';
  if(['hat_bamboo','hat_shades','hat_wizard','cleaver','basketball','trash_lid','crown'].includes(kind)) {
    accessory(c,kind,time); c.restore(); return;
  }
  const base=HERO_BASE[kind]||kind;
  if(HERO_BASE[kind]) {
    const cape=kind.includes('wizard')||kind==='purrcerer'||kind==='zen_master'?'#c0a5d2':kind==='pepe_king'?'#d99b9e':'#7daea0';
    polygon(c,[[-18,-8],[-29,24],[-7,20],[7,25],[28,22],[18,-8]],cape,'#fffdf6',8);
    polygon(c,[[-18,-8],[-29,24],[-7,20],[7,25],[28,22],[18,-8]],cape,INK,2.2);
  }
  animal(c,base,time);
  switch(kind) {
    case 'kungfu_po': bambooHat(c,-28); line(c,[[-30,20],[32,13]],'#9ea963',5); line(c,[[-22,16],[-22,21]],'#dfd68d',2); break;
    case 'bamboo_mafia':
      shades(c,-8); c.save(); c.translate(21,12); c.rotate(-.4); round(c,-3,-23,17,35,5,'#91aa78'); line(c,[[-2,-16],[13,-16]],'#d9d591',3); ellipse(c,5,-24,8,4,'#626e50',INK,2); c.restore(); break;
    case 'zen_master':
      wizardHat(c,-26); ellipse(c,25,12,13,13,'#f7f3d9',INK,2); c.beginPath();c.arc(25,12,12,-Math.PI/2,Math.PI/2);c.arc(25,18,6,Math.PI/2,Math.PI*1.5,true);c.arc(25,6,6,Math.PI/2,-Math.PI/2);c.fillStyle='#626960';c.fill();ellipse(c,25,5,2,2,'#f7f3d9',INK,0);ellipse(c,25,18,2,2,'#626960',INK,0); break;
    case 'puss_in_hat': bambooHat(c,-28); line(c,[[17,26],[35,-3]],'#dbe3d8',4); line(c,[[18,17],[29,23]],'#b49755',4); polygon(c,[[-18,23],[-10,23],[-10,32],[-23,32]],'#9c7658',INK,2); break;
    case 'meowfia': shades(c,-8); round(c,-6,12,36,11,3,'#a0b8ad'); line(c,[[6,13],[6,22]],PAPER,2); line(c,[[13,13],[13,22]],PAPER,2); polygon(c,[[30,13],[38,7],[38,27],[30,22]],'#d8dbbd',INK,2); break;
    case 'purrcerer': wizardHat(c,-26); line(c,[[18,24],[29,-3]],'#997e60',3); star(c,29,-6,7,'#f2cf7c',1.8); ellipse(c,-24,17,9,9,'#cba8d3',INK,2); line(c,[[-29,14],[-20,20],[-20,12],[-29,20]],'#a17cbb',1); break;
    case 'samurai_doge': bambooHat(c,-28); c.save(); c.translate(23,6);c.rotate(.35);round(c,-5,-26,12,37,5,'#b48d60',INK,2.3);line(c,[[1,11],[1,27]],'#926c4d',5);line(c,[[-1,-20],[-1,5]],'#d6b182',2);c.restore();break;
    case 'doge_wick': shades(c,-8); polygon(c,[[-8,10],[8,10],[0,27]],'#f4e6c8',INK,1); line(c,[[0,14],[0,23]],'#6e7277',4); [-1,1].forEach(d=>{round(c,d*21-5,8,10,14,2,'#77868a',INK,2);round(c,d*24-9,6,18,6,2,'#9ba9a5',INK,2);});break;
    case 'ronin_goose': line(c,[[0,-30],[23,-28]],'#c57f70',5); polygon(c,[[1,-29],[-14,-35],[-9,-24]],'#c57f70',INK,1.5); cleaver(c,31,-9); break;
    case 'ballin_rooster': line(c,[[-13,-1],[-9,23]],'#6c7377',4); line(c,[[13,-1],[9,23]],'#6c7377',4); round(c,-14,15,28,12,3,'#7e8589',INK,1.8); basketball(c,27,16,14); break;
    case 'rocket_coon': trashLid(c,-1,-29); c.save(); c.translate(22,17); c.rotate(-.2); round(c,-15,-8,34,20,5,'#8fa99e'); ellipse(c,19,2,7,11,'#c1cdb6',INK,2);ellipse(c,20,2,3,6,'#556d63',INK,1.8);c.restore();break;
    case 'pepe_king': crown(c,-25); line(c,[[25,28],[29,-3]],'#ddbe6e',3); drawOrange(c,29,-5,6);break;
  }
  c.restore();
}

/** Waterline portrait only: the map supplies the bath, so no tub or sticker halo. */
export function drawSoakingCapybaraArt(c:C,dizzy=false):void {
  const ink='#3a2618';c.save();c.lineJoin='round';c.lineCap='round';
  ellipse(c,0,33,44,10,'#8dcac3',ink,1.5);
  c.beginPath();c.moveTo(-30,28);c.quadraticCurveTo(-24,9,-24,-13);
  c.bezierCurveTo(-25,-43,22,-39,33,-18);c.quadraticCurveTo(46,-11,39,4);
  c.quadraticCurveTo(34,17,20,17);c.lineTo(26,29);c.quadraticCurveTo(0,40,-30,28);
  c.fillStyle='#cda172';c.fill();c.strokeStyle=ink;c.lineWidth=2.2;c.stroke();
  ellipse(c,-23,-29,6,8,'#c59b70',ink,2);ellipse(c,6,-37,5,6,'#c59b70',ink,2);
  ellipse(c,30,-6,11,17,'#d8b388',ink,1.6);ellipse(c,32,-14,2.3,1.8,ink,ink,0);
  if(dizzy){
    c.beginPath();for(let i=0;i<=40;i++){const a=i*.3,r=.3+i*.14,x=-8+Math.cos(a)*r,y=-14+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}
    c.strokeStyle=ink;c.lineWidth=2;c.stroke();line(c,[[30,6],[34,3],[38,6]],ink,1.8);
  }else{line(c,[[-14,-13],[-8,-16],[-3,-13]],ink,2.3);line(c,[[28,4],[32,7],[36,4]],ink,1.8);}
  for(const[x,y,r]of[[-32,28,3],[-25,32,4],[-18,34,3],[23,33,3],[29,30,4]])ellipse(c,x,y,r,r,'#fffdf8','#fffdf8',0);
  c.beginPath();c.ellipse(0,32,41,8,0,.1,Math.PI*.94);c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=2;c.stroke();c.restore();
}

export function drawCapybaraArt(c:C,time:number,oranges:number,fallen=false):void {
  c.save();
  if(fallen) { c.translate(3,16); c.rotate(.45); }
  // Back rim, calm face and tiny folded paws.
  ellipse(c,0,11,34,17,'#9ac8c1','#fffdf5',9); ellipse(c,0,11,34,17,'#acd7cd',INK,2.8);
  ellipse(c,-16,-27,6,7,'#bc9870',INK,2.5); ellipse(c,16,-27,6,7,'#bc9870',INK,2.5);
  outlineOval(c,0,-11,25,24,'#c7a47a');
  ellipse(c,7,-5,21,15,'#d6b88e',INK,2.5); ellipse(c,19,-9,2.4,1.9,INK,INK,0);
  eyes(c,0,-15,10,true); cheeks(c,-8,19); line(c,[[3,0],[11,1]],INK,1.8);
  ellipse(c,-18,9,8,5,'#c7a47a',INK,2); ellipse(c,17,10,8,5,'#c7a47a',INK,2);
  // Wooden tub is a real silhouette, with curved staves and two metal hoops.
  c.beginPath();c.moveTo(-34,9);c.quadraticCurveTo(-32,40,-24,41);c.quadraticCurveTo(0,48,25,41);c.quadraticCurveTo(32,38,34,9);c.quadraticCurveTo(0,28,-34,9);c.closePath();c.fillStyle='#bc956a';c.fill();c.strokeStyle='#fffdf5';c.lineWidth=8;c.stroke();c.strokeStyle=INK;c.lineWidth=2.8;c.stroke();
  [-23,-11,2,15,27].forEach(x=>line(c,[[x,19],[x*.88,40]],'#8c704f',1.8));
  c.beginPath();c.moveTo(-31,23);c.quadraticCurveTo(0,35,31,23);c.strokeStyle='#7a8b7e';c.lineWidth=5;c.stroke();
  c.beginPath();c.moveTo(-27,37);c.quadraticCurveTo(0,46,27,37);c.strokeStyle='#7a8b7e';c.lineWidth=4;c.stroke();
  ellipse(c,-7,18,5,2,'#ccead8',INK,0); ellipse(c,22,15,4,2,'#ccead8',INK,0);
  if(!fallen) {
    const count=Math.max(0,Math.floor(oranges));
    for(let i=0;i<count;i++) {
      const sway=Math.sin(time*1.5-i*.38)*(1.5+i*.8);
      drawOrange(c,sway,-44-i*16,10,Math.sin(time*1.2-i*.4)*.07*(i+1));
    }
  }
  c.restore();
  if(!fallen) {
    c.save();c.globalAlpha=.35;c.strokeStyle='#fffdf6';c.lineWidth=3;
    for(let i=0;i<2;i++){const y=-33-((time*10+i*17)%35);c.beginPath();c.moveTo(-32+i*64,y);c.bezierCurveTo(-39+i*64,y-5,-25+i*64,y-10,-32+i*64,y-16);c.stroke();} c.restore();
  }
}

export function drawEnemyArt(c:C,kind:string,time:number):void {
  c.save(); c.lineJoin='round';c.lineCap='round';
  switch(kind) {
    case 'killer_bee':
      c.save();c.rotate(Math.sin(time*22)*.12);ellipse(c,-15,-12,13,18,'#dfe8d9','#fffdf5',6);ellipse(c,15,-12,13,18,'#dfe8d9','#fffdf5',6);c.restore();
      polygon(c,[[-7,21],[0,36],[8,21]],'#a7855e',INK,2);outlineOval(c,0,3,19,25,'#d8b35d');
      line(c,[[-17,10],[17,10]],INK,6);line(c,[[-12,23],[12,23]],INK,5);eyes(c,0,-5,7);line(c,[[-13,-13],[-4,-10]],INK,2.5);line(c,[[4,-10],[13,-13]],INK,2.5);
      line(c,[[-7,-20],[-14,-31]],INK,2);line(c,[[7,-20],[14,-31]],INK,2);break;
    case 'charmed_rat':
      drawEnemyArt(c,'rat',time);
      for(const x of [-9,9]){polygon(c,[[x-5,-5],[x-2,-8],[x,-5],[x+3,-8],[x+6,-5],[x,3]],'#db91a8',INK,1);}
      c.save();c.rotate(Math.sin(time*5)*.1);polygon(c,[[-7,-28],[-11,-35],[-5,-40],[0,-35],[5,-40],[11,-35],[7,-28],[0,-22]],'#e3a0b7',PAPER,3);c.restore();break;
    case 'diva_kitty':
      // Persian fur cloud, pointed ears, pink bow and a feather fan.
      polygon(c,[[-28,-5],[-28,-31],[-13,-20],[12,-20],[28,-32],[29,-3]],'#eee2d1',PAPER,8);
      for(const [x,y] of [[-23,8],[-17,23],[0,27],[18,23],[25,8]])ellipse(c,x,y,12,11,'#eee2d1',PAPER,4);
      outlineOval(c,0,-1,26,25,'#eee2d1');ellipse(c,0,11,17,10,'#f8ebd6',INK,0);
      line(c,[[-16,-7],[-9,-4],[-3,-8]],INK,2.5);ellipse(c,10,-6,3,5,'#9caf94',INK,1.5);line(c,[[12,-11],[16,-15]],INK,1.4);
      polygon(c,[[-3,3],[3,3],[0,7]],'#d7939f',INK,1);line(c,[[0,7],[0,11],[5,13]],INK,1.5);
      polygon(c,[[-2,22],[-17,16],[-16,30],[0,25],[16,30],[17,16],[2,22]],'#dda1b6',INK,1.8);ellipse(c,0,23,4,4,'#e7bccb',INK,1);
      c.save();c.translate(29,11);c.rotate(-.35);for(let i=0;i<4;i++){c.rotate(.2);ellipse(c,0,-9,4,16,'#d9b6c6',INK,1);}c.restore();break;
    case 'buff_roo':
      // Long ears, huge red boxing gloves and a heavy, planted tail.
      c.save();c.rotate(-.2);ellipse(c,-12,-35,7,22,'#b98c60',PAPER,7);ellipse(c,11,-35,7,22,'#b98c60',PAPER,7);c.restore();
      polygon(c,[[13,16],[37,34],[11,29]],'#b98c60',PAPER,5);outlineOval(c,0,11,25,26,'#c2986b');ellipse(c,0,15,14,18,'#e4c69c',INK,1.6);ellipse(c,0,-13,18,19,'#c2986b');
      ellipse(c,7,-6,14,9,'#d9b388',INK,1.6);eyes(c,0,-17,7);line(c,[[-12,-24],[-5,-21]],INK,2);line(c,[[5,-21],[12,-24]],INK,2);
      for(const d of [-1,1]){ellipse(c,d*26,0,15,17,'#c77d70',PAPER,5);ellipse(c,d*26,0,15,17,'#c77d70',INK,2.4);round(c,d*26-10,12,20,9,3,'#e1a08b',INK,1.5);ellipse(c,d*15,31,12,7,'#a9815b',INK,2);}
      line(c,[[-7,14],[0,17],[7,14]],'#ba946c',2);break;
    case 'hornet_queen':
      for(const d of [-1,1]){ellipse(c,d*22,-3,16,24,'#dce5cc',PAPER,6);line(c,[[d*12,-15],[d*32,8]],'#a5b59c',1.6);}
      polygon(c,[[-9,27],[0,43],[9,27]],'#937d4f',INK,2);outlineOval(c,0,8,23,29,'#d9b75f');
      line(c,[[-22,9],[22,9]],INK,8);line(c,[[-17,26],[17,26]],INK,7);ellipse(c,0,-16,21,17,'#e0c475');eyes(c,0,-16,9);
      line(c,[[-16,-25],[-5,-21]],INK,2.3);line(c,[[5,-21],[16,-25]],INK,2.3);crown(c,-34);
      c.save();c.translate(24,4);c.rotate(-.3);polygon(c,[[-10,-4],[12,-14],[12,10],[-10,4]],'#e1c16e',INK,2);ellipse(c,12,-2,5,12,'#baa15f',INK,1.6);c.restore();break;
    case 'screaming_marmot':
      outlineOval(c,0,6,26,32,'#b79877');ellipse(c,-21,-20,8,8,'#b79877');ellipse(c,21,-20,8,8,'#b79877');ellipse(c,0,-8,25,23,'#b79877');
      line(c,[[-17,-17],[-8,-20],[-3,-16]],INK,2);line(c,[[3,-16],[8,-20],[17,-17]],INK,2);
      ellipse(c,0,4,13,19,'#674f4b',PAPER,3);ellipse(c,0,13,8,7,'#d99d92',INK,1);round(c,-5,-13,10,9,1,PAPER,INK,1);
      ellipse(c,-22,9,7,12,'#c6a787',INK,2);ellipse(c,22,9,7,12,'#c6a787',INK,2);ellipse(c,-13,34,11,6,'#a48767',INK,2);ellipse(c,13,34,11,6,'#a48767',INK,2);break;
    case 'trash_coon':
      animal(c,'raccoon',time);polygon(c,[[-22,-12],[-36,29],[-15,24],[0,33],[20,25],[30,30],[21,-12]],'#8d9c80',PAPER,5);
      animal(c,'raccoon',time);round(c,-28,7,23,29,4,'#829d8a',INK,2);ellipse(c,-16,7,15,5,'#bac7a7',INK,1.8);
      line(c,[[20,32],[26,-10]],'#92815e',4);ellipse(c,26,-17,11,10,'#e9dfbf',INK,2);ellipse(c,22,-18,2.5,3,'#65715f',INK,0);ellipse(c,30,-18,2.5,3,'#65715f',INK,0);line(c,[[24,-11],[24,-7],[29,-7],[29,-11]],'#e9dfbf',3);
      polygon(c,[[-27,-23],[0,-44],[27,-23]],'#889b7b',INK,2);star(c,0,-30,5,'#c8d0a3',1);break;
    case 'dj_rat_king':
      // Rat face, chunky headphones, sunglasses and two speaker towers.
      drawEnemyArt(c,'rat',time);crown(c,-28);shades(c,-3);
      for(const d of [-1,1]){round(c,d*28-9,-3,18,39,4,'#81738e',PAPER,5);round(c,d*28-9,-3,18,39,4,'#81738e',INK,2);ellipse(c,d*28,22,6,7,'#c1a7cf',INK,1.5);ellipse(c,d*28,7,4,4,'#afc6b2',INK,1.2);}
      c.beginPath();c.arc(0,-8,25,Math.PI,Math.PI*2);c.strokeStyle='#687974';c.lineWidth=6;c.stroke();round(c,-28,-13,8,18,3,'#b4bf9c',INK,1.5);round(c,20,-13,8,18,3,'#b4bf9c',INK,1.5);
      line(c,[[-13,27],[13,27]],'#e2c46c',3);ellipse(c,0,29,4,5,'#ead37b',INK,1);break;
    case 'rat':
      c.beginPath();c.moveTo(-16,12);c.bezierCurveTo(-38,25,-39,0,-27,3);c.strokeStyle='#fffdf5';c.lineWidth=8;c.stroke();c.strokeStyle='#cd9f9e';c.lineWidth=4;c.stroke();
      ellipse(c,-14,-15,10,11,'#b5a4b7','#fffdf5',6);ellipse(c,14,-15,10,11,'#b5a4b7','#fffdf5',6);ellipse(c,-14,-15,10,11,'#b5a4b7');ellipse(c,14,-15,10,11,'#b5a4b7');ellipse(c,-14,-15,5,6,'#e4b3b2',INK,0);ellipse(c,14,-15,5,6,'#e4b3b2',INK,0);
      outlineOval(c,0,4,21,20,'#b5a4b7');ellipse(c,0,10,13,10,'#e7c9bf',INK,0);eyes(c,0,-2,8);ellipse(c,0,7,3,2,'#9a737c',INK,0);round(c,-3,12,6,6,1,PAPER,INK,1);line(c,[[-12,9],[-23,6]],INK,1);line(c,[[12,9],[23,6]],INK,1);break;
    case 'roach':
      [-1,1].forEach(d=>{for(let i=0;i<3;i++)line(c,[[d*12,-7+i*11],[d*25,-12+i*13],[d*29,-8+i*14]],INK,2.6);});
      outlineOval(c,0,3,17,26,'#af8063');line(c,[[0,-17],[0,27]],'#795d4b',2);ellipse(c,0,-17,15,10,'#bd9170');eyes(c,0,-18,6);line(c,[[-7,-24],[-15,-36]],INK,2);line(c,[[7,-24],[18,-36]],INK,2);line(c,[[-10,0],[-3,8]],'#d2aa80',2);line(c,[[10,0],[3,8]],'#d2aa80',2);break;
    case 'crab':
      [-1,1].forEach(d=>{line(c,[[d*13,13],[d*27,22]],INK,3);line(c,[[d*13,6],[d*30,10]],INK,3);ellipse(c,d*25,-7,10,12,'#e99a85','#fffdf6',6);ellipse(c,d*25,-7,10,12,'#e99a85');polygon(c,[[d*21,-17],[d*25,-7],[d*31,-17]],'#fff7de',INK,1.8);});
      outlineOval(c,0,7,24,17,'#e8957d');line(c,[[-9,-5],[-11,-14]],INK,3);line(c,[[9,-5],[11,-14]],INK,3);ellipse(c,-11,-15,4,5,PAPER,INK,2);ellipse(c,11,-15,4,5,PAPER,INK,2);eyes(c,0,-15,11);smile(c,0,8);break;
    case 'husky_wrecker':
      polygon(c,[[-26,-5],[-27,-36],[-7,-22],[9,-22],[27,-36],[27,-5]],'#91a3af','#fffdf6',8);polygon(c,[[-26,-5],[-27,-36],[-7,-22],[9,-22],[27,-36],[27,-5]],'#91a3af');
      outlineOval(c,0,4,27,28,'#91a3af');polygon(c,[[-21,-8],[-7,-2],[0,-19],[7,-2],[21,-8],[16,20],[-16,20]],'#f2eee0',INK,0);ellipse(c,-11,-3,5,6,'#a2cad8',INK,1.5);ellipse(c,11,-3,5,6,'#d8b175',INK,1.5);eyes(c,0,-3,11);ellipse(c,0,9,5,3,INK,INK,0);line(c,[[-8,15],[0,19],[10,13]],INK,2);polygon(c,[[4,16],[10,14],[7,25]],'#e8a093',INK,1.5);break;
    case 'mega_roomba':
      ellipse(c,0,13,32,20,'#78898b','#fffdf6',8);ellipse(c,0,13,32,20,'#78898b');ellipse(c,0,2,33,21,'#bccac4');ellipse(c,0,-1,24,12,'#dce3d8',INK,1.8);round(c,-16,10,32,7,3,'#57666b',INK,1.7);line(c,[[-9,12],[-4,12]],'#eaa18a',2);line(c,[[5,12],[10,12]],'#eaa18a',2);round(c,-5,-11,10,8,3,'#e5a590',INK,1.8);[-1,1].forEach(d=>line(c,[[d*27,21],[d*39,26],[d*34,17]],'#8b9e90',3));break;
    case 'dr_clippers':
      c.save();c.rotate(-.14);round(c,-17,-17,34,47,9,'#b7a0bd','#fffdf6',8);round(c,-17,-17,34,47,9,'#b7a0bd');round(c,-23,-27,46,17,3,'#c9d4d0',INK,2.4);for(let i=-18;i<=18;i+=6)line(c,[[i,-28],[i,-18]],'#687e7d',2.5);round(c,-10,13,20,7,3,'#887991',INK,2);eyes(c,0,-1,7);line(c,[[-12,-7],[-5,-4]],INK,2);line(c,[[5,-4],[12,-7]],INK,2);line(c,[[-4,8],[4,8]],INK,2);c.restore();line(c,[[4,31],[12,39],[27,34]],'#877894',3);break;
    case 'box_kraken':
      for(let i=0;i<5;i++){const x=-24+i*12;c.beginPath();c.moveTo(x,12);c.quadraticCurveTo(x+Math.sin(time*3+i)*8,37,x-7,30);c.strokeStyle='#fffdf6';c.lineWidth=12;c.stroke();c.strokeStyle='#b69cad';c.lineWidth=7;c.stroke();}
      round(c,-29,-22,58,44,5,'#d9b586','#fffdf6',8);round(c,-29,-22,58,44,5,'#d9b586');polygon(c,[[-29,-22],[-9,-30],[0,-15],[-23,-9]],'#e8cda0');polygon(c,[[29,-22],[8,-30],[0,-15],[25,-9]],'#ead2a6');line(c,[[0,-15],[0,20]],'#bb9266',2);eyes(c,0,3,13);line(c,[[-17,-5],[-9,-1]],INK,2);line(c,[[9,-1],[17,-5]],INK,2);round(c,8,11,12,7,1,'#f8eacc',INK,1);break;
    case 'sad_rain_frog':
      animal(c,'frog',time);c.save();c.translate(0,-34);ellipse(c,-15,0,12,9,'#9cb3bf',INK,2);ellipse(c,0,-6,16,12,'#9cb3bf',INK,2);ellipse(c,17,0,12,9,'#9cb3bf',INK,2);round(c,-20,-1,40,11,5,'#9cb3bf',INK,0);c.restore();for(let i=0;i<3;i++){const y=-19+((time*19+i*9)%25);line(c,[[-18+i*17,y],[-20+i*17,y+5]],'#75a9be',2);}break;
    case 'king_skunk':
      c.save();c.translate(-17,-7);c.rotate(-.4);outlineOval(c,0,-4,15,30,'#626e65');ellipse(c,0,-4,5,26,'#edeed9',INK,0);c.restore();
      outlineOval(c,5,6,22,25,'#657369');ellipse(c,-7,-19,7,8,'#657369');ellipse(c,22,-19,7,8,'#657369');ellipse(c,7,-4,22,21,'#657369');polygon(c,[[1,-24],[13,-24],[10,-2],[5,4],[2,-3]],'#e6ebd3',INK,0);ellipse(c,7,8,13,10,'#d6dcc6',INK,0);eyes(c,7,-4,9);ellipse(c,7,6,4,3,INK,INK,0);line(c,[[1,14],[7,16],[13,14]],INK,1.8);break;
    default: animal(c,'hamster',time);
  }
  c.restore();
}

export function drawShovelArt(c:C,active=false,gold=false):void {
  c.save(); c.rotate(.5);
  round(c,-5,-22,10,39,4,'#bd9972',INK,2.8);
  round(c,-12,-34,24,18,7,gold?'#f4cf63':active?'#e6be69':'#b0c2ad',INK,2.8);
  round(c,-6,-29,12,8,3,'#fff8e8',INK,1.8);
  c.beginPath();c.moveTo(-16,6);c.lineTo(16,6);c.lineTo(15,23);c.quadraticCurveTo(7,34,0,38);c.quadraticCurveTo(-8,34,-15,23);c.closePath();c.fillStyle=gold?'#f4cf63':active?'#ebcb76':'#c8d4c7';c.fill();c.strokeStyle=INK;c.lineWidth=2.8;c.stroke();
  line(c,[[0,12],[0,27]],gold?'#c79b3d':'#98ac9d',2);if(gold){star(c,11,12,4,PAPER,0);star(c,-9,-30,3,PAPER,0);}c.restore();
}
