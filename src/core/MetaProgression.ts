import { FRAGMENTS } from '../config/enemies';
import { HERO_FAMILIES, RARITY_RULES, WEAPONS, rollWeapon } from '../config/weapons';
import { PROPS,META_PRICES } from '../config/props';
import { HEROES } from '../config/heroes';
import { AVATARS, DEFAULT_AVATARS } from '../config/avatars';
import { BROTH_IDS, INGREDIENT_IDS, INGREDIENT_STACK_LIMIT, clampBrothLevel, isBrothId, isIngredientId } from '../config/kitchen';
import { FACILITY_IDS } from '../config/village';
import { copyVillage, createVillage, normalizeVillage } from './VillageState';
import { MEDALLION_IDS, MEDALLION_MAX_LEVEL } from '../config/medallions';
import { normalizeMedallions } from './MedallionProgression';
import { SESSION_PLAYER_ID, SESSION_WRITE_SECRET, normalizePlayerId, normalizeWriteSecret, validateNickname } from './PlayerIdentity';
import { isFictionalLocation, sanitizeLocation } from './Location';
import { HEROES as HERO_TABLE } from '../config/heroes';
import { DEFAULT_SETTINGS, getUnlockedMaps, unlockAchievements, updateSettings } from './PlayerProgression';
import { allOnboardedTokens, sanitizeOnboardedFeatures } from './FeatureUnlocks';
import type { Profile } from './types';

export interface MetaResult { profile:Profile; ok:boolean; key:string; amount?:number; newWeapons?:string[] }
export interface LotteryPrize { type:'prop'|'coins'|'fragment'; id?:string; amount:number }
const has = (object:object,key:string) => Object.hasOwn(object,key);
const object = (value:unknown):Record<string,unknown> => value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
const count = (value:unknown):number => typeof value==='number' && Number.isSafeInteger(value) && value>=0 ? value : 0;
const strings = (value:unknown):string[] => Array.isArray(value) ? value.filter((id):id is string=>typeof id==='string') : [];
const unique = (ids:string[]) => [...new Set(ids)];
const sample = (random:()=>number) => Math.max(0,Math.min(.999999999999,Number(random())||0));
const choose = <T>(pool:T[],random:()=>number):T => pool[Math.floor(sample(random)*pool.length)];
const copy = (profile:Profile):Profile => ({...profile,fragments:[...profile.fragments],awardedBattles:[...profile.awardedBattles],
  weaponFragments:{...profile.weaponFragments},unlockedWeapons:[...profile.unlockedWeapons],equippedWeapons:{...profile.equippedWeapons},
  ownedProps:{...profile.ownedProps},equippedActiveProps:[...profile.equippedActiveProps],equippedPassiveProps:[...profile.equippedPassiveProps],
  unlockedAvatars:[...profile.unlockedAvatars],mergedHeroes:[...profile.mergedHeroes],settings:{...profile.settings},
  shop:profile.shop ? {...profile.shop,offers:[...profile.shop.offers]} : null,
  ingredients:{...(profile.ingredients??{})},unlockedBroths:[...(profile.unlockedBroths??[])],brothLevels:{...(profile.brothLevels??{})},activeBrothId:profile.activeBrothId??null,
  village:profile.village?copyVillage(profile.village):createVillage(),
  endlessMedallions:normalizeMedallions(profile.endlessMedallions),
  onboardedFeatures:[...(profile.onboardedFeatures??[])],gachaWinCounter:profile.gachaWinCounter??0});
const fail = (profile:Profile,key:string):MetaResult => ({profile:copy(profile),ok:false,key});
const success = (profile:Profile,key:string,amount?:number):MetaResult => ({profile:unlockAchievements(profile),ok:true,key,...(amount===undefined?{}:{amount})});

