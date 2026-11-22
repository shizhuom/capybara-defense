import {
  BASE_RESIDENTS,FACILITIES,FACILITY_IDS,HARVEST_BADGE_COINS,PET_TAP_COINS,PET_TAP_DAILY_LIMIT,RESIDENT_BASICS,VILLAGE_MAX_LEVEL,
  VILLAGE_OFFLINE_CAP_MS,VILLAGE_STOCK_LIMIT,getFacilityLevel,isFacilityId,type FacilityId,type VillageCost,
} from '../config/village';
import {HEROES} from '../config/heroes';
import {progressionFor} from '../config/progression';
import {rollWeapon} from '../config/weapons';
import {grantIngredients} from './KitchenProgression';
import {grantWeaponFragments} from './MetaProgression';
import {copyVillage,villageFacilityLevels} from './VillageState';
import type {BattleLoadout,Profile} from './types';

export interface VillageResult {profile:Profile;ok:boolean;key:string;facility?:FacilityId;level?:number}
const withVillage=(profile:Profile,patch:Partial<Profile['village']>={}):Profile=>({...profile,village:{...copyVillage(profile.village),...patch}});
const fail=(profile:Profile,key:string,facility?:FacilityId):VillageResult=>({profile:withVillage(profile),ok:false,key,...(facility?{facility}:{})});
const level=(profile:Profile,id:FacilityId)=>getFacilityLevel(profile.village.facilities,id);
export const villageLevel=level;

// ── Offline harvest ──────────────────────────────────────────────────────────────────────────────────
export interface OfflineHarvest {elapsedMs:number;coins:number;fragments:number;yuzu:number;tickets:number;full:boolean}
/** Pure: what the basket holds at `nowMs`, clamped to [0, 12h] so clock rollbacks never go negative. */
export function computeOfflineHarvest(profile:Profile,nowMs:number):OfflineHarvest {
  const anchor=profile.village.lastHarvestAt,delta=Number.isFinite(nowMs)&&Number.isFinite(anchor)?nowMs-anchor:0;
  const elapsedMs=Math.max(0,Math.min(VILLAGE_OFFLINE_CAP_MS,delta)),hours=elapsedMs/3600_000;
  let perHour=0,fragments=0,yuzu=0,tickets=0;
  for(const id of FACILITY_IDS){
    const lv=level(profile,id);if(!lv)continue;const def=FACILITIES[id];
    perHour+=def.coinsPerHour[lv-1];
    const every=(table?:readonly number[])=>{const n=table?.[lv-1]??0;return n>0?Math.floor(hours/n):0;};
    fragments+=every(def.fragmentEveryHours);yuzu+=every(def.yuzuEveryHours);tickets+=every(def.ticketEveryHours);
  }
  return{elapsedMs,coins:Math.floor(perHour*hours),fragments,yuzu,tickets,full:elapsedMs>=VILLAGE_OFFLINE_CAP_MS};
}
export const hasHarvest=(h:OfflineHarvest)=>h.coins>=1||h.fragments>0||h.yuzu>0||h.tickets>0;
/** Banks coins, tickets, golden yuzu and random weapon fragments atomically, then restarts the basket clock. */
export function claimOfflineHarvest(profile:Profile,nowMs:number,random:()=>number=Math.random):VillageResult&{harvest:OfflineHarvest;newWeapons:string[]} {
  const harvest=computeOfflineHarvest(profile,nowMs);
  if(!hasHarvest(harvest))return{...fail(profile,'p16.nothingToHarvest'),harvest,newWeapons:[]};
  let p=withVillage({...profile,coins:profile.coins+harvest.coins,freeLotteryTickets:profile.freeLotteryTickets+harvest.tickets},{lastHarvestAt:nowMs});
  if(harvest.yuzu)p=grantIngredients(p,Array.from({length:harvest.yuzu},()=>'ing_yuzu'));
  let newWeapons:string[]=[];
  if(harvest.fragments){const granted=grantWeaponFragments(p,Array.from({length:harvest.fragments},()=>rollWeapon(random,undefined,1,p.unlockedWeapons)));p={...granted.profile,village:p.village};newWeapons=granted.newWeapons;}
  return{profile:p,ok:true,key:'p16.harvested',harvest,newWeapons};
}
/** A clock that jumped backwards leaves the anchor in the future; re-anchor so the basket starts filling again. */
export function settleVillageClock(profile:Profile,nowMs:number):Profile {
  return Number.isFinite(nowMs)&&profile.village.lastHarvestAt>nowMs?withVillage(profile,{lastHarvestAt:nowMs}):profile;
}

