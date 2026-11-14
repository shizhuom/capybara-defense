import type { LocalizedText } from './weapons';
export interface PropDefinition {
  id:string; type:'active'|'passive'; rarity:number; price:number; maxLevel:number;
  cooldown:number; target:'unit'|'road'|'self'|'passive'; icon:string;
  name:LocalizedText; description:LocalizedText;
}
type PropRow = [string,string,string,number,number,number,PropDefinition['target'],string,string,string,number?];
const active:PropRow[] = [
  ['washer','滚筒洗衣机','Spin Washer',2,90,28,'unit','🧺','对英雄组件或 1 级基础宠使用，旋转 3 秒后变成新的随机英雄组件。','Wash a hero component or level 1 basic pet for 3s into a new random hero component.'],
  ['clay','百变橡皮泥','Magic Clay',3,120,35,'unit','🎨','改造英雄组件，优先变为能与己方单件立即配对的组件；无配对则随机另 1 种。','Transform a hero component, prioritizing a match for an owned singleton; otherwise choose 1 different random component.'],
  ['milk_bottle','成长奶瓶','Growth Bottle',4,150,50,'unit','🍼','己方未满级单位立即升 1 级，并破除封印与控制。','Raise an allied unit below its level cap by 1 level and clear seals and control effects.'],
  ['whistle','盲盒特训哨','Mystery Training Whistle',2,80,40,'unit','📯','己方单位 65% 概率升 1 级，35% 概率降 1 级，最低 1 级。','An allied unit has a 65% chance to gain 1 level and a 35% chance to lose 1 level, minimum level 1.'],
  ['expired_can','临期罐头','Expired Can',1,60,65,'self','🥫','55% 概率增加 1 颗橘子，45% 概率失去 1 颗；可降至 0 并立即败北！','55% chance to gain 1 orange; 45% chance to lose 1. Reaching 0 oranges causes immediate defeat!'],
  ['catnip','神秘猫薄荷','Mystery Catnip',3,110,55,'self','🌿','己方全场单位攻速 +45%，持续 8 秒。','All allied units gain +45% attack speed for 8s.'],
  ['glue_trap','强力粘鼠板','Super Glue Trap',1,65,35,'road','🪤','放在己方道路，定身前 3 只普通怪或 1 只 Boss，持续 3.2 秒。','Place on your road to root the first 3 regular enemies or 1 Boss for 3.2s.'],
  ['recycle_bin','二手回收箱','Secondhand Recycle Bin',2,85,6,'unit','♻️','移除己方 1 级单位或散件，立即返还 5 小鱼干。','Remove an allied level 1 unit or component and gain 5 food immediately.'],
];
const passive:PropRow[] = [
  ['gold_doge','黄金寻宝犬','Golden Treasure Doge',4,160,0,'passive','🐕','铲开草坪有 35% 概率挖出宝箱；各 50% 概率获得 12 小鱼干或 1 枚神兵碎片。','Digging grass has a 35% treasure chance; treasures grant 12 food or 1 weapon fragment with equal 50% chances.'],
  ['auto_shovel','自动发铲机','Auto Shovel Dispenser',3,130,0,'passive','⛏️','铁锹自然补充由 12 秒缩短至 7.5 秒，库存上限由 6 提升至 8。','Shovel regeneration improves from 12s to 7.5s and capacity rises from 6 to 8.'],
  ['giant_orange_cat','护主大肥橘','Guardian Giant Tabby',4,180,0,'passive','🐈','每局最多 2 次：敌人进入最后 2 格时巨猫砸路，秒杀范围普通怪，对 Boss 造成 35% 最大生命伤害并击退 3 格。','Up to 2 times per battle, enemies in the final 2 tiles trigger a cat slam that kills regular enemies in the area, deals 35% max health to Bosses and knocks them back 3 tiles.'],
  ['vip_poster','VIP招宠海报','VIP Pet Poster',3,130,0,'passive','📜','己方摇铃时英雄组件的抽取权重乘以 1.8。','Hero component draw weights are multiplied by 1.8 for your bell draws.'],
  ['extra_oranges','果盘加量','Extra Fruit Platter',1,70,0,'passive','🍊','开局己方初始橘子 +2。','Start each battle with +2 oranges.'],
  ['shared_oranges','温泉同乐券','Shared Hot Spring Pass',1,65,0,'passive','🎟️','开局己方橘子 +4，对手橘子 +2。','Start with +4 oranges; the opponent also gains +2 oranges.'],
  ['hyper_party','狂欢派对','Hyper Party',2,100,0,'passive','🎉','己方全体攻速 +35%，对手全体攻速 +20%。','Your team gains +35% attack speed; the opponent gains +20%.'],
  ['banana_peel','香蕉皮小径','Banana Peel Path',1,70,0,'passive','🍌','己方道路所有敌人的基础移速永久降低 12%。','All enemies on your road have 12% lower base movement speed.'],
  ['emp_jammer','断电干扰器','EMP Jammer',3,125,0,'passive','📡','敌方 Boss 技能有 45% 概率失效，并反噬其 8% 最大生命伤害。','Enemy Boss abilities have a 45% chance to fail and backfire for 8% of the Boss maximum health.'],
  ['promo_badge','金牌训宠证','Gold Trainer Badge',2,100,0,'passive','🏅','等级 1/2/3：摇铃抽出的基础萌宠有 8%/15%/22% 概率直接为 2 级；每级 100 金币。','At badge level 1/2/3, basic pets drawn by the bell have an 8%/15%/22% chance to start at level 2. Each badge level costs 100 coins.',3],
  ['tall_perch','望远镜猫爬架','Telescope Cat Perch',1,75,0,'passive','🔭','己方射程至少 2.0 格的单位，射程额外增加 25%。','Allied units with at least 2.0 base range gain +25% range.'],
  ['bee_overtime','蜜蜂加班费','Bee Overtime Pay',2,95,0,'passive','🐝','蜜蜂产粮间隔缩短 25%，开局额外获得 10 小鱼干。','Bee food production interval is reduced by 25%; start with +10 food.'],
];
export const PROPS:Record<string,PropDefinition> = Object.fromEntries(
  ([['active',active],['passive',passive]] as const).flatMap(([type,rows]) => rows.map(([id,zh,en,rarity,price,cooldown,target,icon,zhDesc,enDesc,maxLevel=1]) =>
    [id,{id,type,rarity,price,maxLevel,cooldown,target,icon,name:{'zh-CN':zh,en},description:{'zh-CN':zhDesc,en:enDesc}}])),
);
