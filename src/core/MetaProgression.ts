import { FRAGMENTS } from '../config/enemies';
import { HERO_FAMILIES, RARITY_RULES, WEAPONS, rollWeapon } from '../config/weapons';
import { PROPS,META_PRICES } from '../config/props';
import { HEROES } from '../config/heroes';
import { AVATARS, DEFAULT_AVATARS } from '../config/avatars';
import { DEFAULT_SETTINGS, getUnlockedMaps, unlockAchievements, updateSettings } from './PlayerProgression';
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
  shop:profile.shop ? {...profile.shop,offers:[...profile.shop.offers]} : null});
const fail = (profile:Profile,key:string):MetaResult => ({profile:copy(profile),ok:false,key});
const success = (profile:Profile,key:string,amount?:number):MetaResult => ({profile:unlockAchievements(profile),ok:true,key,...(amount===undefined?{}:{amount})});

export function createProfile():Profile {
  return {coins:0,wins:0,matches:0,fragments:[],awardedBattles:[],schemaVersion:2,tutorialCompleted:false,tutorialRewardClaimed:false,
    weaponFragments:{},unlockedWeapons:[],equippedWeapons:{},ownedProps:{},equippedActiveProps:[],equippedPassiveProps:[],freeLotteryTickets:0,shop:null,
    stars:0,highestStars:0,winStreak:0,bestWinStreak:0,selectedMap:'auto',avatarId:'capybara',unlockedAvatars:[...DEFAULT_AVATARS],mergedHeroes:[],settings:{...DEFAULT_SETTINGS}};
}
export function normalizeProfile(raw:unknown):Profile {
  const data=object(raw);const p=createProfile();
  p.coins=count(data.coins);p.matches=count(data.matches);p.wins=Math.min(count(data.wins),p.matches);
  p.tutorialCompleted=typeof data.tutorialCompleted==='boolean'?data.tutorialCompleted:p.matches>0;
  p.tutorialRewardClaimed=typeof data.tutorialRewardClaimed==='boolean'?data.tutorialRewardClaimed:p.matches>0||p.tutorialCompleted;
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
export function createLotteryPrizes(_profile:Profile,random:()=>number):LotteryPrize[] {
  const pool=Object.keys(PROPS);const prizes:LotteryPrize[]=[];
  for(let i=0;i<3;i++) {const id=choose(pool,random);pool.splice(pool.indexOf(id),1);prizes.push({type:'prop',id,amount:1});}
  prizes.push(...[40,80,160].map(amount=>({type:'coins' as const,amount})),
    {type:'fragment',id:rollWeapon(random,[3]),amount:1},{type:'fragment',id:rollWeapon(random,[4]),amount:1});
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
  p.stars=Math.max(180,p.stars);p.highestStars=Math.max(p.highestStars,p.stars);
  p.unlockedAvatars=Object.keys(AVATARS);p.mergedHeroes=Object.keys(HEROES);
  p.equippedWeapons={};
  for(const weapon of Object.values(WEAPONS)) {
    p.weaponFragments[weapon.id]=Math.max(p.weaponFragments[weapon.id]??0,RARITY_RULES[weapon.rarity].fragments);
    if(weapon.signatureHero) p.equippedWeapons[weapon.signatureHero]=weapon.id;
  }
  p.ownedProps=Object.fromEntries(Object.values(PROPS).map(prop=>[prop.id,prop.maxLevel]));
  p.equippedActiveProps=['washer','clay'];p.equippedPassiveProps=['gold_doge','auto_shovel','giant_orange_cat','vip_poster','extra_oranges','promo_badge'];
  if(p.shop) p.shop.offers=[];
  return unlockAchievements(p);
}
