# P1 交付与验收记录

日期：2026-11-13。游戏目录：`D:\rea_game\games\capybara-defense`。

P1 功能、133 张正式美术接入、逻辑测试、开发浏览器与生产构建验收已完成。**唯一未执行项是临时验证副本的删除**：环境自动审批拒绝了递归删除操作，缓存保留；限定目标的清理脚本已准备并通过只读预览。

## 使用

- 正式入口：<http://127.0.0.1:4175/>。默认居中单屏模式，390×844 下棋盘、宠物窝、召唤、洒水器与主动道具完整可见。
- 启动：本游戏目录的 `Start-Capybara.cmd`；停止：`Stop-Capybara.cmd`。交付时生产服务健康检查返回 `app=capybara-defense`、PID `24124`。
- 开发入口：<http://127.0.0.1:4175/?dev=1>，或在设置中打开「开发者沙盒面板」。关闭开关立即收起侧栏并移除 URL 覆盖。
- 素材同步：`npm run sync-assets`。只读 `../../design/assets/sprites/`，更新游戏内 PNG 与排序 manifest，不删除已有目标 PNG。
- M3 回退点：`backups/m3-before-p1.zip`，包含 P1 开始前源码、配置与运行脚本，不含依赖或浏览器存档。

## 功能与模块

| 模块 | 落地行为 | 主要文件 |
| --- | --- | --- |
| 正式视图 | 默认隐藏沙盒/旁栏；按 640:1386 等比缩放；真实触摸不带动页面滚动 | `src/ui/p1.css`、`GameApp.ts`、`ProfileScreens.ts` |
| 战斗可读性 | 棋盘和窝全场配对提示、绿色升星角标、金色合成双环/星芒、12 英雄主题底座、波次条、玩家侧最靠近终点的 Boss 血量与技能预警 | `core/MergeTargets.ts`、`render/StickerRenderer.ts`、`ui/BattleHUD.ts` |
| 对手 | 五档精确节拍与开局延迟、合法神兵/被动/主动配装、封印延迟解控、危机爆发、角落/中轴布阵、近段位昵称头像 | `config/opponents.ts`、`core/OpponentAI.ts` |
| 声音 | Menu Chill 84 / Garden March 108 / Boss Rush 124 BPM 多轨；弹窗切舒缓模式；命中全局 ≥95ms；一组 AudioContext/总线/调度器；可选外部音频 | `ui/MusicTracks.ts`、`SoundManager.ts`、`scripts/audio-manifest.ts` |
| 引导与百科 | 真实召唤→上棋盘/挖地→合成/确认；可跳过/重看；20 金币只发一次；12/12/36/20 四页双语百科，含护甲/克制/当前解锁状态 | `core/Tutorial.ts`、`ui/TutorialView.ts`、`Compendium.ts`、`i18n/p1.ts` |
| 全场景贴图 | 133 张外图；地图后叠加 O/B 动态垫层；对象、角色、Boss、道具、神兵、头像和主视觉覆盖；无图回退；迟到素材不重置拖拽/开奖 | `render/AssetRegistry.ts`、`ui/stickers.ts`、`render/M3Art.ts`、`scripts/sync-assets.mjs` |
| 发布 | `base:'./'`；开发与构建过滤缺失音频声明，避免请求不存在文件；构建子目录加载通过 | `vite.config.ts`、`scripts/audio-manifest.ts` |

素材构成：4 地图 + 2 动态地块 + 5 物件 + 19 基础宠/组件 + 12 英雄 + 5 普通/召唤怪 + 12 Boss + 20 道具 + 36 神兵 + 16 头像 + 2 主视觉 = **133**。完整字典见 `public/sprites/README.md`。

## 测试与构建

最终命令原始输出保存在 `verification/p1-*.txt`，退出码/时间见 `verification/p1-command-results.json`。

| 命令 | 结果 |
| --- | --- |
| `npm test` | **24 文件，576/576 通过**：原 427 项保留，新增 149 项 |
| `npm run typecheck` | 退出 0，类型错误 0 |
| `npm run sync-assets` | 退出 0，复制 133 张、manifest 133 项 |
| `npm run build` | 退出 0，55 模块；JS 291.03 kB / gzip 104.46 kB，CSS 48.74 kB / gzip 11.33 kB |

原 18 个测试文件均保留；15 个内容不变。其余 3 个仅适配新增默认字段/旧档教程迁移，以及 P1 多轨和弦/新增橘子音效，不删除或跳过旧用例。音频断言调整逐项记录于 `P1-audio-report.md`。

新增重点：五档 AI 边界和独立 RNG、实际封印反应/合法道具调用、全部配方/喂养/禁合/洗衣排除、引导顺序和重复奖励、存档迁移、资源路径与回退、同步幂等和链接拒写、全部英雄底座、三态多轨和节流、AudioContext 生命周期/异步销毁、可选音频过滤及构建输出边界、Boss HUD、百科完整翻译和真实空窝移动不推进引导。

## 浏览器与截图

使用本机 Chrome、Playwright Core 独立上下文，没有操作用户日常浏览器存档。

