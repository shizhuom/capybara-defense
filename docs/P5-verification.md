# P5 温泉手账、五步教学与段位难度验收

日期：2026-11-14。起点：`v1.0-p4` / `200dd14`。独立仓库：`D:/rea_game/games/capybara-defense/`；分支：`p5-ledger-tutorial-difficulty`；版本标签：`v1.0-p5`。

## 完成内容

### 美术与六类手账页面

- 将全部 **185 PNG + 原始 manifest** 同步至 `public/assets/sprites/`，保留全部 P4 美术并增加 12 枚 P5 贴纸。`AssetRegistry` 使用相对部署路径，12 枚新图标均有独立 SVG 几何兜底；菜单金币、星星与券随资源解码更新。
- 新增 `LedgerView.ts` 与最后加载的 `p5.css`。固定胡桃木题头和书签，羊皮纸正文独立滚动。名片 / 段位 / 设置互通，神兵 / 黑市互通，实时钱包与现有暂停、商店准备期同步规则保留。
- 图鉴：收录进度、矩阵基底/穿搭标识、收藏印章、品质卡片，伤害四舍五入，攻速最多两位小数、射程最多一位；成长表完整可滚动查看。
- 神兵：12 英雄双贴纸立牌、桌面三列武器卡、每张四个同系英雄穿戴芯片，当前穿戴者再次点击卸下；原 select 与品质回收 checkbox 保留。
- 黑市：左摊位 / 木质扭蛋机，右侧独立滚动的 2 主动 + 6 被动挂板与背包；装备与跑马灯重绘保留滚动位置。免费券优先，无券抽奖 **60 金币**。
- 段位：个人进度与真实怪物强度横幅、前三领奖台、个人高亮条卡。名片：木牌通行证、星槽、四格统计与四列头像墙。设置：木质滑杆、胶囊开关、中英切换与立即重开的教学入口。

### 五步教学与防误触

- `tutorialGuided` 默认关闭；只对教学局首次摇铃发放 Lv.1 的 `hamster, hamster, panda, hat_bamboo, squirrel`。常规种子抽卡与升阶道具逻辑保留。
- 五步为摇铃 → 落子 → 基础宠升星 → 传奇配方 → 打开图鉴。卡片包含向导贴纸、步骤点、手势、源/目标聚光与虚线箭头，气泡避开实际交互目标。
- 教学期间冻结首波准备计时；完成或跳过后至少保留 8 秒。缺少配对件可确认继续；第 4 步只有英雄合成/喂养或确认才推进，普通升级不会误跳过英雄讲解。
- 完成仅首次领取 +20 金币；跳过无奖励。重温从菜单或局内均开启固定教学包的新战局；保存失败不会丢旧数据或重复发奖。
- 空白、自身和无效地块轻点静默取消。棋盘单位点空垫/空窝不移动；非合成目标切换属性焦点；真合成正常执行。窝内点空垫可部署，显式拖拽和键盘移动/换位保留。
- 拖动物时清除此前选中的主动道具，防止把移位误识别为使用奶瓶。无效主动道具轻点不扣次数、不弹错误。

### 段位与波次

- `getRankDifficulty` 同时提供 HP、速度、怪数、刷怪间隔、护甲和首领技能冷却参数，并用于引擎与界面。
- 规范全部 HP/速度区间端点间线性插值；常规 Rank 0→53 为 HP 1→6.2、速度 1→1.28；仅 Rank 0 教学局为 HP 0.85。
- 额外怪量严格为 `floor(rank/4)`；间隔严格为 `max(.62, 1-rank*.007)`，故 Rank 53 为 **.629**，遵循公式而非表中四舍五入的 .62。
- 未指定精确公式的两项：护甲在 Rank 20 为 +.04，平滑至 Rank 53 的 +.10，仅作用于带甲单位；Boss 冷却锚点为 Rank 0/9=1、10=.94、20=.90、30=.84、39=.80、53=.75。金币奖励线性取整 60→220。
- 高段位更早混入蟑螂、螃蟹、杀人蜂与迷弟鼠；先锋与双 Boss 波次按规范门槛触发，副 Boss 延后 5 秒且种类不同。
- 普通波等待额外怪物生成完毕才推进；第 10 波同时等待动态总怪数、待生成副 Boss 和存活敌人全部结束。解决高段位长波次被 36 秒间隔截断的问题。

P2 的 22 初始口粮、10/12/14…五连抽、1 初始铲子、55/30 秒铲子恢复、击杀收入、四张 9×5 地图、36 神兵、20 道具及旧存档隔离均保留。

## 验证结果

