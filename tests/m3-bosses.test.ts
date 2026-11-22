import {afterEach,describe,expect,it,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {GridSystem} from '../src/core/GridSystem';
import {Random} from '../src/core/Random';
import {ENEMIES,BOSS_IDS} from '../src/config/enemies';
import {MAP_IDS} from '../src/config/maps';
import {WEAPONS} from '../src/config/weapons';
import type {Enemy,Unit,MapId} from '../src/core/types';

afterEach(()=>vi.restoreAllMocks());
const bosses=[['diva_kitty',2070,.08,11],['buff_roo',2990,.12,10],['hornet_queen',2760,.08,11],['screaming_marmot',2300,.1,10],['trash_coon',3450,.12,11],['dj_rat_king',4140,.15,9]] as const;
function game(emp=false,rankIndex=0,mapId:MapId='sunny_backyard'){
  const e=new BattleEngine({ai:false,autoWaves:false,rankIndex,mapId,loadouts:emp?{player:{ownedProps:{emp_jammer:1},equippedPassiveProps:['emp_jammer']}}:undefined});e.start();return e;
}
function put(e:BattleEngine,kind:string,col=2,row=1):Unit{
  const id=e.grant(kind).unitId!;expect(e.move(id,{zone:'board',col,row}).ok).toBe(true);const u=e.state.units.find(unit=>unit.id===id)!;u.cooldown=100;return u;
}
function boss(e:BattleEngine,kind:string):Enemy{
  expect(ENEMIES[kind],`definition for ${kind}`).toBeDefined();
  const m=e.spawnEnemy(kind,'player');m.progress=2;m.speed=0;Object.assign(m,GridSystem.pathPosition('player',2,e.state.mapId));return m;
}
function activate(e:BattleEngine,m:Enemy){m.abilityCooldown=0;e.tick(.05);}

describe('M3 complete boss roster and real mechanisms',()=>{
  for(const [id,hp,armor,interval] of bosses)it(`${id}: actual spawn stats, interval and EMP interception`,()=>{
    const e=game(true),m=boss(e,id);expect(m.hp).toBe(hp);expect(m.armor).toBe(armor);expect(m.abilityCooldown).toBe(interval);
    const u=put(e,'hamster');vi.spyOn(Random.prototype,'next').mockReturnValue(.1);activate(e,m);
    expect(m.hp).toBeCloseTo(hp*.92);expect(e.state.units).toContain(u);expect(u.statuses).toEqual({});
    expect(e.state.enemies).toHaveLength(1);expect(e.state.events.filter(event=>event.type==='boss_skill')).toHaveLength(0);
  });
  it('charms only the lowest-level eligible basic pet; heroes, components and level 2 bees survive',()=>{
    const e=game();const strong=put(e,'hamster');strong.level=3;
    const hero=put(e,'kungfu_po',6,1),component=put(e,'panda',3,2),bee=put(e,'bee',5,2);bee.level=2;
    const victim=put(e,'squirrel',2,3),m=boss(e,'diva_kitty');activate(e,m);
    expect(e.state.units).not.toContain(victim);for(const u of [strong,hero,component,bee])expect(e.state.units).toContain(u);
    const rat=e.state.enemies.find(enemy=>enemy.kind==='charmed_rat')!;expect(rat).toMatchObject({hp:45,maxHp:45,speed:.58,progress:2,col:1,row:1});
    expect(e.state.events.some(event=>event.type==='boss_skill'&&event.effect==='diva_kitty')).toBe(true);
  });
  it('can charm a level-one bee, and no eligible unit means no free charmed rat',()=>{
    const e=game(),bee=put(e,'bee'),m=boss(e,'diva_kitty');activate(e,m);expect(e.state.units).not.toContain(bee);
    const count=e.state.enemies.length;activate(e,m);expect(e.state.enemies).toHaveLength(count);
  });
  for(const [kind,status,duration] of [['buff_roo','KNOCKDOWN',9],['screaming_marmot','CONFUSED',6.5]] as const){
    it(`${kind}: affects at most two nearby units, stops fire and feeding immediately purges`,()=>{
      const e=game(),hero=put(e,'kungfu_po'),a=put(e,'hamster',2,3),b=put(e,'squirrel',3,2),far=put(e,'corgi',6,3),m=boss(e,kind);
      m.progress=3;Object.assign(m,GridSystem.pathPosition('player',3));activate(e,m);const afflicted=[hero,a,b].filter(u=>u.statuses[status]);expect(afflicted).toHaveLength(2);expect(hero.statuses[status]).toBe(duration);expect(far.statuses).toEqual({});
      const hp=m.hp;hero.cooldown=0;e.tick(.2);expect(m.hp).toBe(hp);
      const feed=e.grant('panda').unitId!;expect(e.move(feed,hero.location).ok).toBe(true);
      const upgraded=e.state.units.find(u=>u.kind==='kungfu_po')!;expect(upgraded.level).toBe(2);expect(upgraded.statuses).toEqual({});
      e.tick(.05);expect(m.hp).toBeLessThan(hp);
    });
  }
  it('hornet queen spawns three fast bees at exact forward offsets and they can cost oranges',()=>{
    const e=game(),m=boss(e,'hornet_queen');activate(e,m);
    const bees=e.state.enemies.filter(enemy=>enemy.kind==='killer_bee');expect(bees).toHaveLength(3);
    expect(bees.map(bee=>bee.progress)).toEqual([2.3,2.6,2.9]);for(const bee of bees)expect(bee).toMatchObject({hp:36,speed:.62,armor:0,boss:false});
    const lives=e.state.sides.player.oranges;bees[0].progress=19.99;e.tick(.05);expect(e.state.sides.player.oranges).toBe(lives-1);
  });
  it('trash necromancer summons three bone-marked rats scaled by the current wave, without reusing deaths as bosses',()=>{
    const e=game();e.state.wave=4;const m=boss(e,'trash_coon');activate(e,m);
    const rats=e.state.enemies.filter(enemy=>enemy.kind==='rat');expect(rats).toHaveLength(3);
    expect(rats.map(rat=>rat.progress)).toEqual([1.7,2,2.3]);
    for(const rat of rats){expect(rat.hp).toBeCloseTo(85.54);expect(rat.maxHp).toBeCloseTo(85.54);expect(rat.boneShield).toBe(true);expect(rat.boss).toBe(false);}
  });
  it('DJ heals its whole living lane by 12% without overflow and grants a non-stacking four-second 30% speed buff',()=>{
    const e=game(),m=boss(e,'dj_rat_king'),rat=e.spawnEnemy('rat','player'),other=e.spawnEnemy('rat','ai');
    m.hp=1000;rat.hp=10;rat.speed=.4;other.hp=10;other.speed=0;activate(e,m);
    expect(m.hp).toBeCloseTo(1496.8);expect(rat.hp).toBeCloseTo(13.36);expect(other.hp).toBe(10);expect(rat.hasteTime).toBeGreaterThan(3.9);
    const start=rat.progress;e.tick(1);expect(rat.progress-start).toBeCloseTo(.52);
    rat.hp=27;activate(e,m);expect(rat.hp).toBe(28);const repeat=rat.progress;e.tick(.5);expect(rat.progress-repeat).toBeCloseTo(.26);
    e.tick(4);const normal=rat.progress;e.tick(.5);expect(rat.progress-normal).toBeCloseTo(.2);
  });
  it('EMP failure branch still permits new boss skills and lethal backfire cannot summon after death',()=>{
    const e=game(true),m=boss(e,'hornet_queen');vi.spyOn(Random.prototype,'next').mockReturnValue(.9);activate(e,m);expect(e.state.enemies.filter(enemy=>enemy.kind==='killer_bee')).toHaveLength(3);
    const lethal=game(true),dead=boss(lethal,'hornet_queen');dead.hp=1;vi.mocked(Random.prototype.next).mockReturnValue(.1);activate(lethal,dead);
    expect(lethal.state.enemies).toHaveLength(0);expect(lethal.state.sides.player.loot.length).toBeGreaterThan(0);
  });
  it('spawned mobs near the end clamp to the final waypoint and still resolve at most once',()=>{
    const e=game(),m=boss(e,'hornet_queen');m.progress=19.9;Object.assign(m,GridSystem.pathPosition('player',19.9));activate(e,m);
    const bees=e.state.enemies.filter(enemy=>enemy.kind==='killer_bee');expect(bees.map(bee=>bee.progress)).toEqual([20,20,20]);
    e.state.sides.player.oranges=10;e.tick(.05);expect(e.state.sides.player.oranges).toBe(7);expect(e.state.enemies.filter(enemy=>enemy.kind==='killer_bee')).toHaveLength(0);
  });
  it('theme waves spawn bosses only at 4/6/8/9/10 and together expose all twelve',()=>{
    expect(BOSS_IDS).toHaveLength(12);const seen=new Set<string>();
    for(const mapId of MAP_IDS){const e=game(false,0,mapId);for(let wave=1;wave<=10;wave++){
      e.skipWave();const spawned=e.state.enemies.filter(enemy=>enemy.boss);expect(spawned.length).toBe([4,6,8,9,10].includes(wave)?1:0);spawned.forEach(enemy=>seen.add(enemy.kind));
    }}expect(seen).toEqual(new Set(BOSS_IDS));
  });
  it('rank snapshots scale all enemies and victory base coins while preserving food bonus',()=>{
    const low=game(),high=game(false,53);expect(low.spawnEnemy('rat','player').hp).toBe(28);expect(high.spawnEnemy('rat','player').hp).toBeCloseTo(173.6);
    expect(high.spawnEnemy('hornet_queen','player').hp).toBeCloseTo(17112);
    low.state.sides.player.food=17;high.state.sides.player.food=17;low.state.wave=10;high.state.wave=10;low.skipWave();high.skipWave();
    expect(low.state.result?.coins).toBe(68);expect(high.state.result?.coins).toBe(228);expect(high.state.result?.rankIndex).toBe(53);
  });
  it('high ranks shift real boss and treasure fragment rarity toward purple/orange',()=>{
    const e=game(false,50);expect(e.rollWeaponFragment).toBeTypeOf('function');
    const random=vi.spyOn(Random.prototype,'next').mockReturnValue(.65);const high=e.rollWeaponFragment();expect(WEAPONS[high].rarity).toBe(3);
    const low=game();const ordinary=low.rollWeaponFragment();expect(WEAPONS[ordinary].rarity).toBe(2);random.mockRestore();
  });
  it('records actual hero merges once for results, independently of later unit removal',()=>{
    const e=game();const p=e.grant('panda').unitId!,hat=e.grant('hat_bamboo').unitId!;const location=e.state.units.find(unit=>unit.id===p)!.location;
    e.move(hat,location);expect(e.state.mergedHeroes.player).toEqual(['kungfu_po']);expect(e.state.events.find(event=>event.type==='purge')?.effect).toBe('legendary');
    const feed=e.grant('panda').unitId!;e.move(feed,location);expect(e.state.mergedHeroes.player).toEqual(['kungfu_po']);
    e.state.units=[];e.surrender();expect(e.state.result?.mergedHeroes).toEqual(['kungfu_po']);expect(e.state.mergedHeroes.ai).toEqual([]);
  });
});

