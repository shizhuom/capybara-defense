import {describe,it,expect,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import * as AI from '../src/core/OpponentAI';
import {createProfile,normalizeProfile,unlockAllProfile} from '../src/core/MetaProgression';
import {updateSettings} from '../src/core/PlayerProgression';
import {WEAPONS,HERO_FAMILIES} from '../src/config/weapons';
import {PROPS} from '../src/config/props';
import {RECIPES} from '../src/config/recipes';
import {MAP_IDS,getMap} from '../src/config/maps';
import {GridSystem} from '../src/core/GridSystem';
import {Random} from '../src/core/Random';
import {enableTestProfile,restoreNormalProfile,saveProfile} from '../src/ui/storage';
import type {Unit} from '../src/core/types';

const arena=(rankIndex=0,ai=false)=>{const e=new BattleEngine({rankIndex,ai,seed:49,autoWaves:false});e.start();return e;};
function pet(e:BattleEngine,kind:string,side:'player'|'ai'='player'):Unit {const id=e.grant(kind,side).unitId!;return e.state.units.find(u=>u.id===id)!;}
const setup=(rank:number,random=()=>.4)=>{expect(AI).toHaveProperty('createOpponentSetup');return AI.createOpponentSetup(rank,random);};
const tuning=async(rank:number)=>(await import('../src/config/opponents')).getOpponentTuning(rank);
const targets=async(e:BattleEngine,id:number)=>(await import('../src/core/MergeTargets')).getMergeTargets(e.state,id);

describe('P1 opponent tier contracts',()=>{
  it.each([[0,1.65,3.5,0],[5,1.65,3.5,0],[6,1.3,2,2],[14,1.3,2,2],[15,1,1,4],[29,1,1,4],[30,.82,.5,6],[44,.82,.5,6],[45,.68,.3,12],[53,.68,.3,12]])('scales exact rank %i boundary',async(rank,interval,openingDelay,count)=>{
    expect(await tuning(rank)).toMatchObject({rankIndex:rank,interval,openingDelay,counterMerges:rank>=45});
    const s=setup(rank);expect(Object.keys(s.loadout.equippedWeapons)).toHaveLength(count);
    const ids=Object.values(s.loadout.equippedWeapons);expect(new Set(ids).size).toBe(ids.length);
    for(const [hero,id] of Object.entries(s.loadout.equippedWeapons))expect(WEAPONS[id].family).toBe(HERO_FAMILIES[hero]);
    const rarities=ids.map(id=>WEAPONS[id].rarity);
    if(rank>=45)for(const [hero,id] of Object.entries(s.loadout.equippedWeapons))expect(WEAPONS[id].signatureHero).toBe(hero);
    else if(rank>=30){expect(rarities.filter(r=>r===4)).toHaveLength(2);expect(rarities.every(r=>r>=3)).toBe(true);}
    else if(rank>=15)expect(rarities.every(r=>r===3)).toBe(true);
    else expect(rarities.every(r=>r===1||r===2)).toBe(true);
    const passive=s.loadout.equippedPassiveProps;
    expect(passive.length).toBeGreaterThanOrEqual(rank<6?0:rank<15?1:rank<30?2:rank<45?4:5);
    expect(passive.length).toBeLessThanOrEqual(rank<6?0:rank<15?1:rank<30?3:rank<45?4:6);
    for(const id of [...passive,...s.loadout.equippedActiveProps])expect(s.loadout.ownedProps[id]).toBeGreaterThan(0);
    for(const id of passive){expect(PROPS[id].type).toBe('passive');expect(['shared_oranges','hyper_party','expired_can']).not.toContain(id);}
    expect(s.loadout.equippedActiveProps.length).toBe(rank<15?0:rank<30?1:2);
    if(rank>=30)expect(s.loadout.equippedActiveProps).toEqual(['milk_bottle','catnip']);
    expect(s.identity.name.en.length).toBeGreaterThan(2);expect(s.identity.name['zh-CN']).toMatch(/[\u4e00-\u9fff]/);expect(Math.abs(s.identity.rankIndex-rank)).toBeLessThanOrEqual(2);
  });
  it('clamps malformed rank and creates isolated setups',async()=>{
    expect((await tuning(NaN)).rankIndex).toBe(0);expect((await tuning(-3)).rankIndex).toBe(0);expect((await tuning(999)).rankIndex).toBe(53);
    const a=setup(35),b=setup(35);a.loadout.equippedActiveProps.pop();expect(b.loadout.equippedActiveProps).toHaveLength(2);
  });
  it('keeps every rank legal across seeded and extreme setup samples',()=>{
    for(let rank=0;rank<=53;rank++)for(let seed=0;seed<10;seed++){
      const random=new Random(seed),s=setup(rank,()=>random.next()),weapons=Object.values(s.loadout.equippedWeapons);
      expect(weapons).toHaveLength(rank<6?0:rank<15?2:rank<30?4:rank<45?6:12);
      expect(new Set(weapons).size).toBe(weapons.length);
      for(const [hero,id] of Object.entries(s.loadout.equippedWeapons))expect(HERO_FAMILIES[hero]).toBe(WEAPONS[id].family);
      expect(s.loadout.equippedPassiveProps).not.toContain('shared_oranges');expect(s.loadout.equippedPassiveProps).not.toContain('hyper_party');
      expect(Math.abs(s.identity.rankIndex-rank)).toBeLessThanOrEqual(2);
    }
    for(const value of [0,1,NaN,Infinity,-1])expect(Object.keys(setup(35,()=>value).loadout.equippedWeapons)).toHaveLength(6);
  });
  it('uses each configured decision interval and independent engine clocks',async()=>{
    for(const rank of [0,6,15,35,50]){
      const t=await tuning(rank),a=arena(rank,true),b=arena(rank,true),u=pet(a,'hamster','ai');
      const calls=vi.spyOn(a,'move');a.tick(t.openingDelay+.001);expect(calls).toHaveBeenCalledTimes(1);expect(u.location.zone).toBe('board');expect(b.state.units).toHaveLength(0);
      pet(a,'squirrel','ai');a.tick(t.interval-.1);expect(calls).toHaveBeenCalledTimes(1);a.tick(.15);expect(calls).toHaveBeenCalledTimes(2);
    }
  });
  it.each([0,6,15,35,50])('waits for rank %i opening before ordinary actions',async rank=>{
    const e=arena(rank,true),delay=(await tuning(rank)).openingDelay;
    e.tick(delay-.05);expect(e.state.units).toHaveLength(0);expect(e.state.sides.ai.food).toBeGreaterThanOrEqual(30);
    e.tick(.1);expect(e.state.units.filter(u=>u.side==='ai')).toHaveLength(5);
  });
  it('keeps setup away from disabled AI and combat RNG; honors explicit loadout and tuning overrides',()=>{
    const off=arena(50),on=arena(50,true);expect(off.state.sides.ai.loadout.equippedWeapons).toEqual({});
    off.summon();on.summon();expect(off.state.units.map(u=>u.kind)).toEqual(on.state.units.map(u=>u.kind));expect(on.state.opponent).toBeDefined();
    const custom=new BattleEngine({seed:49,rankIndex:50,autoWaves:false,loadouts:{ai:{}},aiOverrides:{openingDelay:4,interval:3}});custom.start();custom.tick(3.9);
    expect(custom.state.sides.ai.loadout.equippedWeapons).toEqual({});expect(custom.state.units).toHaveLength(0);custom.tick(.2);expect(custom.state.units).toHaveLength(5);
  });
});

describe('P1 actual legal AI tactics',()=>{
  it('moderate rank holds its single bottle until a crisis and pays its normal cooldown',()=>{
    const e=new BattleEngine({rankIndex:20,seed:5,autoWaves:false,loadouts:{ai:{ownedProps:{milk_bottle:1},equippedActiveProps:['milk_bottle']}}});e.start();
    const hero=pet(e,'kungfu_po','ai');hero.statuses={WET:18};e.tick(1.1);expect(hero.level).toBe(1);expect(hero.statuses.WET).toBeGreaterThan(0);
    e.state.sides.ai.oranges=2;e.tick(.1);expect(hero.level).toBe(2);expect(e.state.sides.ai.propCooldowns.milk_bottle).toBeGreaterThan(49);
  });
  it('does not spend unavailable food or shovels and can legally redraw a blocked pack',()=>{
    const e=arena(0,true);e.state.sides.ai.food=0;e.state.sides.ai.shovels=0;e.tick(8);expect(e.state.units).toHaveLength(0);expect(e.state.sides.ai.food).toBe(0);
    // Five incompatible loose parts on a board with no open or grass tile force a paid redraw.
    for(let row=0;row<5;row++)for(let col=0;col<8;col++)if(['O','G'].includes(e.state.grid[row][col]))e.state.grid[row][col]='B';
    for(const kind of ['hat_bamboo','hat_shades','hat_wizard','cleaver','basketball'])pet(e,kind,'ai');
    const ids=e.state.units.map(u=>u.id);e.state.sides.ai.food=10;e.tick(1.7);expect(e.state.sides.ai.food).toBe(0);expect(e.state.units).toHaveLength(5);expect(e.state.units.every(u=>!ids.includes(u.id))).toBe(true);
  });
  it('uses the bottle on the strongest eligible controlled hero after reaction delay and respects cooldown',()=>{
    const e=arena(35,true),weak=pet(e,'hamster','ai'),hero=pet(e,'kungfu_po','ai');hero.level=3;hero.statuses={SEALED:18,WET:18};weak.statuses={SEALED:18};
    e.tick(1.1);expect(hero.level).toBe(3);expect(hero.statuses.SEALED).toBeGreaterThan(0);
    e.tick(1.4);expect(hero.level).toBe(4);expect(hero.statuses).toEqual({});expect(e.state.sides.ai.propCooldowns.milk_bottle).toBeGreaterThan(47);
    hero.statuses={SEALED:18};e.tick(1);expect(hero.level).toBe(4);
  });
  it('does not bypass the sealed reaction delay by immediately feeding a matching part',()=>{
    const e=arena(35,true),hero=pet(e,'kungfu_po','ai');hero.level=2;hero.statuses={SEALED:18};pet(e,'panda','ai');
    e.tick(1.1);expect(e.state.units.find(u=>u.kind==='kungfu_po')?.statuses.SEALED).toBeGreaterThan(0);
    e.tick(1.4);expect(e.state.units.find(u=>u.kind==='kungfu_po')?.statuses.SEALED).toBeUndefined();
  });
  it('uses a finite one-use sprinkler to clear seals when bottle is unavailable, retaining other statuses and sides',()=>{
    const e=arena(35,true),hero=pet(e,'kungfu_po','ai'),other=pet(e,'hamster');hero.level=5;hero.statuses={SEALED:18,WET:18};other.statuses={SEALED:18};
    e.tick(1.1);expect(e.state.sides.ai.sprinklerUsed).toBe(false);e.tick(1.4);
    expect(e.state.sides.ai.sprinklerUsed).toBe(true);expect(hero.statuses.SEALED).toBeUndefined();expect(hero.statuses.WET).toBeGreaterThan(0);expect(other.statuses.SEALED).toBeGreaterThan(0);
    expect(e.state.events.some(v=>v.type==='purge'&&v.effect==='sprinkler')).toBe(true);expect(e.useSprinkler('ai').ok).toBe(false);
  });
  it('uses legal catnip only in crisis and cannot bypass cooldowns',()=>{
    const e=arena(35,true);e.tick(1);expect(e.state.sides.ai.catnipTime).toBe(0);
    e.state.sides.ai.oranges=2;e.tick(.1);expect(e.state.sides.ai.catnipTime).toBeGreaterThan(7);expect(e.state.sides.ai.propCooldowns.catnip).toBeGreaterThan(54);
    e.tick(9);expect(e.state.sides.ai.catnipTime).toBe(0);expect(e.state.sides.ai.propCooldowns.catnip).toBeGreaterThan(40);
  });
  it('prioritizes recipes over an earlier basic upgrade',()=>{
    const e=arena(0,true);pet(e,'hamster','ai');pet(e,'hamster','ai');pet(e,'panda','ai');pet(e,'hat_bamboo','ai');e.tick(3.6);
    expect(e.state.units.some(u=>u.kind==='kungfu_po')).toBe(true);expect(e.state.units.filter(u=>u.kind==='hamster')).toHaveLength(2);
  });
  it('high rank prioritizes a ranged counter against the swallowing boss',()=>{
    const e=arena(50,true);for(const k of ['panda','hat_bamboo','cat','hat_shades'])pet(e,k,'ai');e.spawnEnemy('mega_roomba','ai');e.tick(.4);
    expect(e.state.units.some(u=>u.kind==='meowfia'||u.kind==='bamboo_mafia')).toBe(true);
  });
  it.each(MAP_IDS)('uses map-aware melee inner coverage, ranged safety and bee distance on %s',mapId=>{
    function placed(kind:string){const e=new BattleEngine({mapId,rankIndex:0,seed:2,autoWaves:false});e.start();const u=pet(e,kind,'ai');e.tick(3.6);return u.location;}
    const melee=placed('kungfu_po'),ranged=placed('meowfia'),bee=placed('bee');for(const p of [melee,ranged,bee])expect(p.zone).toBe('board');
    if(melee.zone!=='board'||ranged.zone!=='board'||bee.zone!=='board')return;
    const path=getMap(mapId).paths.ai,dist=(p:{col:number;row:number})=>Math.min(...path.map(q=>GridSystem.distance(p,q)));
    expect(dist(bee)).toBeGreaterThanOrEqual(dist(melee));expect(dist(ranged)).toBeGreaterThanOrEqual(dist(melee));
    const nearby=path.filter(q=>GridSystem.distance(melee,q)<=1.5);expect(nearby.length).toBeGreaterThanOrEqual(3);
  });
  it('sprinkler purge preserves damage, knockback and slow; treasure and boss events have audio effects',()=>{
    const e=arena(),u=pet(e,'hamster');u.statuses={SEALED:10,CONFUSED:5};const m=e.spawnEnemy('rat','player');m.hp=m.maxHp=500;m.progress=10;
    expect(e.useSprinkler().ok).toBe(true);expect(m.hp).toBe(380);expect(m.progress).toBe(5.5);expect(m.slow).toBe(2);expect(u.statuses).toEqual({CONFUSED:5});
    e.spawnEnemy('husky_wrecker','player');expect(e.state.events.some(v=>v.type==='bubble'&&v.effect==='boss_spawn')).toBe(true);
  });
});

describe('P1 merge target queries',()=>{
  it('finds upgrades and excludes swaps, mismatched levels, maxed, locked, washing, self and opponent without mutation',async()=>{
    const e=arena(),source=pet(e,'hamster'),match=pet(e,'hamster'),swap=pet(e,'squirrel'),locked=pet(e,'hamster'),washed=pet(e,'hamster');
    locked.statuses.MERGE_LOCK=3;washed.washing=3;pet(e,'hamster','ai');const before=JSON.stringify(e.state);
    expect(await targets(e,source.id)).toEqual([{unitId:match.id,kind:'upgrade'}]);expect(JSON.stringify(e.state)).toBe(before);
    match.level=2;expect(await targets(e,source.id)).toEqual([]);match.level=source.level=5;expect(await targets(e,source.id)).toEqual([]);
    source.washing=1;expect(await targets(e,source.id)).toEqual([]);expect(await targets(e,999)).toEqual([]);expect(swap.kind).toBe('squirrel');
  });
  it.each(RECIPES)('recognizes both directions and feeding for $hero',async recipe=>{
    const e=arena(),a=pet(e,recipe.parts[0]),b=pet(e,recipe.parts[1]);
    expect(await targets(e,a.id)).toEqual([{unitId:b.id,kind:'hero',heroId:recipe.hero}]);expect(await targets(e,b.id)).toEqual([{unitId:a.id,kind:'hero',heroId:recipe.hero}]);
    b.kind=recipe.hero;expect(await targets(e,a.id)).toEqual([{unitId:b.id,kind:'hero',heroId:recipe.hero}]);expect(await targets(e,b.id)).toEqual([{unitId:a.id,kind:'hero',heroId:recipe.hero}]);
    b.level=5;expect(await targets(e,a.id)).toEqual([]);expect(await targets(e,b.id)).toEqual([]);
  });
});

describe('P1 tutorial and migrations',()=>{
  it('advances ordered real actions, skip and done idempotently',async()=>{
    const m=await import('../src/core/Tutorial');
    expect(m.advanceTutorial(1,'deploy')).toBe(1);expect(m.advanceTutorial(1,'summon')).toBe(2);expect(m.advanceTutorial(2,'merge')).toBe(2);
    for(const a of ['deploy','dig'] as const)expect(m.advanceTutorial(2,a)).toBe(3);
    for(const a of ['merge','acknowledge'] as const)expect(m.advanceTutorial(3,a)).toBe('done');
    for(const step of [1,2,3,'done'] as const){expect(m.advanceTutorial(step,'skip')).toBe('done');expect(m.advanceTutorial('done','summon')).toBe('done');}
  });
  it('awards twenty once on completion including replay after skip, without mutating input',async()=>{
    const m=await import('../src/core/Tutorial'),p=createProfile(),before=JSON.stringify(p),done=m.finishTutorial(p,true);
    expect(done).toMatchObject({awarded:true,profile:{coins:20,tutorialCompleted:true,tutorialRewardClaimed:true}});expect(JSON.stringify(p)).toBe(before);
    expect(m.finishTutorial(done.profile,true).awarded).toBe(false);expect(m.finishTutorial(m.replayTutorial(done.profile),true).profile.coins).toBe(20);
    const skip=m.finishTutorial(p,false);expect(skip).toMatchObject({awarded:false,profile:{coins:0,tutorialCompleted:true,tutorialRewardClaimed:false}});
    const firstReplay=m.finishTutorial(m.replayTutorial(skip.profile),true);expect(firstReplay).toMatchObject({awarded:true,profile:{coins:20,tutorialRewardClaimed:true}});
    expect(m.finishTutorial(m.replayTutorial(firstReplay.profile),true)).toMatchObject({awarded:false,profile:{coins:20,tutorialRewardClaimed:true}});
    // Explicit unclaimed evidence governs awards even for a completed pre-P1 caller.
    expect(m.finishTutorial({...p,tutorialCompleted:true,tutorialRewardClaimed:false},true).awarded).toBe(true);
  });
  it('normalizes defaults, legacy coins/wins/settings and explicit replay false',()=>{
    expect(createProfile()).toMatchObject({tutorialCompleted:false,tutorialRewardClaimed:false,settings:{developerMode:false}});
    const old=normalizeProfile({matches:7,wins:3,coins:91,settings:{soundVolume:0}});expect(old).toMatchObject({matches:7,wins:3,coins:91,tutorialCompleted:true,tutorialRewardClaimed:true,settings:{soundVolume:0,developerMode:false}});
    expect(normalizeProfile({...old,tutorialCompleted:false})).toMatchObject({tutorialCompleted:false,tutorialRewardClaimed:true});
    expect(updateSettings(createProfile(),{developerMode:true}).settings.developerMode).toBe(true);expect(updateSettings(createProfile(),{developerMode:'bad' as never}).settings.developerMode).toBe(false);
  });
  it('full test profile marks tutorial done/claimed and restores the ordinary backup through existing APIs',()=>{
    const data=new Map<string,string>();const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}} as Storage;
    const normal={...createProfile(),coins:37};saveProfile(normal,storage);expect(enableTestProfile(storage)).toMatchObject({tutorialCompleted:true,tutorialRewardClaimed:true});
    expect(restoreNormalProfile(storage)).toEqual(normal);expect(unlockAllProfile(normal)).toMatchObject({tutorialCompleted:true,tutorialRewardClaimed:true});
  });
});
