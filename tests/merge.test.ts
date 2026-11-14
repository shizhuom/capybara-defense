import { describe, expect, it } from 'vitest';
import { MergeSystem } from '../src/core/MergeSystem';
import type { Unit } from '../src/core/types';
const pet = (kind:string,level=1,id=1):Unit => ({id,kind,side:'player',level,location:{zone:'bench',slot:id-1},statuses:{},energy:0,cooldown:0,production:0,buffTime:0,empowered:0,animation:0});
const recipes = [
  ['panda','hat_bamboo','kungfu_po'], ['panda','hat_shades','bamboo_mafia'], ['panda','hat_wizard','zen_master'],
  ['cat','hat_bamboo','puss_in_hat'], ['cat','hat_shades','meowfia'], ['cat','hat_wizard','purrcerer'],
  ['shiba','hat_bamboo','samurai_doge'], ['shiba','hat_shades','doge_wick'], ['goose','cleaver','ronin_goose'],
  ['rooster','basketball','ballin_rooster'], ['raccoon','trash_lid','rocket_coon'], ['frog','crown','pepe_king'],
];
describe('混合英雄配方与喂养',()=>{
  it.each(recipes)('%s + %s 双向产生 %s，保留目标位置', (a,b,hero)=>{
    for(const [first,second] of [[a,b],[b,a]]){
      const source=pet(first),target=pet(second,1,2);
      target.location={zone:'board',col:2,row:7};
      const result=MergeSystem.combine(source,target);
      expect(result.ok).toBe(true); expect(result.unit?.kind).toBe(hero);
      expect(result.unit?.level).toBe(1); expect(result.unit?.location).toEqual({zone:'board',col:2,row:7});
      expect(source.kind).toBe(first); // pure resolution cannot mutate existing cards
    }
  });
  it.each(recipes)('%s 或 %s 都能喂养对应英雄 %s', (a,b,hero)=>{
    for(const part of [a,b]) expect(MergeSystem.combine(pet(part),pet(hero,3,2)).unit?.level).toBe(4);
  });
  it('拒绝柴犬魔法帽且不吞卡',()=>{
    const r=MergeSystem.combine(pet('shiba'),pet('hat_wizard',1,2));
    expect(r).toMatchObject({ok:false,key:'hint.dogeMagic'}); expect(r.unit).toBeUndefined();
  });
  it('不相关配对只交换，不产生英雄',()=>{
    for(const pair of [['hamster','hat_bamboo'],['panda','cat'],['goose','basketball'],['panda','panda']]){
      const r=MergeSystem.combine(pet(pair[0]),pet(pair[1],1,2)); expect(r.unit).toBeUndefined();expect(r.swap).toBe(true);
    }
  });
  it.each(['hamster','squirrel','hedgehog','corgi','bee','kungfu_po'])('%s 同名同级升级',kind=>{
    expect(MergeSystem.combine(pet(kind,2),pet(kind,2,2)).unit?.level).toBe(3);
    expect(MergeSystem.combine(pet(kind,1),pet(kind,2,2)).unit).toBeUndefined();
  });
  it('升级瞬间清除四种可解状态',()=>{
    const unit=pet('purrcerer',2,2);unit.statuses={SEALED:18,WET:99,KNOCKDOWN:2,CONFUSED:3};
    const r=MergeSystem.combine(pet('hat_wizard'),unit);
    expect(r.unit?.statuses).toEqual({});expect(r.unit?.level).toBe(3);
  });
  it('剪刀禁合期间不能合成和喂养',()=>{
    const hero=pet('purrcerer',2,2);hero.statuses.MERGE_LOCK=5;
    expect(MergeSystem.combine(pet('cat'),hero)).toMatchObject({ok:false,key:'hint.mergeLocked'});
    const base=pet('hamster');base.statuses.MERGE_LOCK=1;
    expect(MergeSystem.combine(base,pet('hamster',1,2)).key).toBe('hint.mergeLocked');
  });
  it('英雄5级、蜜蜂3级封顶，不消耗卡牌',()=>{
    expect(MergeSystem.combine(pet('cat'),pet('purrcerer',5,2))).toMatchObject({ok:false,key:'hint.maxLevel'});
    expect(MergeSystem.combine(pet('bee',3),pet('bee',3,2))).toMatchObject({ok:false,key:'hint.maxLevel'});
  });
  it('不能吞并对手单位',()=>{
    const other=pet('hamster',1,2);other.side='ai';
    expect(MergeSystem.combine(pet('hamster'),other)).toMatchObject({ok:false,key:'hint.enemyTerritory'});
  });
});
