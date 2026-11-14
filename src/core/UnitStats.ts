import {HEROES} from '../config/heroes';
import {BEE_PRODUCTION,UNITS} from '../config/units';
import type {BattleLoadout} from './types';

export const LEVEL_MULTIPLIERS = [1,1.55,2.25,3.15,4.3] as const;
export const HERO_LEVEL_MULTIPLIERS = [1,1.6,1.6**2,1.6**3,1.6**4] as const;
export interface UnitStats {damage:number;rate:number;range:number;charge:number}
function validLevel(level:number,max:number):number{return Number.isFinite(level)?Math.max(1,Math.min(max,Math.trunc(level))):1;}

/** Unmodified catalog stats shared by battle logic and unit growth displays. */
export function getBaseUnitStats(kind:string,level:number):UnitStats {
  const hero=Object.hasOwn(HEROES,kind)?HEROES[kind]:undefined,base=hero??(Object.hasOwn(UNITS,kind)?UNITS[kind]:undefined);
  if(!base||kind==='shovel')return{damage:0,rate:0,range:0,charge:0};
  const index=validLevel(level,hero?5:UNITS[kind].maxLevel)-1;
  return{damage:base.damage*(hero?HERO_LEVEL_MULTIPLIERS[index]:LEVEL_MULTIPLIERS[index]),rate:base.rate*(hero?1:1+.12*index),range:base.range,charge:hero?Math.ceil(hero.charge*.9**index):0};
}

export function getBeeProduction(level:number,loadout?:BattleLoadout):{amount:number;interval:number} {
  const production=BEE_PRODUCTION[validLevel(level,3)-1];
  return{amount:production.amount,interval:production.interval*(loadout?.equippedPassiveProps.includes('bee_overtime')?.75:1)};
}
