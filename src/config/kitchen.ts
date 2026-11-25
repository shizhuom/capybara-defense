import {HERO_FAMILIES} from './weapons';
import {HEROES} from './heroes';
import {UNITS} from './units';
import type {BattleLoadout,MapId} from '../core/types';

/** P14 Onsen Kitchen catalog: battle-gathered ingredients and twelve bath broths. */
export type IngredientId='ing_yuzu'|'ing_bamboo'|'ing_honey'|'ing_chili'|'ing_sakura'|'ing_mushroom';
export type BrothId=
  |'dish_yuzu_bath'|'dish_bamboo_broth'|'dish_honey_osmanthus'|'dish_ginger_soak'
  |'dish_spicy_hotpot'|'dish_sakura_milk'|'dish_matcha_tea'|'dish_herbal_tonic'
  |'dish_truffle_ramen'|'dish_chill_melon'|'dish_golden_feast'|'dish_imperial_onsen'
  |'dish_starlight_spring'|'dish_golden_orchard';
export type BrothLevel=1|2|3;
export type IngredientCost=Partial<Record<IngredientId,number>>;
export type CombatFamily='melee'|'ranged'|'magic';

export const INGREDIENT_IDS=['ing_yuzu','ing_bamboo','ing_honey','ing_chili','ing_sakura','ing_mushroom'] as const satisfies readonly IngredientId[];
export interface IngredientDefinition {id:IngredientId;color:string;rarity:1|2|3}
export const INGREDIENTS:Record<IngredientId,IngredientDefinition>={
  ing_yuzu:{id:'ing_yuzu',color:'#F6C84C',rarity:1},
  ing_bamboo:{id:'ing_bamboo',color:'#CBE08D',rarity:1},
  ing_honey:{id:'ing_honey',color:'#F5B249',rarity:1},
  ing_chili:{id:'ing_chili',color:'#E25B45',rarity:2},
  ing_sakura:{id:'ing_sakura',color:'#F8BBD0',rarity:2},
  ing_mushroom:{id:'ing_mushroom',color:'#9C7457',rarity:3},
};
export const MAP_SIGNATURE_INGREDIENT:Record<MapId,IngredientId>={
  sunny_backyard:'ing_yuzu',sakura_onsen:'ing_sakura',midnight_kitchen:'ing_chili',cat_tower_maze:'ing_mushroom',
};
export const INGREDIENT_BASKET_PRICE=360;
export const INGREDIENT_BASKET_SIZE=3;
/** Stored counts are clamped so repeated grants can never overflow a save. */
export const INGREDIENT_STACK_LIMIT=9999;
export const ELITE_ENEMY_IDS:readonly string[]=['crab','killer_bee','charmed_rat'];

/**
 * Every in-battle effect key a broth can provide. Values are per level (`Lv.1 / Lv.2 / Lv.3`).
 * Ratios are fractions (`.18` = +18%); `startFood`/`waveIncome`/`heroRefund`/`startOranges`/
 * `chargeReduction` are whole numbers and `rangedRange` is in grid cells.
 */
export type BrothEffectKey=
  |'startFood'|'waveIncome'|'meleeDamage'|'meleeRate'|'heroRefund'|'rangedDamage'|'rangedRange'
  |'bossDamage'|'burnRatio'|'startOranges'|'tubSlow'|'magicDamage'|'chargeReduction'
  |'shovelSpeed'|'beeSpeed'|'veteranDamage'|'globalSlow'|'coinBonus'|'dropBonus'|'allDamage'|'allRate'|'momentumBonus';
