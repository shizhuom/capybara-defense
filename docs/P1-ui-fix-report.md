# P1 UI review Round 1 修复报告

## 范围与修改

仅修复 `P1-ui-review.md` 的三项问题，另按根代理复核最新规范的指示校正同一 i18n 文件内的开发面板中文。

1. `src/ui/Compendium.ts:30`：36 张武器卡分别读取 `profile.unlockedWeapons`，显示“已解锁 / 未解锁”或“Unlocked / Locked”，保留各稀有度原有碎片解锁条件、伤害、说明与觉醒提示。
2. `src/ui/Compendium.ts:29`、`src/i18n/p1.ts:13`：12 位 Boss 的属性行从 `ENEMIES[id].armor` 生成百分比，同时显示中英护甲标签；原生命与技能间隔继续显示。
3. `src/ui/GameApp.ts:596`：成功的 `hint.deployed` 必须能找到返回 `unitId` 对应、属于玩家且当前位置为 `board` 的单位，才推进 deploy 引导。空 bench 移动不推进；失败命令不推进；成功铲地继续推进。
4. `src/i18n/p1.ts:2`：`p1.developer` 中文精确改为“开发者沙盒面板”，英文保留“Developer Sandbox”。

`BattleHUD.ts` 与现有 `getMusicMode` 修复未改。未修改核心/音频/素材领域、design、服务器、git 或其他测试文件。

## 先红测后修复

- 修改实现前已将 `src/ui/Compendium.ts`、`src/ui/GameApp.ts`、`src/i18n/p1.ts`、`tests/p1-ui.test.ts` 原件逐一复制到 `.runtime/p1-ui-before-fix/` 对应相对路径。
- 先新增武器状态、Boss 护甲、真实命令引导测试，再运行 `npm test -- tests/p1-ui.test.ts`：16 项中 5 项失败、11 项通过。失败对应双语武器状态 2 项、双语 Boss 护甲 2 项、空 bench 移动引导 1 项；符合报告中的实际缺陷，原有 10 项全部通过。
- 三项实现修复后，同命令 16/16 通过。
- 接到面板文案校正后，先新增双语精确值测试并运行 `npm test -- tests/p1-ui.test.ts -t 'specified developer sandbox label'`：1 项失败，收到旧值“后院测试台”；再修改文案。

## 新增测试与最终验证

`tests/p1-ui.test.ts` 保留原有 10 项，新增 7 项，共 17 项：

- 两语言逐一卡片核对全部 36 武器，覆盖全锁定、单项解锁、全部解锁三种 profile，且始终保留碎片门槛。
- 两语言逐一卡片核对全部 12 Boss 的配置护甲百分比。
- 真实 `BattleEngine.move` 加真实 `GameApp.apply` / `progressTutorial`：窝内合并、移动到新空窝都停在 step 2；非法上棋盘失败仍为 step 2；成功上棋盘才到 step 3。测试仅替代 DOM 刷新、通知和声音副作用。
- 真实 `BattleEngine.dig`：铁锹不足不推进，实际挖地成功才到 step 3。
- 中英开发面板标签精确值。

最终命令均退出 0：

- `npm test -- tests/p1-ui.test.ts`：1 文件、17/17 通过。
- `npm run typecheck`：`tsc --noEmit` 通过。
- `npm test`：24 文件、571/571 通过。该完整运行出现 Vite 关于 `scripts/audio-manifest` 无扩展名导入的 native configLoader 前瞻警告；未将其扩展为本轮修复。

相对修改前副本，生产实现差异仅为 `Compendium.ts` 替换 2 行、`GameApp.ts` 替换 1 行、`i18n/p1.ts` 替换 2 行并增加 1 行。旧测试主体未删除或改写。

本轮未运行浏览器，移动端视觉与完整交互验收交由根代理后续集成。上述四个实现/测试文件及本报告完成后冻结。
