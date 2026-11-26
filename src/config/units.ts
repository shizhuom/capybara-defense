export interface UnitDefinition { id: string; category: 'basic' | 'component' | 'tool'; weight: number; damage: number; rate: number; range: number; maxLevel: number; color: string }
export const UNITS: Record<string, UnitDefinition> = {
  hamster: { id:'hamster', category:'basic', weight:20, damage:16, rate:1.25, range:1.6, maxLevel:5, color:'#f3be76' },
  squirrel: { id:'squirrel', category:'basic', weight:20, damage:10, rate:1.1, range:2.8, maxLevel:5, color:'#cc805c' },
  hedgehog: { id:'hedgehog', category:'basic', weight:16, damage:14, rate:.85, range:2, maxLevel:5, color:'#ad9983' },
  corgi: { id:'corgi', category:'basic', weight:12, damage:22, rate:.75, range:1.7, maxLevel:5, color:'#f2ac50' },
  bee: { id:'bee', category:'basic', weight:8, damage:0, rate:0, range:0, maxLevel:3, color:'#ffdb59' },
  ...Object.fromEntries([
    ['panda',1.8,'#e7e6dc'], ['cat',1.8,'#ffc8b4'], ['shiba',1.8,'#dca058'],
    ['hat_bamboo',1.4,'#c2c67c'], ['hat_shades',1.4,'#807796'], ['hat_wizard',1.2,'#ac93d7'],
    ['goose',0.65,'#faf4e2'], ['cleaver',0.65,'#a8c8d5'], ['rooster',0.65,'#e99383'], ['basketball',0.65,'#f4a24e'],
    ['raccoon',0.65,'#a3a7a7'], ['trash_lid',0.65,'#9ac1b6'], ['frog',0.65,'#8fbd75'], ['crown',0.65,'#f5d66a'],
  ].map(([id,weight,color]) => [id, { id, weight, color, category:'component', damage:3, rate:1/1.5, range:1.35, maxLevel:1 } as UnitDefinition])),
};
UNITS.shovel={id:'shovel',category:'tool',weight:3.5,damage:0,rate:0,range:0,maxLevel:1,color:'#bb9264'};
export const DRAW_POOL = Object.values(UNITS);
export const BEE_PRODUCTION = [{interval:18,amount:1},{interval:11,amount:1},{interval:7,amount:2}];
export const SHOVEL_PRODUCTION = {interval:55,amount:1,maxStored:4};
export const ECONOMY = {initialFood:22,summonCost:10,summonCostStep:2,summonCount:5,benchSize:5,waveIncome:3,killFood:1,bossKillFood:8,initialOranges:3,initialShovels:1};
export function getSummonCost(summons:number):number {return ECONOMY.summonCost+summons*ECONOMY.summonCostStep;}
