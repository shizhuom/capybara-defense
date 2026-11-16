export interface HeroDefinition { id:string; damage:number; rate:number; range:number; charge:number; color:string; attack: string }
export const HEROES: Record<string, HeroDefinition> = {
  kungfu_po: {id:'kungfu_po',damage:50,rate:1.4,range:1.8,charge:8,color:'#8ebda0',attack:'melee'},
  bamboo_mafia: {id:'bamboo_mafia',damage:46,rate:1.1,range:3.2,charge:9,color:'#8383a2',attack:'rocket'},
  zen_master: {id:'zen_master',damage:42,rate:1.2,range:2.6,charge:8,color:'#b3a6d2',attack:'wave'},
  puss_in_hat: {id:'puss_in_hat',damage:34,rate:2,range:1.8,charge:7,color:'#e9b280',attack:'cross'},
  meowfia: {id:'meowfia',damage:20,rate:2.6,range:3,charge:12,color:'#a6c6be',attack:'rapid'},
  purrcerer: {id:'purrcerer',damage:44,rate:1.15,range:2.8,charge:7,color:'#bb9fd5',attack:'magic'},
  samurai_doge: {id:'samurai_doge',damage:86,rate:.8,range:1.8,charge:6,color:'#e3a56f',attack:'heavy'},
  doge_wick: {id:'doge_wick',damage:27,rate:2,range:3.2,charge:8,color:'#b1ada7',attack:'dual'},
  ronin_goose: {id:'ronin_goose',damage:61,rate:1.1,range:2,charge:8,color:'#efe6c8',attack:'slash'},
  ballin_rooster: {id:'ballin_rooster',damage:45,rate:1.2,range:2.2,charge:7,color:'#ea9875',attack:'ball'},
  rocket_coon: {id:'rocket_coon',damage:43,rate:1.2,range:3,charge:8,color:'#9cb9ad',attack:'steal'},
  pepe_king: {id:'pepe_king',damage:40,rate:1.3,range:2.8,charge:8,color:'#abc479',attack:'poison'},
};
