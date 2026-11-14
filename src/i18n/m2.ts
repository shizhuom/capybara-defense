import { WEAPONS } from '../config/weapons';
import { PROPS } from '../config/props';

// Item descriptions come from the same definitions used by the battle engine.
const phrases: Record<string, [string, string]> = {
  'app.edition': ['阳光后院 · M2 神兵与道具', 'Sunny Backyard · M2 Armory & Props'],
  'm2.rate': ['攻速 {value}/秒', 'Attacks {value}/s'],
  'meta.equipped': ['已装备', 'Equipped'], 'meta.unequipped': ['已卸下', 'Unequipped'],
  'meta.invalidWeapon': ['无效神兵', 'Invalid weapon'], 'meta.invalidHero': ['无效英雄', 'Invalid hero'],
  'meta.weaponLocked': ['神兵尚未解锁', 'Weapon is locked'], 'meta.wrongFamily': ['请选择同系神兵', 'Choose a weapon of the matching family'],
  'meta.recycled': ['溢出碎片已回收：+{amount} 金币', 'Surplus fragments recycled: +{amount} coins'],
  'meta.noFragments': ['没有所选品质的溢出碎片', 'No surplus fragments of the selected rarities'],
  'meta.invalidProp': ['无效道具', 'Invalid prop'], 'meta.propNotOwned': ['尚未拥有此道具', 'You do not own this prop'],
  'meta.slotsFull': ['装备槽已满，请先卸下道具', 'Slots full; remove a prop first'], 'meta.invalidSlots': ['配装无效，请检查重复和槽位限制', 'Invalid loadout; check duplicates and slot limits'],
  'meta.shopRefreshed': ['货架已刷新', 'Shop refreshed'], 'meta.insufficientCoins': ['金币不足', 'Not enough coins'],
  'meta.shopEmpty': ['没有可购买的道具', 'No props available to buy'], 'meta.propMaxLevel': ['此道具已满级', 'This prop is at max level'],
  'meta.propNotOffered': ['此道具不在当前货架', 'This prop is not in the current shop'], 'meta.purchased': ['购买成功', 'Purchased'],
  'meta.lotteryWon': ['奖励已保存', 'Prize saved'], 'meta.invalidPrizes': ['扭蛋奖池无效', 'Invalid lottery prizes'],
  'render.sealedHint': ['拖散件或同名合成撑破纸箱', 'Merge a component or matching unit to break the box'],
  'm2.propNotEquipped': ['未装备此道具', 'This prop is not equipped'], 'm2.propCooldown': ['道具冷却中', 'This prop is cooling down'],
  'm2.invalidTarget': ['请选择有效的己方目标', 'Choose a valid allied target'], 'm2.washing': ['正在洗衣机中旋转', 'Spinning in the washer'],
  'm2.transformed': ['变身成功', 'Transformation complete'], 'm2.upgraded': ['升级成功，控制已解除', 'Level increased; control effects cleared'],
  'm2.trained': ['特训完成', 'Training complete'], 'm2.canLucky': ['幸运罐头：橘子 +1', 'Lucky can: +1 orange'],
  'm2.canUnlucky': ['罐头拉肚子：橘子 -1', 'Unlucky can: −1 orange'], 'm2.catnip': ['猫薄荷生效：攻速提升 8 秒', 'Catnip active: faster attacks for 8s'],
  'm2.trapPlaced': ['粘鼠板已放置', 'Glue trap placed'], 'm2.recycled': ['回收成功', 'Recycled successfully'],
  'm2.treasureFood': ['挖到小鱼干！', 'Found food!'], 'm2.treasureFragment': ['挖到神兵碎片！', 'Found a weapon fragment!'],
  'm2.giantCat': ['护主大肥橘出击！', 'Guardian orange cat strikes!'], 'm2.empBackfire': ['Boss 断电反噬！', 'Boss skill shorted out and backfired!'],
  'm2.armory': ['神兵衣帽间', 'Armory'], 'm2.market': ['浣熊黑市', 'Black Market'],
  'm2.close': ['返回', 'Back'], 'm2.collection': ['已收集 {count} / 36', 'Collected {count} / 36'],
  'm2.family.all': ['全部', 'All'], 'm2.family.melee': ['🎋 冷兵器', '🎋 Melee'],
  'm2.family.ranged': ['🕶️ 热兵器', '🕶️ Ranged'], 'm2.family.magic': ['🧙 法器', '🧙 Magic'],
  'm2.rarity.0': ['白 · 普通', 'White · Common'], 'm2.rarity.1': ['绿 · 稀有', 'Green · Rare'],
  'm2.rarity.2': ['蓝 · 卓越', 'Blue · Superior'], 'm2.rarity.3': ['紫 · 史诗', 'Purple · Epic'],
  'm2.rarity.4': ['橙 · 传说', 'Orange · Legendary'],
  'm2.weaponRule': ['英雄只能穿戴同系神兵；同一神兵换人时自动卸下。品质伤害加成与词条同时生效。', 'Heroes wear weapons of their family. Equipping a weapon moves it from its previous hero. Rarity damage and weapon effects both apply.'],
  'm2.signature': ['本命觉醒：{hero}', 'Signature awakening: {hero}'],
  'm2.damage': ['基础伤害 +{value}%', 'Base damage +{value}%'],
  'm2.progress': ['碎片 {count} / {total}', 'Fragments {count} / {total}'],
  'm2.locked': ['尚未解锁', 'Locked'], 'm2.equip': ['穿戴', 'Equip'], 'm2.unequip': ['卸下', 'Unequip'],
  'm2.equipped': ['已穿戴：{hero}', 'Equipped: {hero}'], 'm2.chooseHero': ['选择同系英雄', 'Choose a matching hero'],
  'm2.recycle': ['回收溢出碎片', 'Recycle surplus fragments'],
  'm2.recycleRule': ['保留解锁所需碎片，只回收已解锁神兵的多余碎片。', 'Keeps the unlock threshold; recycles only surplus fragments of unlocked weapons.'],
  'm2.recycleRate': ['每片 +{value} 金币', '+{value} coins each'],
  'm2.shop': ['道具货架', 'Shop'], 'm2.lottery': ['九宫格扭蛋', 'Lottery'],
  'm2.refresh': ['刷新 · 20 金币', 'Refresh · 20 coins'], 'm2.coins': ['金币 {count}', '{count} coins'],
  'm2.tickets': ['免费券 {count}', '{count} free tickets'], 'm2.buy': ['购买 · {price} 金币', 'Buy · {price} coins'],
  'm2.upgrade': ['升级 · {price} 金币', 'Upgrade · {price} coins'], 'm2.maxed': ['已满级', 'Max level'],
  'm2.shopEmpty': ['所有道具均已满级。', 'Every prop is at max level.'],
  'm2.loadout': ['我的装备栏', 'My loadout'], 'm2.active': ['主动', 'Active'], 'm2.passive': ['被动', 'Passive'],
  'm2.slot': ['{type}槽 {slot}', '{type} slot {slot}'], 'm2.emptySlot': ['空槽', 'Empty'],
  'm2.inventory': ['已拥有道具 · 点击装卸', 'Owned props · Tap to equip or remove'],
  'm2.noProps': ['购买或扭蛋获得道具。', 'Buy props or win them in the lottery.'],
  'm2.level': ['等级 {level} / {max}', 'Level {level} / {max}'],
  'm2.spin': ['扭一次', 'Spin once'], 'm2.spinCost': ['优先免费券，否则 80 金币', 'Free ticket first, otherwise 80 coins'],
  'm2.spinning': ['跑马灯揭晓中…', 'Revealing your prize…'],
  'm2.lotteryRule': ['优先使用免费券；没有券消耗 80 金币。已满级道具自动换成等价金币。', 'Free tickets are used first; without a ticket, a spin costs 80 coins. Maxed props automatically convert to their coin price.'],
  'm2.prize': ['恭喜抽中', 'You won'], 'm2.prizeCoins': ['金币 ×{amount}', 'Coins ×{amount}'],
  'm2.prizeFragment': ['{name}碎片 ×{amount}', '{name} fragment ×{amount}'],
  'm2.prizeProp': ['{name} ×{amount}', '{name} ×{amount}'],
  'm2.convertedCoins': ['道具已满级，折为 {amount} 金币', 'Prop already maxed; converted to {amount} coins'],
  'm2.testEnable': ['一键全满测试档', 'Unlock All M2'], 'm2.testRestore': ['恢复普通存档', 'Restore normal profile'],
  'm2.testMode': ['测试档模式 · 测试进度不会写入普通档', 'TEST PROFILE · Normal profile is backed up'],
  'm2.normalMode': ['普通存档', 'Normal profile'], 'm2.nextBattle': ['配装在下一局生效', 'Loadout applies next battle'],
  'm2.testReady': ['已开启全满测试档', 'Full test profile enabled'], 'm2.testRestored': ['已恢复普通存档', 'Normal profile restored'],
  'm2.sprinkler': ['草坪洒水车', 'Lawn Sprinkler'], 'm2.sprinklerReady': ['本局免费 1 次', 'Free once per battle'],
  'm2.sprinklerUsed': ['本局已使用', 'Used this battle'],
  'm2.sprinklerDesc': ['全路冲退 4.5 格、120 伤害、减速 2 秒', 'Whole road: push back 4.5 tiles, 120 damage, slow for 2s'],
  'm2.targetUnit': ['点击或拖到己方单位（棋盘或宠物窝）', 'Tap or drag onto an allied unit on the board or bench'],
  'm2.targetRoad': ['点击或拖到己方道路格', 'Tap or drag onto an allied road tile'],
  'm2.cooldown': ['冷却 {time} 秒', 'Cooldown {time}s'], 'm2.ready': ['就绪', 'Ready'],
  'm2.sealed': ['📦 封印！拖散件或同名合成撑破纸箱', '📦 SEALED! Drag a component or merge an identical unit to break the box'],
  'm2.newWeapons': ['新神兵解锁', 'New weapons unlocked'], 'm2.freeTicket': ['胜利奖励：免费扭蛋券 +1', 'Victory reward: +1 free lottery ticket'],
};

export const m2Zh: Record<string, string> = {};
export const m2En: Record<string, string> = {};
for (const [key, [zh, en]] of Object.entries(phrases)) { m2Zh[key] = zh; m2En[key] = en; }
for (const weapon of Object.values(WEAPONS)) {
  for (const [lang, dictionary] of [['zh-CN', m2Zh], ['en', m2En]] as const) {
    dictionary[`weapon.${weapon.id}`] = weapon.name[lang];
    dictionary[`weapon.${weapon.id}.desc`] = weapon.description[lang];
    dictionary[`fragment.${weapon.id}`] = lang === 'en' ? `${weapon.name[lang]} fragment` : `${weapon.name[lang]}碎片`;
  }
}
for (const prop of Object.values(PROPS)) {
  m2Zh[`prop.${prop.id}`] = prop.name['zh-CN']; m2En[`prop.${prop.id}`] = prop.name.en;
  m2Zh[`prop.${prop.id}.desc`] = prop.description['zh-CN']; m2En[`prop.${prop.id}.desc`] = prop.description.en;
}
