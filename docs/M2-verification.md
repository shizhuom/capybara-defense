# M2 交付与验收记录

验证日期：2026-11-13。工程：`D:/rea_game/games/capybara-defense/`。唯一 M2 规范为只读的 `D:/rea_game/design/codex_m2_spec.md`；采用其中最后统一的 36 把神兵表。总体设计、已调优 M1 代码和 `balance-v2-verification.md` 已在编码前阅读。

## 已实现范围

| 模块 | 实际行为 |
| --- | --- |
| `config/weapons.ts` | 三系各 12 把，品质均为 2白/2绿/2蓝/2紫/4橙，12 个唯一英雄专属；完整双语名称、词条、品质倍率、碎片门槛与掉落权重。 |
| `core/MetaProgression.ts`、`ui/storage.ts` | 同系独占穿戴/转移、碎片阈值解锁和品质回收、每日三商品/20币刷新、券优先/80币扭蛋、胜利加券、旧档迁移与全满测试档恢复。 |
| `core/WeaponSystem.ts` | 36 把武器的伤害/射程/攻速/控制/额外投射/资源词条，以及 12 本命觉醒。持续伤害保留来源，技能击杀能触发武器词条，附加投射防无限递归。 |
| `core/PropSystem.ts` | 全部 8 主动与 12 被动真实生效，装备上限 2+6；命令统一验证目标、阶段和冷却。金铲宝箱、肥橘救援、EMP 反噬、产粮与抽卡增益接入仿真。 |
| `core/CombatRules.ts` | 战斗、右侧档案和 Canvas 使用同一有效射程/充能规则。 |
| `core/BattleEngine.ts`、`OpponentAI.ts` | 双方各一次免费洒水车，120伤害/4.5格击退/2秒减速；AI 敌人进入最后2格时调用。Boss 与宝箱掉真实神兵 ID，胜者通吃双方袋子。 |
| `ui/MetaScreens.ts`、`m2.css` | 衣帽间、黑市货架与3×3跑马灯、2+6装备槽、点击/拖拽释放、全满测试/普通档恢复、快捷配装、解锁及获券提示。 |
| `render/M2Effects.ts`、`StickerRenderer.ts` | 刀鹅7/10段残影、篮球/毛线球逐段弹跳、逆向洒水车、纸箱与雨云、洗衣机、金铲、陷阱、肥橘和武器主题粒子。轨迹不依赖目标继续存活。 |
| `i18n/m2.ts` | 36 神兵及20道具的名称/说明、全部新界面、动态提示与奖励的 zh-CN/en 即时切换。 |

未给定的附加特效倍率和九宫格奖池分布记录于 [实施计划](M2-implementation-plan.md) 末节；物品界面显示实际数值。保留原 M1 即时伤害结算时序，路径事件在约1.1秒内完成多段可视演出。

## 存档与原 M1 保持

- 原存档键仍为 `capybara_defense_v1:profile`。有效金币、胜场、场次、奖励收据均保留，缺省 M2 字段补默认值。旧占位碎片每片只迁移一次至 `m01_swatter`，历史列表不删除。
- 每局奖励与收据一起保存，重开结算不重复领取。购买、刷新和扭蛋先落盘再更新展示，切语言、关闭动画或重载不会再次扣费兑奖。
- 全满模式先备份普通档，重复开启不会覆盖备份；恢复后移除测试标记并丢弃测试进度。存储失败分支有故障注入回归。
- 10粮五连抽/整窝重抽、余额不足不丢原卡、20秒准备、36秒波次、108秒首Boss、12秒自然铲子/上限6，以及早期敌血与二哈24秒毁格/至多2坏格均保留。装备加成仅对已配装局生效。
- 与开发前 ZIP 逐字节校验六份原配置 `enemies/heroes/maps/recipes/units/waves.ts`，全部相同：[比较结果](../verification/m2-m1-config-comparison.json)。

## 自动化与构建

最终源码冻结后的执行结果：

| 检查 | 结果 |
| --- | --- |
| `npm test -- --reporter=default --reporter=json --outputFile=verification/m2-vitest.json` | **12 文件、251/251 通过**，0 失败；原106项回归保留，新145项。 |
| `npm run typecheck` | `tsc --noEmit`，退出码0。 |
| `Start-Capybara.cmd` 内的 `npm run build` | TypeScript检查与Vite生产构建通过，35模块；JS193,521字节，CSS31,955字节。 |
| 生产服务健康检查 | `/__capy_health__` 返回 `app: capybara-defense`，仅监听本地4175；服务错误日志为空。 |

