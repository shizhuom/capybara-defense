import { describe, expect, it } from 'vitest';
import { createProfile, normalizeProfile, grantWeaponFragments, buyProp, spinLottery, createLotteryPrizes, unlockAllProfile } from '../src/core/MetaProgression';
import { awardBattle, enableTestProfile, restoreNormalProfile, loadProfile, saveProfile, isTestProfile, STORAGE_PREFIX } from '../src/ui/storage';
import { HEROES } from '../src/config/heroes';
import { WEAPONS } from '../src/config/weapons';
import { PROPS } from '../src/config/props';
import type { Profile } from '../src/core/types';

const ranks = () => import('../src/config/ranks').catch(() => undefined);
const players = () => import('../src/core/PlayerProgression').catch(() => undefined);
async function progression() {
  const module = await players();
  expect(module, 'M3 player progression exists').toBeDefined();
  if (!module) throw Error('M3 player progression missing');
  return module;
}
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: k => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); },
    removeItem: k => { values.delete(k); }, clear: () => values.clear() };
}
const result = { winner: 'player' as const, reason: 'waves' as const, loot: [], playerLoot: [], aiLoot: [], coins: 35, elapsed: 280 };
const avatarIds = ['capybara','hamster','squirrel','bee','cat_swordsman','doge_agent','goose_bully','kungfu_panda','rooster_star','frog_king','market_coon','salted_fish','bamboo_master','sakura_capy','corgi_crown','zen_capy'];

describe('M3 ranks', () => {
  // Each literal threshold catches an off-by-one promotion or an incorrectly ordered tier.
  it.each([0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,125,150,180].map((stars,index)=>({stars,index})))('promotes exactly at $stars stars to rank $index', async ({stars,index}) => {
    const m = await ranks(); expect(m).toBeDefined(); if (!m) return;
    expect(m.getRank(stars).index).toBe(index);
    expect(m.getRank(stars).minStars).toBe(stars);
    if (stars > 0) expect(m.getRank(stars - 1).index).toBe(index - 1);
  });
  it('derives the specified HP, rewards and fragment chances for every tier', async () => {
    const m = await ranks(); expect(m).toBeDefined(); if (!m) return;
    expect(m.RANKS).toHaveLength(54);
    m.RANKS.forEach((rank,i)=>{
      expect(rank.winCoins).toBe(Math.round(60+160*i/53));
      expect(rank.fragmentMultiplier).toBe(i>=50?1.75:i>=45?1.5:i>=40?1.3:1);
      if(i>0)expect(rank.hpMultiplier).toBeGreaterThan(m.RANKS[i-1].hpMultiplier);
      if(i<50)expect(rank.name.en).toContain(['I','II','III','IV','V'][i%5]);
    });
    expect(m.RANKS[53]).toMatchObject({hpMultiplier:6.2,winCoins:220,fragmentMultiplier:1.75});
    expect(m.getRank(-10).index).toBe(0); expect(m.getRank(NaN).index).toBe(0); expect(m.getRank(10000).index).toBe(53);
    expect(m.RANKS.slice(40).map(r=>r.mapId)).toEqual(['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze','sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze','sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze','sunny_backyard','sakura_onsen']);
  });
});

