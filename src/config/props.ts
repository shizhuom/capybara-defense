import type { LocalizedText } from './weapons';

export type PropRarity = 1 | 2 | 3 | 4;

export interface PropDefinition {
  id: string;
  type: 'active' | 'passive';
  rarity: PropRarity;
  /** 24-hour daily-deal trial price in coins (also grants +1 blueprint). */
  price: number;
  maxLevel: number;
  cooldown: number;
  target: 'unit' | 'road' | 'self' | 'passive';
  icon: string;
  name: LocalizedText;
  description: LocalizedText;
}

export interface PropRarityRule {
  /** Weighted odds for Daily Deals (`每日特惠`): Green 4 : Blue 3 : Purple 2 : Orange 1. */
  shopWeight: number;
  /** 24-hour trial price in coins on the Daily Deals shelf. */
  trialPrice: number;
  /** Total blueprints required to permanently unlock a prop of this rarity. */
  blueprints: number;
  /** Blueprints awarded when landing on this prop on the Lucky Gacha wheel. */
  lotteryBlueprints: number;
  /** Coin conversion when a gacha spin lands on an already-permanent prop. */
  lotteryOverflowCoins: number;
  /** Coin conversion per single overflow blueprint (e.g. battle drop after all 20 props are permanent). */
  blueprintOverflowCoins: number;
}

export const PROP_TRIAL_DURATION_MS = 24 * 3600_000;

/**
 * Calibrated for ~2h Green+Blue, ~5h Purple, ~10h Orange permanent unlocks:
 * - Green (4 unlockable × 3 = 12) + Blue (6 × 4 = 24) = 36 blueprints (~2h)
 * - Purple (5 × 10 = 50) -> 86 cumulative (~5h)
 * - Orange (4 × 20 = 80) -> 166 cumulative (~10h)
 */
export const PROP_RARITY_RULES: Readonly<Record<PropRarity, PropRarityRule>> = {
  1: { shopWeight: 4, trialPrice: 25, blueprints: 3, lotteryBlueprints: 2, lotteryOverflowCoins: 60, blueprintOverflowCoins: 20 },
  2: { shopWeight: 3, trialPrice: 40, blueprints: 4, lotteryBlueprints: 2, lotteryOverflowCoins: 100, blueprintOverflowCoins: 30 },
  3: { shopWeight: 2, trialPrice: 65, blueprints: 10, lotteryBlueprints: 2, lotteryOverflowCoins: 180, blueprintOverflowCoins: 50 },
  4: { shopWeight: 1, trialPrice: 100, blueprints: 20, lotteryBlueprints: 3, lotteryOverflowCoins: 320, blueprintOverflowCoins: 80 },
};

export const META_PRICES = { shopRefresh: 15, lottery: 200 } as const;

type PropRow = [string, string, string, PropRarity, number, PropDefinition['target'], string, string, string];

const active: PropRow[] = [
  ['glue_trap', '强力粘鼠板', 'Super Glue Trap', 1, 35, 'road', '🪤', '放在己方道路，定身前 3 只普通怪或 1 只 Boss，持续 3.2 秒。', 'Place on your road to root the first 3 regular enemies or 1 Boss for 3.2s.'],
  ['expired_can', '神秘罐头', 'Mystery Can', 1, 65, 'self', '🥫', '55% 概率增加 1 颗橘子，45% 概率失去 1 颗；可降至 0 并立即败北！', '55% chance to gain 1 orange; 45% chance to lose 1. Reaching 0 oranges causes immediate defeat!'],
  ['whistle', '盲盒特训哨', 'Mystery Training Whistle', 2, 40, 'unit', '📯', '己方单位 65% 概率升 1 级，35% 概率降 1 级，最低 1 级。', 'An allied unit has a 65% chance to gain 1 level and a 35% chance to lose 1 level, minimum level 1.'],
  ['recycle_bin', '二手回收箱', 'Secondhand Recycle Bin', 2, 6, 'unit', '♻️', '移除己方 1 级单位或散件，立即返还 5 小鱼干；回收窝中铁锹获得 4 小鱼干。', 'Remove an allied level 1 unit or component and gain 5 food; recycle a nest shovel for 4 food.'],
  ['catnip', '神秘猫薄荷', 'Mystery Catnip', 3, 55, 'self', '🌿', '己方全场单位攻速 +45%，持续 8 秒。', 'All allied units gain +45% attack speed for 8s.'],
  ['milk_bottle', '成长奶瓶', 'Growth Bottle', 3, 50, 'unit', '🍼', '己方未满级单位立即升 1 级，并破除封印与控制。', 'Raise an allied unit below its level cap by 1 level and clear seals and control effects.'],
  ['washer', '滚筒洗衣机', 'Spin Washer', 4, 28, 'unit', '🧺', '对英雄组件或 1 级基础宠使用，旋转 3 秒后变成新的随机英雄组件。', 'Wash a hero component or level 1 basic pet for 3s into a new random hero component.'],
  ['clay', '百变橡皮泥', 'Magic Clay', 4, 35, 'unit', '🎨', '改造英雄组件，优先变为能与己方单件立即配对的组件；无配对则随机另 1 种。', 'Transform a hero component, prioritizing a match for an owned singleton; otherwise choose 1 different random component.'],
];

