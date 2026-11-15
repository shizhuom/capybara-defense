# P9 / v2.0 验收记录

日期：2026-11-15。实施范围仅为本游戏目录；本地地址保持 `http://127.0.0.1:4175/`，存档前缀保持 `capybara_defense_v1:`。

本地交付分支 `p9-v2-overhaul`，版本标签 `v2.0-p9`；此前 `v1.0-p8` 保留，可通过 Git 检出或另建分支继续不同方向的开发。

## 已交付

- 201 张贴图及清单同步，8 个 P9 新角色/UI 图标均有离线 SVG 兜底；原画只读。
- 菜单、战斗、首领三套 16 小节音乐（116 / 124 / 138 BPM），主压缩总线、手机频段谐波、手势解锁与前后台恢复。加入拔剑开战、四类打击、六类怪物死亡和入场提示音。
- 1.25 秒木帘开战演出（减少动态效果时 250 毫秒）；演出期间准备倒计时驻停，打开设置或装备弹窗后保持暂停。
- “随机”从已解锁地图池真正随机抽取，手动选图与首局后院教学保持确定行为。
- 按历史最高星数分为 0 / 1 / 4 / 8 / 12 / 20 星六档解锁。0 星仅有 7 种抽卡结果、2 位英雄、2 种小怪和 1 位首领；20 星开放完整阵容。图鉴显示剪影、解锁星数和锁定详情，突破档位时结算展示新阵容。
- 神兵页改为四列武器卡架、卡皮巴拉铁砧展示台和同系英雄头像穿戴；黑市改为浣熊摊位、三件每日商品、道具卡包架、八格出战挂板和扭蛋机。所有穿戴/购买/回收/付费与免费抽奖逻辑仍需成功保存后才确认结果。
- 文案清理覆盖全部中英语言表和配置数据；保留 P8 的粗体与高对比度要求。

## 自动化验证

| 检查 | 结果与证据 |
|---|---|
| `npm run sync-assets` | 201 个 PNG；清单与只读素材源一致 |
| `npm test` | 50 个文件，**1012 / 1012** 通过；原有 952 项行为覆盖保留，仅更新被 P9 明确取代的断言 |
| `npm run build` | TypeScript 零错误，Vite 82 个模块构建成功，`base: './'` 保留 |
| 桌面、手机布局与交互 | [浏览器报告](../verification/p9-browser-report.json)：1366×768、844×390、1920×1080、390×844，中英文页面、购物/穿戴/刷新/扭蛋、幕布、图鉴解锁、胜负结算和入场提示 |
| 粗体与对比度 | 92 个页面状态、5598 段实际文本逐项计算；字重至少 700，最低实测对比度 9.804:1，无横向溢出；长内容在独立滚动区域内可达 |
| 操作边界 | [交互回归](../verification/p9-interaction-report.json)：幕布中开弹窗、抽屉保持、键盘焦点、手机首屏商品、左右属性卡避让 |
| 首局教程 | [手机教程报告](../verification/p3-mobile-typography-report.json)：横/竖屏、中/英文五步触屏教学和 Boss HUD 回归 |
| 实际构建产物 | [生产报告](../verification/p9-production-report.json)：无开发调试 API、正常重抽与存档重载、嵌套部署路径下 201 张图片及音频清单正确解析 |
| 普通档/测试档隔离 | [存档切换报告](../verification/p9-profile-switch-report.json)：四个生产环境切换场景通过，写入失败不破坏原档与备份 |
| 工作区隔离 | [隔离报告](../verification/p9-isolation-report.json)：2395 个受保护文件无变动；素材源与目标图片哈希一致 |

控制台错误、页面异常和损坏图片均纳入浏览器断言。浏览器测试运行在独立临时上下文，未修改玩家实际浏览器存档。

## 音频验证

[实际 Chromium PCM 报告](../verification/p9-audio-report.json) 测量三套音乐、全部新音效、默认/最大音量下的密集战斗、循环衔接、暂停静音、重新解锁与资源释放。合成音符保留压缩余量，测量中无满幅削波；在恢复和销毁后分别确认继续出声和节点清空。

