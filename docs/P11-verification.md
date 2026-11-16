# P11 绘本档案夹页面验收

基线：`9ad2368` / `v2.0-p10`。工作分支：`p11-storybook-hub`。规范：只读的 `design/codex_v2_p11_storybook_armory_market_rank_spec.md` 与对应 P11 prompt。

## 交付内容

- 共享 `LedgerView` 与 `p11.css`：六个二级档案页统一为 680px 暖可可竖向档案夹，透明外层、描边标题、专属扒边吉祥物、单枚摘要徽章、唯一顶部标签栏和框外双行提示。图鉴保留 P10 列表、详情与合成速查交互。
- 神兵：全部 / 近战 / 远程 / 魔法 / 碎片工坊。默认已解锁优先、品质降序；清单点击进入单件详情，显示四位同系英雄的穿戴/卸下控制，支持前后翻页和返回焦点。碎片回收独立成页。
- 黑市：每日特惠只展示三件商品；背包展示轻量出战槽与二十条道具清单；扭蛋独立展示八格奖池与中央按钮。保留免费券、120 金币抽奖、满级道具返金币、中奖提示和防重复付款。
- 段位：一张本人摘要与十六行统一排行；名片：一张战绩摘要与十六条头像清单；设置：四张横条卡，保留原生滑块、百分比输出、伤害/开发者开关与教程重播。
- 局内神兵/商店通过题头小链接互通。备战即时生效和战中下局生效提示位于框外页脚，装备同步逻辑不变。
- 同步 **209 张 PNG** 与原始 manifest；新增四枚 256×256 透明探头吉祥物，均有独立无白边 SVG 兜底与异步贴图刷新。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 升级前基线 | 1040 项测试通过 |
| 全量 Vitest | **1073 项 / 55 个文件通过** |
| P11 新增测试 | 33 项，覆盖外壳、贴纸、双语、神兵流程、商店分流、扣费/保存失败、排行/头像/设置 |
| TypeScript / Vite | `npm run typecheck`、`npm run build` 通过 |
| 四视口 / 两种语言 | **80 个页面状态**全部通过布局检查 |
| 页面与交互截图 | 浏览器报告记录 **86 张**，另有 3 张生产构建截图 |
| 控制台 / pageerror | **0** |
| 水平溢出 / 破图 | **0** |
| 生产构建 | 三端、根路径和子路径加载通过，209 PNG 相对 URL 正常，无开发调试桥 |
| 工作区隔离 | **2417 个受保护文件**校验一致；设计目录及原三国基线无变化 |

视口为 `1366×768`、`1920×1080`、`844×390`、`390×844`，覆盖 `zh-CN` 与 `en`。检查弹窗边界、固定标签、内层滚动、扒边吉祥物位置、文字粗细、翻页和返回焦点。较短视口内详情与长清单使用画板独立滚动。

真实界面操作额外验证：穿戴/卸下、仅回收选中品质的溢出碎片、购买/升级/刷新、主动槽容量限制、背包键盘操作、免费券与金币分别付款、动画中关闭不重复扣费、头像切换、音量百分比与持久化、备战即时同步与战中配装锁定、固定教学包重播。抽奖余额按实际奖品计算，保留金币奖与满级道具返还。

独立代码复核发现并修复了背包上阵后焦点误落到屏幕外装备槽的问题。当前按原道具行恢复焦点，并滚动显示该行；复核与手机横屏键盘测试均确认有效。

## 不变项

`SoundManager.ts`、`MusicTracks.ts`、`AudioGestures.ts`、`SettlementView.ts`、`p6.css` 均保持原文件哈希。核心数值、神兵/道具事务、音效调用、存档格式、端口和存档前缀未变。生产环境另外检查暂停与惜败结算的原有粗体、高对比度和持久化流程。

本轮未更换依赖，没有新增引擎或改变音频实现。未写入 `D:/rea_game/games/capybara-defense/` 之外的项目文件。

## 复验与截图

```powershell
npm run sync-assets
npm test
npm run build
npm run test:browser
node scripts/p11-isolation-check.mjs
```

浏览器脚本使用游戏目录内的临时目录和隔离存档，不改动玩家浏览器中的正常存档。`npm run test:browser` 使用现有 `http://127.0.0.1:4175/` 服务；生产构建校验通过 Playwright 路由加载 `dist/` 的原始字节，不替换正在运行的服务。

- [浏览器完整报告](../verification/p11-browser-report.json)
- [交互专项报告](../verification/p11-interactions-report.json)
- [生产构建报告](../verification/p11-production-report.json)
- [隔离与贴图哈希报告](../verification/p11-isolation-report.json)
- [神兵清单](../verification/p11-desktop-zh-CN-armory-list.png)
- [神兵穿戴](../verification/p11-interaction-weapon-equipped.png)
- [黑市特惠](../verification/p11-desktop-zh-CN-market-deals.png)
- [道具背包](../verification/p11-desktop-zh-CN-backpack.png)
- [幸运扭蛋](../verification/p11-desktop-zh-CN-lottery.png)
- [段位排行](../verification/p11-desktop-zh-CN-leaderboard.png)
- [通行名片](../verification/p11-portrait-zh-CN-profile.png)
- [庭院设置](../verification/p11-portrait-en-settings.png)

运行入口仍为游戏目录内的 `Start-Capybara.cmd`，或直接访问 `http://127.0.0.1:4175/`。
