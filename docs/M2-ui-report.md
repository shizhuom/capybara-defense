# M2 UI 实施报告

## 已实现

- `GameApp.ts` 保留 M1 `data-action`、五连抽与换窝语义；开局将 Profile 的深拷贝传入 `EngineOptions.loadouts.player`。
- 首页碎片统计累计真实 `weaponFragments`（含解锁门槛已收集数量），不再计旧 `fragments` 历史列表，避免漏计新掉落或重复计算迁移碎片。
- 衣帽间/黑市入口紧跟开泡按钮与时长，位于统计前；桌面截图检查确认两入口均在 1200px 高度的首屏内。扭蛋说明只呈现免费券、80 金币和满级兑换规则。
- `MetaScreens.ts` 提供 36 把神兵三系筛选、碎片进度、品质伤害、完整特效与本命说明、同系英雄穿戴与自动转移、卸下、按品质勾选回收。
- 黑市包含三商品直购/升级、付费刷新、3×3 外圈八奖品跑马灯、常驻 2 主动 + 6 被动槽与全部已拥有道具装卸。扭蛋只调用一次交易，保存成功后才演出；语言切换、关闭和重开仅重绘，不触发兑奖。满级道具兑奖额外显示折算金币；新解锁神兵也在结果区显示。
- 测试台提供全满/恢复普通存档、当前模式与 8 个配装下拉。测试台配装在下一局生效，调用存储模块的备份与恢复 API。
- 战斗提供点击选中再点己方目标、DOM 按钮捕获指针并拖到 Canvas 的两种道具用法；显示冷却、被动图标。洒水车 DOM 按钮以原 Canvas 坐标 `(90, 1035)` 为中心，与右铲 `(550, 1035)` 对称，未改变 Canvas 命中逻辑。
- 选中 SEALED 单位时提供场内醒目提示和右侧解封说明；检查档案通过 `getUnitStats`、`getShovelRules` 显示实际装备数值。结算显示新神兵及胜利免费券。
- `m2.css` 实现自适应弹窗与窄屏列表；指针捕获期间保持侧栏和道具 DOM 不被周期重绘替换。
- `i18n/m2.ts` 从配置生成 36 武器/20 道具名字与完整描述、真实武器碎片名，以及元交易/战斗/弹窗动态文案的中英文键。所有新增弹窗与动画结果使用同一热切换逻辑。

## 接口

遵循实施计划固定接口；额外使用 Meta 代理已提供的 `isTestProfile(storage?)`，备份键为 `normalProfileBackup`。与渲染代理约定 `render.sealedHint`；与主代理约定全部新战斗消息为 `m2.*`，均已补齐双语。

Meta 模块已统一在购买/扭蛋将道具升满时为货架补空位；UI 消费返回的完整 `offers`，没有另行生成货架或绕过交易层。

## 验证

- `npm test -- --run tests/m2-i18n.test.ts tests/ui.test.ts`：11/11 通过。覆盖全部 36/20 名字说明、动态占位符、源码中的新交易/道具提示键及语言切换；保留原 UI 存储/语言回归。
- `npm run typecheck`：退出码 0。
- 集成后最终 `npm test`：12 个文件，251/251 通过。
- `node --check scripts/m2-browser-qa.mjs`：退出码 0。
- 编写 `scripts/m2-browser-qa.mjs`：使用独立浏览器 context，真实按钮覆盖迁移、商店、扭蛋中断原子性、全满/恢复、神兵穿戴回收、2+6、点击/DOM拖放、洒水车、Boss掉落与胜利解锁/券/重载、中英与 320px、console/pageerror。输出 `verification/m2-browser-qa.json`。
- `node scripts/m2-browser-qa.mjs`：新版 Vite 上最终 8/8 项通过，console/pageerror 均为 0；包含首页真实碎片累计断言。一次中途重跑被 Meta 文件落盘触发的 Vite HMR 导航打断，待所有源码冻结后完整重跑已通过。
- 主线程最终补充武器来源/穿透/AI 与底栏提示修复后，再次冻结源码重跑上述 8 项全部通过；购物测试额外确认连续买满道具后仍即时补齐三货架。
- 真实状态截图已生成并抽查：`verification/m2-desktop-{menu,armory,shop,lottery,battle}.png` 与 `m2-mobile-{menu,armory,shop,lottery,loadout,battle}.png`。移动弹窗使用 320×844 视口截图；菜单/战斗保留完整页面。战斗包含真实英雄、基础宠、怪物、SEALED/WET、实际 2+6 配装；没有以文字占位图代替。
- 本任务未启停服务器，使用主代理维护的 `127.0.0.1:4175`；浏览器运行于独立 context，未改用户浏览器存档。

## 写入范围

仅写本项目 UI/i18n、新 i18n 测试、本报告及主代理追加授权的 `scripts/m2-browser-qa.mjs`。未写 storage/core/config/render、只读设计目录、根目录或 Git，未派生代理。
