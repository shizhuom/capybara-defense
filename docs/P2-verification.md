# P2 单人温泉保卫战交付验证

验证日期：2026-11-13（America/Los_Angeles）。工程为本目录独立 Git 仓库的 `p2-solo-overhaul` 分支，P1 回退标签 `v1.0-p1` / 提交 `319ea6c` 保留。

## 实施范围

| 模块 | 已实现与验证的行为 |
| --- | --- |
| 单人棋盘 | 精确 6×7、96px 单格、640×1216 舞台；42 格均属于玩家。无运行中的对手布阵、波次、分隔墙、第二守护者或对手横幅。 |
| 四张地图 | 阳光后院 18 航点、樱花温泉馆 21、深夜厨房 23、猫爬架迷宫 22；扣橘子、守护者、终点肥橘救援和召唤位置按实际终点计算。 |
| 经济 | 开局 22 口粮、1 铲，18 秒准备；五连抽 10→12→14→16…，钱不足保留整窝与抽卡计数；普通击杀 +1，Boss +8 与 1–2 碎片，第 2–10 波 +3。蜜蜂及十波怪物曲线按规范更新。 |
| 窝内铁锹 | 抽卡权重 10、每窝最多 2 把；点击/鼠标拖拽/真实触屏拖拽开草、分两次修坑、与袋装铲混合修坑、存袋、满袋拒收、窝位交换；不进入合成、战斗或训练，回收 +4。袋装铲 55 秒补 1、上限 4，发铲机 30 秒、上限 6。 |
| 单人道具 | 温泉加餐券 +4 橘子且害虫血量 +15%；狂欢派对攻速 +38% 且害虫移速 +12%。其余英雄、神兵、首领、道具与局外养成继续保留。 |
| 战斗表现 | 4 基础战宠及 12 英雄持武，按实际装备与品质缩放、觉醒光效；旋斩、蓄力劈斩、交叉斩、突刺、后坐力与法器悬浮；主题弹体、命中火花/震动、死亡烟尘及 +1/+8 飘字。攻击演出保存发射时信息，移动/合成掉来源后仍保持一致。 |
| 界面 | 中英动态价格与缺粮提示、铁锹专用检查卡、42 格键盘操作、单人暂停/结算、三步教程、80 条百科、Boss 大血条；桌面与手机居中纯净模式。 |
| 结算与存档 | 十波清场且橘子大于 0 获胜，只奖励玩家收集的战利品；金币为段位奖励加最多 45 的剩粮折算，并加星、发免费扭蛋券。旧档、教程奖励收据、普通档/测试档备份隔离继续有效。 |
| 资源 | 145 张源 PNG 和 manifest 精确同步；四张地图均为 768×896。12 张新增持武/VFX 图片接入，缺图仍有程序化回退。 |

主要新增代码为 `src/config/combat.ts`、`src/render/HeldWeaponRenderer.ts`、`src/render/CombatEffects.ts`；核心与 UI 仍分别位于 `src/core/`、`src/ui/`，没有引入新引擎或依赖。

## 自动验证结果

| 命令 / 检查 | 结果 |
| --- | --- |
| `npm test`（23:38:01 最后全量运行） | **27 个文件，686 项通过，0 失败/跳过** |
| `npm run typecheck` | 0 诊断；最终构建再次执行 `tsc --noEmit` 通过 |
| `npm run build`（正式启动脚本调用） | 通过，56 模块；JS 302.40 kB，gzip 107.97 kB |
| `npm run test:browser` | 10 组实机流程通过；Console/pageerror 0 |
| `node scripts/p2-production-qa.mjs` | 正式版无调试 API；390×844 换窝/百科/结算/刷新正常；HTTP 子目录解析 JS/CSS、145 PNG 与音频 manifest；错误 0 |
| `node scripts/production-smoke.mjs` | M1/M2/M3 局外系统、36 神兵、20 道具、54 段位、16 头像、配装、扭蛋、设置与存档恢复通过；错误 0 |
| `node scripts/m3-profile-switch-qa.mjs --label=p2` | 4 种档案切换/失败保护场景全部通过；旧局奖励不串入新身份，重复开启不覆盖备份 |
| `node scripts/p2-isolation-check.mjs` | 2298 个受保护文件无修改/新增；原仓库 tracked diff 为空；145 PNG 哈希一致，manifest 字节一致，四地图尺寸正确 |