export const WHOLE_NUMBER_EFFECTS:readonly BrothEffectKey[]=['startFood','waveIncome','heroRefund','startOranges','chargeReduction'];
type Triple=readonly [number,number,number];
export interface BrothDefinition {
  id:BrothId; tier:1|2|3|4;
  /** `[unlock (Lv.1), upgrade to Lv.2, upgrade to Lv.3]` */
  costs:readonly [IngredientCost,IngredientCost,IngredientCost];
  bathColor:string; steamColor:string;
  /** P15 soup surface: bright centre, main body (`bathColor`), shaded tub wall and foam/froth tone. */
  bathCenter:string; bathEdge:string; foamColor:string;
  /** Floating garnish drawn on the soup and how lively its bubbles are (1 = average simmer). */
  topping:BrothTopping; bubbles:number;
  effects:Partial<Record<BrothEffectKey,Triple>>;
}
export type BrothTopping='yuzu'|'scallion'|'osmanthus'|'ginger'|'chili'|'sakura'|'matcha'|'herbal'|'truffle'|'melon'|'feast'|'imperial'|'starlight'|'orchard';
/** The clear hot spring used when no broth is equipped. */
export const CLEAR_SPRING={bathCenter:'#B9F0EC',bathColor:'#7FD5D0',bathEdge:'#53A9A8',foamColor:'#FFFFFF',steamColor:'#FFFFFF',bubbles:.7} as const;
const every=(n:number):IngredientCost=>Object.fromEntries(INGREDIENT_IDS.map(id=>[id,n])) as IngredientCost;
export const BROTH_IDS=[
  'dish_yuzu_bath','dish_bamboo_broth','dish_honey_osmanthus','dish_ginger_soak',
  'dish_spicy_hotpot','dish_sakura_milk','dish_matcha_tea','dish_herbal_tonic',
  'dish_truffle_ramen','dish_chill_melon','dish_golden_feast',
  'dish_imperial_onsen','dish_starlight_spring','dish_golden_orchard',
] as const satisfies readonly BrothId[];
export const BROTHS:Record<BrothId,BrothDefinition>={
  dish_yuzu_bath:{id:'dish_yuzu_bath',tier:1,bathColor:'#F6C84C',steamColor:'#FFF3B8',bathCenter:'#FFE891',bathEdge:'#C98C22',foamColor:'#FFF6D2',topping:'yuzu',bubbles:1,
    costs:[{ing_yuzu:4},{ing_yuzu:18,ing_honey:8},{ing_yuzu:42,ing_honey:24}],
    effects:{startFood:[6,9,12],waveIncome:[2,3,4]}},
  dish_bamboo_broth:{id:'dish_bamboo_broth',tier:1,bathColor:'#CBE08D',steamColor:'#EFF8D1',bathCenter:'#F2F8D8',bathEdge:'#8DAA4E',foamColor:'#FBFFF0',topping:'scallion',bubbles:1,
    costs:[{ing_bamboo:5},{ing_bamboo:18,ing_yuzu:8},{ing_bamboo:45,ing_yuzu:24}],
    effects:{meleeDamage:[.18,.26,.35],meleeRate:[.12,.16,.20]}},
  dish_honey_osmanthus:{id:'dish_honey_osmanthus',tier:1,bathColor:'#F5B249',steamColor:'#FFE7B3',bathCenter:'#FFD98A',bathEdge:'#C27A1E',foamColor:'#FFF1CF',topping:'osmanthus',bubbles:0.8,
    costs:[{ing_honey:4,ing_yuzu:2},{ing_honey:18,ing_yuzu:10},{ing_honey:42,ing_yuzu:28}],
    effects:{heroRefund:[8,11,14]}},
  dish_ginger_soak:{id:'dish_ginger_soak',tier:1,bathColor:'#E69F52',steamColor:'#FCE0BA',bathCenter:'#F8C58A',bathEdge:'#B0672A',foamColor:'#FDEBD2',topping:'ginger',bubbles:1.1,
    costs:[{ing_yuzu:4,ing_bamboo:2},{ing_yuzu:18,ing_bamboo:10},{ing_yuzu:42,ing_bamboo:28}],
    effects:{rangedDamage:[.18,.26,.35],rangedRange:[.4,.55,.7]}},
  dish_spicy_hotpot:{id:'dish_spicy_hotpot',tier:2,bathColor:'#E25B45',steamColor:'#FFC3B2',bathCenter:'#F7866E',bathEdge:'#9E2A1E',foamColor:'#FFD0B8',topping:'chili',bubbles:1.8,
    costs:[{ing_chili:8,ing_bamboo:6},{ing_chili:28,ing_bamboo:20},{ing_chili:66,ing_bamboo:48}],
    effects:{bossDamage:[.22,.32,.45],burnRatio:[.06,.09,.12]}},
  dish_sakura_milk:{id:'dish_sakura_milk',tier:2,bathColor:'#F8BBD0',steamColor:'#FFEAF1',bathCenter:'#FFE6EF',bathEdge:'#D98AA6',foamColor:'#FFFFFF',topping:'sakura',bubbles:0.55,
    costs:[{ing_sakura:8,ing_honey:6},{ing_sakura:28,ing_honey:20},{ing_sakura:66,ing_honey:48}],
    effects:{startOranges:[1,2,2],tubSlow:[.18,.24,.30]}},
  dish_matcha_tea:{id:'dish_matcha_tea',tier:2,bathColor:'#7CB369',steamColor:'#DCF4CE',bathCenter:'#B9DDA0',bathEdge:'#4E7F3F',foamColor:'#E6F5D8',topping:'matcha',bubbles:0.6,
    costs:[{ing_bamboo:8,ing_honey:6},{ing_bamboo:28,ing_sakura:20},{ing_bamboo:64,ing_sakura:48}],
    effects:{magicDamage:[.20,.28,.38],chargeReduction:[1,1,2]}},
  dish_herbal_tonic:{id:'dish_herbal_tonic',tier:2,bathColor:'#84B88E',steamColor:'#D7F5DF',bathCenter:'#B8DDBF',bathEdge:'#4F8059',foamColor:'#E8F7EC',topping:'herbal',bubbles:0.9,
    costs:[{ing_yuzu:8,ing_sakura:6},{ing_yuzu:30,ing_mushroom:10},{ing_yuzu:70,ing_mushroom:24}],
    effects:{shovelSpeed:[.25,.35,.45],beeSpeed:[.20,.28,.35]}},
  dish_truffle_ramen:{id:'dish_truffle_ramen',tier:3,bathColor:'#C98D52',steamColor:'#F4DEC0',bathCenter:'#E8B784',bathEdge:'#8A5528',foamColor:'#FBEBD3',topping:'truffle',bubbles:1,
    costs:[{ing_mushroom:16,ing_bamboo:20},{ing_mushroom:42,ing_chili:52},{ing_mushroom:92,ing_chili:108}],
    effects:{veteranDamage:[.28,.40,.55]}},
  dish_chill_melon:{id:'dish_chill_melon',tier:3,bathColor:'#7FD3C2',steamColor:'#D7FAF2',bathCenter:'#BDF0E4',bathEdge:'#3F9C8C',foamColor:'#F0FFFB',topping:'melon',bubbles:0.5,
    costs:[{ing_mushroom:18,ing_yuzu:16,ing_sakura:10},{ing_mushroom:45,ing_sakura:55},{ing_mushroom:98,ing_sakura:114}],
    effects:{globalSlow:[.10,.14,.18]}},
  dish_golden_feast:{id:'dish_golden_feast',tier:3,bathColor:'#F4C144',steamColor:'#FFF2B2',bathCenter:'#FFE28A',bathEdge:'#B87D19',foamColor:'#FFF5CC',topping:'feast',bubbles:1.3,
    costs:[{ing_chili:14,ing_honey:14,ing_mushroom:18},{ing_chili:55,ing_mushroom:48},{ing_chili:116,ing_mushroom:102}],
    effects:{coinBonus:[.30,.45,.60],dropBonus:[.25,.40,.55]}},
  dish_imperial_onsen:{id:'dish_imperial_onsen',tier:4,bathColor:'#FFE07D',steamColor:'#FFF9D6',bathCenter:'#FFF1B5',bathEdge:'#C99A2E',foamColor:'#FFFBE6',topping:'imperial',bubbles:1,
    costs:[every(24),every(62),every(135)],
    effects:{allDamage:[.15,.22,.30],allRate:[.10,.15,.20],startFood:[4,6,8],startOranges:[1,1,2]}},
  dish_starlight_spring:{id:'dish_starlight_spring',tier:4,bathColor:'#5659A8',steamColor:'#E5DCFF',bathCenter:'#8387D8',bathEdge:'#2D3070',foamColor:'#ECE8FF',topping:'starlight',bubbles:1.15,
    costs:[{ing_mushroom:26,ing_sakura:34,ing_bamboo:36,ing_honey:24},{ing_mushroom:65,ing_sakura:85,ing_bamboo:90,ing_honey:60},{ing_mushroom:135,ing_sakura:172,ing_bamboo:180,ing_honey:120}],
    effects:{chargeReduction:[1,1,2],bossDamage:[.24,.36,.50],momentumBonus:[.30,.45,.60]}},
  dish_golden_orchard:{id:'dish_golden_orchard',tier:4,bathColor:'#ECA32B',steamColor:'#FFEBAD',bathCenter:'#FFD56B',bathEdge:'#B06710',foamColor:'#FFF4CF',topping:'orchard',bubbles:1.25,
    costs:[{ing_mushroom:22,ing_chili:34,ing_yuzu:40,ing_honey:36},{ing_mushroom:58,ing_chili:85,ing_yuzu:100,ing_honey:90},{ing_mushroom:124,ing_chili:172,ing_yuzu:200,ing_honey:180}],
    effects:{startFood:[10,16,22],waveIncome:[3,5,7],coinBonus:[.35,.50,.70],dropBonus:[.25,.40,.55]}},
};

