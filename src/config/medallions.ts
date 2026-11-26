import {getWaveConfig} from './waves';

/**
 * P17 Endless Medallions. Every effect below is read only while `state.endless === true` (Wave 11+);
 * the ten standard waves never see a medallion, an awakening or the capybara bubble shield.
 */
export type MedallionId =
  | 'med_breakthrough_atk'
  | 'med_luck_rate'
  | 'med_momentum'
  | 'med_boss_resist'
  | 'med_boss_slayer'
  | 'med_capy_shield';
export const MEDALLION_IDS=['med_breakthrough_atk','med_luck_rate','med_momentum','med_boss_resist','med_boss_slayer','med_capy_shield'] as const satisfies readonly MedallionId[];
export const MEDALLION_MAX_LEVEL=50;
export const MEDALLION_TOTAL_MAX=MEDALLION_IDS.length*MEDALLION_MAX_LEVEL;
/** Clearing the tenth wave always pays this many crests, even if the player never enters endless. */
export const STANDARD_VICTORY_CRESTS=3;
/** An awakened hero's endless base multiplier and its small attack-speed bonus. */
export const AWAKENED_DAMAGE=2.5;
export const AWAKENED_RATE=1.15;
/** Momentum (battle spirit) saturates at this value. */
export const MOMENTUM_CAP=200;

export const isMedallionId=(id:unknown):id is MedallionId=>typeof id==='string'&&(MEDALLION_IDS as readonly string[]).includes(id);
export function clampMedallionLevel(value:unknown):number {
  return typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(MEDALLION_MAX_LEVEL,Math.trunc(value))):0;
}
/** Exactly `0` when the medallion is absent, so an empty loadout changes nothing. */
export function getMedallionLevel(source:{endlessMedallions?:Record<string,number>}|undefined,id:MedallionId):number {
  return clampMedallionLevel(source?.endlessMedallions?.[id]);
}
export function medallionLevels(source:{endlessMedallions?:Record<string,number>}|undefined):Record<MedallionId,number> {
  return Object.fromEntries(MEDALLION_IDS.map(id=>[id,getMedallionLevel(source,id)])) as Record<MedallionId,number>;
}
export const medallionTotalLevel=(source:{endlessMedallions?:Record<string,number>}|undefined):number=>MEDALLION_IDS.reduce((sum,id)=>sum+getMedallionLevel(source,id),0);

// ───────────────────────── Crest economy (50h / 100h / 300h) ─────────────────────────
/** Endless crests banked for clearing one endless wave: W11-20 → 1, W21-30 → 2 … W71+ → 7. */
export function endlessCrestsForWave(wave:number):number {
  if(!Number.isFinite(wave)||wave<11)return 0;
  const k=Math.trunc(wave)-10;
  return Math.min(7,1+Math.floor((k-1)/10));
}
/** Total endless crests for clearing waves 11..wave (the most an honest receipt can claim). */
export function endlessCrestsThroughWave(wave:number):number {
  let total=0;for(let w=11;w<=Math.min(Math.trunc(wave),100_000);w++)total+=endlessCrestsForWave(w);return total;
}
export const LATE_CREST_COSTS=[800,1100,1450,1850,2300,2750,3250,3800,4350,4850] as const; // Lv.41..50
/** Crests and coins (`crests * 2`) to raise a medallion from `currentLevel` to `currentLevel + 1`. */
export function medallionUpgradeCost(currentLevel:number):{crests:number;coins:number}|null {
  if(!Number.isInteger(currentLevel)||currentLevel<0||currentLevel>=MEDALLION_MAX_LEVEL)return null;
  const next=currentLevel+1;
  let crests:number;
  if(next<=25)crests=8+(next-1)*8;             // Lv.1=8 ... Lv.25=200 (sum 2,600)
  else if(next<=40)crests=220+(next-26)*20;    // Lv.26=220 ... Lv.40=500 (sum 5,400)
  else crests=LATE_CREST_COSTS[next-41];       // Lv.41=800 ... Lv.50=4,850 (sum 26,500)
  return{crests,coins:crests*2};
}
/** Crest total to climb from `from` to `to` (exclusive of `from`). */
export function medallionCrestsBetween(from:number,to:number):number {
  let total=0;for(let level=Math.max(0,from);level<Math.min(MEDALLION_MAX_LEVEL,to);level++)total+=medallionUpgradeCost(level)!.crests;return total;
}

