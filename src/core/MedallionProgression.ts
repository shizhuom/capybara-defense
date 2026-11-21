import {MEDALLION_IDS,MEDALLION_MAX_LEVEL,clampMedallionLevel,isMedallionId,medallionUpgradeCost,type MedallionId} from '../config/medallions';
import type {Profile} from './types';

/** Immutable Endless Medallion Hall transactions. Every result carries a fresh profile copy. */
export interface MedallionResult {profile:Profile;ok:boolean;key:string;medallionId?:MedallionId;level?:number;cost?:{crests:number;coins:number}}

const crestCount=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
/** All six ids, each clamped to 0..50; unknown keys are dropped. */
export function normalizeMedallions(raw:unknown):Record<MedallionId,number> {
  const data=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  return Object.fromEntries(MEDALLION_IDS.map(id=>[id,clampMedallionLevel(data[id])])) as Record<MedallionId,number>;
}
const copy=(profile:Profile):Profile=>({...profile,endlessCrests:crestCount(profile.endlessCrests),endlessMedallions:normalizeMedallions(profile.endlessMedallions)});
const fail=(profile:Profile,key:string,medallionId?:MedallionId):MedallionResult=>({profile:copy(profile),ok:false,key,...(medallionId?{medallionId}:{})});

export const getProfileMedallionLevel=(profile:Profile,id:MedallionId):number=>clampMedallionLevel(profile.endlessMedallions?.[id]);
export const profileMedallionTotal=(profile:Profile):number=>MEDALLION_IDS.reduce((sum,id)=>sum+getProfileMedallionLevel(profile,id),0);
export function canAffordMedallion(profile:Profile,id:MedallionId):boolean {
  const cost=medallionUpgradeCost(getProfileMedallionLevel(profile,id));
  return!!cost&&crestCount(profile.endlessCrests)>=cost.crests&&profile.coins>=cost.coins;
}
export const upgradeableMedallions=(profile:Profile):MedallionId[]=>MEDALLION_IDS.filter(id=>canAffordMedallion(profile,id));

/** Spend crests and coins (`crests × 2`) to raise one medallion by a single level. */
export function upgradeMedallion(profile:Profile,id:string):MedallionResult {
  if(!isMedallionId(id))return fail(profile,'p17.invalidMedallion');
  const level=getProfileMedallionLevel(profile,id),cost=medallionUpgradeCost(level);
  if(!cost||level>=MEDALLION_MAX_LEVEL)return fail(profile,'p17.medallionMax',id);
  if(crestCount(profile.endlessCrests)<cost.crests)return fail(profile,'p17.noCrests',id);
  if(profile.coins<cost.coins)return fail(profile,'meta.insufficientCoins',id);
  const p=copy(profile);
  p.endlessCrests-=cost.crests;p.coins-=cost.coins;p.endlessMedallions[id]=level+1;
  return{profile:p,ok:true,key:'p17.medallionUpgraded',medallionId:id,level:level+1,cost};
}
/** Adds crests from a trusted receipt (never negative, never unsafe). */
export function grantEndlessCrests(profile:Profile,amount:number):Profile {
  const p=copy(profile),add=crestCount(amount),next=p.endlessCrests+add;
  p.endlessCrests=Number.isSafeInteger(next)?next:p.endlessCrests;return p;
}
