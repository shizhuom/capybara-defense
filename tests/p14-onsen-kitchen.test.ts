import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {BattleEngine,type EngineOptions} from '../src/core/BattleEngine';
import {Random} from '../src/core/Random';
import {copyLoadout} from '../src/core/PropSystem';
import {combatCharge,combatRange} from '../src/core/CombatRules';
import {getBeeProduction} from '../src/core/UnitStats';
import {createProfile,normalizeProfile,unlockAllProfile} from '../src/core/MetaProgression';
import {
  basketFocusIngredients,brewBroth,buyIngredientBasket,canAffordIngredients,canBrewOrUpgradeAnyBroth,equipBroth,
  getBrothLevel,getBrothUpgradeCost,grantIngredients,upgradeBroth,
} from '../src/core/KitchenProgression';
import {
  BROTHS,BROTH_IDS,INGREDIENT_IDS,MAP_SIGNATURE_INGREDIENT,getActiveBroth,getKitchenCollectionAura,getUnitCombatFamily,
  type BrothId,type BrothLevel,
} from '../src/config/kitchen';
import {ECONOMY,SHOVEL_PRODUCTION} from '../src/config/units';
import {RANKS} from '../src/config/ranks';
import {getMap} from '../src/config/maps';
import {awardBattle,awardEndless} from '../src/ui/storage';
import {P14_SCENE_IDS,sceneSticker} from '../src/ui/stickers';
import * as registry from '../src/render/AssetRegistry';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {courtyardMarkup} from '../src/ui/CourtyardView';
import {KitchenScreen,brothEffectText} from '../src/ui/KitchenScreen';
import {passiveRailMarkup} from '../src/ui/P13HUD';
import {pauseMarkup,resultMarkup} from '../src/ui/SettlementView';
import {setLanguage,t} from '../src/i18n/i18n';
import {p14En,p14Zh} from '../src/i18n/p14';
import type {BattleLoadout,BattleResult,BattleState,Profile,Unit} from '../src/core/types';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();setLanguage('zh-CN');});

const empty:BattleLoadout={ownedProps:{},equippedWeapons:{},equippedActiveProps:[],equippedPassiveProps:[]};
/** The broth is brewed in both loadouts so the collection aura cancels out of every ratio. */
const soak=(id:BrothId,level:BrothLevel=1,active=true):BattleLoadout=>({...empty,unlockedBroths:[id],brothLevels:{[id]:level},activeBrothId:active?id:null});
const engine=(loadout:BattleLoadout,options:EngineOptions={})=>new BattleEngine({seed:31,autoWaves:false,loadouts:{player:loadout},...options});
function unit(e:BattleEngine,kind:string,level=1):Unit {
  const result=e.grant(kind);const u=e.state.units.find(item=>item.id===result.unitId)!;u.level=level;return u;
}
function scripted(e:BattleEngine,values:number[]):void {
  let i=0;(e as unknown as {ingredientRandom:{next():number}}).ingredientRandom={next:()=>values[i++%values.length]};
}
function standardWinner(options:EngineOptions={}):BattleEngine {
  const e=new BattleEngine({seed:41,...options});e.start();
  while(e.state.phase!=='finished')e.skipWave();
  return e;
}
function memory(){
  const saved=new Map<string,string>();
  vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>{saved.set(key,value);},removeItem:(key:string)=>{saved.delete(key);}}});
  return saved;
}

describe('P14 synced art and offline fallbacks',()=>{
  it('ships 290 sprites with the twenty-two exact RGBA P14 stickers',()=>{
    const ids=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8')) as string[];
    expect(ids).toHaveLength(290);expect(new Set(ids).size).toBe(290);expect(P14_SCENE_IDS).toHaveLength(22);
    for(const id of P14_SCENE_IDS){
      expect(ids).toContain(id);const png=readFileSync(`public/assets/sprites/${id}.png`),size=id.startsWith('ing_')?160:256;
      expect([png.readUInt32BE(16),png.readUInt32BE(20),png[25]]).toEqual([size,size,6]);
    }
    expect([...INGREDIENT_IDS,...BROTH_IDS].every(id=>(P14_SCENE_IDS as readonly string[]).includes(id))).toBe(true);
  });
  it('renders twenty-two distinct borderless text-free vectors offline and upgrades to decoded PNGs',()=>{
    const svgs=P14_SCENE_IDS.map(id=>sceneSticker(id,'',64));
    for(const svg of svgs){expect(svg).toContain('<svg');expect(svg).not.toContain('<text');expect(svg).not.toContain('stroke="#fffdf6"');}
    expect(new Set(svgs.map(s=>s.replace(/data-sticker="[^"]*"|aria-label="[^"]*"/g,''))).size).toBe(22);
    vi.spyOn(registry,'spriteUrl').mockImplementation(id=>`/nested/assets/sprites/${id}.png`);
    for(const id of P14_SCENE_IDS)expect(sceneSticker(id,'',64)).toContain(`src="/nested/assets/sprites/${id}.png"`);
  });
});

