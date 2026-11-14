import {describe,it,expect} from 'vitest';
import * as maps from '../src/config/maps';
import {GridSystem} from '../src/core/GridSystem';
import {BattleEngine} from '../src/core/BattleEngine';
const fixtures = [
 {id:'sunny_backyard',rows:["SRGGRRRRG","GROGRGORG","GRGOROGRG","GROGRGORG","GRRRRGGRC"],route:[[0,0],[1,0],[1,1],[1,2],[1,3],[1,4],[2,4],[3,4],[4,4],[4,3],[4,2],[4,1],[4,0],[5,0],[6,0],[7,0],[7,1],[7,2],[7,3],[7,4],[8,4]]},
 {id:'sakura_onsen',rows:["GRRRRRRRS","GROGOGOGG","GRRRRRRRG","GGOGOGORG","CRRRRRRRG"],route:[[8,0],[7,0],[6,0],[5,0],[4,0],[3,0],[2,0],[1,0],[1,1],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[7,3],[7,4],[6,4],[5,4],[4,4],[3,4],[2,4],[1,4],[0,4]]},
 {id:'midnight_kitchen',rows:["RRRRRRGGG","ROGOGRGOG","RGRRRRGRC","RGROGOORG","SGRRRRRRG"],route:[[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[5,1],[5,2],[4,2],[3,2],[2,2],[2,3],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[7,3],[7,2],[8,2]]},
 {id:'cat_tower_maze',rows:["GGRRRRRGG","GORGOORGG","SRRGRRRGC","GOGORGOGR","GGGGRRRRR"],route:[[0,2],[1,2],[2,2],[2,1],[2,0],[3,0],[4,0],[5,0],[6,0],[6,1],[6,2],[5,2],[4,2],[4,3],[4,4],[5,4],[6,4],[7,4],[8,4],[8,3],[8,2]]},
] as const;
describe('M3 four precise solo arenas',()=>{
 for(const fixture of fixtures){
  it(`${fixture.id}: exact matrix, six pads and single entry/guardian`,()=>{
   const grid=maps.MAPS[fixture.id].grid;expect(grid.map(row=>row.join(''))).toEqual(fixture.rows);expect(grid).toHaveLength(5);grid.forEach(row=>expect(row).toHaveLength(9));
   for(const [tile,count] of [['O',6],['S',1],['C',1]] as const)expect(grid.flat().filter(t=>t===tile)).toHaveLength(count);
  });
  it(`${fixture.id}: exact distinct orthogonal waypoints cover every road without nonconsecutive contacts`,()=>{
   const map=maps.MAPS[fixture.id],route=map.paths.player;expect(route.map(p=>[p.col,p.row])).toEqual(fixture.route);expect(map.paths.ai).toBe(route);
   expect(new Set(route.map(p=>`${p.col},${p.row}`)).size).toBe(route.length);expect(map.grid[route[0].row][route[0].col]).toBe('S');expect(map.grid[route.at(-1)!.row][route.at(-1)!.col]).toBe('C');
   route.slice(1,-1).forEach(p=>expect(map.grid[p.row][p.col]).toBe('R'));expect(map.grid.flat().filter(t=>t==='R')).toHaveLength(route.length-2);
   for(let i=0;i<route.length;i++)for(let j=i+1;j<route.length;j++){const distance=Math.abs(route[i].col-route[j].col)+Math.abs(route[i].row-route[j].row);if(j===i+1)expect(distance).toBe(1);else expect(distance).toBeGreaterThan(1);}
  });
  it(`${fixture.id}: real movement and sprinkler traverse its complete route and endpoint`,()=>{
   const e=new BattleEngine({mapId:fixture.id,autoWaves:false});e.start();const m=e.spawnEnemy('rat','player');m.speed=0;m.hp=m.maxHp=1000;const end=fixture.route.length-1;
   for(let progress=0;progress<end;progress++){m.progress=progress;e.tick(.05);expect([m.col,m.row]).toEqual(fixture.route[progress]);}
   expect(e.useSprinkler().ok).toBe(true);expect(m.progress).toBeCloseTo(end-5.5);expect(m.hp).toBe(880);
   expect({col:m.col,row:m.row}).toEqual(GridSystem.pathPosition('player',end-5.5,fixture.id));const water=e.state.events.find(v=>v.type==='sprinkler')!;
   expect(water.points?.[0]).toEqual(maps.getMap(fixture.id).paths.player.at(-1));expect(water.points?.at(-1)).toEqual(maps.getMap(fixture.id).paths.player[0]);
   m.progress=end;e.tick(.05);expect(e.state.sides.player.oranges).toBe(2);expect(e.state.enemies).not.toContain(m);
  });
  it(`${fixture.id}: guardian rescue and boss summons use the dynamic endpoint`,()=>{
   const e=new BattleEngine({mapId:fixture.id,autoWaves:false,loadouts:{player:{ownedProps:{giant_orange_cat:1},equippedPassiveProps:['giant_orange_cat']}}});e.start();const end=fixture.route.length-1;
   const normal=e.spawnEnemy('rat','player');normal.progress=end-2;normal.speed=0;const near=e.spawnEnemy('rat','player');near.progress=end-2.1;near.speed=0;const far=e.spawnEnemy('rat','player');far.progress=end-2.3;far.speed=0;e.tick(.05);
   expect(normal.hp).toBeLessThanOrEqual(0);expect(near.hp).toBeLessThanOrEqual(0);expect(far.hp).toBeGreaterThan(0);expect(e.state.events.find(v=>v.type==='giant_cat')).toMatchObject(GridSystem.pathPosition('player',end-1,fixture.id));
   e.state.sides.player.giantCatUses=2;const boss=e.spawnEnemy('hornet_queen','player');boss.progress=end-.1;boss.speed=0;boss.abilityCooldown=0;e.tick(.05);const summons=e.state.enemies.filter(m=>m.kind==='killer_bee');expect(summons).toHaveLength(3);expect(summons.every(m=>m.progress===end)).toBe(true);
   e.state.sides.player.oranges=10;e.tick(.05);expect(e.state.enemies.filter(m=>m.kind==='killer_bee')).toHaveLength(0);expect(e.state.sides.player.oranges).toBe(7);
  });
 }
 it('keeps battle grids and configuration independent while digging and knocking back',()=>{
  const kitchen=new BattleEngine({mapId:'midnight_kitchen',autoWaves:false}),maze=new BattleEngine({mapId:'cat_tower_maze',autoWaves:false});expect(kitchen.dig(8,1).ok).toBe(true);expect(maze.state.grid[1][8]).toBe('G');expect(maps.getMap('midnight_kitchen').grid[1][8]).toBe('G');
  const a=kitchen.spawnEnemy('rat','player'),b=maze.spawnEnemy('rat','player');a.progress=b.progress=10;kitchen.knockback(a,4.5);maze.knockback(b,4.5);
  expect({col:a.col,row:a.row}).toEqual({col:1.5,row:0});expect({col:b.col,row:b.row}).toEqual({col:3.5,row:0});expect(GridSystem.create()).toEqual(maps.MAP);
 });
 it.each(fixtures)('$id never creates an AI half or units',fixture=>{const e=new BattleEngine({mapId:fixture.id,autoWaves:false,ai:true});e.start();e.tick(60);expect(e.state.units).toHaveLength(0);expect(e.state.grid).toEqual(maps.getMap(fixture.id).grid);});
});
