import { FRAGMENTS } from '../config/enemies';
import { createProfile, grantWeaponFragments, normalizeProfile, unlockAllProfile } from '../core/MetaProgression';
import { applyBattleProgress,recordMergedHeroes } from '../core/PlayerProgression';
import { grantIngredients } from '../core/KitchenProgression';
import { grantVillageResources } from '../core/VillageProgression';
import type { BattleResult, Profile } from '../core/types';
import { HEROES } from '../config/heroes';
import { STANDARD_VICTORY_CRESTS, endlessCrestsThroughWave } from '../config/medallions';
import { isFeatureUnlocked } from '../core/FeatureUnlocks';

export const STORAGE_PREFIX = 'capybara_defense_v1:';
const validFragments = new Set<string>(FRAGMENTS);

export function browserStorage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function readSetting(key: string, storage = browserStorage()): string | null {
  try { return storage?.getItem(`${STORAGE_PREFIX}${key}`) ?? null; }
  catch { return null; }
}

export function writeSetting(key: string, value: string, storage = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(`${STORAGE_PREFIX}${key}`, value);
    return true;
  } catch { return false; }
}

export function emptyProfile(): Profile {
  return createProfile();
}

const counter = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function loadProfile(storage = browserStorage()): Profile {
  try {
    const raw: unknown = JSON.parse(readSetting('profile', storage) ?? 'null');
    return normalizeProfile(raw);
  } catch { return emptyProfile(); }
}

export function saveProfile(profile: Profile, storage = browserStorage()): boolean {
  return writeSetting('profile', JSON.stringify(profile), storage);
}

/** A receipt and its rewards are saved together, so revisiting a result cannot pay twice. */
export function awardBattle(profile: Profile, battleId: string, result: BattleResult): { profile: Profile; awarded: boolean; newWeapons:string[]; ticketAwarded?:boolean } {
  if (!battleId || result?.endless || profile.awardedBattles.includes(battleId)) return { profile, awarded: false, newWeapons:[] };
  const won = result.winner === 'player';
  const p=normalizeProfile(profile);
  const legacy=won ? result.loot.filter(id=>validFragments.has(id)) : [];
  const granted=grantWeaponFragments(p,won ? [...result.loot,...legacy.map(()=>'m01_swatter')] : []);
  // Ingredients are banked on victory and as defeat salvage, under this same receipt.
  const ingredients=grantIngredients(p,Array.isArray(result.ingredientLoot)?result.ingredientLoot:[]).ingredients;
  const village=grantVillageResources(p,Array.isArray(result.villageLoot)?result.villageLoot:[]).village;
  // P19: free lottery tickets unlock with Market (5★) and pay 1 ticket every 3 wins (keeping a visible 0..2/3 progress hook).
  const marketReady=isFeatureUnlocked(p,'market');
  let gachaWinCounter=p.gachaWinCounter??0,ticketAwarded=false;
  if(won&&marketReady){
    gachaWinCounter+=1;
    if(gachaWinCounter>=3){gachaWinCounter=0;ticketAwarded=true;}
  }
  const crestsGain=won&&result.reason==='waves'?(result.endlessCrests!==undefined?counter(result.endlessCrests):(isFeatureUnlocked(p,'medallions')?STANDARD_VICTORY_CRESTS:0)):0;
  return {
    awarded: true,
    newWeapons:granted.newWeapons,
    ticketAwarded,
    profile: applyBattleProgress({
      ...granted.profile,
      coins: profile.coins + (won ? counter(result.coins) : 0),
      wins: profile.wins + (won ? 1 : 0), matches: profile.matches + 1,
      fragments: [...p.fragments, ...legacy],
      awardedBattles: [...profile.awardedBattles, battleId],
      freeLotteryTickets:p.freeLotteryTickets+(ticketAwarded?1:0),gachaWinCounter,ingredients,village,
      endlessCrests:p.endlessCrests+crestsGain,
    },won,result.mergedHeroes),
  };
}

