import { MAPS } from '../config/maps';
import { RANKS } from '../config/ranks';
import { AVATARS } from '../config/avatars';

const phrases: Record<string, [string, string]> = {
  'app.edition': ['四季温泉 · v1.0', 'Four Seasons Onsen · v1.0'],
  'm2.testEnable': ['一键全满 M3 测试档', 'Unlock All M3'],
  'm3.profile': ['铲屎官名片与头像馆', 'Keeper Card & Avatar Gallery'],
  'm3.leaderboard': ['温泉风云榜', 'Onsen Leaderboard'],
  'm3.settings': ['设置', 'Settings'], 'm3.close': ['返回', 'Back'],
  'm3.stars': ['{count} 颗星', '{count} stars'],
  'm3.rankProgress': ['再获 {count} 星晋级', '{count} stars to next rank'],
  'm3.topRank': ['已达最高段位', 'Highest rank reached'],
  'm3.rankIndex': ['第 {index} 段', 'Rank {index}'],
  'm3.map': ['本局地图', 'Battle map'], 'm3.autoMap': ['随机（已解锁地图）', 'Random (unlocked maps)'],
  'm3.mapRule': ['历史最高段位 10 / 20 / 30 永久解锁新地图', 'New maps unlock permanently at best ranks 10 / 20 / 30'],
  'm3.devRank': ['测试段位 · 下局生效', 'Test rank · next battle'],
  'm3.devMap': ['测试地图 · 下局生效', 'Test map · next battle'],
  'm3.rankSaved': ['段位已保存，下局生效', 'Rank saved for the next battle'],
  'm3.mapSaved': ['地图选择已保存，下局生效', 'Map saved for the next battle'],
  'm3.avatarEquipped': ['头像已佩戴', 'Avatar equipped'],
  'm3.avatarLocked': ['未解锁', 'Locked'], 'm3.avatarUnlocked': ['已解锁 · 点击佩戴', 'Unlocked · select to equip'],
  'm3.avatarCurrent': ['当前头像', 'Current avatar'],
  'm3.record': ['{wins} 胜 / {matches} 场 · 胜率 {rate}%', '{wins} wins / {matches} matches · {rate}% win rate'],
  'm3.streak': ['当前 {current} 连胜 · 最高 {best} 连胜', 'Current streak {current} · Best streak {best}'],
  'm3.localBoard': ['本地榜样与我的即时排名', 'Local keepers and your live ranking'],
  'm3.place': ['排名 {place}', 'Place {place}'],
  'm3.music': ['背景音乐', 'Background music'], 'm3.sound': ['游戏音效', 'Sound effects'],
  'm3.damage': ['显示伤害数字', 'Show damage numbers'],
  'm3.settingsSaved': ['设置即时保存并生效', 'Settings save and apply immediately'],
  'm3.heroOverview': ['12 英雄配装总览', '12-Hero Loadout Overview'],
  'm3.emptyWeapon': ['空手', 'Empty hands'],
  'm3.defaultSort': ['默认排序', 'Default order'], 'm3.orangeSort': ['橙品优先', 'Orange first'],
  'm3.starChange': ['本局星数 {change} · 当前 {stars} 星', 'Stars {change} · Total {stars}'],
  'm3.protected': ['新手段位保护 · 本局不扣星', 'Rookie protection · no stars lost'],
  'm3.floorProtected': ['20 星底线保护', '20-star floor protection'],
  'm3.streakBonus': ['三连胜奖励 · 额外 +1 星', 'Winning streak · extra +1 star'],
  'm3.promotion': ['晋级！{rank}', 'Promoted! {rank}'],
  'm3.newAvatars': ['新头像解锁', 'New avatars unlocked'],
  'enemy.killer_bee': ['杀人蜂', 'Killer Bee'], 'enemy.charmed_rat': ['迷糊小耗子', 'Dizzy Mouse'],
  'boss.diva_kitty': ['傲娇波斯猫', 'Prima Donna Kitty'], 'boss.diva_kitty.bubble': ['来做我的小跟班吧～', 'Minions, escort me!'],
  'boss.buff_roo': ['澳洲拳王袋鼠', 'Buff Roo'], 'boss.buff_roo.bubble': ['来一拳醒醒神！', 'Time for a knockout!'],
  'boss.hornet_queen': ['暴躁大马蜂后', 'Furious Hornet Queen'], 'boss.hornet_queen.bubble': ['小的们，冲呀！', 'Swarm, charge!'],
  'boss.screaming_marmot': ['尖叫土拨鼠', 'Screaming Marmot'], 'boss.screaming_marmot.bubble': ['啊——！！', 'AAAAAH!!'],
  'boss.trash_coon': ['死灵垃圾浣熊', 'Trash Necro-Coon'], 'boss.trash_coon.bubble': ['垃圾里也有第二春！', 'Rise from the rubbish!'],
  'boss.dj_rat_king': ['打鸡血鼠王', 'DJ Rat King'], 'boss.dj_rat_king.bubble': ['全场一起嗨！', 'Everybody, turn it up!'],
};

export const m3Zh: Record<string, string> = Object.fromEntries(Object.entries(phrases).map(([key, pair]) => [key, pair[0]]));
export const m3En: Record<string, string> = Object.fromEntries(Object.entries(phrases).map(([key, pair]) => [key, pair[1]]));
for (const [language, dictionary] of [['zh-CN', m3Zh], ['en', m3En]] as const) {
  for (const map of Object.values(MAPS)) dictionary[`map.${map.id}`] = map.name[language];
  for (const rank of RANKS) dictionary[`rank.${rank.index}`] = rank.name[language];
  for (const avatar of Object.values(AVATARS)) {
    dictionary[`avatar.${avatar.id}`] = avatar.name[language];
    dictionary[`avatar.${avatar.id}.desc`] = avatar.description[language];
  }
}
