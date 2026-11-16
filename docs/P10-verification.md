# P10 地图泡澡融合与绘本图鉴验收

基线：`87298ee` / `v2.0-p9`。本轮工作位于 `p10-storybook-baths`；所有写入均在本游戏目录内。

## 已交付

- 同步设计目录的 **205 张原始 PNG** 与完整 manifest，逐文件哈希一致。三张原生澡盆地图更新为注水版本；樱花温泉原图保持一致，四张地图仍为 1280×720，格子与路径未改。
- `src/config/guardianBaths.ts` 统一四个水面锚点。局内改用无桶、无白边半身水豚，失守使用直立晕眩版本，添加水纹、热气和轻微浮沉；橘子堆叠与飞出使用相同的水面锚点。
- 新增四枚贴纸的 HTML SVG 兜底和 Canvas 无桶半身兜底；真实浏览器里缺失新 PNG 时不会调用旧木桶图。
- 图鉴采用窄版暖可可档案夹、探头水豚、描边标题、六枚文字标签、单列暖白绘本横卡和框外贴士。五类条目保留详情、成长表、翻页、返回及焦点恢复；合成页顶部提供十二条配方，底部保留详情和可折叠速查矩阵。
- 中英文短传不堆放数值，已拥有/已收录显示手绘对勾；未合成、待收集和星级未解锁各有明确状态。P9 的星级门槛、旧档已合成英雄兼容和测试档隔离保持原状。

## 自动测试

| 检查 | 结果 |
| --- | --- |
| 升级前基线 | 1012 项通过 |
| 全量 Vitest | **1040 项 / 52 文件全部通过** |
| 新增澡盆与素材测试 | 15 项：四地图锚点、图片大小、直立晕眩、橘子轨迹、浏览器缺图兜底、205 素材和四枚 SVG |
| 新增绘本图鉴测试 | 13 项：行结构、无数值文案、配方列表、状态对勾、成长与矩阵兼容、双语与解锁 |
| `npm run typecheck` / `npm run build` | 通过 |
| 独立只读代码审查 | 未发现 Critical / Important 问题；无推迟修复项 |

旧测试仅更新被 P10 明确替代的素材数量、水面绘制锚点与列表状态文字断言；碎片门槛、护甲、成长数值、条目数量和功能检查均保留。

## 浏览器验收

Chrome 无头浏览器使用独立临时上下文；没有读写玩家日常浏览器存档。

- `scripts/p10-browser-qa.mjs`：**76 次布局检查，55 张截图**。覆盖 `1366×768`、`844×390`、`390×844`，中英双语六页签、配方定位、详情翻页/返回焦点、成长表末行可达、零星锁定剪影、四地图正常/晕眩状态和离线素材兜底。Console / pageerror / 坏图 / 横向溢出均为 **0**。
- `scripts/p10-production-qa.mjs`：直接从 `dist/` 读取实际发布文件，在根路径和子目录挂载检查相同三个视口。205 PNG 均使用相对地址加载，生产包不暴露调试桥。图鉴交互、教程摇铃、暂停弃守、结算和存档重载通过。
- 生产包额外对神兵、商店、名片、段位、设置、暂停和失败结算执行 **36 次非图鉴页面样式审计**，粗体/对比度问题为 **0**，没有渗入 P10 专属装饰。
- 目视检查了桌面配方列表、英雄列表/详情、手机横竖屏中英列表、成长表、四张地图及离线兜底。已修复继承的标签负偏移、配方列表缩窄、英文窄屏标签断词和详情旧金色边框。

主要截图位于 `verification/`：

- `p10-bath-<mapId>.png`、`p10-bath-<mapId>-dizzy.png`
- `p10-desktop-zh-CN-recipes.png`、`p10-desktop-zh-CN-heroes.png`
- `p10-landscape-zh-CN-heroes.png`、`p10-portrait-en-heroes.png`
- `p10-<desktop|landscape|portrait>-<zh-CN|en>-hero-detail.png`、`...-hero-growth.png`
- `p10-portrait-offline-storybook.png`、`p10-portrait-offline-bath.png`
- `p10-production-<desktop|landscape|portrait>.png`

报告：`verification/p10-browser-report.json`、`verification/p10-production-report.json`、`verification/p10-isolation-report.json`。

## 隔离与实施取舍

- **2407 个受保护文件**做升级前后 SHA-256 比对，原仓库基线和设计目录零变更；三个音乐/音效源码文件逐字节一致。本轮没有调整音量、音轨、音效或播放逻辑。
- 游戏规则、路径、存档结构与前缀没有变更。保留 P9 基线分支/标签；P10 留在独立本地分支，不合并或发布。
- 萌宠列表继续为原有 19 项（五基础宠与十四组件）；铲子仍可从局内详情深链查看。若把工具也加入列表会改变既有数量契约，本轮未扩充目录。
- 新规范指定的可可色调只覆盖图鉴。手机英文标签用 `Arms`，八倍镜武器在列表用汉字“八”显示；详情和实际名称/数值保持原样。窄屏底部两条提示按需换行以避免裁切。
- 无外部图片时，部分已有角色仍沿用原有 Emoji 兜底；本轮新增四枚贴纸均为独立 SVG/Canvas 几何图形。
- 浏览器结果来自 Chrome 无头验证；未声称已在实体手机或其他浏览器完成验收。

## 运行与复验

双击游戏目录内 `Start-Capybara.cmd`，访问 **http://127.0.0.1:4175/**。

```powershell
npm run sync-assets
npm test
npm run build
npm run test:browser
node scripts/p10-isolation-check.mjs
```

浏览器脚本需要本机 Chrome 和 4175 上的开发服务；`CAPY_CHROME` 可指定 Chrome 路径。保护哈希基线保存在 `.runtime/p10-protected-before.json`；重新开始独立工作会话时应在改动前重新捕获，不能在改动后覆盖原验收基线。
