import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {BattleEngine,type EngineOptions} from '../src/core/BattleEngine';
import {Random} from '../src/core/Random';
import {copyLoadout} from '../src/core/PropSystem';
import {createProfile,normalizeProfile,unlockAllProfile} from '../src/core/MetaProgression';
import {VILLAGE_EPOCH,createVillage,normalizeVillage} from '../src/core/VillageState';
import {
  buildFacility,buildableFacilities,claimOfflineHarvest,computeOfflineHarvest,facilityUpgradeCost,getVillageResidents,
  petVillageResident,residentCapacity,settleVillageClock,villageBadge,villageLoadout,villageStars,
} from '../src/core/VillageProgression';
import {FACILITIES,FACILITY_IDS,VILLAGE_WELCOME_MS,getVillageBuff,type FacilityId} from '../src/config/village';
import {ECONOMY} from '../src/config/units';
import {RANKS} from '../src/config/ranks';
import {awardBattle,awardEndless} from '../src/ui/storage';
import {P16_SCENE_IDS,sceneSticker} from '../src/ui/stickers';
import * as registry from '../src/render/AssetRegistry';
import {courtyardMarkup} from '../src/ui/CourtyardView';
import {VillageScreen} from '../src/ui/VillageScreen';
import {pauseMarkup,resultMarkup} from '../src/ui/SettlementView';
import {setLanguage,t} from '../src/i18n/i18n';
import {p16En,p16Zh} from '../src/i18n/p16';
import type {BattleLoadout,BattleResult,Profile} from '../src/core/types';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();setLanguage('zh-CN');});
const HOUR=3600_000,NOW=1_800_000_000_000;
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
const village=(facilities:Partial<Record<FacilityId,number>>,patch:Partial<Profile['village']>={}):Profile=>{
  const p=createProfile();return{...p,coins:2000,village:{...p.village,wood:200,essence:200,facilities:{fac_bamboo_pool:1,...facilities},lastHarvestAt:NOW,...patch}};
};
const base:BattleLoadout={ownedProps:{},equippedWeapons:{},equippedActiveProps:[],equippedPassiveProps:[]};
const withVillage=(facilities:Partial<Record<FacilityId,number>>):BattleLoadout=>({...base,villageFacilities:{fac_bamboo_pool:1,...facilities}});
const engine=(loadout:BattleLoadout,options:EngineOptions={})=>new BattleEngine({seed:23,autoWaves:false,loadouts:{player:loadout},...options});
const unit=(e:BattleEngine,kind:string)=>{const r=e.grant(kind);return e.state.units.find(u=>u.id===r.unitId)!;};
function scripted(e:BattleEngine,values:number[]):void {let i=0;(e as unknown as {villageRandom:{next():number}}).villageRandom={next:()=>values[i++%values.length]};}
function standardWinner(options:EngineOptions={}):BattleEngine {const e=new BattleEngine({seed:41,...options});e.start();while(e.state.phase!=='finished')e.skipWave();return e;}

