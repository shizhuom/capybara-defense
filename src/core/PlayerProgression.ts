import { AVATARS, DEFAULT_AVATARS } from '../config/avatars';
import { HEROES } from '../config/heroes';
import { PROPS } from '../config/props';
import { RANKS, getRank } from '../config/ranks';
import { WEAPONS } from '../config/weapons';
import type { GameSettings, MapId, Profile } from './types';

export const DEFAULT_SETTINGS:GameSettings={musicVolume:.5,soundVolume:.75,showDamageNumbers:true,developerMode:false};
const own=(object:object,id:string)=>Object.hasOwn(object,id);
const unique=(ids:string[])=>[...new Set(ids)];
const maps:MapId[]=['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze'];
const volume=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;

/** Awards are monotonic: historical evidence or an already granted avatar both suffice. */
export function unlockAchievements(profile:Profile):Profile {
  const best=Math.max(profile.winStreak,profile.bestWinStreak);
  const highest=Math.max(profile.stars,profile.highestStars);
  const weapons=unique(profile.unlockedWeapons.filter(id=>own(WEAPONS,id)));
  const props=Object.keys(profile.ownedProps).filter(id=>own(PROPS,id)&&profile.ownedProps[id]>0);
  const conditions:Record<string,boolean>={cat_swordsman:profile.wins>=1,doge_agent:best>=3,goose_bully:best>=5,
    kungfu_panda:profile.mergedHeroes.includes('kungfu_po'),rooster_star:profile.mergedHeroes.includes('ballin_rooster'),frog_king:profile.mergedHeroes.includes('pepe_king'),
    market_coon:props.length>=6,salted_fish:weapons.length>=12,bamboo_master:weapons.some(id=>WEAPONS[id].rarity===4),
    sakura_capy:highest>=20,corgi_crown:highest>=60,zen_capy:highest>=100};
  const earned=new Set([...DEFAULT_AVATARS,...profile.unlockedAvatars.filter(id=>own(AVATARS,id)),...Object.keys(conditions).filter(id=>conditions[id])]);
  const unlockedAvatars=Object.keys(AVATARS).filter(id=>earned.has(id));
  return {...profile,unlockedAvatars,avatarId:earned.has(profile.avatarId)?profile.avatarId:'capybara'};
}
export function recordMergedHeroes(profile:Profile,heroIds:string[]):Profile {
  return unlockAchievements({...profile,mergedHeroes:unique([...profile.mergedHeroes,...heroIds].filter(id=>own(HEROES,id)))});
}
export function getUnlockedMaps(profile:Profile):MapId[] {
  const rank=getRank(Math.max(profile.stars,profile.highestStars)).index;
  return maps.slice(0,Math.min(4,Math.floor(rank/10)+1));
}
export function resolveMap(profile:Profile):MapId {
  return profile.selectedMap!=='auto'&&getUnlockedMaps(profile).includes(profile.selectedMap)?profile.selectedMap:getRank(profile.stars).mapId;
}
export function selectMap(profile:Profile,id:'auto'|MapId):Profile {
  if(id!=='auto'&&!getUnlockedMaps(profile).includes(id)) return profile;
  return {...profile,selectedMap:id};
}
export function selectAvatar(profile:Profile,id:string):Profile {
  if(!own(AVATARS,id)||!profile.unlockedAvatars.includes(id)) return profile;
  return {...profile,avatarId:id};
}
export function updateSettings(profile:Profile,patch:Partial<GameSettings>):Profile {
  const values={...profile.settings,...patch};
  return {...profile,settings:{musicVolume:volume(values.musicVolume,DEFAULT_SETTINGS.musicVolume),soundVolume:volume(values.soundVolume,DEFAULT_SETTINGS.soundVolume),
    showDamageNumbers:typeof values.showDamageNumbers==='boolean'?values.showDamageNumbers:DEFAULT_SETTINGS.showDamageNumbers,
    developerMode:typeof values.developerMode==='boolean'?values.developerMode:false}};
}
export function setRank(profile:Profile,index:number):Profile {
  if(!Number.isInteger(index)||index<0||index>=RANKS.length) return profile;
  let p=unlockAchievements({...profile,stars:RANKS[index].minStars,highestStars:Math.max(profile.highestStars,RANKS[index].minStars)});
  if(p.selectedMap!=='auto'&&!getUnlockedMaps(p).includes(p.selectedMap)) p={...p,selectedMap:'auto'};
  return p;
}
export function applyBattleProgress(profile:Profile,won:boolean,mergedHeroes:string[]=[]):Profile {
  const winStreak=won?profile.winStreak+1:0;
  const stars=won?profile.stars+(winStreak>=3?2:1):getRank(profile.stars).index<10?profile.stars:Math.max(20,profile.stars-1);
  return recordMergedHeroes({...profile,stars,highestStars:Math.max(profile.highestStars,stars),winStreak,bestWinStreak:Math.max(profile.bestWinStreak,winStreak)},mergedHeroes);
}

export interface LeaderboardEntry {id:string;name:{'zh-CN':string;en:string};stars:number;avatarId:string;wins:number;matches:number;isPlayer:boolean}
const npcRows:Array<[string,string,number,string,number,number]>=[
  ['隔壁二哈主人','The Husky Next Door',6,'hamster',6,12],
  ['瓜子不离手','Seed Snack Captain',12,'hamster',11,19],
  ['早八遛狗人','Morning Dog Walker',18,'doge_agent',16,25],
  ['猫咖打工喵','Cafe Cat Keeper',24,'cat_swordsman',21,33],
  ['温泉泡泡糖','Onsen Bubblegum',32,'sakura_capy',28,42],
  ['厨房摸鱼王','Kitchen Daydreamer',40,'salted_fish',35,51],
  ['鹅村扛把子','Village Goose Boss',50,'goose_bully',42,60],
  ['熊猫不熬夜','Early Bedtime Panda',60,'kungfu_panda',51,70],
  ['篮球练习生','Basketball Trainee',72,'rooster_star',60,81],
  ['皇冠小短腿','Crowned Short Legs',84,'corgi_crown',69,92],
  ['黑市常客','Market Regular',96,'market_coon',79,103],
  ['孤寡不孤单','Never Lonely Frog',110,'frog_king',91,116],
  ['竹林扫地僧','Bamboo Sweeper',130,'bamboo_master',106,131],
  ['后院退休园长','Retired Garden Warden',150,'capybara',121,148],
  ['情绪稳定祖师爷','Grandmaster of Calm',168,'zen_capy',137,163],
];
export function getLeaderboard(profile:Profile):LeaderboardEntry[] {
  const entries:LeaderboardEntry[]=npcRows.map(([zh,en,stars,avatarId,wins,matches],index)=>({id:`npc_${String(index+1).padStart(2,'0')}`,name:{'zh-CN':zh,en},stars,avatarId,wins,matches,isPlayer:false}));
  entries.push({id:'player',name:{'zh-CN':'我',en:'You'},stars:profile.stars,avatarId:profile.avatarId,wins:profile.wins,matches:profile.matches,isPlayer:true});
  return entries.sort((a,b)=>b.stars-a.stars||b.wins-a.wins||a.id.localeCompare(b.id));
}