| 验证脚本 | 结果 |
| --- | --- |
| `scripts/p1-browser-qa.mjs` | 8 组通过：390×844、真实召唤/拖拽引导、一次奖励、沙盒即时切换、配对/Boss/四页双语百科、桌面四地图和黑市闭环 |
| `scripts/p1-assets-browser-qa.mjs` | 4 组通过：空 manifest 全回退、133 PNG 延迟到达不重复开奖、真实 CDP 触摸落子 scrollY=0、实际音频模式切换 |
| `scripts/p1-audio-overrides-qa.mjs` | 真实 WAV 解码/循环与音效覆盖、双音量总线即时静音、缺失声明零请求/零 404；结束自动恢复源 manifest 并删除测试 WAV |
| `scripts/m3-browser-qa.mjs` | 全流程通过：旧档迁移、16 头像/风云榜、设置写入失败、实际合成与晋级、320/390 布局、四地图、音频生命周期和测试档还原 |
| `scripts/production-smoke.mjs` | 构建产物 M1/M2/M3 全流程通过，无开发调试 API |
| `scripts/m3-profile-switch-qa.mjs` | 4 场景通过：局中恢复/开启隔离、同身份重复开启/无备份恢复、存盘失败保留旧局与备份 |
| `scripts/p1-production-qa.mjs` | 正式390×844一屏、五连换窝、百科/结算/重载通过；实际 dist 字节静态挂载 `/p1-check/game/`，脚本、样式、133 PNG 和音频清单均从子目录加载 |

上述成功运行的 **Console error / pageerror 均为 0**。音乐验证涵盖真实浏览器音频图、模式和解码，不把自动化验证描述为主观扬声器听感测试。

已查看的关键截图：

- [手机主菜单](../verification/p1-mobile-menu.png)、[手机引导](../verification/p1-mobile-tutorial.png)
- [选中配对金环](../verification/p1-mobile-gold-matches.png)、[拖拽配对金环](../verification/p1-mobile-drag-gold-matches.png)、[Boss 血条](../verification/p1-mobile-boss.png)
- [英雄百科](../verification/p1-mobile-book-heroes.png)、[Boss 百科](../verification/p1-mobile-book-bosses.png)、[神兵百科](../verification/p1-mobile-book-weapons.png)、[道具百科](../verification/p1-mobile-book-props.png)
- [桌面正式界面](../verification/p1-desktop-clean-menu.png)、[桌面战斗](../verification/p1-desktop-clean-boss.png)、[开发沙盒](../verification/p1-desktop-sandbox.png)
- [厨房地图](../verification/p1-map-midnight_kitchen.png)、[无图 SVG 回退](../verification/p1-mobile-props-fallback.png)、[子目录生产版](../verification/p1-subdirectory-mobile.png)

## 隔离、兼容与边界

存档仍使用 `capybara_defense_v1:profile`，平滑补充 `settings.developerMode`、`tutorialCompleted`、`tutorialRewardClaimed`。已有金币、胜场、物品和奖励收据保留；测试档备份仍独立，身份切换成功才丢弃旧局。端口仍为 `127.0.0.1:4175`。

`scripts/p1-isolation-check.mjs` 最终核验：初始 2105 个保护文件中 **2103 个哈希相同**，原仓库已跟踪文件 `git diff` 为空。两份只读文档 `design/codex_p1_polish_spec.md`、`design/codex_prompt_p1_polish.md` 在本次工作期间发生外部更新，设计目录另新增 172 个文件；已重新完整读取最新 P1 规范。所有代理文件写入均在本游戏目录内，未写 design。133 张游戏 PNG 与当前只读原画源逐文件哈希一致。证据：`verification/p1-protected-before.json`、`p1-design-update-observed.json`、`p1-isolation-report.json`。

资源同步与音频构建插件均拒绝目标符号链接/junction/祖先路径重定向，避免越界或覆盖游戏内源文件。已存在的相对静态部署通过验证；普通浏览器 `file://` 的模块/访问限制仍应使用本地 HTTP 或桌面容器协议处理。

## 尚未执行的缓存清理

`.runtime/m3-review-base`、`m3-profile-switch-before` 和本次 P1 审查副本暂留。已核验前两者为游戏内普通目录，随后两次删除尝试仍被环境自动审批拒绝（`sandbox_approval` 关闭），没有绕过限制，也没有将清理报告为完成。

已准备 `Clean-VerificationCache.cmd`；用户运行后调用带边界与链接检查的 `scripts/Clean-VerificationCache.ps1`，只删除 7 个固定验证副本名称，保留服务记录、浏览器目录和所有备份。`-Preview` 已确认所有目标位于本作 `.runtime/`。缓存已被 `.gitignore` 和 Vite watcher 排除，不影响正式运行。

## 实施裁定

1. 按用户明确的 P1 实施授权在现有隔离游戏目录执行，未创建根 Git/worktree 变更；独立模块按固定文件归属并行，随后分别审查。若需其他分支流程，应从游戏快照另建工作区。
2. 既有终点紧急洒水保持即时救命；普通 AI 操作仍遵守新开局延迟。若改为所有操作都延迟，需要重新调优早期救场行为。
3. 跳过引导不发金币且保留首次领奖资格；重看后首次完成可领 20，此后永不重复。若产品希望跳过即永久放弃奖励，只需调整教程规则与测试。
4. 旧已玩存档视为引导已完成，完整测试档也标记完成/已领奖；洒水器按 P1 新策略解除己方 SEALED。源原画到位后同步使用，资源缺失仍保留完整回退。

任务审查与修复证据见 `P1-core-review.md`、`P1-assets-review.md`、`P1-audio-review.md`、`P1-ui-review.md`；整体交叉审查记录于 `P1-final-review.md`。
