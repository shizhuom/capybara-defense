# P3 横屏体验交付验证

日期：2026-11-14。工程：`D:\rea_game\games\capybara-defense`。本地分支：`p3-landscape-ux`，上一完整基线为 `v1.0-p2` / `db30057`。

## 本次实现

| 模块 | 交付内容 | 主要代码 |
| --- | --- | --- |
| 横屏几何 | 1280×720 舞台、9×5 棋盘、104px 格子；四张精确道路为 21/25/25/21 点 | `src/config/maps.ts` |
| 全景绘制 | 1280×720 整幅背景、动态开垦/损坏地块、和平菜单预览、终点温泉和橘子 | `src/render/StickerRenderer.ts` |
| 两帧行走 | 5 种小怪、12 种 Boss，方向保持、天然朝向修正、进度驱动步态、飞行扑翼、脚步尘、暂停/眩晕冻结 | `src/render/EnemyMotion.ts` |
| 庭院与 HUD | 地图芯片、资料/设置、四入口菜单、图标资源条、Boss 条、道具轨、递增费用召唤铃、浮动测试抽屉 | `src/ui/CourtyardView.ts`、`GameApp.ts`、`p3.css` |
| 共享实战数值 | 引擎与图鉴共用成长/蜜蜂生产函数；属性卡计算武器、被动及临时淋湿/强化后的数值 | `src/core/UnitStats.ts`、`BattleEngine.ts` |
| 局内属性卡 | 棋盘/窝内选中显示、基础升星预览、实时配方高亮、英雄神兵/能量/技能/喂养、铲子入袋、书本直达图鉴 | `src/ui/LiveUnitCard.ts` |
| 六页图鉴 | 合成矩阵、19 种萌宠/组件、12 英雄、17 怪物、36 神兵、20 道具；真实成长表与精确条目深链 | `src/ui/Compendium.ts` |
| 准备期商店 | 暂停与原暂停状态恢复；成功保存后同步装备；首个敌人出现后冻结当局快照 | `src/ui/MetaScreens.ts`、`GameApp.ts`、`BattleEngine.ts` |

P2 的单人十波、递增五连抽、22 初始口粮、18 秒准备、窝内铲子、55/30 秒铲袋恢复、合成/解控、动态持武和局外养成均保留。基础战斗宠物伤害采用 P3 指定的五档倍率，界面与引擎共用同一函数。

## 自动化与实机证据

最终完整测试记录：**757 通过、0 失败、0 跳过**。`npm run typecheck` 与 `npm run build` 均退出 0。开发版浏览器 **14 组检查通过**，成品/子目录及四组测试档恢复回归也全部通过。

- [完整 Vitest JSON](../verification/p3-tests.json)：地图/路线、实战数值、准备期装备差量、不重复发放初始食物、橘子伤害保留、首次出怪锁定、图鉴/深链、属性卡、两帧步态、美术清单，以及既有各阶段回归。
- [开发版浏览器报告](../verification/p3-browser-report.json)：召唤费用与缺粮原子性、窝内铲子拖放/入袋、四图真实引擎近远程攻击、六页图鉴/英文完整性、真实手机触控、商店事务、缺图回退、测试抽屉。
- [生产版浏览器报告](../verification/p3-production-report.json)：正式构建无 `__CAPY_DEBUG__`；390×844 可操作且不滚页；抽卡、图鉴、结算与重载；HTTP 子目录下 JS/CSS、166 PNG 和音频清单路径正确。
- [测试档隔离报告](../verification/p3-profile-switch-report.json)：局中恢复普通档丢弃旧测试局；局中开启测试档丢弃旧普通局；重复开启不覆盖原备份；无备份恢复不丢当前局；写盘失败保留当前局/备份/控件。
- 上述浏览器记录均无 Console error 或 pageerror。使用 Playwright、安装的 Chrome、独立浏览器上下文与本作 `.runtime/browser-tmp`，没有操作用户日常浏览器存档。手机验证为浏览器移动视口/触摸仿真，不代表已在实体安卓手机或原生 APK 中验收。

截图中的中挥砍场景由真实 `BattleEngine` 触发攻击后暂停推进仿真，以稳定记录持武、旋斩、弹道和命中特效；没有替换游戏绘图或伪造攻击 UI。触控、商店、抽卡与存档用真实事件操作验证。

## 视觉验收文件

