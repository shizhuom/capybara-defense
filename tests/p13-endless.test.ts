import {describe,it,expect} from 'vitest';
import {BattleEngine,type EngineOptions} from '../src/core/BattleEngine';
import {createProfile,normalizeProfile} from '../src/core/MetaProgression';
import {replayTutorial} from '../src/core/Tutorial';
import {ENEMIES} from '../src/config/enemies';
import * as waves from '../src/config/waves';
import * as storage from '../src/ui/storage';
import type {BattleResult,Profile} from '../src/core/types';

function standardWinner(options:EngineOptions={}):BattleEngine {
  const e=new BattleEngine({seed:41,...options});e.start();
  while(e.state.phase!=='finished')e.skipWave();
  expect(e.state.result).toMatchObject({winner:'player',reason:'waves'});
  return e;
}
function endless(options:EngineOptions={}):BattleEngine {
  const e=standardWinner(options);expect(e).toHaveProperty('enterEndless');
  expect(e.enterEndless().ok).toBe(true);return e;
}
function memoryStorage():Storage {
  const data=new Map<string,string>();
  return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,
    setItem:(key,value)=>{data.set(key,value);},removeItem:key=>{data.delete(key);},clear:()=>data.clear()};
}
const normal:BattleResult={winner:'player',reason:'waves',loot:['m02_slipper'],playerLoot:['m02_slipper'],aiLoot:[],coins:75,elapsed:350};
const honor:BattleResult={...normal,reason:'oranges',endless:true,endlessWave:13,endlessCoins:45,
  endlessLoot:['m01_swatter','bamboo_blade'],coins:120,loot:['m02_slipper','m01_swatter','bamboo_blade'],mergedHeroes:['kungfu_po']};

