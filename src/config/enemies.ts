export interface EnemyDefinition { id:string; hp:number; speed:number; armor:number; boss:boolean; interval:number; color:string; maxBrokenTiles?:number }
export const ENEMIES: Record<string, EnemyDefinition> = {
  rat: {id:'rat',hp:28,speed:.38,armor:0,boss:false,interval:0,color:'#b9a3bc'},
  roach: {id:'roach',hp:22,speed:.54,armor:0,boss:false,interval:0,color:'#ae8570'},
  crab: {id:'crab',hp:62,speed:.30,armor:.2,boss:false,interval:0,color:'#e78374'},
  killer_bee: {id:'killer_bee',hp:36,speed:.62,armor:0,boss:false,interval:0,color:'#e6b64e'},
  charmed_rat: {id:'charmed_rat',hp:45,speed:.58,armor:0,boss:false,interval:0,color:'#dba5bd'},
  husky_wrecker: {id:'husky_wrecker',hp:700,speed:.22,armor:.05,boss:true,interval:24,maxBrokenTiles:2,color:'#879eab'},
  mega_roomba: {id:'mega_roomba',hp:1725,speed:.22,armor:.1,boss:true,interval:10,color:'#b4b8bd'},
  dr_clippers: {id:'dr_clippers',hp:2530,speed:.22,armor:.1,boss:true,interval:9,color:'#b49aba'},
  box_kraken: {id:'box_kraken',hp:3220,speed:.22,armor:.1,boss:true,interval:12,color:'#d6ab79'},
  sad_rain_frog: {id:'sad_rain_frog',hp:3680,speed:.22,armor:.1,boss:true,interval:12,color:'#8baec6'},
  king_skunk: {id:'king_skunk',hp:4600,speed:.22,armor:.15,boss:true,interval:10,color:'#929b91'},
  diva_kitty: {id:'diva_kitty',hp:2070,speed:.22,armor:.08,boss:true,interval:11,color:'#e8c9d8'},
  buff_roo: {id:'buff_roo',hp:2990,speed:.22,armor:.12,boss:true,interval:10,color:'#be9272'},
  hornet_queen: {id:'hornet_queen',hp:2760,speed:.22,armor:.08,boss:true,interval:11,color:'#e3bd52'},
  screaming_marmot: {id:'screaming_marmot',hp:2300,speed:.22,armor:.10,boss:true,interval:10,color:'#c9a586'},
  trash_coon: {id:'trash_coon',hp:3450,speed:.22,armor:.12,boss:true,interval:11,color:'#9e9ca8'},
  dj_rat_king: {id:'dj_rat_king',hp:4140,speed:.22,armor:.15,boss:true,interval:9,color:'#ac88c2'},
};
export const BOSS_IDS = Object.values(ENEMIES).filter(e=>e.boss).map(e=>e.id);
export const FRAGMENTS = ['bamboo_blade','sardine_cannon','orange_wand','chill_shield'] as const;
