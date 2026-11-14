# M2 局外养成与战斗扩展 Implementation Plan

> **For agentic workers:** 使用测试驱动流程；独立文件任务按下列契约协作，集成后做独立审查。所有产物只写本项目，不提交根仓库。

**Goal:** 实现 36 神兵、12 专属觉醒、20 道具、商店扭蛋、旧档迁移与战斗演出大闭环。

**Architecture:** 保留原 TypeScript/Vite/Canvas/Vitest。纯配置提供物品定义，纯逻辑管理养成交易和战斗效果，存储层仅负责浏览器持久化；UI 与渲染消费同一状态。

**Spec:** `D:/rea_game/design/codex_m2_spec.md` 为唯一 M2 规范；`pet_defense_design.md` 仅作总体参考，保留 `docs/balance-v2-verification.md` 的 M1 调优行为。

## Global Constraints

- 全部修改仅在 `D:/rea_game/games/capybara-defense/`；不写原版、design、根 Git/脚本。端口 127.0.0.1:4175。
- 存档键继续 `capybara_defense_v1:profile`。旧金币/胜场/场次/奖励收据保留；迁移和结算不能重复领。
- 固定 10 口粮五连抽换窝、20 秒准备、36 秒波次、108 秒首领、12 秒自然铲子、早期怪血量全部保留；装备增益只在已装备时生效。
- 2 主动/6 被动，已解锁神兵仅同系且一把只配一位英雄。12 英雄与 M2 最终三系映射一致。
- 沿用程序化贴纸风，中英热切换；不得用占位描述替代实际机制。

## Review Focus

- 旧存档缺字段、重复刷新或重复结算不能损失或重复发放资源。
- 交易不足余额、满级商品、非法装备/目标、暂停/结束施法必须无副作用。
- 洗衣机期间换窝/合成，技能击杀后连锁特效，不能留下悬空单位或递归无限触发。
- 改语言/关弹窗/刷新时九宫格不重复扣费兑奖，锁定奖品和奖励落盘先于动画。
- 拖拽目标与手机缩放保持坐标正确，新增控制提示不能遮住输入。

## Task 1：配置、养成与持久化（独立模块）

Files: `src/config/weapons.ts`, `props.ts`, `src/core/MetaProgression.ts`, `src/ui/storage.ts`, `tests/m2-meta.test.ts`；现有 `tests/ui.test.ts` 仅因扩展结构更新完整对象预期，不删回归语义。

- [x] 写旧档保值/重复迁移、36 装备限制/自动转移、碎片阈值/回收、20 道具购买升级、每日商店/刷新/扭蛋原子性与全满恢复测试，观察失败。
- [x] 实现配置与下列契约；只用 JSON 可序列化的普通数据，随机数以 `() => number` 注入。
- [x] 跑针对性测试及完整现有套件，报告通过和因其他任务尚未完成产生的失败。

## Task 2：战斗效果（主代理）

Files: `src/core/types.ts`, `BattleEngine.ts`, 新增 `WeaponSystem.ts`, `PropSystem.ts`；`tests/m2-weapons.test.ts`, `m2-props.test.ts`。

- [x] 为洒水车、8 主动、12 被动逐项写真实战斗测试，覆盖目标/冷却/暂停/概率两分支，观察失败后实现。
- [x] 为 36 武器及 12 本命觉醒写实际伤害/射程/攻速/控制/资源回归；通用词条与本命英雄身份分开判断。
- [x] 将 Boss 和宝箱掉落替换为真实武器 ID；按品质权重抽取。
- [x] 输出独立路径动画事件，视觉即使敌人已被杀或源单位被移动仍能完成；保持原 M1 非装备行为。

## Task 3：菜单、黑市、配装和局内操作

Files: `src/ui/GameApp.ts`, 新增 `MetaScreens.ts`, `src/ui/styles.css` 或 `m2.css`, `src/i18n/{zh-CN,en}.ts`/`m2.ts`；`tests/m2-i18n.test.ts`。

- [x] 主菜单双入口，衣帽间三系筛选、英雄穿戴、收集进度、本命说明、按品质回收。
- [x] 黑市双页签，三商品与刷新、3×3 动画扭蛋、常驻 2+6 槽；已拥有道具装卸。
- [x] 全满测试档与恢复普通档，8 个快捷配装下拉；全满不得覆盖普通档备份。
- [x] 实装主动按钮点击/拖拽与冷却、被动状态图标、洒水车按钮、封印醒目提示及新武器解锁提示。
- [x] 所有新名称、说明、动态提示、中英弹窗热切换覆盖；手机布局不溢出。

## Task 4：程序化战斗演出

Files: `src/render/StickerRenderer.ts`, `StickerArt.ts` 或新 `M2Effects.ts`, `tests/m2-render.test.ts`。

- [x] 洒水车逆向道路动画；刀鹅 1.1 秒 7/10 段残影冲刺；篮球/毛线球逐段弹跳。
- [x] 纸箱瓦楞/封箱胶带/感叹号、头顶滴水乌云；洗衣机旋转与金铲、粘鼠板、巨橘猫可见。
- [x] 不改变现有棋盘、宠物窝、铁锹命中坐标；新增视觉事件无需反查已消失的敌人。

## Task 5：闭环验证与交付

- [x] 全量 Vitest、typecheck、build；验证旧 M1 平衡回归。
- [x] 浏览器完成旧档迁移→衣帽间→购买/扭蛋→配装→战斗释放→Boss 掉落→胜利解锁/免费券→重新载入；桌面和 320px，中英、console 零错误。
- [x] 独立代码审查，修复重要问题；更新 README/验收记录。
- [x] 比较 `verification/m2-protected-before.json` 所列 2096 文件 SHA256 与 Git 状态；一键脚本启动新构建。

