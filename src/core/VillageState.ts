import {FACILITY_IDS,PET_TAP_DAILY_LIMIT,VILLAGE_STARTER,VILLAGE_STOCK_LIMIT,VILLAGE_WELCOME_MS,clampFacilityLevel,isFacilityId} from '../config/village';
import type {VillageState} from './types';

/**
 * Session clock for new or migrated villages. Every profile created in one session shares the same
 * anchor (so `createProfile()` equals `normalizeProfile(null)`), and the first visit already shows a
 * small 15-minute welcome harvest.
 */
export const VILLAGE_EPOCH=Date.now();
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?Math.min(VILLAGE_STOCK_LIMIT,value):0;
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

/** New and pre-P16 saves receive the welcome gift: the starter pool, 6 wood and 2 essence. */
export function createVillage(now=VILLAGE_EPOCH):VillageState {
  return{wood:VILLAGE_STARTER.wood,essence:VILLAGE_STARTER.essence,facilities:{...VILLAGE_STARTER.facilities},lastHarvestAt:now-VILLAGE_WELCOME_MS,petTapDay:'',petTapCount:0};
}
export function copyVillage(village:VillageState):VillageState {return{...village,facilities:{...village.facilities}};}
/** Sanitizes a stored village; an absent village is the welcome gift, an existing one is never re-gifted. */
export function normalizeVillage(raw:unknown,now=VILLAGE_EPOCH):VillageState {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return createVillage(now);
  const data=object(raw),levels=object(data.facilities),facilities:Record<string,number>={};
  for(const id of FACILITY_IDS){const level=clampFacilityLevel(levels[id]);if(level)facilities[id]=level;}
  const anchor=data.lastHarvestAt;
  const petTapDay=typeof data.petTapDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(data.petTapDay)?data.petTapDay:'';
  return{wood:count(data.wood),essence:count(data.essence),facilities,
    lastHarvestAt:typeof anchor==='number'&&Number.isFinite(anchor)&&anchor>=0?anchor:now-VILLAGE_WELCOME_MS,
    petTapDay,petTapCount:petTapDay?Math.min(PET_TAP_DAILY_LIMIT,count(data.petTapCount)):0};
}
export const villageFacilityLevels=(village:VillageState):Record<string,number>=>Object.fromEntries(Object.entries(village.facilities).filter(([id,n])=>isFacilityId(id)&&clampFacilityLevel(n)>0));