describe('P16 synced art',()=>{
  const sizes:Record<string,[number,number]>={bg_onsen_village:[1280,720],ui_village_peek_capy:[256,256],ui_village_gate:[256,256],ui_harvest_basket:[256,256],
    ...Object.fromEntries(FACILITY_IDS.map(id=>[id,[256,256]])),res_onsen_wood:[160,160],res_yuzu_essence:[160,160],ui_pet_heart:[160,160],ui_sleep_zzz:[160,160]};
  it('ships 290 unique sprites with the 13 exact RGBA P16 images',()=>{
    const ids=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8')) as string[];
    expect(ids).toHaveLength(290);expect(new Set(ids).size).toBe(290);expect(P16_SCENE_IDS).toHaveLength(13);
    for(const [id,[w,h]] of Object.entries(sizes)){expect(ids).toContain(id);const png=sprite(id);expect([png.readUInt32BE(16),png.readUInt32BE(20),png[25]]).toEqual([w,h,6]);}
    expect(Object.keys(sizes).sort()).toEqual([...P16_SCENE_IDS].sort());
    // Bottom-flush paws: the last rows match the established compendium peek mascot pixel for pixel.
    for(const row of [253,254,255])expect(alphaRow(sprite('ui_village_peek_capy'),row)).toEqual(alphaRow(sprite('ui_compendium_peek_capy'),row));
    expect(Math.max(...alphaRow(sprite('ui_village_peek_capy'),254))).toBeGreaterThan(200);
  });
  it('renders thirteen distinct borderless, text-free fallbacks and upgrades to decoded PNGs',()=>{
    const svgs=P16_SCENE_IDS.map(id=>sceneSticker(id,'',64));
    for(const svg of svgs){expect(svg).toContain('<svg');expect(svg).not.toContain('<text');expect(svg).not.toContain('stroke="#fffdf6"');}
    expect(new Set(svgs.map(s=>s.replace(/data-sticker="[^"]*"|aria-label="[^"]*"/g,''))).size).toBe(13);
    vi.spyOn(registry,'spriteUrl').mockImplementation(id=>`/nested/assets/sprites/${id}.png`);
    for(const id of P16_SCENE_IDS)expect(sceneSticker(id,'',64)).toContain(`src="/nested/assets/sprites/${id}.png"`);
  });
});

describe('P16 profile migration and welcome gift',()=>{
  it('starts new saves with an empty courtyard until Village onboarding gifts starter materials at 16★',()=>{
    const emptyVillage={wood:0,essence:0,facilities:{},lastHarvestAt:VILLAGE_EPOCH-VILLAGE_WELCOME_MS,petTapDay:'',petTapCount:0};
    expect(createProfile().village).toEqual(emptyVillage);expect(normalizeProfile(null)).toEqual(createProfile());
    const legacy=normalizeProfile({coins:80,wins:2,matches:3,schemaVersion:2,ingredients:{}});expect(legacy.village).toEqual(emptyVillage);
    expect(normalizeProfile(JSON.parse(JSON.stringify(legacy)))).toEqual(legacy);
    expect(computeOfflineHarvest(village({},{lastHarvestAt:VILLAGE_EPOCH-VILLAGE_WELCOME_MS}),VILLAGE_EPOCH)).toMatchObject({coins:2,elapsedMs:VILLAGE_WELCOME_MS});
  });
  it('never re-gifts an existing village and sanitizes forged values',()=>{
    const spent=normalizeProfile({village:{wood:0,essence:0,facilities:{fac_bamboo_pool:1},lastHarvestAt:NOW,petTapDay:'2026-11-19',petTapCount:4}});
    expect(spent.village).toEqual({wood:0,essence:0,facilities:{fac_bamboo_pool:1},lastHarvestAt:NOW,petTapDay:'2026-11-19',petTapCount:4});
    const forged=normalizeVillage({wood:-3,essence:1.5,facilities:{fac_fish_stall:9,fac_fake:3,fac_yuzu_tree:-1,fac_bamboo_pool:0},lastHarvestAt:'soon',petTapDay:'tuesday',petTapCount:99},NOW);
    expect(forged).toEqual({wood:0,essence:0,facilities:{fac_fish_stall:3},lastHarvestAt:NOW-VILLAGE_WELCOME_MS,petTapDay:'',petTapCount:0});
    expect(createVillage(NOW).lastHarvestAt).toBe(NOW-VILLAGE_WELCOME_MS);
  });
  it('fills the developer test village to Lv.3 with 99 materials and a six-hour basket',()=>{
    const before=Date.now(),full=unlockAllProfile(createProfile());
    expect(full.village).toMatchObject({wood:99,essence:99,facilities:Object.fromEntries(FACILITY_IDS.map(id=>[id,3]))});
    expect(full.village.lastHarvestAt).toBeGreaterThanOrEqual(before-6*HOUR-5);expect(full.village.lastHarvestAt).toBeLessThanOrEqual(Date.now()-6*HOUR);
    expect(villageStars(full)).toBe(15);
  });
  it('keeps every P15 battle number when the loadout carries no village or only the starter pool',()=>{
    for(const loadout of [base,withVillage({}),villageLoadout(createProfile())]){
      const e=engine(loadout),plain=engine(base);
      expect(e.state.sides.player).toMatchObject({food:ECONOMY.initialFood,oranges:ECONOMY.initialOranges,villageLoot:[]});
      for(const kind of ['hamster','squirrel','kungfu_po','zen_master'])expect(e.getUnitStats(unit(e,kind))).toEqual(plain.getUnitStats(unit(plain,kind)));
    }
    expect(copyLoadout(base)).toEqual(base);expect(Object.keys(copyLoadout(base))).not.toContain('villageFacilities');
    expect(copyLoadout(withVillage({fac_fish_stall:7,fac_fake:2} as Partial<Record<FacilityId,number>>)).villageFacilities).toEqual({fac_bamboo_pool:1,fac_fish_stall:3});
  });
});

