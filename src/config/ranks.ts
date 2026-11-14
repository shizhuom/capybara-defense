import type { MapId } from '../core/types';

export interface RankDifficulty {
  hpMultiplier:number; speedMultiplier:number; extraCount:number;
  intervalScale:number; armorBonus:number; bossCooldownScale:number;
}
export const clampRank = (index:number):number => Number.isFinite(index)?Math.max(0,Math.min(53,Math.trunc(index))):0;
const hpAnchors = [[0,1],[4,1.16],[5,1.22],[9,1.44],[10,1.52],[14,1.78],[15,1.88],[19,2.18],[20,2.30],[29,3.10],[30,3.25],[39,4.20],[40,4.40],[49,5.45],[50,5.65],[53,6.20]];
const speedAnchors = [[0,1],[4,1.02],[5,1.03],[9,1.05],[10,1.06],[14,1.08],[15,1.09],[19,1.11],[20,1.12],[29,1.16],[30,1.17],[39,1.21],[40,1.22],[49,1.26],[50,1.27],[53,1.28]];
function interpolate(index:number,anchors:number[][]):number {
  for(let i=1;i<anchors.length;i++)if(index<=anchors[i][0]){
    const [x,a]=anchors[i-1],[y,b]=anchors[i];return Number((a+(b-a)*(index-x)/(y-x)).toFixed(4));
  }
  return anchors.at(-1)![1];
}
export function getRankDifficulty(rankIndex:number,options:{tutorialGuided?:boolean}={}):RankDifficulty {
  const rank=clampRank(rankIndex);
  return {hpMultiplier:rank===0&&options.tutorialGuided? .85:interpolate(rank,hpAnchors),
    speedMultiplier:interpolate(rank,speedAnchors),extraCount:Math.floor(rank/4),intervalScale:Math.max(.62,1-rank*.007),
    armorBonus:rank<20?0:interpolate(rank,[[20,.04],[53,.10]]),
    bossCooldownScale:interpolate(rank,[[0,1],[9,1],[10,.94],[20,.90],[30,.84],[39,.80],[53,.75]])};
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
    winCoins:Math.round(60+160*index/53),fragmentMultiplier:god?2.2:index>=45?1.8:index>=40?1.5:1,
    mapId:index>=40?maps[(index-40)%4]:maps[Math.min(3,Math.floor(index/10))]};
});
export function getRank(stars:number):RankDefinition {
  const total=Number.isFinite(stars)?Math.max(0,stars):0;
  for(let index=RANKS.length-1;index>0;index--) if(total>=RANKS[index].minStars) return RANKS[index];
  return RANKS[0];
}