新增测试分布：神兵71、道具23、养成/迁移21、绘制27、双语3。完整断言结果保存在 [Vitest JSON](../verification/m2-vitest.json)。覆盖全部36武器、12觉醒、8主动、12被动、洒水车、非法操作、交易失败、每日轮换和存档兼容；概率分支采用确定性随机输入验证。

两次独立专项审查发现的问题均已关闭：

- [局外与渲染审查](M2-meta-render-review.md)：全满写入失败回滚、有效射程/充能可视化、购买及扭蛋货架补位。
- [战斗审查](M2-combat-review.md)：持续伤害归属/条件增伤、穿透首次命中、AI 洒水车。修复后额外定点验证弱DOT刷新不抢来源、来源离场后击杀、武器投射不递归、濒死救援与EMP致死反噬。

## 浏览器实机验证

使用本机 Chrome + Playwright Core，独立浏览器 context；不写用户日常浏览器存档。窄屏为320px视口模拟，非实体手机硬件测试。

- **M1回归20组全部通过**：真实鼠标拖拽、五连抽与未摆完重抽、口粮不足保卡、合成/喂养解控、铲地、六Boss、橘子与倍速、暂停、中英、双袋结算、重载、窄屏输入、12英雄大招绘制。原回归的占位碎片夹具更新为真实神兵 ID，仍检查通吃数量。[结果](../verification/browser-qa.json)
- **M2闭环8组全部通过**：旧档迁移 → 商店购买/补货/刷新 → 免费券优先扭蛋 → 动画中切语言/关闭重开不重复奖励 → 全满与普通档恢复 → 36武器筛选/同系转移/回收 → 2+6配装 → 点击奶瓶/真实拖放粘鼠板/洒水车 → Boss击杀掉落 → 胜利新解锁和发券 → 重载。含320px菜单、衣帽间、九宫格与战斗检查。[结果](../verification/m2-browser-qa.json)
- **生产版7组通过**：不暴露调试API；真实五连抽/换窝；暂停投降与持久化；全满衣帽间与中英穿戴；80币扭蛋扣费与40币奖励一次落盘；2+6、猫薄荷冷却及洒水车一次限制；普通档恢复并重载不变。[结果](../verification/production-smoke.json)
- 上述运行均 **console error 0、pageerror 0**。双语配置还由全量键/占位符测试验证。

已生成并抽查11张M2截图，菜单入口、物品说明、槽位和底栏未出现横向溢出或控件重叠：

- 桌面：[主菜单](../verification/m2-desktop-menu.png)、[衣帽间](../verification/m2-desktop-armory.png)、[商店](../verification/m2-desktop-shop.png)、[扭蛋](../verification/m2-desktop-lottery.png)、[战斗](../verification/m2-desktop-battle.png)。
- 窄屏：[主菜单](../verification/m2-mobile-menu.png)、[衣帽间](../verification/m2-mobile-armory.png)、[商店](../verification/m2-mobile-shop.png)、[扭蛋](../verification/m2-mobile-lottery.png)、[配装](../verification/m2-mobile-loadout.png)、[战斗](../verification/m2-mobile-battle.png)。

## 隔离、备份与启动

对开发前记录的 **2096** 个原基线及设计文件重新计算SHA256，**全部未变**。根仓库tracked diff为空，status仍仅为原有的 `?? design/`、`?? games/`；没有更改根Git历史。所有新文件及修改均在本游戏目录。[隔离结果](../verification/m2-isolation.json)

已调优M1源码快照为 [m1-balance-v2-before-m2.zip](../backups/m1-balance-v2-before-m2.zip)，119,737字节。快照不含依赖或浏览器存档，回退步骤见本目录README。

现在打开 **http://127.0.0.1:4175/** 即可试玩；已有旧页面可用Ctrl+F5刷新。后续双击 `Start-Capybara.cmd` 启动/构建，双击 `Stop-Capybara.cmd` 停止。主菜单进入衣帽间和黑市；后院测试台可一键全满，配装后开局。
