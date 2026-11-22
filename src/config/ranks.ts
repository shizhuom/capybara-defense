import type { MapId } from '../core/types';

export interface RankDifficulty {
  hpMultiplier:number; speedMultiplier:number; extraCount:number;
  intervalScale:number; armorBonus:number; bossCooldownScale:number;
}
export const clampRank = (index:number):number => Number.isFinite(index)?Math.max(0,Math.min(53,Math.trunc(index))):0;
/**
 * Rank progression is strictly rewarding (zero enemy HP/speed/armor/cooldown penalty):
 * - All enemy HP, speed, armor & boss cooldown multipliers stay at 1.0× across every rank (0.85× HP only for the guided Match 1).
 * - Waves 1–10 gently spawn +0..+8 extra 1×-HP small minions at higher ranks for livelier wave-clearing, extra fish food & faster momentum.
 * - Endless Mode (Wave 11+) is 100% identical across all ranks so the Global Endless Board is completely fair.
 */
export function getRankDifficulty(rankIndex:number,options:{tutorialGuided?:boolean}={}):RankDifficulty {
  const rank=clampRank(rankIndex);
  const extraCount=Math.min(8,Math.floor(rank/6));
  const intervalScale=Number(Math.max(.76,1-extraCount*.03).toFixed(4));
  return {
    hpMultiplier:rank===0&&options.tutorialGuided?.85:1,
    speedMultiplier:1,
    extraCount,
    intervalScale,
    armorBonus:0,
    bossCooldownScale:1,
  };
}

export interface RankDefinition {
  index:number; name:{'zh-CN':string;en:string}; minStars:number;
  hpMultiplier:number; winCoins:number; fragmentMultiplier:number; mapId:MapId;
}
const maps:MapId[]=['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze'];
const tiers = [
  {zh:'见习铲屎官',en:'Rookie Keeper'},
  {zh:'溜狗达人',en:'Dog Walker'},
  {zh:'猫咖店长',en:'Cat Cafe Boss'},
  {zh:'温泉馆主',en:'Onsen Master'},
  {zh:'宠物营养师',en:'Chef Keeper'},
  {zh:'训宠宗师',en:'Pet Grandmaster'},
  {zh:'萌宠统帅',en:'Critter Marshal'},
  {zh:'皇家园长',en:'Royal Warden'},
  {zh:'后院霸主',en:'Backyard Overlord'},
  {zh:'森林君王',en:'Forest Monarch'},
];
export const RANKS:RankDefinition[]=Array.from({length:54},(_,index)=>{
  const god=index>=50; const tier=tiers[Math.min(9,Math.floor(index/5))];const sub=index%5;
  const roman=['I','II','III','IV','V'][sub];
  return {index,name:god?{'zh-CN':'水豚真神',en:'Capybara God'}:{'zh-CN':`${tier.zh} ${roman}`,en:`${tier.en} ${roman}`},
    minStars:god?[100,125,150,180][index-50]:index*2,
    hpMultiplier:getRankDifficulty(index).hpMultiplier,
    winCoins:Math.round(60+160*index/53),fragmentMultiplier:god?1.75:index>=45?1.5:index>=40?1.3:1,
    mapId:index>=40?maps[(index-40)%4]:maps[Math.min(3,Math.floor(index/10))]};
});
export function getRank(stars:number):RankDefinition {
  const total=Number.isFinite(stars)?Math.max(0,stars):0;
  for(let index=RANKS.length-1;index>0;index--) if(total>=RANKS[index].minStars) return RANKS[index];
  return RANKS[0];
}