// ── Building ─────────────────────────────────────────────────────────────────────────────────────────
export function facilityUpgradeCost(id:string,currentLevel:number):VillageCost|null {
  if(!isFacilityId(id)||!Number.isInteger(currentLevel)||currentLevel<0||currentLevel>=VILLAGE_MAX_LEVEL)return null;
  const cost=FACILITIES[id].costs[currentLevel];return cost?{...cost}:null;
}
export const canAffordVillage=(profile:Profile,cost:VillageCost)=>profile.village.wood>=cost.wood&&profile.village.essence>=cost.essence&&profile.coins>=cost.coins;
export function buildableFacilities(profile:Profile):FacilityId[] {
  return FACILITY_IDS.filter(id=>{const cost=facilityUpgradeCost(id,level(profile,id));return!!cost&&canAffordVillage(profile,cost);});
}
/** Builds Lv.1 or upgrades to the next level, spending wood, essence and coins together. */
export function buildFacility(profile:Profile,id:string):VillageResult {
  if(!isFacilityId(id))return fail(profile,'p16.invalidFacility');
  const current=level(profile,id),cost=facilityUpgradeCost(id,current);
  if(current>=VILLAGE_MAX_LEVEL)return fail(profile,'p16.maxLevel',id);
  if(!cost||!canAffordVillage(profile,cost))return fail(profile,'p16.missingMaterials',id);
  const next=current+1;
  const p=withVillage({...profile,coins:profile.coins-cost.coins},{wood:profile.village.wood-cost.wood,essence:profile.village.essence-cost.essence,facilities:{...profile.village.facilities,[id]:next}});
  return{profile:p,ok:true,key:current?'p16.upgraded':'p16.built',facility:id,level:next};
}
export const villageStars=(profile:Profile)=>FACILITY_IDS.reduce((sum,id)=>sum+level(profile,id),0);
export type VillageBadge='harvest'|'build'|'stars';
/** Courtyard badge priority: a ripe basket, then something to build, then total stars. */
export function villageBadge(profile:Profile,nowMs:number):VillageBadge {
  const h=computeOfflineHarvest(profile,nowMs);
  if(h.full||h.coins>=HARVEST_BADGE_COINS)return 'harvest';
  return buildableFacilities(profile).length?'build':'stars';
}

// ── Residents & petting ──────────────────────────────────────────────────────────────────────────────
export interface VillageResident {id:string;hero:boolean;facility:FacilityId;slot:number;pose:'soak'|'nap'|'stand'}
export function residentCapacity(profile:Profile):number {
  const nap=level(profile,'fac_cat_nap');return BASE_RESIDENTS+(nap?FACILITIES.fac_cat_nap.residents![nap-1]:0);
}
/** Merged legendary heroes move in first, then unlocked basic pets; each lives beside a built facility. */
export function getVillageResidents(profile:Profile):VillageResident[] {
  const heroes=[...new Set(profile.mergedHeroes.filter(id=>Object.hasOwn(HEROES,id)))];
  const unlocked=new Set(progressionFor({stars:profile.stars,highestStars:profile.highestStars,mergedHeroes:profile.mergedHeroes}).units);
  const basics=RESIDENT_BASICS.filter(id=>unlocked.has(id));
  const pets=[...heroes,...(basics.length?basics:['hamster','squirrel'])].slice(0,residentCapacity(profile));
  const built=FACILITY_IDS.filter(id=>level(profile,id)>0);
  if(!built.length)return [];
  return pets.map((id,i)=>{const facility=built[i%built.length];
    return{id,hero:Object.hasOwn(HEROES,id),facility,slot:Math.floor(i/built.length),pose:facility==='fac_bamboo_pool'?'soak':facility==='fac_cat_nap'?'nap':'stand'};});
}
/** Every pet gets a happy hop; the first ten taps each day also pay 5 coins of pocket money. */
export function petVillageResident(profile:Profile,petId:string,day:string):VillageResult&{coins:number} {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return{...fail(profile,'p16.invalidDay'),coins:0};
  if(!getVillageResidents(profile).some(r=>r.id===petId))return{...fail(profile,'p16.petMissing'),coins:0};
  const used=profile.village.petTapDay===day?profile.village.petTapCount:0;
  if(used>=PET_TAP_DAILY_LIMIT)return{profile:withVillage(profile,{petTapDay:day,petTapCount:used}),ok:true,key:'p16.petFull',coins:0};
  return{profile:withVillage({...profile,coins:profile.coins+PET_TAP_COINS},{petTapDay:day,petTapCount:used+1}),ok:true,key:'p16.petCoins',coins:PET_TAP_COINS};
}
export const petTapsLeft=(profile:Profile,day:string)=>PET_TAP_DAILY_LIMIT-(profile.village.petTapDay===day?profile.village.petTapCount:0);

// ── Battle bridge ────────────────────────────────────────────────────────────────────────────────────
/** Profile → battle loadout: the facility levels travel as `villageFacilities`. */
export function villageLoadout(profile:Profile):Profile&BattleLoadout {return{...profile,villageFacilities:villageFacilityLevels(profile.village)};}
/** Banks battle materials (`res_onsen_wood` / `res_yuzu_essence`); unknown ids are ignored. */
export function grantVillageResources(profile:Profile,ids:readonly string[]):Profile {
  const list=Array.isArray(ids)?ids:[];
  const wood=list.filter(id=>id==='res_onsen_wood').length,essence=list.filter(id=>id==='res_yuzu_essence').length;
  if(!wood&&!essence)return withVillage(profile);
  return withVillage(profile,{wood:Math.min(VILLAGE_STOCK_LIMIT,profile.village.wood+wood),essence:Math.min(VILLAGE_STOCK_LIMIT,profile.village.essence+essence)});
}
export const localDay=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
