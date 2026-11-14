import {expect,it} from 'vitest';
import {GridSystem} from '../src/core/GridSystem';
import {BattleEngine} from '../src/core/BattleEngine';
import {PATHS} from '../src/config/maps';
it('solo map has42 cells, six pads, one entry and one guardian',()=>{
 const grid=GridSystem.create();expect(grid).toHaveLength(7);for(const row of grid)expect(row).toHaveLength(6);
 for(const [tile,count] of [['O',6],['S',1],['C',1]] as const)expect(grid.flat().filter(t=>t===tile)).toHaveLength(count);
 expect(PATHS.ai).toBe(PATHS.player);
});
it('interpolates along corners and clamps at the canonical endpoint',()=>{
 expect(GridSystem.pathPosition('player',3.5)).toEqual({col:3.5,row:0});expect(GridSystem.pathPosition('player',5.5)).toEqual({col:4,row:1.5});
 expect(GridSystem.pathPosition('player',99)).toEqual({col:5,row:6});expect(GridSystem.pathPosition('player',-1)).toEqual({col:0,row:0});
});
it('deploys only on open solo pads, never road, grass, AI or out of bounds',()=>{
 const {state}=new BattleEngine();expect(GridSystem.canPlace(state,'player',{zone:'board',col:2,row:1})).toBe(true);
 for(const [col,row] of [[0,0],[0,1],[6,1],[-1,1],[1,7]])expect(GridSystem.canPlace(state,'player',{zone:'board',col,row})).toBe(false);
 expect(GridSystem.canPlace(state,'ai',{zone:'board',col:2,row:1})).toBe(false);
});
