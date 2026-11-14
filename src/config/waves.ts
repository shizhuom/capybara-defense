import type {MapId} from '../core/types';
import {BOSS_IDS} from './enemies';
export const WAVES = [
  { count:5, interval:3, hpScale:1, boss:null },
  { count:6, interval:2.8, hpScale:1.25, boss:null },
  { count:7, interval:2.6, hpScale:1.6, boss:null },
  { count:8, interval:2.4, hpScale:2, boss:'husky_wrecker' },
  { count:10, interval:2.2, hpScale:2.5, boss:null },
  { count:11, interval:2, hpScale:3.1, boss:'dr_clippers' },
  { count:12, interval:1.9, hpScale:3.8, boss:null },
  { count:13, interval:1.8, hpScale:4.6, boss:'box_kraken' },
  { count:14, interval:1.7, hpScale:5.5, boss:'sad_rain_frog' },
  { count:16, interval:1.6, hpScale:6.5, boss:'king_skunk' },
] as const;
export const WAVE_DURATION = 36;
export const FIRST_WAVE_PREPARATION = 20;
const BOSS_WAVES=[4,6,8,9,10];
export const THEME_BOSSES:Record<MapId,string[]>={
  sunny_backyard:['husky_wrecker','diva_kitty','mega_roomba','sad_rain_frog','king_skunk'],
  sakura_onsen:['box_kraken','diva_kitty','screaming_marmot','sad_rain_frog','buff_roo'],
  midnight_kitchen:['dr_clippers','trash_coon','mega_roomba','hornet_queen','dj_rat_king'],
  cat_tower_maze:['hornet_queen','buff_roo','box_kraken','screaming_marmot','dj_rat_king'],
};
export function bossForWave(mapId:MapId,rankIndex:number,wave:number,random:()=>number):string|null {
  const index=BOSS_WAVES.indexOf(wave);if(index<0)return null;
  return rankIndex>=40?BOSS_IDS[Math.floor(Math.max(0,Math.min(.999999999,random()))*BOSS_IDS.length)]:THEME_BOSSES[mapId][index];
}
