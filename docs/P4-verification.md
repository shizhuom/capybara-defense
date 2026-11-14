# P4 萌宠围炉启动页验收

日期：2026-11-14。起点：`v1.0-p3` / `1b1bdfe`。实现位于独立仓库 `D:/rea_game/games/capybara-defense`，分支 `p4-start-splash`。

## 实现

- 主菜单使用 `start_splash_bg` 全幅插画，不再调用战斗地图、网格和空垫绘制。新增 `src/render/SplashScene.ts`，独立负责温泉兜底、5 缕蒸汽和 14 枚按地图变化的环境粒子；不创建战斗、不读取或推进战斗状态。
- `CourtyardView.ts` 使用语义化 H1 和按钮展示中英双语艺术字及异形木牌。删除矩形标题牌、独立 logo、平面绿色开始条和巨型功能卡片；四个功能入口以圆形贴纸分列左右下角，地图条移到画面底边。
- `stickers.ts` 增加等比宽幅 `artSticker`、奖杯和路标矢量兜底；共享解码注册表及 `assetsDirty` 刷新流程。PNG 尚未就绪时显示无框描边艺术字，不出现损坏图片；资源就绪后保留当前语言并自动升级。
- `p3.css` 仅调整菜单构图，保留战斗 HUD、教程和属性卡。支持键盘焦点、轻柔待机动画、按压/悬停反馈及减少动态效果的 CSS 偏好。
- 同步全部 **173** 张 PNG 与原始 `manifest.json`；新增 7 项 P4 资源。四张战斗地图仍是 1280×720，所有行走帧、武器和特效保留。
- 玩法数值、存档结构、54 段位与地图解锁规则不变；默认玩家视图、开发者抽屉和普通/全满测试档隔离机制保留。

## 验证证据

| 检查 | 结果 | 证据 |
|---|---|---|
| Vitest | **780 / 780**，0 失败 | `verification/p4-tests.json` |
| TypeScript | `npm run typecheck` 通过 | 本次终端执行 |
| 正式打包 | `npm run build` 通过 | 本次终端执行；Vite 64 模块 |
| P4 主菜单 | 6 组检查通过，Console/pageerror 0 | `verification/p4-browser-report.json` |
| P3 战斗回归 | 14 组检查通过，Console/pageerror 0 | `verification/p3-browser-report.json` |
| 手机字号与触控引导 | 9 组检查通过，Console/pageerror 0 | `verification/p3-mobile-typography-report.json` |
| 正式版与相对路径部署 | 正式版无 debug API，子目录 173 张 PNG/音频清单加载，0 报错 | `verification/p4-production-report.json` |
| 普通/测试档切换 | 4 组事务与恢复检查通过 | `verification/p4-profile-switch-report.json` |
| 隔离与资源 | 2346 个受保护文件 0 改动；173 PNG + manifest 字节一致 | `verification/p4-isolation-report.json` |

原有 762 项测试中，4 项“菜单在地图终点显示守护者”的 P3 要求被 P4 专属启动场景测试取代；其余逻辑断言保持，新总数为 780。新增覆盖：四种气氛下同一专属背景、缺图温泉兜底、蒸汽与粒子变化、7 项 PNG 尺寸、两种语言艺术字、宽幅辅助函数和转义、几何贴纸兜底、菜单动作与地图锁定状态。

浏览器使用独立临时浏览器环境，未接触用户真实浏览器存档。验证了桌面/手机两种语言的地图、名片、设置、图鉴、神兵、商店、风云榜、开始守护及投降返回；模拟清单延迟，确认 SVG 到 PNG 的异步切换；额外覆盖高段位英文、较长金币/券数及 320px 窄屏。发现并修复 320px 徽章侵入景区的问题，重跑场景几何/点击检测通过。

## 实机截图

- [中文桌面 1440×900](../verification/p4-start-screen-zh.png)
- [英文桌面 1440×900](../verification/p4-start-screen-en.png)
- [手机横屏 844×390](../verification/p4-start-mobile-landscape.png)
- [手机竖屏 390×844](../verification/p4-start-mobile-portrait.png)
- [PNG 未就绪时的温泉及 SVG 兜底](../verification/p4-fallback.png)

四张要求截图均通过人工看图检查：无标题框、无绿色开始横条、动物与卡皮巴拉完整可见、地图与徽章不覆盖中心、真实按钮中心点击无阻挡。竖屏仍使用同一个 16:9 场景，保持插画完整。

## 实施选择

1. 按指定目录在独立游戏仓库内建立 P4 本地分支，没有另建工作树。代价是没有第二份工作目录；P3 标签和独立分支完整保留，可随时恢复。
2. 使用原生 PowerShell 维护实施记录和验证结果，替代在当前 Windows 环境不可用的 Bash 工作流脚本。代价是记录由执行者维护，验证输出与 Git 历史提供交叉证据。
3. 手机竖屏将铭牌/系统键放在画布上方相邻留白、地图条放在下方，徽章仍在场景底部左右角。与桌面的精确百分比位置有所不同，换取不遮挡标题和动物、保持可读点击区域。战斗界面的既有留白布局保持不变。

## 启动及复验

双击本目录 `Start-Capybara.cmd`，访问 `http://127.0.0.1:4175/`；停止使用 `Stop-Capybara.cmd`。当前服务已使用 P4 正式构建。

```powershell
npm test
npm run typecheck
npm run build
npm run dev
# 在另一个终端运行，测试使用临时浏览器环境：
npm run test:browser
# 正式启动脚本运行时：
node scripts/p4-production-qa.mjs
node scripts/p3-profile-switch-qa.mjs --label=p4
node scripts/p4-isolation-check.mjs
```

源设计文件始终只读；所有代码、配置、验证图片及记录都在游戏目录内。端口仍为 4175，所有存档仍使用 `capybara_defense_v1:` 前缀。
