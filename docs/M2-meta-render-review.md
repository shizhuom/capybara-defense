# M2 局外配置、交易、存档与 Canvas 演出只读审查

审查及修复复核日期：2026-11-13。范围为已完成模块；未审查或运行 `BattleEngine.ts`，首次审查未审查 `WeaponSystem.ts`，修复复核仅检查其调用新共享射程/充能函数的位置。未修改源码、测试或服务状态；本报告为唯一写入产物。

已完整阅读原始 `D:/rea_game/design/codex_m2_spec.md`、`docs/M2-implementation-plan.md`（含契约与裁定）、`docs/M2-meta-report.md`、`docs/M2-render-report.md`。核对了配置、`MetaProgression.ts`、`storage.ts`、`M2Effects.ts`、`StickerRenderer.ts`，以及 `m2-meta`、`ui`、`m2-render`、`render` 测试。额外只读核对了 UI 的持久化调用边界。使用项目 `backups/m1-balance-v2-before-m2.zip` 的流式读取比较旧代码，未解压或写入备份。

## 发现

最终状态：未关闭 Critical 0 项、Important 0 项。Important 1、2、3 均已完成定点修复复核。下列问题描述保留发现时的证据和旧行号，当前修复证据见“修复复核”及 Important 3 末尾的关闭记录。

### Important 1（已关闭）：全满档第二次写入失败会留下错误测试态，后续恢复可丢失普通档新增进度

- 位置：`src/ui/storage.ts:72`、`:74`；状态判断 `:65`；恢复覆盖 `:85`。
- `enableTestProfile` 先持久化普通档备份，再保存体积更大的全满档。若备份成功、全满档保存失败，函数返回原普通档，但没有撤销新建备份，也没有区分“备份已准备”和“测试档已激活”。`isTestProfile` 仅以备份键存在作为依据，错误地返回 `true`。
- 可复现条件：存储空间允许较小普通档备份，但不允许包含全部物品的全满档写入；这与“所有写入都失败”的现有测试不同。玩家仍使用返回的普通档继续游玩，后续“恢复普通存档”会把这些新增金币、胜场、碎片及收据覆盖为首次失败之前的快照。再次尝试开启全满档也不会更新旧备份。
- 独立复现：在 Node 中用项目 TypeScript 编译器将原始模块转译到内存，使用 `Map` 实现 `Storage`，仅让写入 `:profile` 且内容为全满档的 `setItem` 抛出 quota 错误；没有生成文件，也没有重跑已有测试。依次保存 298 金币普通档、调用 `enableTestProfile`、保存继续游玩的 418 金币/1 胜普通档、调用 `restoreNormalProfile`，得到：

```text
{"stage":"activation_failed","coins":298,"isTest":true}
{"stage":"ordinary_progress_saved","coins":418,"wins":1}
{"stage":"restore","coins":298,"wins":0,"isTest":false}
```

- 规格影响：违反普通档保护和“不丢金币/胜场”的要求。现有 `tests/m2-meta.test.ts` 仅覆盖正常恢复和“备份第一写失败”，没有覆盖这个第二写失败分支。
- 修复方向：失败时安全撤销本次新建的备份状态，或明确区分待激活备份与已激活测试档；不得删除此前有效测试档的普通备份。补充第二写失败后继续普通进度再恢复的回归案例。

### Important 2（已关闭）：装备增加射程后，棋盘选中射程圈仍绘制基础射程

- 位置：`src/render/StickerRenderer.ts:306`、`:308`。
- 选中单位射程圈直接读取 `(HEROES[selected.kind] || UNITS[selected.kind]).range`，没有读取装备/被动增益或契约中的有效战斗属性。`src/config/weapons.ts` 的 `r11_sniper_laser` 明确增加 35% 射程；同类问题适用于其他加射程武器和猫爬架。玩家按圈放置英雄时得到错误的攻击覆盖提示。
- 独立复现：直接调用实际 `StickerRenderer` 的 `drawInteractionUnderlay`，使用只记录 Canvas 调用的 context 与手工构造的 1 级 `doge_wick` 状态。只切换 `state.sides.player.loadout.equippedWeapons` 中的激光武器，观察实际 `arc` 半径。为加载此纯绘制方法，仅替代未调用的 `AssetRegistry` 依赖；未加载、调用或审查战斗引擎。