// P17 rebalance: endless HP grows ×1.25 per wave (was ×2), speed +1.2%/wave (cap +60%), armor +0.9%/wave (cap +45%).
const hp=(k:number)=>9*Math.pow(1.25,k);
describe('P13 exact endless pressure (P17 ×1.25 curve)',()=>{
  it.each([
    [11,29,hp(1),1.104,1.012,.009,1],
    [12,32,hp(2),1.01568,1.024,.018,1],
    [13,35,hp(3),.9344256,1.036,.027,2],
    [15,41,hp(5),.79089782784,1.06,.045,2],
    [16,44,hp(6),.7276260016128,1.072,.054,3],
    [24,56,hp(14),.55,1.168,.126,3],
  ])('wave %i scales HP, pressure and mandatory bosses',(wave,count,hpScale,interval,speedScale,armorBonus,bossCount)=>{
    expect(waves).toHaveProperty('getWaveConfig');
    const config=waves.getWaveConfig(wave);
    expect(config.count).toBe(count);expect(config.hpScale).toBe(hpScale);
    expect(config.interval).toBeCloseTo(interval,10);expect(config.speedScale).toBeCloseTo(speedScale);
    expect(config.armorBonus).toBeCloseTo(armorBonus);
    expect(waves.waveEnemyCount(wave,53)).toBe(count);
    expect(waves.bossCountForWave(wave,0)).toBe(bossCount);
    expect(waves.bossCountForWave(wave,53)).toBe(bossCount);
    const bosses=waves.bossesForWave('sunny_backyard',0,wave,()=>.4);
    expect(bosses).toHaveLength(bossCount);expect(new Set(bosses).size).toBe(bossCount);
  });
  it('applies wave11 pressure to both a scheduled boss and the first actual minion',()=>{
    const e=endless({progressionStars:0});const boss=e.state.enemies.find(enemy=>enemy.boss)!;
    expect(boss.maxHp).toBe(700*11.25);expect(boss.speed).toBeCloseTo(.22*1.012);expect(boss.armor).toBeCloseTo(.059);
    e.tick(1);const rat=e.state.enemies.find(enemy=>!enemy.boss)!;
    expect(rat.maxHp).toBe(28*11.25);expect(rat.speed).toBeCloseTo(.38*1.012);expect(rat.armor).toBeCloseTo(.009);
    expect(e.currentWaveTargetCount()).toBe(29);e.skipWave();
    expect(e.state.enemies.find(enemy=>enemy.boss)!.maxHp).toBe(700*hp(2));
  });
  it('preserves fractional spawn intervals instead of rounding every spawn up to a fixed step',()=>{
    const e=endless({progressionStars:0});
    // First spawn at 1s, then 28 intervals of 1.104s: all 29 arrive by 31.912s.
    for(let i=0;i<639;i++){e.tick(.05);e.state.enemies=[];}
    expect(e.state.waveTime).toBeCloseTo(31.95);expect(e.state.wave).toBe(11);expect(e.state.spawned).toBe(29);
  });
  it('applies endless pressure to default direct spawns without scaling explicit HP multipliers twice',()=>{
    const e=endless({progressionStars:0});
    expect(e.spawnEnemy('rat','player').maxHp).toBe(315);
    expect(e.spawnEnemy('rat','player',11.25).maxHp).toBe(315);
  });
  it('saturates only the unreachable numeric extreme instead of generating infinite health',()=>{
    expect(waves.getWaveConfig(10000).hpScale).toBe(Number.MAX_SAFE_INTEGER);
    const e=endless({rankIndex:53});e.state.wave=10000;
    const boss=e.spawnEnemy('husky_wrecker','player');
    expect(Number.isFinite(boss.hp)).toBe(true);expect(Number.isFinite(boss.maxHp)).toBe(true);
    expect(e.getUpcomingWavePreview()).toMatchObject({wave:10001,count:56});
  });
  it.each([['hornet_queen','killer_bee',3,1],['trash_coon','rat',3,1.3]] as const)('scales %s children once with the current wave', (bossKind,childKind,count,hpFactor)=>{
    const e=endless();e.state.enemies=[];e.spawnBoss(bossKind);
    e.state.enemies[0].abilityCooldown=.01;e.tick(.05);
    const children=e.state.enemies.filter(enemy=>enemy.kind===childKind);
    expect(children).toHaveLength(count);
    for(const child of children){
      expect(child.maxHp).toBeCloseTo(ENEMIES[childKind].hp*11.25*hpFactor);
      expect(child.speed).toBeCloseTo(ENEMIES[childKind].speed*1.012);
      expect(child.armor).toBeCloseTo(ENEMIES[childKind].armor+.009);
    }
  });
});

