# M2 配置、养成与存档实现记录

## 实现

- `src/config/weapons.ts`：最终 36 把神兵，三系各 12 把且品质为 2/2/2/2/4；12 位英雄各有唯一橙色专属。导出 `WEAPONS`、`HERO_FAMILIES`、`RARITY_RULES`、`rollWeapon` 及约定类型。配置含完整中英文名与真实数值词条，统一基础伤害加成不重复叠加。
- `src/config/props.ts`：8 主动、12 被动，价格、品质、冷却、目标与等级上限依 M2 规范。所有名称、机制说明双语齐全。
- `src/core/MetaProgression.ts`：实现计划约定的全部纯函数。装备限制、同武器自动转移、阈值解锁、仅溢出回收、道具购买升级、2/6 槽位校验、按日期商店、20 金币刷新和券优先的 80 金币扭蛋均无输入对象写入。
- `src/ui/storage.ts`：保留原存档键和原 API；`emptyProfile()` 扩展为完整 M2 默认值；载入时校验与迁移。`awardBattle` 增加 `newWeapons`，胜利加 1 张券，真实神兵战利品由通吃后的 `result.loot` 一次授予；奖励与 battle receipt 仍在同一 Profile 内。
- 开发测试档：先保存完整普通档备份，再写全满档；重复开启不覆盖备份。恢复成功保存普通档后删除备份。
- `tests/ui.test.ts` 仅扩展完整对象预期的默认字段与迁移结果，保留原先八项回归语义。

## 接口与裁定

- 所有约定签名不变。额外导出 `storage.isTestProfile(storage?): boolean`，供 UI 识别测试状态；备份 setting 名为 `normalProfileBackup`，完整 key 为 `capybara_defense_v1:normalProfileBackup`。
- 旧占位碎片只在 `schemaVersion !== 2` 时折算至 `m01_swatter`，每项 1 片，原 `fragments` 历史仍保留。原有效金币、场次、胜场、奖励收据不丢失；原先对非法数字与胜场超过场次的防护继续保留。
- 解锁不消耗累计碎片，回收后至少保留品质阈值。无溢出时返回失败且不扣资源。
- 商店同一天不随机重置；新日期和付费刷新仅从未满级道具抽取不重复货品，不足三件则展示余量。购买到满级后仅替换该货位，按配置顺序补入未满级且未展示的商品，其他货位与日期保持；没有额外未满级商品时移除售罄货位。徽章未满级可继续购买升级。
- 九宫格为 3 个不重复道具、40/80/160 金币袋、1 紫碎片、1 橙碎片；完整道具可抽中并按原价补偿。`spinLottery` 在返回时已一次性完成所有扣款与奖励，UI 持久化后才播放动画。
- `MetaResult.key`：`meta.equipped`、`meta.unequipped`、`meta.invalidWeapon`、`meta.invalidHero`、`meta.weaponLocked`、`meta.wrongFamily`、`meta.recycled`、`meta.noFragments`、`meta.invalidProp`、`meta.propNotOwned`、`meta.slotsFull`、`meta.invalidSlots`、`meta.shopRefreshed`、`meta.insufficientCoins`、`meta.shopEmpty`、`meta.propMaxLevel`、`meta.propNotOffered`、`meta.purchased`、`meta.lotteryWon`、`meta.invalidPrizes`。
- `amount` 表示购买/刷新金币变化（负数）或回收金币（正数）；扭蛋由 `prize`/`index` 表达锁定结果。

## 验证输出

TDD RED：先运行配置测试，2 项均因目录未实现产生断言失败；后运行养成/存档测试，10 项因养成模块未实现产生断言失败。配置先完成后 2 项转绿；纯养成完成后 9/12 通过，剩余 3 项明确指出旧存储未扩展；存储完成后全绿。

2026-11-12 项目独立运行结果：

```text
npm test -- tests/m2-meta.test.ts tests/ui.test.ts
Test Files 2 passed (2)
Tests 22 passed (22)

npm run typecheck
tsc --noEmit
exit 0

npm test
Test Files 11 passed (11)
Tests 163 passed (163)

npm run build
tsc --noEmit && vite build
33 modules transformed
built in 85ms
exit 0
```

首次整套集成验证曾有 3 项 `m2-props.test.ts` 失败（洒水车起点、粘鼠板触发、金犬挖宝）与 renderer/UI 的类型错误，均已在其他任务完成后重跑转绿，无剩余自动化失败。

## 边界

- 此模块是纯数据交易；持久化失败须由调用 UI 保持旧内存档，不能以动画完成回调再次兑奖。UI 已采用先 `saveProfile` 成功再提交和动画的流程。
- 存储配额或禁用时不生成无法恢复的全满测试档；普通档备份写入失败返回原档。
- 仅修改本项目文件，未改 design、原版内容、Git、服务器状态。浏览器验收与战斗数值由主任务汇总。

## 2026-11-13 独立审查修复

1. `enableTestProfile` 第二次写入（全满主档）失败时，现在回滚本次新建的普通档备份，避免错误标记为测试档。已经成功开启的测试档在重复开启失败时保留原备份；恢复普通档的主档写入失败也继续保留备份，允许之后重试。
2. 商店购买满级道具后只补售罄货位，不免费重洗整架。可升级徽章的前两次购买继续保留徽章；其余未满级道具不足时允许少于三件。

新增四项回归测试，故障注入仅拒绝 9999 金币的主档写入、允许备份写入。RED 实测复现普通档赢得 120 金币后被恢复为旧 298 金币/0 胜，以及购买后货架仅剩两件；另验证已激活档恢复失败仍保留原备份和售罄库存不足情形。

修复后的验证：

```text
npm test -- tests/m2-meta.test.ts tests/ui.test.ts
Test Files 2 passed (2)
Tests 26 passed (26)

npm test
Test Files 12 passed (12)
Tests 242 passed (242)

npm run typecheck
tsc --noEmit
exit 0
```

本次仅写入 storage、MetaProgression、m2-meta 测试与本报告，未修改 UI/战斗/渲染或运行构建。