| 检查 | 结果 | 证据 |
|---|---|---|
| 全量 Vitest | **826 / 826**，0 失败；P4 的 780 项保留，新增 46 项 | [p5-tests.json](../verification/p5-tests.json) |
| 类型检查及构建 | `npm run build` 通过，包含 `tsc --noEmit`；67 模块 | 终端执行；`dist/` |
| 资源同步 | `npm run sync-assets` 成功复制 185 项 | [隔离/资源报告](../verification/p5-isolation-report.json) |
| P5 浏览器 | 桌面与手机横屏各七页面、两语言、五步实际教学，全部通过；34 张截图；Console/pageerror 0 | [p5-browser-report.json](../verification/p5-browser-report.json) |
| P4 启动页回归 | 6 组通过，延迟清单/兜底、手机构图与入口保留 | [p4-browser-report.json](../verification/p4-browser-report.json) |
| P3 战斗回归 | 14 组通过，准备期换装、四地图、属性卡、触控和英文均通过 | [p3-browser-report.json](../verification/p3-browser-report.json) |
| 手机字号与教学 | 9 组通过，844×390 与 390×844 中英教程/Boss HUD 可读 | [p3-mobile-typography-report.json](../verification/p3-mobile-typography-report.json) |
| 正式构建 | 无 debug API；390×844 实际召唤/结算/重载正常；`/p5-check/game/` 子目录 185 PNG 及音频清单正常；0 报错 | [p5-production-report.json](../verification/p5-production-report.json) |
| 普通 / 测试存档 | 4 组切换、精确恢复和写盘失败回滚通过 | [p5-profile-switch-report.json](../verification/p5-profile-switch-report.json) |
| 隔离 | **2363 个受保护文件零变更**；185 PNG + manifest 与只读来源逐字节一致；4 地图 1280×720 | [p5-isolation-report.json](../verification/p5-isolation-report.json) |

所有浏览器测试使用独立临时浏览器环境，不读取或覆盖用户真实浏览器存档。截图和测试临时文件只写在本游戏目录。

## 复核与实际修复

独立只读复核没有发现 P0/P1，发现两项交互问题：选中道具时拖动物可能错误使用道具，背包独立滚动区在装备重绘时回到顶部。均先补失败测试，再修复并在真实浏览器重验。最终截图复查另外修复了神兵正文的平滑滚动恢复竞争和手机扭蛋中心按钮继承旧最小高度的问题，新增断言保证穿戴位置稳定且九宫格可完整同屏查看。

P5 规范要求的无券抽奖 60 金币已同时修改交易代码与双语文案，并测试 59 金币失败、60 金币成功和免费券优先。原 M2 的 80 金币期望按明确的 P5 规则更新；其余存档与抽奖事务断言保留。

本轮数值验收覆盖公式、顺序、边界和战斗生成行为；未声称所有段位的实际胜率已经过玩家大样本平衡验证。

## 实机截图

桌面视口 **1280×720**，手机横屏 **844×390**。内部滚动区域允许滚动到全部内容，固定题头与页签不会随内容离开视口。

| 页面 | 桌面 | 手机横屏 |
|---|---|---|
| 图鉴 | [合成总览](../verification/p5-desktop-compendium.png) · [成长表底部](../verification/p5-desktop-compendium-growth.png) | [合成总览](../verification/p5-mobile-landscape-compendium.png) · [成长表底部](../verification/p5-mobile-landscape-compendium-growth.png) |
| 神兵 | [总览](../verification/p5-desktop-armory.png) · [头像穿戴](../verification/p5-desktop-armory-equip.png) | [总览](../verification/p5-mobile-landscape-armory.png) · [头像穿戴](../verification/p5-mobile-landscape-armory-equip.png) |
| 商店 | [黑市](../verification/p5-desktop-market.png) | [黑市](../verification/p5-mobile-landscape-market.png) |
| 扭蛋 | [九宫格](../verification/p5-desktop-lottery-machine.png) | [完整九宫格](../verification/p5-mobile-landscape-lottery-machine.png) |
| 段位 | [风云榜](../verification/p5-desktop-rank.png) | [风云榜](../verification/p5-mobile-landscape-rank.png) |
| 名片 | [通行证](../verification/p5-desktop-profile.png) | [通行证](../verification/p5-mobile-landscape-profile.png) |
| 设置 | [中文](../verification/p5-desktop-settings.png) · [English](../verification/p5-desktop-settings-en.png) | [中文](../verification/p5-mobile-landscape-settings.png) · [English](../verification/p5-mobile-landscape-settings-en.png) |
| 教学 1 | [摇铃](../verification/p5-desktop-tutorial-1.png) | [摇铃](../verification/p5-mobile-landscape-tutorial-1.png) |
| 教学 2 | [部署](../verification/p5-desktop-tutorial-2.png) | [部署](../verification/p5-mobile-landscape-tutorial-2.png) |
| 教学 3 | [升星](../verification/p5-desktop-tutorial-3.png) | [升星](../verification/p5-mobile-landscape-tutorial-3.png) |
| 教学 4 | [合成英雄](../verification/p5-desktop-tutorial-4.png) | [合成英雄](../verification/p5-mobile-landscape-tutorial-4.png) |
| 教学 5 | [查看图鉴](../verification/p5-desktop-tutorial-5.png) | [查看图鉴](../verification/p5-mobile-landscape-tutorial-5.png) |

PNG 按既有 Git 忽略规则保留在本机 `verification/`，未打包进游戏运行资源；报告、脚本和代码进入版本记录，可按脚本重新生成截图。

## 启动与版本

正式服务：<http://127.0.0.1:4175/>。以后双击 `Start-Capybara.cmd` 构建并启动；`Stop-Capybara.cmd` 停止。若已有旧版网页，刷新页面加载 P5。

本地保存 P5 标签 `v1.0-p5`，保留 P4 标签 `v1.0-p4`。需要分支试改时可从任一标签创建新分支；浏览器存档独立于 Git，应另外备份。未推送或发布到远端。
