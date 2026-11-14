# M3 段位、成就与存档交付记录

日期：2026-11-13。任务范围：`docs/M3-task-progression.md`。产品文件只写本任务拥有的文件，没有修改 types、地图、战斗、绘制、GameApp 或翻译，也未启停服务、派生代理或提交 Git。

## 文件与行为

| 文件 | 结果 |
| --- | --- |
| `src/config/ranks.ts` | 54 段位；0..49 每2星升级，50..53为100/125/150/180星；各大段HP均匀插值保留4位小数；完整金币、碎片倍率、双语名称和默认地图。40..53按四图依次轮换。 |
| `src/config/avatars.ts` | 按固定顺序提供16个双语头像定义、公开解锁说明和初始4头像。 |
| `src/core/PlayerProgression.ts` | 纯函数实现成就、图鉴、设置、选图/头像、测试台段位、永久地图解锁、星数/连胜和15 NPC+玩家排行榜。 |
| `src/core/MetaProgression.ts` | Profile默认、M1/M2幂等迁移、设置校验、交易与碎片解锁后立即评价成就、全满档和深拷贝新增字段。 |
| `src/ui/storage.ts` | 在既有奖励/收据事务内追加星数、连胜和合成图鉴结算，继续使用M2完整普通档备份/恢复及失败保护。 |
| `tests/m3-progression.test.ts` | 103项回归；覆盖54升段门槛、HP/奖励、迁移、设置、19/20/21/22星失败保护、3/5连胜、真实降段保图、全部头像条件及其下沿、即时交易成就、幂等图鉴、榜单、单次结算及备份故障注入。 |
| `tests/ui.test.ts` | 只对原精确存档预期追加 stars、highestStars 和首胜头像，无削弱原断言。 |

迁移保留 `schemaVersion:2` 和原存档键。缺少 `stars` 时使用经过原 wins/matches 校验的胜场数；显式0不变，非法星数归0。最高星数不低于当前星数，最佳连胜不低于当前连胜。设置音量0合法，有限越界数夹至0..1，NaN/Infinity/非数值使用默认；伤害数字开关仅接受布尔值。历史已获合法头像不会撤销。

获胜第1/2场分别+1，第3场及后每场+2；失败归零当前连胜，rank<10不减星，rank>=10减1且最低20星。进度函数不增金币、胜场、场次；storage仅调用一次，旧金币由既有 `result.coins` 路径结算。highestStars驱动地图与段位成就历史保留；手动选择已解锁地图不受降段影响。

全满保留设置，当前星至少180、最高星不低于当前星，全部16头像、12英雄图鉴、36武器、20道具齐全。再次开启不会覆盖普通档备份；备份失败不进入测试档；主档写入失败撤销本次新备份；恢复写入失败保留旧备份待重试。

## 验证

先写90项初始回归，首次 `npm test -- tests/m3-progression.test.ts` 观察 **87失败、3通过**：缺失ranks/avatars/PlayerProgression及新增迁移/结算行为按预期失败。随后实现并补13项成就下沿与真实降段回归。

最终定点命令：

```text
npm test -- tests/m3-progression.test.ts tests/m2-meta.test.ts tests/ui.test.ts
3 files passed; 132 tests passed; exit 0
```

最终全套命令（13:24:56 本机输出时间；其他任务仍在并行实现）：

```text
npm test
17 files: 15 passed / 2 failed
402 tests: 373 passed / 29 failed; exit 1
```

原M1/M2测试和本任务103项全部通过。29项失败逐项归属于尚未完成的presentation工作，没有修改其文件：

- `m3-render.test.ts`：`gives every avatar and weapon a distinct geometry, with no scripts, links, emoji or text placeholders`；`normalizes unsafe ids and invalid sizes into a safe usable fallback`。
- `m3-render.test.ts`：`draws sakura_onsen palette and follows its own route`；同名 `midnight_kitchen`；同名 `cat_tower_maze`。
- `m3-render.test.ts`：`hides only damage text, retaining projectile and skill geometry`；`renders confusion as a spiral rather than another knockdown star ring`。
- `m3-render.test.ts`：`draws a recognizable diva_kitty silhouette and captured skill targets`；同名 `buff_roo`；同名 `hornet_queen`；同名 `screaming_marmot`；同名 `trash_coon`；同名 `dj_rat_king`。
- `m3-render.test.ts`：`gives killer bees, charmed rats and bone shields visible identifying marks`。测试在第69行调用spawnEnemy时缺少side参数，触发路径读取undefined。
- `m3-sound.test.ts`：`captures constructor and resume failures without starting music or leaking contexts`；`creates no context before unlock, starts one pentatonic loop, and releases it`；`applies volume zero immediately and softly ducks only music`。
- `m3-sound.test.ts`：`synthesizes summon with finite frequencies, audible envelope and bounded stop`，以及同名cue `dig`、`upgrade`、`legendary`、`goose`、`orange`、`sprinkler`、`lottery_tick`、`lottery_win`、`victory`、`defeat`（共11项）。
- `m3-sound.test.ts`：`consumes actual battle event identities once and leaves command-owned cues to UI`。

最终类型检查：

```text
npm run typecheck
tests/m3-render.test.ts(69,70): error TS2554: Expected 2-3 arguments, but got 1.
exit 1
```

进度所有文件及测试无类型错误。较早一次类型检查出现的GameApp.persistProfile两处错误，已由UI所有者在最终运行前消除。

## 接口与后续

本模块按 `docs/M3-contracts.md` 完成，未要求更改固定接口。主代理已确认HP保留4位小数和40+段位四图确定轮换。额外只导出 `AvatarDefinition`、`DEFAULT_AVATARS` 供配置复用；不引入DOM、声音或存储依赖至纯进度层。

主代理完成其他模块后需再跑全套、typecheck与生产构建，以最终集成结果覆盖上面的阶段性失败记录。当前唯一具体接口错误是presentation测试缺少 `spawnEnemy(kind, side)` 的side实参，已通知主代理。