| 截图 | 内容 |
| --- | --- |
| [桌面庭院菜单](../verification/p3-landscape-menu.png) | 1440×900，全景温泉、资料/设置、地图芯片与四入口 |
| [桌面战斗](../verification/p3-landscape-combat.png) | 1440×900，Boss 条、持武/旋斩/远程弹体、窝内铲子、14 费用与合成属性卡 |
| [六页合成矩阵](../verification/p3-compendium-matrix.png) | 九宫格交叉合成、锁死配对、英雄数值/成长表，常驻语言/关闭控件 |
| [萌宠数值](../verification/p3-compendium-pets.png) | 基础萌宠、组件、真实成长及配方链接 |
| [手机横屏](../verification/p3-mobile-landscape.png) | 844×390，移动端视口与触摸事件仿真，图标操作和可读属性卡 |
| [手机竖屏](../verification/p3-mobile-portrait.png) | 390×844，保持横屏舞台，属性卡放在下方空白区，14px 正文/16px 数值/44px 按钮，内部可滚动 |
| [樱花温泉馆](../verification/p3-map-sakura_onsen.png) | 左行入口、25 点路线 |
| [深夜厨房](../verification/p3-map-midnight_kitchen.png) | 25 点路线、折返厨房场景 |
| [猫爬架迷宫](../verification/p3-map-cat_tower_maze.png) | 21 点路线、猫爬架场景 |
| [准备期商店](../verification/p3-preparation-shop.png) / [出怪后商店](../verification/p3-locked-battle-shop.png) | 即时生效与下局生效的提示 |
| [英文战斗](../verification/p3-landscape-english.png) / [缺图回退](../verification/p3-fallback-developer.png) | 双语与内置图形回退 |

PNG 保存在本地 `verification/`，沿用仓库忽略规则；可用下面的脚本重新生成，不把运行截图混入程序资源。

已逐张检查主要交付图，修正了图鉴切页遗留滚动位置、桌面测试抽屉点击被旧样式禁用、卡片触摸滚动被画布祖先拦截、横屏/竖屏字号，以及竖屏 Boss 栏与控制栏的间距。双语顶部栏均通过不相交断言；普通单位选择不再重复弹出遮住道路的通知。

## 隔离与资源核验

[隔离报告](../verification/p3-isolation-report.json) 对比开工前的 **2331** 份原基线/设计文件 SHA-256：**0 修改、0 增删**，父仓库跟踪文件无差异。所有新代码、依赖配置、脚本、缓存及验证输出均在本游戏目录。

本地 **166 PNG** 与只读设计原图逐一哈希相同；`manifest.json` 内容相同；四张地图均为 **1280×720**。端口仍为 `127.0.0.1:4175`，存档前缀仍为 `capybara_defense_v1:`。本阶段没有修改存档格式或覆盖用户已有进度。

## 需求冲突与实施取舍

以下记录保留了实现时的全部裁决及判断错误时的影响，便于后续调整：

1. 使用用户指定的既有独立游戏仓库和 P3 分支，不另建外部 worktree；这符合严格目录限制。代价是没有第二份并行检出目录。
2. 环境没有 Git Bash，计划与代码复核使用等价的原生 PowerShell 工作文件；不影响游戏，若改用 Bash 只需替换开发流程辅助命令。
3. 保留全部 **20 道具**，因为 P3 的“10”没有提供删减名单；基础宠物使用 P3 成长倍率，英雄保持既有倍率；每位英雄显示 **1 把真实本命 + 2 把明确标注的同系推荐**。若原意确为删道具或新增三本命，需要再调整目录/数值，不能伪称已存在的机制。
4. 地图芯片保留段位解锁规则，测试台可任选四图；若希望新档直接全开放，可单独调整解锁条件，不影响地图内容。
5. 准备期换装保留已获得资源、计时、冷却与救援消耗；蜜蜂初始食物仅给一次，橘子按差量且保留已受伤害，铲袋变小不删除库存，首次出怪永久锁住当局装备。这样不能靠反复换装刷资源；如果需要刷新式换装，应另行明定其经济效果。
6. 窄竖屏属性卡使用棋盘下方的空白区，维持文字/关闭按钮可用且不盖棋盘；桌面及手机横屏保持指定舞台内锚点。此项仅改变竖屏呈现，可独立调整。

## 复现与启动

```powershell
npm test
npm run typecheck
npm run build
npm run dev
# 另一个终端，Vite 占用 4175 时：
npm run test:browser
# Ctrl+C 停止 Vite 后，双击 Start-Capybara.cmd，或：
powershell -ExecutionPolicy Bypass -File scripts/Start.ps1
node scripts/p3-production-qa.mjs
node scripts/p3-profile-switch-qa.mjs
node scripts/p3-isolation-check.mjs
```

`Start-Capybara.cmd` 会构建并启动 `http://127.0.0.1:4175/`；`Stop-Capybara.cmd` 仅停止本作服务。源码变更后先停止再启动。测试浏览器可用环境变量 `CAPY_CHROME` 指定 Chrome/Edge 可执行文件。

旧坐标的 M1–P2 验收脚本仍保留为历史证据；当前浏览器回归入口为 `scripts/p3-browser-qa.mjs`。P2 回退点始终保留在 `v1.0-p2`；需要另一版本时从该标签新建分支。Git 不保存浏览器 localStorage，代码回退前应自行另存浏览器进度。