describe('P13 standard victory continuation',()=>{
  it('keeps legacy ten-wave completion and only enters from an intact standard waves victory',()=>{
    const e=standardWinner();expect(e.state.wave).toBe(10);expect(e.state.endless).not.toBe(true);
    const result=e.state.result;e.tick(10);expect(e.state.result).toBe(result);
    expect(e).toHaveProperty('enterEndless');expect(e.enterEndless().ok).toBe(true);
    const snapshot=JSON.stringify(e.state);expect(e.enterEndless().ok).toBe(false);expect(JSON.stringify(e.state)).toBe(snapshot);
    for(const mode of ['ready','playing','surrender','loss','no-oranges'] as const){
      const other=mode==='no-oranges'?standardWinner():new BattleEngine();
      if(mode!=='ready'&&mode!=='no-oranges')other.start();
      if(mode==='surrender')other.surrender();if(mode==='loss')other.adjustOranges(-3);
      if(mode==='no-oranges')other.state.sides.player.oranges=0;
      expect(other.enterEndless().ok).toBe(false);
    }
  });
  it('preserves the board, resources and combat records while snapshotting the standard reward',()=>{
    const e=new BattleEngine({seed:41,progressionStars:0});e.start();
    const id=e.grant('hamster').unitId!,unit=e.state.units.find(u=>u.id===id)!;unit.location={zone:'board',col:2,row:1};
    const target=e.spawnEnemy('rat','player');e.hurt(target,28,unit,false,false,true);
    e.state.grid[1][0]='O';e.state.craterHits['3,2']=1;e.state.sides.player.loot.push('m02_slipper');
    e.state.traps.push({id:999,side:'player',col:0,row:0,charges:2,hitIds:[]});
    while(e.state.phase!=='finished')e.skipWave();
    const reward=e.state.result!,food=e.state.sides.player.food,oranges=e.state.sides.player.oranges,grid=e.state.grid;
    expect(e).toHaveProperty('enterEndless');expect(e.enterEndless().ok).toBe(true);
    expect(e.state).toMatchObject({phase:'playing',wave:11,endless:true,endlessCoins:0,endlessClearedWave:10,result:null});
    expect(e.state.grid).toBe(grid);expect(e.state.units[0]).toBe(unit);expect(e.state.traps).toHaveLength(1);
    expect(e.state.craterHits).toEqual({'3,2':1});expect(e.state.sides.player.food).toBe(food);expect(e.state.sides.player.oranges).toBe(oranges);
    expect(e.state.standardResult).toEqual(reward);expect(e.state.standardResult).not.toBe(reward);
    reward.loot.push('mutated');expect(e.state.standardResult!.loot).toEqual(['m02_slipper']);
    expect(()=>e.state.standardResult!.loot.push('mutated')).toThrow();
    expect(()=>{e.state.standardResult!.coins=0;}).toThrow();
    expect(()=>{e.state.standardResult!.mvp!.damage=0;}).toThrow();
    e.surrender();expect(e.state.result!.mvp).toMatchObject({kind:'hamster',damage:28,kills:1});
  });
  it('keeps previewed bosses deterministic, distinct when unlocked, and separate from summon RNG',()=>{
    const e=endless({rankIndex:53,progressionStars:20}),control=endless({rankIndex:53,progressionStars:20});
    const before=JSON.stringify(e.state),preview=e.getUpcomingWavePreview()!;
    expect(preview.wave).toBe(12);expect(preview.count).toBe(32);
    for(let i=0;i<20;i++)expect(e.getUpcomingWavePreview()).toEqual(preview);
    (preview.bosses as string[]).push('fake');expect(e.getUpcomingWavePreview()!.bosses).not.toContain('fake');
    expect(JSON.stringify(e.state)).toBe(before);
    while(e.state.wave<16){e.skipWave();control.skipWave();}
    const expected=e.getUpcomingWavePreview()!.bosses;e.skipWave();control.skipWave();e.tick(10.1);control.tick(10.1);
    const bosses=e.state.enemies.filter(enemy=>enemy.boss).map(enemy=>enemy.kind);
    expect(bosses).toEqual(expected);expect(new Set(bosses).size).toBe(3);
    e.summon();control.summon();expect(e.state.units.map(u=>u.kind)).toEqual(control.state.units.map(u=>u.kind));
    for(let i=0;i<8;i++)expect(e.rollWeaponFragment()).toBe(control.rollWeaponFragment());
  });
  it('keeps boss counts at locked progression tiers without leaking locked species',()=>{
    const e=endless({progressionStars:0});while(e.state.wave<16)e.skipWave();
    expect(e.getUpcomingWavePreview()!.bosses).toEqual(['husky_wrecker','husky_wrecker','husky_wrecker']);
    e.tick(10.1);expect(e.state.enemies.filter(enemy=>enemy.boss).map(enemy=>enemy.kind)).toEqual(['husky_wrecker','husky_wrecker','husky_wrecker']);
    expect(e.getUpcomingWavePreview()!.minion).toBe('roach');
  });
});

