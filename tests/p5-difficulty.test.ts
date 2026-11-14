import {describe,it,expect} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {RANKS,getRankDifficulty} from '../src/config/ranks';
import {WAVES,waveEnemyCount,minionForWave,bossesForWave} from '../src/config/waves';
import {ENEMIES} from '../src/config/enemies';

describe('P5 guided first pack and preparation hold',()=>{
  it('gives five fixed Lv.1 teaching pieces, even with promotion props, only on the first draw',()=>{
    const e=new BattleEngine({seed:51,tutorialGuided:true,loadouts:{player:{equippedPassiveProps:['promo_badge'],ownedProps:{promo_badge:3}}}});e.start();
    expect(e.summon().ok).toBe(true);
    expect(e.state.units.map(u=>[u.kind,u.level])).toEqual(['hamster','hamster','panda','hat_bamboo','squirrel'].map(k=>[k,1]));
    expect(e.state.sides.player.food).toBe(12);e.summon();
    expect(e.state.units.map(u=>u.kind)).not.toEqual(['hamster','hamster','panda','hat_bamboo','squirrel']);
  });
  it('keeps ordinary seeded draws unchanged when tutorialGuided is omitted or false',()=>{
    const a=new BattleEngine({seed:812}),b=new BattleEngine({seed:812,tutorialGuided:false});a.start();b.start();
    for(let i=0;i<2;i++){a.summon();b.summon();expect(a.state.units.map(u=>[u.kind,u.level])).toEqual(b.state.units.map(u=>[u.kind,u.level]));}
  });
  it('freezes both prep clocks while held, releases with at least eight seconds, and cannot freeze active waves',()=>{
    const e=new BattleEngine({tutorialGuided:true});e.start();e.tick(13);e.setTutorialHold(true);
    const time=e.state.waveTime;e.tick(60);expect(e.state.waveTime).toBe(time);expect(e.state.spawned).toBe(0);
    e.setTutorialHold(false);expect(e.state.nextSpawn).toBeGreaterThanOrEqual(8);e.tick(7.9);expect(e.state.spawned).toBe(0);
    e.tick(.2);expect(e.state.spawned).toBe(1);e.setTutorialHold(true);e.tick(3);expect(e.state.spawned).toBe(2);
  });
});

describe('P5 rank difficulty and complete wave scheduling',()=>{
  it.each([[0,1],[5,1.22],[10,1.52],[15,1.88],[20,2.3],[30,3.25],[40,4.4],[50,5.65],[53,6.2]])('rank %i matches its HP anchor', (rank,hp)=>{
    expect(getRankDifficulty(rank).hpMultiplier).toBe(hp);expect(RANKS[rank].hpMultiplier).toBe(hp);
  });
  it('increases all pressure dimensions and rewards, preserving exact count/interval formulas',()=>{
    const sample=[0,10,25,45,53];
    for(let i=1;i<sample.length;i++){
      const a=getRankDifficulty(sample[i-1]),b=getRankDifficulty(sample[i]);
      expect(b.hpMultiplier).toBeGreaterThan(a.hpMultiplier);expect(b.speedMultiplier).toBeGreaterThan(a.speedMultiplier);
      expect(waveEnemyCount(10,sample[i])).toBeGreaterThan(waveEnemyCount(10,sample[i-1]));
      expect(b.bossCooldownScale).toBeLessThan(a.bossCooldownScale);expect(RANKS[sample[i]].winCoins).toBeGreaterThan(RANKS[sample[i-1]].winCoins);
    }
    for(let r=0;r<54;r++){expect(getRankDifficulty(r).extraCount).toBe(Math.floor(r/4));expect(getRankDifficulty(r).intervalScale).toBeCloseTo(Math.max(.62,1-r*.007));}
    expect([RANKS[0].winCoins,RANKS[53].winCoins]).toEqual([60,220]);
    expect(getRankDifficulty(NaN)).toEqual(getRankDifficulty(0));expect(getRankDifficulty(99)).toEqual(getRankDifficulty(53));
    expect(getRankDifficulty(0,{tutorialGuided:true}).hpMultiplier).toBe(.85);expect(getRankDifficulty(10,{tutorialGuided:true}).hpMultiplier).toBe(1.52);
  });
  it('applies HP, speed, armored reduction and Boss cooldown to spawned enemies and subsequent casts',()=>{
    const e=new BattleEngine({rankIndex:53,autoWaves:false});e.start();const d=getRankDifficulty(53);
    const crab=e.spawnEnemy('crab','player'),rat=e.spawnEnemy('rat','player'),boss=e.spawnEnemy('buff_roo','player');
    expect(crab.hp).toBeCloseTo(ENEMIES.crab.hp*d.hpMultiplier);expect(crab.speed).toBeCloseTo(ENEMIES.crab.speed*d.speedMultiplier);
    expect(crab.armor).toBeCloseTo(ENEMIES.crab.armor+d.armorBonus);expect(rat.armor).toBe(0);
    expect(boss.abilityCooldown).toBeCloseTo(ENEMIES.buff_roo.interval*d.bossCooldownScale);boss.abilityCooldown=.01;e.tick(.05);
    expect(boss.abilityCooldown).toBeCloseTo(ENEMIES.buff_roo.interval*d.bossCooldownScale);
  });
  it('retains rank0 species and mixes early fast / armored / summoned minions at higher ranks',()=>{
    expect(Array.from({length:7},(_,i)=>minionForWave(1,i,0))).toEqual(Array(7).fill('rat'));
    const kinds=(wave:number,rank:number)=>Array.from({length:waveEnemyCount(wave,rank)},(_,i)=>minionForWave(wave,i,rank));
    expect(kinds(2,5)).toContain('roach');expect(kinds(1,15)).toContain('roach');expect(kinds(5,15)).toContain('killer_bee');expect(kinds(4,30)).toContain('charmed_rat');
  });
  it.each([[0,10,1],[15,10,2],[19,3,0],[20,3,1],[30,8,2],[44,6,1],[45,6,2],[45,9,2]])('rank%i wave%i schedules %i distinct bosses',(rank,wave,count)=>{
    const bosses=bossesForWave('sunny_backyard',rank,wave,()=>0);expect(bosses).toHaveLength(count);expect(new Set(bosses).size).toBe(count);
  });
  it('finishes all extra minions before leaving a long high-rank first wave',()=>{
    const e=new BattleEngine({rankIndex:53});e.start();const seen:number[]=[];
    while(e.state.wave===1){e.tick(.05);if(e.state.wave===1)seen.push(e.state.spawned);e.state.enemies=[];}
    expect(Math.max(...seen)).toBe(waveEnemyCount(1,53)-1); // final spawn and next-wave transition are atomic
    expect(e.state.time).toBeGreaterThan(46);
  });
  it('does not award wave10 before delayed second Boss AND dynamic minion count are exhausted',()=>{
    const e=new BattleEngine({rankIndex:53});e.start();for(let i=1;i<10;i++)e.skipWave();
    const first=e.state.enemies.find(m=>m.boss)!.kind;e.state.enemies=[];
    e.state.spawned=waveEnemyCount(10,53);e.tick(4.9);expect(e.state.result).toBeNull();
    e.tick(.2);expect(e.state.enemies.filter(m=>m.boss)).toHaveLength(1);expect(e.state.enemies[0].kind).not.toBe(first);
    e.state.enemies=[];e.state.spawned=WAVES[9].count;e.tick(.1);expect(e.state.result).toBeNull();
    e.state.enemies=[];e.state.spawned=waveEnemyCount(10,53);e.tick(.1);expect(e.state.result?.winner).toBe('player');
  });
});


