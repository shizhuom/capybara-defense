# M3 表现与声音独立审查

审查日期：2026-11-13。基线：`verification/m3-review-presentation.diff` 对 `m2-before-m3.zip`。完整阅读只读 `D:/rea_game/design/codex_m3_spec.md`、`docs/M3-task-presentation.md`、`docs/M3-contracts.md`、`docs/M3-presentation-report.md`，并逐项追踪相关源代码与既有测试。此审查只新增本报告；未修改源代码、测试、服务或 Git，未派生代理。

## 结论

**规格覆盖：表现与声音的要求均有真实实现，未发现遗漏整项功能。** 四图主题及路径箭头、六位新 Boss 和衍生物、两种状态标记、伤害数字开关、16 个头像与 36 把武器 SVG、五声音阶音乐及 11 类合成音效均已接入；安全降级、音量 0 和暂停降音具备实现与测试证据。不能因没有实体听音记录而判断“没有音频”。

**代码质量：暂不建议无条件通过音频生命周期验收。** 发现 2 项 Important：成功解锁后上下文再次挂起无法通过手势恢复；页面被往返缓存保留后，已 dispose 的音频对象没有重建路径。两项均可导致当前页面会话持续无声，刷新页面才恢复。未发现 Critical；未另列 Minor。表现渲染范围内未发现需阻止验收的问题。

## Important

### P1：成功解锁后的挂起状态不能再次恢复

- 位置：`src/ui/SoundManager.ts:42`，关联 `:54`、`:78`、`:99`；实际手势调用见 `src/ui/GameApp.ts:564`、`:565`。
- 原因：`unlock()` 在 `unlocked === true` 时无条件返回，未检查当前 `AudioContext.state`。一旦首次成功的上下文随后进入 `suspended`（或需显式恢复的中断状态），后续 pointerdown/keydown 仍调用 `unlock()`，却永远不再调用 `resume()`；调度器与 `play()` 又都拒绝非 running 上下文。
- 复现：用记录型 WebAudio 宿主创建真实 `SoundManager`，首次 `await unlock()` 成功，再将该宿主状态置为 `suspended`，随后 `await unlock(); play('summon')`。本次内存探针输出：首次解锁后 `state=running, resumeCalls=1, nodes=3`；再次手势后 `state=suspended, resumeCalls=1, newNodes=0`。这是对恢复分支的确定性验证，不声称已在实体设备触发操作系统中断。
- 影响：音乐和全部 SFX 同时静默；音量滑块、恢复对局与再次点击均无法修复该上下文。
- 建议：区分“总线/调度器已初始化”与“上下文当前正在运行”。后续手势应能恢复已有 suspended/interrupted 上下文；保留并发 Promise 去重，避免恢复时重复创建总线或 BGM 调度器。添加“首次成功→挂起→手势恢复”的定点回归。

### P2：pagehide 无条件销毁音频，保留页面恢复后永久无声

- 位置：`src/ui/GameApp.ts:673`，关联单实例字段 `:48`、`src/ui/SoundManager.ts:42`、`:114`、`:120`。
- 原因：`pagehide` 回调不检查 `PageTransitionEvent.persisted`，无条件 `dispose()`。该方法永久置 `disposed=true` 并关闭上下文；源码中不存在 `pageshow` 重建音频管理器的路径。若浏览器以往返缓存保留此页面，返回后仍是同一个 GameApp 和已销毁的 SoundManager。
- 复现：已可播放页面→导航离开且 `pagehide.persisted=true`→由往返缓存返回原页面→点击/按键。预期恢复播放，实际调用 `unlock()` 立即退出。此次定点探针直接提取并执行 GameApp 的实际 pagehide 注册语句，向 EventTarget 派发 `persisted=true` 的 pagehide，再派发 pageshow 并执行 unlock/play；输出 `contextState=closed, contexts=1, oscillators=1, hasPageshowHandler=false`，仅保留首次 BGM 声源计数，没有恢复播放。
- 证据边界：已验证实际回调与保留对象的后果；未在本审查操作浏览器导航，未证明指定浏览器本次导航一定会命中往返缓存。问题的前提明确为页面实例被保留恢复。
- 建议：对缓存保留的 pagehide 暂停/降音而保留可恢复对象，或在 pageshow 重建 SoundManager 并等待下一次手势解锁；真正离开页面时继续完整释放。用 persisted=true 的生命周期回归验证恢复及无重复监听/调度。

## 规格核对与正向证据