describe('P13 complete clears and honorable endings',()=>{
  it('waits for the delayed third boss and final minion, then grants one clear bonus and allows early advance',()=>{
    const e=endless({progressionStars:20});while(e.state.wave<16)e.skipWave();
    e.state.spawned=44;e.state.enemies=[];e.tick(9.9);e.state.enemies=[];
    expect(e.state.endlessCoins).toBe(0);expect(e.canCallEarlyWave().allowed).toBe(false);
    e.tick(.2);expect(e.state.enemies.filter(enemy=>enemy.boss)).toHaveLength(1);
    e.state.enemies=[];const last=e.spawnEnemy('rat','player');last.speed=0;
    e.tick(.05);expect(e.state.endlessCoins).toBe(0);expect(e.canCallEarlyWave().allowed).toBe(false);
    e.hurt(last,1e9,undefined,false,false,true);e.tick(.05);
    expect(e.state.endlessCoins).toBe(90);expect(e.state.endlessClearedWave).toBe(16);
    e.tick(.5);expect(e.state.endlessCoins).toBe(90);
    expect(e.canCallEarlyWave().allowed).toBe(true);expect(e.callEarlyWave().ok).toBe(true);
    expect(e.state.wave).toBe(17);expect(e.state.endlessCoins).toBe(90);expect(e.callEarlyWave().ok).toBe(false);
  });
  it('does not advance after 36 seconds while the final live monster remains',()=>{
    const e=endless({progressionStars:0});e.state.spawned=29;e.state.waveTime=35.9;
    e.state.enemies[0].speed=0;e.tick(.3);expect(e.state.wave).toBe(11);expect(e.state.endlessCoins).toBe(0);
    e.hurt(e.state.enemies[0],1e9,undefined,false,false,true);e.tick(.05);
    expect(e.state.wave).toBe(12);expect(e.state.endlessCoins).toBe(15);
  });
  it.each(['oranges','surrender'] as const)('ends through %s as an honor win with only bonus loot and coins separated',reason=>{
    const e=standardWinner();e.state.sides.player.loot=['m02_slipper'];e.state.result!.loot=['m02_slipper'];e.state.result!.playerLoot=['m02_slipper'];
    expect(e).toHaveProperty('enterEndless');e.enterEndless();const standard=e.state.standardResult!;
    e.state.endlessCoins=45;e.state.sides.player.loot.push('m01_swatter');
    if(reason==='oranges')e.adjustOranges(-3);else {e.pause();e.surrender();}
    expect(e.state.result).toMatchObject({winner:'player',reason,endless:true,endlessWave:11,endlessCoins:45,endlessLoot:['m01_swatter'],coins:standard.coins+45,loot:['m02_slipper','m01_swatter']});
    const result=e.state.result;e.tick(30);e.surrender();expect(e.state.result).toBe(result);
  });
  it('keeps accelerated 3x stepping equivalent through scheduled spawns and a clear transition',()=>{
    const a=endless({progressionStars:0}),b=endless({progressionStars:0});
    a.tick(3);for(let i=0;i<60;i++)b.tick(.05);
    expect(a.state.spawned).toBe(b.state.spawned);expect(a.state.enemies.map(e=>[e.kind,e.hp,e.progress])).toEqual(b.state.enemies.map(e=>[e.kind,e.hp,e.progress]));
    for(const e of [a,b]){e.state.spawned=29;e.state.enemies=[];e.state.waveTime=35.8;}
    a.tick(.6);for(let i=0;i<12;i++)b.tick(.05);
    expect(a.state.wave).toBe(12);expect(b.state.wave).toBe(12);expect(a.state.endlessCoins).toBe(15);expect(b.state.endlessCoins).toBe(15);
    expect(a.state.waveTime).toBeCloseTo(b.state.waveTime,10);
  });
});