describe('M3 profile migration', () => {
  it('adds defaults while preserving legal M1/M2 counters and repeated normalization', () => {
    const legacy = {coins:371,wins:4,matches:7,fragments:['bamboo_blade'],awardedBattles:['old']};
    const p = normalizeProfile(legacy);
    expect(p).toMatchObject({...legacy,stars:4,highestStars:4,winStreak:0,bestWinStreak:0,selectedMap:'auto',avatarId:'capybara',mergedHeroes:[],settings:{musicVolume:.5,soundVolume:.75,showDamageNumbers:true}});
    expect(p.unlockedAvatars).toEqual([...avatarIds.slice(0,4),'cat_swordsman']);
    expect(normalizeProfile(p)).toEqual(p);
    const m2 = normalizeProfile({...legacy,schemaVersion:2,stars:0});
    expect(m2.stars).toBe(0); expect(m2.weaponFragments).toEqual({}); expect(normalizeProfile(m2)).toEqual(m2);
    expect(normalizeProfile({wins:100,matches:3}).stars).toBe(3);
    expect(normalizeProfile({...legacy,stars:'bad'}).stars).toBe(0);
  });
  it('sanitizes invalid choices, streaks, hero history and settings without treating zero as absent', () => {
    const p = normalizeProfile({stars:20,highestStars:2,winStreak:5,bestWinStreak:2,avatarId:'fake',unlockedAvatars:['fake','hamster','hamster'],selectedMap:'cat_tower_maze',mergedHeroes:['kungfu_po','fake','kungfu_po'],settings:{musicVolume:0,soundVolume:2,showDamageNumbers:false}});
    expect(p).toMatchObject({highestStars:20,bestWinStreak:5,avatarId:'capybara',selectedMap:'auto',mergedHeroes:['kungfu_po'],settings:{musicVolume:0,soundVolume:1,showDamageNumbers:false}});
    expect(p.unlockedAvatars).toContain('kungfu_panda');
    const bad=normalizeProfile({stars:-1,highestStars:Infinity,winStreak:-2,bestWinStreak:'5',settings:{musicVolume:-2,soundVolume:NaN,showDamageNumbers:0}});
    expect(bad).toMatchObject({stars:0,highestStars:0,winStreak:0,bestWinStreak:0,settings:{musicVolume:0,soundVolume:.75,showDamageNumbers:true}});
    expect(normalizeProfile(p)).toEqual(p);
  });
});

describe('M3 stars and permanent maps', () => {
  it.each([{stars:19,want:19},{stars:20,want:20},{stars:21,want:20},{stars:22,want:21}])('protects losses at $stars stars', async ({stars,want})=>{
    const m=await progression(); const p=m.applyBattleProgress({...createProfile(),stars,highestStars:stars,winStreak:5,bestWinStreak:5},false);
    expect(p).toMatchObject({stars:want,highestStars:stars,winStreak:0,bestWinStreak:5,coins:0,wins:0,matches:0});
  });
  it('awards +1, +1, then +2 stars from the third win and retains best streak after a loss', async()=>{
    const m=await progression(); let p=createProfile();
    for (const stars of [1,2,4,6,8]) { p=m.applyBattleProgress(p,true); expect(p.stars).toBe(stars); }
    expect(p).toMatchObject({winStreak:5,bestWinStreak:5,highestStars:8});
    expect(p.unlockedAvatars).toEqual(expect.arrayContaining(['doge_agent','goose_bully']));
    p=m.applyBattleProgress(p,false); p=m.applyBattleProgress(p,true);
    expect(p).toMatchObject({winStreak:1,bestWinStreak:5,stars:9});
  });
  it('unlocks four maps at rank 0/10/20/30 and preserves manual choice after demotion', async()=>{
    const m=await progression(); let p=createProfile();
    expect(m.getUnlockedMaps(p)).toEqual(['sunny_backyard']);
    for(const [index,id] of [[10,'sakura_onsen'],[20,'midnight_kitchen'],[30,'cat_tower_maze']] as const) {
      p=m.setRank(p,index); expect(m.resolveMap(p)).toBe(id); expect(m.getUnlockedMaps(p)).toContain(id);
    }
    p=m.selectMap(p,'cat_tower_maze'); p=m.setRank(p,0);
    expect(p).toMatchObject({stars:0,highestStars:60,selectedMap:'cat_tower_maze'});
    expect(m.resolveMap(p)).toBe('cat_tower_maze'); expect(m.getUnlockedMaps(p)).toHaveLength(4);
    expect(m.resolveMap(m.selectMap(p,'auto'))).toBe('sunny_backyard');
    expect(m.selectMap(createProfile(),'cat_tower_maze')).toEqual(createProfile());
    expect(m.selectMap(createProfile(),'fake' as never)).toEqual(createProfile());
    expect(m.setRank(p,54)).toEqual(p); expect(m.setRank(p,NaN)).toEqual(p);
  });
  it('retains the highest-tier map and earned avatar after a real rank-boundary loss',async()=>{
    const m=await progression();let p=m.selectMap(m.setRank(createProfile(),30),'cat_tower_maze');
    p=m.applyBattleProgress(p,false);
    expect(p).toMatchObject({stars:59,highestStars:60,selectedMap:'cat_tower_maze'});
    expect(m.getUnlockedMaps(p)).toHaveLength(4);expect(m.resolveMap(p)).toBe('cat_tower_maze');
    expect(p.unlockedAvatars).toContain('corgi_crown');expect(normalizeProfile(p)).toEqual(p);
  });
  it('settles stars, hero history, first-win achievement and the receipt exactly once across reload',()=>{
    const storage=memoryStorage(); const first=awardBattle(createProfile(),'m3-once',{...result,mergedHeroes:['kungfu_po']});
    expect(first.profile).toMatchObject({stars:1,highestStars:1,winStreak:1,bestWinStreak:1,wins:1,matches:1,coins:35,mergedHeroes:['kungfu_po']});
    expect(first.profile.unlockedAvatars).toEqual(expect.arrayContaining(['cat_swordsman','kungfu_panda']));
    saveProfile(first.profile,storage); expect(awardBattle(loadProfile(storage),'m3-once',result)).toMatchObject({awarded:false,profile:first.profile});
  });
});