| 范围 | 审查结果与定位 |
| --- | --- |
| 四图配色与装饰 | `StickerRenderer.ts:105`、`:132` 从所选 map 读取纸张、草坪、白垫、道路、水面颜色；`M3Effects.ts:19` 为花叶、樱花、厨具、猫柱分别绘制固定几何贴纸。 |
| 路径箭头 | `StickerRenderer.ts:171` 同时处理 ai/player，并读 `map.paths[side]`、按下一航点计算角度，不再固定使用后院 PATHS；STAGE 命中坐标未改。 |
| 六 Boss 与衍生物 | `StickerArt.ts:256` 起有杀人蜂、爱心眼耗子及六个 Boss 的独立分支，分别使用毛团/扇子、拳套、蜂翼/皇冠/号角、大张嘴、垃圾桶/骨杖、耳机/音箱等标志；`StickerRenderer.ts:290` 显示骨盾，`:300` 显示加速。 |
| 技能真实事件 | `BossMechanics.ts:41` 发出带 effect/捕获 points 的 boss_skill；`StickerRenderer.ts:437` 消费；`M3Effects.ts:37` 起绘制各自源点与目标效果，不依赖活单位重新猜目标。透明震波使用有效 Canvas rgba 色值。 |
| KO/混乱与数字开关 | `StickerRenderer.ts:272` 为击倒旋转星星，`:273` 为混乱螺旋；`:436` 只过滤 damage。GameApp `:180` 传入 profile 开关；M2 投射、道具和事件绘制仍保留。 |
| SVG 资产 | `M3Art.ts:19`、`:39` 分别提供 16/36 个固定几何图；`:76`—`:81` 规范尺寸、限定本地 ID、无 DOM/外链/脚本依赖。既有测试去掉 ID 与颜色后比较几何唯一性，不只是检查函数存在。 |
| 无宿主与失败降级 | `SoundManager.ts:46` 捕获构造/resume 失败；无 AudioContext 直接返回，未在手势前创建上下文。已有测试覆盖构造失败重试、resume 拒绝、pending resume 时 dispose。 |
| 首次解锁重入 | 本次定点探针额外验证双并发 unlock：`samePromise=true, contexts=1, resumeCalls=1`；首次初始化不会双播 BGM。 |
| 合成与音量 | `SoundManager.ts:7` 定义全部 11 类音效；`:80` 为 C/D/E/G/A 音阶；`:71`—`:74` 分别控制音乐和音效总线，音量 0 立即写入 0，暂停/后台以 0.16 秒时间常数降低音乐至 15%。同状态逐帧 duck 不重写包络。 |
| 去重与释放 | `SoundManager.ts:102` 按 battleId/event.id 去重，排除正值 orange 和 legendary purge；`:113` 清除定时器、监听、声源与上下文。GameApp 的一次性结算分支避免重复结算音效。释放本身有效，问题在恢复场景使用永久释放。 |

## 验证范围

- 接受任务提供及实施报告记录的既有结果：表现/声音定点 **35/35**，全量 **425/425**，typecheck 通过；本次未重复运行这些套件。
- 仅因命名风险执行两次无文件 Node 内存探针：使用现有 TypeScript 编译器在内存转译真实 SoundManager，并接记录型宿主；第二次执行从 GameApp 提取的实际 pagehide 注册行。结果如上，探针均退出码 0，不产生测试或产品文件。
- 未进行实体听音，故不对主观音色悦耳程度作通过或失败判断；合成节点、非零包络与有限停止时间已有测试证据。浏览器布局、窄屏交互和完整实机闭环由独立 UI 审查负责。

## 原两项 Important 定点复审（2026-11-13）

**当前结论：P1、P2 均关闭。** 此结论取代上文初审中“暂不建议无条件通过音频生命周期验收”的意见；上文保留作为修复前问题和证据记录。本次只复核两个问题、对应修复与邻近重入/资源释放边界，未重新审查全部功能，未改变其余规格覆盖结论。该范围内当前无未关闭的 Critical / Important / Minor。

复核依据为冻结源码、`verification/m3-review-sound-fix.diff` 中与原问题有关的段落，以及新增的两项音频回归。该 diff 仍相对 M2，未将其中其他 M3 功能当作本次新增变更重新审查。

| 原问题 | 修复与复审结果 | 判定 |
| --- | --- | --- |
| P1：挂起后下一次手势不能恢复 | `SoundManager.ts:42`—`:45` 先处理 disposed 和共享 pending Promise，只在已解锁且 context 为 running 时早返；`:55` 调用 resume，`:60` 对已初始化实例只刷新音量并复用原总线和定时器。恢复拒绝仍被捕获，finally 清除 pending 状态，后续手势可重试。 | 关闭 |
| P2：保留页面恢复后持有永久销毁对象 | `GameApp.ts:681`—`:688` 在 persisted pagehide 时保留 manager 并 duck，pageshow 清除 retainedPage 后按可见性/对局状态恢复音量；非 persisted 才 dispose。监听不再 once，能处理重复往返；`:172`、`:196`、`:451`、`:680` 均考虑 retainedPage，后续帧不会把保留状态的降音冲掉。 | 关闭 |

本次独立执行一次无文件、带断言的内存探针：使用真实 SoundManager 源码和从 GameApp 提取的实际 pagehide/pageshow 注册代码，接记录型 WebAudio 宿主与 EventTarget。验证结果如下，退出码 0：

- 首次成功后 suspended→双并发 unlock 共享同一 Promise，恢复 running；上下文始终 1 个，主总线对象未变，调度器始终 1 个。
- 恢复 resume 一次拒绝不抛出未捕获异常，下一次 unlock 恢复 running。
- 连续两次 `pagehide.persisted=true`→`pageshow`，保留音频对象；降音为原音乐增益的 15%，返回后恢复正常增益。两次均模拟上下文挂起，再通过 unlock 恢复，summon 各创建 2 个音效声源。
- 两次保留往返后再派发 `pagehide.persisted=false`，上下文关闭且剩余调度器为 0，证实移除 once 后真正离开仍会释放。

任务交接提供的验证记录为：新增回归修复前 2 失败/19 通过，修复后 `m3-sound` 21/21 通过；UI 已通过真实 WebAudio 的两次 PageTransitionEvent 往返及 context.suspend→手势恢复。已检查新增测试确实断言总线复用、单调度器、音效恢复与失败重试；本次未重复运行 21 项或全套测试。UI 全量 M3 QA 当时仍在重跑，本报告不将其视为已完成。

证据边界不变：这里的合成生命周期事件与真实 WebAudio 恢复验证，不等同于证明真实导航命中 BFCache；也不构成实体听音音质验收。原两项代码缺陷已由修复及定点证据闭环，无需把上述未执行的体验项作为继续挂起 P1/P2 的理由。