```text
{"equipment":false,"rangeCircleRadius":230.4,"expectedRadius":230.4}
{"equipment":true,"rangeCircleRadius":230.4,"expectedRadius":311.04}
```

- 计算依据：`src/config/heroes.ts:10` 定义基础射程 3.2 格；`STAGE.cell` 为 72；激光武器的规范射程为 `3.2 × 1.35 = 4.32` 格，因此应显示 `311.04px`。这里的预期来自规格和配置，并非对仍在实现的引擎实际数值作断言。
- 修复方向：让 Canvas 范围圈消费与右侧属性面板一致的有效属性来源。`src/ui/GameApp.ts:304` 已通过 `getUnitStats` 读取有效属性，可复用这一边界；避免在 renderer 再维护一份武器/被动计算规则。

## 修复复核

仅检查本次存储回滚、共享属性、货架补位修改及新增测试，未扩大到浏览器验收中的 UI 或战斗效果全量审查；未运行 Vitest/typecheck/build。主任务在首次修复复核时提供“244/244、typecheck 通过、renderer 两项 RED→GREEN”，最终货架入口修复后提供“251 tests、typecheck 通过”的验证信息，本报告不把这些数字标为审查者独立执行结果。

- **Important 1 关闭。** `src/ui/storage.ts:72` 记录是否原本处于测试态，`:75` 的全满主档写失败分支仅删除本次新建备份。已激活测试档重复启用失败不删除原普通备份；恢复主档写入失败仍先返回当前档，未执行删除备份。`tests/m2-meta.test.ts:264` 覆盖第二写失败后继续普通胜利并恢复，`:283` 覆盖既有备份在重复启用/恢复主档写失败时保留，随后重试恢复成功。按原故障条件运行一次定点内存探针，返回 `test:false, coins:418, wins:1`，未再回退至 298/0。
- **Important 2 关闭。** `src/core/CombatRules.ts:11` 的 `combatRange` 统一处理猫爬架及四种射程武器，`:22` 的 `combatCharge` 统一处理等级折减和 `w04_yarn_orb`。`src/core/WeaponSystem.ts:30` 与 `src/render/StickerRenderer.ts:307` 共同调用共享公式；renderer `:237` 能量条/就绪提示使用共享充能要求，`:80`、`:389`、`:427` 向棋盘、宠物窝及拖拽单位绘制传递正确 side 的 loadout。新增 `tests/m2-render.test.ts` 直接检查 311.04px arc 和 `46 × 6/7` 能量条宽度。复用原定点 Canvas 探针，激光武器 arc 半径现为 `311.04`。
- **购买补位修复通过此范围复核。** `src/core/MetaProgression.ts:125` 调用共享补位函数，只替换刚满级货位，排除现有货架及满级道具，不额外扣款或重洗另外两件。徽章 1/2 级保持货位，第 3 级替换；剩余未满级道具不足时允许货架缩短。新增测试覆盖保留货架位置/日期、徽章三次购买及库存耗尽。定点探针从 `washer/clay/milk_bottle` 购买 washer 后得到 `whistle/clay/milk_bottle`，金币 410。

### Important 3（已关闭）：扭蛋令货架商品满级时未使用同一补位规则

- 位置：`src/core/MetaProgression.ts:142`，同日维持缺位的位置为 `:103`。
- `buyProp` 已补上售罄货位，但 `spinLottery` 中奖道具达到满级后仍仅 `filter` 删除货架项。同一天 `ensureDailyShop` 原样返回，不会补足。只要玩家抽中货架上的普通道具或最后一级徽章，仍会出现有其他未满级道具却只显示两件商品的原问题；若要恢复三件，需付 20 刷新或等次日。
- 定点复现：500 金币、未拥有道具、货架 `['washer','clay','milk_bottle']`；用 `createLotteryPrizes(profile,()=>0)` 后 `spinLottery(profile,prizes,()=>0)` 抽中 washer。实际结果：

```text
{"case":"lotteryRestock","shop":{"day":"2026-11-13","offers":["clay","milk_bottle"]},"ownedProps":{"washer":1}}
```