## 接口契约（先固定，文件各自单一写入者）

`config/weapons.ts`: `WeaponFamily='melee'|'ranged'|'magic'`; `WeaponDefinition { id; family; rarity:0|1|2|3|4; name:{'zh-CN':string,en:string}; description:{'zh-CN':string,en:string}; signatureHero?:string }`; `WEAPONS:Record<string,WeaponDefinition>`，`HERO_FAMILIES:Record<string,WeaponFamily>`，`RARITY_RULES` 为数组，每项 `{fragments,damageBonus,recycle,weight}`。`rollWeapon(random:()=>number,rarities?:number[]):string`。

`config/props.ts`: `PropDefinition {id;type:'active'|'passive';rarity:number;price:number;maxLevel:number;cooldown:number;target:'unit'|'road'|'self'|'passive';icon:string;name;description}`，双语字段同武器；`PROPS:Record<string,PropDefinition>`。

`core/types.ts` 由主代理维护：新增 `BattleLoadout {equippedWeapons:Record<string,string>;ownedProps:Record<string,number>;equippedActiveProps:string[];equippedPassiveProps:string[]}`；Profile 扩展规范全部字段和 `schemaVersion:2`、`shop:{day:string;offers:string[]}|null`。`MetaResult {profile:Profile;ok:boolean;key:string;amount?:number;newWeapons?:string[]}` 在 MetaProgression 导出。旧 `fragments` 保留为历史字段。

`MetaProgression`: `createProfile():Profile`, `normalizeProfile(raw:unknown):Profile`, `grantWeaponFragments(profile,ids:string[]):{profile,newWeapons:string[]}`, `equipWeapon(profile,heroId,weaponId:string|null):MetaResult`, `recycleFragments(profile,rarities:number[]):MetaResult`, `equipProp(profile,id):MetaResult`, `setPropSlots(profile,active:string[],passive:string[]):MetaResult`, `ensureDailyShop(profile,day:string,random:()=>number):Profile`, `refreshShop(profile,day,random):MetaResult`, `buyProp(profile,id):MetaResult`, `createLotteryPrizes(profile,random):LotteryPrize[]`, `spinLottery(profile,prizes,random):MetaResult & {prize?:LotteryPrize;index?:number}`, `unlockAllProfile(profile):Profile`。`LotteryPrize {type:'prop'|'coins'|'fragment';id?:string;amount:number}`。所有交易返回新对象，无失败时扣费/副作用。

`storage.awardBattle` 扩展返回 `newWeapons:string[]`；其余原 API 保留。`enableTestProfile(storage?)` / `restoreNormalProfile(storage?)` 返回 Profile；普通档备份用同前缀单独键，重复开启全满不覆盖备份；恢复应清理测试备份键。

EngineOptions 新增 `loadouts?:Partial<Record<Side,Partial<BattleLoadout>>>`；UI 开局传 `{loadouts:{player:profile}}`，引擎复制验证配置。`engine.useProp(id:string,target?:{unitId?:number;col?:number;row?:number},side?:Side):CommandResult`，`engine.useSprinkler(side?:Side):CommandResult`，`engine.getUnitStats(unit):{damage,rate,range,charge}`，`engine.getShovelRules(side):{interval,maxStored}`。SideState 新增 `loadout`, `propCooldowns`, `sprinklerUsed`, `giantCatUses`, `catnipTime`；BattleState 新增 `traps:{id,side,col,row,charges,hitIds:number[]}[]`。Unit 可选 `washing?:number`、`haste?:number`、`hasteTime?:number`、`powerTime?:number`。Enemy 可选 `bleed/bleedDps`、`armorBreak`。

VisualEvent type 扩展 `'dash'|'bounce'|'sprinkler'|'giant_cat'|'weapon'`；可选 `points:Point[]`、`effect:string`；dash 的 points 包含起点与每次冲刺终点，bounce 同理且 effect 为 basketball/yarn；事件保存坐标不依赖目标存活。Interaction 扩展 `propId?:string`。洒水车采用 DOM 按钮位于左侧，与 Canvas 右侧铲子对称，避免改变现有 HitTarget。

## 规范空白的实施裁定

- 采用末尾统一 36 把表，废弃早期草稿中的马桶搋与冲突编号；鸡神归 magic。
- 神兵品质的伤害加成适用于所有武器，不把白武文字的 +12% 重复叠加。
- 碎片累计保留解锁门槛，解锁后超过门槛的数量可回收；旧占位碎片一次性折为首把白武碎片，原金币不变，保留历史列表避免数据丢失。
- 每日商店按本机日历日期持久化，刷新 20 金币；3×3 外圈含 3 个道具、3 个金币袋（40/80/160）、紫碎片、橙碎片。抽中已满道具折为该道具价格的金币；一次交易先落盘再演出，动画不作为兑奖触发器。
- 普通档完全备份后再开启全满测试档；恢复普通档丢弃测试进度。
- 未指定的特效附加倍率：鱼剑气 100%×2、猫爪飞刃 80%×4；热浪/火龙笋 35%每秒×3秒；木鱼 180%/1.6格；阴阳亢奋 +35%伤害4秒，毒雾35%每秒3秒；篮球火焰溅射40%/0.85格；流血35%每秒3秒。竹笋晕0.8秒、区域1格，爆裂/流星区域1.2格；聚怪拉近最多1格。此类补充在配置和用户说明中如实表达。
- 额外武器投射造成的击杀不能无限再触发同武器投射链，普攻/大招击杀正常触发。
- M1 即时技能伤害时序保持，M2 将多段路径保存到约 1.1 秒事件供实体化演出；避免回退现有技能行为测试。
