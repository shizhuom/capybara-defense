import { getMap } from '../config/maps';
import type { BattleState, Point, Side, Tile, UnitLocation,MapId } from './types';
export class GridSystem {
  static create(mapId?:MapId):Tile[][] { return getMap(mapId).grid.map(row=>[...row]); }
  static owns(side:Side,col:number,row:number):boolean {
    return Number.isInteger(col)&&Number.isInteger(row)&&col>=0&&col<8&&row>=0&&row<10&&(side==='player'?row>=5:row<5);
  }
  static canPlace(state:BattleState,side:Side,location:UnitLocation):boolean {
    if(location.zone==='bench')return Number.isInteger(location.slot)&&location.slot>=0&&location.slot<5;
    return this.owns(side,location.col,location.row)&&state.grid[location.row][location.col]==='O';
  }
  static pathPosition(side:Side,progress:number,mapId?:MapId):Point {
    const path=getMap(mapId).paths[side];const p=Math.max(0,Math.min(path.length-1,progress));
    const index=Math.floor(p),a=path[index],b=path[Math.min(index+1,path.length-1)],mix=p-index;
    return {col:a.col+(b.col-a.col)*mix,row:a.row+(b.row-a.row)*mix};
  }
  static distance(a:Point,b:Point):number { return Math.hypot(a.col-b.col,a.row-b.row); }
}
