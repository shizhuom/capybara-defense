import {describe,it,expect} from 'vitest';
import * as maps from '../src/config/maps';
import {GridSystem} from '../src/core/GridSystem';
import {BattleEngine} from '../src/core/BattleEngine';
import type {MapId} from '../src/core/types';

const fixtures = [
  {id:'sunny_backyard',rows:['CGGGGGGS','RGGOOOGR','RGGOOOGR','RGGRRRRR','RRRRGGGG'],route:[[7,0],[7,1],[7,2],[7,3],[6,3],[5,3],[4,3],[3,3],[3,4],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1],[0,0]]},
  {id:'sakura_onsen',rows:['CGGGGGGS','RRGOOORR','GRGOOORG','GRRGGGRG','GGRRRRRG'],route:[[7,0],[7,1],[6,1],[6,2],[6,3],[6,4],[5,4],[4,4],[3,4],[2,4],[2,3],[1,3],[1,2],[1,1],[0,1],[0,0]]},
  {id:'midnight_kitchen',rows:['CGGGGGGS','RGOOOOGR','RRRRORRR','GGGRORGG','GGGRRRGG'],route:[[7,0],[7,1],[7,2],[6,2],[5,2],[5,3],[5,4],[4,4],[3,4],[3,3],[3,2],[2,2],[1,2],[0,2],[0,1],[0,0]]},
  {id:'cat_tower_maze',rows:['CGGGGGGS','RRRRRRGR','GGOOORGR','GGOOORGR','GGGGGRRR'],route:[[7,0],[7,1],[7,2],[7,3],[7,4],[6,4],[5,4],[5,3],[5,2],[5,1],[4,1],[3,1],[2,1],[1,1],[0,1],[0,0]]},
] as const;

describe('M3 four precise arenas',()=>{
  for(const fixture of fixtures){
    it(`${fixture.id}: exact matrix, six pads each and rotational symmetry`,()=>{
      expect(maps.MAPS,'four arena definitions').toBeDefined();
      const grid=maps.MAPS[fixture.id].grid;
      expect(grid.slice(0,5).map(row=>row.join(''))).toEqual(fixture.rows);
      expect(grid).toHaveLength(10);
      for(let row=0;row<10;row++)for(let col=0;col<8;col++){
        expect(grid[row]).toHaveLength(8);expect(grid[row][col]).toBe(grid[9-row][7-col]);
      }
      expect(grid.slice(0,5).flat().filter(tile=>tile==='O')).toHaveLength(6);
      expect(grid.slice(5).flat().filter(tile=>tile==='O')).toHaveLength(6);
    });
    it(`${fixture.id}: sixteen distinct orthogonal waypoints cover every road`,()=>{
      expect(maps.MAPS).toBeDefined();
      const map=maps.MAPS[fixture.id];
      expect(map.paths.ai.map(p=>[p.col,p.row])).toEqual(fixture.route);
      expect(map.paths.player.map(p=>[p.col,p.row])).toEqual(fixture.route.map(([c,r])=>[7-c,9-r]));
      for(const side of ['ai','player'] as const){
        const route=map.paths[side];expect(route).toHaveLength(16);expect(new Set(route.map(p=>`${p.col},${p.row}`)).size).toBe(16);
        expect(map.grid[route[0].row][route[0].col]).toBe('S');expect(map.grid[route[15].row][route[15].col]).toBe('C');
        route.slice(1,15).forEach(p=>expect(map.grid[p.row][p.col]).toBe('R'));
        for(let i=1;i<16;i++)expect(Math.abs(route[i].col-route[i-1].col)+Math.abs(route[i].row-route[i-1].row)).toBe(1);
        expect(map.grid.slice(side==='ai'?0:5,side==='ai'?5:10).flat().filter(tile=>tile==='R')).toHaveLength(14);
      }
    });
    it(`${fixture.id}: real movement and sprinkler follow its route and end at 15`,()=>{
      const e=new BattleEngine({mapId:fixture.id,autoWaves:false,ai:false});e.start();
      expect(e.state.mapId).toBe(fixture.id);
      const m=e.spawnEnemy('rat','player');m.speed=0;m.hp=m.maxHp=1000;
      for(let progress=0;progress<15;progress++){
        m.progress=progress;e.tick(.05);
        expect([m.col,m.row]).toEqual([7-fixture.route[progress][0],9-fixture.route[progress][1]]);
      }
      expect(e.useSprinkler().ok).toBe(true);expect(m.progress).toBeCloseTo(9.5);expect(m.hp).toBe(880);
      const a=fixture.route[9],b=fixture.route[10];expect(m.col).toBe(7-(a[0]+b[0])/2);expect(m.row).toBe(9-(a[1]+b[1])/2);
      const water=e.state.events.find(event=>event.type==='sprinkler');expect(water?.points?.[0]).toEqual({col:7,row:9});expect(water?.points?.at(-1)).toEqual({col:0,row:9});
      m.progress=15;const lives=e.state.sides.player.oranges;e.tick(.05);expect(e.state.sides.player.oranges).toBe(lives-1);expect(e.state.enemies).not.toContain(m);
    });
  }
  it('keeps two arenas and configuration independent when digging and knocking back',()=>{
    const kitchen=new BattleEngine({mapId:'midnight_kitchen',ai:false,autoWaves:false});
    const maze=new BattleEngine({mapId:'cat_tower_maze',ai:false,autoWaves:false});
    expect(kitchen.state.grid[6][3]).toBe('O');expect(maze.state.grid[6][3]).toBe('O');
    expect(kitchen.dig(1,9).ok).toBe(true);expect(maze.state.grid[9][1]).toBe('G');
    expect(maps.MAPS.midnight_kitchen.grid[9][1]).toBe('G');
    const a=kitchen.spawnEnemy('rat','player'),b=maze.spawnEnemy('rat','player');a.progress=b.progress=10;
    kitchen.knockback(a,4.5);maze.knockback(b,4.5);
    expect([a.col,a.row]).toEqual([2,5.5]);expect([b.col,b.row]).toEqual([1.5,5]);
    expect(GridSystem.create('sunny_backyard')).toEqual(maps.MAP);
  });
  it('AI deploys legally on every arena without modifying another half',()=>{
    for(const fixture of fixtures){
      const e=new BattleEngine({mapId:fixture.id as MapId,autoWaves:false});e.start();e.tick(15);
      const board=e.state.units.filter(u=>u.side==='ai'&&u.location.zone==='board');expect(board.length).toBeGreaterThan(0);
      for(const u of board)if(u.location.zone==='board')expect(e.state.grid[u.location.row][u.location.col]).toBe('O');
      expect(e.state.grid.slice(5).map(row=>row.join(''))).toEqual(maps.MAPS[fixture.id].grid.slice(5).map(row=>row.join('')));
    }
  });
});