// ───────────────────────── The six effects (lv = 0..50; lv = 0 has no medallion effect) ─────────────────────────
/** Ember Breakthrough: awakened heroes deal `1.235^lv` in endless. */
export const breakthroughAttackMultiplier=(lv:number):number=>Math.pow(1.235,clampMedallionLevel(lv));
/** Clover Luck: +1.4% breakthrough chance per level (max +70%). */
export const luckBonus=(lv:number):number=>Math.min(.7,clampMedallionLevel(lv)*.014);
/** Battle Momentum: `1 + (momentum / 200) * (0.20 + 0.072 * lv)`; base spirit alone is worth up to ×1.20. */
export function momentumMultiplier(momentum:number,lv:number):number {
  const spirit=Number.isFinite(momentum)?Math.max(0,Math.min(MOMENTUM_CAP,momentum)):0;
  return 1+spirit/MOMENTUM_CAP*(.2+.072*clampMedallionLevel(lv));
}
/** Calm Ward: boss debuffs last `(1 - resist)` as long, and destructive skills are shrugged off with `resist` chance. */
export const bossResist=(lv:number):number=>Math.min(.9,.018*clampMedallionLevel(lv));
/** Sovereign Piercer: endless boss damage multiplier. */
export const bossSlayerMultiplier=(lv:number):number=>1+.08*clampMedallionLevel(lv);
/** Sovereign Piercer: share of enemy armor ignored by every endless attack. */
export const armorPenetration=(lv:number):number=>Math.min(.9,.018*clampMedallionLevel(lv));
/** Capybara Bubble Shield recharge seconds: Lv.1 = 60s → Lv.50 = 3s; no medallion never recharges. */
export function capyShieldCooldown(lv:number):number {
  const level=clampMedallionLevel(lv);
  return level<=0?Infinity:Number(Math.max(3,60-(level-1)*(57/49)).toFixed(2));
}

export interface BreakthroughChance {total:number;base:number;preTenBonus:number;medallionBonus:number;failBonus:number}
/** `min(1, 30% + pre-ten spirit (max 30%) + Clover Luck + 5% per earlier miss)`. */
export function computeBreakthroughChance(input:{preEndlessKills:number;preEndlessBossKills:number;luckMedallionLevel:number;previousFails:number}):BreakthroughChance {
  const n=(value:number)=>Number.isFinite(value)?Math.max(0,value):0;
  const base=.30;
  const preTenBonus=Math.min(.30,n(input.preEndlessKills)*.005+n(input.preEndlessBossKills)*.03);
  const medallionBonus=Math.min(.70,Math.max(0,Math.min(50,n(input.luckMedallionLevel)))*.014);
  const failBonus=n(input.previousFails)*.05;
  const total=Math.min(1,base+preTenBonus+medallionBonus+failBonus);
  return{total,base,preTenBonus,medallionBonus,failBonus};
}

/** Headline value per medallion and level, used by the hall rows (`current → next`). */
export function medallionEffectValue(id:MedallionId,lv:number):number {
  switch(id){
    case 'med_breakthrough_atk':return breakthroughAttackMultiplier(lv);
    case 'med_luck_rate':return luckBonus(lv);
    case 'med_momentum':return momentumMultiplier(MOMENTUM_CAP,lv);
    case 'med_boss_resist':return bossResist(lv);
    case 'med_boss_slayer':return bossSlayerMultiplier(lv);
    case 'med_capy_shield':return capyShieldCooldown(lv);
  }
}

// ───────────────────────── Design model: where does the climb end? ─────────────────────────
/**
 * Analytic sweet-spot model used by the balance tests. It compares a lineup's endless damage multiplier
 * (exactly the multipliers BattleEngine applies) with the effective HP pressure of `getWaveConfig`:
 * `hpScale / (1 - armorBonus * (1 - penetration))`, where half of an endless wave's HP sits on bosses.
 * A fresh, un-awakened Lv.5 lineup with zero momentum just holds {@link CEILING_BASELINE_WAVE}.
 */
export const CEILING_BASELINE_WAVE=13;
export const CEILING_BOSS_SHARE=.5;
export interface CeilingInput {levels?:Partial<Record<MedallionId,number>>;awakened?:boolean;momentum?:number}
export function endlessDamageMultiplier(input:CeilingInput):number {
  const lv=(id:MedallionId)=>clampMedallionLevel(input.levels?.[id]);
  const awakened=input.awakened?AWAKENED_DAMAGE*AWAKENED_RATE*breakthroughAttackMultiplier(lv('med_breakthrough_atk')):1;
  const slayer=1/((1-CEILING_BOSS_SHARE)+CEILING_BOSS_SHARE/bossSlayerMultiplier(lv('med_boss_slayer')));
  return awakened*momentumMultiplier(input.momentum??0,lv('med_momentum'))*slayer;
}
export function endlessPressure(wave:number,penetration=0):number {
  const config=getWaveConfig(wave);
  return config.hpScale/(1-config.armorBonus*(1-penetration));
}
/** Highest endless wave (11..200) this lineup can still hold under the model. */
export function estimateEndlessCeilingWave(input:CeilingInput):number {
  const supply=endlessDamageMultiplier(input)*endlessPressure(CEILING_BASELINE_WAVE),penetration=armorPenetration(input.levels?.med_boss_slayer??0);
  let wave=CEILING_BASELINE_WAVE;
  while(wave<200&&endlessPressure(wave+1,penetration)<=supply)wave++;
  return wave;
}
