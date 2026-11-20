import type {BattleLoadout} from '../core/types';

/** P16 Capybara Onsen Village: five courtyard facilities, offline harvest and gentle battle buffs. */
export type FacilityId='fac_bamboo_pool'|'fac_fish_stall'|'fac_yuzu_tree'|'fac_cat_nap'|'fac_sakura_pavilion';
export type VillageResourceId='res_onsen_wood'|'res_yuzu_essence';
export type FacilityLevel=1|2|3;
export type VillageBuffKey='damage'|'rate'|'startFood'|'startOranges'|'bossDamage'|'bossFragment'|'coinBonus'|'essenceDrop';
type Triple=readonly [number,number,number];
export interface VillageCost {wood:number;essence:number;coins:number}
export interface FacilityDefinition {
  id:FacilityId;
  /** Plot centre on the 16:9 courtyard panorama, in percent. */
  spot:{left:number;top:number};
  /** Cost to reach Lv.1 / Lv.2 / Lv.3. `null` means the level is granted for free (the starter pool). */
  costs:readonly [VillageCost|null,VillageCost,VillageCost];
  coinsPerHour:Triple;
  /** One random weapon fragment every N hours per level (0 = none). */
  fragmentEveryHours?:Triple;
  /** One free gacha ticket every N hours per level (0 = none). */
  ticketEveryHours?:Triple;
  /** One golden yuzu ingredient every N hours per level (0 = none). */
  yuzuEveryHours?:Triple;
  /** Extra courtyard residents per level. */
  residents?:Triple;
  buffs:Partial<Record<VillageBuffKey,Triple>>;
}
export const FACILITY_IDS=['fac_bamboo_pool','fac_fish_stall','fac_yuzu_tree','fac_cat_nap','fac_sakura_pavilion'] as const satisfies readonly FacilityId[];
const cost=(wood:number,essence:number,coins:number):VillageCost=>({wood,essence,coins});
export const FACILITIES:Record<FacilityId,FacilityDefinition>={
  fac_bamboo_pool:{id:'fac_bamboo_pool',spot:{left:50,top:34},costs:[null,cost(10,3,120),cost(20,8,260)],coinsPerHour:[12,24,40],
    fragmentEveryHours:[0,6,6],ticketEveryHours:[0,0,12],buffs:{damage:[0,.04,.08],rate:[0,0,.04]}},
  fac_fish_stall:{id:'fac_fish_stall',spot:{left:77,top:35},costs:[cost(5,1,40),cost(10,3,100),cost(18,7,220)],coinsPerHour:[6,12,20],
    buffs:{startFood:[2,4,6]}},
  fac_yuzu_tree:{id:'fac_yuzu_tree',spot:{left:22,top:34},costs:[cost(6,2,60),cost(12,4,140),cost(22,9,300)],coinsPerHour:[4,8,14],
    yuzuEveryHours:[4,4,4],buffs:{essenceDrop:[.2,.2,.2],startOranges:[0,1,1],coinBonus:[0,0,.1]}},
  fac_cat_nap:{id:'fac_cat_nap',spot:{left:25,top:68},costs:[cost(5,1,40),cost(11,3,110),cost(19,7,230)],coinsPerHour:[5,10,18],
    residents:[1,2,3],buffs:{rate:[.03,.06,.09]}},
  fac_sakura_pavilion:{id:'fac_sakura_pavilion',spot:{left:76,top:68},costs:[cost(8,3,80),cost(15,6,180),cost(26,12,360)],coinsPerHour:[8,16,28],
    fragmentEveryHours:[12,8,6],ticketEveryHours:[0,0,12],buffs:{bossDamage:[.04,.07,.1],bossFragment:[.15,.25,.35]}},
};
export const VILLAGE_RESOURCE_IDS=['res_onsen_wood','res_yuzu_essence'] as const satisfies readonly VillageResourceId[];
export const VILLAGE_OFFLINE_CAP_MS=12*3600_000;
export const VILLAGE_WELCOME_MS=15*60_000;
export const VILLAGE_MAX_LEVEL=3;
export const VILLAGE_MAX_STARS=FACILITY_IDS.length*VILLAGE_MAX_LEVEL;
export const VILLAGE_STARTER={wood:6,essence:2,facilities:{fac_bamboo_pool:1}} as const;
export const VILLAGE_STOCK_LIMIT=99999;
export const PET_TAP_DAILY_LIMIT=10;
export const PET_TAP_COINS=5;
export const BASE_RESIDENTS=2;
/** The courtyard badge asks for a harvest once the basket is full or holds at least this many coins. */
export const HARVEST_BADGE_COINS=10;
export const RESIDENT_BASICS=['hamster','squirrel','corgi','hedgehog','bee'] as const;

export const isFacilityId=(id:unknown):id is FacilityId=>typeof id==='string'&&Object.hasOwn(FACILITIES,id);
export const isVillageResource=(id:unknown):id is VillageResourceId=>id==='res_onsen_wood'||id==='res_yuzu_essence';
export function clampFacilityLevel(value:unknown):0|FacilityLevel {
  return (typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(VILLAGE_MAX_LEVEL,Math.trunc(value))):0) as 0|FacilityLevel;
}
type FacilitySource=Partial<BattleLoadout>|Record<string,number>|null|undefined;
function levels(source:FacilitySource):Record<string,number> {
  if(!source||typeof source!=='object')return {};
  const loadout=source as Partial<BattleLoadout>;
  const raw='villageFacilities' in loadout||'equippedPassiveProps' in loadout?loadout.villageFacilities:source;
  return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,number>:{};
}
export function getFacilityLevel(source:FacilitySource,id:FacilityId):0|FacilityLevel {return clampFacilityLevel(levels(source)[id]);}
/** Sum of one buff over every built facility; exactly 0 when nothing contributes (keeps battles bit-identical). */
export function getVillageBuff(source:FacilitySource,key:VillageBuffKey):number {
  let total=0;
  for(const id of FACILITY_IDS){const level=getFacilityLevel(source,id),value=level?FACILITIES[id].buffs[key]?.[level-1]??0:0;if(value)total+=value;}
  return total;
}
export function villageTotalLevels(source:FacilitySource):number {return FACILITY_IDS.reduce((sum,id)=>sum+getFacilityLevel(source,id),0);}