describe('P13 safe distinct endless receipts',()=>{
  it('migrates the coachmark and personal best safely, persists them, and replays only the coachmark',()=>{
    expect(createProfile()).toMatchObject({earlyWaveTipSeen:false,bestEndlessWave:0});
    expect(normalizeProfile({matches:10,wins:8})).toMatchObject({earlyWaveTipSeen:false,bestEndlessWave:0});
    for(const value of [null,-1,NaN,Infinity,'15',10,11.5])expect(normalizeProfile({earlyWaveTipSeen:value,bestEndlessWave:value})).toMatchObject({earlyWaveTipSeen:false,bestEndlessWave:0});
    const saved={...createProfile(),tutorialCompleted:true,tutorialRewardClaimed:true,earlyWaveTipSeen:true,bestEndlessWave:16};
    const db=memoryStorage();storage.saveProfile(saved,db);expect(storage.loadProfile(db)).toEqual(saved);
    expect(replayTutorial(saved)).toMatchObject({tutorialCompleted:false,tutorialRewardClaimed:true,earlyWaveTipSeen:false,bestEndlessWave:16});
  });
  it('pays only the extra reward once across save/reload without a second star, match, win or ticket',()=>{
    expect(storage).toHaveProperty('awardEndless');
    const banked=storage.awardBattle({...createProfile(),winStreak:2,bestWinStreak:2},'run',normal).profile;
    const bonus=storage.awardEndless(banked,'run',honor);
    expect(bonus.awarded).toBe(true);expect(bonus.profile).toMatchObject({coins:120,matches:1,wins:1,stars:2,winStreak:3,bestWinStreak:3,freeLotteryTickets:1,bestEndlessWave:13});
    expect(bonus.profile.awardedBattles).toEqual(['run','run:endless']);
    expect(bonus.profile.weaponFragments).toEqual({m02_slipper:1,m01_swatter:2});expect(bonus.profile.fragments).toEqual(['bamboo_blade']);
    expect(bonus.newWeapons).toEqual(['m01_swatter']);
    expect(bonus.profile.mergedHeroes).toContain('kungfu_po');expect(bonus.profile.unlockedAvatars).toContain('kungfu_panda');
    expect(banked.coins).toBe(75);expect(banked.mergedHeroes).not.toContain('kungfu_po');
    const db=memoryStorage();storage.saveProfile(bonus.profile,db);
    expect(storage.awardEndless(storage.loadProfile(db),'run',honor)).toMatchObject({profile:bonus.profile,awarded:false,newWeapons:[]});
    expect(storage.awardBattle(bonus.profile,'another-standard',honor)).toMatchObject({profile:bonus.profile,awarded:false});
  });
  it('requires the standard receipt and never consumes a receipt on malformed input',()=>{
    expect(storage).toHaveProperty('awardEndless');
    expect(storage.awardEndless(createProfile(),'run',honor).awarded).toBe(false);
    const p=storage.awardBattle(createProfile(),'run',normal).profile;
    const invalid:unknown[]=[null,{},normal,{...honor,winner:'ai'},{...honor,endlessWave:10},{...honor,endlessWave:Infinity},{...honor,endlessCoins:-1},{...honor,endlessCoins:1.1},{...honor,endlessCoins:NaN},{...honor,endlessLoot:null},{...honor,endlessLoot:[12]}];
    for(const result of invalid){const award=storage.awardEndless(p,'run',result as BattleResult);expect(award.awarded).toBe(false);expect(award.profile).toEqual(p);}
    for(const id of ['',null,1,'missing'] as unknown[])expect(storage.awardEndless(p,id as string,honor).awarded).toBe(false);
    expect(()=>storage.awardEndless(null as unknown as Profile,'run',honor)).not.toThrow();
    expect(storage.awardEndless({...p,coins:Number.MAX_SAFE_INTEGER},'run',honor).awarded).toBe(false);
    expect(storage.awardEndless(p,'run',honor).awarded).toBe(true);
  });
  it('keeps an earlier personal best and permits a retry after a failed write without duplicate bonus',()=>{
    expect(storage).toHaveProperty('awardEndless');
    const p={...storage.awardBattle(createProfile(),'run',normal).profile,bestEndlessWave:20},db=memoryStorage();storage.saveProfile(p,db);
    const blocked={...db,setItem(){throw Error('quota');}} as Storage;
    const attempt=storage.awardEndless(p,'run',honor);expect(storage.saveProfile(attempt.profile,blocked)).toBe(false);
    expect(storage.loadProfile(db)).toEqual(p);
    const retried=storage.awardEndless(storage.loadProfile(db),'run',honor);expect(retried.profile.coins).toBe(120);expect(retried.profile.bestEndlessWave).toBe(20);
    expect(storage.saveProfile(retried.profile,db)).toBe(true);expect(storage.awardEndless(storage.loadProfile(db),'run',honor).awarded).toBe(false);
  });
});