Vitest 输出包含其正常的 transform-cache 性能建议，不是测试错误。启动服务为 `http://127.0.0.1:4175/`；端口与 `capybara_defense_v1:` 前缀未更改。

机器可读证据：

- [浏览器交互与截图清单](../verification/p2-browser-report.json)
- [生产版与子目录验证](../verification/p2-production-report.json)
- [局外系统生产回归](../verification/production-smoke.json)
- [档案身份隔离回归](../verification/m3-profile-switch-qa-p2.json)
- [隔离与资源哈希核验](../verification/p2-isolation-report.json)

## 截图检查

使用本机 Chrome 的独立测试环境。桌面 1440×900、补充 1024×900 / 800×900 和手机模拟 390×844 均检查舞台比例、视口边界、按钮与提示条相交、页面误滚动，并执行真正的 CDP 触摸拖拽。截图检查曾发现窝位标题/数量与工具重叠，以及窄桌面提示条遮挡；已修正并重新拍摄。

- [桌面旋斩、持武、弹道、铁锹与 14 口粮换窝](../verification/p2-desktop-combat.png)
- [手机阳光后院](../verification/p2-mobile-sunny_backyard.png)
- [手机樱花温泉馆](../verification/p2-mobile-sakura_onsen.png)
- [手机深夜厨房](../verification/p2-mobile-midnight_kitchen.png)
- [手机猫爬架迷宫](../verification/p2-mobile-cat_tower_maze.png)
- [手机 Boss 血条与封印效果](../verification/p2-mobile-boss.png)
- [铁锹分步修坑](../verification/p2-mobile-repair-half.png)
- [命中、烟尘与口粮反馈](../verification/p2-mobile-hit-food-feedback.png)
- [英文教程](../verification/p2-mobile-tutorial-en.png)
- [1024px 桌面通知](../verification/p2-tablet-desktop-combat.png) / [800px 桌面通知](../verification/p2-narrow-desktop-combat.png)
- [外部图片缺失回退](../verification/p2-mobile-fallback.png)
- [正式构建手机画面](../verification/p2-production-mobile.png)
- [胜利结算](../verification/p2-desktop-victory.png)

战斗展示场景使用真实 `BattleEngine` 推进 0.12 秒后冻结，事件与武器动作由引擎产生，没有手工伪造攻击事件。胜利存档流程从受控的最后一波清场状态走正常引擎结算与 UI 写盘。它们验证实现和表现，不冒充自然游玩十波的平衡性证据。长图鉴/结算弹窗允许内部滚动；战斗主视图不滚动。极短且两侧/底部都无空位的窗口，短暂提示会放在棋盘上部，保持 HUD 和底部操作可用。

## 实施取舍与可回退点

- 沿用本目录独立仓库，在 `p2-solo-overhaul` 分支实施，没有创建边界之外的 worktree。P1 标签可用于另开分支；浏览器存档独立于 Git，应单独导出保存。
- 保留旧类型中的惰性 `ai` 字段和失败结果标记，兼容旧接口；没有 AI 模拟或对手战利品入账。失败金币为 0；若未来移除这些类型，需要额外迁移接口。
- 铁锹回收选择规范允许的 +4；二哈基础 HP 700，其他 Boss 按 1.15 倍取整，臭鼬 4600。改用另一允许值会改变经济/难度，需重测数值。
- 保留原宠物权重总和 100，严格加入铁锹权重 10，因此未受每窝上限影响前的概率为 **10/110≈9.09%**。规范中的约 9.5% 是近似说明；没有为凑该近似值重新分配未指定的宠物权重。
- 渲染阶段先加入 `render.dig` 的铲/DIG 两个基础词条，随后 UI 阶段完成其余文案，没有重复或遗留键。

## 最终审查与版本保存

[整分支审查](P2-final-review.md)确认无 Critical/Important 问题，指出窝内铁锹合法交换曾显示红色预览。该问题已修正，并增加 11 个真实渲染与引擎命令对照回归；[修正复核](P2-final-fix-review.md)通过，无剩余问题。随后全量 686 项测试与正式构建再次通过。

P2 保存为本地分支 `p2-solo-overhaul` 和标签 `v1.0-p2`；P1 标签 `v1.0-p1` 保留。该版本只在本地运行与保存，没有发布到外部服务。可用 `git switch -c my-next-game v1.0-p2` 从该基线开始另一个版本；切换前先提交自己的后续改动，并单独保留浏览器存档。
