# P1 core 审查

审查范围：`P1-task-core.md`、`P1-contracts.md`、`P1-core-report.md` 及指定 `P1-core-review-diff.txt`；需求依据为只读的 `design/codex_p1_polish_spec.md` 第 2、3、5.1 节和 root 最新裁定。以指定 diff 为变更依据，仅针对合成目标、状态清除和合法指令的疑点查看相关调用方；未修改实现或测试，未重跑已有全套测试。

## 规范符合结论

**通过。未发现重要规范偏差。**

- 五档段位边界、决策间隔、开局延迟和配装数量符合约定；武器去重且匹配英雄流派，最高档使用对应专属武器；被动池排除了互惠道具，主动道具通过原有校验与冷却路径使用。见 `src/config/opponents.ts:2`、`src/core/OpponentAI.ts:28`、`:70`。
- 对手 setup 使用独立 seeded RNG；`ai:false` 不注入生成配装，显式 `loadouts.ai` 优先，tuning 覆盖和每引擎独立 AI 状态保留。见 `src/core/BattleEngine.ts:27`。
- SEALED 的首次观察时间和反应门槛同时约束奶瓶、洒水器及 feeding；奶瓶按英雄优先、等级和伤害选择最强合法受控目标。开局延迟约束普通动作，进度达到 13 的终点紧急洒水按最新裁定保留 M2 行为。见 `src/core/OpponentAI.ts:62`。
- 洒水器只清除同侧 SEALED，保留其余状态及原有 120 伤害、4.5 格击退、2 秒减速和一次使用限制；purge 带 `sprinkler` effect。见 `src/core/PropSystem.ts:84`。
- MergeTargets 只返回同侧真实单位的成功合成结果，复用 MergeSystem，排除 washing、swap、自身、锁定和满级结果；支持十二配方及双向 feeding，未修改输入。实际移动调用在合成前校验位置，正常游戏状态下未发现提示目标与执行目标不一致。见 `src/core/MergeTargets.ts:5`、`src/core/MergeSystem.ts:7`、`src/core/BattleEngine.ts:85`。
- 新档教程及 developerMode 默认值、旧档迁移、显式 replay false、测试档 done/claimed、正常档备份行为均保留。skip 保留 claim=false；存档后首次 replay 完成可领 20，后续完成不重复领取。见 `src/core/MetaProgression.ts:26`、`:167`、`src/core/Tutorial.ts:7`、`:15`。
- 本次 core 变更未涉及服务生命周期、端口或存档前缀；保留 M1/M2/M3 指令路径。最终跨模块构建、UI、音频及浏览器验收由 root 负责。

## 代码质量结论

**通过。未发现需要修复后才能集成的问题。**

setup、策略、合成查询和教程职责清楚；新行为复用合法指令、MergeSystem 与既有存档 API，没有绕过资源或道具限制。状态为实例级数据，查询和教程候选更新保持输入不变。现有项目的紧凑代码风格延续，未形成重要可维护性风险。

## 核验依据

- 静态核对上述实现、相关 `GridSystem.canPlace`、合成/道具调用方及 `tests/p1-core.test.ts` 覆盖。既有 targeted/full suite 结果采用 core report 记录，不重复运行。
- 本次另以 Vite `ssrLoadModule` 执行不落盘的定向断言，退出成功：Rank 0/6/15/35/50 实际 SEALED 解封均不早于反应及开局门槛，之后成功；Rank 0 在开局 0.05 秒的进度 13 紧急洒水保留；skip 后 matches=1、JSON 存取归一化仍保留未领取，首次 replay +20，再次 replay +0。

## 重要问题

无。未发现可提供文件/行号及复现原因的阻断或高优先级问题。