- 这是同一“每次三件未满级商品”规则的另一交易入口。修复要求是让购买和扭蛋共享只补空位的规则，保留其余货位、日期、原本扣款/满级补偿行为。
- **最终复核关闭。** `src/core/MetaProgression.ts:112` 新增 `replaceCappedShopOffer`，`:125` 的购买与 `:146` 的扭蛋升级分支共同使用；函数仅处理已满级且当前在货架上的商品，按现有位置替换为另一个未满级、未在架道具，无剩余候选才删除货位。`tests/m2-meta.test.ts:208` 的参数化回归覆盖 washer 首次获得与徽章 2→3 级、券优先、输入不变、保存重载和同日不重洗；`:224` 覆盖徽章未满级不换货以及无剩余候选时允许少于三件。
- 本轮仅对本缺口运行内存断言探针，普通道具和徽章均补位，日期及另两货位不变，输入对象未修改；免费券扣一张且不扣金币，付费抽只扣 80。JSON 往返归一化后同日货架保持一致，结果为：

```text
{"case":"lotteryRestock","id":"washer","offers":["whistle","clay","milk_bottle"],"coins":500,"tickets":0,"inputUnchanged":true}
{"case":"lotteryRestock","id":"promo_badge","offers":["washer","clay","milk_bottle"],"coins":500,"tickets":0,"inputUnchanged":true}
{"case":"paidLotteryRestock","coins":420,"offers":["whistle","clay","milk_bottle"]}
```

## 已核实的行为

- M1 合法金币、场次、胜场及奖励收据的过滤规则与旧版一致；新增字段默认值完整。旧占位碎片只在 `schemaVersion !== 2` 时兑换，迁移后的再次归一化不会重复兑换。结算收据与金币、碎片、胜利券保存在同一个 Profile；已有收据直接拒绝重复授予。
- 最终配置为 36 把武器，三系各 12 把、品质 2/2/2/2/4，12 个唯一橙色专属；道具为 8 主动和 12 被动。未把废弃的早期马桶搋编号混入最终表。中英配置数值与规范及记录的补充裁定一致。
- 武器穿戴检查解锁、英雄存在和同系约束，转移时卸下旧持有者；道具槽检查所有权、类型、重复和 2/6 上限。回收只处理已解锁武器超过品质门槛的碎片，保留门槛。
- 商店从未满级道具池取不重复货品，刷新扣 20，满级购买不扣钱；升级徽章保留到 3 级。扭蛋优先免费券，否则扣 80，满级道具按原价补金币；购买或中奖令货架道具满级时共用补位规则。`MetaScreens.ts:41` 和 `:78` 确认先保存交易再提交内存/开始动画，动画结束只展示已锁定结果。
- `M2Effects.ts` 的 dash/bounce 按事件保存的 points 逐段插值，7/10 段采用同一算法；不查询存活敌人或源单位。`StickerRenderer.ts:435` 的事件分发优先调用该实现。目标消失本身不会使该绘制路径停止。
- 控制纸箱/胶带/感叹号、滴水乌云、洗衣机、陷阱及道具目标轮廓均为 Canvas 绘制；没有改变 HitTarget。与 M1 ZIP 比较：`src/config/maps.ts` 全文完全相同，`StickerRenderer.hitTest` 方法全文完全相同，棋盘、窝、铲子逻辑坐标保持原值。

## 可验证限制与结论

- 本次没有重复运行实现代理已经通过的 Vitest/typecheck/build；首次审查执行两个缺口的独立内存复现，修复后只运行对应定点内存探针及购买/扭蛋货架探针。报告中的测试覆盖判断来自源码阅读，不把实现任务的通过数字视作审查者运行结果。
- 未执行浏览器像素或移动端缩放验收；Canvas 几何与方法不改变不能单独证明 DOM 指针换算和实际手感合格。320px、中英切换和完整交易—战斗—结算闭环仍须集成验收。
- 动画消费端能在目标消失后继续绘制；事件是否由战斗端生成足够 points、保持约 1.1 秒，以及每种武器实际战斗效果，不在本次审查范围内。
- **规格结论：本次审查范围通过。** 普通档第二写失败保护、装备射程圈/充能指示以及购买/扭蛋货架补位均完成修复复核；无剩余有证据的 Critical/Important 规格缺口。
- **质量结论：三项 Important 全部关闭。** 修复有对应边界回归和独立定点探针支持，未发现本次修复引入的新问题；此结论不替代战斗全量与浏览器整体验收。
