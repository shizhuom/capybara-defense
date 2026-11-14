# M3 核心独立审查

审查日期：2026-11-13。范围：实施计划 Task 2 与明确的跨核心集成；只读产品代码、测试和差异，唯一写入本报告。未修改测试、服务、Git 或设计文件，未派生代理。

## 两项结论

- **规范符合性：通过（限定本次核心范围）。** 四地图、六新首领、主题轮换、开局段位数值与英雄合成记录符合唯一 M3 规范及已确定裁定。未发现必须修复的规范偏差。
- **代码质量：通过。** 新机制集中于 BossMechanics，沿用统一伤害、EMP、地图与结算入口；未发现可复现的核心正确性或跨模块集成缺陷。

问题分级：**Critical 0 / Important 0 / Minor 0**。没有需要附复现步骤的已确认缺陷。此结论不替代 presentation/UI 的独立审查或最终实机验收。

## 审查依据与覆盖

已完整阅读 `D:/rea_game/design/codex_m3_spec.md`，随后阅读 `docs/M3-implementation-plan.md`（含 Task 2 与实施裁定）、`docs/M3-contracts.md`、`docs/M3-core-report.md`。使用 `verification/m3-review-core.diff` 审查相对 M2 ZIP 的变化，并核对当前源文件及两个新增核心测试文件。

| 核对项 | 实现位置 | 结论 |
| --- | --- | --- |
| 四张精确矩阵、各半区六格 O、16 点正交路径和 180°旋转 | `src/config/maps.ts:7`，`src/config/maps.ts:12` | 包括樱花 row 3 的最终修正、厨房半岛、迷宫竖井；后院兼容别名保留。 |
| 独立棋盘、行进、击退、AI选址、洒水车与终点巨橘 | `src/core/GridSystem.ts:4`，`src/core/BattleEngine.ts:127`、`:216`、`:341`，`src/core/OpponentAI.ts:13`，`src/core/PropSystem.ts:86`、`:113` | 当前实例的 mapId 贯穿路径消费者；配置路径仅被读取，棋盘逐行克隆。 |
| 策反目标与召唤 | `src/core/BossMechanics.ts:10`、`:18` | 仅同半场棋盘基础宠；低等级/id稳定优先；一级蜂可选；无合格目标不生成迷弟。 |
| 两种控制及合成/升级解除 | `src/core/BossMechanics.ts:22`，`src/core/BattleEngine.ts:179`，`src/core/MergeSystem.ts:26`，`src/core/PropSystem.ts:137` | 半径 2/2.2、最多两目标、9/6.5秒；停火与既有升级清状态路径接通。 |
| 蜂后、垃圾浣熊、DJ | `src/core/BossMechanics.ts:30` | 精确召唤偏移，骨鼠按当前波次×1.3，进度夹到0..15；同半场活怪治疗上限与非叠乘加速正确。 |
| EMP、死亡、召唤物终点与掉落 | `src/core/BattleEngine.ts:199`、`:213`、`:218`、`:264`、`:342`，`src/core/PropSystem.ts:120` | 统一45%入口；致死反噬返回；死怪不继续技能/行进；召唤物使用普通怪扣命与击杀流程。 |
| 4/6/8/9/10波主题/高段混编 | `src/config/waves.ts:17`，`src/core/BattleEngine.ts:234` | 四图合计覆盖全部12首领；rank≥40使用种子随机，一次选择供双方使用。普通波次参数未变化。 |
| 开局HP/金币/紫橙权重 | `src/core/BattleEngine.ts:29`、`:48`、`:126`、`:266`、`:377`，`src/config/weapons.ts:73` | 统一读取开局state.rankIndex；Boss掉落与金铲均使用统一入口；胜利基础币加原口粮奖励。 |
| 英雄合成图鉴与结算 | `src/core/BattleEngine.ts:96`、`:377`，`src/ui/GameApp.ts:171`，`src/ui/storage.ts:46` | 成功合成到英雄时独立去重记录；单位后续消失不删除记录；即时更新与含败局结算再次合并均幂等。 |

对 UI/storage 的读取仅用于验证实例初始化、合成记录传递和结算收据，不扩展为界面审查。`GameApp.ts:141` 以 profile 解出地图/段位后创建引擎；测试台修改 profile 的路径不改本局 state。

## 验证证据与限制

遵照任务要求没有重跑全套，也没有重写现有测试。33项新增核心测试的 RED→GREEN 与原251项回归结果采用主任务已有执行证据；`M3-core-report.md` 记录中途全量414/421通过、余7项属于尚未完成的presentation。不能由本报告推断整个M3已最终全绿。差异包的选择性基线目录不包含完整旧测试集，因此本次未独立声称已逐文件验证全部251项旧测试字节不变。

另外使用 Node + TypeScript 内存转译执行了以下定点探针（无写入、无服务、无存档文件）：

1. 四图分别以rank53生成蜂后，进度12.9施法：三只蜂均为100.8 HP（36×2.8）；下一仿真步巨橘清除三只蜂，玩家橘子保持3，巨橘事件坐标分别等于当前地图progress14。
2. rank50厨房引擎创建后，把原options改成rank0后院：引擎仍为rank50厨房；普通鼠HP60；固定随机数0.7仍抽出紫色碎片；17口粮胜利得到177金币。
3. 实际合成功夫阿宝后清空单位再投降：结算仍保存`kungfu_po`、解锁`kungfu_panda`；同一battleId再次结算返回`awarded:false`。

最终探针退出码0且所有断言通过。探针初稿曾误比较两个不同函数对象而失败；删除该无关断言后重新运行通过，此失败不是产品缺陷。

残余验收工作由主任务继续：presentation最终全绿、全量typecheck/build、浏览器闭环及隔离哈希核验。
