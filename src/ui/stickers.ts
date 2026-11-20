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
  ui_result_victory:head('#c7a57e')+r(-29,20,58,19,'#b88e57')+p('M-25 25 H25 M-16 21 V38 M16 21 V38')+p('M19 -14 H35 V-2 Q35 10 27 10 Q19 10 19 -2Z','#edc85b')+p('M27 10 V19 M20 20 H34')+orange(-10,-27),
  ui_result_defeat:head('#c8ad8e')+p('M-24 -12 Q0 -27 24 -12 L22 -24 H-22Z','#f3ead8')+r(-23,7,15,8,'#e5c09c')+p('M-18 8 L-13 14 M-13 8 L-18 14','none','#a77d60',1.4)+orange(6,27)+p('M28 26 L38 10 43 33 31 38Z','#b28b5d'),
  ui_header_pause:head('#c5a481')+p('M-21 -13 H20 V-23 H-21Z','#fff5de')+p('M-15 0 H-5 M5 0 H15')+r(-30,22,60,17,'#bd955f')+r(9,7,20,16,'#cbd5b0')+p('M29 10 Q42 8 34 20 H29 M17 4 Q11 -2 18 -9','none','#a4b8ab',3),
  ui_mvp_crown:crown+p('M-25 28 Q-48 5 -30 -15 M25 28 Q48 5 30 -15','none','#9baa61',4)+p('M-30 12 L-40 2 -30 -2 M30 12 L40 2 30 -2','none','#afbd75',4)+e(0,10,23,24,'#f0d289')+p('M0 -4 L5 6 16 8 8 16 10 28 0 22 -10 28 -8 16 -16 8 -5 6Z','#d6a24e'),
  ui_lock_closed:p('M-17 -4 V-18 Q-17 -38 0 -38 Q17 -38 17 -18 V-4','none','#d3ad64',8)+r(-25,-7,50,40,'#e5ba69',10)+e(0,12,8,7,'#9a6d3a')+e(-10,1,4,5,'#9a6d3a')+e(0,-2,4,5,'#9a6d3a')+e(10,1,4,5,'#9a6d3a'),
  ui_lock_open:p('M-16 -5 V-22 Q-16 -40 2 -39 Q20 -39 21 -20','none','#c3a578',8)+r(-25,-7,50,40,'#cfb087',10)+e(0,12,7,7,'#9b7d59')+p('M0 18 V25','none','#9b7d59',5),
  ui_wave_horn:p('M-30 10 L-5 3 22 -23 30 -17 34 23 26 27 -3 15 -30 21Z','#dfb75e')+e(29,1,8,26,'#f3cf81')+p('M-16 14 Q-14 34 -1 31 Q10 27 4 17','none','#ac793e',5)+p('M-5 17 L-11 38 1 32 8 39 8 20Z','#c87955')+p('M38 -13 L44 -20 M40 1 H47 M39 15 L45 22','none','#e7b354',3),
  ui_merge_sparkle:e(0,4,30,30,'#e8bc5e')+e(0,4,23,23,'#f7dfa1')+p('M-15 18 L-15 6 -6 6 -6 -3 -13 -3 0 -17 13 -3 6 -3 6 6 15 6 15 18Z','#b88d43')+p('M30 -32 L33 -24 41 -21 33 -18 30 -10 27 -18 19 -21 27 -24Z','#f3d77d'),
  ui_trophy_rank:p('M-20 -18 H20 V0 Q20 18 0 23 Q-20 18 -20 0Z','#e8bb57')+p('M-20 -13 H-31 Q-37 11 -16 11 M20 -13 H31 Q37 11 16 11 M0 23 V32','none','#b58a43',5)+r(-17,31,34,8,'#e4bd6e')+e(0,4,6,5,'#fff2bf')+e(-8,-4,3,4,'#fff2bf')+e(0,-7,3,4,'#fff2bf')+e(8,-4,3,4,'#fff2bf')+orange(0,-28),
  ui_map_sign:p('M-3 -33 V39','none','#b08959',7)+p('M-29 -26 H22 L34 -15 22 -4 H-29Z','#e7c187')+p('M30 1 H-22 L-34 12 -22 23 H30Z','#cba675')+p('M-21 -16 H16 M22 12 H-15','none','#957249',2)+p('M0 -32 Q-17 -47 -20 -32 Q-15 -22 0 -27Z','#91b477'),
  orange:orange(0,4),
  ui_fish_food:p('M-22 0 Q0 -22 22 0 Q0 22 -22 0 L-37 -13 V13Z','#d9a86d')+e(12,-2,2,2,ink)+p('M-4 -8 L-8 7 M4 -8 L0 8'),
  ui_bell_summon:p('M-25 17 Q-16 6 -17 -10 Q-14 -29 0 -29 Q14 -29 17 -10 Q16 6 25 17Z','#e6bc62')+e(0,18,28,7,'#f5d98e')+e(0,29,6,6,'#a27c46')+p('M0 -29 V-38','none','#87653e',5),
  ui_shop_bag:p('M-22 -16 Q-12 -5 -25 26 Q0 43 25 26 Q12 -5 22 -16Z','#bc9771')+p('M-12 -15 V-26 Q0 -40 12 -26 V-15','none','#866a4b',6)+r(-24,-16,48,14,'#ddbd8a')+p('M-8 9 H8 V24 H-8Z','#e9cd84'),
  ui_compendium_book:p('M0 -25 Q-20 -38 -35 -27 V29 Q-18 18 0 32 Q18 18 35 29 V-27 Q20 -38 0 -25Z','#e8c987')+p('M0 -25 V32 M-28 -19 Q-16 -25 -6 -18 M6 -18 Q17 -25 28 -19 M-28 -8 Q-16 -14 -6 -7 M6 -7 Q17 -14 28 -8 M-28 3 Q-16 -3 -6 4 M6 4 Q17 -3 28 3','none','#8b704c',2)+p('M20 -30 V-9 L25 -14 30 -9 V-29Z','#83ac91'),
  shovel:p('M0 -7 V-29 M-10 -29 V-39 H10 V-29Z','none','#b39a79',6)+p('M-15 -7 H15 L12 18 0 33 -12 18Z','#bbc8b9')+p('M0 0 V23','none','#e3e5cd',3),
  sprinkler:r(-28,-6,47,29,'#e9c977')+r(-15,-25,25,22,'#b4d5cf')+p('M9 -19 H27 L34 -11','none','#c8a157',5)+e(-17,24,8,8,'#798b80')+e(15,24,8,8,'#798b80')+p('M26 -3 L38 -8 M26 3 H42 M26 9 L38 15','none','#94c8d0',3),
};
Object.assign(tools,{
  ui_header_compendium:head('#d6b38c')+`<g transform="translate(0 21) scale(.75)">${tools.ui_compendium_book}</g>`,
  ui_header_armory:head('#e0c5a1')+p('M-34 28 L20 -26 31 -15 -23 39Z','#a9bbb5')+p('M-26 13 L-7 32 M-22 27 L-34 39','none','#ae7951',6),
  ui_header_market:head('#b3aa9b')+p('M-25 -5 L-5 0 -8 12 -25 7 M25 -5 L5 0 8 12 25 7Z','#5b5149')+r(-29,19,58,20,'#dfb47c')+p('M-29 20 Q-18 32 -8 20 Q4 32 15 20 Q27 32 29 20','#c87961'),
  ui_header_rank:head('#dcc19a')+p('M-23 -18 L-28 -39 -9 -29 0 -43 10 -29 29 -39 23 -18Z','#f1c65a')+orange(0,26),
  ui_header_profile:head('#c9aa88')+r(-31,12,62,29,'#f1d8ad')+e(-17,27,7,8,'#d0a675')+p('M-3 22 H22 M-3 30 H17'),
  ui_header_settings:head('#c3ae91')+e(20,22,17,17,'#b3bfae')+e(20,22,7,7,'#f7e4b9')+p('M20 1 V8 M20 36 V43 M-1 22 H6 M34 22 H41','none','#b3bfae',8),
  ui_tutorial_pointer:p('M-22 15 V-7 Q-22 -18 -13 -15 V-28 Q-13 -40 -4 -35 V-9 Q4 -21 11 -15 Q21 -18 25 -6 Q37 -6 32 8 L22 33 H-13Z','#e4c7a0')+e(4,16,9,7,'#c58e77')+e(-9,3,3,4,'#c58e77')+e(3,-1,3,4,'#c58e77')+e(16,3,3,4,'#c58e77'),
  ui_tutorial_capy:head('#d1b08a')+orange(0,-29)+p('M-17 17 Q0 28 17 17')+p('M-31 17 Q-43 5 -39 -8 M31 17 Q43 5 39 -8','none','#e6be92',7),
  ui_coin_gold:e(0,0,31,34,'#e2b04d')+e(0,-2,23,26,'#f6d77d')+p('M0 -17 L5 -5 18 -5 8 3 11 16 0 9 -11 16 -8 3 -18 -5 -5 -5Z','#e5ac43'),
  ui_star_rank:p('M0 -38 L11 -13 39 -10 18 9 23 37 0 23 -23 37 -18 9 -39 -10 -11 -13Z','#f0cc68')+e(-9,1,2,4,ink)+e(9,1,2,4,ink)+p('M-5 12 Q0 17 5 12'),
  ui_ticket_gacha:p('M-37 -22 H37 V-7 Q23 0 37 7 V22 H-37 V7 Q-23 0 -37 -7Z','#edc393')+p('M-18 -20 V20','none','#b78b60',2)+p('M9 -13 L13 -4 23 -3 16 4 18 14 9 9 0 14 2 4 -5 -3 5 -4Z','#c78571'),
  ui_skull_threat:p('M-26 6 Q-38 -25 -13 -34 Q13 -42 28 -17 Q36 2 21 15 V31 H-20 V15Z','#f8ecd2')+e(-13,-3,8,10,'#7a6553')+e(13,-3,8,10,'#7a6553')+p('M0 6 L-5 15 H5Z','#7a6553')+p('M-11 25 V33 M0 25 V33 M11 25 V33'),
});
export const P10_SCENE_IDS=['capybara_soak','capybara_soak_dizzy','ui_compendium_peek_capy','ui_storybook_check'] as const;
export const P11_SCENE_IDS=['ui_armory_peek_capy','ui_market_peek_raccoon','ui_rank_peek_capy','ui_profile_peek_capy'] as const;
export const P12_SCENE_IDS=['ui_victory_shield_wings','ui_defeat_shield_wings','ui_victory_star_lit','ui_victory_star_dim','ui_pause_peek_capy','ui_btn_return_arrow','ui_stats_scroll','ui_horn_continue'] as const;
export const P13_SCENE_IDS=['ui_endless_emblem','ui_stat_damage_burst','ui_stat_ko_skull','ui_passive_aura_badge'] as const;
Object.assign(tools,{
 ui_endless_emblem:p('M-34 24 Q-47 0 -28 -28 Q-22 -4 -12 -37 Q2 -48 12 -31 Q28 -42 34 -16 Q45 9 30 31Z','#e79c3f','#70421e',3)+p('M0 3 C-37 -36 -45 35 -14 25 C9 20 12 -22 32 -16 C56 -7 30 48 0 3','none','#fff1b5',9)+`<g transform="translate(0 24) scale(.48)">${head('#cba576')}</g>`,
 ui_stat_damage_burst:p('M-38 19 L-22 6 -35 -7 -12 -9 -14 -32 5 -18 24 -38 24 -12 43 -2 25 10 34 34 10 23 -5 41 -13 22Z','#f4b64d','#804a24',3)+p('M-23 25 L15 -30 28 -35 30 -20 -14 31Z','#f7e9c7','#684b37',3)+p('M-26 13 L-6 30 M-23 27 L-32 39','none','#a56939',6),
 ui_stat_ko_skull:tools.ui_skull_threat+p('M-25 -4 Q-31 -38 0 -39 Q30 -35 27 -5 L7 -13 0 -2 -7 -13Z','#aebcc0','#5e5a51',3)+p('M-36 -31 L-31 -42 -27 -34 -17 -34 -24 -27 -22 -18 -31 -23 -39 -18 -37 -27 -45 -32Z','#f4c259','#805229',2),
 ui_passive_aura_badge:p('M-20 -21 Q0 -38 21 -20 L27 16 0 32 -27 16Z','#81b29b','#496c59',3)+p('M-15 -17 Q0 -29 15 -17 L20 12 0 23 -20 12Z','#c5e1c2','#668a6d',2)+p('M-13 28 L-18 44 M0 32 V47 M13 28 L18 44','none','#cfb278',5)+p('M-6 -28 Q-20 -47 -26 -35 Q-29 -22 -6 -28 Q20 -47 25 -35 Q29 -22 -6 -28','none','#aa794a',4),
});
const peekBody=p('M-30 48 Q-34 28 -27 6 Q-39 -12 -25 -14 L-18 -7 Q1 -24 22 -5 Q39 -10 37 6 Q41 30 28 48Z','#d0a67e','#462e27')+p('M22 4 Q38 0 37 20 Q31 27 24 20 M-13 9 Q-8 4 -3 9 M2 25 Q8 30 13 25','none','#462e27',2.5)+e(-18,20,4,2,'#dfaa9d');
const peekPaws=p('M-44 49 H44','none','#462e27',2)+p('M-26 49 Q-34 35 -23 35 Q-12 36 -14 49Z M17 49 Q13 35 25 35 Q36 37 29 49Z','#dfb98e','#462e27',2);
const shield=(loss:boolean)=>p('M-20 -17 Q-35 -17 -46 -37 Q-49 -6 -28 6 L-41 6 Q-35 22 -20 18 M20 -17 Q35 -17 46 -37 Q49 -6 28 6 L41 6 Q35 22 20 18',loss?'#bdc7d2':'#fffbed','#513c31',1.5)+p('M0 -35 L25 -25 22 15 Q16 30 0 41 Q-16 30 -22 15 L-25 -25Z',loss?'#ad8c6c':'#e9bd65','#583b27',2)+p('M0 -28 L19 -20 16 14 Q11 25 0 32 Q-11 25 -16 14 L-19 -20Z',loss?'#71696b':'#4d5361','#ffe7a1',1.3)+p('M-34 -14 Q0 -27 34 -14 L31 0 Q0 -8 -31 0Z',loss?'#96858f':'#b54728','#edc977',1.8);
const victoryStar=(dim:boolean)=>p('M0 -39 L12 -14 40 -10 20 10 25 38 0 25 -25 38 -20 10 -40 -10 -12 -14Z',dim?'#91857b':'#f6ca51',dim?'#4f433d':'#a36a24',3)+p('M0 -30 L9 -10 29 -7 14 8 18 28 0 18 -18 28 -14 8 -29 -7 -9 -10Z',dim?'#a79b8c':'#ffe982',dim?'#c4b8a5':'#fff2a9',1.7);
Object.assign(tools,{
 ui_victory_shield_wings:shield(false)+orange(0,-29),
 ui_defeat_shield_wings:shield(true)+`<g transform="rotate(-24)">${r(-24,-27,21,8,'#e8c6a8',3)}${p('M-17 -25 L-12 -21 M-12 -25 L-17 -21','none','#967355',1)}</g>`,
 ui_victory_star_lit:victoryStar(false),ui_victory_star_dim:victoryStar(true),
 ui_pause_peek_capy:peekBody+p('M-22 -5 Q0 1 22 -8 L19 -23 Q1 -17 -19 -22Z','#fffaf0','#462e27',2)+p('M-14 -13 Q0 -9 14 -15 M0 12 Q5 16 10 12','none','#695046',2)+peekPaws,
 ui_btn_return_arrow:p('M-8 -35 L-38 -9 -8 15 V3 Q23 0 25 17 Q27 34 -3 34 H-25 V43 H3 Q43 41 40 12 Q38 -13 -8 -15Z','#b9e1e0','#577b80',2.7)+p('M-25 -8 L-10 -22 M-3 -7 Q25 -9 30 10','none','#efffff',4),
 ui_stats_scroll:p('M-27 -34 Q-36 -42 -39 -31 L-37 -19 H-25 L-21 27 Q-30 39 -15 42 H27 Q41 37 32 24 H20 L24 -28 Q33 -42 19 -42 H-22Z','#f4dfb3','#70503b',2.6)+p('M-22 -19 H14 M-18 -9 H10 M-16 1 H12 M-12 11 H8','none','#9b7656',2)+p('M-19 23 L10 18 14 26 -16 31Z','#b95c49','#63372d',1.6),
 ui_horn_continue:tools.ui_wave_horn,
});
Object.assign(tools,{
 ui_armory_peek_capy:peekBody+p('M-22 -3 Q-2 -20 20 -3','none','#97663b',5)+e(-8,-7,10,9,'#d9b270')+e(12,-8,10,9,'#d9b270')+e(-8,-7,6,6,'#c6d7cc')+e(12,-8,6,6,'#c6d7cc')+peekPaws,
 ui_market_peek_raccoon:p('M-31 47 Q-35 23 -24 4 L-30 -15 -10 -7 Q0 -12 11 -7 L29 -15 24 4 Q36 24 30 47Z','#aea59a','#462e27')+p('M-24 9 L-13 2 0 7 13 2 24 9 15 21 0 14 -15 21Z','#6f6258','#462e27',1)+e(-11,11,9,8,'#e3d9c8')+e(11,11,9,8,'#e3d9c8')+e(-11,11,2,3,'#462e27')+e(11,11,2,3,'#462e27')+p('M-3 24 H3 L0 28Z','#462e27')+p('M-19 -8 L-16 -28 H17 L21 -8Z','#b5b6ad','#462e27')+p('M-20 -8 H24 M17 -25 H32 V-17 H20','none','#462e27',3)+peekPaws,
 ui_rank_peek_capy:peekBody+p('M-27 -3 Q-12 -26 11 -12','none','#b69b52',4)+p('M-23 -7 L-30 -17 -17 -13 M-14 -17 L-17 -28 -5 -21 M-1 -17 L5 -28 8 -15','#b8ad6c','#73643f',1.5)+p('M10 -13 L13 -23 18 -16 27 -17 22 -9 25 -1 16 -4 9 2 10 -7 4 -12Z','#eed28d','#7a582e',2)+peekPaws,
 ui_profile_peek_capy:peekBody+`<g transform="translate(-17 -6)">${[0,72,144,216,288].map(a=>`<g transform="rotate(${a})">${e(0,-8,6,9,'#e8b8bd')}</g>`).join('')}${e(0,0,4,4,'#f6d99f')}</g>`+peekPaws,
});
const soakingBody=p('M-29 28 Q-21 11 -23 -10 Q-25 -36 6 -34 Q26 -33 34 -17 Q46 -11 38 6 Q31 17 18 16 L26 29 Q0 39 -29 28Z','#cda172','#3a2618')+p('M-22 -25 Q-37 -44 -27 -42 Q-15 -41 -15 -29 M2 -34 Q1 -45 9 -44 Q16 -43 16 -32','#c59b70','#3a2618')+p('M28 -13 Q39 -17 38 4 Q34 13 25 6','#d8b388','#3a2618');
const soakingWater=p('M-38 26 Q-47 38 -5 40 Q36 44 43 27','none','#88c7c0',5)+p('M-39 28 Q-31 44 34 35','none','#fffdf8',2)+p('M-34 28 Q-39 17 -32 21 Q-26 15 -24 25 Q-17 22 -17 31 M25 30 Q26 20 31 25 Q37 18 37 28','#fffdf8','#fffdf8',1);
Object.assign(tools,{
 capybara_soak:soakingBody+p('M-12 -13 Q-6 -19 0 -13 M28 0 Q33 7 37 1','none','#3a2618',3)+soakingWater,
 capybara_soak_dizzy:soakingBody+p('M-4 -12 Q-1 -20 -10 -20 Q-19 -18 -14 -9 Q-8 -4 -4 -11 Q-3 -16 -9 -16 Q-12 -15 -10 -12 M27 6 L32 2 36 6','none','#3a2618',2.4)+soakingWater+p('M40 12 Q49 9 47 17 Q45 20 40 12Z','#b9e0da','#3a2618',1),
 ui_compendium_peek_capy:p('M-30 31 Q-36 14 -27 -4 Q-41 -20 -26 -23 L-19 -16 Q0 -31 22 -13 Q39 -19 36 -4 Q42 13 29 30Z','#cfa779','#462e27')+p('M0 -23 Q-15 -37 -12 -43 Q6 -43 1 -26 Q9 -40 23 -39 Q25 -23 1 -23Z','#a4bd83','#462e27',2)+p('M-15 4 Q-10 -2 -5 4 M10 4 Q15 -2 20 4 M0 16 Q6 22 11 16','none','#462e27',2.5)+e(-19,13,4,2,'#e2a18f')+e(24,13,4,2,'#e2a18f')+p('M-44 38 H44','none','#462e27',3)+p('M-25 38 Q-34 24 -22 24 Q-12 25 -13 38Z M16 38 Q13 24 25 24 Q36 26 29 38Z','#dcb58b','#462e27',2),
 ui_storybook_check:p('M-31 4 Q-25 -5 -17 12 L-10 22 Q4 -6 34 -30 L40 -28 Q9 3 -4 33 Q-7 39 -14 33Z','#4a322b','#4a322b',1),
});
export const P14_SCENE_IDS=['ui_kitchen_peek_capy','ui_kitchen_pot','ing_yuzu','ing_bamboo','ing_honey','ing_chili','ing_sakura','ing_mushroom',
 'dish_yuzu_bath','dish_bamboo_broth','dish_honey_osmanthus','dish_ginger_soak','dish_spicy_hotpot','dish_sakura_milk',
 'dish_matcha_tea','dish_herbal_tonic','dish_truffle_ramen','dish_chill_melon','dish_golden_feast','dish_imperial_onsen'] as const;
