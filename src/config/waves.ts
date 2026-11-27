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
/** After 60s in a wave (or 60s alive), bosses enter overtime Unstoppable state (immune to knockback & stun) to prevent infinite stall loops. */
export const BOSS_UNSTOPPABLE_TIME = 60;
export interface WaveConfig {count:number;interval:number;hpScale:number;speedScale:number;armorBonus:number}
export interface StandardWavePressure {hpMult:number;speedMult:number}

/** Standard W1–W10 minion pressure ramp (applied on top of WAVES in live standard waves; Endless W11+ stays anchored independently). */
const STANDARD_MINION_HP_MULT = [1, 1, 1.05, 1.12, 1.2, 1.3, 1.4, 1.52, 1.65, 1.8] as const;
const STANDARD_MINION_SPEED_MULT = [1, 1, 1.02, 1.04, 1.06, 1.08, 1.1, 1.11, 1.12, 1.14] as const;

/** Minimum Boss HP floor & wave multiplier for standard Waves 1–10 so 0★ early bosses (e.g. Husky) still escalate meaningfully into W6–W10. */
const STANDARD_BOSS_HP_FLOOR: Readonly<Record<number, number>> = {
  3: 1400, 4: 1900, 6: 3600, 8: 5800, 9: 7800, 10: 10200,
};
const STANDARD_BOSS_WAVE_MULT: Readonly<Record<number, number>> = {
  3: 1.05, 4: 1.2, 6: 1.5, 8: 1.9, 9: 2.3, 10: 2.7,
};

export function getStandardMinionPressure(wave: number, tutorialGuided = false): StandardWavePressure {
  if (tutorialGuided) return { hpMult: 0.7, speedMult: 0.9 };
  const idx = Math.max(0, Math.min(9, Math.trunc(wave) - 1));
  return { hpMult: STANDARD_MINION_HP_MULT[idx], speedMult: STANDARD_MINION_SPEED_MULT[idx] };
}

export function getStandardBossScaling(
  baseHp: number,
  wave: number,
  tutorialGuided = false,
): { hpScale: number; speedMult: number } {
  const safeBase = Math.max(1, Number.isFinite(baseHp) ? baseHp : 1);
  if (tutorialGuided) return { hpScale: 0.72, speedMult: 0.9 };
  const w = Math.max(1, Math.min(10, Math.trunc(wave)));
  const floor = STANDARD_BOSS_HP_FLOOR[w] ?? 0;
  const mult = STANDARD_BOSS_WAVE_MULT[w] ?? 1;
  const targetHp = Math.max(floor, safeBase * mult);
  return { hpScale: targetHp / safeBase, speedMult: 1.08 };
}
/** Endless HP grows by this factor per wave after the tenth (P17: a gentle ×1.25 instead of ×2). */
export const ENDLESS_HP_GROWTH=1.25;
/** Anchor Endless W11+ cleanly above Standard W10 effective minion pressure (9 × 1.8 = 16.2 HP, 1.14× speed). */
export const ENDLESS_BASE_HP_SCALE=WAVES[9].hpScale*STANDARD_MINION_HP_MULT[9];
export const ENDLESS_BASE_SPEED_SCALE=STANDARD_MINION_SPEED_MULT[9];
/** Smooth, fair Endless Boss HP scaling across all 12 bosses (clamps raw base HP spread so W11 smoothly exceeds W10's 10.2k–12.4k). */
export function getEndlessBossScaling(baseHp:number,waveNumber:number):number {
  const safeBase=Math.max(1,Number.isFinite(baseHp)?baseHp:1);
  const effectiveBase=Math.max(2200,Math.min(3400,safeBase));
  return (effectiveBase*.36*getWaveConfig(waveNumber).hpScale)/safeBase;
}
/** Standard waves retain their table; endless pressure starts at k=1 on wave 11 strictly above W10. */
export function getWaveConfig(waveNumber:number):WaveConfig {
  const wave=Number.isFinite(waveNumber)?Math.max(1,Math.trunc(waveNumber)):1;
  if(wave<=10)return {...WAVES[wave-1],speedScale:1,armorBonus:0};
  const k=wave-10;
  // P17 curve: ×1.25 per wave anchored to W10's effective pressure so W11 never drops below W10.
  const hpScale=Math.min(Number.MAX_SAFE_INTEGER,ENDLESS_BASE_HP_SCALE*Math.pow(ENDLESS_HP_GROWTH,Math.min(200,k)));
  return {count:Math.min(56,26+3*k),interval:Math.max(.55,1.2*Math.pow(.92,k)),hpScale,
    speedScale:ENDLESS_BASE_SPEED_SCALE+Math.min(.60,.012*k),armorBonus:Math.min(.45,.009*k)};
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
  // Endless (Wave 11+) uses the identical full 12-boss pool regardless of rank or map for Global Endless Board fairness.
  return wave>=11||rankIndex>=40?BOSS_IDS[Math.floor(Math.max(0,Math.min(.999999999,random()))*BOSS_IDS.length)]:THEME_BOSSES[mapId][index];
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
  const pool=(wave>=11||rankIndex>=40?BOSS_IDS:THEME_BOSSES[mapId]).filter(id=>id!==first);
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
  // Endless (Wave 11+) uses one uniform full-roster minion mix across every rank & map.
  if(waveNumber>=11){
    if(i%7===5)return 'charmed_rat';
    if(i%6===3)return 'killer_bee';
    if(i%3===2)return 'crab';
    return i%3===1?'roach':'rat';
  }
  if(rank>=30&&waveNumber>=4&&i%7===5)return 'charmed_rat';
  if(rank>=15&&waveNumber>=5&&i%6===3)return 'killer_bee';
  if(rank>=5&&waveNumber>=3&&i%(rank>=10?3:4)===2)return 'crab';
  if(waveNumber<3){
    if(rank>=15&&waveNumber===1&&i>=Math.floor(waveEnemyCount(1,rank)/2)&&i%2===0)return 'roach';
    return rank>=5&&waveNumber===2&&i%3===1?'roach':'rat';
  }
  return i%5===4?'crab':i%3===1?'roach':'rat';
}
