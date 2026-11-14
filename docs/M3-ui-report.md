# M3 UI 与双语实施报告

状态：已完成最终复核修正。主代理确认源码冻结且 dev4175 就绪后运行浏览器；最新完整运行 12/12 组通过，控制台错误 0、pageerror 0。未启停或切换任何服务。

## 已实现

- 菜单段位、星数与晋级进度、当前手绘头像、自动或已解锁地图选择；开局传递 `resolveMap(profile)` 与当前 `getRank(...).index`。
- 品牌点击名片，16 头像与透明条件、佩戴持久化；15 NPC 加玩家的 16 行即时榜单，显示头像、段位、星数与胜率。
- 顶栏设置，音量输入即时保存及生效，关闭伤害数字；所有新交易先保存成功，再替换内存。弹窗恢复原 playing/paused/result 状态，不重建战斗或重复结算。
- `recordMergedHeroes` 持续消费本局唯一英雄记录，合成图鉴即时保存；结算显示升降星、连胜加星、新手或底线保护、晋级和新头像。
- 单实例 SoundManager，用户手势解锁，后台/暂停 duck，命令负责召唤、铲地/修地及传奇合体，事件消费负责普通升级与战斗事件；抽奖只在真实步进与开奖触发音效，结算每局触发一次。
- 衣帽间 36 个专属 SVG，12 英雄当前配装总览，橙品优先和默认排序；保留旧 DOM 与 data-action。
- 测试台 54 段、4 图独立选择、12 Boss；地图测试覆盖仅存于本次页面的 `devMapOverride`，不写正常档段位、最高星数、地图选择或成就；正常菜单仍仅列已解锁地图。沿用测试档备份与恢复接口。修整 320/390 封印横幅与新增区域布局。
- 中英配置派生字典覆盖全部地图、段位、头像条件及新 Boss、召唤物与提示，v1.0 版本文案。

## 测试

- 先添加 `tests/m3-i18n.test.ts`，运行观察到缺少 m3 字典模块导致失败。
- 实现后 `npm test -- --run tests/m3-i18n.test.ts tests/m2-i18n.test.ts`：2 文件、6/6 通过。
- `node --check scripts/m3-browser-qa.mjs`：通过。
- 最新 `npm run typecheck`：`tsc --noEmit` 退出码 0。
- 最新 `node scripts/m3-browser-qa.mjs`：退出码 0，**12/12 组通过**。独立 Chrome context，不访问用户正常浏览器存档。[完整结果](../verification/m3-browser-qa.json)
- 最终复核新增定点浏览器回归：先观察 rank0 地图选项 `2 !== 5` 和保留页面 `disposed === true` 两处失败；修正后 `node scripts/m3-browser-qa.mjs --regression-only` 两组通过，随后完整 12 组重跑通过。[定点结果](../verification/m3-review-regressions.json)

## 浏览器证据

- 旧 M1 档的金币、胜场、场次、碎片与奖励收据完整迁移，补齐 M3 默认项；测试台显示 54 段、12 Boss。
- 16 头像展示透明解锁条件，切换头像先落盘；榜单 15 NPC 与玩家共 16 行，星数降序，满档玩家立即登顶。
- 音量在 `input` 事件时即时落盘，0 音量合法，飘字开关重载保持；注入存储失败后内存保持原设置。
- 全满档包含 4 图、16 头像、12 英雄图鉴、36 神兵、20 道具；重复开启不覆盖普通备份。完成所有测试后恢复普通档，与测试前档案深度相等，重载仍相等。
- 衣帽间 12 配装行、36 SVG，橙品优先首项为橙武，切回默认首项恢复 `m01_swatter`。
- 真实扭蛋的步进音效与单次中奖声在切语言、关闭重开时不重复；交易仅结算一次。非静音音量下真实 WebAudio 音符已调度，召唤/胜利只各调用一次，传奇合体没有叠播普通升级；反复弹窗的 AudioContext 与 BGM timer 保持同一实例。缺少 AudioContext 时召唤、暂停安全运行。
- 四张地图分别真实开局，校验 mapId/rankIndex、五连召唤、部署至本图开放格、敌人沿路径实际前进；名片从 playing 打开后关闭恢复 playing，设置从 pause 打开后关闭恢复同一 pause 对话框及暂停时间。
- 普通 rank0 在测试台可选择全部四图开局；每次选择不写存储，开局不增加星数、最高星数、解锁头像或正常地图。正常菜单始终只有 auto 与阳光后院；正常菜单选图、测试台 auto、恢复普通档及重置均清除测试覆盖。
- `PageTransitionEvent` 合成两次 `pagehide.persisted=true` / `pageshow`，确认保留同一个 AudioContext 与 BGM timer、隐藏时 duck、返回后真实 SFX 继续调度。额外对真实上下文执行 `suspend()`，再以 pointerdown 手势恢复，仍保留同一 context/timer；`persisted=false` 的 pagehide 释放 manager/context/timer。此处是确定性生命周期事件与真实 WebAudio 验证，**未观察或声称真实 BFCache 导航命中**。
- 真正执行熊猫+斗笠合成，结算前图鉴与头像即持久化；19 星获胜到 20 星，真实展示 rank10 晋级与樱花头像；切语言和重载均不重复加星或发奖。
- 桌面、320、390 像素中英界面无页面或弹窗横向溢出；封印横幅与绿色胶囊至少保留 3px 间距。已生成 **25 张截图**，并抽查菜单、头像、衣帽间、设置、晋级与两种窄屏战斗截图。

代表截图：[桌面菜单](../verification/m3-desktop-menu.png)、[头像馆](../verification/m3-desktop-profile.png)、[榜单](../verification/m3-desktop-leaderboard.png)、[衣帽间](../verification/m3-desktop-armory.png)、[晋级](../verification/m3-desktop-promotion.png)、[320设置](../verification/m3-320-settings.png)、[390衣帽间](../verification/m3-390-armory.png)、[320战斗](../verification/m3-320-battle-stage.png)、[390战斗](../verification/m3-390-battle-stage.png)。四地图战斗及其他截图列于浏览器结果 JSON。

## 验收修复

1. 首轮在“已有暂停中打开设置”遇到原生 modal 遮挡顶栏按钮。根因是入口位于 dialog 外；已获主代理同意，在暂停弹窗添加名片和设置入口，并通过真实点击检查返回仍暂停。没有绕过浏览器事件或改动战斗/结算逻辑。
2. stage 截图抽查发现封印横幅下缘仍与 Canvas 绿色胶囊约 1px 贴边。已上移窄屏横幅，并将 QA 判定从近似比例收紧到渲染器实际 `981/1386` 位置减 3px。最终两种宽度截图均有清晰间隔，完整浏览器回归重新通过。
3. 最终复核发现测试台误复用正常地图的 `mapOptions/selectMap`，使普通 rank0 无法测试其他地图。改为 GameApp 页面字段 `devMapOverride` 与独立四图选项；开局使用 `override ?? resolveMap(profile)`，不通过升段或成就解锁来绕过限制，正常地图接口保持原约束。
4. 最终音频复核发现 pagehide 无条件 dispose 且监听 once，缓存保留后无法继续使用原 manager。现以 persisted 区分保留与离开：保留时记录页面状态并 duck，pageshow 按可见性/对局状态恢复；永久离开完整 dispose，监听支持多次往返。SoundManager 的挂起恢复由主代理独立修正，本任务未改动该文件。

## 接口差异

无。严格使用 `docs/M3-contracts.md` 固定接口，未改动 core、types、config、storage、render 或 SoundManager。