// P14 Onsen Kitchen: borderless hand-inked vectors that stand in until each PNG decodes.
const cocoa='#4a2c20';
const steam=(x:number,color='#f7ead7')=>p(`M${x} -22 Q${x-7} -30 ${x} -37 Q${x+7} -44 ${x} -50`,'none',color,3.5);
const flower=(x:number,y:number,size:number,fill='#f6c3cf')=>`<g transform="translate(${x} ${y}) scale(${size})">${[0,72,144,216,288].map(a=>`<g transform="rotate(${a})">${p('M0 0 Q-7 -9 -3 -15 L0 -12 3 -15 Q7 -9 0 0Z',fill,'#a85f6f',1.4)}</g>`).join('')}${e(0,0,2.6,2.6,'#f2c35c')}</g>`;
const citrus=(x:number,y:number,rx:number,ry:number)=>e(x,y,rx,ry,'#fbe57a')+e(x,y,rx*.72,ry*.72,'#fff4b8')+p(`M${x-rx*.6} ${y} H${x+rx*.6} M${x} ${y-ry*.6} V${y+ry*.6}`,'none','#e5b638',1.4);
const bowl=(body:string,rim:string,soup:string,garnish:string,foot='#d9c4a8')=>
 e(0,33,20,5,foot)+p('M-41 -4 Q-39 30 0 33 Q39 30 41 -4Z',body,cocoa,2.6)+e(0,-4,41,11,rim)+e(0,-5,35,7.5,soup)+garnish;
