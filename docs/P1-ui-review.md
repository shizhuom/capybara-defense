# P1 Root UI 审查

范围：以 `P1-task-ui.md`、`P1-ui-report.md`、`P1-ui-review-diff.txt` 为改动依据，对照只读权威规范 `D:/rea_game/design/codex_p1_polish_spec.md` 与 `P1-contracts.md`。仅定点阅读相关实现及直接调用方；未修改实现、未重跑已通过的套件或浏览器。参考已提供的 P1 8 groups / 0 errors 与完整 M3 浏览器回归结果，并查看 `verification/p1-mobile-boss.png` 核对布局疑点。

## 规范符合结论

**通过本轮 Root UI 审查：原两项百科缺漏均已修复。** Round 1 复核仅阅读 `P1-ui-fix1-diff.txt` 与 `P1-ui-fix-report.md`，未重审全 UI 或重跑测试、浏览器。

1. **ADDRESSED — 原 [P2] 神兵百科没有当前解锁状态，`src/ui/Compendium.ts:30`。** 武器卡现按 `profile.unlockedWeapons.includes(weapon.id)` 显示本账号的已解锁 / 未解锁状态，新增中英文本且保留碎片条件。新增测试覆盖两语言、36 张卡片及全锁定 / 单项解锁 / 全解锁三个档案状态；符合规范 §5.2 第 3 项。
2. **ADDRESSED — 原 [P2] Boss 百科遗漏护甲特征，`src/ui/Compendium.ts:29`、`src/i18n/p1.ts:13`。** 属性行现从配置生成 `Math.round(ENEMIES[id].armor*100)`，双语文本呈现百分比，并保留生命和技能间隔。新增测试逐一核对两语言下全部 12 位 Boss；符合规范 §5.2 第 2 项。

其余重点符合：clean 模式按 `aspect-ratio:640/1386` 缩放并限制视口高度，移动端关闭页面滚动与棋盘 touch 滚动；开发开关保存成功后才采用，query 仅 `dev=1` 启用，显式关闭会删除 query；Boss 选择最靠近终点的存活己方 Boss，数量、真实生命及技能冷却同步；对手横幅使用引擎身份；四分页总数及双语键覆盖完整，英雄金边依据已合成记录。

## 代码质量结论

**通过本轮代码质量审查：引导动作判定已修复，修复范围内未发现新的重要问题。**

3. **ADDRESSED — 原 [P2] 移动到空宠物窝也会通过“上棋盘”引导，`src/ui/GameApp.ts:596`。** 现仅在命令成功、返回 ID 对应单位属于玩家且位置为 `board` 时推进 deploy。新增测试使用真实 `BattleEngine.move` 和 `GameApp.apply`，验证窝内合并和空窝移动不推进、非法落子不推进、真实上棋盘推进；另覆盖失败 / 成功铲地。补丁保持原有保存、奖励和身份事务逻辑不变。

完成、跳过、重看均先保存候选档再替换内存档；保存失败保留当前步骤供重试；已领取标志在 replay 中保留。普通 / 测试身份事务成功后才清空 engine 与教程，失败不会丢弃原对局。assets-ready 只设置 dirty，并在 canvas / prop 拖拽结束后统一刷新；百科 / 市场渲染不重建抽奖状态或重新执行交易。HTML 单位、道具、头像、神兵与封面使用统一素材助手。

## 已关闭的并行修复

已定点复核根代理最新的 `src/ui/BattleHUD.ts:5` 与 `src/ui/GameApp.ts:192`：`getMusicMode` 在无战斗、浏览弹窗、暂停和结算时选择 menu，活跃战斗才按存活 Boss 选择 boss / battle；GameApp 传入真实 dialog 状态，并保留现有 duck、visibility、pagehide / pageshow 生命周期及命令 / 事件音效归属。此项关闭。根代理报告对应 10 项 UI 测试通过，审查未重跑。

## Round 1 验证与范围边界

修复报告提供先红后绿证据：原三项针对性测试先失败，修复后通过；开发面板中文另经失败测试后改为规范要求的“开发者沙盒面板”。最终报告为 UI 17/17、完整套件 571/571、typecheck 退出 0。审查核对了测试 diff 的实际断言，未自行重跑。

本次 scoped re-review 无 NOT ADDRESSED 项，无新增重要问题。根代理另行调整的 TutorialView 聚光灯和气泡定位不在本轮 diff 内，由后续交叉审查覆盖；本报告不将该部分视为已复核。
