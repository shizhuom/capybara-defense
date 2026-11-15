import {RECIPES} from './recipes';
import type {Profile} from '../core/types';

/** Additions at each tier, deliberately independent of RNG and saved-profile schema. */
export const PROGRESSION_TIERS = [
 {stars:0,units:['hamster','squirrel','bee','shovel','panda','cat','hat_bamboo'],heroes:['kungfu_po','puss_in_hat'],minions:['rat','roach'],bosses:['husky_wrecker']},
 {stars:1,units:['hedgehog','hat_shades'],heroes:['bamboo_mafia','meowfia'],minions:['crab'],bosses:['box_kraken']},
 {stars:4,units:['corgi','shiba'],heroes:['samurai_doge','doge_wick'],minions:['charmed_rat'],bosses:['mega_roomba','diva_kitty']},
 {stars:8,units:['hat_wizard'],heroes:['zen_master','purrcerer'],minions:[],bosses:['dr_clippers','sad_rain_frog']},
 {stars:12,units:['goose','cleaver','rooster','basketball'],heroes:['ronin_goose','ballin_rooster'],minions:['killer_bee'],bosses:['hornet_queen','screaming_marmot','king_skunk']},
 {stars:20,units:['raccoon','trash_lid','frog','crown'],heroes:['rocket_coon','pepe_king'],minions:[],bosses:['buff_roo','trash_coon','dj_rat_king']},
] as const;
type Category='units'|'heroes'|'minions'|'bosses';
const ids=(stars:number,category:Category):string[]=>PROGRESSION_TIERS.filter(t=>t.stars<=Math.max(0,Number.isFinite(stars)?stars:0)).flatMap(t=>[...t[category]]);
export const getUnlockedUnitIds=(stars:number)=>ids(stars,'units');
export const getUnlockedHeroIds=(stars:number)=>ids(stars,'heroes');
export const getUnlockedMinionIds=(stars:number)=>ids(stars,'minions');
export const getUnlockedBossIds=(stars:number)=>ids(stars,'bosses');
export const requiredStars=(id:string):number=>PROGRESSION_TIERS.find(t=>([...t.units,...t.heroes,...t.minions,...t.bosses] as readonly string[]).includes(id))?.stars??0;
export function progressionFor(profile:Pick<Profile,'stars'|'highestStars'|'mergedHeroes'>,unrestricted=false){
 const stars=unrestricted?20:Math.max(profile.stars,profile.highestStars),earned=RECIPES.filter(r=>profile.mergedHeroes.includes(r.hero));
 const units=[...new Set([...getUnlockedUnitIds(stars),...earned.flatMap(r=>r.parts)])];
 // Grandfathered parts can form other cross-recipes too. Keep the encyclopedia
 // honest about what the unchanged synthesis system actually lets this save make.
 const heroes=[...new Set([...getUnlockedHeroIds(stars),...RECIPES.filter(r=>r.parts.every(id=>units.includes(id))).map(r=>r.hero)])];
 return {stars,units,heroes,minions:getUnlockedMinionIds(stars),bosses:getUnlockedBossIds(stars)};
}
export function newlyUnlocked(before:number,after:number):{units:string[];heroes:string[]} {
 const tiers=PROGRESSION_TIERS.filter(t=>t.stars>before&&t.stars<=after);
 return {units:tiers.flatMap(t=>[...t.units]),heroes:tiers.flatMap(t=>[...t.heroes])};
}