const passive: PropRow[] = [
  ['extra_oranges', '果盘加量', 'Extra Fruit Platter', 1, 0, 'passive', '🍊', '开局己方初始橘子 +2。', 'Start each battle with +2 oranges.'],
  ['hyper_party', '狂欢派对', 'Hyper Party', 1, 0, 'passive', '🎉', '全体萌宠攻速永久 +10%。', 'All allied pets permanently gain +10% attack speed.'],
  ['promo_badge', '金牌训宠证', 'Gold Trainer Badge', 1, 0, 'passive', '🏅', '摇铃抽出的基础萌宠有 15% 概率直接为 2 级。', 'Basic pets drawn by the bell have a 15% chance to start at level 2.'],
  ['banana_peel', '香蕉皮小径', 'Banana Peel Path', 2, 0, 'passive', '🍌', '己方道路所有敌人的基础移速永久降低 12%。', 'All enemies on your road have 12% lower base movement speed.'],
  ['tall_perch', '望远镜猫爬架', 'Telescope Cat Perch', 2, 0, 'passive', '🔭', '己方射程至少 2.0 格的单位，射程额外增加 25%。', 'Allied units with at least 2.0 base range gain +25% range.'],
  ['shared_oranges', '温泉加餐券', 'Hot Spring Feast Pass', 2, 0, 'passive', '🎟️', '开局己方初始橘子 +4。', 'Start each battle with +4 oranges.'],
  ['bee_overtime', '蜂蜜加油瓶', 'Honey Booster', 2, 0, 'passive', '🐝', '蜜蜂产粮间隔缩短 25%，开局额外获得 10 小鱼干。', 'Bee food production interval is reduced by 25%; start with +10 food.'],
  ['gold_doge', '黄金寻宝犬', 'Golden Treasure Doge', 3, 0, 'passive', '🐕', '铲开草坪有 35% 概率挖出宝箱；各 50% 概率获得 12 小鱼干或 1 枚神兵碎片。', 'Digging grass has a 35% treasure chance; treasures grant 12 food or 1 weapon fragment with equal 50% chances.'],
  ['giant_orange_cat', '护主大肥橘', 'Guardian Giant Tabby', 3, 0, 'passive', '🐈', '每局最多 2 次：敌人进入最后 2 格时巨猫砸路，直接赶跑范围普通怪，对 Boss 造成 35% 最大生命伤害并击退 3 格。', 'Up to 2 times per battle, enemies in the final 2 tiles trigger a cat slam that kills regular enemies in the area, deals 35% max health to Bosses and knocks them back 3 tiles.'],
  ['auto_shovel', '自动发铲机', 'Auto Shovel Dispenser', 3, 0, 'passive', '⛏️', '铁锹自然补充由 55 秒缩短至 30 秒，库存上限由 4 提升至 6。', 'Shovel regeneration improves from 55s to 30s and capacity rises from 4 to 6.'],
  ['emp_jammer', '断电干扰器', 'EMP Jammer', 4, 0, 'passive', '📡', '敌方 Boss 技能有 50% 概率失效，并反噬其 10% 最大生命伤害。', 'Enemy Boss abilities have a 50% chance to fail and backfire for 10% of the Boss maximum health.'],
  ['vip_poster', 'VIP招宠海报', 'VIP Pet Poster', 4, 0, 'passive', '📜', '己方摇铃时英雄组件的抽取权重乘以 1.8。', 'Hero component draw weights are multiplied by 1.8 for your bell draws.'],
];

