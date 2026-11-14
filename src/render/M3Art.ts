import {spriteUrl} from './AssetRegistry';
/** Inline, offline SVG stickers. Only fixed local geometry enters the markup. */
const ink='#514739',paper='#fff9eb';
const p=(d:string,fill='none',stroke=ink,width=2.4)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const e=(x:number,y:number,rx:number,ry:number,fill:string,stroke=ink,width=2.4)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const r=(x:number,y:number,w:number,h:number,fill:string,rad=4)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" fill="${fill}" stroke="${ink}" stroke-width="2.4"/>`;
const sparkle=p('M0 -7 L2 -2 7 0 2 2 0 7 -2 2 -7 0 -2 -2Z','#f3ce71');
const eyes=e(-9,-2,1.9,2.4,ink,ink,0)+e(9,-2,1.9,2.4,ink,ink,0)+p('M-4 8 Q0 12 4 8');
const crown=p('M-20 -18 L-23 -35 -10 -27 0 -39 10 -27 23 -35 20 -18Z','#efc85c')+e(0,-24,3,3,'#da8d8b');
const shades=r(-23,-9,20,12,'#596476')+r(3,-9,20,12,'#596476')+p('M-3 -4 H3 M-18 -5 L-10 -7 M8 -5 L16 -7','none','#d1e1dd',1.7);
const bamboo=p('M-5 31 L-5 -32 Q0 -36 5 -32 L5 31Z','#a4ba7a')+p('M-5 -18 H5 M-5 0 H5 M-5 18 H5','none','#6f8b57')+p('M5 -12 Q23 -28 24 -15 Q12 -9 5 -12Z','#88a36a');
const fish=p('M-24 2 Q-7 -17 20 -4 L33 -15 30 3 35 15 20 9 Q-9 27 -24 2Z','#a8c9c2')+e(-13,0,2,2,ink)+p('M-5 -4 L5 3 -5 10 M1 -5 L11 2 1 9','none','#708f8b',1.4);
function head(kind:string,color:string):string {
  const pointed=['cat','dog','corgi'].includes(kind);
  const ears=pointed?p('M-23 -8 L-25 -32 -8 -20 M8 -20 L25 -32 23 -8',color):e(-19,-19,8,9,color)+e(19,-19,8,9,color);
  const face=e(0,1,25,23,color)+e(-17,8,4,2,'#e5a191',ink,0)+e(17,8,4,2,'#e5a191',ink,0)+eyes;
  return ears+face;
}
const capy=head('capy','#c9a67a')+e(9,8,18,11,'#d9bd93')+p('M-17 -3 L-8 -1 M4 -3 L13 -1 M7 13 H15')+e(21,5,2,2,ink);
const portraits:Record<string,string>={
  capybara:e(0,22,31,12,'#acd7cd')+capy+e(0,-30,9,8,'#f6a854')+p('M1 -37 Q11 -44 14 -37 Q9 -32 1 -37Z','#8daf78')+p('M-31 24 Q-28 40 0 41 Q28 40 31 24Z','#bb966b')+p('M-18 29 V37 M0 30 V40 M18 29 V37'),
  hamster:head('hamster','#e7b77e')+e(-10,9,11,8,'#fff0cf',ink,0)+e(10,9,11,8,'#fff0cf',ink,0)+p('M-4 7 H4 V14 H-4Z',paper)+e(17,24,9,13,'#ac8152')+p('M17 14 V34','none','#e7ca99'),
  squirrel:e(-23,16,13,23,'#c58c6a')+p('M-26 0 Q-42 19 -24 31','none','#e8bd95',4)+head('squirrel','#c9926c')+p('M10 26 V12 L3 3 M10 12 L21 1','none','#89664b',4)+e(22,25,6,7,'#a77a52')+r(15,18,14,4,'#805e45'),
  bee:e(-19,-8,12,20,'#e3f0e5')+e(19,-8,12,20,'#e3f0e5')+e(0,6,20,25,'#f4d568')+p('M-19 9 H19 M-14 24 H14','none',ink,7)+eyes+p('M-7 -17 L-12 -29 M7 -17 L12 -29')+e(-12,-29,3,3,ink)+e(12,-29,3,3,ink),
  cat_swordsman:head('cat','#edb580')+p('M-29 -19 L0 -37 29 -19Z','#b9c388')+p('M-16 -26 L-8 -20 M0 -31 V-20 M16 -26 L8 -20','none','#849563',1.3)+p('M15 34 L34 0 36 -8 27 -4 8 28Z','#d3dfd8')+p('M8 19 L25 29','none','#c9a45d',4),
  doge_agent:head('dog','#dba469')+shades+p('M-24 24 L-9 17 0 31 9 17 24 24 23 39 -23 39Z','#788a83')+p('M-5 21 H5 L3 31 0 37 -3 31Z','#e6c18a'),
  goose_bully:p('M-22 25 Q-33 12 -21 0 L-4 4 -4 -21 Q-4 -34 11 -34 Q29 -34 25 -18 L10 -11 11 18 Q10 35 -22 25Z',paper)+p('M24 -25 L37 -19 24 -14Z','#edab5e')+e(13,-24,2,2,ink)+p('M-7 -21 L20 -20','none','#cc8778',4)+r(22,10,7,24,'#a67c58')+r(17,-9,21,23,'#c8d5d0'),
  kungfu_panda:head('panda',paper)+e(-10,-2,7,9,'#5e665d')+e(10,-2,7,9,'#5e665d')+e(-10,-3,2,3,paper,ink,0)+e(10,-3,2,3,paper,ink,0)+p('M-28 -20 L0 -37 28 -20Z','#b6bf84')+p('M-28 28 L28 20','none','#9baa6c',7)+p('M-15 22 V27 M3 20 V26','none','#eadc9c',2),
  rooster_star:p('M-20 15 L-34 2 -32 24 -19 29Z','#82919a')+e(0,6,23,27,'#efcb84')+e(-9,-22,6,10,'#d97d6e')+e(1,-25,6,10,'#d97d6e')+e(10,-21,5,8,'#d97d6e')+eyes+p('M-5 3 L6 3 0 10Z','#eaa65a')+p('M-13 12 L-9 30 H9 L13 12','none','#6c7879',4)+e(23,24,13,13,'#e99b5e')+p('M10 24 H36 M23 11 V37 M15 14 Q31 24 15 34','none',ink,1.5),
  frog_king:e(0,10,26,21,'#94b77a')+e(-16,-12,11,12,'#94b77a')+e(16,-12,11,12,'#94b77a')+e(-16,-12,6,7,paper)+e(16,-12,6,7,paper)+e(-15,-11,2,3,ink)+e(15,-11,2,3,ink)+p('M-18 12 Q0 22 18 12')+crown,
  market_coon:p('M-18 18 Q-42 0 -31 -13 Q-18 -15 -17 8Z','#adb1a3')+p('M-31 -9 L-19 -2 M-33 0 L-19 8','none','#69756a',5)+head('coon','#a5ada0')+p('M-24 -3 L-17 -10 0 -4 17 -10 24 -3 16 4 0 0 -16 4Z','#667368')+e(-10,-3,2,3,paper,ink,0)+e(10,-3,2,3,paper,ink,0)+r(-15,21,35,16,'#ad8a61')+p('M-10 26 H13 M-8 32 H8','none','#e5c886',2),
  salted_fish:`<g transform="rotate(-35)">${fish}</g>`+p('M-11 22 L-3 31 M-16 28 L3 9','none','#af8d5c',5)+`<g transform="translate(23 -24)">${sparkle}</g>`,
  bamboo_master:head('panda',paper)+e(-10,-2,7,8,'#677163')+e(10,-2,7,8,'#677163')+e(-10,-2,2,3,paper,ink,0)+e(10,-2,2,3,paper,ink,0)+`<g transform="translate(25 0) rotate(15)">${bamboo}</g>`+p('M-25 -22 L-3 -42 23 -22Z','#a5b775'),
  sakura_capy:capy+p('M-31 28 Q0 16 31 28 L26 40 -26 40Z','#e9b9bd')+`<g transform="translate(-20 -25)">${e(0,-6,5,7,'#efbdc7')+e(-6,0,7,5,'#efbdc7')+e(6,0,7,5,'#efbdc7')+e(0,6,5,7,'#efbdc7')+e(0,0,3,3,'#f2d18c')}</g>`+p('M24 -24 Q36 -35 29 -42','none','#b7a6b3',2),
  corgi_crown:head('corgi','#e0aa63')+p('M0 -18 L-9 11 Q0 19 9 11Z','#fff0cd',ink,0)+e(-10,9,8,6,'#fff0cd',ink,0)+e(10,9,8,6,'#fff0cd',ink,0)+crown+p('M-24 27 H24 L20 38 H-20Z','#a1c2ae')+e(-13,39,4,4,'#7b8b80')+e(13,39,4,4,'#7b8b80'),
  zen_capy:e(0,0,35,35,'#f4db93','#b69b60',2)+capy+p('M-23 24 Q0 41 23 24','none','#b5bea0',7)+`<g transform="translate(-29 -26) scale(.7)">${sparkle}</g><g transform="translate(29 -25)">${sparkle}</g>`+p('M-18 32 H18','none','#8fa487',3),
};
const handle=p('M0 10 V34','none','#ae855c',7);
const weapons:Record<string,string>={
  m01_swatter:handle+p('M-14 -30 Q0 -38 14 -30 L14 5 Q0 13 -14 5Z','#d3c6b1')+p('M-7 -29 V5 M0 -31 V8 M7 -29 V5 M-13 -19 H13 M-13 -10 H13 M-13 -1 H13','none','#948b7b',1.3),
  m02_slipper:p('M-17 25 Q-31 -1 -12 -27 Q2 -40 18 -24 L24 8 Q21 34 0 35Z','#db9e8b')+p('M-18 0 L1 -15 19 0 M1 -15 L1 9','none','#f5d7b5',6),
  m03_scratcher:p('M-4 33 V-10 L-17 -17 -16 -29 -12 -31 -9 -20 -7 -34 -2 -35 0 -21 3 -35 8 -33 7 -20 12 -30 17 -28 14 -9 4 -3 V33Z','#c9aa76'),
  m04_baguette:p('M-20 25 Q-32 15 -20 -5 L7 -31 Q18 -40 26 -28 Q30 -18 15 -3 L-5 25 Q-13 35 -20 25Z','#d7ac6e')+p('M-17 12 L-5 18 M-7 0 L5 6 M4 -12 L16 -6 M13 -24 L23 -18','none','#f9dc9e',4),
  m05_duster:handle+p('M-3 10 Q-28 0 -24 -19 Q-16 -35 -2 -23 Q9 -42 22 -27 Q34 -13 8 11Z','#b795ad')+p('M0 9 L-12 -23 M0 9 L12 -26 M-1 8 L-23 -8 M1 7 L25 -13','none','#e9d0c8',2),
  m06_stool:p('M-21 -9 L17 31 M21 -9 L-17 31','none','#947c65',7)+r(-26,-21,52,15,'#c4ae84')+p('M-17 -15 H17','none','#eed7a9',2),
  m07_rolling_pin:p('M-28 -5 H-18 M18 -5 H28','none','#a47b50',8)+r(-20,-15,40,21,'#cba36b',7)+p('M-13 -10 H12','none','#f0d1a0',3),
  m08_durian:handle+p('M-20 8 L-27 -1 -23 -9 -30 -17 -18 -22 -15 -33 -5 -29 3 -37 11 -29 22 -30 23 -19 32 -12 24 -3 25 8 13 9 5 17 -5 11Z','#b2bd78')+p('M-13 -16 L-7 -9 -1 -18 7 -11 15 -20 M-12 -1 L-4 5 4 -4 14 2','none','#748858',2),
  m09_cat_blade:p('M-27 -29 L-7 -20 17 21 10 27 -15 -10Z','#d8bd8a')+p('M27 -29 L7 -20 -17 21 -10 27 15 -10Z','#dec59a')+p('M-18 -15 L-11 -15 M-11 -4 H-4 M18 -15 H11 M11 -4 H4','none','#9f8056',2)+p('M-23 17 L-7 29 M7 29 L23 17','none','#8c7255',5),
  m10_bamboo_staff:bamboo+`<g transform="translate(-16 -15) scale(.65)">${sparkle}</g>`+p('M-5 18 Q-30 12 -25 25 Q-14 28 -5 18Z','#8fa867'),
  m11_salted_fish:`<g transform="rotate(-38)">${fish}</g>`+p('M-15 24 L-2 35 M-14 32 L-1 16','none','#b39161',6)+`<g transform="translate(20 -23)">${sparkle}</g>`,
  m12_iron_wok:p('M-8 -15 V-31 H8 V-15','none','#89958d',7)+p('M-30 -14 Q0 -22 30 -14 Q29 21 0 27 Q-29 21 -30 -14Z','#6e8078')+e(0,-12,30,11,'#a6b4a7')+p('M-18 -11 Q0 -19 18 -11','none','#e0e7d4',3),
  r01_rubber_band:p('M-20 29 V3 L-9 -2 V-27 Q-7 -35 -3 -27 L1 -4 17 -22 Q22 -25 25 -21 L14 -2 27 -10 Q34 -12 31 -5 L16 10 10 30Z','#dfbb91')+p('M-9 -21 L21 -19 13 5 -9 -21Z','none','#c68b87',3),
  r02_duck_squirt:e(-5,6,23,17,'#f2ce65')+e(11,-12,15,17,'#f2ce65')+p('M22 -14 L35 -10 22 -4Z','#e79a57')+e(15,-17,2,2,ink)+p('M-24 2 L-31 -8 -30 13Z','#f2ce65')+r(-13,17,13,16,'#9cbda7')+p('M-11 2 Q2 -3 5 8','none','#d5a550',2),
  r03_bubble_gun:r(-28,-8,46,23,'#b2c9bf')+r(-16,12,12,20,'#8da89e')+e(20,2,9,14,'#d4dfd3')+e(20,2,4,7,'#758d85')+e(32,-18,7,7,'#d4efeb','#8ab6b6',1.6)+e(14,-27,5,5,'#d4efeb','#8ab6b6',1.6),
  r04_tennis_launcher:r(-24,-10,45,32,'#91b29a')+p('M-24 -10 L-14 -27 H13 L21 -10Z','#c6d6b7')+e(-14,26,7,7,'#687c70')+e(15,26,7,7,'#687c70')+e(5,-10,14,10,'#6c8370')+e(25,-27,9,9,'#d0d879')+p('M21 -34 Q18 -27 24 -19','none',paper,1.8),
  r05_hair_dryer:p('M-8 9 L-4 32 9 30 4 7Z','#a7b8bd')+p('M-21 -17 Q3 -34 23 -17 L29 -14 V2 L19 6 Q-3 18 -22 3Z','#c6d3ce')+e(-21,-7,10,14,'#899e9c')+p('M-25 -13 L-17 -2 M-26 -5 L-19 5 M28 -8 Q40 -13 37 -23','none','#edb27b',2),
  r06_pressure_washer:p('M-24 6 L13 -15 30 -9 32 -4 1 11 -2 31 -14 29 -11 12Z','#99b7ab')+p('M-10 0 L16 -10','none','#e0ddab',4)+p('M-18 25 Q-39 30 -31 2','none','#768d88',4)+p('M31 -5 L40 -9 M30 0 L40 2','none','#9acbd0',3),
  r07_popcorn_cannon:r(-24,-22,42,47,'#d9ab7c')+r(-28,-27,50,10,'#d3bf91')+r(-27,25,48,9,'#8fa69d')+p('M-17 -15 V20 M-5 -15 V20 M7 -15 V20','none','#fbebc0',6)+e(15,-26,8,7,'#f4e1ad')+e(3,-32,7,7,'#f4e1ad')+e(-10,-28,6,6,'#f4e1ad'),
  r08_coin_slingshot:p('M0 32 V8 L-22 -21 M0 8 L23 -22','none','#a28658',9)+p('M-22 -21 Q0 -4 23 -22','none','#d49587',3)+e(0,-15,9,10,'#e6c361')+p('M0 -21 V-9','none','#ad8c46',2),
  r09_bamboo_bazooka:p('M-29 11 L13 -25 Q26 -28 31 -14 L-12 23Z','#9ab57b')+e(22,-20,11,7,'#5f7657')+p('M-17 7 L-7 19 M-3 -7 L7 5 M10 -21 L20 -9','none','#dee1a0',3)+p('M-29 11 L-38 8 -34 24 -23 20Z','#efb56d')+r(-2,19,9,14,'#7c956b'),
  r10_acorn_minigun:r(-27,-13,32,29,'#a0b4a2')+p('M0 -12 L29 -18 32 -6 2 0 M1 0 L31 -6 33 6 2 12 M0 11 L30 6 31 18 1 23Z','#b29168')+r(-18,14,11,19,'#7c9685')+e(29,-10,4,5,'#647d6d')+e(30,2,4,5,'#647d6d')+e(29,14,4,5,'#647d6d'),
  r11_sniper_laser:p('M-32 -3 H23 V8 H-6 L-16 28 H-27 L-20 8 H-32Z','#8ca79c')+r(-7,-16,24,11,'#b6c9bc')+e(18,-11,4,7,'#687e76')+p('M23 1 H37','none','#e2a195',2)+e(36,1,3,3,'#eaa18a',ink,0)+p('M-2 17 L7 29 M-2 17 L-10 31','none','#738a7d',3),
  r12_junk_mortar:p('M-17 20 L-4 4 M-17 20 L18 28','none','#bd9d56',8)+p('M-12 8 L1 -30 Q4 -38 22 -30 Q35 -23 30 -17 L8 17Z','#d6ba70')+e(15,-28,16,8,'#8d8461')+e(-19,27,9,9,'#b99e62')+e(20,29,9,9,'#b99e62')+p('M3 -8 L19 -2','none','#f5e2a1',4),
  w01_teaser:p('M-13 32 L8 -16 Q16 -36 29 -23','none','#ae8f66',4)+p('M27 -22 Q8 -33 1 -14 Q3 5 19 -3 Q35 -8 27 -22Z','#c5a2c9')+p('M9 -4 L25 -24 M14 -13 L4 -14 M18 -17 L26 -11','none','#f4dbe1',1.4),
  w02_balloon:e(0,-8,21,27,'#d6b0c9')+p('M-5 18 L0 24 5 18Z','#c08fae')+p('M0 24 Q-12 29 0 35 Q10 39 -3 42','none','#9d8395',2)+p('M-12 -21 Q-19 -14 -15 -4','none','#f8dfe5',4)+p('M28 -12 L34 -20 29 -20 35 -28','none','#e2bf65',2),
  w03_bug_zapper:handle+e(0,-13,20,23,'#a4c9bf')+e(0,-13,14,17,'#d9e3cf')+p('M-7 -26 V1 M0 -29 V4 M7 -26 V1 M-13 -20 H13 M-14 -11 H14 M-11 -2 H11','none','#839b8c',1.2)+p('M7 -23 L-4 -9 H4 L-5 4','none','#f1d078',3),
  w04_yarn_orb:e(0,0,25,25,'#b5a0cd')+p('M-20 -11 Q5 4 22 -8 M-24 0 Q0 16 23 4 M-18 15 Q0 22 20 13 M-10 -23 Q-1 -7 18 18 M2 -24 Q3 -9 24 2','none','#e3c9e3',2)+p('M-20 16 Q-37 31 -18 35 L-1 29','none','#a08bb5',3),
  w05_disco_ball:p('M0 -38 V-25','none','#8a8c91',3)+e(0,0,26,26,'#b9b6cf')+p('M-19 -18 L19 18 M-26 -3 L3 26 M-3 -26 L26 3 M19 -18 L-18 19 M26 -3 L-3 26 M3 -26 L-26 3','none','#f5e6d4',2)+`<g transform="translate(30 -25) scale(.6)">${sparkle}</g>`,
  w06_yarn_storm:e(-12,8,18,18,'#d6b0b8')+e(13,10,18,18,'#a1bda7')+e(1,-12,18,18,'#b7a3cd')+p('M-26 3 Q-11 17 2 6 M-25 13 Q-11 25 0 18 M1 3 Q15 16 29 9 M0 15 Q13 27 29 20 M-13 -18 Q1 -3 17 -14 M-15 -9 Q0 3 17 -5','none','#f8e2c4',2)+p('M-20 -25 Q0 -42 22 -23','none','#c9a5cf',2),
  w07_cat_scratch_meteor:p('M-25 6 L5 -31 20 -38 12 -14 33 -28 21 0Z','#edbd76')+p('M-24 9 Q-25 -7 -9 -7 Q9 -9 14 9 Q12 30 -9 29 Q-26 29 -24 9Z','#cfb88d')+e(-24,-8,7,9,'#cfb88d')+e(-7,-17,7,9,'#cfb88d')+e(10,-9,7,9,'#cfb88d')+p('M-18 7 L-13 22 M-9 4 L-4 22 M1 7 L5 20','none','#9d805c',2),
  w08_fortune_fish:p('M-30 9 Q-23 -19 5 -19 Q31 -17 31 9 Q8 31 -18 24Z','#b69782')+p('M-29 10 Q2 -1 30 9','none','#715c55',4)+e(-10,0,3,3,'#f3d987')+p('M10 -17 L29 -34','none','#987d64',5)+e(31,-35,7,7,'#d8b883')+p('M-4 21 Q6 7 18 17','none','#ddcaa7',2),
  w09_yin_yang_burner:p('M-22 1 L-15 28 H15 L22 1Z','#b2bda5')+e(0,0,27,9,'#d4d9b9')+p('M-12 29 L-17 35 M12 29 L17 35','none','#83937c',4)+e(0,-14,15,15,paper)+p('M0 -29 A15 15 0 0 1 0 1 A7.5 7.5 0 0 1 0 -14 A7.5 7.5 0 0 0 0 -29Z','#65766b')+e(0,-22,2,2,paper,ink,0)+e(0,-6,2,2,'#65766b',ink,0)+p('M-23 -19 Q-36 -29 -24 -36 M24 -18 Q36 -29 24 -36','none','#bca6ca',2),
  w10_cosmic_vacuum:r(-27,0,35,28,'#a598ba')+e(-18,30,6,6,'#6b697e')+e(3,30,6,6,'#6b697e')+p('M-8 0 Q-25 -25 1 -26 L24 -24','none','#857793',8)+p('M19 -33 L33 -34 36 -15 21 -14Z','#b4a6c8')+e(29,-24,8,11,'#6d5c84')+p('M28 -30 Q18 -12 32 -22','none','#dbbfdf',2)+p('M-17 10 H-5','none','#e1c88d',3),
  w11_golden_hoop_ball:e(0,4,24,24,'#e9a25d')+p('M-24 4 H24 M0 -20 V28 M-16 -14 Q10 4 -16 22 M16 -14 Q-10 4 16 22','none','#8c704b',1.8)+e(0,4,33,12,'none','#e7c15f',4)+p('M-22 -16 L-27 -30 -8 -22 1 -37 10 -22 25 -28 21 -14','none','#eebc70',4),
  w12_rain_crown_scepter:p('M0 0 V35','none','#c8ae67',7)+p('M-18 -25 L-23 -38 -8 -31 0 -43 8 -31 23 -38 18 -25Z','#efd077')+p('M-20 -22 L13 -27 26 -12 13 4 -20 -4Z','#a4b997')+e(15,-12,11,16,'#ccdab6')+e(16,-12,6,10,'#6c8e72')+p('M-31 -12 Q-34 -24 -25 -23 M30 -5 Q40 -10 33 -20','none','#90b5c3',2)+e(0,25,4,4,'#d0a2b1'),
};
function svg(id:string,art:string,size:number,fallback:number):string {
  const n=Number.isFinite(size)&&size>0?Math.min(512,Math.max(16,Math.round(size))):fallback;
  return `<svg viewBox="-48 -48 96 96" width="${n}" height="${n}" role="img" aria-label="${id}" data-sticker="${id}"><g stroke-linecap="round" stroke-linejoin="round"><path d="M-39 -26 Q-42 -42 -19 -40 L19 -41 Q42 -39 40 -18 L41 22 Q38 43 17 41 L-22 42 Q-43 38 -40 18Z" fill="${paper}" stroke="#fffdf6" stroke-width="5"/>${art}</g></svg>`;
}
function image(id:string,url:string,size:number,fallback:number):string {
  const n=Number.isFinite(size)&&size>0?Math.min(512,Math.max(16,Math.round(size))):fallback;
  return `<img src="${url.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" width="${n}" height="${n}" alt="${id}" data-sticker="${id}" style="object-fit:contain"/>`;
}
export function avatarSticker(id:string,size=64):string {const key=Object.hasOwn(portraits,id)?id:'capybara',url=spriteUrl(`avatar_${key}`);return url?image(key,url,size,64):svg(key,portraits[key],size,64);}
export function weaponSticker(id:string,size=48):string {const key=Object.hasOwn(weapons,id)?id:'m01_swatter',url=spriteUrl(`weapon_${key}`)||spriteUrl(key);return url?image(key,url,size,48):svg(key,weapons[key],size,48);}