describe('M3 avatars and local leaderboard',()=>{
  const cases: Array<{id:string;patch:Partial<Profile>}> = [
    ...avatarIds.slice(0,4).map(id=>({id,patch:{}})),
    {id:'cat_swordsman',patch:{wins:1,matches:1}}, {id:'doge_agent',patch:{bestWinStreak:3}}, {id:'goose_bully',patch:{bestWinStreak:5}},
    {id:'kungfu_panda',patch:{mergedHeroes:['kungfu_po']}}, {id:'rooster_star',patch:{mergedHeroes:['ballin_rooster']}}, {id:'frog_king',patch:{mergedHeroes:['pepe_king']}},
    {id:'market_coon',patch:{ownedProps:{washer:1,clay:1,milk_bottle:1,whistle:1,expired_can:1,catnip:1}}},
    {id:'salted_fish',patch:{unlockedWeapons:Object.keys(WEAPONS).slice(0,12)}}, {id:'bamboo_master',patch:{unlockedWeapons:['m09_cat_blade']}},
    {id:'sakura_capy',patch:{highestStars:20}}, {id:'corgi_crown',patch:{highestStars:60}}, {id:'zen_capy',patch:{highestStars:100}},
  ];
  it.each(cases)('unlocks $id from its real achievement condition',async({id,patch})=>{
    const m=await progression();const p={...createProfile(),...patch};const before=JSON.stringify(p);
    expect(m.unlockAchievements(p).unlockedAvatars).toContain(id);expect(JSON.stringify(p)).toBe(before);
  });
  it.each([
    {id:'cat_swordsman',patch:{wins:0,matches:10}},
    {id:'doge_agent',patch:{bestWinStreak:2}}, {id:'goose_bully',patch:{bestWinStreak:4}},
    {id:'kungfu_panda',patch:{mergedHeroes:['zen_master']}}, {id:'rooster_star',patch:{mergedHeroes:['ronin_goose']}}, {id:'frog_king',patch:{mergedHeroes:['purrcerer']}},
    {id:'market_coon',patch:{ownedProps:{washer:1,clay:1,milk_bottle:1,whistle:1,promo_badge:3,fake:1}}},
    {id:'salted_fish',patch:{unlockedWeapons:[...Object.keys(WEAPONS).slice(0,11),'m01_swatter','fake']}},
    {id:'bamboo_master',patch:{unlockedWeapons:['m07_rolling_pin']}},
    {id:'sakura_capy',patch:{highestStars:19}}, {id:'corgi_crown',patch:{highestStars:59}}, {id:'zen_capy',patch:{highestStars:99}},
  ] satisfies Array<{id:string;patch:Partial<Profile>}>)('keeps $id locked below its own requirement',async({id,patch})=>{
    const m=await progression();expect(m.unlockAchievements({...createProfile(),...patch}).unlockedAvatars).not.toContain(id);
  });
  it('does not grant achievements below thresholds and never revokes earned avatars',async()=>{
    const m=await progression(); const p=m.unlockAchievements({...createProfile(),bestWinStreak:2,highestStars:19,ownedProps:{washer:1},unlockedWeapons:Object.keys(WEAPONS).slice(0,8)});
    expect(p.unlockedAvatars).toEqual(avatarIds.slice(0,4));
    const earned=m.unlockAchievements({...p,highestStars:100,bestWinStreak:5});
    expect(m.unlockAchievements({...earned,highestStars:0,bestWinStreak:0}).unlockedAvatars).toEqual(earned.unlockedAvatars);
    expect(m.selectAvatar(p,'goose_bully')).toEqual(p);expect(m.selectAvatar(p,'fake')).toEqual(p);
    expect(m.selectAvatar(p,'bee').avatarId).toBe('bee');
  });
  it('records only real merged heroes once without mutating input',async()=>{
    const m=await progression(); const original=createProfile();const p=m.recordMergedHeroes(original,['kungfu_po','kungfu_po','ballin_rooster','pepe_king','fake']);
    expect(p.mergedHeroes).toEqual(['kungfu_po','ballin_rooster','pepe_king']);expect(original.mergedHeroes).toEqual([]);
    expect(m.recordMergedHeroes(p,['kungfu_po'])).toEqual(p);
    expect(p.unlockedAvatars).toEqual(expect.arrayContaining(['kungfu_panda','rooster_star','frog_king']));
  });
  it('evaluates prop purchases, lottery payouts and fragment unlock achievements immediately',()=>{
    const five={washer:1,clay:1,milk_bottle:1,whistle:1,expired_can:1};
    const p={...createProfile(),coins:1000,ownedProps:five,shop:{day:'2026-11-13',offers:['catnip']}};
    expect(buyProp(p,'catnip').profile.unlockedAvatars).toContain('market_coon');
    const prizes=createLotteryPrizes(p,()=>0);prizes[0]={type:'prop',id:'catnip',amount:1};
    expect(spinLottery(p,prizes,()=>0).profile.unlockedAvatars).toContain('market_coon');
    expect(grantWeaponFragments(createProfile(),Array(16).fill('m09_cat_blade')).profile.unlockedAvatars).toContain('bamboo_master');
    const eleven={...createProfile(),unlockedWeapons:Object.keys(WEAPONS).slice(0,11)};
    expect(grantWeaponFragments(eleven,Array(16).fill('m12_iron_wok')).profile.unlockedAvatars).toContain('salted_fish');
  });
  it('provides 16 bilingual avatars with transparent requirements',async()=>{
    const catalog=await import('../src/config/avatars').catch(()=>undefined);expect(catalog).toBeDefined();if(!catalog)return;
    expect(Object.keys(catalog.AVATARS)).toEqual(avatarIds);
    for(const avatar of Object.values(catalog.AVATARS)) for(const language of ['zh-CN','en'] as const) {
      expect(avatar.name[language].length).toBeGreaterThan(1);expect(avatar.description[language].length).toBeGreaterThan(4);
    }
  });
  it('keeps 15 deterministic bilingual NPCs and sorts the player by stars, wins, then id',async()=>{
    const m=await progression();const p={...createProfile(),stars:168,wins:999,matches:1000,avatarId:'bee'};
    const rows=m.getLeaderboard(p);expect(rows).toHaveLength(16);expect(new Set(rows.map(r=>r.id)).size).toBe(16);
    expect(rows[0]).toMatchObject({isPlayer:true,name:{'zh-CN':'我',en:'You'},stars:168,wins:999,matches:1000,avatarId:'bee'});
    const npcs=rows.filter(r=>!r.isPlayer);expect(Math.min(...npcs.map(r=>r.stars))).toBe(6);expect(Math.max(...npcs.map(r=>r.stars))).toBe(168);
    for(const row of npcs){expect(row.name.en.length).toBeGreaterThan(2);expect(row.name['zh-CN'].length).toBeGreaterThan(1);expect(row.matches).toBeGreaterThanOrEqual(row.wins);expect(avatarIds).toContain(row.avatarId);}
    expect(m.getLeaderboard(p)).toEqual(rows);
    const tied=m.getLeaderboard({...p,stars:npcs[0].stars,wins:npcs[0].wins});
    expect(tied).toEqual([...tied].sort((a,b)=>b.stars-a.stars||b.wins-a.wins||a.id.localeCompare(b.id)));
  });
  it('updates valid settings immediately, clamps volume, and defaults malformed values',async()=>{
    const m=await progression();const p=createProfile();const settings=m.updateSettings(p,{musicVolume:0,soundVolume:-1,showDamageNumbers:false});
    expect(settings.settings).toEqual({musicVolume:0,soundVolume:0,showDamageNumbers:false,developerMode:false});
    expect(p.settings).toEqual({musicVolume:.5,soundVolume:.75,showDamageNumbers:true,developerMode:false});
    expect(m.updateSettings(settings,{musicVolume:Infinity,soundVolume:2,showDamageNumbers:1 as never}).settings).toEqual({musicVolume:.5,soundVolume:1,showDamageNumbers:true,developerMode:false});
  });
});

