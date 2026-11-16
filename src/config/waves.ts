import type {MapId} from '../core/types';
import {BOSS_IDS} from './enemies';
import {clampRank,getRankDifficulty} from './ranks';
export const WAVES = [
  { count:7, interval:2.5, hpScale:1, boss:null },
  { count:9, interval:2.3, hpScale:1.35, boss:null },
  { count:11, interval:2.1, hpScale:1.8, boss:null },
  { count:13, interval:1.95, hpScale:2.35, boss:'husky_wrecker' },
  { count:15, interval:1.8, hpScale:3, boss:null },
  { count:17, interval:1.65, hpScale:3.85, boss:'dr_clippers' },
  { count:19, interval:1.5, hpScale:4.8, boss:null },
  { count:21, interval:1.4, hpScale:6, boss:'box_kraken' },
  { count:23, interval:1.3, hpScale:7.4, boss:'sad_rain_frog' },
  { count:26, interval:1.2, hpScale:9, boss:'king_skunk' },
] as const;
export const WAVE_DURATION = 36;
export const FIRST_WAVE_PREPARATION = 18;
export interface WaveConfig {count:number;interval:number;hpScale:number;speedScale:number;armorBonus:number}
/** Standard waves retain their table; endless pressure starts at k=1 on wave 11. */
export function getWaveConfig(waveNumber:number):WaveConfig {
  const wave=Number.isFinite(waveNumber)?Math.max(1,Math.trunc(waveNumber)):1;
  if(wave<=10)return {...WAVES[wave-1],speedScale:1,armorBonus:0};
  const k=wave-10;
  // Numerical saturation only: realistic waves retain their exact exponential curve.
  const hpScale=Math.min(Number.MAX_SAFE_INTEGER,WAVES[9].hpScale*2**Math.min(53,k));
  return {count:Math.min(56,26+3*k),interval:Math.max(.55,1.2*Math.pow(.92,k)),hpScale,
    speedScale:1+Math.min(.75,.06*k),armorBonus:Math.min(.35,.025*k)};
}
const BOSS_WAVES=[4,6,8,9,10];
export const THEME_BOSSES:Record<MapId,string[]>={
  sunny_backyard:['husky_wrecker','diva_kitty','mega_roomba','sad_rain_frog','king_skunk'],
  sakura_onsen:['box_kraken','diva_kitty','screaming_marmot','sad_rain_frog','buff_roo'],
  midnight_kitchen:['dr_clippers','trash_coon','mega_roomba','hornet_queen','dj_rat_king'],
  cat_tower_maze:['hornet_queen','buff_roo','box_kraken','screaming_marmot','dj_rat_king'],
};
export function bossForWave(mapId:MapId,rankIndex:number,wave:number,random:()=>number):string|null {
  const index=wave>=11?(Math.trunc(wave)-11)%5:wave===3&&rankIndex>=20?0:BOSS_WAVES.indexOf(wave);if(index<0)return null;
  return rankIndex>=40?BOSS_IDS[Math.floor(Math.max(0,Math.min(.999999999,random()))*BOSS_IDS.length)]:THEME_BOSSES[mapId][index];
}
export function bossCountForWave(wave:number,rankIndex:number):number {
  if(wave>=11){const k=wave-10;return k<=2?1:k<=5?2:3;}
  const rank=clampRank(rankIndex);
  if(wave===3&&rank>=20)return 1;
  if(!BOSS_WAVES.includes(wave))return 0;
  return (rank>=45&&[6,8,9,10].includes(wave))||(rank>=30&&[8,10].includes(wave))||(rank>=15&&wave===10)?2:1;
}
export function bossesForWave(mapId:MapId,rankIndex:number,wave:number,random:()=>number):string[] {
  const first=bossForWave(mapId,rankIndex,wave,random);if(!first)return [];
  const count=bossCountForWave(wave,rankIndex);if(count<2)return [first];
  const pool=(rankIndex>=40?BOSS_IDS:THEME_BOSSES[mapId]).filter(id=>id!==first);
  const chosen=[first];
  while(chosen.length<count)chosen.push(pool.splice(Math.floor(Math.max(0,Math.min(.999999999,random()))*pool.length),1)[0]);
  return chosen;
}
export function waveEnemyCount(waveNumber:number,rankIndex:number):number {
  const config=getWaveConfig(waveNumber);
  return config.count+(waveNumber>=11?0:getRankDifficulty(rankIndex).extraCount);
}
export function minionForWave(waveNumber:number,spawnIndex:number,rankIndex:number):string {
  const rank=clampRank(rankIndex),i=Math.max(0,Math.trunc(spawnIndex));
  if(rank>=30&&waveNumber>=4&&i%7===5)return 'charmed_rat';
  if(rank>=15&&waveNumber>=5&&i%6===3)return 'killer_bee';
  if(rank>=5&&waveNumber>=3&&i%(rank>=10?3:4)===2)return 'crab';
  if(waveNumber<3){
    if(rank>=15&&waveNumber===1&&i>=Math.floor(waveEnemyCount(1,rank)/2)&&i%2===0)return 'roach';
    return rank>=5&&waveNumber===2&&i%3===1?'roach':'rat';
  }
  return i%5===4?'crab':i%3===1?'roach':'rat';
}