describe('P14 backward-compatible profile and starter gift',()=>{
  it('starts fresh saves with an empty pantry until Kitchen onboarding gifts 4 yuzu at 23★',()=>{
    expect(createProfile()).toMatchObject({ingredients:{},unlockedBroths:[],brothLevels:{},activeBrothId:null});
    expect(normalizeProfile(null).ingredients).toEqual({});
  });
  it('preserves explicit pantries cleanly on migration and after spending',()=>{
    const legacy={coins:120,wins:3,matches:4,schemaVersion:2};
    const migrated=normalizeProfile(legacy);expect(migrated.ingredients).toEqual({});
    expect(normalizeProfile(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
    const gifted={...migrated,ingredients:{ing_yuzu:4}};
    const spent=brewBroth(gifted,'dish_yuzu_bath').profile;
    expect(normalizeProfile(JSON.parse(JSON.stringify(spent))).ingredients).toEqual({});
  });
  it('sanitizes forged ingredients, recipes, levels and the active soak',()=>{
    const p=normalizeProfile({ingredients:{ing_yuzu:3,ing_fake:9,ing_honey:-2,ing_chili:1.5,ing_bamboo:4},
      unlockedBroths:['dish_yuzu_bath','dish_fake','dish_yuzu_bath','dish_matcha_tea'],brothLevels:{dish_yuzu_bath:9,dish_matcha_tea:0,dish_chill_melon:3},activeBrothId:'dish_chill_melon'});
    expect(p.ingredients).toEqual({ing_yuzu:3,ing_bamboo:4});
    expect(p.unlockedBroths).toEqual(['dish_yuzu_bath','dish_matcha_tea']);
    expect(p.brothLevels).toEqual({dish_yuzu_bath:3,dish_matcha_tea:1});expect(p.activeBrothId).toBeNull();
    expect(normalizeProfile({...p,activeBrothId:'dish_matcha_tea'}).activeBrothId).toBe('dish_matcha_tea');
    expect(normalizeProfile(p)).toEqual(p);
  });
  it('unlocks every recipe at Lv.3 for test profiles while keeping the explicit soak choice',()=>{
    const all=unlockAllProfile(createProfile());
    expect(all.unlockedBroths).toEqual([...BROTH_IDS]);expect(Object.values(all.brothLevels)).toEqual(Array(14).fill(3));
    expect(all.ingredients).toEqual(Object.fromEntries(INGREDIENT_IDS.map(id=>[id,99])));expect(all.activeBrothId).toBeNull();
    const chosen=unlockAllProfile({...createProfile(),unlockedBroths:['dish_sakura_milk'],brothLevels:{dish_sakura_milk:1},activeBrothId:'dish_sakura_milk'});
    expect(chosen.activeBrothId).toBe('dish_sakura_milk');expect(getActiveBroth(chosen)?.level).toBe(3);
  });
});

describe('P14 brew, upgrade, equip, aura and mystery basket',()=>{
  it('brews the starter broth, auto-equips it once, then upgrades through Lv.3',()=>{
    const fresh={...createProfile(),ingredients:{ing_yuzu:4}};expect(canBrewOrUpgradeAnyBroth(fresh)).toEqual({brewable:['dish_yuzu_bath'],upgradeable:[]});
    const brewed=brewBroth(fresh,'dish_yuzu_bath');
    expect(brewed).toMatchObject({ok:true,key:'p14.brewed',level:1});
    expect(brewed.profile).toMatchObject({ingredients:{},unlockedBroths:['dish_yuzu_bath'],brothLevels:{dish_yuzu_bath:1},activeBrothId:'dish_yuzu_bath'});
    expect(fresh.ingredients).toEqual({ing_yuzu:4});
    expect(brewBroth(brewed.profile,'dish_yuzu_bath')).toMatchObject({ok:false,key:'p14.alreadyBrewed'});
    const stocked=grantIngredients(brewed.profile,[...Array(5).fill('ing_bamboo'),...Array(60).fill('ing_yuzu'),...Array(32).fill('ing_honey'),'ing_fake']);
    const second=brewBroth(stocked,'dish_bamboo_broth');expect(second.profile.activeBrothId).toBe('dish_yuzu_bath');
    expect(getBrothUpgradeCost('dish_yuzu_bath',1)).toEqual({ing_yuzu:18,ing_honey:8});
    const lv2=upgradeBroth(second.profile,'dish_yuzu_bath');expect(lv2).toMatchObject({ok:true,key:'p14.upgraded',level:2});
    expect(lv2.profile.ingredients).toEqual({ing_yuzu:42,ing_honey:24});
    const lv3=upgradeBroth(lv2.profile,'dish_yuzu_bath');expect(getBrothLevel(lv3.profile,'dish_yuzu_bath')).toBe(3);
    expect(lv3.profile.ingredients).toEqual({});expect(getBrothUpgradeCost('dish_yuzu_bath',3)).toBeNull();
    expect(upgradeBroth(lv3.profile,'dish_yuzu_bath')).toMatchObject({ok:false,key:'p14.maxLevel'});
    expect(upgradeBroth(lv3.profile,'dish_matcha_tea')).toMatchObject({ok:false,key:'p14.notBrewed'});
    expect(brewBroth(createProfile(),'dish_imperial_onsen')).toMatchObject({ok:false,key:'p14.missingIngredients'});
  });
  it('equips, switches, toggles and unequips only brewed broths',()=>{
    const p={...createProfile(),unlockedBroths:['dish_yuzu_bath','dish_chill_melon'],brothLevels:{dish_yuzu_bath:1,dish_chill_melon:2},activeBrothId:null};
    const on=equipBroth(p,'dish_chill_melon');expect(on).toMatchObject({ok:true,key:'p14.equipped'});expect(on.profile.activeBrothId).toBe('dish_chill_melon');
    const swap=equipBroth(on.profile,'dish_yuzu_bath');expect(swap.profile.activeBrothId).toBe('dish_yuzu_bath');
    const off=equipBroth(swap.profile,'dish_yuzu_bath');expect(off).toMatchObject({ok:true,key:'p14.unequipped'});expect(off.profile.activeBrothId).toBeNull();
    expect(equipBroth(on.profile,null).profile.activeBrothId).toBeNull();
    expect(equipBroth(p,'dish_golden_feast')).toMatchObject({ok:false,key:'p14.notBrewed'});
  });
  it('computes the permanent aura: +2% ATK and +1% SPD per recipe plus +0.5% ATK per extra star',()=>{
    expect(getKitchenCollectionAura(undefined)).toEqual({unlockedCount:0,bonusLevels:0,damageBonus:0,rateBonus:0});
    expect(getKitchenCollectionAura(empty)).toEqual({unlockedCount:0,bonusLevels:0,damageBonus:0,rateBonus:0});
    const aura=getKitchenCollectionAura({unlockedBroths:['dish_yuzu_bath','dish_matcha_tea','dish_fake'],brothLevels:{dish_yuzu_bath:3,dish_matcha_tea:2}});
    expect(aura.unlockedCount).toBe(2);expect(aura.bonusLevels).toBe(3);
    expect(aura.damageBonus).toBeCloseTo(.055,10);expect(aura.rateBonus).toBeCloseTo(.02,10);
    const max=getKitchenCollectionAura(unlockAllProfile(createProfile()));
    expect(max.damageBonus).toBeCloseTo(.42,10);expect(max.rateBonus).toBeCloseTo(.14,10);
  });
  it('sells a 360-coin basket of three valid ingredients weighted toward the cheapest missing recipe',()=>{
    const p={...createProfile(),coins:400,ingredients:{}};
    expect(basketFocusIngredients(p)).toEqual(['ing_yuzu']);
    const values=[0,.374,.376];let i=0;
    const bought=buyIngredientBasket(p,()=>values[i++]);
    expect(bought).toMatchObject({ok:true,key:'p14.basketBought',gained:['ing_yuzu','ing_yuzu','ing_bamboo']});
    expect(bought.profile.coins).toBe(40);expect(bought.profile.ingredients).toEqual({ing_yuzu:2,ing_bamboo:1});
    const random=buyIngredientBasket({...p,coins:360});expect(random.gained).toHaveLength(3);
    expect(random.gained!.every(id=>(INGREDIENT_IDS as readonly string[]).includes(id))).toBe(true);
    expect(Object.values(random.profile.ingredients).reduce((a,b)=>a+b,0)).toBe(3);
    expect(buyIngredientBasket({...p,coins:359})).toMatchObject({ok:false,key:'meta.insufficientCoins'});
    expect(canAffordIngredients(bought.profile,{ing_yuzu:2})).toBe(true);
  });
});

describe('P14 battle drops and isolated ingredient RNG',()=>{
  it('keeps every combat random draw identical while ingredient drops use their own stream',()=>{
    const a=engine(empty),b=engine(empty);
    (b as unknown as {ingredientRandom:Random}).ingredientRandom=new Random(987654);
    for(const e of [a,b]){
      e.start();e.state.sides.player.food=999;
      for(let wave=0;wave<7;wave++){
        e.skipWave();e.summon();
        for(let i=0;i<12;i++)e.hurt(e.spawnEnemy(i%3?'rat':'crab','player'),1e9,undefined,false,false,true);
        for(const boss of e.state.enemies.filter(enemy=>enemy.boss))e.hurt(boss,1e9,undefined,false,false,true);
      }
    }
    expect(b.state.units.map(u=>`${u.kind}:${u.level}`)).toEqual(a.state.units.map(u=>`${u.kind}:${u.level}`));
    expect(b.state.sides.player.loot).toEqual(a.state.sides.player.loot);
    expect(b.getUpcomingWavePreview()).toEqual(a.getUpcomingWavePreview());
    expect(a.state.sides.player.ingredientLoot.length).toBeGreaterThan(0);
    expect(b.state.sides.player.ingredientLoot).not.toEqual(a.state.sides.player.ingredientLoot);
    const replay=engine(empty);replay.start();replay.state.sides.player.food=999;
    for(let wave=0;wave<7;wave++){replay.skipWave();replay.summon();for(let i=0;i<12;i++)replay.hurt(replay.spawnEnemy(i%3?'rat':'crab','player'),1e9,undefined,false,false,true);for(const boss of replay.state.enemies.filter(enemy=>enemy.boss))replay.hurt(boss,1e9,undefined,false,false,true);}
    expect(replay.state.sides.player.ingredientLoot).toEqual(a.state.sides.player.ingredientLoot);
  });
  it('a minion kill never touches the combat stream',()=>{
    const e=engine(empty),rat=e.spawnEnemy('rat','player'),before=JSON.stringify((e as unknown as {random:Random}).random);
    e.hurt(rat,1e9,undefined,false,false,true);expect(JSON.stringify((e as unknown as {random:Random}).random)).toBe(before);
  });
  it('drops deterministically from elites and W6/W8/W10 bosses on every map',()=>{
    for(const mapId of ['sunny_backyard','midnight_kitchen'] as const){
      const e=engine(empty,{mapId}),signature=MAP_SIGNATURE_INGREDIENT[mapId],loot=e.state.sides.player.ingredientLoot;
      scripted(e,[.01]);e.hurt(e.spawnEnemy('rat','player'),1e9);expect(loot).toEqual([]);
      scripted(e,[.02,.5]);e.hurt(e.spawnEnemy('crab','player'),1e9);expect(loot.at(-1)).toBe('ing_honey');
      scripted(e,[.02,.1]);e.hurt(e.spawnEnemy('killer_bee','player'),1e9);expect(loot.at(-1)).toBe('ing_bamboo');
      scripted(e,[.03]);e.hurt(e.spawnEnemy('charmed_rat','player'),1e9);expect(loot).toHaveLength(2);
      scripted(e,[.99]);e.state.wave=3;e.hurt(e.spawnEnemy('husky_wrecker','player'),1e9);expect(loot).toHaveLength(2);
      scripted(e,[.99]);e.state.wave=6;e.hurt(e.spawnEnemy('husky_wrecker','player'),1e9);expect(loot.at(-1)).toBe(signature);
      scripted(e,[0]);e.state.wave=8;e.hurt(e.spawnEnemy('husky_wrecker','player'),1e9);expect(loot.at(-1)).toBe('ing_mushroom');
    }
  });
  it('awards the wave 10 map signature victory harvest',()=>{
    const e=standardWinner({mapId:'sakura_onsen'});
    expect(e.state.sides.player.ingredientLoot).toEqual(['ing_sakura']);
    expect(e.state.result).toMatchObject({winner:'player',reason:'waves',ingredientLoot:['ing_sakura']});
  });
  it('salvages half (rounded up) on defeat and keeps 100% on victory',()=>{
    for(const [count,kept] of [[0,0],[1,1],[5,3],[6,3]] as const){
      const e=engine(empty);e.start();e.state.sides.player.ingredientLoot=Array.from({length:count},(_,i)=>INGREDIENT_IDS[i%6]);
      e.pause();e.surrender();expect(e.state.result!.ingredientLoot).toEqual(e.state.sides.player.ingredientLoot.slice(0,kept));
    }
  });
  it('drops rare ingredients every 3 endless waves (incl. yuzu, truffle every 6) and reports only the new share',()=>{
    const e=standardWinner();const standard=[...e.state.result!.ingredientLoot!];expect(e.enterEndless().ok).toBe(true);
    expect(e.state.standardResult!.ingredientLoot).toEqual(standard);
    scripted(e,[.65]);e.skipWave();e.skipWave();// Wave 13 (k=3) drops 1 ingredient from 5-pool
    e.state.enemies=[];e.state.spawned=e.currentWaveTargetCount();(e as unknown as {pendingBosses:unknown[]}).pendingBosses=[];
    e.pause();e.surrender();
    const result=e.state.result!;expect(result.endless).toBe(true);
    expect(result.endlessIngredientLoot).toEqual(['ing_bamboo']);
    expect(result.ingredientLoot).toEqual([...standard,'ing_bamboo']);
    expect(result.endlessCoins).toBe(21);
  });
  it('banks ingredients idempotently through both receipts, including defeat salvage',()=>{
    const p={...createProfile(),ingredients:{ing_yuzu:1}};
    const loss:BattleResult={winner:'ai',reason:'oranges',loot:[],playerLoot:[],aiLoot:[],coins:0,elapsed:30,ingredientLoot:['ing_yuzu','ing_chili','ing_fake']};
    const first=awardBattle(p,'p14-loss',loss);expect(first.awarded).toBe(true);
    expect(first.profile.ingredients).toEqual({ing_yuzu:2,ing_chili:1});expect(first.profile.coins).toBe(0);
    expect(awardBattle(first.profile,'p14-loss',loss)).toMatchObject({awarded:false,profile:first.profile});
    const e=standardWinner();const standardProfile=awardBattle(p,e.state.id,e.state.result!);
    expect(standardProfile.profile.ingredients).toEqual({ing_yuzu:2});
    e.enterEndless();e.skipWave();e.skipWave();scripted(e,[.25]);e.state.enemies=[];e.state.spawned=e.currentWaveTargetCount();(e as unknown as {pendingBosses:unknown[]}).pendingBosses=[];e.pause();e.surrender();
    const bonus=awardEndless(standardProfile.profile,e.state.id,e.state.result!);
    expect(bonus.awarded).toBe(true);expect(bonus.profile.ingredients).toEqual({ing_yuzu:2,ing_sakura:1});
    expect(awardEndless(bonus.profile,e.state.id,e.state.result!).awarded).toBe(false);
    expect(awardEndless(standardProfile.profile,e.state.id,{...e.state.result!,endlessIngredientLoot:'ing_yuzu' as unknown as string[]}).awarded).toBe(false);
  });
});

describe('P14 every bath broth changes the battle',()=>{
  it('keeps a P13 battle byte-identical when nothing is brewed',()=>{
    const e=engine(empty);
    expect(e.state.sides.player).toMatchObject({food:ECONOMY.initialFood,oranges:ECONOMY.initialOranges,ingredientLoot:[]});
    expect(Object.keys(e.state.sides.player.loadout).sort()).toEqual(['equippedActiveProps','equippedPassiveProps','equippedWeapons','ownedProps']);
    expect(copyLoadout(createProfile())).toEqual(empty);
    const u=unit(e,'hamster');expect(e.getUnitStats(u).damage).toBe(16);expect(e.getUnitStats(u).rate).toBe(1.25);
    e.start();e.skipWave();e.skipWave();expect(e.state.sides.player.food).toBe(ECONOMY.initialFood+ECONOMY.waveIncome);
  });
  it('applies the collection aura even without an equipped soak',()=>{
    const e=engine({...empty,unlockedBroths:['dish_yuzu_bath','dish_bamboo_broth'],brothLevels:{dish_yuzu_bath:2,dish_bamboo_broth:1},activeBrothId:null});
    const stats=e.getUnitStats(unit(e,'squirrel'));expect(stats.damage).toBeCloseTo(10*1.045,10);expect(stats.rate).toBeCloseTo(1.1*1.02,10);
    expect(e.state.sides.player.food).toBe(ECONOMY.initialFood);
  });
  it('dish_yuzu_bath: +6/+9/+12 starting fish and +2/+3/+4 wave income',()=>{
    for(const [level,food,income] of [[1,6,2],[2,9,3],[3,12,4]] as const){
      const e=engine(soak('dish_yuzu_bath',level));expect(e.state.sides.player.food).toBe(22+food);
      e.start();e.skipWave();const before=e.state.sides.player.food;e.skipWave();expect(e.state.sides.player.food-before).toBe(3+income);
    }
  });
  const ratio=(id:BrothId,level:BrothLevel,kind:string,unitLevel=1)=>{
    const on=engine(soak(id,level)),off=engine(soak(id,level,false));
    const a=on.getUnitStats(unit(on,kind,unitLevel)),b=off.getUnitStats(unit(off,kind,unitLevel));
    return{damage:a.damage/b.damage,rate:a.rate/b.rate,range:a.range-b.range,charge:a.charge-b.charge};
  };
  it('dish_bamboo_broth: melee pets and heroes gain ATK and SPD; ranged do not',()=>{
    expect(ratio('dish_bamboo_broth',1,'hamster').damage).toBeCloseTo(1.18,10);expect(ratio('dish_bamboo_broth',1,'hamster').rate).toBeCloseTo(1.12,10);
    expect(ratio('dish_bamboo_broth',3,'kungfu_po').damage).toBeCloseTo(1.35,10);expect(ratio('dish_bamboo_broth',3,'panda').rate).toBeCloseTo(1.2,10);
    expect(ratio('dish_bamboo_broth',3,'squirrel')).toMatchObject({damage:1,rate:1});
  });
  it('dish_honey_osmanthus: refunds 8/11/14 fish for a new legendary merge only',()=>{
    for(const [level,refund] of [[1,8],[2,11],[3,14]] as const){
      const food=(active:boolean)=>{const e=engine(soak('dish_honey_osmanthus',level,active)),a=unit(e,'panda'),b=unit(e,'hat_bamboo');const start=e.state.sides.player.food;
        expect(e.move(a.id,b.location).ok).toBe(true);return{gain:e.state.sides.player.food-start,events:e.state.events.filter(ev=>ev.type==='food').length};};
      expect(food(true)).toEqual({gain:refund,events:1});expect(food(false)).toEqual({gain:0,events:0});
    }
    const e=engine(soak('dish_honey_osmanthus',3)),a=unit(e,'hamster'),b=unit(e,'hamster');const start=e.state.sides.player.food;e.move(a.id,b.location);
    expect(e.state.sides.player.food).toBe(start);
  });
  it('dish_ginger_soak: ranged ATK and range rings agree with engine math',()=>{
    const r=ratio('dish_ginger_soak',2,'squirrel');expect(r.damage).toBeCloseTo(1.26,10);expect(r.range).toBeCloseTo(.55,10);
    expect(ratio('dish_ginger_soak',3,'doge_wick').range).toBeCloseTo(.7,10);expect(ratio('dish_ginger_soak',3,'hamster')).toMatchObject({damage:1,range:0});
    const e=engine(soak('dish_ginger_soak',1)),s=unit(e,'squirrel');expect(combatRange(s,e.state.sides.player.loadout)).toBeCloseTo(e.getUnitStats(s).range,10);
    expect(combatRange(s,e.state.sides.player.loadout)).toBeCloseTo(2.8+.4,10);
  });
  it('dish_spicy_hotpot: bosses take +22/32/45% and direct hits leave a two-second burn',()=>{
    for(const [level,bonus,burn] of [[1,.22,.06],[3,.45,.12]] as const){
      const hit=(active:boolean)=>{const e=engine(soak('dish_spicy_hotpot',level,active)),u=unit(e,'hamster'),boss=e.spawnEnemy('husky_wrecker','player'),rat=e.spawnEnemy('rat','player');
        const hp=boss.hp;e.hurt(boss,40,u);e.hurt(rat,1,u);return{lost:hp-boss.hp,boss,rat,damage:e.getUnitStats(u).damage};};
      const on=hit(true),off=hit(false);expect(on.lost/off.lost).toBeCloseTo(1+bonus,10);
      expect(on.boss.burn).toBe(2);expect(on.boss.burnDps).toBeCloseTo(on.damage*burn,10);expect(on.rat.burn).toBe(2);
      expect(off.boss.burn).toBe(0);
    }
    const e=engine(soak('dish_spicy_hotpot',1)),rat=e.spawnEnemy('rat','player');e.hurt(rat,5);expect(rat.burn).toBe(0);
  });
  it('dish_sakura_milk: extra oranges and slower foes within 3.5 cells of the tub',()=>{
    for(const [level,oranges,slow] of [[1,1,.18],[2,2,.24],[3,2,.3]] as const){
      const e=engine(soak('dish_sakura_milk',level));expect(e.state.sides.player.oranges).toBe(3+oranges);
      const moved=(active:boolean,progress:number)=>{const x=engine(soak('dish_sakura_milk',level,active));x.start();const foe=x.spawnEnemy('rat','player');foe.progress=progress;x.tick(.05);return foe.progress-progress;};
      const end=getMap('sunny_backyard').paths.player.length-1;
      expect(moved(true,end-3)/moved(false,end-3)).toBeCloseTo(1-slow,10);expect(moved(true,1)).toBeCloseTo(moved(false,1),12);
    }
  });
  it('dish_matcha_tea: magic ATK and shorter hero charge, never below three',()=>{
    expect(ratio('dish_matcha_tea',1,'zen_master').damage).toBeCloseTo(1.2,10);expect(ratio('dish_matcha_tea',1,'zen_master').charge).toBe(-1);
    expect(ratio('dish_matcha_tea',3,'purrcerer').charge).toBe(-2);expect(ratio('dish_matcha_tea',3,'kungfu_po').damage).toBe(1);
    expect(ratio('dish_matcha_tea',3,'kungfu_po').charge).toBe(-2);
    const e=engine(soak('dish_matcha_tea',3)),hero=unit(e,'purrcerer',5);
    expect(e.getUnitStats(hero).charge).toBe(Math.max(3,Math.ceil(7*.9**4)-2));expect(combatCharge(hero,e.state.sides.player.loadout)).toBe(e.getUnitStats(hero).charge);
    expect(e.getUnitStats(hero).charge).toBeGreaterThanOrEqual(3);
  });
  it('dish_herbal_tonic: faster shovels and bees',()=>{
    const e=engine(soak('dish_herbal_tonic',2));expect(e.getShovelRules().interval).toBeCloseTo(SHOVEL_PRODUCTION.interval*.65,10);
    expect(getBeeProduction(1,soak('dish_herbal_tonic',3)).interval).toBeCloseTo(18*.65,10);expect(getBeeProduction(1,empty).interval).toBe(18);
    const auto={...soak('dish_herbal_tonic',1),ownedProps:{auto_shovel:1},equippedPassiveProps:['auto_shovel']};
    expect(engine(auto).getShovelRules()).toEqual({interval:30*.75,maxStored:6});
  });
  it('dish_truffle_ramen: only basic pets at Lv.3+ hit harder',()=>{
    expect(ratio('dish_truffle_ramen',1,'hamster',3).damage).toBeCloseTo(1.28,10);expect(ratio('dish_truffle_ramen',3,'corgi',5).damage).toBeCloseTo(1.55,10);
    expect(ratio('dish_truffle_ramen',3,'hamster',2).damage).toBe(1);expect(ratio('dish_truffle_ramen',3,'kungfu_po',3).damage).toBe(1);
  });
  it('dish_chill_melon: slows every foe on the lane',()=>{
    const moved=(active:boolean)=>{const x=engine(soak('dish_chill_melon',3,active));x.start();const foe=x.spawnEnemy('roach','player');x.tick(.05);return foe.progress;};
    expect(moved(true)/moved(false)).toBeCloseTo(.82,10);
  });
  it('dish_golden_feast: more victory and endless coins plus a bonus drop roll',()=>{
    const won=standardWinner({loadouts:{player:soak('dish_golden_feast',1)}}),base=RANKS[0].winCoins+Math.min(45,Math.floor(won.state.sides.player.food*.5));
    expect(won.state.result!.coins).toBe(Math.round(base*1.3));
    const plain=standardWinner({loadouts:{player:soak('dish_golden_feast',1,false)}});
    expect(plain.state.result!.coins).toBe(RANKS[0].winCoins+Math.min(45,Math.floor(plain.state.sides.player.food*.5)));
    const e=engine(soak('dish_golden_feast',2));e.state.wave=6;scripted(e,[0]);e.hurt(e.spawnEnemy('husky_wrecker','player'),1e9);
    expect(e.state.sides.player.ingredientLoot).toEqual(['ing_bamboo','ing_yuzu']);
    won.enterEndless();scripted(won,[.9]);won.state.enemies=[];won.state.spawned=won.currentWaveTargetCount();(won as unknown as {pendingBosses:unknown[]}).pendingBosses=[];won.pause();won.surrender();
    expect(won.state.result!.endlessCoins).toBe(Math.round(15*1.3));
  });
  it('dish_imperial_onsen: team ATK/SPD, fish and oranges',()=>{
    const r=ratio('dish_imperial_onsen',3,'squirrel');expect(r.damage).toBeCloseTo(1.3,10);expect(r.rate).toBeCloseTo(1.2,10);
    expect(ratio('dish_imperial_onsen',1,'purrcerer').damage).toBeCloseTo(1.15,10);
    const e=engine(soak('dish_imperial_onsen',3));expect(e.state.sides.player).toMatchObject({food:30,oranges:5});
  });
  it('syncs broth swaps during Wave 1 preparation without minting fish or forgiving oranges',()=>{
    const e=engine(soak('dish_yuzu_bath',1),{autoWaves:true});e.start();expect(e.state.sides.player.food).toBe(28);
    expect(e.syncPreparationLoadout(empty).ok).toBe(true);expect(e.state.sides.player.food).toBe(22);
    expect(e.syncPreparationLoadout(soak('dish_imperial_onsen',1)).ok).toBe(true);expect(e.state.sides.player).toMatchObject({food:26,oranges:4});
    e.state.sides.player.food=2;e.syncPreparationLoadout(empty);expect(e.state.sides.player).toMatchObject({food:0,oranges:3});
    e.syncPreparationLoadout(soak('dish_imperial_onsen',1));expect(e.state.sides.player.food).toBe(2);
    e.adjustOranges(-1);expect(e.state.sides.player.oranges).toBe(3);
    e.syncPreparationLoadout(soak('dish_sakura_milk',2));expect(e.state.sides.player.oranges).toBe(4);
    for(let i=0;i<5;i++){e.syncPreparationLoadout(empty);e.syncPreparationLoadout(soak('dish_yuzu_bath',3));}
    // The 2 fish eaten beyond the earlier bonus stay owed: -2 + 12 = 10, never a fresh 12.
    expect(e.state.sides.player).toMatchObject({food:10,oranges:2});
    e.tick(20);expect(e.syncPreparationLoadout(empty).ok).toBe(false);
  });
});

type Recorded={name:string;args:unknown[];fill?:unknown;stroke?:unknown};
function surface(){
  const calls:Recorded[]=[],stops:string[]=[],values:Record<string,unknown>={globalAlpha:1};
  const c=new Proxy(values,{get(v,k:string){if(k in v)return v[k];if(k==='measureText')return(s:string)=>({width:s.length*8});
    if(k.includes('Gradient'))return()=>({addColorStop:(_:number,color:string)=>stops.push(color)});
    return(...args:unknown[])=>{calls.push({name:k,args,fill:v.fillStyle,stroke:v.strokeStyle});};},set(v,k:string,x){v[k]=x;return true;}}) as unknown as CanvasRenderingContext2D;
  return{calls,stops,renderer:new StickerRenderer({getContext:()=>c,width:0,height:0} as unknown as HTMLCanvasElement)};
}
describe('P14 renderer and UI markup',()=>{
  it('fills the tub with the broth palette, tinted steam and garnish only while a broth is equipped',()=>{
    const tinted=engine(soak('dish_sakura_milk',2)),plain=engine(empty);
    const a=surface();a.renderer.draw(tinted.state,0);
    for(const color of ['#FFE6EF','#F8BBD0','#D98AA6'])expect(a.stops).toContain(color);
    expect(a.calls.some(call=>call.name==='stroke'&&String(call.stroke).startsWith('rgba(255,234,241,'))).toBe(true);
    const b=surface();b.renderer.draw(plain.state,0);
    for(const color of ['#B9F0EC','#7FD5D0','#53A9A8'])expect(b.stops).toContain(color);
    expect(b.stops).not.toContain('#F8BBD0');
    expect(b.calls.some(call=>String(call.stroke).startsWith('rgba(255,234,241'))).toBe(false);
  });
  it.each(['zh-CN','en'] as const)('shows the kitchen medallion, brew badge and active soak pill (%s)',language=>{
    setLanguage(language);const fresh={...createProfile(),stars:23,highestStars:23,matches:23,ingredients:{ing_yuzu:4}};
    const menu=courtyardMarkup(fresh);
    expect(menu).toContain('data-action="kitchen"');expect(menu).toContain('ui_kitchen_pot');expect(menu).toContain(t('p14.brewBadge'));
    expect(menu).not.toContain('active-broth-pill');expect(menu.match(/hub-dock-left[\s\S]*?<\/nav>/)![0].match(/<button/g)).toHaveLength(3);
    const brewed=brewBroth(fresh,'dish_yuzu_bath').profile,after=courtyardMarkup(brewed);
    expect(after).toContain('kitchen-progress-badge">1/14');expect(after).not.toContain('kitchen-brew-badge');
    expect(after).toContain('class="active-broth-pill" data-action="kitchen"');expect(after).toContain('dish_yuzu_bath');expect(after).toContain(t('broth.dish_yuzu_bath'));expect(after).toContain('Lv.1');
  });
  it('renders the broths tab, dish detail sheet, pantry and basket and persists each action',()=>{
    const saved=memory();let profile:Profile={...createProfile(),coins:420,ingredients:{ing_yuzu:4}};
    const notify=vi.fn(),render=vi.fn(),sound=vi.fn();
    const kitchen=new KitchenScreen(()=>profile,next=>{profile=next;},render,notify,sound);
    let html=kitchen.markup();
    expect(html).toContain('data-ledger-page="kitchen"');expect(html).toContain('ui_kitchen_peek_capy');expect(html).toContain('温泉料理屋');
    expect(html).toContain('配方 0/14 · 全员攻击 +0% 攻速 +0%');expect(html).toContain('kitchen-active-strip is-empty');
    expect(html.match(/class="storybook-row-card kitchen-row /g)).toHaveLength(14);expect(html.match(/data-action="kitchen-tab:/g)).toHaveLength(2);
    expect(html).toContain('data-action="kitchen-brew:dish_yuzu_bath"');expect(html.match(/kitchen-short-label/g)).toHaveLength(13);
    expect(html).toContain('storybook-footer-tip');expect(html).toContain('data-action="close-kitchen"');
    expect(kitchen.action('kitchen-brew:dish_yuzu_bath')).toBe(true);
    expect(profile.activeBrothId).toBe('dish_yuzu_bath');expect(sound).toHaveBeenLastCalledWith('merge_hero');expect(notify).toHaveBeenLastCalledWith('p14.brewed');
    expect(JSON.parse(saved.get('capybara_defense_v1:profile')!).unlockedBroths).toEqual(['dish_yuzu_bath']);
    html=kitchen.markup();expect(html).toContain('配方 1/14 · 全员攻击 +2% 攻速 +1%');expect(html).toContain('data-action="kitchen-unequip"');
    expect(html).toContain('aria-pressed="true"');expect(html).toContain(t('p14.active'));
    kitchen.action('kitchen-dish:dish_yuzu_bath');html=kitchen.markup();
    expect(html).toContain('kitchen-detail-sheet');expect(html).toContain('data-action="kitchen-back"');expect(html).toContain('1 / 14');
    expect(html.match(/kitchen-ladder-step/g)).toHaveLength(3);expect(html).toContain('Lv.2');expect(html).toContain('Lv.3');
    expect(html).toContain('data-action="kitchen-upgrade:dish_yuzu_bath" disabled');expect(html).toContain(t('broth.dish_yuzu_bath.story'));
    expect(html).toContain('kitchen-source-hint');
    kitchen.action('kitchen-next');expect(kitchen.markup()).toContain('data-detail-broth-id="dish_bamboo_broth"');
    kitchen.action('kitchen-prev');kitchen.action('kitchen-prev');expect(kitchen.markup()).toContain('data-detail-broth-id="dish_golden_orchard"');
    kitchen.action('kitchen-equip:dish_yuzu_bath');expect(profile.activeBrothId).toBeNull();expect(sound).toHaveBeenLastCalledWith('hit_heavy');
    kitchen.action('kitchen-tab:pantry');html=kitchen.markup();
    expect(html.match(/class="storybook-row-card kitchen-ingredient-row /g)).toHaveLength(6);expect(html).toContain('kitchen-basket-card');
    expect(html).toContain('data-action="kitchen-basket"');expect(html).not.toContain('kitchen-basket-result');
    vi.spyOn(Math,'random').mockReturnValue(.01);kitchen.action('kitchen-basket');
    expect(profile.coins).toBe(60);expect(profile.ingredients).toEqual({ing_yuzu:3});expect(sound).toHaveBeenLastCalledWith('lottery_win');
    html=kitchen.markup();expect(html).toContain('kitchen-basket-result');expect(html.match(/<li><img|<li><svg/g)).toHaveLength(3);expect(html).toContain('×3');
    profile={...profile,coins:10};kitchen.action('kitchen-basket');expect(notify).toHaveBeenLastCalledWith('meta.insufficientCoins',true);
    expect(kitchen.markup()).toContain('data-action="kitchen-basket" disabled');
  });
  it('adds the today’s-soak pill and tooltip to the right rail, and a kitchen slot in preparation',()=>{
    const e=engine(soak('dish_spicy_hotpot',2));
    const html=passiveRailMarkup(e.state,false);
    expect(html.indexOf('broth-rail-pill')).toBeLessThan(html.indexOf('passive-rail-heading'));
    expect(html).toContain('data-action="broth-info"');expect(html).toContain('dish_spicy_hotpot');expect(html).toContain('Lv.2');
    expect(html).toContain(brothEffectText('dish_spicy_hotpot',2));expect(html).toContain('aria-expanded="false"');
    expect(passiveRailMarkup(e.state,false,'broth')).toContain('broth-rail-pill is-expanded');
    expect(passiveRailMarkup(engine(empty).state,true)).not.toContain('broth-rail-pill');
    expect(passiveRailMarkup(engine(soak('dish_spicy_hotpot',2,false)).state,true)).toContain('broth-rail-pill broth-empty" data-action="kitchen"');
  });
  it('lists gathered ingredients on the pause page and the victory/defeat treasure shelf',()=>{
    const e=engine(empty);e.start();
    expect(pauseMarkup(e.state)).not.toContain('pause-ingredients');
    e.state.sides.player.ingredientLoot=['ing_yuzu','ing_chili','ing_yuzu'];
    const pause=pauseMarkup(e.state);expect(pause).toContain('pause-ingredients');expect(pause).toContain('ing_yuzu');expect(pause).toContain('×2');expect(pause).toContain(t('ingredient.ing_chili'));
    const profile=createProfile(),view=(state:BattleState)=>resultMarkup({state,profile,savedResult:true,resultStars:0,previousRank:0,newWeapons:[],newAvatars:[],statsOpen:true});
    const win=standardWinner();const victory=view(win.state);
    expect(win.state.result!.ingredientLoot).toEqual(['ing_yuzu']);
    expect(victory).toContain('crest-ingredients');expect(victory).toContain('+1');expect(victory).toContain('visual-treasure-item is-ingredient');
    expect(victory.match(/visual-treasure-item is-ingredient/g)).toHaveLength(1);expect(victory).toContain('×1');expect(victory).not.toContain('ingredient-salvage-note');
    e.pause();e.surrender();const defeat=view(e.state);
    expect(defeat).toContain('crest-ingredients');expect(defeat).toContain('+2');expect(defeat).toContain('ingredient-salvage-note');
    expect(defeat.match(/visual-treasure-item is-ingredient/g)).toHaveLength(2);
    const none=engine(empty);none.start();none.pause();none.surrender();expect(view(none.state)).not.toContain('crest-ingredients');
  });
});

describe('P14 bilingual copy',()=>{
  const wholesome=/涩涩|色色|不许涩|Bonk|bonk|绝育|绿茶|疯批|舔狗|鸡你太/i;
  it('ships complete zh-CN/en parity with no raw keys or unresolved placeholders',()=>{
    expect(Object.keys(p14En).sort()).toEqual(Object.keys(p14Zh).sort());
    for(const key of Object.keys(p14Zh)){expect(p14Zh[key].trim()).not.toBe('');expect(p14En[key].trim()).not.toBe('');}
    for(const language of ['zh-CN','en'] as const){
      setLanguage(language);
      for(const id of INGREDIENT_IDS)for(const key of [`ingredient.${id}`,`ingredient.${id}.flavor`,`ingredient.${id}.source`])expect(t(key)).not.toBe(key);
      for(const id of BROTH_IDS){
        for(const key of [`broth.${id}`,`broth.${id}.style`,`broth.${id}.story`])expect(t(key)).not.toBe(key);
        for(const level of [1,2,3] as const){const text=brothEffectText(id,level);expect(text).not.toMatch(/[{}]/);expect(text).not.toContain('broth.');}
      }
    }
    setLanguage('en');expect(brothEffectText('dish_ginger_soak',2)).toBe('Ranged friends ATK +26%, range +0.55 cells');
    setLanguage('zh-CN');expect(brothEffectText('dish_yuzu_bath',3)).toBe('开局 +12 烤鱼干，每波收入额外 +4');
  });
  it('stays wholesome in every P14 text source',()=>{
    for(const file of ['src/i18n/p14.ts','src/config/kitchen.ts'])expect(readFileSync(file,'utf8')).not.toMatch(wholesome);
    for(const text of [...Object.values(p14Zh),...Object.values(p14En)])expect(text).not.toMatch(wholesome);
  });
  it('classifies every unit into the right broth family',()=>{
    expect(['hamster','corgi','panda','cat','kungfu_po','ronin_goose'].map(getUnitCombatFamily)).toEqual(Array(6).fill('melee'));
    expect(['squirrel','hedgehog','doge_wick','rocket_coon'].map(getUnitCombatFamily)).toEqual(Array(4).fill('ranged'));
    expect(['zen_master','pepe_king'].map(getUnitCombatFamily)).toEqual(['magic','magic']);
    expect(['bee','shovel','nope'].map(getUnitCombatFamily)).toEqual([null,null,null]);
    expect(BROTH_IDS.map(id=>BROTHS[id].tier)).toEqual([1,1,1,1,2,2,2,2,3,3,3,4,4,4]);
  });
});
