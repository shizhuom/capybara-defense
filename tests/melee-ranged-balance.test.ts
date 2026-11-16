import {describe,expect,it} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {GridSystem} from '../src/core/GridSystem';
import {HEROES} from '../src/config/heroes';
import {getBaseUnitStats} from '../src/core/UnitStats';
import {combatant,dummyDps,signatureLoadout} from './helpers/combat-benchmark';

describe('melee / ranged role balance',()=>{
  it.each([1,3,5])('short range heroes have a meaningful plain-attack advantage at Lv.%i',level=>{
    const melee=['kungfu_po','puss_in_hat','samurai_doge','ronin_goose'].map(id=>getBaseUnitStats(id,level));
    const ranged=['bamboo_mafia','meowfia','doge_wick','rocket_coon'].map(id=>getBaseUnitStats(id,level));
    const maxRanged=Math.max(...ranged.map(s=>s.damage*s.rate));
    for(const stats of melee){expect(stats.damage*stats.rate).toBeGreaterThan(maxRanged*1.2);expect(stats.range).toBeLessThanOrEqual(2);}
    expect(Math.min(...ranged.map(s=>s.range))).toBeGreaterThanOrEqual(3);
  });
  it('basic melee compensate for coverage without removing ranged roles',()=>{
    const hamster=getBaseUnitStats('hamster',1),corgi=getBaseUnitStats('corgi',1),squirrel=getBaseUnitStats('squirrel',1);
    expect(hamster.damage*hamster.rate).toBeGreaterThanOrEqual(squirrel.damage*squirrel.rate*1.7);
    expect(corgi.damage*corgi.rate).toBeGreaterThanOrEqual(squirrel.damage*squirrel.rate*1.45);
    expect(corgi.range).toBeLessThan(squirrel.range);expect(hamster.range).toBeLessThan(squirrel.range);
  });
});

describe('Meowfia burst has a recharge phase',()=>{
  it.each([false,true])('cannot recharge or refresh its own burst (signature=%s)',signature=>{
    const e=new BattleEngine({seed:9,autoWaves:false,loadouts:{player:signature?signatureLoadout('meowfia'):{}}});e.start();
    const unit=combatant(e,'meowfia'),enemy=e.spawnEnemy('rat','player');
    enemy.progress=2;Object.assign(enemy,GridSystem.pathPosition('player',2));enemy.speed=0;enemy.hp=enemy.maxHp=1e8;
    unit.energy=HEROES.meowfia.charge-1;e.tick(.01);
    const duration=signature?4:2.5;
    expect(unit.buffTime).toBeCloseTo(duration);expect(unit.energy).toBe(0);
    const before=enemy.hp;e.tick(1);
    expect(before-enemy.hp).toBeGreaterThan(180);expect(unit.energy).toBe(0);
    e.tick(duration-1+.02);expect(unit.buffTime).toBe(0);expect(unit.energy).toBeLessThan(2);
    e.tick(5);expect(unit.buffTime).toBeGreaterThan(0);
  });
  it.each([1,3,5])('burst ends at high levels even with signature and attack-speed passive, Lv.%i',level=>{
    const loadout={...signatureLoadout('meowfia'),ownedProps:{hyper_party:1},equippedPassiveProps:['hyper_party']};
    const result=dummyDps('meowfia',{level,seconds:45,loadout});
    expect(result.maxConsecutiveBuff).toBeLessThanOrEqual(4.05);
    expect(result.buffUptime).toBeLessThan(.8);
    expect(result.buffUptime).toBeGreaterThan(.4);
  });
  it('retains a strong burst but not permanent four-times normal DPS',()=>{
    const result=dummyDps('meowfia'),normal=HEROES.meowfia.damage*HEROES.meowfia.rate;
    expect(result.dps).toBeGreaterThan(normal*1.7);expect(result.dps).toBeLessThan(normal*2.3);
  });
});
