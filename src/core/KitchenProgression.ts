import {
  BROTHS,BROTH_IDS,INGREDIENT_BASKET_PRICE,INGREDIENT_BASKET_SIZE,INGREDIENT_IDS,INGREDIENT_STACK_LIMIT,
  clampBrothLevel,costTotal,isBrothId,isIngredientId,type BrothId,type IngredientCost,type IngredientId,
} from '../config/kitchen';
import type {Profile} from './types';

/** Immutable Onsen Kitchen transactions. Every result carries a fresh profile copy. */
export interface KitchenResult {profile:Profile;ok:boolean;key:string;brothId?:BrothId;level?:number}

const copy=(profile:Profile):Profile=>({...profile,ingredients:{...(profile.ingredients??{})},
  unlockedBroths:[...(profile.unlockedBroths??[])],brothLevels:{...(profile.brothLevels??{})},activeBrothId:profile.activeBrothId??null});
const fail=(profile:Profile,key:string,brothId?:BrothId):KitchenResult=>({profile:copy(profile),ok:false,key,...(brothId?{brothId}:{})});
const sample=(random:()=>number)=>{const value=Number(random());return Number.isFinite(value)?Math.max(0,Math.min(.999999999999,value)):0;};
const owned=(profile:Profile,id:IngredientId)=>{const n=profile.ingredients?.[id];return typeof n==='number'&&Number.isSafeInteger(n)&&n>0?n:0;};

export function canAffordIngredients(profile:Profile,cost:IngredientCost):boolean {
  return Object.entries(cost).every(([id,n])=>isIngredientId(id)&&owned(profile,id)>=(n??0));
}
/** `0` while unbrewed, otherwise the brewed star level `1..3`. */
export function getBrothLevel(profile:Profile,brothId:string):number {
  if(!isBrothId(brothId)||!(profile.unlockedBroths??[]).includes(brothId))return 0;
  return clampBrothLevel(profile.brothLevels?.[brothId]);
}
/** `0 → unlock`, `1 → Lv.2`, `2 → Lv.3`, `3 → null` (already mastered). */
export function getBrothUpgradeCost(brothId:string,currentLevel:number):IngredientCost|null {
  if(!isBrothId(brothId)||!Number.isInteger(currentLevel)||currentLevel<0||currentLevel>2)return null;
  return{...BROTHS[brothId].costs[currentLevel]};
}
export function canBrewOrUpgradeAnyBroth(profile:Profile):{brewable:BrothId[];upgradeable:BrothId[]} {
  const brewable:BrothId[]=[],upgradeable:BrothId[]=[];
  for(const id of BROTH_IDS){
    const level=getBrothLevel(profile,id),cost=getBrothUpgradeCost(id,level);
    if(!cost||!canAffordIngredients(profile,cost))continue;
    (level===0?brewable:upgradeable).push(id);
  }
  return{brewable,upgradeable};
}
function spend(profile:Profile,cost:IngredientCost):void {
  for(const [id,n] of Object.entries(cost)){
    if(!isIngredientId(id))continue;
    const left=owned(profile,id)-(n??0);
    if(left>0)profile.ingredients[id]=left;else delete profile.ingredients[id];
  }
}
/** Unlocks Lv.1; the very first broth on an unequipped profile becomes today's soak automatically. */
export function brewBroth(profile:Profile,brothId:string):KitchenResult {
  if(!isBrothId(brothId))return fail(profile,'p14.invalidBroth');
  if(getBrothLevel(profile,brothId)>0)return fail(profile,'p14.alreadyBrewed',brothId);
  const cost=BROTHS[brothId].costs[0];
  if(!canAffordIngredients(profile,cost))return fail(profile,'p14.missingIngredients',brothId);
  const p=copy(profile);spend(p,cost);
  p.unlockedBroths.push(brothId);p.brothLevels[brothId]=1;
  if(p.activeBrothId===null)p.activeBrothId=brothId;
  return{profile:p,ok:true,key:'p14.brewed',brothId,level:1};
}
export function upgradeBroth(profile:Profile,brothId:string):KitchenResult {
  if(!isBrothId(brothId))return fail(profile,'p14.invalidBroth');
  const level=getBrothLevel(profile,brothId);
  if(level===0)return fail(profile,'p14.notBrewed',brothId);
  if(level>=3)return fail(profile,'p14.maxLevel',brothId);
  const cost=BROTHS[brothId].costs[level];
  if(!canAffordIngredients(profile,cost))return fail(profile,'p14.missingIngredients',brothId);
  const p=copy(profile);spend(p,cost);p.brothLevels[brothId]=level+1;
  return{profile:p,ok:true,key:'p14.upgraded',brothId,level:level+1};
}
/** `null` unequips; choosing the already active broth toggles it off. */
export function equipBroth(profile:Profile,brothId:BrothId|null):KitchenResult {
  if(brothId===null){const p=copy(profile);p.activeBrothId=null;return{profile:p,ok:true,key:'p14.unequipped'};}
  if(!isBrothId(brothId))return fail(profile,'p14.invalidBroth');
  if(getBrothLevel(profile,brothId)===0)return fail(profile,'p14.notBrewed',brothId);
  const p=copy(profile),off=p.activeBrothId===brothId;p.activeBrothId=off?null:brothId;
  return{profile:p,ok:true,key:off?'p14.unequipped':'p14.equipped',brothId};
}
/** Valid ids accumulate one each; unknown ids are ignored and stacks are clamped. */
export function grantIngredients(profile:Profile,ids:readonly string[]):Profile {
  const p=copy(profile);
  for(const id of Array.isArray(ids)?ids:[])if(isIngredientId(id))p.ingredients[id]=Math.min(INGREDIENT_STACK_LIMIT,owned(p,id)+1);
  return p;
}
/** Ingredients still missing for the cheapest unbrewed recipe; empty when nothing is locked or short. */
export function basketFocusIngredients(profile:Profile):IngredientId[] {
  const locked=BROTH_IDS.filter(id=>getBrothLevel(profile,id)===0&&!canAffordIngredients(profile,BROTHS[id].costs[0]));
  const target=[...locked].sort((a,b)=>costTotal(BROTHS[a].costs[0])-costTotal(BROTHS[b].costs[0]))[0];
  if(!target)return [];
  return INGREDIENT_IDS.filter(id=>owned(profile,id)<(BROTHS[target].costs[0][id]??0));
}
/** Spends 60 coins for three ingredients; the cheapest locked recipe's missing ones weigh 3×. */
export function buyIngredientBasket(profile:Profile,random:()=>number=Math.random):KitchenResult&{gained?:IngredientId[]} {
  if(!Number.isSafeInteger(profile.coins)||profile.coins<INGREDIENT_BASKET_PRICE)return fail(profile,'meta.insufficientCoins');
  const focus=new Set(basketFocusIngredients(profile));
  const weights=INGREDIENT_IDS.map(id=>focus.has(id)?3:1),total=weights.reduce((a,b)=>a+b,0);
  const gained:IngredientId[]=[];
  for(let i=0;i<INGREDIENT_BASKET_SIZE;i++){
    let value=sample(random)*total;
    gained.push(INGREDIENT_IDS.find((_,index)=>(value-=weights[index])<0)??INGREDIENT_IDS[INGREDIENT_IDS.length-1]);
  }
  const p=grantIngredients({...profile,coins:profile.coins-INGREDIENT_BASKET_PRICE},gained);
  return{profile:p,ok:true,key:'p14.basketBought',gained};
}
