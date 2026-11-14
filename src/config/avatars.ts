export interface AvatarDefinition {id:string;name:{'zh-CN':string;en:string};description:{'zh-CN':string;en:string}}
const rows = [
  ['capybara','泡澡本豚','Bathing Capybara','初始免费头像。','Available from the start.'],
  ['hamster','瓜子仓鼠','Seed Hamster','初始免费头像。','Available from the start.'],
  ['squirrel','松果松鼠','Acorn Squirrel','初始免费头像。','Available from the start.'],
  ['bee','勤劳蜜蜂','Worker Bee','初始免费头像。','Available from the start.'],
  ['cat_swordsman','橘猫剑客','Orange Cat Swordsman','赢得第 1 场胜利。','Win your first battle.'],
  ['doge_agent','墨镜旺财','Doge Agent','达成 3 连胜。','Reach a streak of 3 wins.'],
  ['goose_bully','叼刀恶霸鹅','Knife Goose Bully','达成 5 连胜。','Reach a streak of 5 wins.'],
  ['kungfu_panda','功夫滚滚','Kung Fu Panda','合成过功夫阿宝。','Merge Kung-Fu Po at least once.'],
  ['rooster_star','篮球鸡神','Basketball Rooster','合成过铁山靠鸡神。',"Merge Ballin’ Rooster at least once."],
  ['frog_king','皇冠蛙王','Crowned Frog King','合成过孤寡蛙王。','Merge Pepe King at least once.'],
  ['market_coon','黑市浣熊','Market Raccoon','拥有 6 种不同道具。','Own 6 different props.'],
  ['salted_fish','尚方咸鱼','Salted Excalibur','解锁 12 把不同神兵。','Unlock 12 different weapons.'],
  ['bamboo_master','神竹宗师','Bamboo Grandmaster','拥有任意 1 把橙品神兵。','Own at least 1 orange weapon.'],
  ['sakura_capy','樱花水豚','Sakura Capybara','达到猫咖店长（段位 10）。','Reach Cat Cafe Boss (rank 10).'],
  ['corgi_crown','黄金柯基','Golden Corgi','达到萌宠统帅（段位 30）。','Reach Critter Marshal (rank 30).'],
  ['zen_capy','佛系真神豚','Zen Capybara God','达到水豚真神（段位 50）。','Reach Capybara God (rank 50).'],
];
export const AVATARS:Record<string,AvatarDefinition>=Object.fromEntries(rows.map(([id,zh,en,zhDesc,enDesc])=>[id,{id,name:{'zh-CN':zh,en},description:{'zh-CN':zhDesc,en:enDesc}}]));
export const DEFAULT_AVATARS=Object.keys(AVATARS).slice(0,4);
