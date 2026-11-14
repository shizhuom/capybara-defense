import { expect,it } from 'vitest';
import { GridSystem } from '../src/core/GridSystem';
import { BattleEngine } from '../src/core/BattleEngine';
import { PATHS } from '../src/config/maps';
it('地图和两条路径精确180度中心对称且上下开局各6块空地',()=>{
  const grid=GridSystem.create();
  for(let row=0;row<10;row++)for(let col=0;col<8;col++)expect(grid[row][col]).toBe(grid[9-row][7-col]);
  expect(grid.slice(0,5).flat().filter(t=>t==='O')).toHaveLength(6);
  expect(grid.slice(5).flat().filter(t=>t==='O')).toHaveLength(6);
  PATHS.ai.forEach((p,i)=>expect(PATHS.player[i]).toEqual({col:7-p.col,row:9-p.row}));
});
it('沿路插值经过转角并在温泉终点停止',()=>{
  expect(GridSystem.pathPosition('player',3.5)).toEqual({col:.5,row:6});
  expect(GridSystem.pathPosition('ai',14.5)).toEqual({col:0,row:.5});
  expect(GridSystem.pathPosition('player',99)).toEqual({col:7,row:9});
});
it('部署限定本方空地，禁止道路、草坪、对方及越界',()=>{
  const {state}=new BattleEngine();
  expect(GridSystem.canPlace(state,'player',{zone:'board',col:2,row:7})).toBe(true);
  for(const [col,row]of [[0,9],[1,9],[3,1],[-1,7],[9,8]])expect(GridSystem.canPlace(state,'player',{zone:'board',col,row})).toBe(false);
});
