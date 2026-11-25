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
});
describe('P2 retires actual opponent execution',()=>{
  it.each([0,6,15,35,50])('rank %i never constructs units or runs opponent commands',rank=>{
    const e=arena(rank,true),before=JSON.stringify(e.state.sides.ai);const calls=vi.spyOn(AI.OpponentAI.prototype,'tick');
    e.tick(60);expect(calls).not.toHaveBeenCalled();expect(e.state.units).toHaveLength(0);expect(JSON.stringify(e.state.sides.ai)).toBe(before);
    expect(e.grant('hamster','ai').ok).toBe(false);expect(e.summon('ai').ok).toBe(false);expect(e.useSprinkler('ai').ok).toBe(false);expect(e.useProp('catnip',{},'ai').ok).toBe(false);calls.mockRestore();
  });
  it('legacy tuning overrides and AI loadouts do not create an opponent or alter draw RNG',()=>{
    const off=arena(50),on=new BattleEngine({seed:49,rankIndex:50,autoWaves:false,ai:true,aiOverrides:{openingDelay:0},loadouts:{ai:{ownedProps:{shared_oranges:1},equippedPassiveProps:['shared_oranges']}}});
    on.start();off.summon();on.summon();expect(off.state.units.map(u=>u.kind)).toEqual(on.state.units.map(u=>u.kind));expect(on.state.opponent).toBeUndefined();expect(on.state.sides.ai.loadout.equippedPassiveProps).toEqual([]);
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
    locked.statuses.MERGE_LOCK=3;washed.washing=3;expect(e.grant('hamster','ai').ok).toBe(false);const before=JSON.stringify(e.state);
    expect(await targets(e,source.id)).toEqual([{unitId:match.id,kind:'upgrade',nextLevel:2}]);expect(JSON.stringify(e.state)).toBe(before);
    match.level=2;expect(await targets(e,source.id)).toEqual([]);match.level=source.level=5;expect(await targets(e,source.id)).toEqual([]);
    source.washing=1;expect(await targets(e,source.id)).toEqual([]);expect(await targets(e,999)).toEqual([]);expect(swap.kind).toBe('squirrel');
  });
  it.each(RECIPES)('recognizes both directions and feeding for $hero',async recipe=>{
    const e=arena(),a=pet(e,recipe.parts[0]),b=pet(e,recipe.parts[1]);
    expect(await targets(e,a.id)).toEqual([{unitId:b.id,kind:'hero',heroId:recipe.hero,nextLevel:1}]);expect(await targets(e,b.id)).toEqual([{unitId:a.id,kind:'hero',heroId:recipe.hero,nextLevel:1}]);
    b.kind=recipe.hero;expect(await targets(e,a.id)).toEqual([{unitId:b.id,kind:'hero',heroId:recipe.hero,nextLevel:2,feedHero:true}]);expect(await targets(e,b.id)).toEqual([{unitId:a.id,kind:'hero',heroId:recipe.hero,nextLevel:2,feedHero:true}]);
    b.level=5;expect(await targets(e,a.id)).toEqual([]);expect(await targets(e,b.id)).toEqual([]);
  });
});

describe('P1 tutorial and migrations',()=>{
  it('advances ordered real actions, skip and done idempotently',async()=>{
    const m=await import('../src/core/Tutorial');
    expect(m.advanceTutorial(1,'deploy')).toBe(1);expect(m.advanceTutorial(1,'summon')).toBe(2);expect(m.advanceTutorial(2,'merge')).toBe(2);
    expect(m.advanceTutorial(2,'dig')).toBe(3);expect(m.advanceTutorial(2,'acknowledge')).toBe(3);
    expect(m.advanceTutorial(3,'deploy')).toBe(4);
    for(const a of ['merge','acknowledge'] as const)expect(m.advanceTutorial(4,a)).toBe(5);
    for(const a of ['merge','acknowledge'] as const)expect(m.advanceTutorial(5,a)).toBe(6);
    for(const a of ['deploy-bee','deploy','acknowledge'] as const)expect(m.advanceTutorial(6,a)).toBe(7);
    for(const a of ['open-compendium','acknowledge'] as const)expect(m.advanceTutorial(7,a)).toBe('done');
    for(const step of [1,2,3,4,5,6,7,'done'] as const){expect(m.advanceTutorial(step,'skip')).toBe('done');expect(m.advanceTutorial('done','summon')).toBe('done');}
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