describe('P16 twelve-hour offline harvest',()=>{
  it('accrues from 0 minutes through 3 hours and clamps at 12 hours, including clock rollbacks',()=>{
    const p=village({});
    expect(computeOfflineHarvest(p,NOW)).toEqual({elapsedMs:0,coins:0,fragments:0,yuzu:0,tickets:0,full:false});
    expect(computeOfflineHarvest(p,NOW+3*HOUR)).toMatchObject({coins:24,fragments:0,full:false});
    expect(computeOfflineHarvest(p,NOW+12*HOUR)).toMatchObject({elapsedMs:12*HOUR,coins:96,full:true});
    expect(computeOfflineHarvest(p,NOW+24*HOUR)).toEqual(computeOfflineHarvest(p,NOW+12*HOUR));
    expect(computeOfflineHarvest(p,NOW-5*HOUR)).toEqual({elapsedMs:0,coins:0,fragments:0,yuzu:0,tickets:0,full:false});
    expect(settleVillageClock(p,NOW-5*HOUR).village.lastHarvestAt).toBe(NOW-5*HOUR);expect(settleVillageClock(p,NOW+HOUR)).toBe(p);
  });
  it('pays a fully built village coins, weapon fragments and golden yuzu per 12 hours — exactly once',()=>{
    const full=village(Object.fromEntries(FACILITY_IDS.map(id=>[id,3])));
    const h=computeOfflineHarvest(full,NOW+12*HOUR);
    expect(h).toEqual({elapsedMs:12*HOUR,coins:(28+20+16+20+26)*12,fragments:1+1,yuzu:1,tickets:0,full:true});
    const claimed=claimOfflineHarvest({...full,ingredients:{}},NOW+12*HOUR,()=>.3);
    expect(claimed).toMatchObject({ok:true,key:'p16.harvested'});
    expect(claimed.profile.coins).toBe(full.coins+1320);expect(claimed.profile.freeLotteryTickets).toBe(full.freeLotteryTickets);
    expect(claimed.profile.ingredients.ing_yuzu).toBe(1);expect(Object.values(claimed.profile.weaponFragments).reduce((a,b)=>a+b,0)).toBe(2);
    expect(claimed.profile.village.lastHarvestAt).toBe(NOW+12*HOUR);
    expect(claimOfflineHarvest(claimed.profile,NOW+12*HOUR)).toMatchObject({ok:false,key:'p16.nothingToHarvest'});
    const mid=computeOfflineHarvest(village({fac_sakura_pavilion:1,fac_yuzu_tree:1}),NOW+8*HOUR);
    expect(mid).toMatchObject({coins:(8+8+5)*8,fragments:0,yuzu:0,tickets:0});
  });
});

