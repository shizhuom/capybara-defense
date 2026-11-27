import {HEROES} from '../config/heroes';
import {STAGE} from '../config/maps';
import {PROPS} from '../config/props';
import {UNITS} from '../config/units';
import {GridSystem} from './GridSystem';
import type {BattleState,Side,Unit} from './types';

export interface PropTarget {unitId?:number;col?:number;row?:number}
type StagePoint={x:number;y:number};

/** Passive equipment never becomes an activatable skill through targeting. */
export function propTargetKind(id:string):'unit'|'road'|'self'|undefined {
  if(id==='sprinkler')return 'self';
  const prop=PROPS[id];
  return prop?.type==='active'&&prop.target!=='passive'?prop.target:undefined;
}

/** Shared with activation so preview eligibility and command hints cannot drift. */
export function propUnitTargetError(state:BattleState,id:string,unit:Unit|undefined,side:Side='player'):string|undefined {
  if(propTargetKind(id)!=='unit'||!unit||unit.side!==side||!state.units.some(candidate=>candidate.id===unit.id&&candidate.side===side))return 'm2.invalidTarget';
  if(unit.kind==='shovel'&&(id!=='recycle_bin'||unit.location.zone!=='bench'))return 'hint.toolOnly';
  if((unit.washing??0)>0)return 'm2.washing';
  const basic=UNITS[unit.kind],max=HEROES[unit.kind]?5:basic?.maxLevel??1;
  if(id==='washer'&&!(basic?.category==='component'||basic?.category==='basic'&&unit.level===1))return 'm2.invalidTarget';
  if(id==='clay'&&basic?.category!=='component')return 'm2.invalidTarget';
  if(id==='milk_bottle'&&(max===1||unit.level>=max))return 'hint.maxLevel';
  if(id==='whistle'){
    if(max===1)return 'm2.invalidTarget';
    if(unit.level>=max||unit.awakened)return 'hint.maxLevel';
  }
  if(id==='recycle_bin'&&unit.level!==1)return 'm2.invalidTarget';
  return undefined;
}

export function isValidPropUnit(state:BattleState,id:string,unit:Unit):boolean {
  return propUnitTargetError(state,id,unit)===undefined;
}

export function isValidPropRoad(state:BattleState,col:number,row:number,side:Side='player'):boolean {
  return GridSystem.owns(side,col,row)&&state.grid[row]?.[col]==='R'&&!state.traps.some(trap=>trap.side===side&&trap.col===col&&trap.row===row);
}

export function isInsideBattleBoard(point:StagePoint):boolean {
  return Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=STAGE.boardX&&point.x<STAGE.boardX+STAGE.cols*STAGE.cell&&point.y>=STAGE.boardY&&point.y<STAGE.boardY+STAGE.rows*STAGE.cell;
}

/** Same centers as the rendered board pets and bench nests, in stage pixels. */
export function propUnitCenter(unit:Unit):StagePoint {
  const location=unit.location;
  return location.zone==='board'
    ?{x:STAGE.boardX+(location.col+.5)*STAGE.cell,y:STAGE.boardY+(location.row+.5)*STAGE.cell}
    :{x:STAGE.benchX+location.slot*STAGE.benchStep+STAGE.benchSize/2,y:STAGE.benchY+STAGE.benchSize/2+2};
}

/** Only resolves a location; equipment, phase and cooldown checks stay in activation. */
export function resolvePropDrop(state:BattleState,id:string,point:StagePoint):PropTarget|null {
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return null;
  const kind=propTargetKind(id);
  if(kind==='self')return isInsideBattleBoard(point)?{}:null;
  if(kind==='road'){
    if(!isInsideBattleBoard(point))return null;
    const col=Math.floor((point.x-STAGE.boardX)/STAGE.cell),row=Math.floor((point.y-STAGE.boardY)/STAGE.cell);
    return isValidPropRoad(state,col,row)?{col,row}:null;
  }
  if(kind!=='unit')return null;
  let nearest:Unit|undefined,distance=68*68;
  for(const unit of state.units){
    if(!isValidPropUnit(state,id,unit))continue;
    const center=propUnitCenter(unit),candidate=(center.x-point.x)**2+(center.y-point.y)**2;
    if(candidate<=distance&&(!nearest||candidate<distance)){nearest=unit;distance=candidate;}
  }
  return nearest?{unitId:nearest.id}:null;
}
