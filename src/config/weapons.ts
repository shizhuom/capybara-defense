export type WeaponFamily = 'melee' | 'ranged' | 'magic';
export type LocalizedText = { 'zh-CN': string; en: string };
export interface WeaponDefinition {
  id: string; family: WeaponFamily; rarity: 0|1|2|3|4;
  name: LocalizedText; description: LocalizedText; signatureHero?: string;
}
export const HERO_FAMILIES: Record<string, WeaponFamily> = {
  kungfu_po:'melee', puss_in_hat:'melee', samurai_doge:'melee', ronin_goose:'melee',
  bamboo_mafia:'ranged', meowfia:'ranged', doge_wick:'ranged', rocket_coon:'ranged',
  zen_master:'magic', purrcerer:'magic', ballin_rooster:'magic', pepe_king:'magic',
};
export const RARITY_RULES = [
  {fragments:1,damageBonus:.12,recycle:8,weight:30},
  {fragments:2,damageBonus:.20,recycle:15,weight:28},
  {fragments:3,damageBonus:.30,recycle:30,weight:22},
  {fragments:4,damageBonus:.42,recycle:60,weight:13},
  {fragments:5,damageBonus:.58,recycle:120,weight:7},
];
type WeaponRow = [string,string,string,string,string,string?];
const melee: WeaponRow[] = [
  ['m01_swatter','塑料苍蝇拍','Fly Swatter','朴实无华，基础伤害 +12%。','A trusty swatter; base damage +12%.'],
  ['m02_slipper','人字拖','Flip-Flop','攻击距离 +0.3 格。','Attack range +0.3 tiles.'],
  ['m03_scratcher','老头乐痒痒挠','Back Scratcher','攻击距离 +0.5 格。','Attack range +0.5 tiles.'],
  ['m04_baguette','冻硬法棍','Frozen Baguette','普攻 15% 概率击退目标 0.35 格。','Basic attacks have a 15% chance to knock the target back 0.35 tiles.'],
  ['m05_duster','老妈鸡毛掸',"Mom's Feather Duster",'连续普攻同一目标，每次攻速 +6%，最多 +48%；换目标重置。','Consecutive basic attacks on one target stack +6% attack speed, up to +48%; changing target resets stacks.'],
  ['m06_stool','折叠板凳','Folding Stool','普攻 15% 概率眩晕目标 0.6 秒。','Basic attacks have a 15% chance to stun for 0.6s.'],
  ['m07_rolling_pin','实木擀面杖','Heavy Rolling Pin','每 8 次普攻挥出气浪，对目标周围 1.6 格造成 180% 溅射伤害。','Every 8 basic attacks release a wave dealing 180% splash damage within 1.6 tiles of the target.'],
  ['m08_durian','带刺榴莲锤','Spiky Durian','击杀后攻速 +45%，持续 2.5 秒。','Kills grant +45% attack speed for 2.5s.'],
  ['m09_cat_blade','猫抓板双刀','Cardboard Twin-Blades','击杀释放 4 片 80% 伤害猫爪飞刃。靴子剑客喵专属：十字跳斩强化 6 次，附加每秒 35% 伤害的 3 秒流血。','Kills launch 4 claw blades for 80% damage each. Puss in Hat awakening: 6 empowered cross slashes, inflicting bleed for 35% damage per second for 3s.','puss_in_hat'],
  ['m10_bamboo_staff','千年神竹棍','Dragon Bamboo','普攻 18% 概率在 1 格内召唤竹笋，造成 220% 伤害并晕 0.8 秒。功夫阿宝专属：肚皮震地范围 +30%，额外召唤一圈竹笋。','Basic attacks have an 18% chance to summon bamboo within 1 tile, dealing 220% damage and stunning for 0.8s. Kungfu Po awakening: belly quake radius +30% and an extra bamboo ring.','kungfu_po'],
  ['m11_salted_fish','尚方宝咸鱼','Salted Excalibur','击杀释放 2 道 100% 伤害咸鱼剑气随机追敌。斩铁修勾专属：Bonk 斩杀线提升至 35%，且必放剑气。','Kills release 2 random fish sword waves for 100% damage each. Samurai Doge awakening: Bonk executes at 35% health and always releases sword waves.','samurai_doge'],
  ['m12_iron_wok','村霸大铁锅','Honk Iron Wok','普攻 15% 概率抛飞砸地，造成 300% 范围伤害。无名刀鹅专属：七进七出由 7 次升级为 10 次冲刺。','Basic attacks have a 15% chance to toss and slam for 300% area damage. Ronin Goose awakening: 7 dashes become 10.','ronin_goose'],
];
const ranged: WeaponRow[] = [
  ['r01_rubber_band','橡皮筋指枪','Rubber Band','基础伤害 +12%。','Base damage +12%.'],
  ['r02_duck_squirt','小黄鸭滋水枪','Duck Squirter','射程 +0.4 格。','Attack range +0.4 tiles.'],
  ['r03_bubble_gun','全自动泡泡机','Bubble Blaster','普攻 15% 概率使目标减速 25%，持续 1.5 秒。','Basic attacks have a 15% chance to slow the target by 25% for 1.5s.'],
  ['r04_tennis_launcher','网球发球机','Tennis Launcher','普攻 20% 概率弹射 1 个相邻敌人，造成 70% 伤害。','Basic attacks have a 20% chance to bounce to 1 nearby enemy for 70% damage.'],
  ['r05_hair_dryer','飓风吹风机','Turbo Hair Dryer','普攻 15% 概率吹出热浪，每秒灼烧 35% 伤害，持续 3 秒。','Basic attacks have a 15% chance to burn with hot air for 35% damage per second for 3s.'],
  ['r06_pressure_washer','高压洗车水枪','Power Washer','连续普攻同一目标，每次攻速 +10%，最多 +60%；换目标重置。','Consecutive basic attacks on one target stack +10% attack speed, up to +60%; changing target resets stacks.'],
  ['r07_popcorn_cannon','爆米花机炮','Popcorn Cannon','每 8 次普攻打出爆裂玉米弹，对 1.2 格区域造成 200% 伤害。','Every 8 basic attacks fire exploding corn for 200% damage within 1.2 tiles.'],
  ['r08_coin_slingshot','摇钱树弹弓','Lucky Slingshot','首次命中某敌人时，25% 概率获得 +1 小鱼干。','The first hit on each enemy has a 25% chance to grant +1 food.'],
  ['r09_bamboo_bazooka','食铁兽火箭筒','Bamboo Bazooka','普攻 15% 概率打出火龙笋点燃路径，每秒 35% 伤害持续 3 秒。食铁兽教父专属：火箭雨由 5 发升至 8 发。','Basic attacks have a 15% chance to ignite the path for 35% damage per second for 3s. Bamboo Mafia awakening: rocket rain fires 8 rockets instead of 5.','bamboo_mafia'],
  ['r10_acorn_minigun','松果加特林','Acorn Minigun','每 10 次普攻额外齐射 6 发追踪鱼刺导弹。加特林喵专属：鱼骨弹幕延长至 4 秒。','Every 10 basic attacks launch 6 homing fishbone missiles. Meowfia awakening: fishbone barrage lasts 4s.','meowfia'],
  ['r11_sniper_laser','8倍镜红点激光','Red-Dot Sniper','射程 +35%，距离越远伤害越高，最多 +50%。疾速旺财专属：双枪悬赏掉小鱼干概率提升至 85%。','Range +35%; damage scales with distance up to +50%. Doge Wick awakening: dual-pistol bounty grants food with an 85% chance.','doge_wick'],
  ['r12_junk_mortar','黄金破烂迫击炮','Golden Junk Mortar','命中时 45% 概率弹射下一个敌人。拾荒浣熊王专属：顺走鱼干概率翻倍，破烂重炮范围 +40%。','Hits have a 45% chance to bounce to another enemy. Rocket Coon awakening: food theft chance doubles and junk artillery radius increases by 40%.','rocket_coon'],
];
const magic: WeaponRow[] = [
  ['w01_teaser','逗猫羽毛棒','Feather Teaser','基础伤害 +12%。','Base damage +12%.'],
  ['w02_balloon','静电气球','Static Balloon','攻速 +10%。','Attack speed +10%.'],
  ['w03_bug_zapper','雷神电蚊拍','Bug Zapper','普攻 15% 概率电麻目标 0.4 秒。','Basic attacks have a 15% chance to stun for 0.4s.'],
  ['w04_yarn_orb','毛线水晶球','Yarn Orb','大招充能要求减少 1 次普攻。','Ultimate charge requirement is reduced by 1 basic attack.'],
  ['w05_disco_ball','蹦迪灯球','Disco Ball','普攻 15% 概率鼓舞周围 1.5 格友军，攻速 +20% 持续 4 秒。','Basic attacks have a 15% chance to grant allies within 1.5 tiles +20% attack speed for 4s.'],
  ['w06_yarn_storm','七彩毛线团','Rainbow Yarn','击杀飞出 4 团毛线随机追敌，每团造成 80% 伤害。','Kills launch 4 yarn balls at random enemies, each dealing 80% damage.'],
  ['w07_cat_scratch_meteor','流星猫抓板','Meteor Scratcher','普攻 12% 概率轰炸目标 1.2 格区域，造成 240% 伤害。','Basic attacks have a 12% chance to bombard a 1.2-tile area for 240% damage.'],
  ['w08_fortune_fish','赛博木鱼','Cyber Wooden Fish','每 9 次普攻：全队攻速 +15% 持续 3 秒，并对周围 1.6 格敌人造成 180% 伤害。','Every 9 basic attacks grant the team +15% attack speed for 3s and deal 180% damage to enemies within 1.6 tiles.'],
  ['w09_yin_yang_burner','阴阳猫薄荷炉','Yin-Yang Burner','每 8 次普攻交替触发增伤 35% 持续 4 秒，或每秒 35% 的 3 秒毒雾。太极滚滚专属：太极阵发射双倍阴阳波。','Every 8 basic attacks alternate +35% damage for 4s and poison mist dealing 35% damage per second for 3s. Zen Master awakening: the yin-yang array fires double waves.','zen_master'],
  ['w10_cosmic_vacuum','黑洞吸尘器','Cosmic Vacuum','普攻 15% 概率旋涡聚怪，最多拉近 1 格并晕 0.8 秒。喵利波特专属：毛线雷暴弹射上限由 6 次升至 10 次。','Basic attacks have a 15% chance to pull enemies up to 1 tile and stun for 0.8s. Purrcerer awakening: yarn storm bounces 10 times instead of 6.','purrcerer'],
  ['w11_golden_hoop_ball','金箍火焰球','Blazing Dunk Ball','每次普攻命中对周围 0.85 格造成 40% 火焰溅射。铁山靠鸡神专属：火焰球弹射由 8 次升至 12 次。','Each basic hit deals 40% fire splash within 0.85 tiles. Ballin Rooster awakening: flame ball bounces 12 times instead of 8.','ballin_rooster'],
  ['w12_rain_crown_scepter','蛙皇扩音权杖','Pepe Megaphone','对减速或中毒敌人伤害 +35%。孤寡蛙王专属：音波持续 6 秒且使护甲归零。','Damage +35% against slowed or poisoned enemies. Pepe King awakening: sound waves last 6s and reduce armor to zero.','pepe_king'],
];
export const WEAPONS: Record<string,WeaponDefinition> = Object.fromEntries(
  (Object.entries({melee,ranged,magic}) as [WeaponFamily,WeaponRow[]][]).flatMap(([family,rows]) => rows.map((row,index) => {
    const rarity = (index < 8 ? Math.floor(index/2) : 4) as WeaponDefinition['rarity'];
    const bonus = Math.round(RARITY_RULES[rarity].damageBonus*100);
    const [id,zh,en,zhDesc,enDesc,signatureHero] = row;
    const definition: WeaponDefinition = {id,family,rarity,name:{'zh-CN':zh,en},
      description:{'zh-CN':index===0 ? zhDesc : `基础伤害 +${bonus}%。${zhDesc}`,en:index===0 ? enDesc : `Base damage +${bonus}%. ${enDesc}`}};
    if (signatureHero) definition.signatureHero = signatureHero;
    return [id,definition];
  })),
);
export function rollWeapon(random:()=>number, rarities:number[]=[0,1,2,3,4],epicMultiplier=1): string {
  const allowed = [...new Set(rarities)].filter(r => Number.isInteger(r) && r >= 0 && r <= 4);
  if (!allowed.length) throw new RangeError('At least one valid weapon rarity is required');
  const sample = () => Math.max(0, Math.min(.999999999999, Number(random()) || 0));
  const boost=Number.isFinite(epicMultiplier)&&epicMultiplier>0?epicMultiplier:1;
  const weight=(rarity:number)=>RARITY_RULES[rarity].weight*(rarity>=3?boost:1);
  let roll = sample()*allowed.reduce((sum,r) => sum+weight(r),0);
  const rarity = allowed.find(r => (roll -= weight(r)) < 0) ?? allowed[allowed.length-1];
  const candidates = Object.values(WEAPONS).filter(w => w.rarity === rarity);
  return candidates[Math.floor(sample()*candidates.length)].id;
}