describe('P16 building, residents and petting',()=>{
  it('builds and upgrades every facility to Lv.3, spending wood, essence and coins',()=>{
    const totalWood=FACILITY_IDS.reduce((s,id)=>s+FACILITIES[id].costs.reduce((a,c)=>a+(c?.wood??0),0),0);
    const totalEssence=FACILITY_IDS.reduce((s,id)=>s+FACILITIES[id].costs.reduce((a,c)=>a+(c?.essence??0),0),0);
    const totalCoins=FACILITY_IDS.reduce((s,id)=>s+FACILITIES[id].costs.reduce((a,c)=>a+(c?.coins??0),0),0);
    let p:Profile={...createProfile(),coins:totalCoins,village:{...createProfile().village,wood:totalWood,essence:totalEssence,facilities:{},lastHarvestAt:NOW}};
    expect(buildFacility(p,'fac_bamboo_pool')).toMatchObject({ok:true,key:'p16.built',level:1});
    for(const id of FACILITY_IDS){
      for(let level=0;level<3;level++){
        const cost=facilityUpgradeCost(id,level)!,before=p,result=buildFacility(p,id);
        expect(result).toMatchObject({ok:true,level:level+1});p=result.profile;
        expect([before.village.wood-p.village.wood,before.village.essence-p.village.essence,before.coins-p.coins]).toEqual([cost.wood,cost.essence,cost.coins]);
      }
      expect(buildFacility(p,id)).toMatchObject({ok:false,key:'p16.maxLevel'});
    }
    expect(villageStars(p)).toBe(15);expect(p.coins).toBe(0);expect(p.village.wood).toBe(0);expect(p.village.essence).toBe(0);expect(facilityUpgradeCost('fac_fish_stall',3)).toBeNull();
    expect(buildFacility({...createProfile(),coins:0},'fac_fish_stall')).toMatchObject({ok:false,key:'p16.missingMaterials'});
    expect(buildFacility(createProfile(),'fac_fake')).toMatchObject({ok:false,key:'p16.invalidFacility'});
  });
  it('shows Harvest!, then Build!, then stars on the courtyard badge',()=>{
    const p={...village({},{wood:130,essence:45,lastHarvestAt:VILLAGE_EPOCH-VILLAGE_WELCOME_MS}),stars:16,highestStars:16,matches:16,coins:800};
    expect(buildableFacilities(p)).toEqual(['fac_fish_stall','fac_yuzu_tree','fac_cat_nap']);
    expect(villageBadge(p,VILLAGE_EPOCH)).toBe('build');
    expect(villageBadge(p,VILLAGE_EPOCH+12*HOUR)).toBe('harvest');
    expect(villageBadge({...p,coins:0},VILLAGE_EPOCH)).toBe('stars');
    expect(villageBadge(village({},{lastHarvestAt:NOW}),NOW+90*60_000)).toBe('harvest');
    const html=courtyardMarkup({...p,coins:0},VILLAGE_EPOCH);
    expect(html.match(/hub-dock-right[\s\S]*?<\/nav>/)![0].match(/data-action="(\w+)"/g)).toEqual(['data-action="village"','data-action="market"','data-action="leaderboard"']);
    expect(html).toContain('ui_village_gate');expect(html).toContain('★1/15');
    expect(courtyardMarkup(p,VILLAGE_EPOCH+13*HOUR)).toContain('class="village-harvest-badge">领收成!');
    expect(courtyardMarkup(p,VILLAGE_EPOCH)).toContain('class="village-build-badge">可建造!');
  });
  it('moves in merged heroes first, grows with the cat-nap corner and binds every resident to a built facility',()=>{
    const p=village({},{});p.mergedHeroes=['kungfu_po','samurai_doge','fake'];p.stars=20;p.highestStars=20;
    let residents=getVillageResidents(p);
    expect(residents.map(r=>r.id)).toEqual(['kungfu_po','samurai_doge']);expect(residents.every(r=>r.facility==='fac_bamboo_pool'&&r.pose==='soak')).toBe(true);
    for(const [level,count] of [[1,3],[2,4],[3,5]] as const){
      const q=village({fac_cat_nap:level,fac_fish_stall:1});q.mergedHeroes=['kungfu_po'];q.stars=20;q.highestStars=20;
      residents=getVillageResidents(q);expect(residentCapacity(q)).toBe(count);expect(residents).toHaveLength(count);
      expect(residents[0]).toMatchObject({id:'kungfu_po',hero:true});expect(residents.slice(1).every(r=>!r.hero)).toBe(true);
      expect(new Set(residents.map(r=>r.facility)).size).toBe(Math.min(count,3));expect(residents.some(r=>r.pose==='nap')).toBe(true);
    }
  });
  it('pays 5 coins for the first ten pats a day, keeps petting free afterwards and resets the next day',()=>{
    let p=village({});const pet=getVillageResidents(p)[0].id;
    for(let i=0;i<10;i++){const r=petVillageResident(p,pet,'2026-11-19');expect(r).toMatchObject({ok:true,coins:5,key:'p16.petCoins'});p=r.profile;}
    expect(p.coins).toBe(2050);expect(p.village).toMatchObject({petTapDay:'2026-11-19',petTapCount:10});
    expect(petVillageResident(p,pet,'2026-11-19')).toMatchObject({ok:true,coins:0,key:'p16.petFull'});
    const tomorrow=petVillageResident(p,pet,'2026-11-20');expect(tomorrow).toMatchObject({ok:true,coins:5});expect(tomorrow.profile.village.petTapCount).toBe(1);
    expect(petVillageResident(p,'goose','2026-11-20')).toMatchObject({ok:false,key:'p16.petMissing'});
  });
});

