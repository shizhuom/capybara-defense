import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {BattleEngine,type EngineOptions} from '../src/core/BattleEngine';
import {CombatRecords,computeUnitMomentum} from '../src/core/CombatRecords';
import {MergeSystem} from '../src/core/MergeSystem';
import {getMergeTargets} from '../src/core/MergeTargets';
import {copyLoadout} from '../src/core/PropSystem';
import {formatCompactNumber} from '../src/core/formatNumber';
import {createProfile,normalizeProfile,unlockAllProfile} from '../src/core/MetaProgression';
import {upgradeMedallion,upgradeableMedallions,grantEndlessCrests,normalizeMedallions} from '../src/core/MedallionProgression';
import {SESSION_PLAYER_ID,SESSION_WRITE_SECRET,defaultNickname,generatePlayerId,generateWriteSecret,isValidPlayerId,isValidWriteSecret,validateNickname} from '../src/core/PlayerIdentity';
import {FICTIONAL_LOCATIONS,fictionalLocationToken,formatLocation,isFictionalLocation,nextFictionalLocationToken,sanitizeLocation} from '../src/core/Location';
import {coarsenCoord,parseReverseGeocode,resolveBrowserLocation} from '../src/ui/LocationService';
import {setRank} from '../src/core/PlayerProgression';
import {
  AWAKENED_DAMAGE,AWAKENED_RATE,LATE_CREST_COSTS,MEDALLION_IDS,MOMENTUM_CAP,STANDARD_VICTORY_CRESTS,armorPenetration,bossResist,bossSlayerMultiplier,
  breakthroughAttackMultiplier,capyShieldCooldown,computeBreakthroughChance,endlessCrestsForWave,endlessCrestsThroughWave,endlessDamageMultiplier,
  estimateEndlessCeilingWave,luckBonus,medallionCrestsBetween,medallionUpgradeCost,momentumMultiplier,type MedallionId,
} from '../src/config/medallions';
import {ENDLESS_HP_GROWTH,WAVES,getWaveConfig} from '../src/config/waves';
import {getMap} from '../src/config/maps';
import {awardBattle,awardEndless,loadProfile,saveProfile} from '../src/ui/storage';
import {P17_AWAKENED_IDS,P17_SCENE_IDS,sceneSticker,awakenedSticker} from '../src/ui/stickers';
import {courtyardMarkup,endlessHallPillMarkup} from '../src/ui/CourtyardView';
import {MedallionScreen,medallionEffectText,endlessHubTabs} from '../src/ui/MedallionScreen';
import {ProfileScreens,endlessBoardMarkup} from '../src/ui/ProfileScreens';
import {ledgerTabs} from '../src/ui/LedgerView';
import {liveUnitCardMarkup} from '../src/ui/LiveUnitCard';
import {endlessOfferMarkup,pauseMarkup,resultMarkup,resultCrests} from '../src/ui/SettlementView';
import {Compendium} from '../src/ui/Compendium';
import {MetaScreens} from '../src/ui/MetaScreens';
import {EndlessLeaderboardClient,parseLeaderboard,parseRankLeaderboard,rankSubmissionFromProfile,submissionFromProfile,BOARD_CACHE_KEY,RANK_BOARD_CACHE_KEY} from '../src/ui/EndlessLeaderboardClient';
import {
  compareRankRows,compareRows,formatCfGeo,handleRequest,memoryStore,mergeRank,mergeScore,minimumElapsed,normalizeNicknameKey,rateLimitDecision,sanitizeNickname,validateRank,validateScore,type Env,type ScoreStore,
} from '../cloudflare-leaderboard/src/index';
import {setLanguage,t} from '../src/i18n/i18n';
import {p17En,p17Zh} from '../src/i18n/p17';
import type {BattleLoadout,BattleResult,Profile,Unit} from '../src/core/types';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();setLanguage('zh-CN');});
const UNKIND=String.fromCharCode(0x7eff,0x8336);// one of the blocked words, built at runtime
const sprite=(id:string)=>readFileSync(`public/assets/sprites/${id}.png`);
function alphaRow(buffer:Buffer,row:number):number[] {
  let offset=8,width=0;const idat:Buffer[]=[];
  while(offset<buffer.length){const length=buffer.readUInt32BE(offset),kind=buffer.toString('ascii',offset+4,offset+8),data=buffer.subarray(offset+8,offset+8+length);
    if(kind==='IHDR')width=data.readUInt32BE(0);if(kind==='IDAT')idat.push(data);offset+=12+length;}
  const stride=width*4,raw=inflateSync(Buffer.concat(idat)),rows:Uint8Array[]=[];
  for(let y=0;y<=row;y++){const f=raw[y*(stride+1)],src=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)),out=new Uint8Array(stride),up=rows[y-1];
    for(let i=0;i<stride;i++){const a=i>=4?out[i-4]:0,b=up?up[i]:0,c=up&&i>=4?up[i-4]:0,p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
      out[i]=(src[i]+(f===1?a:f===2?b:f===3?(a+b)>>1:f===4?(pa<=pb&&pa<=pc?a:pb<=pc?b:c):0))&255;}rows.push(out);}
  return Array.from({length:width},(_,x)=>rows[row][x*4+3]);
}
const base:BattleLoadout={ownedProps:{},equippedWeapons:{},equippedActiveProps:[],equippedPassiveProps:[]};
const all=(level:number)=>Object.fromEntries(MEDALLION_IDS.map(id=>[id,level])) as Record<MedallionId,number>;
const medals=(levels:Partial<Record<MedallionId,number>>):BattleLoadout=>({...base,endlessMedallions:levels});
const unit=(e:BattleEngine,kind:string,level=1)=>{const r=e.grant(kind);const u=e.state.units.find(x=>x.id===r.unitId)!;u.level=level;return u;};
/** Standard ten-wave victory (no auto waves), then endless at Wave 11. */
function endless(loadout:BattleLoadout=base,options:EngineOptions={}):BattleEngine {
  const e=new BattleEngine({seed:41,autoWaves:false,loadouts:{player:loadout},...options});e.start();
  while(e.state.phase!=='finished')e.skipWave();expect(e.enterEndless().ok).toBe(true);return e;
}
function standard(loadout:BattleLoadout=base):BattleEngine {const e=new BattleEngine({seed:41,autoWaves:false,loadouts:{player:loadout}});e.start();e.skipWave();return e;}
function script(e:BattleEngine,stream:'endlessRandom'|'random'|'ingredientRandom'|'villageRandom',values:number[]):void {
  let i=0;(e as unknown as Record<string,{next():number}>)[stream]={next:()=>values[i++%values.length]};
}
const stream=(e:BattleEngine,name:string,n=6)=>Array.from({length:n},()=>(e as unknown as Record<string,{next():number}>)[name].next());
const killRat=(e:BattleEngine,by:Unit,boss=false)=>e.hurt(e.spawnEnemy(boss?'husky_wrecker':'rat','player'),1e12,by,false,false,true);
function memoryStorage():Storage {
  const data=new Map<string,string>();
  return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,
    setItem:(key,value)=>{data.set(key,value);},removeItem:key=>{data.delete(key);},clear:()=>data.clear()};
}

describe('P17 assets: 288 sprites with twenty exact RGBA P17 stickers',()=>{
  const sizes:Record<string,[number,number]>={...Object.fromEntries(P17_AWAKENED_IDS.map(id=>[id,[256,256]])),
    med_breakthrough_atk:[160,160],med_luck_rate:[160,160],med_momentum:[160,160],med_boss_resist:[160,160],med_boss_slayer:[160,160],med_capy_shield:[160,160],
    ui_endless_crest:[160,160],ui_medallion_peek_capy:[256,256]};
  it('ships 288 unique synced sprites including every P17 id at its exact size',()=>{
    const ids=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8')) as string[];
    expect(ids).toHaveLength(288);expect(new Set(ids).size).toBe(288);expect(readdirSync('public/assets/sprites').filter(f=>f.endsWith('.png'))).toHaveLength(288);
    expect(P17_SCENE_IDS).toHaveLength(20);expect(new Set(P17_SCENE_IDS).size).toBe(20);expect(Object.keys(sizes).sort()).toEqual([...P17_SCENE_IDS].sort());
    for(const [id,[w,h]] of Object.entries(sizes)){expect(ids).toContain(id);const png=sprite(id);expect([png.readUInt32BE(16),png.readUInt32BE(20),png[24],png[25]]).toEqual([w,h,8,6]);}
    // Transparent corners on every sticker; the master copy in design/assets matches the synced file byte for byte.
    for(const id of P17_SCENE_IDS){expect(alphaRow(sprite(id),0)[0]).toBe(0);expect(readFileSync(`../../design/assets/sprites/${id}.png`).equals(sprite(id))).toBe(true);}
  });
  it('keeps the medallion mascot bottom-flush with the established peek capybara',()=>{
    for(const row of [253,254,255])expect(alphaRow(sprite('ui_medallion_peek_capy'),row)).toEqual(alphaRow(sprite('ui_compendium_peek_capy'),row));
    expect(Math.max(...alphaRow(sprite('ui_medallion_peek_capy'),254))).toBeGreaterThan(200);
  });
  it('renders twenty distinct borderless, text-free SVG fallbacks before the PNGs decode',()=>{
    const svgs=P17_SCENE_IDS.map(id=>sceneSticker(id,'',64));
    for(const svg of svgs){expect(svg).toContain('<svg');expect(svg).not.toContain('<text');expect(svg).not.toContain('stroke="#fffdf6"');}
    expect(new Set(svgs.map(s=>s.replace(/data-sticker="[^"]*"|aria-label="[^"]*"/g,''))).size).toBe(20);
    expect(awakenedSticker('kungfu_po',40)).toContain('kungfu_po_awakened');expect(awakenedSticker('hamster',40)).not.toContain('_awakened');
  });
  it('archives five magenta raw sheets and the dark checkerboard preview',()=>{
    const raw=readdirSync('../../design/assets/raw_sheets');
    for(const file of ['61_p17_awakened_heroes_a.png','62_p17_awakened_heroes_b.png','63_p17_awakened_heroes_c.png','64_p17_medallions_a.png','65_p17_medallions_b_and_ui.png'])expect(raw).toContain(file);
    expect(readdirSync('../../design/assets/previews')).toContain('33_p17_endless_awakening_and_medallions.png');
  });
});