Object.assign(tools,{
 ui_kitchen_peek_capy:peekBody+p('M-24 -10 Q-34 -22 -24 -31 Q-20 -44 -6 -39 Q2 -50 13 -40 Q27 -44 26 -29 Q35 -20 24 -10Z','#fffbf2','#462e27',2.4)+p('M-23 -11 H23 L22 -4 Q0 1 -22 -4Z','#f1e6d2','#462e27',2)+p('M-10 -27 Q-6 -22 -1 -27 M7 -32 Q11 -27 14 -31','none','#cdbfa9',2)+p('M32 -26 L38 32','none','#9a6a3d',4.5)+e(31,-31,7,9,'#c99158')+e(31,-31,4,5,'#e2b37c')+p('M-22 46 Q0 52 22 46 L19 38 Q0 45 -19 38Z','#c0563f','#462e27',1.6)+p('M-3 43 L-9 52 -1 50Z','#a8452f','#462e27',1.2)+peekPaws,
 ui_kitchen_pot:steam(-12)+steam(12)+p('M-44 0 Q-52 2 -48 10 Q-45 13 -39 9 M44 0 Q52 2 48 10 Q45 13 39 9','#8d4f33',cocoa,2.4)+p('M-40 -2 Q-40 30 0 33 Q40 30 40 -2Z','#9b5a3b',cocoa,2.8)+p('M-35 12 Q0 22 35 12','none','#7c4329',2)+e(0,-2,40,10,'#b86f47')+e(0,-3,33,7,'#f0a13a')+citrus(-9,-4,8,4)+p('M8 -6 L14 -10 18 -5 12 -2Z','#7fb35c','#3f6a33',1.4)+p('M16 -8 L34 -38','none','#a46c3c',4.5)+e(35,-41,5,6,'#c18a52'),
 ing_yuzu:p('M2 -30 Q6 -40 13 -44','none','#7a5130',4)+p('M4 -33 Q-14 -50 -30 -36 Q-12 -24 4 -33Z','#79b24a','#3c6a2a',2.2)+p('M-24 -38 Q-10 -34 2 -33','none','#3c6a2a',1.4)+e(0,6,34,32,'#f5c63a')+e(-10,-6,10,8,'#fbe28a')+e(14,18,2,2,'#d79a24')+e(-14,22,1.8,1.8,'#d79a24')+e(20,-2,1.6,1.6,'#d79a24'),
 ing_bamboo:p('M0 40 Q-30 34 -24 4 Q-18 -24 0 -44 Q18 -24 24 4 Q30 34 0 40Z','#d8b27c','#6d4a2b',2.6)+p('M-24 8 Q-6 -2 4 -40 M24 8 Q6 -2 -4 -40','none','#b48654',2)+p('M-22 22 Q0 10 22 22 M-26 34 Q0 22 26 34','#c79a63','#6d4a2b',1.8)+p('M-6 -40 Q0 -54 6 -40 Q4 -28 0 -26 Q-4 -28 -6 -40Z','#b8d68a','#4f7a37',1.8),
 ing_honey:p('M-26 -20 Q-28 32 0 35 Q28 32 26 -20Z','#f0a52f','#7a4a1f',2.6)+e(-10,4,6,14,'#fbd27a')+r(-26,-30,52,12,'#f6e7c8',4)+p('M-28 -26 Q-34 -18 -28 -12 M28 -26 Q34 -18 28 -12','none','#c9a66c',2)+p('M-10 -24 Q0 -31 10 -24','none','#b4552e',2.2)+p('M18 22 L44 40','none','#a8743f',4)+e(16,20,6,5,'#e9b25a')+p('M11 17 L21 23 M12 21 L20 18','none','#a8743f',1.6),
 ing_chili:p('M-30 30 Q-40 0 -10 -22 Q0 -26 2 -18 Q-20 0 -22 28 Q-24 36 -30 30Z','#e0412f','#7a1f16',2.4)+p('M-8 32 Q4 0 24 -20 Q32 -24 32 -15 Q16 4 4 34 Q-2 40 -8 32Z','#ea5536','#7a1f16',2.4)+p('M-10 -22 Q-8 -34 2 -38 M26 -18 Q30 -30 40 -32','none','#4f7a37',4)+p('M-12 -24 L-2 -18 M24 -20 L32 -14','none','#4f7a37',5)+e(-24,4,2.5,5,'#ff9c7f')+e(10,6,2.5,5,'#ff9c7f'),
 ing_sakura:flower(-6,-4,2,'#f7c6d2')+flower(22,-26,1.1,'#fbd8e0')+p('M18 18 Q30 10 34 22 Q26 30 18 18Z','#f9cdd7','#a85f6f',1.6)+p('M-36 24 Q-26 18 -22 30 Q-30 36 -36 24Z','#f9cdd7','#a85f6f',1.6),
 ing_mushroom:p('M-8 6 Q-10 30 -4 36 H10 Q14 30 10 6Z','#efe2c8','#6b4a2f',2.4)+p('M-36 8 Q-38 -30 2 -32 Q38 -28 36 8 Q0 18 -36 8Z','#8a5a37','#4b2e1c',2.6)+p('M-10 -14 L12 -2 M12 -14 L-10 -2','none','#efe2c8',3.5)+e(28,26,12,10,'#5b3a26')+e(26,24,4,3,'#7a5238')+e(-28,28,9,8,'#6a4530')+p('M34 8 Q40 -4 44 -10','none','#6f9a4c',2.2),
 dish_yuzu_bath:steam(-14,'#fff3b8')+steam(14,'#fff3b8')+p('M-40 -6 L-36 30 Q0 36 36 30 L40 -6Z','#d9a868',cocoa,2.6)+p('M-26 -4 L-24 32 M-8 -4 V34 M10 -4 V34 M26 -4 L24 32','none','#b07c43',2)+p('M-39 6 Q0 14 39 6 M-37 22 Q0 30 37 22','none','#8e5d30',3)+e(0,-6,40,10,'#e4b878')+e(0,-7,34,7,'#f6c84c')+citrus(-12,-7,8,4)+citrus(12,-6,8,4)+p('M0 -10 L4 -14 8 -10 4 -8Z','#7fb35c','#3f6a33',1.2),
 dish_bamboo_broth:bowl('#a87e5d','#c9a27f','#f2ead8',p('M-18 -8 Q-12 -14 -4 -8 Q-12 -4 -18 -8Z M2 -6 Q8 -12 16 -6 Q8 -2 2 -6Z','#efe2b0','#9a7a3c',1.4)+e(-4,-2,2.5,2,'#7fb35c')+e(6,-1,2.5,2,'#7fb35c')+e(20,-3,2.5,2,'#7fb35c')+p('M14 -8 L34 -32','none','#a46c3c',4)+e(35,-35,5,5,'#c18a52')),
 dish_honey_osmanthus:bowl('#f4e3c2','#fbf1dc','#f5b249',p('M-14 -5 Q-4 -12 6 -6 Q14 -1 4 -2 Q-6 -3 -2 -7','none','#fbe08a',2.2)+e(-22,-6,2,2,'#fff1a8')+e(18,-8,2,2,'#fff1a8')+e(10,-2,1.6,1.6,'#fff1a8')+e(-8,0,1.6,1.6,'#fff1a8')),
 dish_ginger_soak:steam(0,'#fce0ba')+bowl('#c4643c','#d97a4c','#e69f52',p('M-28 -16 L-16 4 M24 -18 L14 4','none','#8d5228',5)+e(-6,-4,6,3.5,'#f4d27e')+e(8,-6,6,3.5,'#f4d27e')+e(0,-1,5,3,'#f4d27e'),'#b9785a'),
 dish_spicy_hotpot:steam(-12,'#ffc3b2')+steam(14,'#ffc3b2')+p('M-48 0 H-40 M40 0 H48','none','#9a5a2f',6)+bowl('#c97a45','#dc8f57','#e25b45',p('M-22 -6 Q-12 -14 -6 -4','none','#a3241a',4)+p('M8 -8 L12 -2 18 -6 14 -10Z','#7a3a1d','#4a2010',1.2)+r(-2,-10,9,7,'#fbf2e0',1.5)+e(22,-4,3,2,'#f2b04a'),'#a65f34'),
 dish_sakura_milk:bowl('#fbf7f2','#ffffff','#f8bbd0',flower(-12,-6,.75,'#ffe1ea')+flower(10,-7,.65,'#ffe1ea')+p('M-2 -2 Q4 -6 10 -2','none','#fff5f8',2),'#ead9cf'),
 dish_matcha_tea:p('M8 -24 L22 -44 M14 -22 L26 -40 M20 -20 L30 -36','none','#c2a35e',2.4)+r(16,-48,12,6,'#d7b876',2)+bowl('#a69a86','#bdb19c','#7cb369',e(-12,-6,6,2.5,'#a8d690')+e(8,-4,5,2,'#a8d690')+e(-22,10,1.5,1.5,'#7a6e5c')+e(14,16,1.5,1.5,'#7a6e5c')+e(-4,22,1.5,1.5,'#7a6e5c'),'#8f846f'),
 dish_herbal_tonic:bowl('#95ad8a','#aac39e','#84b88e',e(-10,-6,7,4,'#f1e2c4')+e(-10,-6,2,1.2,'#b99a6a')+e(8,-4,2.5,2,'#d1453a')+e(16,-7,2.5,2,'#d1453a')+e(0,-2,2.5,2,'#d1453a')+p('M-26 -8 Q-20 -16 -14 -8 Q-20 -4 -26 -8Z M18 -4 Q26 -12 32 -4 Q26 0 18 -4Z','#5f9a4c','#2f5a2a',1.2)),
 dish_truffle_ramen:p('M14 -14 L22 -40 L34 -36 L26 -10Z','#2f4a3a','#18261d',2)+bowl('#2f4f7d','#e8e1d0','#c98d52',p('M-30 -6 Q-20 -10 -10 -6 Q0 -2 10 -6 Q20 -10 30 -6','none','#f3d38a',2.4)+e(-14,-6,7,5,'#fff8e8')+e(-14,-6,4,3,'#f2b33a')+e(6,-8,6,4,'#fbe7ef')+p('M3 -8 Q6 -11 9 -8','none','#e07a9a',1.4)+e(-2,-3,4,3,'#5a3b26'),'#24395a'),
 dish_chill_melon:p('M-40 -4 Q-44 14 -34 22 Q-30 34 -16 32 Q-8 40 0 36 Q8 40 16 32 Q30 34 34 22 Q44 14 40 -4Z','#9bd8a8','#2f6a4a',2.6)+p('M-22 0 Q-24 20 -16 30 M0 2 V34 M22 0 Q24 20 16 30','none','#6fbf86',2)+e(0,-4,40,10,'#b9ebc4')+e(0,-5,34,7,'#7fd3c2')+e(-12,-5,4.5,4,'#effcf6')+e(4,-3,4.5,4,'#effcf6')+e(16,-6,4,3.5,'#effcf6')+p('M-4 -10 Q2 -18 8 -10 Q2 -6 -4 -10Z','#5f9a4c','#2f5a2a',1.2),
 dish_golden_feast:p('M-38 -26 Q-30 -34 -20 -26 Q-30 -22 -38 -26Z','#7fb35c','#3f6a33',1.4)+bowl('#c8352c','#e9c25a','#f4c144',p('M-20 -8 Q-12 -18 -2 -10 Q-10 -6 -20 -8Z','#f08a5a','#8a3a20',1.4)+r(6,-11,8,10,'#f6d34a',2)+p('M7 -8 H13 M7 -4 H13','none','#c99b25',1)+e(20,-6,6,3.5,'#e8e2d2')+e(-24,-2,5,3,'#e8e2d2'),'#9a2a22'),
 dish_imperial_onsen:p('M-32 -34 L-30 -28 -24 -26 -30 -24 -32 -18 -34 -24 -40 -26 -34 -28Z M34 -40 L36 -35 41 -33 36 -31 34 -26 32 -31 27 -33 32 -35Z','#f6d063','#a3732a',1.2)+bowl('#fffaf0','#e7c65a','#ffe07d',citrus(-12,-6,7,3.5)+flower(10,-8,.55,'#f7c6d2')+p('M0 -2 Q8 0 18 -4 M8 -1 L4 4 M14 -3 L16 3','none','#c8955a',2.2)+e(-22,-3,2,1.6,'#d1453a')+e(-2,-1,2,1.6,'#d1453a'),'#d9b45a')+p('M-38 8 Q0 18 38 8','none','#d9b45a',2),
});
export const P15_SCENE_IDS=['ui_weapon_fragment','ui_rank_protect_shield','ui_streak_flame','ui_clock_sand'] as const;
// P15 settlement icons: big, readable, borderless stand-ins until the PNGs decode.
Object.assign(tools,{
 ui_weapon_fragment:p('M24 -34 L33 -37 30 -27 -6 9 -2 13 -8 19 -12 15 -17 20 -21 13 -26 9 -19 5 -24 0 -17 -3 -13 1Z','#a9e3e0','#3a2618',2.6)+p('M20 -28 L-12 4','none','#f2c14e',2.6)+p('M29 -34 L-4 -1','none','#ffffff',1.6)+e(-24,26,13,13,'#f2b739')+p('M-30 21 L-18 33','none','#b9824e',3.4)+r(-33,15,12,8,'#9aa7b0',2)+p('M33 -14 L35 -10 39 -9 35 -7 33 -3 31 -7 27 -9 31 -10Z','#fff3b0','#3a2618',1.4),
 ui_rank_protect_shield:p('M0 -38 Q16 -30 31 -30 Q33 4 0 38 Q-33 4 -31 -30 Q-16 -30 0 -38Z','#f2c14e','#3a2618',3)+p('M0 -29 Q12 -23 23 -23 Q24 2 0 28 Q-24 2 -23 -23 Q-12 -23 0 -29Z','#a9ddf5','#3a2618',2)+p('M0 -15 L4.5 -5.5 15 -4.5 7 2.5 9.5 13 0 7.5 -9.5 13 -7 2.5 -15 -4.5 -4.5 -5.5Z','#ffe27a','#3a2618',2),
 ui_streak_flame:p('M0 36 C-26 35 -32 8 -14 -10 Q-12 2 -4 4 C-10 -16 0 -30 10 -38 Q6 -20 15 -12 Q19 -18 18 -25 C35 -6 30 36 0 36Z','#f39a2e','#3a2618',3)+p('M0 32 C-12 31 -15 18 -6 8 Q-4 15 1 16 C-2 6 4 -2 8 -6 Q8 6 12 10 C18 18 12 32 0 32Z','#ffd45c','none',0)+p('M-33 -26 L-30 -19 -22 -18 -28 -13 -26 -5 -33 -9 -40 -5 -38 -13 -44 -18 -36 -19Z','#f2c14e','#3a2618',1.8)+p('M33 -34 L35 -29 41 -28 37 -24 38 -18 33 -21 28 -18 29 -24 25 -28 31 -29Z','#f2c14e','#3a2618',1.8),
 ui_clock_sand:r(-27,-36,54,9,'#c98f55',4)+r(-27,27,54,9,'#c98f55',4)+r(-25,-28,6,56,'#a8733f',3)+r(19,-28,6,56,'#a8733f',3)+p('M-14 -27 C-14 -9 -3 -6 -3 0 C-3 6 -14 9 -14 27 L14 27 C14 9 3 6 3 0 C3 -6 14 -9 14 -27Z','#eef8fa','#3a2618',2.2)+p('M-10 -18 Q0 -14 10 -18 C8 -10 2 -7 0 -2 C-2 -7 -8 -10 -10 -18Z','#f2c14e','none',0)+p('M-13 26 Q0 10 13 26Z','#f2b739','none',0)+p('M0 -2 V20','none','#f2b739',1.6),
});
export const P16_SCENE_IDS=['bg_onsen_village','fac_bamboo_pool','fac_fish_stall','fac_yuzu_tree','fac_cat_nap','fac_sakura_pavilion','ui_village_peek_capy','ui_village_gate','ui_harvest_basket','res_onsen_wood','res_yuzu_essence','ui_pet_heart','ui_sleep_zzz'] as const;
// P16 Onsen Village: borderless stand-ins until each PNG decodes.
Object.assign(tools,{
 bg_onsen_village:r(-46,-27,92,54,'#a9cc80',4)+p('M0 27 V2 M0 2 H-28 M0 2 H28 M0 -8 H-26 M0 -8 H26','none','#e9d5aa',4)+e(0,-9,13,6,'#d9d3c6')+e(-26,-9,10,5,'#9a6d48')+e(26,-9,11,5,'#d9a36a')+e(-24,13,12,5,'#c9e39c')+e(24,13,11,5,'#bdb7ab')+p('M-46 -21 H46','none','#a8733f',3),
 fac_bamboo_pool:p('M-30 8 V-34 M-22 8 V-40 M24 8 V-32','none','#6fa94f',5)+e(0,14,34,16,'#bdb7ab')+e(0,12,25,10,'#8ed9d2')+p('M-8 2 Q-12 -10 -8 -18 M6 0 Q2 -14 6 -24','none','#ffffff',2.4),
 fac_fish_stall:r(-28,4,56,20,'#d9a36a',4)+e(-17,27,7,7,'#8a5a3a')+e(17,27,7,7,'#8a5a3a')+p('M-32 -14 L-24 -28 H24 L32 -14Z','#d9543a','#3a2618',2.5)+p('M-22 -2 Q-14 -8 -6 -2 Q-14 4 -22 -2Z M2 -2 Q10 -8 18 -2 Q10 4 2 -2Z','#f2b45a','#3a2618',2)+e(31,-4,5,7,'#f27a4a'),
 fac_yuzu_tree:e(0,26,26,8,'#8a6040')+p('M-4 26 Q-2 8 -6 -4 H6 Q2 8 4 26Z','#a8733f','#3a2618',2.5)+e(0,-16,28,22,'#7db356')+e(-11,-12,5,5,'#f6c84c')+e(9,-20,5,5,'#f6c84c')+e(6,-4,5,5,'#f6c84c'),
 fac_cat_nap:r(-30,24,48,7,'#c98f55',3)+r(-22,-22,7,46,'#e9d3a8',3)+r(4,-4,7,28,'#e9d3a8',3)+e(-18,-24,15,5,'#f2b38f')+e(8,-6,13,5,'#f2b38f')+e(26,24,16,8,'#f8c9a8')+e(-36,28,6,6,'#f4a6b8'),
 fac_sakura_pavilion:r(-30,22,60,8,'#c9c3b7',3)+p('M-22 22 V-6 M22 22 V-6','none','#8a5a3a',4)+p('M-38 -6 Q-20 -10 -16 -20 Q0 -32 16 -20 Q20 -10 38 -6Z','#6f5a4e','#3a2618',2.5)+e(0,14,9,3,'#7cb369')+e(-34,-32,6,6,'#ffe0e6')+e(-24,-36,5,5,'#ffe0e6')+e(-28,-26,4,4,'#ffe0e6'),
 ui_village_peek_capy:peekBody+p('M-30 -12 Q0 -22 30 -12 Q24 -6 0 -6 Q-24 -6 -30 -12Z','#e2b866','#462e27',2)+p('M-14 -14 Q0 -34 14 -14Z','#f6dc94','#462e27',2)+p('M8 -18 Q12 -28 18 -26 Q14 -20 8 -18Z','#7db356','#462e27',1.2)+r(20,24,14,12,'#7cc3e8',3)+peekPaws,
 ui_village_gate:p('M-24 34 V-6 M24 34 V-6','none','#8a5a3a',6)+p('M-40 -6 Q-22 -10 -18 -22 Q0 -38 18 -22 Q22 -10 40 -6Z','#e6c47e','#3a2618',2.5)+r(-18,-4,36,14,'#4f7aa8',2)+e(0,22,8,9,'#f5b53a')+p('M20 -30 Q16 -38 20 -44','none','#fff8ec',3),
 ui_harvest_basket:p('M-34 -2 H34 Q30 30 20 32 H-20 Q-30 30 -34 -2Z','#d9a35f','#3a2618',2.5)+p('M-24 0 Q0 -40 24 0','none','#a8733f',4)+e(-12,-6,8,6,'#f6d77d')+e(4,-10,8,6,'#f6d77d')+r(10,-16,14,12,'#f7a6b8',2)+p('M-10 12 H10 M-14 20 H14','none','#b07a3e',2),
 res_onsen_wood:p('M-34 14 L30 -6 M-34 2 L30 -18 M-34 26 L30 6','none','#c98f55',11)+p('M-12 -16 L-6 28 M12 -22 L18 22','none','#e9d3a8',4)+p('M26 -26 Q36 -32 38 -22 Q30 -20 26 -26Z','#7db356','#3a2618',1.4),
 res_yuzu_essence:e(0,10,26,26,'#eef8fa')+p('M-22 14 Q0 6 22 14 Q20 34 0 36 Q-20 34 -22 14Z','#f6c84c','none',0)+r(-8,-28,16,12,'#c98f55',3)+p('M-14 -6 Q-20 6 -16 18','none','#ffffff',3),
 ui_pet_heart:p('M0 30 C-38 6 -34 -26 -14 -28 C-5 -28 0 -21 0 -15 C0 -21 5 -28 14 -28 C34 -26 38 6 0 30Z','#ff7b89','#3a2618',3)+e(-14,-12,4,7,'#ffd3da'),
 ui_sleep_zzz:p('M-30 12 Q-40 0 -26 -8 Q-24 -24 -6 -20 Q6 -32 20 -20 Q36 -20 34 -2 Q42 14 26 18 H-22 Q-34 18 -30 12Z','#e3f1ff','#3a2618',2.5)+p('M-2 -12 A10 10 0 1 0 8 6 A8 8 0 1 1 -2 -12Z','#f5c343','#3a2618',1.8)+e(-30,30,4,4,'#e3f1ff'),
});
export const P9_SCENE_IDS=['npc_shop_raccoon','npc_blacksmith_capy','ui_gacha_machine','ui_trunk_crate','ui_battle_clash_crest','ui_crossed_blades','ui_alert_siren','ui_unlock_chest'] as const;
Object.assign(tools,{
 npc_shop_raccoon:coon+r(-32,22,64,19,'#8eb09a')+p('M-34 -23 H34 L25 -39 H-23Z','#d0a66d'),
 npc_blacksmith_capy:head('#d5b58e')+r(-23,19,46,21,'#a9b6b3')+p('M24 18 L37 -20 M25 -25 L43 -17','none','#8f6446',9),
 ui_trunk_crate:r(-36,-23,72,55,'#c7995f')+p('M-34 -7 H34 M-34 10 H34 M-24 -23 V32 M24 -23 V32','none','#755030',5)+r(-7,-6,14,15,'#eac35e'),
 ui_gacha_machine:r(-29,-34,58,70,'#be7b55')+e(0,-9,23,23,'#d8e9dd')+e(-9,-14,8,8,'#eab56a')+e(9,-4,8,8,'#a8c3af')+e(-5,7,8,8,'#d7a8bc')+r(-15,22,30,9,'#67462d')+e(20,22,7,7,'#e7c575'),
 ui_crossed_blades:p('M-32 -35 L-23 -34 31 24 24 31 -34 -23Z','#d3e0df')+p('M32 -35 L23 -34 -31 24 -24 31 34 -23Z','#f3e4b9')+p('M-36 16 L-16 36 M16 36 L36 16','none','#b87e3c',7),
 ui_battle_clash_crest:p('M0 -40 L32 -25 29 15 Q16 34 0 42 Q-16 34 -29 15 L-32 -25Z','#d6a549')+head('#e3c39a'),
 ui_alert_siren:r(-32,19,64,15,'#c8b59b')+p('M-22 18 V-5 Q-22 -31 0 -31 Q22 -31 22 -5 V18Z','#d66f55')+p('M-34 -29 L-26 -21 M0 -45 V-36 M34 -29 L26 -21','none','#e6af4e',5)+p('M0 -18 V2 M0 9 V11','none','#fff8dd',6),
 ui_unlock_chest:r(-35,0,70,34,'#ce9751')+p('M-35 0 L-30 -25 Q0 -39 30 -25 L35 0Z','#edc96a')+r(-7,-6,14,17,'#fff0aa')+p('M0 -43 V-37 M-31 -36 L-25 -31 M31 -36 L25 -31','none','#eac35c',4),
});
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
function geometry(id:string,art:string,size:number,frame=true):string {
  const backing=frame?'<path d="M-39 -26 Q-42 -42 -19 -40 L19 -41 Q42 -39 40 -18 L41 22 Q38 43 17 41 L-22 42 Q-43 38 -40 18Z" fill="#fff9eb" stroke="#fffdf6" stroke-width="5"/>':'';
  return `<svg viewBox="-48 -48 96 96" width="${size}" height="${size}" role="img" aria-label="${id}" data-sticker="${id}"><g stroke-linecap="round" stroke-linejoin="round">${backing}${art}</g></svg>`;
}
function image(id:string,size:number):string|undefined {
  const url=spriteUrl(id);return url?`<img src="${escapeHtml(url)}" width="${size}" height="${size}" alt="${id}" data-sticker="${id}" draggable="false" style="object-fit:contain"/>`:undefined;
}
export function propSticker(id:string,size=48):string {
  const key=Object.hasOwn(props,id)?id:'washer',n=sizeOf(size,48),override=image(`prop_${key}`,n);
  return override||`<svg viewBox="-48 -48 96 96" width="${n}" height="${n}" role="img" aria-label="${key}" data-sticker="prop_${key}"><g stroke-linecap="round" stroke-linejoin="round"><path d="M-39 -26 Q-42 -42 -19 -40 L19 -41 Q42 -39 40 -18 L41 22 Q38 43 17 41 L-22 42 Q-43 38 -40 18Z" fill="#fff9eb" stroke="#fffdf6" stroke-width="5"/>${props[key]}</g></svg>`;
}
export function unitSticker(kind:string,size=40):string {
  if(kind==='shovel')return sceneSticker('shovel','⚒',size);
  const key=Object.hasOwn(UNIT_ICONS,kind)||Object.hasOwn(enemies,kind)?kind:'hamster',n=sizeOf(size,40),override=image(key,n);
  if(override)return override;
  if(Object.hasOwn(enemies,key))return geometry(key,enemies[key],n);
  if(['hamster','squirrel','bee'].includes(key))return avatarSticker(key,n);
  return `<span role="img" aria-label="${key}" data-sticker="${key}" style="display:inline-grid;place-items:center;width:${n}px;height:${n}px;font-size:${Math.round(n*.63)}px">${escapeHtml(UNIT_ICONS[key])}</span>`;
}
export function sceneSticker(id:typeof P16_SCENE_IDS[number]|typeof P15_SCENE_IDS[number]|typeof P14_SCENE_IDS[number]|typeof P13_SCENE_IDS[number]|typeof P12_SCENE_IDS[number]|typeof P11_SCENE_IDS[number]|typeof P10_SCENE_IDS[number]|typeof P9_SCENE_IDS[number]|'menu_banner'|'logo_capy'|'sprinkler'|'shovel'|'ui_compendium_book'|'ui_fish_food'|'ui_bell_summon'|'ui_shop_bag'|'orange'|'ui_trophy_rank'|'ui_map_sign'|'ui_header_compendium'|'ui_header_armory'|'ui_header_market'|'ui_header_rank'|'ui_header_profile'|'ui_header_settings'|'ui_tutorial_pointer'|'ui_tutorial_capy'|'ui_coin_gold'|'ui_star_rank'|'ui_ticket_gacha'|'ui_skull_threat'|'ui_result_victory'|'ui_result_defeat'|'ui_header_pause'|'ui_mvp_crown'|'ui_lock_closed'|'ui_lock_open'|'ui_wave_horn'|'ui_merge_sparkle',fallback:string,size?:number):string {
  const n=sizeOf(size??(id==='menu_banner'?400:64),64);
  return image(id,n)||(Object.hasOwn(tools,id)?geometry(id,tools[id],n,![...P10_SCENE_IDS,...P11_SCENE_IDS,...P12_SCENE_IDS,...P14_SCENE_IDS,...P15_SCENE_IDS,...P16_SCENE_IDS].some(key=>key===id)):fallback);
}