describe('P16 battle drops and gentle buffs',()=>{
  it('draws building materials from an isolated stream that never shifts combat or ingredient randomness',()=>{
    const run=(swap:boolean)=>{const e=engine(withVillage({fac_sakura_pavilion:3,fac_yuzu_tree:1}));if(swap)(e as unknown as {villageRandom:Random}).villageRandom=new Random(4242);
      e.start();e.state.sides.player.food=999;
      for(let w=0;w<10;w++){e.skipWave();e.summon();for(let i=0;i<8;i++)e.hurt(e.spawnEnemy(i%2?'rat':'crab','player'),1e9,undefined,false,false,true);for(const b of e.state.enemies.filter(x=>x.boss))e.hurt(b,1e9,undefined,false,false,true);}
      e.skipWave();
      return e.state;};
    const a=run(false),b=run(true);
    expect(b.units.map(u=>`${u.kind}:${u.level}`)).toEqual(a.units.map(u=>`${u.kind}:${u.level}`));
    expect(b.sides.player.ingredientLoot).toEqual(a.sides.player.ingredientLoot);
    expect(a.sides.player.villageLoot.filter(id=>id==='res_onsen_wood').length).toBeGreaterThanOrEqual(2);
    const e=engine(base),rat=e.spawnEnemy('rat','player'),before=JSON.stringify((e as unknown as {random:Random;ingredientRandom:Random}).random);
    scripted(e,[0]);e.hurt(rat,1e9,undefined,false,false,true);expect(JSON.stringify((e as unknown as {random:Random}).random)).toBe(before);
    expect(e.state.sides.player.villageLoot).toEqual([]);
  });
  it('grants yuzu-tree essence on wave-10 boss kills and pavilion bonus fragments on boss kills',()=>{
    const plain=engine(base);plain.state.wave=10;scripted(plain,[.1]);plain.hurt(plain.spawnEnemy('husky_wrecker','player'),1e9);
    expect(plain.state.sides.player.villageLoot).toEqual([]);
    const tree=engine(withVillage({fac_yuzu_tree:1}));tree.state.wave=10;scripted(tree,[.1]);tree.hurt(tree.spawnEnemy('husky_wrecker','player'),1e9);
    expect(tree.state.sides.player.villageLoot).toEqual(['res_yuzu_essence']);
    const pavilion=engine(withVillage({fac_sakura_pavilion:2}));pavilion.state.wave=10;scripted(pavilion,[.2,.5]);const before=pavilion.state.sides.player.loot.length;
    pavilion.hurt(pavilion.spawnEnemy('husky_wrecker','player'),1e9);expect(pavilion.state.sides.player.loot.length).toBeGreaterThanOrEqual(before+2);
  });
  it('rewards wave 7 & 10 wood (plus 60% essence) and endless materials every 3/5 waves',()=>{
    const e=standardWinner();scripted(e,[.1]);
    expect(e.state.result!.villageLoot!.filter(id=>id==='res_onsen_wood')).toHaveLength(2);
    const rich=new BattleEngine({seed:41});rich.start();scripted(rich,[.1]);while(rich.state.phase!=='finished')rich.skipWave();
    expect(rich.state.result!.villageLoot).toEqual(['res_onsen_wood','res_onsen_wood','res_yuzu_essence']);
    const dry=new BattleEngine({seed:41});dry.start();scripted(dry,[.9]);while(dry.state.phase!=='finished')dry.skipWave();
    expect(dry.state.result!.villageLoot).toEqual(['res_onsen_wood','res_onsen_wood']);
    rich.enterEndless();rich.skipWave();rich.skipWave();// Wave 13 (k=3) drops 1 wood
    rich.state.enemies=[];rich.state.spawned=rich.currentWaveTargetCount();(rich as unknown as {pendingBosses:unknown[]}).pendingBosses=[];rich.pause();rich.surrender();
    expect(rich.state.result!.endlessVillageLoot).toEqual(['res_onsen_wood']);
  });
  it('salvages half of the materials on defeat and banks them idempotently through both receipts',()=>{
    for(const [n,kept] of [[0,0],[1,1],[5,3]] as const){const e=engine(base);e.start();e.state.sides.player.villageLoot=Array.from({length:n},(_,i)=>i%2?'res_yuzu_essence':'res_onsen_wood');
      e.pause();e.surrender();expect(e.state.result!.villageLoot).toEqual(e.state.sides.player.villageLoot.slice(0,kept));}
    const loss:BattleResult={winner:'ai',reason:'oranges',loot:[],playerLoot:[],aiLoot:[],coins:0,elapsed:9,villageLoot:['res_onsen_wood','res_yuzu_essence','fake']};
    const p=createProfile(),first=awardBattle(p,'p16-loss',loss);
    expect(first.profile.village).toMatchObject({wood:1,essence:1});expect(awardBattle(first.profile,'p16-loss',loss).awarded).toBe(false);
    const e=new BattleEngine({seed:41});e.start();scripted(e,[.1]);while(e.state.phase!=='finished')e.skipWave();
    const banked=awardBattle(p,e.state.id,e.state.result!);expect(banked.profile.village).toMatchObject({wood:2,essence:1});
    e.enterEndless();e.skipWave();e.skipWave();e.state.enemies=[];e.state.spawned=e.currentWaveTargetCount();(e as unknown as {pendingBosses:unknown[]}).pendingBosses=[];e.pause();e.surrender();
    const bonus=awardEndless(banked.profile,e.state.id,e.state.result!);expect(bonus.profile.village).toMatchObject({wood:3,essence:1});
    expect(awardEndless(bonus.profile,e.state.id,e.state.result!).awarded).toBe(false);
  });
  it('applies all five facility buffs: fish, oranges, ATK, SPD, boss damage and battle coins',()=>{
    for(const [level,food] of [[1,2],[2,4],[3,6]] as const)expect(engine(withVillage({fac_fish_stall:level})).state.sides.player.food).toBe(22+food);
    expect([1,2,3].map(level=>engine(withVillage({fac_yuzu_tree:level})).state.sides.player.oranges)).toEqual([3,4,4]);
    const ratio=(facilities:Partial<Record<FacilityId,number>>,kind='squirrel')=>{const on=engine(withVillage(facilities)),off=engine(base);
      const a=on.getUnitStats(unit(on,kind)),b=off.getUnitStats(unit(off,kind));return{damage:a.damage/b.damage,rate:a.rate/b.rate};};
    expect(ratio({fac_bamboo_pool:2})).toMatchObject({rate:1});expect(ratio({fac_bamboo_pool:2}).damage).toBeCloseTo(1.04,10);
    expect(ratio({fac_bamboo_pool:3}).damage).toBeCloseTo(1.08,10);expect(ratio({fac_bamboo_pool:3}).rate).toBeCloseTo(1.04,10);
    for(const [level,rate] of [[1,1.03],[2,1.06],[3,1.09]] as const)expect(ratio({fac_cat_nap:level},'kungfu_po').rate).toBeCloseTo(rate,10);
    for(const [level,bonus] of [[1,.04],[2,.07],[3,.1]] as const){
      const hit=(facilities:Partial<Record<FacilityId,number>>)=>{const e=engine(withVillage(facilities)),u=unit(e,'hamster'),boss=e.spawnEnemy('husky_wrecker','player'),hp=boss.hp;e.hurt(boss,40,u);return hp-boss.hp;};
      expect(hit({fac_sakura_pavilion:level})/hit({})).toBeCloseTo(1+bonus,10);
    }
    const coins=(facilities:Partial<Record<FacilityId,number>>)=>{const e=standardWinner({loadouts:{player:withVillage(facilities)}});return{coins:e.state.result!.coins,food:e.state.sides.player.food};};
    const plain=coins({}),tree=coins({fac_yuzu_tree:3});
    expect(plain.coins).toBe(RANKS[0].winCoins+Math.min(45,Math.floor(plain.food*.5)));
    expect(tree.coins).toBe(Math.round((RANKS[0].winCoins+Math.min(45,Math.floor(tree.food*.5)))*1.1));
    expect(getVillageBuff({fac_bamboo_pool:1},'damage')).toBe(0);
  });
  it('hot-syncs village upgrades during Wave 1 preparation without minting fish or oranges',()=>{
    const e=engine(withVillage({}),{autoWaves:true});e.start();
    expect(e.syncPreparationLoadout(withVillage({fac_fish_stall:3,fac_yuzu_tree:2})).ok).toBe(true);expect(e.state.sides.player).toMatchObject({food:28,oranges:4});
    for(let i=0;i<3;i++){e.syncPreparationLoadout(withVillage({}));e.syncPreparationLoadout(withVillage({fac_fish_stall:3,fac_yuzu_tree:2}));}
    expect(e.state.sides.player).toMatchObject({food:28,oranges:4});
    e.syncPreparationLoadout(withVillage({}));expect(e.state.sides.player).toMatchObject({food:22,oranges:3});
  });
});

