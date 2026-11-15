# P7 交付验证

规格已完整阅读：`D:/rea_game/design/codex_p7_typography_compendium_merge_highlight_spec.md`。所有写入均在本游戏目录；端口 4175、存档前缀和战斗经济不变。

## 实现

- 中英标题采用设计源新版 PNG，仍为 960×320；开始木牌仍为 520×220。标题宽度随舞台为 62%，解除 600px 限制；开始按钮 31%，周边入口文字增大。
- `p7.css` 最后加载：手账扩至 1180×720 上限，统一 15–22px 正文/卡片，手机短横屏保留紧凑字号与独立滚动区。每个二级页只留下关闭按钮，语言切换仅在主菜单。
- `Compendium` 的 pets/heroes/bosses/weapons/props 分别提供 19/12/17/36/20 个大头照；详情包含完整数值、成长表、护甲/克制贴士、碎片条件、道具效果、英雄本命及两把推荐神兵。详情支持深链、循环翻页、返回及焦点恢复；合成矩阵仍可直接选英雄。
- `MergeTargets` 增加 nextLevel/feedHero 元数据和棋盘被动查询，保留原 bench hint 结构。按下组件不改变选中状态便能预览；板上和窝内全部目标同时获得底层光垫、呼吸放大、前景光环与结果胶囊，无关单位轻降透明度。前景在所有单位与窝背景之后绘制。

## 验证入口

本轮结果：**902/902 单元测试通过，类型检查与生产构建通过**。P7 浏览器完成 81 个页面/布局检查点与 48 张截图，另有 2 张生产包截图；真实手机触控回归覆盖中英横竖屏。生产包、子目录加载、4 项普通/测试存档切换用例通过，Console/pageerror 均为 0。受保护文件核验 **2380 项零改动**，193 项 PNG 与只读设计源一致。

| 验证 | 入口 / 证据 |
| --- | --- |
| 全量逻辑与 UI 单测 | `npm test`；[Vitest JSON](../verification/p7-vitest-results.json) |
| 类型 / 打包 | `npm run build`（含 `tsc --noEmit`） |
| P7 浏览器与手机教学 | `npm run test:browser`；[P7 报告](../verification/p7-browser-report.json)、[真实触控回归](../verification/p3-mobile-typography-report.json) |
| 正式包与相对路径 | `node scripts/p7-production-qa.mjs`；[生产报告](../verification/p7-production-report.json) |
| 普通/测试存档隔离 | `node scripts/p3-profile-switch-qa.mjs --label=p7`；[存档报告](../verification/p7-profile-switch-report.json) |
| 源资源 / 隔离 | `node scripts/p7-isolation-check.mjs`；[隔离报告](../verification/p7-isolation-report.json) |

P7 浏览器验收使用独立临时浏览器存档，覆盖桌面 1280×720、1080p 标题、手机横屏 844×390、竖屏 390×844。检查头像数、详情导航和焦点、双语各页布局、滚动终点、字号、零语言按钮、立即按下预览、实际点按合体、五步上阵教学、锁宠换窝、扭蛋扣券及胜负结算。截图里的战斗布局使用受控引擎夹具；胜利仍通过真实伤害、MVP、跳波和结算保存路径产生。

视觉验收发现并修正了旧 `.game-dialog .button` 选择器覆盖新字号的问题：暂停/结算主按钮实测从 14px 恢复到桌面 18px、手机 16px，浏览器回归加入对应断言。所有手账保留内层滚动，内容超过视口时可以滚动到底，固定题头与结算按钮保持可达。

[独立复核记录](P7-review.md) 的两项 Important 已修复：手机竖屏英文页签采用两列，逐字块/贴纸检查按钮边界；顶行与相邻合成目标的结果胶囊避让 HUD、属性卡和彼此，移位后用连线保留目标关联。无延期小项。实体设备帧率和屏幕阅读器语音输出不在本轮已验证范围。

历史 P3–P6 浏览器脚本保留在原位置，对应旧标签；其中旧语言按钮和列表默认数值墙的断言不再作为 P7 标准。当前主浏览器入口使用 P7 全场景及原真实手机触控/教学回归，原有 Vitest 规则测试全部保留，涉及新交互的期望同步升级。

## 截图

| 场景 | 图片 |
| --- | --- |
| 1080p 标题 | [中文](../verification/p7-start-screen-zh-1080p.png) · [英文](../verification/p7-start-screen-en-1080p.png) |
| 英雄图鉴 | [大头照](../verification/p7-compendium-heroes-portraits.png) · [详情](../verification/p7-compendium-hero-detail.png) |
| 怪物 / 神兵图鉴 | [怪物](../verification/p7-compendium-bosses-portraits.png) · [神兵](../verification/p7-compendium-weapons-portraits.png) |
| 四类手账 | [神兵](../verification/p7-armory-large-font.png) · [商店](../verification/p7-market-large-font.png) · [段位](../verification/p7-leaderboard-large-font.png) · [名片](../verification/p7-profile-large-font.png) |
| 战斗提示 | [双英雄目标](../verification/p7-battle-merge-multi-highlight.png) · [同级升星](../verification/p7-battle-upgrade-highlight.png) |
| 顶行与相邻目标避让 | [桌面](../verification/p7-desktop-top-row-highlights.png) · [手机横屏](../verification/p7-mobile-landscape-top-row-highlights.png) |
| 手机布局 | [横屏英文详情](../verification/p7-mobile-landscape-en-detail.png) · [竖屏首页](../verification/p7-mobile-portrait-menu.png) · [竖屏详情](../verification/p7-mobile-portrait-hero-detail.png) |

## 版本与裁定

基线 `b80fd33` / `v1.0-p6` 完整保留，本轮位于本游戏独立 Git 仓库的 `p7-readability-compendium` 分支，以 `v1.0-p7` 保存，没有推送或合并父仓库。复核修复提交为 `075e3bf`。

正式服务保持在 `http://127.0.0.1:4175/`。后续双击本目录 `Start-Capybara.cmd` 可构建并启动；`Stop-Capybara.cmd` 停止本游戏服务。

- 按用户限定的原游戏路径直接工作，用新分支隔离版本；不另建外部工作树。
- 设计文档与用户逐项指令的小数值差异采用用户更明确的 148px SVG 字号、橘子 (160,58)、非目标透明度 .72；影响仅为这些视觉细节。
- P7 浏览器入口更新为新交互验收，历史脚本仍保留；旧页面结构的断言由新头像/详情和菜单唯一语言入口的检查接替。