export function createProfile():Profile {
  return {coins:0,wins:0,matches:0,fragments:[],awardedBattles:[],schemaVersion:2,tutorialCompleted:false,tutorialRewardClaimed:false,earlyWaveTipSeen:false,bestEndlessWave:0,
    weaponFragments:{},unlockedWeapons:[],equippedWeapons:{},ownedProps:{},equippedActiveProps:[],equippedPassiveProps:[],freeLotteryTickets:0,shop:null,
    stars:0,highestStars:0,winStreak:0,bestWinStreak:0,selectedMap:'auto',avatarId:'capybara',unlockedAvatars:[...DEFAULT_AVATARS],mergedHeroes:[],settings:{...DEFAULT_SETTINGS},
    // P19: ingredients, village materials & crests are gifted on each system's unlock milestone.
    ingredients:{...STARTER_INGREDIENTS},unlockedBroths:[],brothLevels:{},activeBrothId:null,
    village:createVillage(),
    endlessCrests:0,endlessMedallions:normalizeMedallions(null),playerId:SESSION_PLAYER_ID,writeSecret:SESSION_WRITE_SECRET,nickname:'',locationMode:'unset',locationLabel:'',
    onboardedFeatures:[],gachaWinCounter:0};
}
/** P19: starter kitchen ingredients are granted interactively when Kitchen unlocks at 23★. */
export const STARTER_INGREDIENTS:Readonly<Record<string,number>>=Object.freeze({});
function normalizeKitchen(p:Profile,data:Record<string,unknown>):void {
  if(has(data,'ingredients')){
    const stock=Object.entries(object(data.ingredients)).filter(([id,n])=>isIngredientId(id)&&count(n)>0);
    p.ingredients=Object.fromEntries(stock.map(([id,n])=>[id,Math.min(INGREDIENT_STACK_LIMIT,count(n))]));
  }
  p.unlockedBroths=unique(strings(data.unlockedBroths).filter(isBrothId));
  const levels=object(data.brothLevels);
  p.brothLevels=Object.fromEntries(p.unlockedBroths.map(id=>[id,clampBrothLevel(levels[id])]));
  p.activeBrothId=typeof data.activeBrothId==='string'&&p.unlockedBroths.includes(data.activeBrothId)?data.activeBrothId:null;
}
/** P17 fields are optional in old saves: zero crests, Lv.0 medallions, a fresh id/secret and the default nickname. */
function normalizeEndless(p:Profile,data:Record<string,unknown>):void {
  p.endlessCrests=count(data.endlessCrests);
  p.endlessMedallions=normalizeMedallions(data.endlessMedallions);
  p.playerId=normalizePlayerId(data.playerId);
  p.writeSecret=normalizeWriteSecret(data.writeSecret);
  const name=validateNickname(data.nickname);p.nickname=name.ok?name.value:'';
  const loc=sanitizeLocation(data.locationLabel);
  if(data.locationMode==='real'&&loc&&!isFictionalLocation(loc)){p.locationMode='real';p.locationLabel=loc;}
  else if(data.locationMode==='fictional'){p.locationMode='fictional';p.locationLabel=isFictionalLocation(loc)?loc:'';}
  else{p.locationMode='unset';p.locationLabel='';}
  if(data.rankTainted===true)p.rankTainted=true;
  // Best-run metadata only travels with a real endless record.
  if((p.bestEndlessWave??0)>=11){
    const time=data.bestEndlessTime,awakened=data.bestEndlessAwakened,mvp=data.bestEndlessMvp;
    if(typeof time==='number'&&Number.isSafeInteger(time)&&time>=0&&time<=864_000)p.bestEndlessTime=time;
    if(typeof mvp==='string'&&has(HERO_TABLE,mvp))p.bestEndlessMvp=mvp;
    if(p.bestEndlessMvp&&data.bestEndlessMvpAwakened===true)p.bestEndlessMvpAwakened=true;
    if(typeof awakened==='number'&&Number.isSafeInteger(awakened)&&awakened>=0&&awakened<=40)p.bestEndlessAwakened=awakened;
  }
}
export function normalizeProfile(raw:unknown):Profile {
  const data=object(raw);const p=createProfile();
  p.coins=count(data.coins);p.matches=count(data.matches);p.wins=Math.min(count(data.wins),p.matches);
  p.tutorialCompleted=typeof data.tutorialCompleted==='boolean'?data.tutorialCompleted:p.matches>0;
  p.tutorialRewardClaimed=typeof data.tutorialRewardClaimed==='boolean'?data.tutorialRewardClaimed:p.matches>0||p.tutorialCompleted;
  p.earlyWaveTipSeen=data.earlyWaveTipSeen===true;
  p.bestEndlessWave=count(data.bestEndlessWave)>=11?count(data.bestEndlessWave):0;
  // Only absence migrates from wins: explicit zero and malformed stars never replay progress.
  p.stars=has(data,'stars')?count(data.stars):p.wins;
  p.highestStars=Math.max(p.stars,count(data.highestStars));
  p.winStreak=count(data.winStreak);p.bestWinStreak=Math.max(p.winStreak,count(data.bestWinStreak));
  p.unlockedAvatars=unique([...DEFAULT_AVATARS,...strings(data.unlockedAvatars).filter(id=>has(AVATARS,id))]);
  p.avatarId=typeof data.avatarId==='string'?data.avatarId:'capybara';
  p.mergedHeroes=unique(strings(data.mergedHeroes).filter(id=>has(HEROES,id)));
  p.settings=updateSettings(p,object(data.settings)).settings;
  const selectedMap=data.selectedMap;
  if(selectedMap==='auto'||getUnlockedMaps(p).some(id=>id===selectedMap)) p.selectedMap=selectedMap as Profile['selectedMap'];
  const validLegacy=new Set<string>(FRAGMENTS);
  p.fragments=strings(data.fragments).filter(id=>validLegacy.has(id));
  p.awardedBattles=unique(strings(data.awardedBattles).filter(id=>id.length>0&&id.length<200));
  p.weaponFragments=Object.fromEntries(Object.entries(object(data.weaponFragments)).filter(([id,n])=>has(WEAPONS,id)&&count(n)>0).map(([id,n])=>[id,count(n)]));
  // A schema marker makes conversion idempotent while preserving the old list as history.
  if(data.schemaVersion!==2&&p.fragments.length) p.weaponFragments.m01_swatter=(p.weaponFragments.m01_swatter??0)+p.fragments.length;
  p.unlockedWeapons=unique(strings(data.unlockedWeapons).filter(id=>has(WEAPONS,id)));
  for(const weapon of Object.values(WEAPONS)) {
    if((p.weaponFragments[weapon.id]??0)>=RARITY_RULES[weapon.rarity].fragments&&!p.unlockedWeapons.includes(weapon.id)) p.unlockedWeapons.push(weapon.id);
  }
  const used=new Set<string>();
  for(const [hero,id] of Object.entries(object(data.equippedWeapons))) {
    if(typeof id==='string'&&has(HERO_FAMILIES,hero)&&has(WEAPONS,id)&&p.unlockedWeapons.includes(id)&&WEAPONS[id].family===HERO_FAMILIES[hero]&&!used.has(id)) {
      p.equippedWeapons[hero]=id;used.add(id);
    }
  }
  p.ownedProps=Object.fromEntries(Object.entries(object(data.ownedProps)).filter(([id,n])=>has(PROPS,id)&&count(n)>0).map(([id,n])=>[id,Math.min(count(n),PROPS[id].maxLevel)]));
  const slots=(value:unknown,type:'active'|'passive',max:number)=>unique(strings(value)).filter(id=>has(PROPS,id)&&PROPS[id].type===type&&(p.ownedProps[id]??0)>0).slice(0,max);
  p.equippedActiveProps=slots(data.equippedActiveProps,'active',2);p.equippedPassiveProps=slots(data.equippedPassiveProps,'passive',6);
  p.freeLotteryTickets=count(data.freeLotteryTickets);
  const shop=object(data.shop);
  if(typeof shop.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(shop.day)) p.shop={day:shop.day,offers:unique(strings(shop.offers).filter(id=>has(PROPS,id))).slice(0,3)};
  normalizeKitchen(p,data);
  // An absent village (new or pre-P16 save) receives the welcome gift; an existing one is never re-gifted.
  p.village=normalizeVillage(data.village);
  normalizeEndless(p,data);
  p.onboardedFeatures=sanitizeOnboardedFeatures(data.onboardedFeatures);
  p.gachaWinCounter=Math.min(2,count(data.gachaWinCounter));
  return unlockAchievements(p);
}
export function grantWeaponFragments(profile:Profile,ids:string[]):{profile:Profile;newWeapons:string[]} {
  const p=copy(profile);const newWeapons:string[]=[];
  for(const id of ids) {
    if(!has(WEAPONS,id)) continue;
    p.weaponFragments[id]=(p.weaponFragments[id]??0)+1;
    if(!p.unlockedWeapons.includes(id)&&p.weaponFragments[id]>=RARITY_RULES[WEAPONS[id].rarity].fragments) {p.unlockedWeapons.push(id);newWeapons.push(id);}
  }
  return {profile:unlockAchievements(p),newWeapons};
}
export function equipWeapon(profile:Profile,heroId:string,weaponId:string|null):MetaResult {
  if(!has(HERO_FAMILIES,heroId)) return fail(profile,'meta.invalidHero');
  if(weaponId===null) {const p=copy(profile);delete p.equippedWeapons[heroId];return success(p,'meta.unequipped');}
  if(!has(WEAPONS,weaponId)) return fail(profile,'meta.invalidWeapon');
  if(!profile.unlockedWeapons.includes(weaponId)) return fail(profile,'meta.weaponLocked');
  if(WEAPONS[weaponId].family!==HERO_FAMILIES[heroId]) return fail(profile,'meta.wrongFamily');
  const p=copy(profile);
  for(const [hero,id] of Object.entries(p.equippedWeapons)) if(id===weaponId) delete p.equippedWeapons[hero];
  p.equippedWeapons[heroId]=weaponId;return success(p,'meta.equipped');
}
export function recycleFragments(profile:Profile,rarities:number[]):MetaResult {
  const p=copy(profile);let amount=0;
  for(const id of p.unlockedWeapons) {
    const weapon=WEAPONS[id];if(!weapon||!rarities.includes(weapon.rarity)) continue;
    const rule=RARITY_RULES[weapon.rarity];const surplus=Math.max(0,(p.weaponFragments[id]??0)-rule.fragments);
    if(surplus) {amount+=surplus*rule.recycle;p.weaponFragments[id]-=surplus;}
  }
  if(!amount) return fail(profile,'meta.noFragments');
  p.coins+=amount;return success(p,'meta.recycled',amount);
}
export function setPropSlots(profile:Profile,active:string[],passive:string[]):MetaResult {
  const valid=(ids:string[],type:'active'|'passive',max:number)=>ids.length<=max&&unique(ids).length===ids.length&&ids.every(id=>has(PROPS,id)&&PROPS[id].type===type&&(profile.ownedProps[id]??0)>0);
  if(!valid(active,'active',2)||!valid(passive,'passive',6)) return fail(profile,'meta.invalidSlots');
  const p=copy(profile);p.equippedActiveProps=[...active];p.equippedPassiveProps=[...passive];return success(p,'meta.equipped');
}
export function equipProp(profile:Profile,id:string):MetaResult {
  if(!has(PROPS,id)) return fail(profile,'meta.invalidProp');
  if(!(profile.ownedProps[id]>0)) return fail(profile,'meta.propNotOwned');
  const key=PROPS[id].type==='active'?'equippedActiveProps':'equippedPassiveProps';const max=PROPS[id].type==='active'?2:6;
  const p=copy(profile);const equipped=p[key].includes(id);
  if(equipped) p[key]=p[key].filter(item=>item!==id);
  else if(p[key].length>=max) return fail(profile,'meta.slotsFull');
  else p[key].push(id);
  return success(p,equipped?'meta.unequipped':'meta.equipped');
}
function shopOffers(profile:Profile,random:()=>number):string[] {
  const pool=Object.values(PROPS).filter(p=>(profile.ownedProps[p.id]??0)<p.maxLevel).map(p=>p.id);const offers:string[]=[];
  while(pool.length&&offers.length<3) {const index=Math.floor(sample(random)*pool.length);offers.push(pool.splice(index,1)[0]);}
  return offers;
}
export function ensureDailyShop(profile:Profile,day:string,random:()=>number):Profile {
  const p=copy(profile);if(p.shop?.day===day) return unlockAchievements(p);
  p.shop={day,offers:shopOffers(p,random)};return unlockAchievements(p);
}
export function refreshShop(profile:Profile,day:string,random:()=>number):MetaResult {
  if(profile.coins<META_PRICES.shopRefresh) return fail(profile,'meta.insufficientCoins');
  if(!Object.values(PROPS).some(p=>(profile.ownedProps[p.id]??0)<p.maxLevel)) return fail(profile,'meta.shopEmpty');
  const p=copy(profile);p.coins-=META_PRICES.shopRefresh;p.shop={day,offers:shopOffers(p,random)};return success(p,'meta.shopRefreshed',-META_PRICES.shopRefresh);
}
/** Replace one newly capped item without rerolling the other shelf slots. */
function replaceCappedShopOffer(profile:Profile,id:string):void {
  const shop=profile.shop;
  if(!shop||(profile.ownedProps[id]??0)<PROPS[id].maxLevel||!shop.offers.includes(id)) return;
  const replacement=Object.values(PROPS).find(prop=>(profile.ownedProps[prop.id]??0)<prop.maxLevel&&!shop.offers.includes(prop.id));
  shop.offers=shop.offers.flatMap(offer=>offer===id ? (replacement ? [replacement.id] : []) : [offer]);
}
export function buyProp(profile:Profile,id:string):MetaResult {
  if(!has(PROPS,id)) return fail(profile,'meta.invalidProp');
  const definition=PROPS[id];const level=profile.ownedProps[id]??0;
  if(level>=definition.maxLevel) return fail(profile,'meta.propMaxLevel');
  if(!profile.shop?.offers.includes(id)) return fail(profile,'meta.propNotOffered');
  if(profile.coins<definition.price) return fail(profile,'meta.insufficientCoins');
  const p=copy(profile);p.coins-=definition.price;p.ownedProps[id]=level+1;
  replaceCappedShopOffer(p,id);
  return success(p,'meta.purchased',-definition.price);
}
export function createLotteryPrizes(profile:Profile,random:()=>number):LotteryPrize[] {
  const pool=Object.keys(PROPS);const prizes:LotteryPrize[]=[];
  for(let i=0;i<3;i++) {const id=choose(pool,random);pool.splice(pool.indexOf(id),1);prizes.push({type:'prop',id,amount:1});}
  prizes.push(...[40,80,160].map(amount=>({type:'coins' as const,amount})),
    {type:'fragment',id:rollWeapon(random,[3],1,profile.unlockedWeapons),amount:1},{type:'fragment',id:rollWeapon(random,[4],1,profile.unlockedWeapons),amount:1});
  return prizes;
}
export type LotteryPayment = 'auto' | 'ticket' | 'coins';
export function spinLottery(profile:Profile,prizes:LotteryPrize[],random:()=>number,payment:LotteryPayment='auto'):MetaResult&{prize?:LotteryPrize;index?:number} {
  const valid=(prize:LotteryPrize)=>prize&&Number.isSafeInteger(prize.amount)&&prize.amount>0&&
    (prize.type==='coins'?[40,80,160].includes(prize.amount):prize.type==='prop'?typeof prize.id==='string'&&has(PROPS,prize.id)&&prize.amount===1:
      prize.type==='fragment'&&typeof prize.id==='string'&&has(WEAPONS,prize.id)&&WEAPONS[prize.id].rarity>=3&&prize.amount===1);
  if(prizes.length!==8||!prizes.every(valid)) return fail(profile,'meta.invalidPrizes');
  const useTicket=payment==='ticket'||(payment==='auto'&&profile.freeLotteryTickets>0);
  if(useTicket&&profile.freeLotteryTickets<=0) return fail(profile,'p9.noTickets');
  if(!useTicket&&profile.coins<META_PRICES.lottery) return fail(profile,'meta.insufficientCoins');
  let p=copy(profile);if(useTicket) p.freeLotteryTickets--;else p.coins-=META_PRICES.lottery;
  const index=Math.floor(sample(random)*prizes.length);const prize={...prizes[index]};let newWeapons:string[]=[];
  if(prize.type==='coins') p.coins+=prize.amount;
  else if(prize.type==='prop') {
    const id=prize.id!;if((p.ownedProps[id]??0)>=PROPS[id].maxLevel) p.coins+=PROPS[id].price;
    else {p.ownedProps[id]=(p.ownedProps[id]??0)+1;replaceCappedShopOffer(p,id);}
  } else {const granted=grantWeaponFragments(p,[prize.id!]);p=granted.profile;newWeapons=granted.newWeapons;}
  return {...success(p,'meta.lotteryWon'),prize,index,newWeapons};
}
export function unlockAllProfile(profile:Profile):Profile {
  const p=copy(profile);p.coins=9999;p.unlockedWeapons=Object.keys(WEAPONS);
  p.tutorialCompleted=true;p.tutorialRewardClaimed=true;
  p.stars=Math.max(180,p.stars);p.highestStars=Math.max(p.highestStars,p.stars);p.matches=Math.max(30,p.matches);
  p.onboardedFeatures=allOnboardedTokens();
  p.unlockedAvatars=Object.keys(AVATARS);p.mergedHeroes=Object.keys(HEROES);
  p.equippedWeapons={};
  for(const weapon of Object.values(WEAPONS)) {
    p.weaponFragments[weapon.id]=Math.max(p.weaponFragments[weapon.id]??0,RARITY_RULES[weapon.rarity].fragments);
    if(weapon.signatureHero) p.equippedWeapons[weapon.signatureHero]=weapon.id;
  }
  p.ownedProps=Object.fromEntries(Object.values(PROPS).map(prop=>[prop.id,prop.maxLevel]));
  p.equippedActiveProps=['washer','clay'];p.equippedPassiveProps=['gold_doge','auto_shovel','giant_orange_cat','vip_poster','extra_oranges','promo_badge'];
  if(p.shop) p.shop.offers=[];
  p.unlockedBroths=[...BROTH_IDS];p.brothLevels=Object.fromEntries(BROTH_IDS.map(id=>[id,3]));
  p.ingredients=Object.fromEntries(INGREDIENT_IDS.map(id=>[id,99]));
  // Keep an explicitly chosen soak only; unlocking everything must not equip one for test battles.
  p.activeBrothId=profile.activeBrothId??null;
  p.village={...p.village,wood:99,essence:99,facilities:Object.fromEntries(FACILITY_IDS.map(id=>[id,3])),lastHarvestAt:Date.now()-6*3600_000};
  // P17: every medallion at Lv.50 plus a crest stash; they only act in endless, so the ten standard waves are unchanged.
  p.endlessMedallions=Object.fromEntries(MEDALLION_IDS.map(id=>[id,MEDALLION_MAX_LEVEL]));p.endlessCrests=Math.max(99_999,p.endlessCrests);
  return unlockAchievements(p);
}
