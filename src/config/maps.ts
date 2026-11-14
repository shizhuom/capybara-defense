import type { MapId, Point, Side, Tile } from '../core/types';
export interface MapDefinition {
  id:MapId; name:{'zh-CN':string;en:string}; grid:Tile[][]; paths:Record<Side,Point[]>;
  theme:{grass:[string,string];open:string;road:string;water:string;accent:string;paper:string};
}
export const MAP_IDS:MapId[]=['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze'];
function arena(id:MapId,zh:string,en:string,rows:string[],route:number[][],theme:MapDefinition['theme']):MapDefinition {
  const grid=rows.map(row=>row.split('') as Tile[]),player=route.map(([col,row])=>({col,row}));
  return{id,name:{'zh-CN':zh,en},grid,paths:{player,ai:player},theme};
}
export const MAPS:Record<MapId,MapDefinition>={
  sunny_backyard:arena('sunny_backyard','阳光后院','Sunny Backyard',
    ['SRRRRG','GOOORG','GRRRRG','GROOGG','GRRRRG','GGOGRG','GGGGRC'],
    [[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[3,2],[2,2],[1,2],[1,3],[1,4],[2,4],[3,4],[4,4],[4,5],[4,6],[5,6]],
    {grass:['#c5d6a8','#bbcf9d'],open:'#fff8e8',road:'#e5c9a1',water:'#a8c8b1',accent:'#9d825d',paper:'#f8f1de'}),
  sakura_onsen:arena('sakura_onsen','樱花温泉馆','Sakura Onsen',
    ['RRRRRS','ROOGOG','RGRRRG','RORORG','RRRGRG','GGOGRG','GGGGRC'],
    [[5,0],[4,0],[3,0],[2,0],[1,0],[0,0],[0,1],[0,2],[0,3],[0,4],[1,4],[2,4],[2,3],[2,2],[3,2],[4,2],[4,3],[4,4],[4,5],[4,6],[5,6]],
    {grass:['#edc7d0','#e4bac6'],open:'#f6ecd6',road:'#cf9f8a',water:'#a7d0ce',accent:'#a45f7a',paper:'#fff0ec'}),
  midnight_kitchen:arena('midnight_kitchen','深夜厨房','Midnight Kitchen',
    ['SRGRRR','GROROR','GRORGR','GRRROR','GGGGOR','GORRRR','CRRGGG'],
    [[0,0],[1,0],[1,1],[1,2],[1,3],[2,3],[3,3],[3,2],[3,1],[3,0],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5],[2,6],[1,6],[0,6]],
    {grass:['#b3987e','#aa8d74'],open:'#fff1cf',road:'#d8dddf',water:'#9abdbf',accent:'#6d6d80',paper:'#ede8e2'}),
  cat_tower_maze:arena('cat_tower_maze','猫爬架迷宫','Cat Tower Maze',
    ['GGSRRR','GOGOOR','RRRRRR','ROOGGG','RRRRRG','GGOGRG','GCRRRG'],
    [[2,0],[3,0],[4,0],[5,0],[5,1],[5,2],[4,2],[3,2],[2,2],[1,2],[0,2],[0,3],[0,4],[1,4],[2,4],[3,4],[4,4],[4,5],[4,6],[3,6],[2,6],[1,6]],
    {grass:['#c7ad8c','#bba07e'],open:'#e4d7ed',road:'#ddc9a5',water:'#afc5b7',accent:'#9b779d',paper:'#f4ebde'}),
};
export function getMap(id?:string):MapDefinition{return id&&Object.hasOwn(MAPS,id)?MAPS[id as MapId]:MAPS.sunny_backyard;}
/** M1 compatibility aliases; battles clone their chosen map instead of mutating this data. */
export const MAP=MAPS.sunny_backyard.grid;
export const PATHS=MAPS.sunny_backyard.paths;
export const GRID_COLS=6;
export const GRID_ROWS=7;
export const STAGE = { width:640, height:1216, cols:GRID_COLS, rows:GRID_ROWS, cell:96, boardX:32, boardY:188, shovelX:556, shovelY:898, benchX:48, benchY:944, benchStep:112, benchSize:96 };