/** The standard receipt must already be banked. Save this bonus and its own receipt atomically. */
export function awardEndless(profile:Profile,battleId:string,result:BattleResult):{profile:Profile;awarded:boolean;newWeapons:string[]} {
  const p=normalizeProfile(profile),rejected={profile:p,awarded:false,newWeapons:[] as string[]};
  if(typeof battleId!=='string'||!battleId.trim()||battleId.length>191||!p.awardedBattles.includes(battleId))return rejected;
  const receipt=`${battleId}:endless`,wave=result?.endlessWave,bonus=result?.endlessCoins,loot=result?.endlessLoot;
  if(p.awardedBattles.includes(receipt)||!result||result.endless!==true||result.winner!=='player'||
    typeof wave!=='number'||!Number.isSafeInteger(wave)||wave<11||
    typeof bonus!=='number'||!Number.isSafeInteger(bonus)||bonus<0||
    !Array.isArray(loot)||!loot.every(id=>typeof id==='string'))return rejected;
  const harvest=result.endlessIngredientLoot;
  if(harvest!==undefined&&(!Array.isArray(harvest)||!harvest.every(id=>typeof id==='string')))return rejected;
  const materials=result.endlessVillageLoot;
  if(materials!==undefined&&(!Array.isArray(materials)||!materials.every(id=>typeof id==='string')))return rejected;
  const coins=p.coins+bonus;
  if(!Number.isSafeInteger(coins))return rejected;
  // P17 crests: optional on older receipts, never more than the cleared waves can pay.
  const crests=result.endlessCrests??0;
  if(typeof crests!=='number'||!Number.isSafeInteger(crests)||crests<0||crests>endlessCrestsThroughWave(wave))return rejected;
  const legacy=loot.filter(id=>validFragments.has(id));
  const granted=grantWeaponFragments(p,[...loot,...legacy.map(()=>'m01_swatter')]);
  const heroes=Array.isArray(result.mergedHeroes)?result.mergedHeroes.filter(id=>typeof id==='string'):[];
  const ingredients=grantIngredients(p,harvest??[]).ingredients,village=grantVillageResources(p,materials??[]).village;
  const next:Profile={...granted.profile,coins,ingredients,village,
    fragments:[...p.fragments,...legacy],awardedBattles:[...p.awardedBattles,receipt],
    bestEndlessWave:Math.max(p.bestEndlessWave??0,wave),endlessCrests:p.endlessCrests+crests};
  const record=bestEndlessRecord(p,wave,result);
  if(record){
    // A new best replaces the whole record, so an older MVP never lingers beside a newer wave.
    delete next.bestEndlessTime;delete next.bestEndlessMvp;delete next.bestEndlessMvpAwakened;delete next.bestEndlessAwakened;
    Object.assign(next,record);
  }
  return {awarded:true,newWeapons:granted.newWeapons,profile:recordMergedHeroes(next,heroes)};
}

/** A higher wave (or the same wave in less time) refreshes the run metadata the global board shows. */
function bestEndlessRecord(p:Profile,wave:number,result:BattleResult):Partial<Profile>|null {
  const elapsed=typeof result.elapsed==='number'&&Number.isFinite(result.elapsed)&&result.elapsed>=0?Math.round(result.elapsed):undefined;
  const best=p.bestEndlessWave??0,faster=wave===best&&elapsed!==undefined&&(p.bestEndlessTime===undefined||elapsed<p.bestEndlessTime);
  if(wave<=best&&!faster)return null;
  const record:Partial<Profile>={};
  if(elapsed!==undefined)record.bestEndlessTime=elapsed;
  const mvp=result.mvp?.kind;
  if(typeof mvp==='string'&&Object.hasOwn(HEROES,mvp)){record.bestEndlessMvp=mvp;if(result.mvp?.awakened===true)record.bestEndlessMvpAwakened=true;}
  const awakened=result.awakenedCount;
  record.bestEndlessAwakened=typeof awakened==='number'&&Number.isSafeInteger(awakened)&&awakened>=0?Math.min(40,awakened):0;
  return record;
}

export function isTestProfile(storage = browserStorage()):boolean {
  return readSetting('normalProfileBackup',storage)!==null;
}

/** Persist the backup first; repeated activation must never replace it with a test save. */
export function enableTestProfile(storage = browserStorage()):Profile {
  const profile=loadProfile(storage);
  const alreadyActive=isTestProfile(storage);
  if(!alreadyActive&&!writeSetting('normalProfileBackup',JSON.stringify(profile),storage)) return profile;
  const full=unlockAllProfile(profile);
  if(!saveProfile(full,storage)) {
    // This attempt never activated: its new backup must not later undo normal play.
    // A prior active test session still needs its original backup for restoration.
    if(!alreadyActive) {
      try {storage?.removeItem(`${STORAGE_PREFIX}normalProfileBackup`);} catch { /* Storage may be disabled. */ }
    }
    return profile;
  }
  return full;
}

export function restoreNormalProfile(storage = browserStorage()):Profile {
  const backup=readSetting('normalProfileBackup',storage);
  if(backup===null) return loadProfile(storage);
  try {
    const raw:unknown=JSON.parse(backup);
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) return loadProfile(storage);
    const profile=normalizeProfile(raw);
    if(!saveProfile(profile,storage)) return loadProfile(storage);
    storage?.removeItem(`${STORAGE_PREFIX}normalProfileBackup`);
    return profile;
  } catch {return loadProfile(storage);}
}

export function resetOwnStorage(storage = browserStorage()): boolean {
  try {
    if (!storage) return false;
    const ownKeys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) ownKeys.push(key);
    }
    for (const key of ownKeys) storage.removeItem(key);
    return true;
  } catch { return false; }
}
