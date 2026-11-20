import {HEROES} from '../config/heroes';
import {UNITS} from '../config/units';
import {WEAPONS,HERO_FAMILIES} from '../config/weapons';
import {getBrothEffect,getUnitCombatFamily} from '../config/kitchen';
import type {BattleLoadout,Unit} from './types';

function equipped(unit:Unit,loadout:Partial<BattleLoadout>){
  const id=loadout.equippedWeapons?.[unit.kind],weapon=id?WEAPONS[id]:undefined;
  return weapon?.family===HERO_FAMILIES[unit.kind]?weapon:undefined;
}
function weaponRange(unit:Unit,loadout:Partial<BattleLoadout>):number {
  let range=(HEROES[unit.kind]??UNITS[unit.kind])?.range??0;
  if(range>=2&&loadout.equippedPassiveProps?.includes('tall_perch'))range*=1.25;
  switch(equipped(unit,loadout)?.id){
    case 'm02_slipper':return range+.3;
    case 'm03_scratcher':return range+.5;
    case 'r02_duck_squirt':return range+.4;
    case 'r11_sniper_laser':return range*1.35;
    default:return range;
  }
}
/** Shared by the headless engine and Canvas targeting/energy indicators. */
export function combatRange(unit:Unit,loadout:Partial<BattleLoadout>={}):number {
  const range=weaponRange(unit,loadout),reach=getUnitCombatFamily(unit.kind)==='ranged'?getBrothEffect(loadout,'rangedRange'):0;
  return reach?range+reach:range;
}
export function combatCharge(unit:Unit,loadout:Partial<BattleLoadout>={}):number {
  const hero=HEROES[unit.kind];if(!hero)return 0;
  const charge=Math.max(1,Math.ceil(hero.charge*.9**(unit.level-1))-(equipped(unit,loadout)?.id==='w04_yarn_orb'?1:0));
  const cut=getBrothEffect(loadout,'chargeReduction');
  // Matcha never pushes a requirement below three, and never raises an already shorter one.
  return cut?Math.min(charge,Math.max(3,charge-cut)):charge;
}