describe('P16 village screen and settlement',()=>{
  function host(profile:Profile,now=NOW){
    const saved=new Map<string,string>();
    vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>{saved.set(k,v);},removeItem:(k:string)=>{saved.delete(k);}}});
    let current=profile;const notify=vi.fn(),sound=vi.fn(),render=vi.fn();
    const screen=new VillageScreen(()=>current,next=>{current=next;},render,notify,sound,()=>now,()=>.25);
    return{screen,notify,sound,saved,get:()=>current};
  }
  it('renders the courtyard panorama, pats a pet, harvests and builds from a highlighted row',()=>{
    vi.useFakeTimers();
    const h=host({...village({},{lastHarvestAt:NOW-3*HOUR}),mergedHeroes:['kungfu_po'],stars:20,highestStars:20});
    let html=h.screen.markup();
    expect(html).toContain('data-ledger-page="village"');expect(html).toContain('ui_village_peek_capy');expect(html).toContain(t('p16.title'));
    expect(html).toContain('bg_onsen_village');expect(html.match(/class="village-spot is-empty"/g)).toHaveLength(4);
    expect(html.match(/class="village-pet /g)).toHaveLength(2);expect(html).toContain('data-action="village-harvest"');expect(html).toContain('+24');
    expect(html).toContain('★1/15');expect(html).toContain('data-action="close-village"');
    h.screen.action('village-pet:0');html=h.screen.markup();
    expect(html).toContain('village-pet-bubble');expect(html).toContain('ui_pet_heart');expect(html).toContain('+5🪙');
    expect(h.get().coins).toBe(2005);expect(h.sound).toHaveBeenLastCalledWith('treasure');
    vi.advanceTimersByTime(2000);expect(h.screen.markup()).not.toContain('village-pet-bubble');
    h.screen.action('village-harvest');expect(h.get().coins).toBe(2029);expect(h.sound).toHaveBeenLastCalledWith('lottery_win');
    expect(h.screen.markup()).toContain('data-action="village-harvest" disabled');
    h.screen.action('village-focus:fac_cat_nap');html=h.screen.markup();
    expect(html).toContain('village-row unbuilt is-focused" data-facility-id="fac_cat_nap"');expect(html.match(/class="storybook-row-card village-row /g)).toHaveLength(5);
    h.screen.action('village-build:fac_cat_nap');expect(h.get().village.facilities.fac_cat_nap).toBe(1);expect(h.sound).toHaveBeenLastCalledWith('shovel');
    expect(JSON.parse(h.saved.get('capybara_defense_v1:profile')!).village.facilities.fac_cat_nap).toBe(1);
    h.screen.action('village-tab:courtyard');expect(h.screen.markup().match(/class="village-pet /g)).toHaveLength(3);
    vi.useRealTimers();
  });
  it('shows gathered materials on the pause tray and as big icons on the report shelf',()=>{
    const e=engine(base);e.start();expect(pauseMarkup(e.state)).not.toContain('pause-materials');
    e.state.sides.player.villageLoot=['res_onsen_wood','res_onsen_wood','res_yuzu_essence'];
    const pause=pauseMarkup(e.state);expect(pause).toContain('pause-materials');expect(pause).toContain('res_onsen_wood');expect(pause).toContain('×2');
    const win=new BattleEngine({seed:41});win.start();scripted(win,[.1]);while(win.state.phase!=='finished')win.skipWave();
    const html=resultMarkup({state:win.state,profile:createProfile(),savedResult:true,resultStars:1,previousRank:0,newWeapons:[],newAvatars:[],statsOpen:true});
    expect(html.match(/visual-treasure-item is-material/g)).toHaveLength(2);
    expect(html).toMatch(/is-material[^]*?data-sticker="res_onsen_wood"[^>]*width="72"|is-material[^]*?width="72"[^>]*data-sticker="res_onsen_wood"/);
    expect(html).toContain('×2');
    const plaque=html.match(/<div class="crest-core-rewards">[\s\S]*?<\/div>/)![0];expect(plaque).not.toContain('res_onsen_wood');
  });
});

describe('P16 bilingual copy',()=>{
  it('ships complete, wholesome zh-CN/en village copy',()=>{
    expect(Object.keys(p16En).sort()).toEqual(Object.keys(p16Zh).sort());
    const wholesome=/涩涩|色色|不许涩|Bonk|bonk|绝育|绿茶|疯批|舔狗|鸡你太/i;
    for(const text of [...Object.values(p16Zh),...Object.values(p16En)]){expect(text.trim()).not.toBe('');expect(text).not.toMatch(wholesome);}
    for(const file of ['src/i18n/p16.ts','src/config/village.ts'])expect(readFileSync(file,'utf8')).not.toMatch(wholesome);
    for(const language of ['zh-CN','en'] as const){setLanguage(language);for(const id of FACILITY_IDS){expect(t(`facility.${id}`)).not.toBe(`facility.${id}`);expect(t(`facility.${id}.desc`)).not.toBe(`facility.${id}.desc`);}}
  });
});