describe('M3 full-profile isolation',()=>{
  it('includes all maps, avatars and heroes while preserving settings and ordinary backup',async()=>{
    const m=await progression();const storage=memoryStorage();const ordinary=normalizeProfile({...createProfile(),coins:371,stars:22,highestStars:60,winStreak:2,bestWinStreak:7,avatarId:'bee',selectedMap:'midnight_kitchen',settings:{musicVolume:0,soundVolume:.2,showDamageNumbers:false}});
    saveProfile(ordinary,storage);const full=enableTestProfile(storage);
    expect(full.stars).toBeGreaterThanOrEqual(180);expect(full.highestStars).toBeGreaterThanOrEqual(full.stars);
    expect(full.unlockedAvatars).toEqual(avatarIds);expect(full.mergedHeroes).toEqual(Object.keys(HEROES));expect(full.settings).toEqual(ordinary.settings);
    expect(full.unlockedWeapons).toHaveLength(36);expect(Object.keys(full.ownedProps)).toHaveLength(Object.keys(PROPS).length);expect(m.getUnlockedMaps(full)).toHaveLength(4);
    saveProfile({...full,stars:200},storage);enableTestProfile(storage);expect(restoreNormalProfile(storage)).toEqual(ordinary);expect(loadProfile(storage)).toEqual(ordinary);expect(isTestProfile(storage)).toBe(false);
    const high=unlockAllProfile({...ordinary,stars:220,highestStars:230});expect(high).toMatchObject({stars:220,highestStars:230});
  });
  it.each(['backup','full','restore'])('protects ordinary M3 progression if the %s write fails',async(phase)=>{
    const storage=memoryStorage();const ordinary=normalizeProfile({...createProfile(),coins:298,stars:21,highestStars:60,avatarId:'hamster'});saveProfile(ordinary,storage);
    if(phase==='restore') enableTestProfile(storage);
    const set=storage.setItem;storage.setItem=(key,value)=>{
      if((phase==='backup'&&key.endsWith('normalProfileBackup'))||(phase==='full'&&key.endsWith(':profile')&&JSON.parse(value).coins===9999)||(phase==='restore'&&key.endsWith(':profile'))) throw Error('quota');
      set(key,value);
    };
    if(phase==='restore') {const active=loadProfile(storage);expect(restoreNormalProfile(storage)).toEqual(active);expect(isTestProfile(storage)).toBe(true);}
    else {expect(enableTestProfile(storage)).toEqual(ordinary);expect(loadProfile(storage)).toEqual(ordinary);expect(isTestProfile(storage)).toBe(false);expect(storage.getItem(`${STORAGE_PREFIX}normalProfileBackup`)).toBeNull();}
    storage.setItem=set;expect(restoreNormalProfile(storage)).toEqual(ordinary);
  });
});