最终密集战斗采样：默认音量 RMS 0.0418 / 峰值 0.6663，最大音量 RMS 0.0709 / 峰值 0.8221，削波样本均为 0。实际调度与噪声源会令不同轮次的瞬时峰值略有差异；完整数据以报告为准。

可直接试听本机生成的 [菜单音乐](../verification/p9-audio-menu.webm)、[战斗音乐](../verification/p9-audio-battle.webm)、[首领音乐](../verification/p9-audio-boss.webm)、[音效合集](../verification/p9-audio-sfx.webm)、[默认音量密集战斗](../verification/p9-audio-busy-default.webm) 与 [最大音量密集战斗](../verification/p9-audio-busy-maximum.webm)。这是浏览器实际音频采样，不是物理 iPhone、Android 或微信设备扬声器验收；真实设备的静音拨杆与系统中断行为仍需上机确认。

## 实机截图

- [桌面随机地图入口](../verification/p9-desktop-start-random.png)
- [拔剑木帘演出](../verification/p9-desktop-battle-clash-curtain.png)
- [桌面武器架与铁砧](../verification/p9-desktop-armory-pedestal.png)
- [桌面浣熊货架](../verification/p9-desktop-market-trunk-packets.png)
- [扭蛋机](../verification/p9-desktop-gacha-arcade.png)
- [0 星剪影图鉴](../verification/p9-desktop-compendium-zero-stars.png)
- [胜利结算](../verification/p9-desktop-victory-unlock.png) 与 [升星解锁庆祝](../verification/p9-victory-roster-unlock-celebration.png)
- [手机横屏黑市](../verification/p9-mobile-market-trunk-packets.png)
- [手机道具卡架](../verification/p9-mobile-market-packet-rack.png)
- [入场提示避让动物属性卡](../verification/p9-mobile-entry-with-live-card.png)

全部截图、试听文件保存在本地 `verification/`；与既有仓库规则一致，PNG/WebM 不进入 Git，JSON 验证报告进入版本记录。

## 实施取舍与兼容性

1. 在用户指定的现有独立游戏仓库内实施并保留 `p9-v2-overhaul` 本地分支；没有创建外部工作树，也没有合并或发布到其他仓库。
2. 最新 P9 指令的精确音量、节拍与 120 金币扭蛋价格优先于旧规范文字；原先依赖 60 金币或原生穿戴下拉框的测试改为验证相同交易边界和头像控件。
3. 普通游戏按历史最高星数开放阵容；独立无参引擎与测试档保持完整阵容，避免改变旧逻辑测试的种子随机序列。
4. 旧存档已经合成过的英雄及其配方组件保留开放；这些组件实际能够形成的交叉配方也显示可合成，避免图鉴与真实合成规则矛盾。因此个别老档可能比同星数新档开放更多内容。
5. 手势监听保留廉价的 `isUnlocked` 检查，以便系统后来中断音频时再次恢复；不在首次成功后永久移除恢复入口。
6. 实际 PCM 测量发现同时播放强音效时会削波，故在保持指定主总线参数的同时调整合成音符余量和并发打击预算。最终测量通过，物理设备音量未作未经验证的保证。
7. 审查发现的提示丢失和键盘焦点问题按玩家可见功能缺陷修复，没有延期项。过程记录留在本项目的忽略目录中，不清理其他版本的运行材料。

## 运行与复验

正常启动使用本目录的 `Start-Capybara.cmd`；已有服务时直接打开 `http://127.0.0.1:4175/`。开发验证使用：

```powershell
npm run dev
# 另一个终端，仍在本游戏目录：
npm test
npm run build
npm run test:browser
node scripts/p9-isolation-check.mjs
```

`npm run test:browser` 使用本机 Chrome（可通过 `CAPY_CHROME` 指定），依次运行 P9 页面、交互、实际 PCM 和原有手机五步教学回归。生产产物检查可设置 `CAPY_TEST_URL=http://127.0.0.1:4175/dist/` 后运行 `scripts/p9-production-qa.mjs` 与 `scripts/p3-profile-switch-qa.mjs --label=p9`。