type ArtStickerId='title_logo_zh'|'title_logo_en'|'ui_btn_start_zh'|'ui_btn_start_en';
/** Wide transparent art keeps its own silhouette, including before optional PNGs decode. */
export function artSticker(id:ArtStickerId,fallbackText:string):string {
  const url=spriteUrl(id),label=escapeHtml(fallbackText),title=id.startsWith('title_');
  if(url)return `<img src="${escapeHtml(url)}" alt="${label}" data-art-sticker="${id}" draggable="false"/>`;
  const width=title?960:520,height=title?320:220;
  const lines=title&&id.endsWith('_en')?['CAPYBARA!','CHILL DEFENSE']:[fallbackText];
  const letters=lines.map((text,row)=>{
    const chars=Array.from(text),step=(width*.88)/Math.max(chars.length,1),size=Math.min(title?148:88,step*1.4);
    const spans=chars.map((char,i)=>{
      const phase=chars.length>1?i/(chars.length-1):.5;
      const x=width*.5+(i-(chars.length-1)/2)*step,y=(lines.length>1?145+row*103:height*.63)-Math.sin(phase*Math.PI)*(title?20:10);
      return `<tspan x="${x.toFixed(1)}" y="${y.toFixed(1)}" rotate="${((phase-.5)*9).toFixed(1)}">${escapeHtml(char)}</tspan>`;
    }).join('');
    return `<text text-anchor="middle" font-size="${size}" font-weight="900" font-family="Trebuchet MS, Microsoft YaHei, sans-serif" fill="#ffc568" stroke="#684020" stroke-width="${title?8:5}" paint-order="stroke fill" stroke-linejoin="round">${spans}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}" data-art-sticker="${id}"><g stroke-linecap="round" stroke-linejoin="round"><g transform="translate(${title?160:width/2}, ${title?58:31}) scale(${title?1.6:1})">${orange(0,0)}</g>${letters}</g></svg>`;
}
