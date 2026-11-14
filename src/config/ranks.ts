import type { MapId } from '../core/types';

export interface RankDefinition {
  index:number; name:{'zh-CN':string;en:string}; minStars:number;
  hpMultiplier:number; winCoins:number; fragmentMultiplier:number; mapId:MapId;
}
const maps:MapId[]=['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze'];
const tiers = [
  {zh:'见习铲屎官',en:'Rookie Keeper',hp:[1,1.08],coins:35},
  {zh:'溜狗达人',en:'Dog Walker',hp:[1.1,1.18],coins:45},
  {zh:'猫咖店长',en:'Cat Cafe Boss',hp:[1.2,1.3],coins:55},
  {zh:'温泉馆主',en:'Onsen Master',hp:[1.32,1.42],coins:65},
  {zh:'宠物营养师',en:'Chef Keeper',hp:[1.45,1.55],coins:75},
  {zh:'训宠宗师',en:'Pet Grandmaster',hp:[1.58,1.7],coins:85},
  {zh:'萌宠统帅',en:'Critter Marshal',hp:[1.72,1.85],coins:95},
  {zh:'皇家园长',en:'Royal Warden',hp:[1.88,2],coins:110},
  {zh:'后院霸主',en:'Backyard Overlord',hp:[2.05,2.2],coins:125},
  {zh:'森林君王',en:'Forest Monarch',hp:[2.25,2.45],coins:140},
];
export const RANKS:RankDefinition[]=Array.from({length:54},(_,index)=>{
  const god=index>=50; const tier=tiers[Math.min(9,Math.floor(index/5))];const sub=index%5;
  const roman=['I','II','III','IV','V'][sub];
  return {index,name:god?{'zh-CN':'水豚真神',en:'Capybara God'}:{'zh-CN':`${tier.zh} ${roman}`,en:`${tier.en} ${roman}`},
    minStars:god?[100,125,150,180][index-50]:index*2,
    hpMultiplier:god?[2.5,2.6,2.7,2.8][index-50]:Number((tier.hp[0]+(tier.hp[1]-tier.hp[0])*sub/4).toFixed(4)),
    winCoins:god?160:tier.coins,fragmentMultiplier:god?2.2:index>=45?1.8:index>=40?1.5:1,
    mapId:index>=40?maps[(index-40)%4]:maps[Math.min(3,Math.floor(index/10))]};
});
export function getRank(stars:number):RankDefinition {
  const total=Number.isFinite(stars)?Math.max(0,stars):0;
  for(let index=RANKS.length-1;index>0;index--) if(total>=RANKS[index].minStars) return RANKS[index];
  return RANKS[0];
}