export const PROPS: Record<string, PropDefinition> = Object.fromEntries(
  ([['active', active], ['passive', passive]] as const).flatMap(([type, rows]) =>
    rows.map(([id, zh, en, rarity, cooldown, target, icon, zhDesc, enDesc]) => [
      id,
      {
        id,
        type,
        rarity,
        price: PROP_RARITY_RULES[rarity].trialPrice,
        maxLevel: 1,
        cooldown,
        target,
        icon,
        name: { 'zh-CN': zh, en },
        description: { 'zh-CN': zhDesc, en: enDesc },
      },
    ]),
  ),
);

export function getPropRule(id: string): PropRarityRule | null {
  const def = Object.hasOwn(PROPS, id) ? PROPS[id] : undefined;
  return def ? PROP_RARITY_RULES[def.rarity] : null;
}

export function propBlueprintGoal(id: string): number {
  return getPropRule(id)?.blueprints ?? 1;
}

/**
 * Rolls one prop blueprint ID for battle or endless rewards:
 * - Follows progressive tier pacing: Green+Blue (~2h) -> Purple (~5h) -> Orange (~10h).
 * - Never wastes a drop on an already-permanent prop while any locked prop remains.
 * - Slightly favors props with partial blueprint progress (1.5×) for satisfying steady unlocks.
 */
export function rollPropBlueprint(
  random: () => number,
  ownedProps: Readonly<Record<string, number>> = {},
  propBlueprints: Readonly<Record<string, number>> = {},
  source: 'standard' | 'endless' = 'standard',
): string {
  const sample = () => Math.max(0, Math.min(0.999999999999, Number(random()) || 0));
  const all = Object.values(PROPS);
  const locked = all.filter(p => (ownedProps[p.id] ?? 0) < p.maxLevel);
  if (!locked.length) {
    // All 20 props are permanent: still roll a prop for overflow coin conversion.
    return all[Math.floor(sample() * all.length)].id;
  }

  const byRarity: Record<PropRarity, PropDefinition[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const prop of locked) byRarity[prop.rarity].push(prop);

  const hasGreenBlue = byRarity[1].length > 0 || byRarity[2].length > 0;
  const hasPurple = byRarity[3].length > 0;

  let rarityWeights: Record<PropRarity, number>;
  if (source === 'endless') {
    rarityWeights = hasGreenBlue
      ? { 1: 10, 2: 20, 3: 45, 4: 25 }
      : hasPurple
        ? { 1: 0, 2: 0, 3: 65, 4: 35 }
        : { 1: 0, 2: 0, 3: 0, 4: 100 };
  } else {
    rarityWeights = hasGreenBlue
      ? { 1: 38, 2: 44, 3: 13, 4: 5 }
      : hasPurple
        ? { 1: 0, 2: 0, 3: 82, 4: 18 }
        : { 1: 0, 2: 0, 3: 0, 4: 100 };
  }

  const availableRarities = ([1, 2, 3, 4] as const).filter(r => byRarity[r].length > 0 && rarityWeights[r] > 0);
  const poolRarities = availableRarities.length ? availableRarities : ([1, 2, 3, 4] as const).filter(r => byRarity[r].length > 0);
  const totalRarityWeight = poolRarities.reduce((sum, r) => sum + Math.max(1, rarityWeights[r]), 0);
  let roll = sample() * totalRarityWeight;
  let chosenRarity = poolRarities[poolRarities.length - 1];
  for (const r of poolRarities) {
    roll -= Math.max(1, rarityWeights[r]);
    if (roll < 0) {
      chosenRarity = r;
      break;
    }
  }

  const candidates = byRarity[chosenRarity];
  const weights = candidates.map(p => ((propBlueprints[p.id] ?? 0) > 0 ? 1.5 : 1));
  let pick = sample() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) {
    pick -= weights[i];
    if (pick < 0) return candidates[i].id;
  }
  return candidates[candidates.length - 1].id;
}
