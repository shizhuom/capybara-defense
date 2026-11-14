# M3 存档身份切换隔离修复

状态：已修复，产品源码已冻结。后续收尾：独立定点整体复审已关闭F1；主代理已再次确认最终427/427、typecheck与生产10组，详见M3-final-review.md和M3-verification.md。仅修改 `src/ui/GameApp.ts` 的测试档启用/恢复分支；未更改 BattleEngine、奖励规则、storage 或版本号。

## 根因与最小修复

`test-enable` / `test-restore` 原先保存并替换当前 profile 后，仍保留之前的 engine。BattleEngine 的段位、装备和合成记录属于旧身份快照，但即时图鉴与 finish 使用当前 profile，因而可跨普通/测试身份写入。

现先记录切换前的测试身份，调用既有存储事务并检查结果。失败立即提示现有 `hint.storage`，不采纳返回 profile，也不重置对局、选择、地图覆盖或备份。成功后才更新 profile 与界面；若前后测试身份不同，沿用 `menu()` 清理旧 engine、弹窗返回栈及选择状态，不执行投降或结算。相同身份的重复 enable 和无备份 restore 保留当前对局。

本轮 before 文件：`.runtime/m3-profile-switch-before/GameApp.ts`。收到保存 before 的补充要求时源码已修改，因此按本轮唯一改变的分支反向重建 before；没有回写或改动当前源码。独立复审可直接比较该文件与 `src/ui/GameApp.ts`，新增浏览器脚本可完整审查。

## RED：先验证当前生产版

执行 `node scripts/m3-profile-switch-qa.mjs --label=red`，退出 1。脚本通过独立 Chrome context 实际点击生产版 UI，并断言 `window.__CAPY_DEBUG__` 不存在。

- 测试档中真实 grant 熊猫与斗笠、点击合成后，playing 时点击恢复。普通档立即恢复、备份删除，但未返回菜单；随后真实投降将普通档 `matches:0→1`，写入 `mergedHeroes:['kungfu_po']` 及 `kungfu_panda` 头像。金币仍 123、星数仍 0，因为这次复现通过投降结算，不冒充已测试胜利金币污染。
- 普通 playing 中 enable 同样未返回菜单，保留旧局。
- 普通档无备份 restore 原有保留对局行为通过。
- 注入 profile.setItem 失败后，旧实现保留测试局、备份和当前档的断言通过；该组合用例最终失败在解除故障后成功恢复仍不回菜单。

原始证据保留：[RED JSON](../verification/m3-profile-switch-qa-red.json)。

## GREEN：修复后生产版

按本轮授权依次运行本工程 `Stop-Capybara.cmd`、`Start-Capybara.cmd`，重新构建并启动同一 4175 生产服务。未启用开发服务、其他端口或其他工程服务。

`node scripts/m3-profile-switch-qa.mjs --label=green`：**4/4 通过，退出 0，console error 0、pageerror 0**。最后增加失败分支的内存界面佐证（段位下拉及钱包不变）后又运行一次，结果仍全绿。

| 定点用例 | 验证结果 |
| --- | --- |
| 测试 playing 中 restore | 立即回菜单，存档深度等于原 backup；等待 500ms 多帧后不变；新普通局没有测试单位，开局仍不改档；普通投降仅增加本普通局场次，金币、星数、图鉴、头像保持原值；重载保持。 |
| 普通 playing 中 enable | 成功后回菜单，原普通档备份场次仍 0；等待多帧无旧局结算。重新测试开局后重复 enable 保持同一窝单位、活动战斗与原备份。 |
| 无 backup 普通 restore | 当前普通战斗和窝中单位保留；之后一次普通投降仅结算一场，无额外图鉴或奖励。 |
| profile.setItem 故障注入 | restore 提示保存错误，保留活动测试局、窝中单位、可用召唤按钮、原备份、当前持久档、段位与钱包界面；解除故障后重试成功回菜单，并精确恢复 backup。 |

结果：[GREEN JSON](../verification/m3-profile-switch-qa-green.json)、[最新 JSON](../verification/m3-profile-switch-qa.json)。

## 相关检查与运行状态

- `npm run typecheck`：退出 0。
- `npm test -- --run tests/ui.test.ts tests/m2-meta.test.ts tests/m3-progression.test.ts`：3 文件、**132/132 通过**。未重复 427 项全套。
- `Start-Capybara.cmd` 内的 TypeScript + Vite 生产构建通过，45 模块；当前 JS 为 `index-CNxro7de.js`。
- 最后生产健康检查返回 `{"app":"capybara-defense","pid":35176}`，4175 保持运行。没有操作 Git、设计目录或工程外文件。

验证限制：本次 focused 生产回归直接覆盖真实身份切换、真实英雄合成、延迟帧与投降结算；没有重新跑全部 M1/M2/M3 浏览器、427 单测或自然完整波次获胜。成功跨身份后不再持有旧 engine，是所有旧局后续结算与即时图鉴路径被截断的依据；自然胜利及其他游戏功能沿用既有验收，最终整体复审由主代理另行完成。