describe('P17 endless curve ×1.25 and the Wave 70-80 sweet spot',()=>{
  it.each([[11,11.25],[20,83.82],[45,22186],[70,5872774],[80,54694467]])('wave %i scales HP to %f',(wave,expected)=>{
    const config=getWaveConfig(wave),k=wave-10;
    expect(config.hpScale).toBe(WAVES[9].hpScale*Math.pow(ENDLESS_HP_GROWTH,k));
    expect(config.hpScale/expected).toBeCloseTo(1,3);
    expect(config.speedScale).toBeCloseTo(1+Math.min(.6,.012*k),10);expect(config.armorBonus).toBeCloseTo(Math.min(.45,.009*k),10);
  });
  it('caps speed and armor at Wave 60 and keeps the first ten waves untouched',()=>{
    for(const wave of [60,95]){expect(getWaveConfig(wave).speedScale).toBeCloseTo(1.6,12);expect(getWaveConfig(wave).armorBonus).toBeCloseTo(.45,12);}
    expect(getWaveConfig(95).armorBonus).toBe(.45);
    for(let w=1;w<=10;w++)expect(getWaveConfig(w)).toEqual({...WAVES[w-1],speedScale:1,armorBonus:0});
    expect(getWaveConfig(100_000).hpScale).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('lands newcomers, first breakthroughs and 50h / 100h / 300h lineups in their bands, with 100% at Wave 70-80',()=>{
    expect(estimateEndlessCeilingWave({momentum:0})).toBeGreaterThanOrEqual(13);expect(estimateEndlessCeilingWave({momentum:200})).toBeLessThanOrEqual(15);
    const first=estimateEndlessCeilingWave({awakened:true,momentum:80});expect(first).toBeGreaterThanOrEqual(17);expect(first).toBeLessThanOrEqual(20);
    const half=estimateEndlessCeilingWave({awakened:true,momentum:MOMENTUM_CAP,levels:all(25)});expect(half).toBeGreaterThanOrEqual(42);expect(half).toBeLessThanOrEqual(50);
    const eighty=estimateEndlessCeilingWave({awakened:true,momentum:MOMENTUM_CAP,levels:all(40)});expect(eighty).toBeGreaterThanOrEqual(56);expect(eighty).toBeLessThanOrEqual(66);
    const full=estimateEndlessCeilingWave({awakened:true,momentum:MOMENTUM_CAP,levels:all(50)});expect(full).toBeGreaterThanOrEqual(70);expect(full).toBeLessThanOrEqual(80);
    expect(half).toBeLessThan(eighty);expect(eighty).toBeLessThan(full);
    // The model's multiplier is exactly the product BattleEngine applies (awakening × momentum × boss-weighted slayer).
    expect(endlessDamageMultiplier({awakened:true,momentum:200,levels:all(50)})).toBeCloseTo(AWAKENED_DAMAGE*AWAKENED_RATE*breakthroughAttackMultiplier(50)*4.8/(.5+.5/5),0);
  });
});

describe('P17 crest economy: 50h / 100h / 300h medallion costs',()=>{
  it('prices every level exactly and totals 2,600 + 5,400 + 26,500 = 34,500 per medallion (207,000 for six)',()=>{
    expect(medallionUpgradeCost(0)).toEqual({crests:8,coins:16});expect(medallionUpgradeCost(24)).toEqual({crests:200,coins:400});
    expect(medallionUpgradeCost(25)).toEqual({crests:220,coins:440});expect(medallionUpgradeCost(39)).toEqual({crests:500,coins:1000});
    expect(medallionUpgradeCost(40)).toEqual({crests:800,coins:1600});expect(medallionUpgradeCost(49)).toEqual({crests:4850,coins:9700});
    for(const bad of [50,-1,1.5,NaN])expect(medallionUpgradeCost(bad)).toBeNull();
    expect(medallionCrestsBetween(0,25)).toBe(2600);expect(medallionCrestsBetween(25,40)).toBe(5400);expect(medallionCrestsBetween(40,50)).toBe(26500);
    expect(LATE_CREST_COSTS.reduce((a,b)=>a+b,0)).toBe(26500);
    expect(medallionCrestsBetween(0,50)).toBe(34500);expect(medallionCrestsBetween(0,50)*6).toBe(207000);
    expect(medallionCrestsBetween(0,25)*6).toBe(15600);expect(medallionCrestsBetween(0,40)*6).toBe(48000);
  });
  it('drops 3 crests for clearing Wave 10 and 1..7 per endless wave',()=>{
    expect(STANDARD_VICTORY_CRESTS).toBe(3);
    expect([10,11,20,21,30,31,50,51,61,70,71,120].map(endlessCrestsForWave)).toEqual([0,1,1,2,2,3,4,5,6,6,7,7]);
    expect(endlessCrestsThroughWave(10)).toBe(0);expect(endlessCrestsThroughWave(20)).toBe(10);expect(endlessCrestsThroughWave(30)).toBe(30);
  });
  it('upgrades one level at a time, spends crests and coins, and never goes past Lv.50',()=>{
    const p={...createProfile(),coins:100,endlessCrests:20};
    const r=upgradeMedallion(p,'med_luck_rate');expect(r).toMatchObject({ok:true,key:'p17.medallionUpgraded',level:1,cost:{crests:8,coins:16}});
    expect(r.profile).toMatchObject({coins:84,endlessCrests:12});expect(r.profile.endlessMedallions.med_luck_rate).toBe(1);expect(p.endlessMedallions.med_luck_rate).toBe(0);
    expect(upgradeMedallion(r.profile,'med_luck_rate')).toMatchObject({ok:false,key:'p17.noCrests'});
    expect(upgradeMedallion({...r.profile,endlessCrests:999,coins:0},'med_luck_rate')).toMatchObject({ok:false,key:'meta.insufficientCoins'});
    expect(upgradeMedallion({...p,endlessMedallions:all(50)},'med_luck_rate')).toMatchObject({ok:false,key:'p17.medallionMax'});
    expect(upgradeMedallion(p,'not_a_medal')).toMatchObject({ok:false,key:'p17.invalidMedallion'});
    expect(upgradeableMedallions({...createProfile(),coins:16,endlessCrests:8})).toEqual([...MEDALLION_IDS]);
    expect(grantEndlessCrests(p,5).endlessCrests).toBe(25);expect(grantEndlessCrests(p,-5).endlessCrests).toBe(20);
  });
});

describe('P17 medallion effect formulas',()=>{
  it('matches the spec table at Lv.25 / Lv.40 / Lv.50 and is exactly neutral at Lv.0',()=>{
    expect(breakthroughAttackMultiplier(0)).toBe(1);expect(breakthroughAttackMultiplier(25)).toBeCloseTo(195.75,1);
    expect(breakthroughAttackMultiplier(40)/4642).toBeCloseTo(1,2);expect(breakthroughAttackMultiplier(50)/38330).toBeCloseTo(1,2);
    expect([luckBonus(0),luckBonus(25),luckBonus(40),luckBonus(50)].map(v=>+v.toFixed(3))).toEqual([0,.35,.56,.7]);
    expect([momentumMultiplier(200,0),momentumMultiplier(200,25),momentumMultiplier(200,40),momentumMultiplier(200,50)].map(v=>+v.toFixed(3))).toEqual([1.2,3,4.08,4.8]);
    expect(momentumMultiplier(0,50)).toBe(1);expect(momentumMultiplier(999,0)).toBeCloseTo(1.2);
    expect([bossResist(25),bossResist(40),bossResist(50)].map(v=>+v.toFixed(3))).toEqual([.45,.72,.9]);
    expect([bossSlayerMultiplier(25),bossSlayerMultiplier(40),bossSlayerMultiplier(50)].map(v=>+v.toFixed(3))).toEqual([3,4.2,5]);
    expect([armorPenetration(25),armorPenetration(50)].map(v=>+v.toFixed(3))).toEqual([.45,.9]);
    expect([capyShieldCooldown(0),capyShieldCooldown(1),capyShieldCooldown(25),capyShieldCooldown(40),capyShieldCooldown(50)]).toEqual([Infinity,20,11.67,6.47,3]);
  });
  it('computes the breakthrough chance as base + pre-ten spirit (cap 30%) + clover luck + 5% per miss, capped at 100%',()=>{
    expect(computeBreakthroughChance({preEndlessKills:0,preEndlessBossKills:0,luckMedallionLevel:0,previousFails:0}).total).toBeCloseTo(.3);
    const c=computeBreakthroughChance({preEndlessKills:0,preEndlessBossKills:8,luckMedallionLevel:10,previousFails:0});
    expect([c.base,c.preTenBonus,c.medallionBonus,c.failBonus].map(v=>+v.toFixed(3))).toEqual([.3,.24,.14,0]);expect(c.total).toBeCloseTo(.68);
    expect(computeBreakthroughChance({preEndlessKills:500,preEndlessBossKills:50,luckMedallionLevel:0,previousFails:0}).preTenBonus).toBe(.3);
    expect(computeBreakthroughChance({preEndlessKills:0,preEndlessBossKills:0,luckMedallionLevel:0,previousFails:3}).total).toBeCloseTo(.45);
    expect(computeBreakthroughChance({preEndlessKills:200,preEndlessBossKills:20,luckMedallionLevel:50,previousFails:9}).total).toBe(1);
  });
  it('formats hall effects as current → next values',()=>{
    expect(medallionEffectText('med_boss_resist',25)).toBe('45%');expect(medallionEffectText('med_boss_resist',26)).toBe('46.8%');
    expect(medallionEffectText('med_breakthrough_atk',25)).toBe('×196');expect(medallionEffectText('med_momentum',25)).toBe('×3');
    expect(medallionEffectText('med_boss_slayer',50)).toBe('×5 / 90%');expect(medallionEffectText('med_capy_shield',25)).toBe('11.67s');
    expect(medallionEffectText('med_capy_shield',0)).toBe(t('p17.effect.none'));expect(medallionEffectText('med_luck_rate',50)).toBe('+70%');
  });
});

describe('P17 battle spirit (momentum) records',()=>{
  it('weights standard-wave kills 1.0 / boss 5.0 against endless 0.08 / 0.5 and caps at 200',()=>{
    expect(computeUnitMomentum({preEndlessKills:10,preEndlessBossKills:2,endlessKills:25,endlessBossKills:4})).toBeCloseTo(10+10+2+2);
    expect(computeUnitMomentum({preEndlessKills:1,preEndlessBossKills:0,endlessKills:0,endlessBossKills:0})).toBe(computeUnitMomentum({preEndlessKills:0,preEndlessBossKills:0,endlessKills:12.5,endlessBossKills:0}));
    expect(computeUnitMomentum({preEndlessKills:500,preEndlessBossKills:0,endlessKills:0,endlessBossKills:0})).toBe(200);
  });
  it('splits kills by wave phase and carries every tally through merges',()=>{
    const records=new CombatRecords(),a={id:1,side:'player',kind:'panda'} as Unit,b={id:2,side:'player',kind:'hat_bamboo'} as Unit,hero={id:2,side:'player',kind:'kungfu_po',level:1} as Unit;
    records.hit(a,10,true);records.hit(a,10,true,false,true);records.hit(b,10,true,true);records.hit(b,10,true,true,true);records.hit(b,10,false,true);
    records.merge(a,b,hero);
    expect(records.tally(hero)).toEqual({preEndlessKills:1,preEndlessBossKills:1,endlessKills:1,endlessBossKills:1});
    expect(records.momentum(hero)).toBeCloseTo(1+5+.08+.5);expect(records.mvp([hero])).toMatchObject({kind:'kungfu_po',damage:50,kills:4});
    expect(records.mvp([{...hero,awakened:true}])).toMatchObject({awakened:true});expect(records.mvp([hero])).not.toHaveProperty('awakened');
  });
  it('lets standard-wave kills drive the engine momentum, applied only once endless begins',()=>{
    const e=new BattleEngine({seed:41,autoWaves:false});e.start();
    const hero=unit(e,'kungfu_po',5);hero.location={zone:'board',col:2,row:1};
    for(let i=0;i<40;i++)killRat(e,hero);killRat(e,hero,true);
    expect(e.getUnitMomentum(hero)).toBe(45);
    const before=e.getUnitStats(hero).damage;
    while(e.state.phase!=='finished')e.skipWave();expect(e.enterEndless().ok).toBe(true);
    expect(e.getUnitStats(hero).damage/before).toBeCloseTo(momentumMultiplier(45,0),10);
    expect(e.getKillTally(hero)).toMatchObject({preEndlessKills:40,preEndlessBossKills:1,endlessKills:0});
    killRat(e,hero);expect(e.getKillTally(hero).endlessKills).toBe(1);expect(e.getUnitMomentum(hero)).toBeCloseTo(45.08);
  });
});

describe('P17 Lv.5 endless breakthrough',()=>{
  it('keeps "max level" in the ten standard waves, even with every medallion at Lv.50',()=>{
    const e=standard(medals(all(50))),hero=unit(e,'kungfu_po',5),part=unit(e,'panda');
    expect(MergeSystem.breakthroughPair(part,hero)).toMatchObject({base:hero,feeder:part,locked:false});
    expect(e.move(part.id,{...hero.location})).toMatchObject({ok:false,key:'hint.maxLevel'});
    expect(e.state.units).toContain(part);expect(hero.awakened).toBeUndefined();
    expect(getMergeTargets(e.state,part.id).some(target=>target.breakthrough)).toBe(false);
  });
  it('rolls on endlessRandom: a miss is free (+5% pity), a hit awakens the hero in place and absorbs the feeder',()=>{
    const e=endless(),hero=unit(e,'kungfu_po',5),part=unit(e,'panda'),place={...hero.location};
    expect(getMergeTargets(e.state,part.id)).toEqual([expect.objectContaining({unitId:hero.id,breakthrough:true,baseId:hero.id})]);
    script(e,'endlessRandom',[.99]);
    expect(e.move(part.id,{...hero.location})).toEqual({ok:true,key:'p17.breakthroughFail',unitId:hero.id,value:35});
    expect(hero).toMatchObject({level:5,breakthroughFails:1,location:place});expect(hero.awakened).toBeUndefined();
    expect(e.state.units.some(u=>u.id===part.id)).toBe(false);
    expect(e.state.events.at(-1)).toMatchObject({type:'bubble',textKey:'p17.breakthroughFail',value:35,unitId:hero.id});
    // Feeding the hero itself onto a part works too: the hero stays where it is.
    const second=unit(e,'hat_bamboo');script(e,'endlessRandom',[.34]);
    expect(e.move(hero.id,{...second.location})).toEqual({ok:true,key:'p17.breakthroughSuccess',unitId:hero.id});
    expect(hero).toMatchObject({awakened:true,level:5,location:place,statuses:{}});expect(e.state.units.some(u=>u.id===second.id)).toBe(false);
    expect(e.state.events.find(ev=>ev.effect==='awakened')).toMatchObject({type:'purge',textKey:'p17.breakthroughSuccess',unitId:hero.id,duration:1.5});
    // Once awakened, further feeding is the ordinary max-level refusal.
    const third=unit(e,'panda');expect(e.move(third.id,{...hero.location})).toMatchObject({ok:false,key:'hint.maxLevel'});
  });
  it('accepts an identical un-awakened Lv.5 twin, respects merge locks and adds clover luck to the roll',()=>{
    const e=endless(medals({med_luck_rate:25})),hero=unit(e,'meowfia',5),twin=unit(e,'meowfia',5);
    expect(e.getBreakthroughChance(hero).total).toBeCloseTo(.65);
    twin.statuses.MERGE_LOCK=3;expect(e.move(twin.id,{...hero.location})).toMatchObject({ok:false,key:'hint.mergeLocked'});
    delete twin.statuses.MERGE_LOCK;script(e,'endlessRandom',[.6]);
    expect(e.move(twin.id,{...hero.location})).toMatchObject({ok:true,key:'p17.breakthroughSuccess',unitId:hero.id});
  });
  it('multiplies an awakened hero by ×2.5 · 1.235^Lv and +15% speed in endless only',()=>{
    const e=endless(medals({med_breakthrough_atk:50})),hero=unit(e,'kungfu_po',5);
    const plain=e.getUnitStats(hero);hero.awakened=true;const woke=e.getUnitStats(hero);
    expect(woke.damage/plain.damage).toBeCloseTo(AWAKENED_DAMAGE*breakthroughAttackMultiplier(50),6);expect(woke.rate/plain.rate).toBeCloseTo(AWAKENED_RATE,10);
    const s=standard(medals(all(50))),other=unit(s,'kungfu_po',5),before=s.getUnitStats(other);other.awakened=true;expect(s.getUnitStats(other)).toEqual(before);
  });
});

describe('P17 Sovereign Piercer, Calm Ward and the capybara bubble shield',()=>{
  it('boosts boss damage ×(1+0.08·Lv) and ignores 1.8%·Lv armor in endless',()=>{
    const hit=(lv:number)=>{const e=endless(medals({med_boss_slayer:lv})),hero=unit(e,'kungfu_po',5),boss=e.spawnEnemy('king_skunk','player');
      boss.hp=boss.maxHp=1e15;e.hurt(boss,1000,hero);return{dealt:1e15-boss.hp,armor:boss.armor};};
    const plain=hit(0),full=hit(50);
    expect(full.dealt/plain.dealt).toBeCloseTo(5*(1-full.armor*.1)/(1-plain.armor),6);
  });
  it('shortens boss debuffs by 90% at Lv.50 and wards off destructive skills with a 90% roll on endlessRandom',()=>{
    const wet=(lv:number)=>{const e=endless(medals({med_boss_resist:lv})),hero=unit(e,'kungfu_po',3);hero.location={zone:'board',col:2,row:1};
      e.spawnEnemy('sad_rain_frog','player');return hero.statuses.WET;};
    expect(wet(0)).toBe(18);expect(wet(50)).toBeCloseTo(1.8,10);
    const crater=(roll:number)=>{const e=endless(medals({med_boss_resist:50}));e.state.enemies=[];script(e,'endlessRandom',[roll]);
      const boss=e.spawnEnemy('husky_wrecker','player');boss.abilityCooldown=.01;boss.speed=0;e.tick(.05);
      return{broken:e.state.grid.flat().filter(t=>t==='B').length,warded:e.state.events.some(ev=>ev.textKey==='p17.resistBlock')};};
    const before=endless().state.grid.flat().filter(t=>t==='B').length;
    expect(crater(.5)).toEqual({broken:before,warded:true});expect(crater(.95)).toEqual({broken:before+1,warded:false});
  });
  it('grants one shield on entering endless, blocks one orange theft, recharges 20s → 3s and never stacks',()=>{
    const theft=(e:BattleEngine,n=1)=>{const end=getMap(e.state.mapId).paths.player.length-1;
      for(let i=0;i<n;i++){const rat=e.spawnEnemy('rat','player');rat.progress=end-.001;}e.tick(.05);};
    const none=endless();expect(none.state.sides.player.capyShieldReady).toBe(false);const o0=none.state.sides.player.oranges;theft(none);expect(none.state.sides.player.oranges).toBe(o0-1);
    const e=endless(medals({med_capy_shield:1})),player=e.state.sides.player,oranges=player.oranges;
    expect(player.capyShieldReady).toBe(true);
    theft(e);expect(player.oranges).toBe(oranges);expect(player.capyShieldReady).toBe(false);expect(player.capyShieldTimer).toBe(20);
    expect(e.state.events.some(ev=>ev.type==='shield_block'&&ev.textKey==='p17.shieldBlock')).toBe(true);
    theft(e);expect(player.oranges).toBe(oranges-1);
    e.state.enemies=[];e.tick(19.8);expect(player.capyShieldReady).toBe(false);e.tick(.2);expect(player.capyShieldReady).toBe(true);
    e.tick(60);theft(e,2);expect(player.oranges).toBe(oranges-2);// two arrivals, one charge
    const fast=endless(medals({med_capy_shield:50}));theft(fast);fast.state.enemies=[];fast.tick(2.9);expect(fast.state.sides.player.capyShieldReady).toBe(false);fast.tick(.1);expect(fast.state.sides.player.capyShieldReady).toBe(true);
  });
});

describe('P17 RNG isolation and the untouched ten standard waves',()=>{
  it('draws breakthrough and resist rolls only from endlessRandom',()=>{
    const a=endless(medals({med_boss_resist:50})),b=endless(medals({med_boss_resist:50}));
    const hero=unit(a,'kungfu_po',5),part=unit(a,'panda');unit(b,'kungfu_po',5);unit(b,'panda');
    a.move(part.id,{...hero.location});a.spawnEnemy('mega_roomba','player');b.spawnEnemy('mega_roomba','player');
    for(const name of ['random','ingredientRandom','villageRandom'])expect(stream(a,name)).toEqual(stream(b,name));
    expect(stream(a,'endlessRandom')).not.toEqual(stream(b,'endlessRandom'));
  });
  it('plays a full ten-wave battle bit-identically with all six medallions at Lv.50',()=>{
    const run=(loadout:BattleLoadout)=>{
      const e=new BattleEngine({seed:7,loadouts:{player:loadout}});e.start();
      for(const [kind,level,col,row] of [['kungfu_po',5,1,1],['rocket_coon',5,2,2],['purrcerer',4,3,1],['hamster',3,4,2],['bee',2,1,3]] as const){const u=unit(e,kind,level);u.location={zone:'board',col,row};}
      for(let i=0;i<8000&&e.state.phase!=='finished';i++)e.tick(.1);return e;
    };
    const plain=run(base),medalled=run(medals(all(50)));
    expect(medalled.state.sides.player.loadout.endlessMedallions).toEqual(all(50));
    const strip=(e:BattleEngine)=>JSON.stringify({...e.state,id:'',sides:{...e.state.sides,player:{...e.state.sides.player,loadout:null}}});
    expect(plain.state.phase).toBe('finished');expect(strip(medalled)).toBe(strip(plain));
    expect(medalled.state.result).toEqual(plain.state.result);
  });
  it('only carries medallions in a loadout snapshot when one is levelled',()=>{
    expect(copyLoadout(base)).not.toHaveProperty('endlessMedallions');expect(copyLoadout(medals(all(0)))).not.toHaveProperty('endlessMedallions');
    expect(copyLoadout(medals({med_luck_rate:60,med_momentum:2.7,bogus:5} as never)).endlessMedallions).toEqual({med_luck_rate:50,med_momentum:2});
  });
});

describe('P17 crests and receipts',()=>{
  it('pays 3 crests on a Wave 10 victory, banks endless crests per clear and reports awakened heroes',()=>{
    const win=new BattleEngine({seed:41,autoWaves:false});win.start();while(win.state.phase!=='finished')win.skipWave();
    expect(win.state.result).toMatchObject({winner:'player',reason:'waves',endlessCrests:3});
    const loss=new BattleEngine({seed:41});loss.start();loss.surrender();expect(loss.state.result).not.toHaveProperty('endlessCrests');
    const e=endless(),hero=unit(e,'kungfu_po',5);hero.awakened=true;
    e.state.spawned=e.currentWaveTargetCount();e.state.enemies=[];expect(e.callEarlyWave().ok).toBe(true);expect(e.state.sides.player.endlessCrests).toBe(1);
    e.surrender();expect(e.state.result).toMatchObject({endless:true,endlessCrests:1,awakenedCount:1});
    expect(resultCrests(e.state)).toBe(4);
  });
  it('banks crests atomically with each receipt and rejects impossible crest claims',()=>{
    const normal:BattleResult={winner:'player',reason:'waves',loot:[],playerLoot:[],aiLoot:[],coins:75,elapsed:350,endlessCrests:3};
    const banked=awardBattle(createProfile(),'run',normal).profile;expect(banked.endlessCrests).toBe(3);
    expect(awardBattle(createProfile(),'lost',{...normal,winner:'ai',reason:'oranges'}).profile.endlessCrests).toBe(0);
    const honor:BattleResult={...normal,reason:'surrender',endless:true,endlessWave:22,endlessCoins:60,endlessLoot:[],endlessCrests:12,awakenedCount:2,elapsed:1450.4,
      mvp:{kind:'kungfu_po',level:5,damage:9e6,kills:80,awakened:true}};
    const bonus=awardEndless(banked,'run',honor);
    expect(bonus.awarded).toBe(true);expect(bonus.profile).toMatchObject({endlessCrests:15,bestEndlessWave:22,bestEndlessTime:1450,bestEndlessMvp:'kungfu_po',bestEndlessMvpAwakened:true,bestEndlessAwakened:2});
    expect(awardEndless(banked,'run',{...honor,endlessCrests:endlessCrestsThroughWave(22)+1}).awarded).toBe(false);
    expect(awardEndless(banked,'run',{...honor,endlessCrests:-1}).awarded).toBe(false);
    // A shorter wave keeps the record; the same wave in less time refreshes it.
    const slower=awardEndless({...bonus.profile,awardedBattles:[...bonus.profile.awardedBattles,'r2']},'r2',{...honor,endlessWave:22,elapsed:2000,endlessCrests:0}).profile;
    expect(slower.bestEndlessTime).toBe(1450);
    const faster=awardEndless({...bonus.profile,awardedBattles:[...bonus.profile.awardedBattles,'r3']},'r3',{...honor,endlessWave:22,elapsed:1200,endlessCrests:0,mvp:undefined,awakenedCount:0}).profile;
    expect(faster).toMatchObject({bestEndlessTime:1200,bestEndlessAwakened:0});expect(faster).not.toHaveProperty('bestEndlessMvp');
  });
});

describe('P17 profile, identity and save compatibility',()=>{
  it('starts with zero crests, six Lv.0 medallions, a stable anonymous id + writeSecret and no nickname',()=>{
    const p=createProfile();
    expect(p).toMatchObject({endlessCrests:0,nickname:'',playerId:SESSION_PLAYER_ID,writeSecret:SESSION_WRITE_SECRET});expect(p.endlessMedallions).toEqual(all(0));
    expect(isValidPlayerId(p.playerId)).toBe(true);expect(p.playerId).toMatch(/^capy_[a-z0-9]{12}$/);
    expect(isValidWriteSecret(p.writeSecret)).toBe(true);expect(generateWriteSecret(()=>.5)).toMatch(/^sec_/);
    expect(normalizeProfile(null)).toEqual(createProfile());expect(generatePlayerId(()=>.5)).toMatch(/^capy_/);
  });
  it('migrates pre-P17 saves and sanitizes every new field',()=>{
    const old=normalizeProfile({coins:50,matches:3,wins:2,bestEndlessWave:16});
    expect(old).toMatchObject({endlessCrests:0,nickname:'',coins:50,bestEndlessWave:16});expect(old.endlessMedallions).toEqual(all(0));
    const odd=normalizeProfile({endlessCrests:-4,endlessMedallions:{med_luck_rate:99,med_momentum:'5',bogus:3},playerId:'x',nickname:UNKIND+'水豚',bestEndlessWave:9,bestEndlessTime:500,bestEndlessMvp:'kungfu_po'});
    expect(odd.endlessCrests).toBe(0);expect(odd.endlessMedallions).toEqual({...all(0),med_luck_rate:50});expect(odd.playerId).toBe(SESSION_PLAYER_ID);expect(odd.nickname).toBe('');
    expect(odd).not.toHaveProperty('bestEndlessTime');expect(odd).not.toHaveProperty('bestEndlessMvp');
    const kept=normalizeProfile({playerId:'capy_keepme1234',nickname:'  泡汤 水豚  ',bestEndlessWave:30,bestEndlessTime:900,bestEndlessMvp:'rocket_coon',bestEndlessMvpAwakened:true,bestEndlessAwakened:3});
    expect(kept).toMatchObject({playerId:'capy_keepme1234',nickname:'泡汤 水豚',bestEndlessTime:900,bestEndlessMvp:'rocket_coon',bestEndlessMvpAwakened:true,bestEndlessAwakened:3});
    const db=memoryStorage();saveProfile(kept,db);expect(loadProfile(db)).toEqual(kept);
    expect(normalizeMedallions({med_capy_shield:7.9})).toEqual({...all(0),med_capy_shield:7});
  });
  it('maxes every medallion and the crest stash for the developer test profile',()=>{
    const p=unlockAllProfile(createProfile());expect(p.endlessMedallions).toEqual(all(50));expect(p.endlessCrests).toBe(99_999);
  });
  it('validates nicknames: 2-14 characters, no control characters or brackets, wholesome only',()=>{
    expect(validateNickname('泡汤水豚')).toEqual({ok:true,value:'泡汤水豚',key:'p17.nameSaved'});
    expect(validateNickname(' <b>Capy</b>\u0007 ')).toMatchObject({ok:true,value:'bCapy/b'});
    expect(validateNickname('水')).toMatchObject({ok:false,key:'p17.nameTooShort'});expect(validateNickname('一二三四五六七八九十一二三四五')).toMatchObject({ok:false,key:'p17.nameTooLong'});
    expect(validateNickname(`小${UNKIND}猫`)).toMatchObject({ok:false,key:'p17.nameUnkind'});expect(validateNickname('B o n k')).toMatchObject({ok:false,key:'p17.nameUnkind'});
    expect(defaultNickname('capy_abcdefgh1234','zh-CN')).toBe('泡汤水豚#1234');expect(defaultNickname('capy_abcdefghwxyz','en')).toBe('ChillCapy#WXYZ');
  });
});

describe('P17 compact numbers',()=>{
  it('keeps <10,000 exact and compacts K / M / B',()=>{
    expect([0,79,1234,9999,12_500,125_000,999_960,3_420_000,54_694_467,1_850_000_000,-12_500,NaN,Infinity].map(formatCompactNumber))
      .toEqual(['0','79','1,234','9,999','12.5K','125K','1M','3.42M','54.69M','1.85B','-12.5K','0','0']);
  });
});

describe('P17 UI: courtyard pill, medallion hall, hero card, board tab and settlement',()=>{
  it('adds a warm-gold medallion pill without touching the 3 + 3 hub docks',()=>{
    const p={...createProfile(),coins:16,endlessCrests:8,bestEndlessWave:23},html=courtyardMarkup(p,0);
    expect(html.match(/class="endless-hall-pill[^"]*" data-action="medallions"/g)).toHaveLength(1);
    expect(endlessHallPillMarkup(p)).toContain(t('p17.canUpgrade'));expect(endlessHallPillMarkup(p)).toContain('W23');
    expect(endlessHallPillMarkup(createProfile())).toContain('×0');expect(endlessHallPillMarkup(createProfile())).not.toContain('endless-hall-best');
    const left=html.match(/<nav class="hub-dock hub-dock-left">[\s\S]*?<\/nav>/)![0],right=html.match(/<nav class="hub-dock hub-dock-right">[\s\S]*?<\/nav>/)![0];
    expect(left.match(/<button /g)).toHaveLength(3);expect(right.match(/<button /g)).toHaveLength(3);expect(left+right).not.toContain('endless-hall-pill');
  });
  it('renders six cream medallion rows with endless-only copy, current → next values and dual-currency chips',()=>{
    const p={...createProfile(),coins:500,endlessCrests:30,endlessMedallions:{...all(0),med_boss_resist:25,med_capy_shield:50}};
    const screen=new MedallionScreen(()=>p,()=>{},()=>{},()=>{});const html=screen.markup();
    expect(html).toContain('data-ledger-page="medallions"');expect(html).toContain('ui_medallion_peek_capy');expect(html).toContain(t('p17.endlessOnly'));
    expect(html.match(/class="storybook-row-card medallion-row/g)).toHaveLength(6);expect(html).toContain('data-action="endless-board"');
    expect(html).not.toContain('medallion-board-link');
    // Level tag sits inline beside the medallion name (never inside overflow:hidden .storybook-frame).
    const frames=html.match(/<span class="storybook-frame tone-medallion">[\s\S]*?<\/span><\/span>/g)??[];
    expect(frames).toHaveLength(6);expect(frames.every(f=>!f.includes('medallion-level-tag'))).toBe(true);
    expect(html).toContain('<strong class="portrait-name">');
    expect(html).toContain('medallion-level-tag">Lv.25/50</b></strong>');
    expect(html).toContain('45%</b><i aria-hidden="true">→</i><b class="medallion-next">46.8%');expect(html).toContain(t('p17.maxed'));
    expect(html).toContain('medallion-cost-chip is-ready');expect(html).toContain('medallion-cost-chip is-short');
    expect(html).toContain(t('p17.totalLevel',{sum:75,max:300}));expect(html).not.toContain('<text');
  });
  it('upgrades through the hall with a saved profile, a cue and a toast',()=>{
    const saved=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>{saved.set(k,v);},removeItem:(k:string)=>{saved.delete(k);}}});
    let p:Profile={...createProfile(),coins:100,endlessCrests:20};const cues:string[]=[],toasts:string[]=[];
    const screen=new MedallionScreen(()=>p,next=>{p=next;},()=>{},key=>{toasts.push(key);},cue=>{cues.push(cue);});
    expect(screen.action('medallion-up:med_momentum')).toBe(true);
    expect(p.endlessMedallions.med_momentum).toBe(1);expect(p.endlessCrests).toBe(12);expect(cues).toEqual(['merge_upgrade']);expect(toasts).toEqual(['p17.medallionUpgraded']);
    expect(JSON.parse(saved.get('capybara_defense_v1:profile')!).endlessMedallions.med_momentum).toBe(1);
    expect(screen.action('medallion-up:med_momentum')).toBe(true);expect(toasts.at(-1)).toBe('p17.noCrests');expect(screen.action('village-harvest')).toBe(false);
  });
  it('shows momentum, the live breakthrough breakdown and the awakened badge on the hero card',()=>{
    const e=endless(),hero=unit(e,'kungfu_po',5),loadout=e.state.sides.player.loadout,stats=e.getEffectiveUnitStats(hero);
    const chance=computeBreakthroughChance({preEndlessKills:0,preEndlessBossKills:8,luckMedallionLevel:10,previousFails:0});
    const html=liveUnitCardMarkup({unit:hero,state:e.state,stats,loadout,endless:{momentum:82,chance}});
    expect(html).toContain('🔥 战意 82/200');expect(html).toContain(t('p17.momentumHint'));expect(html).toContain('成功率 68%');
    expect(html).toContain('基础 30% + 战意 24% + 勋章 14% + 保底 0%');expect(html).not.toContain('class="live-max"');
    hero.awakened=true;const woke=liveUnitCardMarkup({unit:hero,state:e.state,stats,loadout,endless:{momentum:200,awakenedPower:12_345_678}});
    expect(woke).toContain('✦ 已觉醒突破');expect(woke).toContain('×12.35M');expect(woke).toContain('kungfu_po_awakened');
    const s=standard(),h=unit(s,'kungfu_po',5),std=liveUnitCardMarkup({unit:h,state:s.state,stats:s.getEffectiveUnitStats(h),loadout:s.state.sides.player.loadout,endless:{momentum:3}});
    expect(std).toContain('class="live-max"');expect(std).toContain(t('p17.breakLater'));
  });
  it('adds the global endless board tab, keeps the dedicated 2-tab endless hub intact and renders online/offline/empty states',()=>{
    expect(ledgerTabs('leaderboard').match(/data-action="([\w-]+)"/g)).toEqual(['data-action="leaderboard"','data-action="endless-board"','data-action="profile"','data-action="settings"']);
    expect(endlessHubTabs('endless-board').match(/data-action="([\w-]+)"/g)).toEqual(['data-action="medallions"','data-action="endless-board"']);
    const p={...createProfile(),playerId:'capy_me000000000',nickname:'泡汤队长',bestEndlessWave:31,bestEndlessTime:1500,bestEndlessMvp:'rocket_coon',bestEndlessMvpAwakened:true};
    const row=(rank:number,isMe:boolean,wave:number)=>({rank,isMe,nickname:isMe?'泡汤队长':`玩家${rank}`,avatarId:'capybara',bestWave:wave,elapsedSeconds:1800,mvpKind:'kungfu_po',mvpAwakened:rank===1,awakenedCount:rank===1?3:0,medallionTotal:10,updatedAt:1});
    const online=endlessBoardMarkup(p,{loading:false,snapshot:{mode:'online',fetchedAt:1,totalPlayers:7,entries:[row(1,false,58),row(2,true,31)],me:row(2,true,31)}});
    expect(online).toContain('全球第 #2 名 / 共 7 人');expect(online).toContain('data-player="true"');expect(online).toContain('🥇');expect(online).toContain('第 58 波');
    expect(online).toContain('kungfu_po_awakened');expect(online).toContain('value="泡汤队长"');expect(online).toContain('data-action="medallions"');expect(online).toContain('data-action="endless-board-refresh"');
    expect(online).toContain('ui_clock_sand');expect(online).not.toContain('⏱');
    // Inside the dedicated Endless Hall window, switching to Global Board preserves the 2-tab bar & medallion mascot.
    const screens=new ProfileScreens(()=>p,()=>true,()=>{},()=>{},()=>({loading:false,endlessHub:true,snapshot:{mode:'online',fetchedAt:1,totalPlayers:7,entries:[row(1,false,58),row(2,true,31)],me:row(2,true,31)}}));
    const hubHtml=screens.markup('endless-board');
    expect(hubHtml).toContain('ui_medallion_peek_capy');
    expect(hubHtml).toContain('data-action="medallions"');
    expect(hubHtml).not.toContain('data-action="leaderboard"');expect(hubHtml).not.toContain('data-action="settings"');
    expect(hubHtml).not.toContain('endless-board-medallions');
    const offline=endlessBoardMarkup(p,{loading:false,snapshot:{mode:'offline',fetchedAt:null,totalPlayers:0,entries:[],me:null}});
    expect(offline).toContain(t('p17.board.offline'));expect(offline).toContain('rocket_coon_awakened');expect(offline).toContain('第 31 波');
    const fresh=endlessBoardMarkup(createProfile(),{loading:false,snapshot:{mode:'unconfigured',fetchedAt:null,totalPlayers:0,entries:[],me:null}});
    expect(fresh).toContain(t('p17.board.unconfigured'));expect(fresh).toContain(t('p17.board.noBest'));expect(fresh).toContain(defaultNickname(SESSION_PLAYER_ID,'zh-CN'));
  });
  it('puts crests on BOTH the front shield plaque and report shelf, shows crests in pause and supports compendium awakened preview',()=>{
    const win=new BattleEngine({seed:41});win.start();while(win.state.phase!=='finished')win.skipWave();
    const offer=endlessOfferMarkup(win.state,true);expect(offer).toContain('×1.25');expect(offer).not.toContain('×16');expect(offer).toContain('ui_endless_crest');expect(offer).toContain('+3');
    const input={profile:createProfile(),savedResult:true,resultStars:1,previousRank:0,newWeapons:[],newAvatars:[],statsOpen:true};
    const standardHtml=resultMarkup({...input,state:win.state});expect(standardHtml).toMatch(/visual-treasure-item is-crest[\s\S]*?×3/);
    win.enterEndless();win.state.sides.player.endlessCrests=5;
    expect(pauseMarkup(win.state)).toContain('pause-crests');expect(pauseMarkup(win.state)).toContain('×8');
    win.surrender();
    win.state.result!.mvp={kind:'kungfu_po',level:5,damage:12_345_678,kills:9,awakened:true};
    const html=resultMarkup({...input,state:win.state,globalRank:42});
    expect(html).toContain('🌍 全球第 #42 名');expect(html).toMatch(/is-crest[\s\S]*?×8/);expect(html).toContain('kungfu_po_awakened');expect(html).toContain('12.35M');
    const plaque=html.match(/<div class="crest-core-rewards">[\s\S]*?<\/div>/)![0];
    expect(plaque).toContain('ui_endless_crest');expect(plaque).toContain('+8');
    // Compendium hero detail toggles between standard and awakened preview art.
    const book=new Compendium();const unlocked=unlockAllProfile(createProfile());book.inspectEntry('kungfu_po');
    expect(book.markup(unlocked)).toContain('compendium-awakened-toggle');expect(book.markup(unlocked)).not.toContain('kungfu_po_awakened');
    book.toggleAwakened();expect(book.markup(unlocked)).toContain('kungfu_po_awakened');
    // Shop disables refresh when all props maxed; lottery center prioritizes free tickets.
    const maxed={...unlocked,freeLotteryTickets:2};const meta=new MetaScreens(()=>maxed,()=>{},()=>{},()=>{});
    expect(meta.markup('market')).toMatch(/data-action="meta-refresh"[^>]*disabled/);
    expect(meta.markup('market')).toContain(t('p11.meta.merchantMaxed'));
    meta.action('meta-tab:lottery');
    expect(meta.markup('market')).toMatch(/class="lottery-center has-ticket" data-action="meta-spin:ticket"/);
    // Rank board rounds enemy HP multiplier to 2 decimals & displays player nickname; passport displays nickname + endless best.
    const rankedProfile={...createProfile(),stars:48,nickname:'泡汤大侠',bestEndlessWave:37};
    const ps=new ProfileScreens(()=>rankedProfile,()=>true,()=>{},()=>{});
    const lb=ps.markup('leaderboard');expect(lb).toContain('×2.66');expect(lb).not.toContain('2.6556');expect(lb).toContain('泡汤大侠');
    const pp=ps.markup('profile');expect(pp).toContain('泡汤大侠');expect(pp).toContain('最高 第 37 波');
  });
  it('ships complete, wholesome zh-CN / en P17 copy',()=>{
    expect(Object.keys(p17En).sort()).toEqual(Object.keys(p17Zh).sort());
    for(const value of [...Object.values(p17Zh),...Object.values(p17En)])expect(value.trim().length).toBeGreaterThan(0);
    setLanguage('en');expect(t('p17.title')).toBe('Endless Medallions');expect(t('p13.endlessScaling')).toContain('1.25');
  });
  it('keeps every new P17 source file wholesome',()=>{
    const files=['src/config/medallions.ts','src/i18n/p17.ts','src/core/formatNumber.ts','src/core/MedallionProgression.ts','src/core/PlayerIdentity.ts','src/core/Location.ts',
      'src/ui/MedallionScreen.ts','src/ui/EndlessLeaderboardClient.ts','src/ui/LocationService.ts','src/ui/p17.css',
      ...readdirSync('cloudflare-leaderboard').filter(f=>/\.(md|json|toml|sql)$/.test(f)).map(f=>`cloudflare-leaderboard/${f}`),
      ...readdirSync('cloudflare-leaderboard/src').map(f=>`cloudflare-leaderboard/src/${f}`)];
    for(const file of files)expect(readFileSync(file,'utf8'),file).not.toMatch(/涩涩|色色|不许涩|Bonk|bonk|绝育|绿茶|疯批|舔狗|鸡你太/i);
  });
});

describe('P17 Cloudflare Worker: validation, security, unique nicknames, monotone upsert, ranking, CORS and rate limits',()=>{
  const env:Env={DB:undefined as never,ALLOWED_ORIGINS:'https://shizhuom.github.io,http://127.0.0.1:4175'};
  const score=(patch:Record<string,unknown>={})=>({playerId:'capy_alpha0000001',writeSecret:'sec_alpha_secret_token_0001',nickname:'泡汤水豚',avatarId:'capybara',bestWave:30,elapsedSeconds:1500,mvpKind:'kungfu_po',mvpAwakened:true,awakenedCount:1,medallionTotal:20,...patch});
  const post=(store:ScoreStore,body:unknown,now=1000,ip='1.2.3.4',origin='https://shizhuom.github.io')=>handleRequest(new Request('https://board.test/api/score',
    {method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':ip,Origin:origin},body:JSON.stringify(body)}),env,{store,now:()=>now});
  const get=(store:ScoreStore,query='')=>handleRequest(new Request(`https://board.test/api/leaderboard${query}`,{headers:{Origin:'https://shizhuom.github.io'}}),env,{store});
  const checkName=(store:ScoreStore,query:string)=>handleRequest(new Request(`https://board.test/api/nickname${query}`,{headers:{Origin:'https://shizhuom.github.io'}}),env,{store});
  it('validates ids, write secrets, nicknames, waves 11-120, real play time and plausible power',()=>{
    expect(validateScore(score())).toMatchObject({ok:true,score:{best_wave:30,mvp_awakened:1,avatar_id:'capybara',nickname_norm:'泡汤水豚'}});
    expect(validateScore(score({writeSecret:'short'}))).toEqual({ok:false,error:'invalid_secret'});
    expect(validateScore(score({bestWave:999}))).toEqual({ok:false,error:'invalid_score'});expect(validateScore(score({bestWave:10}))).toEqual({ok:false,error:'invalid_score'});
    expect(validateScore(score({bestWave:80,elapsedSeconds:1}))).toEqual({ok:false,error:'invalid_score'});expect(minimumElapsed(80)).toBe(420);
    expect(validateScore(score({elapsedSeconds:86_401}))).toEqual({ok:false,error:'invalid_score'});
    expect(validateScore(score({playerId:'bad id!'}))).toEqual({ok:false,error:'invalid_player'});
    expect(validateScore(score({nickname:`${UNKIND}${UNKIND}`}))).toEqual({ok:false,error:'invalid_nickname'});expect(validateScore(score({nickname:'a'}))).toEqual({ok:false,error:'invalid_nickname'});
    expect(validateScore(score({bestWave:50,elapsedSeconds:3000,medallionTotal:0,awakenedCount:0}))).toEqual({ok:false,error:'implausible_score'});
    expect(validateScore(score({bestWave:50,elapsedSeconds:3000,medallionTotal:30,awakenedCount:0})).ok).toBe(true);
    expect(validateScore(score({avatarId:'nope',mvpKind:'nope',medallionTotal:301}))).toEqual({ok:false,error:'invalid_score'});
    expect(validateScore(score({avatarId:'nope',mvpKind:'nope'}))).toMatchObject({ok:true,score:{avatar_id:'capybara',mvp_kind:'kungfu_po'}});
    expect(sanitizeNickname('<泡汤>')).toEqual({ok:true,value:'泡汤'});
    expect(normalizeNicknameKey('  ChillCapy  ')).toBe(normalizeNicknameKey('chillcapy'));
  });
  it('keeps the best record, preserves updated_at on rename (no rank demotion) and ranks by wave, time, first arrival',()=>{
    const incoming=validateScore(score()) as {ok:true;score:{player_id:string;nickname:string;nickname_norm:string;avatar_id:string;location_label:string;best_wave:number;elapsed_seconds:number;mvp_kind:string;mvp_awakened:number;awakened_count:number;medallion_total:number}};
    const baseRow={...incoming.score,secret_hash:'hash_a'};
    const first=mergeScore(null,baseRow,10);expect(first.improved).toBe(true);
    const lower=mergeScore(first.row,{...baseRow,best_wave:20,nickname:'新名字',nickname_norm:'新名字'},20);
    expect(lower).toMatchObject({improved:false,row:{best_wave:30,nickname:'新名字',updated_at:10}});
    expect(mergeScore(first.row,{...baseRow,elapsed_seconds:1400},30)).toMatchObject({improved:true,row:{updated_at:30}});
    const rows=[{best_wave:30,elapsed_seconds:900,updated_at:5},{best_wave:31,elapsed_seconds:3000,updated_at:9},{best_wave:30,elapsed_seconds:900,updated_at:2}].sort(compareRows);
    expect(rows.map(r=>[r.best_wave,r.updated_at])).toEqual([[31,9],[30,2],[30,5]]);
    expect(rateLimitDecision(null,0)).toEqual({allowed:true,windowStart:0,hits:1});expect(rateLimitDecision({window_start:0,hits:20},59_999).allowed).toBe(false);
    expect(rateLimitDecision({window_start:0,hits:20},60_000)).toEqual({allowed:true,windowStart:60_000,hits:1});
  });
  it('hides playerId publicly, blocks hijacks with wrong writeSecret, strictly blocks duplicate nicknames and rate limits',async()=>{
    const store=memoryStore();
    expect(await (await handleRequest(new Request('https://board.test/api/health'),env,{store})).json()).toEqual({ok:true,service:'capybara-endless-leaderboard'});
    const a=await post(store,score());expect(a.status).toBe(200);expect(a.headers.get('Access-Control-Allow-Origin')).toBe('https://shizhuom.github.io');
    expect(await a.json()).toEqual({ok:true,rank:1,totalPlayers:1,bestWave:30,improved:true});
    // Strict duplicate nickname rejection (including case-insensitive English lookalike).
    const dup=await post(store,score({playerId:'capy_bravo0000001',writeSecret:'sec_bravo_secret_token_0002',nickname:'泡汤水豚',bestWave:40,elapsedSeconds:2400}),1001,'5.6.7.8');
    expect(dup.status).toBe(409);expect(await dup.json()).toEqual({ok:false,error:'nickname_taken'});
    expect(await (await checkName(store,'?name=%E6%B3%A1%E6%B1%A4%E6%B0%B4%E8%B1%9A&playerId=capy_bravo0000001')).json()).toEqual({ok:true,available:false});
    expect(await (await checkName(store,'?name=%E6%B3%A1%E6%B1%A4%E6%B0%B4%E8%B1%9A&playerId=capy_alpha0000001')).json()).toEqual({ok:true,available:true});
    // Distinct nickname succeeds.
    expect(await (await post(store,score({playerId:'capy_bravo0000001',writeSecret:'sec_bravo_secret_token_0002',nickname:'ChillKing',bestWave:40,elapsedSeconds:2400}),1001,'5.6.7.8')).json()).toMatchObject({rank:1,totalPlayers:2});
    const dupCase=await post(store,score({playerId:'capy_charlie00001',writeSecret:'sec_charlie_secret_token_03',nickname:'chillking',bestWave:20,elapsedSeconds:1200}),1002,'5.6.7.9');
    expect(dupCase.status).toBe(409);
    // Hijack attempt: wrong writeSecret for alpha's playerId is rejected 403.
    const hijack=await post(store,score({writeSecret:'sec_attacker_wrong_secret_9',nickname:'被盗号啦',bestWave:80,elapsedSeconds:2000}),1002,'6.6.6.6');
    expect(hijack.status).toBe(403);expect(await hijack.json()).toEqual({ok:false,error:'forbidden_player'});
    expect(store.rows.get('capy_alpha0000001')!.nickname).toBe('泡汤水豚');
    // Real owner renaming keeps best wave and original updated_at.
    expect(await (await post(store,score({bestWave:12,nickname:'改名啦'}),1002)).json()).toMatchObject({rank:2,bestWave:30,improved:false});
    expect(store.rows.get('capy_alpha0000001')).toMatchObject({nickname:'改名啦',best_wave:30,updated_at:1000});
    const cheat=await post(store,score({bestWave:999}),1003);expect(cheat.status).toBe(400);expect(await cheat.json()).toEqual({ok:false,error:'invalid_score'});
    // Public leaderboard NEVER leaks playerId or secret_hash; marks caller via isMe.
    const boardRes=await get(store,'?playerId=capy_alpha0000001&limit=500');
    const rawBoard=await boardRes.text();
    expect(rawBoard).not.toContain('capy_bravo0000001');expect(rawBoard).not.toContain('capy_alpha0000001');expect(rawBoard).not.toContain('secret');
    const board=JSON.parse(rawBoard) as {entries:{rank:number;isMe:boolean;nickname:string}[];me:{rank:number;isMe:boolean};totalPlayers:number};
    expect(board.entries.map(e=>[e.rank,e.nickname,e.isMe])).toEqual([[1,'ChillKing',false],[2,'改名啦',true]]);expect(board.me).toMatchObject({rank:2,isMe:true});expect(board.totalPlayers).toBe(2);
    for(let i=0;i<17;i++)expect((await post(store,score({nickname:'改名啦'}),2000+i)).status).toBe(200);
    const limited=await post(store,score({nickname:'改名啦'}),2100);expect(limited.status).toBe(429);expect(await limited.json()).toEqual({ok:false,error:'rate_limited'});
    expect((await post(store,score({nickname:'改名啦'}),2100,'9.9.9.9')).status).toBe(200);expect((await post(store,score({nickname:'改名啦'}),70_000)).status).toBe(200);
    expect([...store.rows.keys()].some(k=>k.includes('1.2.3.4'))).toBe(false);
  });
  it('answers CORS preflights only for whitelisted origins',async()=>{
    const store=memoryStore(),pre=(origin:string)=>handleRequest(new Request('https://board.test/api/score',{method:'OPTIONS',headers:{Origin:origin}}),env,{store});
    const ok=await pre('http://127.0.0.1:4175');expect(ok.status).toBe(204);expect(ok.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    const bad=await pre('https://evil.example');expect(bad.status).toBe(403);expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await post(store,score(),1,'1.1.1.1','https://evil.example')).status).toBe(403);
    expect((await handleRequest(new Request('https://board.test/nope'),env,{store})).status).toBe(404);
  });
});

describe('P17 EndlessLeaderboardClient: online, cached offline and unconfigured',()=>{
  const env:Env={DB:undefined as never,ALLOWED_ORIGINS:''};
  const ranked:Profile={...createProfile(),playerId:'capy_client000001',nickname:'泡汤水豚',bestEndlessWave:33,bestEndlessTime:1600,bestEndlessMvp:'pepe_king',bestEndlessMvpAwakened:true,bestEndlessAwakened:2,endlessMedallions:{...all(0),med_luck_rate:12}};
  const viaWorker=(store:ScoreStore)=>vi.fn((url:string|URL|Request,init?:RequestInit)=>handleRequest(new Request(String(url),init),env,{store,now:()=>5000}));
  it('builds a submission with writeSecret and location only for profiles with an endless record',()=>{
    expect(submissionFromProfile(createProfile())).toBeNull();
    expect(submissionFromProfile(ranked)).toEqual({playerId:'capy_client000001',writeSecret:SESSION_WRITE_SECRET,nickname:'泡汤水豚',avatarId:'capybara',location:fictionalLocationToken('capy_client000001'),bestWave:33,elapsedSeconds:1600,mvpKind:'pepe_king',mvpAwakened:true,awakenedCount:2,medallionTotal:12});
    expect(submissionFromProfile({...ranked,nickname:''},'en')!.nickname).toBe('ChillCapy#0001');
  });
  it('submits, checks duplicate nicknames, refreshes with a 30 s cache and caches the board for offline use',async()=>{
    const store=memoryStore(),fetch=viaWorker(store),storage=memoryStorage();let now=0;
    const client=new EndlessLeaderboardClient({baseUrl:'https://board.test/',fetch:fetch as unknown as typeof globalThis.fetch,storage,now:()=>now});
    expect(client.configured).toBe(true);
    expect(await client.submitScore(ranked)).toMatchObject({ok:true,mode:'online',rank:1,totalPlayers:1,improved:true});
    const other:Profile={...ranked,playerId:'capy_other0000002',writeSecret:'sec_other_client_secret_0002'};
    expect(await client.submitScore(other)).toMatchObject({ok:false,mode:'online',key:'p17.nameTaken'});
    expect(await client.checkNickname('泡汤水豚','capy_other0000002')).toMatchObject({available:false,mode:'online',key:'p17.nameTaken'});
    expect(await client.checkNickname('泡汤水豚','capy_client000001')).toMatchObject({available:true,mode:'online'});
    const snap=await client.refresh(ranked.playerId);expect(snap).toMatchObject({mode:'online',totalPlayers:1,me:{rank:1,bestWave:33,isMe:true}});expect(snap.entries[0].mvpAwakened).toBe(true);expect(snap.entries[0].playerId).toBeUndefined();
    const calls=fetch.mock.calls.length;now=10_000;await client.refresh(ranked.playerId);expect(fetch.mock.calls.length).toBe(calls);
    await client.refresh(ranked.playerId,true);expect(fetch.mock.calls.length).toBe(calls+1);
    expect(String(fetch.mock.calls.at(-1)![0])).toBe('https://board.test/api/leaderboard?limit=100&playerId=capy_client000001');
    expect(JSON.parse(storage.getItem(`capybara_defense_v1:${BOARD_CACHE_KEY}`)!).entries).toHaveLength(1);
    // A new client that cannot reach the network serves the cached board, without throwing.
    const offline=new EndlessLeaderboardClient({baseUrl:'https://board.test',fetch:(()=>Promise.reject(new TypeError('offline'))) as unknown as typeof globalThis.fetch,storage});
    expect(offline.snapshot()).toMatchObject({mode:'offline',totalPlayers:1});const after=await offline.refresh(ranked.playerId,true);
    expect(after.mode).toBe('offline');expect(after.entries[0].isMe).toBe(true);
    expect(await offline.submitScore(ranked)).toMatchObject({ok:false,mode:'offline',key:'p17.board.offline'});
  });
  it('degrades quietly when unconfigured, times out after the limit and reports 429 and rejections',async()=>{
    const fetch=vi.fn();const local=new EndlessLeaderboardClient({baseUrl:'',fetch:fetch as unknown as typeof globalThis.fetch,storage:memoryStorage()});
    expect(local.configured).toBe(false);expect(await local.refresh('capy_client000001')).toMatchObject({mode:'unconfigured',entries:[]});
    expect(await local.submitScore(ranked)).toMatchObject({ok:false,mode:'unconfigured'});expect(fetch).not.toHaveBeenCalled();
    const hang=(_:unknown,init?:RequestInit)=>new Promise<Response>((_,reject)=>init?.signal?.addEventListener('abort',()=>reject(new Error('aborted'))));
    const slow=new EndlessLeaderboardClient({baseUrl:'https://board.test',fetch:hang as unknown as typeof globalThis.fetch,storage:memoryStorage(),timeoutMs:15});
    expect(await slow.refresh()).toMatchObject({mode:'offline'});
    const busy=new EndlessLeaderboardClient({baseUrl:'https://board.test',fetch:(async()=>new Response('{"ok":false,"error":"rate_limited"}',{status:429})) as unknown as typeof globalThis.fetch,storage:memoryStorage()});
    expect(await busy.submitScore(ranked)).toMatchObject({ok:false,key:'p17.board.rateLimited'});
    const store=memoryStore(),strict=new EndlessLeaderboardClient({baseUrl:'https://board.test',fetch:viaWorker(store) as unknown as typeof globalThis.fetch,storage:memoryStorage()});
    expect(await strict.submitScore({...ranked,bestEndlessWave:60,bestEndlessTime:3000,bestEndlessAwakened:0,endlessMedallions:all(0)})).toMatchObject({ok:false,key:'p17.board.rejected'});
    expect(parseLeaderboard({ok:true,entries:[{player_id:'capy_snake0000001',best_wave:20,nickname:'x'},{playerId:'bad'}],totalPlayers:2})!.entries).toEqual([expect.objectContaining({rank:1,playerId:'capy_snake0000001',bestWave:20})]);
    expect(parseLeaderboard({ok:false})).toBeNull();
  });
});

describe('P17.2 Global Rank Board & Cozy Player Location',()=>{
  const env:Env={DB:undefined as never,ALLOWED_ORIGINS:'https://shizhuom.github.io'};
  const viaWorker=(store:ScoreStore,cf?:{city?:string;region?:string;country?:string})=>vi.fn((url:string|URL|Request,init?:RequestInit)=>handleRequest(new Request(String(url),init),env,{store,now:()=>8000,cf}));

  it('sanitizes real cities, formats bilingual fictional locations and cycles cozy spots',()=>{
    expect(FICTIONAL_LOCATIONS.length).toBeGreaterThanOrEqual(10);
    const token=fictionalLocationToken('capy_loc_seed_01');
    expect(isFictionalLocation(token)).toBe(true);
    expect(formatLocation(token,'zh-CN')).toMatch(/[\u4e00-\u9fff]/);
    expect(formatLocation(token,'en')).not.toMatch(/[\u3400-\u9fff]/);
    const next=nextFictionalLocationToken(token,'capy_loc_seed_01');
    expect(next).not.toBe(token);expect(isFictionalLocation(next)).toBe(true);
    expect(sanitizeLocation('  上海  ')).toBe('上海');
    expect(sanitizeLocation('<script>Tokyo</script>')).toBe('scriptTokyo/script');
    expect(sanitizeLocation(`${UNKIND}城`)).toBe('');
    expect(formatLocation('Shanghai, CN','en')).toBe('Shanghai, CN');
    expect(formatCfGeo({city:'Providence',country:'US'})).toBe('Providence, US');
  });

  it('prompts browser geolocation, reverse-geocodes coarsened coords, falls back to /api/geo or cute fictional spot on denial',async()=>{
    expect(coarsenCoord(41.824123)).toBe(41.82);
    expect(parseReverseGeocode({city:'Providence',countryCode:'US'},'en')).toBe('Providence, US');
    expect(parseReverseGeocode({city:'上海市',countryCode:'CN'},'zh-CN')).toBe('上海市');
    // Allowed + reverse-geocode succeeds:
    const allowGeo={getCurrentPosition:(ok:(p:{coords:{latitude:number;longitude:number}})=>void)=>ok({coords:{latitude:31.2304,longitude:121.4737}})};
    const okFetch=vi.fn(async(_url:string|URL|Request,_init?:RequestInit)=>new Response(JSON.stringify({city:'上海市',countryCode:'CN'}),{status:200}));
    const real=await resolveBrowserLocation({language:'zh-CN',playerId:'capy_geo_000001',geolocation:allowGeo,fetcher:okFetch as unknown as typeof fetch});
    expect(real).toEqual({ok:true,mode:'real',label:'上海市',source:'gps'});
    expect(String(okFetch.mock.calls[0][0])).toContain('latitude=31.23&longitude=121.47');
    // Allowed + reverse-geocode fails -> falls back to Cloudflare /api/geo:
    const failFetch=vi.fn(async()=>{throw new Error('offline');});
    const cf=await resolveBrowserLocation({language:'en',playerId:'capy_geo_000001',geolocation:allowGeo,fetcher:failFetch as unknown as typeof fetch,fallbackGeo:async()=>'Boston, US'});
    expect(cf).toEqual({ok:true,mode:'real',label:'Boston, US',source:'cf'});
    // Permission denied -> cute fictional location:
    const denyGeo={getCurrentPosition:(_ok:unknown,err:(e:{code:number})=>void)=>err({code:1})};
    const denied=await resolveBrowserLocation({language:'zh-CN',playerId:'capy_geo_000001',geolocation:denyGeo});
    expect(denied).toEqual({ok:false,mode:'fictional',label:fictionalLocationToken('capy_geo_000001'),reason:'denied'});
    // Unsupported -> cute fictional location:
    const unsupported=await resolveBrowserLocation({language:'en',playerId:'capy_geo_000001',geolocation:null});
    expect(unsupported).toMatchObject({ok:false,mode:'fictional',reason:'unsupported'});
  });

  it('validates rank scores, blocks dev-mode star jumps, enforces cross-board unique nicknames & secrets and syncs metadata',async()=>{
    const store=memoryStore();
    const rankPayload=(patch:Record<string,unknown>={})=>({playerId:'capy_rank_a00001',writeSecret:'sec_rank_secret_token_0001',nickname:'温泉星使',avatarId:'sakura_capy',location:'上海',stars:24,highestStars:26,wins:14,matches:18,bestWinStreak:5,...patch});
    expect(validateRank(rankPayload()).ok).toBe(true);
    expect(validateRank(rankPayload({stars:180,highestStars:180,wins:0,matches:0,bestWinStreak:0}))).toEqual({ok:false,error:'implausible_score'});
    expect(validateRank(rankPayload({stars:0,highestStars:0,wins:0,matches:0,bestWinStreak:0}))).toEqual({ok:false,error:'invalid_score'});
    const postRank=(body:unknown,now=1000)=>handleRequest(new Request('https://board.test/api/rank',{method:'POST',headers:{'content-type':'application/json',Origin:'https://shizhuom.github.io'},body:JSON.stringify(body)}),env,{store,now:()=>now});
    const postEndless=(body:unknown,now=1000)=>handleRequest(new Request('https://board.test/api/score',{method:'POST',headers:{'content-type':'application/json',Origin:'https://shizhuom.github.io'},body:JSON.stringify(body)}),env,{store,now:()=>now});
    // Submit rank A
    const r1=await postRank(rankPayload(),1000);expect(r1.status).toBe(200);expect(await r1.json()).toEqual({ok:true,rank:1,totalPlayers:1,stars:24,improved:true});
    // Cross-board duplicate nickname on Endless board is rejected 409!
    const dupEndless=await postEndless({playerId:'capy_other_b0001',writeSecret:'sec_other_secret_token_0002',nickname:'温泉星使',avatarId:'capybara',location:'fictional:yuzu_town',bestWave:22,elapsedSeconds:1200,mvpKind:'kungfu_po',mvpAwakened:false,awakenedCount:0,medallionTotal:5},1005);
    expect(dupEndless.status).toBe(409);expect(await dupEndless.json()).toEqual({ok:false,error:'nickname_taken'});
    // Cross-board secret hijack on Endless board with A's playerId is rejected 403!
    const hijackEndless=await postEndless({playerId:'capy_rank_a00001',writeSecret:'sec_wrong_secret_token_9999',nickname:'温泉星使',avatarId:'capybara',location:'上海',bestWave:22,elapsedSeconds:1200,mvpKind:'kungfu_po',mvpAwakened:false,awakenedCount:0,medallionTotal:5},1006);
    expect(hijackEndless.status).toBe(403);
    // Real owner submits Endless score, then renames & changes location on Rank -> both boards sync and preserve updated_at!
    expect((await postEndless({playerId:'capy_rank_a00001',writeSecret:'sec_rank_secret_token_0001',nickname:'温泉星使',avatarId:'sakura_capy',location:'上海',bestWave:22,elapsedSeconds:1200,mvpKind:'kungfu_po',mvpAwakened:false,awakenedCount:0,medallionTotal:5},1010)).status).toBe(200);
    expect((await postRank(rankPayload({nickname:'泡汤冠军',location:'fictional:sakura_bay'}),1050)).status).toBe(200);
    expect(store.rankRows.get('capy_rank_a00001')).toMatchObject({nickname:'泡汤冠军',location_label:'fictional:sakura_bay',updated_at:1000});
    expect(store.rows.get('capy_rank_a00001')).toMatchObject({nickname:'泡汤冠军',location_label:'fictional:sakura_bay',updated_at:1010});
    // Public /api/rank-leaderboard hides playerId and includes location + isMe
    const res=await handleRequest(new Request('https://board.test/api/rank-leaderboard?playerId=capy_rank_a00001',{headers:{Origin:'https://shizhuom.github.io'}}),env,{store});
    const raw=await res.text();expect(raw).not.toContain('capy_rank_a00001');expect(raw).not.toContain('secret');
    const parsed=parseRankLeaderboard(JSON.parse(raw))!;
    expect(parsed.totalPlayers).toBe(1);expect(parsed.entries[0]).toMatchObject({rank:1,isMe:true,nickname:'泡汤冠军',location:'fictional:sakura_bay',stars:24});
    // /api/geo returns formatted Cloudflare city
    const geoRes=await handleRequest(new Request('https://board.test/api/geo',{headers:{Origin:'https://shizhuom.github.io'}}),env,{store,cf:{city:'Tokyo',country:'JP'}});
    expect(await geoRes.json()).toEqual({ok:true,location:'Tokyo, JP'});
    // Ranking order helper & mergeRank live star update
    const sorted=[{stars:10,highest_stars:12,wins:8,updated_at:2},{stars:10,highest_stars:15,wins:9,updated_at:9},{stars:12,highest_stars:12,wins:8,updated_at:5}].sort(compareRankRows);
    expect(sorted.map(r=>[r.stars,r.highest_stars])).toEqual([[12,12],[10,15],[10,12]]);
    const r0=mergeRank(null,{player_id:'capy_m000000001',secret_hash:'h',nickname:'A',nickname_norm:'a',avatar_id:'capybara',location_label:'上海',stars:24,highest_stars:24,wins:14,matches:18,best_win_streak:4},100);
    const drop=mergeRank(r0.row,{...r0.row,stars:23,matches:19},200);
    expect(drop.row).toMatchObject({stars:23,highest_stars:24,matches:19,updated_at:200});
  });

  it('client submits/refreshes real Rank Board, skips developer-tainted profiles and renders real players + locations in UI',async()=>{
    const store=memoryStore(),storage=memoryStorage();
    const client=new EndlessLeaderboardClient({baseUrl:'https://board.test',fetch:viaWorker(store,{city:'Seoul',country:'KR'}) as unknown as typeof fetch,storage,now:()=>5000});
    expect(await client.fetchGeoLocation()).toBe('Seoul, KR');
    const devTainted=setRank(createProfile(),40);
    expect(devTainted.rankTainted).toBe(true);
    expect(rankSubmissionFromProfile(devTainted)).toBeNull();
    const legit:Profile={...createProfile(),playerId:'capy_legit000001',nickname:'星辉水豚',avatarId:'zen_capy',stars:28,highestStars:28,wins:16,matches:20,bestWinStreak:6,locationMode:'real',locationLabel:'京都'};
    expect(await client.submitRank(legit)).toMatchObject({ok:true,mode:'online',rank:1,totalPlayers:1});
    const snap=await client.refreshRank(legit.playerId,true);
    expect(snap).toMatchObject({mode:'online',totalPlayers:1,me:{rank:1,isMe:true,location:'京都',stars:28}});
    expect(JSON.parse(storage.getItem(`capybara_defense_v1:${RANK_BOARD_CACHE_KEY}`)!).entries).toHaveLength(1);
    // Online Rank Board UI renders real players + location badges + location controls; offline with no cache falls back to local NPCs
    const psOnline=new ProfileScreens(()=>legit,()=>true,()=>{},()=>{},undefined,undefined,()=>({snapshot:snap,loading:false}));
    const htmlZh=psOnline.markup('leaderboard');
    expect(htmlZh).toContain('星辉水豚');expect(htmlZh).toContain('京都');expect(htmlZh).toContain('data-action="location-request"');expect(htmlZh).not.toContain('data-action="location-reroll"');
    expect(htmlZh).toContain('关闭定位');
    expect(htmlZh).not.toContain('情绪稳定祖师爷');
    // English mode with fictional location stays 100% English (zero Chinese characters)
    setLanguage('en');
    const enProfile:Profile={...legit,nickname:'ChillStar',locationMode:'fictional',locationLabel:'fictional:yuzu_town'};
    const enSnap={...snap,entries:[{...snap.entries[0],nickname:'ChillStar',location:'fictional:yuzu_town'}],me:{...snap.me!,nickname:'ChillStar',location:'fictional:yuzu_town'}};
    const psEn=new ProfileScreens(()=>enProfile,()=>true,()=>{},()=>{},undefined,undefined,()=>({snapshot:enSnap,loading:false}));
    const htmlEn=psEn.markup('leaderboard');
    expect(htmlEn).toContain('Yuzu Onsen Town');
    expect(htmlEn.replace(/<[^>]+>/g,'')).not.toMatch(/[\u3400-\u9fff]/);
    // Endless board & passport also render location badge
    const endlessHtml=endlessBoardMarkup(enProfile,{snapshot:{mode:'online',entries:[{rank:1,isMe:true,nickname:'ChillStar',avatarId:'zen_capy',location:'fictional:yuzu_town',bestWave:25,elapsedSeconds:900,mvpKind:'kungfu_po',mvpAwakened:true,awakenedCount:1,medallionTotal:10,updatedAt:5000}],totalPlayers:1,me:null,fetchedAt:5000},loading:false});
    expect(endlessHtml).toContain('Yuzu Onsen Town');expect(endlessHtml).toContain('data-action="location-request"');
    expect(psEn.markup('profile')).toContain('Yuzu Onsen Town');
  });
});