export const isIngredientId=(id:unknown):id is IngredientId=>typeof id==='string'&&Object.hasOwn(INGREDIENTS,id);
export const isBrothId=(id:unknown):id is BrothId=>typeof id==='string'&&Object.hasOwn(BROTHS,id);
/** Missing, fractional or out-of-range levels resolve to the nearest legal star. */
export function clampBrothLevel(value:unknown):BrothLevel {
  return (typeof value==='number'&&Number.isFinite(value)?Math.max(1,Math.min(3,Math.trunc(value))):1) as BrothLevel;
}
export const costTotal=(cost:IngredientCost)=>Object.values(cost).reduce((sum,n)=>sum+(n??0),0);

/** Battle family used by family-specific broths; bees and shovels never qualify. */
export function getUnitCombatFamily(kind:string):CombatFamily|null {
  if(Object.hasOwn(HEROES,kind))return Object.hasOwn(HERO_FAMILIES,kind)?HERO_FAMILIES[kind]:null;
  if(kind==='hamster'||kind==='corgi')return 'melee';
  if(kind==='squirrel'||kind==='hedgehog')return 'ranged';
  return Object.hasOwn(UNITS,kind)&&UNITS[kind].category==='component'?'melee':null;
}

function unlockedList(loadout?:Partial<BattleLoadout>|null):BrothId[] {
  const ids=loadout&&Array.isArray(loadout.unlockedBroths)?loadout.unlockedBroths:[];
  return [...new Set(ids.filter(isBrothId))];
}
export interface KitchenCollectionAura {unlockedCount:number;bonusLevels:number;damageBonus:number;rateBonus:number}
/** Permanent account aura from every brewed recipe, equipped or not. Empty collections are exactly zero. */
export function getKitchenCollectionAura(loadout?:Partial<BattleLoadout>|null):KitchenCollectionAura {
  const unlocked=unlockedList(loadout);
  if(!unlocked.length)return{unlockedCount:0,bonusLevels:0,damageBonus:0,rateBonus:0};
  const levels=loadout?.brothLevels&&typeof loadout.brothLevels==='object'?loadout.brothLevels:{};
  const bonusLevels=unlocked.reduce((sum,id)=>sum+Math.max(0,clampBrothLevel(levels[id])-1),0);
  return{unlockedCount:unlocked.length,bonusLevels,damageBonus:unlocked.length*.02+bonusLevels*.005,rateBonus:unlocked.length*.01};
}
/** The equipped broth only counts while it is brewed; stale or forged ids resolve to none. */
export function getActiveBroth(loadout?:Partial<BattleLoadout>|null):{def:BrothDefinition;level:BrothLevel}|null {
  const id=loadout?.activeBrothId;
  if(!isBrothId(id)||!unlockedList(loadout).includes(id))return null;
  return{def:BROTHS[id],level:clampBrothLevel(loadout?.brothLevels?.[id])};
}
/** Value of one effect from the active broth, or exactly `0` when nothing applicable is equipped. */
export function getBrothEffect(loadout:Partial<BattleLoadout>|null|undefined,key:BrothEffectKey):number {
  const active=getActiveBroth(loadout);
  return active?.def.effects[key]?.[active.level-1]??0;
}
